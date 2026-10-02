# Technical architecture

*Phase 0 as built in this repository. Everything described here runs offline with the
scripted model; the Claude adapter is a drop-in.*

## The shape

One **session** is one authoritative actor. It owns the write path, the log, the workspace
blobs and the agent runner. Any number of humans attach over websockets; each receives the
branch history once and every subsequent event as it is committed, and folds them with the
same reducer the server uses. There is no second source of truth: presence is the only
ephemeral state, and it is never written to the log.

```
                 humans (web, CLI, Slack adapter later)
                        │  websocket: join / directive / vote / fork / merge / handoff
                        ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ SessionHost  (packages/server)                              │
   │   Session (packages/kernel)                                 │
   │     SessionLog: hash-chained, branchable, append-only       │
   │     reduce(): events -> SessionState (pure, total)          │
   │     arbitrate(): directives -> Intent (order-independent)   │
   │     approvals, handoff brief, three-way workspace merge     │
   │   Runner (packages/runner), one per branch                  │
   │     turn loop: intent -> model -> tools, yielding at safe   │
   │     points; records model/tool outputs; resumes from log    │
   │   FileBlobStore + log.json (atomic writes)                  │
   └─────────────────────────────────────────────────────────────┘
                        │
                        ▼
                 model adapters: ScriptedModel (offline), ClaudeModel
```

This is the shape of a Cloudflare Durable Object, a PartyKit room, or a Temporal workflow
worker: a single writer with many observers. Phase 1 moves the host into one such actor per
session; nothing in the kernel changes because the kernel never does I/O.

## Packages

| Package | Role | Depends on |
|---|---|---|
| `@fold/protocol` | zod schemas for actors, roles, directives, tool calls, events, wire messages | zod |
| `@fold/kernel` | pure core: hashing, log, arbitration, approvals, reducer, merge, brief, replay, `Session` command layer | protocol |
| `@fold/runner` | the agent loop, tool registry, scripted and Claude models | kernel |
| `@fold/fleet` | project ledger, claims, lead directives, contentions, fleet brief, identity | kernel |
| `@fold/memory` | organisation memory: attributed entries, conflicts, compaction, curator | kernel |
| `@fold/server` | websocket and HTTP front door, project and session hosts, notifications, persistence | runner, fleet, memory |
| `@fold/slack` | Slack adapter (interface, fake, Bolt socket mode) | server |
| `@fold/cli` | `fold serve / demo / join / replay / verify / report / fleet / slack` | server, slack |
| `@fold/web` | the product: React client that folds the same events as the server; PWA | kernel, fleet, protocol |

The kernel has **no Node dependency**: it ships its own SHA-256 so the browser, the CLI and
the server hash identically. The web client imports the kernel directly and runs `reduce` on
every event, which is why the e2e test can assert that two replicas are byte-identical.

## The event log

Every change to a session is an event: `{ id, prev, seq, branch, ts, actor, kind, payload }`.
`id` is SHA-256 over the canonical JSON of everything else, including `prev`, so any edit
to the past breaks the chain (`SessionLog.verify()`). `ts` is a per-branch logical clock.

Thirty event kinds cover the whole surface (see `packages/protocol/src/index.ts`):
participants and roles; directives, withdrawals and contention resolutions; agent turn
start, model completion, tool request and completion, turn end; approval request and vote;
handoff request, accept, decline; checkpoint; workspace change; branch create and merge;
notes. Model text and tool outputs are *in* the log, so replay never calls a model or a tool.

Branches share history: a branch is `(parent, forkPoint)` plus its own events, and
`eventsOf(branch)` returns the linear history a reducer folds. Forks start only at
checkpoints, which pin a content hash of the workspace tree.

## The reducer

`reduce(state, event)` is pure and total; `fold(events)` is the state. Snapshots are plain
JSON, so resuming a long session is `fold(tail, snapshot)`. `checkReplay()` asserts in tests
and in the CLI that full replay and snapshot-plus-tail hash identically.

State includes participants and the driver token, every directive with its arbitration
status, open contentions, the composed intent, approvals with votes, handoffs, turns with
their tool calls and results, the workspace tree (path to blob hash), checkpoints, branches,
merges, notes, and a derived status: `idle | running | paused | awaiting_approval | blocked | cancelled`.

## The runner

A turn is: start event, then up to N model calls, each followed by its tool calls. Before
every model call and before every tool call the runner checks a yield condition: cancelled,
paused, an unconsumed interrupting directive, a goal contention, or merge conflicts. If it
must stop it records a result for every unexecuted call and ends the turn with the reason.

Approvals are a tool-call gate: the runner emits `approval.requested` and waits for the
reducer to flip the approval to granted or denied. A denied call becomes a failed tool result
the model sees; it does not throw.

Resume is a first-class path. If a runner dies mid-turn, the next runner finds `currentTurn`
in the state, executes the tool calls the model already decided on that have no result, and
then continues. The runner test "resumes a half-finished turn from the log after a crash"
covers it, and `SessionHost` does it on boot for every branch.

The scripted model is a pure function of the request (intent, files, this turn's transcript,
turn summaries), which is what makes the demo and tests reproducible. The Claude adapter maps
the same request onto the Messages API with custom tools and records the response verbatim.

## Persistence

`store/sessions/<id>/log.json` is the serialized log (atomic temp-and-rename on every flush,
debounced 20 ms) and `blobs/<sha256>` are workspace file contents. This is deliberately
boring. Phase 1 replaces it with an append-only JSONL per branch and a snapshot every k
events; Phase 2 moves it into the actor's storage.

## Wire protocol

Client to server: `join`, `directive`, `withdraw`, `resolve`, `vote`, `handoff.*`, `role`,
`checkpoint`, `fork`, `merge`, `switch`, `note`, `presence`, `brief`, `leave`.
Server to client: `joined`, `snapshot` (full branch history), `event`, `presence`, `brief`,
`error`. Clients never receive derived state; they derive it. A reconnecting client can ask
for events after a sequence number in phase 1 and verify the prefix it already holds against
the chain.

Authentication in phase 0 is a shared token and client-asserted identity, acceptable for a
dev server and nothing else. See `07_security_and_compliance.md`.

## Fleet and memory hosts

A `ProjectHost` owns every `SessionHost` in a project plus the project ledger. It hands each
runner a guard (claims, refused writes, status reports) and a memory access (attributed
writes, scoped context), propagates lead directives into every branch of every session,
detects cross-session contentions after status reports and merges, mirrors them into the
sessions involved, and fans project events out to subscribers. One `MemoryStore` per
organisation is shared across its projects and persisted beside the project ledgers. Store
layout: `store/sessions/<id>/`, `store/projects/<id>/ledger.json`, `store/memory/<org>.json`,
`store/orgs.json`, `store/users.json`, `store/push.json`.

## Shells

The web app is the product. The desktop shell (Tauri) and the mobile shell (Capacitor)
load the same built client, add a tray and native push, and open deep links of the form
`fold://p/<project>/s/<session>` that the notifications carry.

## What is not here yet

Multi-process hosting, real authentication, a GitHub adapter, LLM-assisted merge of
context, Merkle inclusion proofs for observers, compaction of long session logs, semantic
overlap detection for claims, and adapters for third-party harnesses. All are on the roadmap
with the reasoning in `06_roadmap.md`.
