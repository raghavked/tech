# Session replay and time travel: a minimal scrubber for Henosis

Slug: `session-replay-time-travel-ux` · 2026-10-02 · Access note: every vendor doc domain (help.figma.com, docs.replay.io, developer.chrome.com, docs.langchain.com, learn.microsoft.com, claudelog.com) was blocked by the egress proxy; claims below come from search snippets and are marked UNVERIFIED where the snippet was the only source.

## Why it matters for Henosis

Henosis's log is already a time machine: `fold(events)` is deterministic, `resumeFrom(snapshot, tail)` equals full replay, and `checkRelay` proves it (`packages/kernel/src/replay.ts`, `state.ts:510`). What is missing is the human side. Today the web client renders `snap.events` as one flat stream (`apps/web/src/views/SessionView.tsx`, `blocksOf`), and the only time-travel affordance is a "Checkpoint" divider plus a fork field in the drawer. The product promise is "anyone drops in and understands the session"; the kernel's `participants[id].lastSeenSeq` and the handoff brief's "since seq N" sections (`packages/kernel/src/brief.ts:20-125`) say the kernel knows *when you left*. A scrubber turns that into something you can see, drag, and fork from, without adding an inspector or a dashboard. Three Henosis-specific jobs: (1) a late joiner catches up on a 40-hour session in a minute; (2) a reviewer sees the state *at* a contested directive or a quorum vote, not after it; (3) a driver forks from the exact event where the agent went wrong, which the kernel supports but the UI hides.

## Prior art

1. **Figma version history** (https://help.figma.com/hc/en-us/articles/360038006754, accessed 2026-10-02, UNVERIFIED via snippet). A right-sidebar list of versions, newest first, each with name, description, time, and main contributor avatar. Autosaves every 30 minutes and on crash/disconnect, *grouped and collapsed* under one row; named versions are first-class. Restore creates a new version rather than rewriting history.
2. **Chrome DevTools Recorder** (https://developer.chrome.com/docs/devtools/recorder/overview, accessed 2026-10-02, UNVERIFIED via snippet). A recorded user flow is a vertical list of steps; replay highlights the current step, can be slowed, and a blue-dot breakpoint pauses *before* a step so you can continue, step once, or cancel. Code is shown side by side with steps, not instead of them.
3. **Replay.io time-travel DevTools** (https://docs.replay.io/basics/replay-devtools/time-travel-devtools/jump-to-event, accessed 2026-10-02, UNVERIFIED via snippet). A single horizontal timeline for the whole recording; a console log carries a "jump to" that seeks the timeline to that moment; a "pause scrubber" moves line by line while local variables update live. The design cites Bret Victor's *Learnable Programming*: scrubbing is for seeing state change, not for navigation.
4. **LangSmith traces and LangGraph time travel** (https://docs.langchain.com/oss/python/langgraph/use-time-travel, accessed 2026-10-02, UNVERIFIED via snippet). A trace is a run tree with per-run inputs, outputs and latency. Time travel is explicit and conservative: `get_history` lists checkpoints, `update_state` on a past checkpoint *forks* (the original history is kept), then execution resumes from that node's successors.
5. **Claude Code checkpoints and `/rewind`** (https://code.claude.com/docs/en/checkpointing, accessed 2026-10-02, UNVERIFIED via snippet). Every user prompt is a checkpoint; `Esc Esc` opens a picker; three restore modes: conversation only, code only, both. Checkpoints persist across sessions and are kept 30 days. This is the closest shipped product in Henosis's register and the bar for "minimal".

## What to borrow

- **The transcript is the timeline.** Replay.io's "jump to" from a console line and Recorder's step list both treat the existing list as the index into time. Henosis's stream already has one block per event id; the scrubber should map onto those ids, not introduce a second visualisation.
- **Group the noise, name the moments.** Figma collapses autosaves and lets people name versions. Henosis's equivalents are implicit checkpoints (collapse) versus `checkpoint.created` with a label, `branch.created`, `branch.merged`, approval decisions, handoff acceptance and contention resolution (named ticks).
- **Pause before, not after.** Recorder's breakpoint pauses *before* a step. For Henosis, selecting an `agent.tool.requested` event should show the state the approver saw, with the pending approval still pending.
- **Restore forks; history is never rewritten.** LangGraph and Figma both branch on restore. Henosis's `fork` with `fromCheckpoint` already encodes this; the scrubber should expose it as the only "go back and change something" verb.
- **Three restore scopes.** Claude Code's conversation/code/both split maps onto Henosis's log (events) versus workspace tree. Phase 1 can offer only "fork here" (both); the split is a later refinement.
- **Scrubbing is for watching state change.** Dragging should visibly update the things Henosis cares about: who holds the driver seat, open contentions, pending approvals, the composed intent. These are small; they fit the top of the column.

## What is unsolved

- **Multi-human time.** Every prior art has one author's timeline. Henosis's log interleaves four humans and one agent; "where was I" differs per viewer (`lastSeenSeq`), and an epoch can contain concurrent directives whose order is deliberately irrelevant. A linear scrubber must not imply that order mattered.
- **Branch-aware scrubbing.** Replay.io and Recorder are single-track. Henosis branches share prefixes; the scrubber must show the fork point and let you switch track at it without a graph view.
- **Live tail versus pinned past.** Scrubbing back during a running session must detach from autoscroll (the Stream effect on `events.length` in `SessionView.tsx:445-449`) and re-attach cleanly; none of the prior art is live and collaborative at once.
- **Workspace at a seq.** Showing files as of event N needs the tree hash at that seq; checkpoints carry it, arbitrary events do not. Phase 0 can scrub state but only *checkpoint* the workspace.
- **Cost of `fold` on drag.** Folding 50k events per pointer-move is too slow; a prefix-snapshot cache is required.

## Concrete recommendations for Henosis

1. **`seekTo(seq)` in the client, not the kernel.** Add `seekSeq: number | null` to `ClientSnapshot` (`apps/web/src/client.ts`) and a `HenosisClient.seek(seq)` that computes `fold(events.filter(e => e.seq <= seq))` against a cache of prefix snapshots every 256 events (`resumeFrom` from the nearest). `null` means live. The server is untouched; this is pure replay of what the browser already holds.
2. **A hairline scrubber at the top of the 760px column** (`SessionView.tsx`, new `Scrub` component; CSS in `apps/web/src/styles.css`). One 2px `--line` track, a `--highlight` (Apricot) playhead, and small ticks only for named moments: labelled checkpoints, forks, merges, approval decisions, handoffs, contention resolutions. No thumbnails, no minimap. Hidden until the session has more than one turn or the user is not at the live head.
3. **Transcript as index.** Every block gets a `data-seq`; clicking the timestamp on a block seeks there (Replay's "jump to"). Seeking scrolls the stream to that block, dims blocks after it to `--fg-3`, and suspends autoscroll until "Back to now" (a single quiet notice in the Henosis notice style, same component as approvals).
4. **State strip while seeking.** Immediately under the scrubber, one line in `--fg-2`: `Ana driving · goal: … · 1 contention · 2 approvals pending` computed from the seeked `SessionState`. This is the only state shown; the Drawer's details reflect the seeked state too, since it already reads `s`.
5. **Fork here as the only edit verb.** When seeked, the composer is replaced by a single line: *Viewing seq 412 · [Fork from here] [Back to now]*. "Fork from here" sends `{type: "checkpoint", label}` if no checkpoint exists at or before that seq within the same turn, then `{type: "fork", branch, fromCheckpoint}` (both already in `packages/protocol/src/index.ts:322-323`). History is never rewritten.
6. **Per-viewer "you left here" tick.** Render `participants[me].lastSeenSeq` as a small Chocolate Fondant tick with the label *you* on the track, and make the brief's "Since seq N" header a link that seeks there. Pure UI; the kernel already records it (`state.ts:185`).
7. **Epoch bands, not event order.** On the track, render each epoch (between `agent.turn.started` events) as one segment; concurrent directives within an epoch snap to the same tick so the scrubber never implies an order the kernel deliberately ignores. Test the mapping in `apps/web` alongside the existing store-web-smoke, and add a `checkReplay`-style assertion that `seek(seq)` state hash equals `fold(prefix)` in `packages/kernel/test/log.test.ts`.
8. **Mobile and desktop.** The same component collapses on mobile to a single row of ticks under the title; on the Tauri shell (`apps/desktop`) bind `[` and `]` to previous/next named tick and `Esc Esc` to "Back to now", echoing Claude Code's shortcut.

## Sources

- Figma version history: https://help.figma.com/hc/en-us/articles/360038006754 (UNVERIFIED, blocked)
- Figma autosave triggers (forum): https://forum.figma.com/t/what-events-trigger-an-autosave-in-a-files-version-history/78976 (UNVERIFIED)
- Chrome DevTools Recorder overview: https://developer.chrome.com/docs/devtools/recorder/overview (UNVERIFIED, blocked)
- Chrome DevTools Recorder reference: https://developer.chrome.com/docs/devtools/recorder/reference (UNVERIFIED, blocked)
- Replay.io jump to event: https://docs.replay.io/basics/replay-devtools/time-travel-devtools/jump-to-event (UNVERIFIED, blocked)
- Replay.io pause scrubber: https://replayio.notion.site/The-Pause-Scrubber-00e6981b98f8435d8580d9023eb9d895 (UNVERIFIED, blocked)
- LangGraph time travel: https://docs.langchain.com/oss/python/langgraph/use-time-travel (UNVERIFIED, blocked)
- Claude Code checkpointing: https://code.claude.com/docs/en/checkpointing (UNVERIFIED, blocked)
- Henosis repo: `/home/user/tech/packages/kernel/src/replay.ts`, `state.ts`, `brief.ts`; `/home/user/tech/apps/web/src/views/SessionView.tsx`, `client.ts`; `/home/user/tech/docs/05_kernel_design.md`, `docs/12_brand.md`
