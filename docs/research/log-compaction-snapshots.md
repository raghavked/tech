# Log compaction and snapshots: keeping week-long Fold sessions fast

Research memo, 2026-10-02. Topic slug: `log-compaction-snapshots`.

## Why it matters for Fold

A Fold session is a hash-chained event log that everyone on the team folds into state. That is the product's integrity story, and it is also its scaling problem. Three places in the current repo assume the log is small:

1. **Persistence rewrites the whole log.** `packages/server/src/storage.ts` serialises the entire `SerializedLog` to `store/sessions/<id>/log.json` on every flush (debounced 20 ms). At one tool call per few seconds, a week-long session is tens of thousands of events and tens of megabytes; every flush becomes an O(log) JSON.stringify plus rename. `FileBlobStore` also reads every blob into memory on boot.
2. **Join sends everything.** `host.ts` answers `join` with `{ type: "snapshot", events: session.events(branch) }`, the full linear history, and `apps/web/src/client.ts` does `fold(msg.events)` from genesis. A manager opening a day-six session on a laptop pays the full replay in the browser, then pays it again on every reconnect.
3. **Rendering is unwindowed.** `SessionView.tsx` recomputes `blocksOf(events, …)` over the whole array on every event and renders every block into the 760 px column, then `scrollIntoView` on the end ref. Thousands of DOM blocks, each with collapsed tool lines, is where the "quiet" register dies: the composer stutters while the agent streams.

The kernel already has the right primitive. `packages/kernel/src/replay.ts` exposes `resumeFrom(snapshot, events)` and `checkReplay()` proves that snapshot-plus-tail hashes identically to full replay. `docs/04_technical_architecture.md` names the Phase 1 plan: append-only JSONL per branch and a snapshot every k events. This memo is about making that plan concrete across server, wire, client cache and renderer, and about what comparable products measured.

## Prior art

1. **Kurrent (EventStoreDB), "Snapshots in event sourcing"** (https://www.kurrent.io/blog/snapshots-in-event-sourcing/, accessed 2026-10-02, page blocked by egress proxy, snippets only, UNVERIFIED). Snapshot = state of an aggregate at a point in time, stored in a *separate stream*, recording the version of the last event it covers. Strategies: every N events (100 and 1,000 are both quoted), time based, on demand. Rule of thumb from the surrounding literature: snapshot once replay of a hot aggregate exceeds ~100 ms; teams report 50-80 % replay reduction (codeopinion.com and dev.to summaries, UNVERIFIED).
2. **Claude Code session transcripts** (https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-sessions and the community format note at https://evilpiepirate.org/forge/kent/consciousness/raw/branch/master/doc/claude-code-transcript-format.md, accessed 2026-10-02, latter blocked, UNVERIFIED). One JSONL file per session under `~/.claude/projects/<path>/<id>.jsonl`, one JSON object per line appended in real time; `/compact` writes a summary and the next user line begins "This session is being continued from a previous conversation". Resume deserialises the file into context. Compaction is a *log-visible event*, not an out-of-band rewrite.
3. **Linear sync engine** (https://linear.app/blog/rebuilding-delta-sync-read-path and https://linear.app/blog/scaling-the-linear-sync-engine, accessed 2026-10-02, blocked, UNVERIFIED; corroborated by https://performance.dev/what-makes-linear-feel-instant and the reverse-engineering study https://docsearch.algolia.com/mcp/docs/repo/wzhudev/reverse-linear-sync-engine). A single monotonically increasing `lastSyncId` versions the whole database; the client stores a bootstrap in IndexedDB (their own workspace is ~150 MB) and asks for a *delta*, an id-ordered array of `SyncAction` tuples, since its stored id. Rows are written to IndexedDB progressively rather than held as one blob; models declare a load strategy, including "partial" (fetched on demand, e.g. comments scoped to an issue).
4. **Figma multiplayer and file format** (https://www.figma.com/blog/multiplayer-editing-in-figma/ and https://madebyevan.com/figma/, accessed 2026-10-02, both blocked, UNVERIFIED). One binary format (kiwi) serves both the live sync stream and the on-disk snapshot; a `.fig` snapshot bundles schema plus data plus referenced images in a zip, while the live stream omits the schema because the client already knows it. Undo in multiplayer is defined by an invariant ("undo a lot, copy, redo back: the document must not change") rather than by replaying history.
5. **LangSmith long traces** (https://support.langchain.com/articles/9719508217-why-is-my-trace-exploration-slow-in-langsmith and https://blog.langchain.dev/customers-replit, accessed 2026-10-02, blocked, UNVERIFIED). Hard cap of 25,000 runs per trace; Replit Agent traces of "hundreds, even thousands" of child runs forced both ingestion and frontend-rendering work; the support article's main fix is "hide the Metadata column", i.e. large payloads in the list view, not row count, were the measured cause of slow exploration. The trace view added in-trace filtering rather than rendering everything.
6. **TanStack Virtual, chat and reverse feeds** (https://tanstack.com/virtual/latest/docs/chat and https://tanstack.com/blog/tanstack-virtual-chat, accessed 2026-10-02, blocked, UNVERIFIED). Recent release adds `anchorTo: 'end'`, `followOnAppend`, `scrollEndThreshold`, keyed prepend that keeps the visible item in place without `column-reverse`, and `measureElement` for dynamic heights via ResizeObserver.

## What to borrow

- **Separate snapshot stream with a version pointer** (Kurrent). Fold's equivalent: `snapshots/<branch>/<seq>.json` next to `events/<branch>.jsonl`, never inside the chain. The chain stays the only truth; snapshots are a cache that `checkReplay` can audit.
- **Compaction as an event** (Claude Code). When the runner summarises turns for the model's context, emit `turn.compacted` with the summary and the covered seq range. The UI then folds a thousand tool lines into one quiet notice, and the brief generator reads the summary instead of raw turns.
- **Monotonic cursor plus delta** (Linear). Fold already has `seq` per branch and the architecture doc promises "events after a sequence number in phase 1". Make it the only join path: the client sends its last verified `(branch, seq, hash)`, the server replies with a snapshot only when the gap is large.
- **Payload stripping, not row limits** (LangSmith). Tool outputs are the big payloads. Ship them as blob hashes in the event and fetch the body on expand.
- **One format for wire and disk** (Figma). Fold's JSONL line and the websocket `event` message should be byte-identical so the client can append straight into its IndexedDB tail.
- **End-anchored virtualisation** (TanStack). The conversation column is a reverse feed; follow the end only when the reader is already there, which is exactly the "watch, then steer" posture.

## What is unsolved

- **Fork and fold with snapshots.** A fork is a pointer into the parent at a checkpoint. A snapshot taken on the parent *after* the fork point is useless to the child; a snapshot *at* the checkpoint is useful to both. No prior art here covers branch-aware snapshot placement; it has to come from Fold's own log structure.
- **Snapshot schema drift.** Kurrent's caveat: a snapshot encodes the reducer's state shape. When `SessionState` changes, old snapshots must be rebuilt or ignored. Hash them with a reducer version.
- **Verification versus laziness.** An observer who loads snapshot-plus-tail has not verified the prefix. Merkle inclusion proofs are in the roadmap; until then the client must know and show that it is trusting the server's snapshot.
- **Numbers.** None of the comparable products publish replay or render latencies for thousand-event sessions; every figure above is a cap, a size or a rule of thumb. Fold should measure its own.

## Concrete recommendations for Fold

1. **JSONL per branch with a sidecar snapshot stream** in `packages/server/src/storage.ts`: `events/<branch>.jsonl` appended with `fs.appendFile` per event (no debounce, no whole-log rewrite), `snapshots/<branch>/<seq>.json` written every k = 500 events *and* at every checkpoint event so forks inherit a snapshot. Keep `log.json` readable for migration; `readLog` falls back to it.
2. **Delta join in the wire protocol** (`packages/protocol/src/index.ts`, `packages/server/src/host.ts`): client `join` carries `{ branch, seq, hash }`; server answers `snapshot { state, seq, stateHash }` + `events` tail when the gap exceeds k, otherwise just the tail. Add a `snapshot` message variant carrying `SessionState` rather than events; `resumeFrom` in `packages/kernel/src/replay.ts` already consumes it.
3. **IndexedDB event cache in the client** (new `apps/web/src/cache.ts`): object store `events` keyed `[sessionId, branch, seq]`, store `snapshots` keyed `[sessionId, branch]`. On open, fold from the cached snapshot and tail before the socket connects; on `event`, append. Wrap every access in try/catch and degrade to the current in-memory path (private windows, Tauri webviews with cleared data).
4. **Reducer version in snapshot hashes** (`packages/kernel/src/replay.ts`): export `REDUCER_VERSION`; `stateHash` mixes it in; `resumeFrom` rejects a snapshot from another version and the server rebuilds it lazily. Extend `checkReplay` to test every stored snapshot, not just the midpoint, and expose it as `fold verify --snapshots` in `packages/cli`.
5. **Incremental blocks and windowed rendering** (`apps/web/src/views/SessionView.tsx`): make `blocksOf` incremental (memoise by last seq; append-only except when a tool result closes an open step), move the column onto `@tanstack/react-virtual` with `anchorTo: 'end'`, `followOnAppend`, `measureElement`, `getItemKey = block.id`, overscan 8. Keep the composer and approval notices outside the virtualised list so they never unmount.
6. **Blob-backed tool outputs** (`packages/protocol`, `packages/runner`): `agent.tool.completed` carries `{ outputHash, preview }` with the full body in the blob store; the client fetches `/api/blob/<hash>` on expand. This is LangSmith's "hide the heavy column" made structural, and it shrinks both the JSONL tail and the IndexedDB cache.
7. **`turn.compacted` event** (`packages/protocol`, `packages/runner`, `packages/kernel/src/state.ts`): when the runner summarises for context, record the summary and covered range; the reducer keeps raw turns but marks them; `blocksOf` collapses the range into one notice ("Folded 212 steps, day 3", in the quiet divider style), expandable on click.

## Sources

- https://www.kurrent.io/blog/snapshots-in-event-sourcing/ (blocked; snippet)
- https://codeopinion.com/snapshots-in-event-sourcing-for-rehydrating-aggregates/ (snippet)
- https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-sessions (snippet)
- https://evilpiepirate.org/forge/kent/consciousness/raw/branch/master/doc/claude-code-transcript-format.md (blocked; snippet)
- https://linear.app/blog/rebuilding-delta-sync-read-path (blocked; snippet)
- https://linear.app/blog/scaling-the-linear-sync-engine (blocked; snippet)
- https://performance.dev/what-makes-linear-feel-instant (snippet)
- https://www.figma.com/blog/multiplayer-editing-in-figma/ (blocked; snippet)
- https://madebyevan.com/figma/ (blocked; snippet)
- https://support.langchain.com/articles/9719508217-why-is-my-trace-exploration-slow-in-langsmith (blocked; snippet)
- https://blog.langchain.dev/customers-replit (blocked; snippet)
- https://tanstack.com/virtual/latest/docs/chat (blocked; snippet)
- https://tanstack.com/blog/tanstack-virtual-chat (snippet)
- Repo: /home/user/tech/docs/04_technical_architecture.md, packages/kernel/src/replay.ts, packages/server/src/storage.ts, packages/server/src/host.ts, apps/web/src/client.ts, apps/web/src/views/SessionView.tsx
