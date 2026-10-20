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
                 humans (web, CLI, Slack)
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
| `@henosis/protocol` | zod schemas for actors, roles, directives, tool calls, events, wire messages | zod |
| `@henosis/kernel` | pure core: hashing, log, arbitration, approvals, reducer, merge, brief, replay, `Session` command layer | protocol |
| `@henosis/runner` | the agent loop, tool registry, scripted and Claude models | kernel |
| `@henosis/fleet` | project ledger, claims, lead directives, contentions, fleet brief, identity | kernel |
| `@henosis/memory` | organisation memory: attributed entries, conflicts, compaction, curator | kernel |
| `@henosis/chat` | groups and chats: a chained log per org with people and agents as members, mentions, agent replies, read markers, the council's events | kernel |
| `@henosis/server` | websocket and HTTP front door, project, session and chat hosts, notifications, the store seam | runner, fleet, memory, chat |
| `@henosis/slack` | Slack adapter (interface, fake, Bolt socket mode) | server |
| `@henosis/cli` | `henosis serve / migrate / demo / join / replay / verify / report / fleet / slack` | server, slack |
| `@henosis/web` | the product: React client that folds the same events as the server; PWA | kernel, fleet, protocol |

The kernel has **no Node dependency**: it ships its own SHA-256 so the browser, the CLI and
the server hash identically. The web client imports the kernel directly and runs `reduce` on
every event, which is why the e2e test can assert that two replicas are byte-identical.

## The event log

Every change to a session is an event: `{ id, prev, seq, branch, ts, actor, kind, payload }`.
`id` is SHA-256 over the canonical JSON of everything else, including `prev`, so any edit
to the past breaks the chain (`SessionLog.verify()`). `ts` is a per-branch logical clock.

Thirty-one event kinds cover the whole surface (`EventBody` in
`packages/protocol/src/index.ts`): session created; participants and roles; directives,
withdrawals and contention resolutions; agent turn start, model completion, tool request
and completion, turn end; approval request and vote; plan proposed, rated and decided, step
started and completed; handoff request, accept, decline; checkpoint; workspace change and
blocked write; branch create and merge; notes; project directives applied and withdrawn;
fleet contentions mirrored in. Model text and tool outputs are *in* the log, so replay never
calls a model or a tool.

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

## Storage

Every edition keeps the same four logs (a session's log, a project's ledger, an organisation's
memory and its chat) and the same documents (`orgs`, `users`, `push`). What differs is where,
and that is the storage seam: `packages/server/src/store/`.

**The seam.** `Store` has `readLog(kind, id)`, `writeLog(kind, id, serialized)`,
`appendEvents(kind, id, events, branches?)`, `listLogs(kind)`, `readDoc(name)`,
`writeDoc(name, json)`, `listDocs()` and `close()`. A file answers at once and a database
answers later, so every caller of a `Store` awaits. A host cannot: it folds its log in memory
and must answer a websocket message without a round trip, so hosts take a `LiveStore`, the
same operations synchronous. The file store is a `LiveStore` as it is; a database becomes one
through `MirrorStore`, which loads every log and document on start, answers reads from the
mirror, and writes through on an ordered queue (`flush()` waits for it, `close()` flushes and
closes the database). The hosts hold every open log folded anyway, so the mirror costs little
more than arrays pointing at the same event objects; it is sound because one process owns a
store (one `henosis serve` per org in the Team edition).

**Appending, not rewriting.** A host flushes through a `LogWriter`, which remembers how much
of each branch the store holds and appends only the events since the last flush, announcing a
new branch when a fork made one; the whole log is written only the first time a log the store
never saw is flushed. The file store applies an append to the copy it keeps and rewrites the
file (atomic temp-and-rename, debounced 20 ms as before); the Postgres store inserts rows.

**`FileStore`** (Starter) is the folder every store has been, byte for byte:
`sessions/<id>/log.json` with `blobs/<sha256>` beside it, `projects/<id>/ledger.json`,
`memory/<org>.json`, `chat/<org>.json`, and `orgs.json`, `users.json`, `push.json` in the
root (the first two stay pretty-printed, as they are hand-edited). `henosis replay`, `verify`,
`report` and `fleet` keep reading these files directly.

**`PostgresStore`** (Team, Enterprise) is three tables, created by `ensureSchema()`:
`branches (kind, log_id, name, parent, fork_point, created_seq, ord)`, one row per branch;
`events (kind, log_id, branch, seq, event jsonb)`, one row per event; `docs (name, json
jsonb)`. A log exists when it has a branch row; `writeLog` replaces it in one transaction and
`appendEvents` inserts. The connection string is `HENOSIS_DATABASE_URL` (or
`--database-url`); `henosis serve --store postgres` opens it, ensures the schema and runs the
server on a mirror of it. The `pg` driver is the only runtime dependency; the tests run the
same suite on `pg-mem`, so no database is needed to develop. Blobs stay on disk under the
root in every edition (a `blobs` table is the next step).

**Migration.** `henosis migrate --from <dir> --to postgres` (and `--from postgres --to <dir>`)
copies every log and document, then folds both sides and compares them: a log's head hash is
the id of the last event on each branch, which commits to the whole chain before it; a
document's is its canonical hash. It prints a table (kind, id, branches, events, from, to,
ok) and refuses to finish, exit code 3, when any row differs. A `jsonb` column keeps keys in
its own order, which is why the chain hashes over canonical JSON (`hash.ts`) and why a log
that went through Postgres verifies the same.

**Phase 1 and after.** Compaction (an append-only JSONL per branch with a snapshot every k
events for the file store; a snapshot row for the database) and moving the log into the
actor's storage both sit behind the same seam.

## Token usage

`agent.model.completed` carries an optional `usage` (`Usage` in the protocol: input, output,
cache read, cache write). The Claude adapter copies the Messages API's counts; the scripted
model synthesises them from the prompt it would have sent and the text it emits, so demos and
tests get stable numbers. The reducer sums usage into the current `TurnRecord` and into
`SessionState.usage` (cumulative for the branch, inherited history included), which gives the
brief, the report, the web client and `budgetStatus()` one source. At every turn end the
runner's status report puts the session's usage on the project ledger, so the fleet brief and
the agents rail read it without opening the session.

`GET /api/usage?org=&team=&project=&user=&since=` rolls the store up: totals, by session, by
owner, by project. The logs are the source of the numbers (own events of every branch, so a
fork's inherited history counts once); the ledgers supply registrations, names and the last
report of a session whose log is gone. Events carry `ts` as a Lamport clock and nothing in
`storage.ts` records wall-clock time, so the report cannot be sliced by day: `since` is a seq
on the logical clock and the time series is `byTurnBucket`, usage grouped by the agent turn it
was spent in, ten turns per bucket. An ISO `since` is accepted, ignored and named in
`warnings`. When persistence gains a wall clock (phase 1 JSONL), `byDay` can join it without
changing the rest of the shape.

## Wire protocol

Session, client to server: `join`, `directive`, `withdraw`, `resolve`, `vote`, `plan.rate`,
`plan.decide`, `handoff.request`, `handoff.accept`, `handoff.decline`, `role`, `checkpoint`,
`fork`, `merge`, `switch`, `note`, `presence`, `brief`, `leave`. Server to client: `joined`,
`snapshot` (the branch history, or the tail after the `sinceSeq` a rejoining client sends,
with a `reconnect` line; `13_fleet_collaboration.md`), `event`, `presence`, `brief`, `error`.
Projects: `project.subscribe` and `project.unsubscribe` in, `project.snapshot`,
`project.event` and `fleet.brief` out. Chat: `chat.subscribe`, `chat.unsubscribe`,
`chat.create`, `chat.add`, `chat.remove`, `chat.rename`, `chat.say`, `chat.read` and the
council's `chat.council.convene`, `chat.council.instruct`, `chat.council.end` in;
`chat.snapshot` and `chat.event` out. The schemas are `ClientMessage` and `ServerMessage`
in the protocol package and `packages/chat/src/wire.ts`. Clients never receive derived
state; they derive it.

Authentication is a shared token and client-asserted identity in dev mode, acceptable for a
dev server and nothing else, or OIDC ID tokens verified on every request in the Team edition.
See `07_security_and_compliance.md`, "Identity".

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
`henosis://p/<project>/s/<session>` that the notifications carry.

## What is not here yet

Multi-process hosting, per-event signatures (sign-in is OIDC; see `07`), a GitHub adapter,
LLM-assisted merge of context, Merkle inclusion proofs for observers, compaction of long
session logs, semantic overlap detection for claims, adapters for third-party harnesses, and
the host that runs a council's rounds (`19_council.md`). All are on the roadmap with the
reasoning in `06_roadmap.md`.
