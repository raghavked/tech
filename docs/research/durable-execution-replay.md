# Durable execution and deterministic replay for the Henosis session kernel

Research memo, 2026-10-02. Vendor documentation domains (docs.temporal.io, docs.restate.dev, restate.dev, docs.dbos.dev) were blocked by the egress proxy; claims drawn from search snippets alone are marked UNVERIFIED.

## Why it matters for Henosis

Henosis's whole claim rests on `fold(events)` being a pure function: the server, CLI, browser and Tauri shell all compute the same state from the same hash-chained log (`packages/kernel/src/state.ts`, `replay.ts`). That is true today for one version of the code. It stops being true the first time the arbitration table, the approval policy, the diff3 merge or the turn bookkeeping changes, because a year-old log folded by next year's reducer can yield a different brief, a different winner in a contention, or a different "who approved what". Nothing in the current log detects this: the hash chain commits to event contents, not to the state they produce, and `SerializedChain.version` (`log.ts`) is a file-format number, not a semantics number.

Two further pressures: sessions that live for months will outgrow a single linear history (a team session is thousands of tool lines a week), and the runner (`packages/runner/src/runner.ts`) resumes a crashed turn by re-reading open tool calls from state, so a runner upgrade in the middle of a turn is exactly the "code changed while in flight" case durable-execution systems spend most of their design on.

## Prior art

1. **Temporal: patch markers and `getVersion`.** Workflow code must be deterministic on replay. A code change is introduced behind `patched("id")` / `getVersion`, which records a marker event in history the first time it is evaluated so that all later evaluations on that execution return the same answer; a worker replaying a history that contains a marker its code does not produce fails the task. Three steps: add the patch, later replace with `deprecatePatch`, and remove it only once every pre-patch execution has left retention. https://docs.temporal.io/develop/java/workflows/versioning (snippet, UNVERIFIED; accessed 2026-10-02).
2. **Temporal: history bounds and Continue-As-New.** Event history is capped at 51,200 events or 50 MB with a warning at 10,240 events or 10 MB; a long execution closes itself and atomically starts a new run with the same Workflow Id, a fresh history and carried-over parameters. The stated reason is operational: a crashed worker's replacement must load the entire history. https://docs.temporal.io/workflow-execution/limits and https://docs.temporal.io/develop/dotnet/continue-as-new (snippets, UNVERIFIED; accessed 2026-10-02).
3. **Temporal: Worker Versioning (GA) and Upgrade on Continue-as-New.** Each workflow type is either *Pinned* (runs to completion on the build it started on, never needs patches) or *Auto-Upgrade* (moves to the newest build and must stay replay-safe by patching). Old builds enter *Draining* while pinned executions remain, and the server reports when they are drained. With upgrade-on-continue-as-new, a pinned run learns a new target version exists and opts in at its next continue-as-new, so the boundary between runs becomes the upgrade point. https://docs.temporal.io/production-deployment/worker-deployments/worker-versioning/upgrade-on-continue-as-new and https://temporal.io/blog/ga-worker-versioning-public-preview-upgrade-on-continue-as-new (snippets, UNVERIFIED; accessed 2026-10-02).
4. **Restate: journaling and immutable deployments.** Restate journals each handler's side effects and replays the journal on recovery; nondeterminism is a deployment hazard, so deployments are immutable and an invocation is bound to the deployment it started on, new invocations route to the latest deployment, and old deployments scale to zero once drained. https://docs.restate.dev/concepts/durable_execution and https://docs.restate.dev/services/versioning (snippets, UNVERIFIED; accessed 2026-10-02).
5. **DBOS: version tagging, selective recovery, fork.** Every workflow is tagged with the application version it started on (default: a hash of the workflow source). Recovery only touches workflows whose version matches the running code; the recommended deploy is blue-green, old processes kept alive until their workflows finish. `fork_workflow(workflow_id, start_step, application_version)` copies a workflow's inputs and completed steps up to a chosen step and continues on a (possibly newer) version, the documented way to "patch" a workflow stuck on a buggy build. https://docs.dbos.dev/python/tutorials/upgrading-workflows and https://docs.dbos.dev/typescript/tutorials/workflow-management (snippets, UNVERIFIED; accessed 2026-10-02).
6. **Replay testing in CI.** Capture representative histories as JSON fixtures and replay them against the current code in CI (`WorkflowReplayer`, `worker.runReplayHistory`); a `DeterminismViolationError` fails the build before deploy. https://bitovi.com/blog/replay-testing-to-avoid-non-determinism-in-temporal-workflows (accessed 2026-10-02).
7. **Azure Durable Functions versioning.** Same lesson from a third vendor: side-by-side deployments and routing in-flight orchestrations to the old app are the recommended path for breaking changes. https://learn.microsoft.com/azure/azure-functions/durable/durable-functions-versioning (snippet, UNVERIFIED; accessed 2026-10-02).

## What to borrow

Henosis is in a better position than any of these systems, and should say so in `docs/05_kernel_design.md`: because model outputs and tool results are events, replay never re-executes the loop. What must stay deterministic is only the reducer, not user code. The borrowed ideas therefore attach to the reducer and to the runner's turn boundary:

- **Marker in the log, not a flag in the code** (Temporal patch markers). A version change is itself an event, so the reducer can select rules per event by looking backwards in the same log, and the choice is tamper-evident.
- **Pin for the duration, upgrade at a boundary** (Restate deployment binding, Temporal pinned + continue-as-new). Henosis's natural boundary is `agent.turn.ended`; a turn is the invocation.
- **Tag and refuse** (DBOS). Record the version that wrote each event; a resuming runner refuses to continue a turn written by an incompatible version and starts a fresh one instead of guessing.
- **Hard caps plus an atomic rollover** (continue-as-new) rather than hoping sessions stay small.
- **Replay corpus in CI** so determinism is a build gate, not a property we assert in prose.

## What is unsolved

- Every system above versions *control flow*. None versions *semantics of derived state*: a Temporal history replayed on new code that produces the same commands is "deterministic" even if a bug fix now computes a different value. Henosis's arbitration is exactly such a value: changing rule 2 (rank beats recency) changes who steered the agent in old logs. There is no off-the-shelf answer; the state-hash witness below is our own.
- Snapshots (`resumeFrom`) are only as trustworthy as the reducer that produced them; nobody documents cross-version snapshot validity.
- Branches complicate rollover: a fork at a checkpoint before a rollover must still replay through the parent's pre-rollover history.
- Big tool outputs (Temporal's per-payload limit is a few MB, UNVERIFIED) sit inside the hashed event; offloading them to content-addressed blobs changes what the hash commits to.

## Concrete recommendations for Henosis

1. **Stamp versions on events.** In `packages/protocol/src/index.ts` add to `SessionEvent` a `v: { schema: number; kernel: string; runner?: string }`. `kernel` is the reducer's semantic version (hand-bumped on any change to `state.ts`, `intent.ts`, `approvals.ts`, `merge.ts`); `runner` is set only on `agent.*` and `tool.*` events. Bump `SerializedChain.version` to 2 in `log.ts` with a loader that defaults missing stamps to `{schema:1, kernel:"0.x"}`.
2. **`kernel.upgraded` marker event.** When a runner or server with a newer kernel first appends to a branch, it appends `kernel.upgraded { from, to }` first (`packages/kernel/src/session.ts`). `fold` in `state.ts` keeps a `rules` field in state set by that marker and consults it where behaviour changed (e.g. `arbitrate(rules, ...)` in `intent.ts`). Old code paths are removed only after a documented retention window, mirroring `deprecatePatch`.
3. **State-hash witnesses.** Add `stateHash` to the payloads of `agent.turn.ended` and `checkpoint.created` (`session.ts`), computed with `stateHash()` from `replay.ts` over the state *before* the event. `henosis verify` (`packages/cli`) recomputes and reports the first event whose witness diverges, which is the point where a semantic change or bug altered history. This is the check no vendor offers and the one Henosis's arbitration needs.
4. **Pin turns, upgrade at turn boundaries.** In `runner.ts`, `runTurn` compares `state.currentTurn.v.runner` to its own; on a major mismatch it does not resume the pending tool calls but ends the turn with a new outcome `yielded: "runner-upgraded"` and lets `shouldTurn` start a clean turn. Minor mismatches resume. Document the rule in `05_kernel_design.md` §1.
5. **Rollover (continue-as-new).** Add `session.rolled { snapshot, stateHash, fromSeq }` to the protocol; the server appends it when a branch exceeds a configured bound (default 10,000 events or 10 MB, Temporal's warning thresholds). `log.ts` gains `eventsOf(branch, { from: "latestRollover" })`; `resumeFrom` loads the embedded snapshot; the full prefix is retained for `henosis verify` and for forks taken before the rollover. Snapshots carry their `kernel` version; `resumeFrom` refuses a snapshot from a different major and re-folds from the log, as DBOS refuses cross-version recovery.
6. **Replay corpus as a build gate.** Create `packages/kernel/test/fixtures/logs/` with one exported log per release (a contention, a quorum approval, a fork-and-merge, a rollover) and head `stateHash` values; a vitest test folds each and compares. Any PR that changes a hash must bump `kernel` and add a `kernel.upgraded` case. `henosis verify` grows a `--corpus` flag so teams can run the same check on their own archived sessions.
7. **Content-addressed payloads.** Tool results above 64 KB are stored by hash under the workspace blob store (`packages/server`), and the event payload carries `{ blob: hash, bytes }`. The event hash then commits to the blob hash, and histories stay small enough to ship to the browser and the phone.

## Sources

- https://docs.temporal.io/develop/java/workflows/versioning (accessed 2026-10-02, snippet, UNVERIFIED)
- https://docs.temporal.io/workflow-execution/limits (accessed 2026-10-02, snippet, UNVERIFIED)
- https://docs.temporal.io/develop/dotnet/continue-as-new (accessed 2026-10-02, snippet, UNVERIFIED)
- https://docs.temporal.io/production-deployment/worker-deployments/worker-versioning/upgrade-on-continue-as-new (accessed 2026-10-02, snippet, UNVERIFIED)
- https://temporal.io/blog/ga-worker-versioning-public-preview-upgrade-on-continue-as-new (accessed 2026-10-02, snippet, UNVERIFIED)
- https://docs.restate.dev/concepts/durable_execution (accessed 2026-10-02, snippet, UNVERIFIED)
- https://docs.restate.dev/services/versioning (accessed 2026-10-02, snippet, UNVERIFIED)
- https://docs.dbos.dev/python/tutorials/upgrading-workflows (accessed 2026-10-02, snippet, UNVERIFIED)
- https://docs.dbos.dev/typescript/tutorials/workflow-management (accessed 2026-10-02, snippet, UNVERIFIED)
- https://bitovi.com/blog/replay-testing-to-avoid-non-determinism-in-temporal-workflows (accessed 2026-10-02)
- https://learn.microsoft.com/azure/azure-functions/durable/durable-functions-versioning (accessed 2026-10-02, snippet, UNVERIFIED)
