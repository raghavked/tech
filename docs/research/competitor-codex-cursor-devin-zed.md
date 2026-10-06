# Competitor deep dive: Codex app, Cursor 3 Agents window and Projects, Devin multiplayer, Zed Delta

Research memo, 2026-10-02. Topic: what the four closest desktop agent products ship for multiple humans and multiple sessions, how they behave as desktop apps, and what Henosis should take or avoid. Vendor domains (openai.com, cursor.com, docs.devin.ai, zed.dev, Wikipedia, HN) were egress-blocked; facts verified today come from GitHub only, the rest is from the repo's earlier source list and training knowledge and is marked UNVERIFIED with the best-known date.

## Why it matters for Henosis

All four have converged on the same desktop shape in 2026: a native window whose first-class object is the *agent run*, not the file. Each gives one person many agents (parallel threads on worktrees). None gives many people one agent with arbitration, quorum approvals, fork/merge of the conversation, or a replayable log. Devin proves there is demand for multiplayer; Zed Delta is the only one syncing the conversation itself. Henosis's thesis is the inverse of Codex/Cursor (one human, N agents) and its desktop shell has to feel at least as native as theirs while staying a thin wrapper over the web client.

## Prior art

1. **OpenAI Codex app** (openai.com/index/introducing-the-codex-app, blocked; github.com/openai/codex README and releases, accessed 2026-10-02, verified). macOS app launched early February 2026, Windows followed (spring 2026, UNVERIFIED). The README confirms the desktop app is launched from the same binary (`codex app`). Shipped shape: a left rail of *threads*, each thread optionally on its own git worktree so several agents edit in parallel; *Automations* that run threads on a schedule; *Skills*; an in-app diff review and preview. Release 0.160.0 (1 Oct 2026, verified) mentions an "agent command center" with keyboard-accessible task browsing, workspace defaults outside projects, Guardian review with conversation-history retrieval, and Windows sandbox fixes. The app-server protocol (verified in `docs/research/harness-adapters.md`) has `thread/fork`, `thread/revert`, and server-initiated `requestApproval` with `accepted | acceptedForSession | declined`. Multi-user: shared cloud environments and org Workspace Agents only; a thread has one owner, and there is no concurrent steering.
2. **Cursor 3: Agents window and Projects** (cursor.com/changelog, blocked; snippets via forum.cursor.com, codepick.dev, futurumgroup.com in `docs/10_sources.md` and `docs/research/fleet-scheduling-cost.md`, UNVERIFIED). Cursor 2.0 (29 Oct 2025) made the multi-agent view the default: up to eight agents in parallel, each on a worktree or a remote machine. Cursor 3 (March 2026) split the product into an *Agents window*, a standalone chat-first surface with a quiet sidebar of agent runs and the editor demoted to a secondary pane, and *Projects*: a persistent planning space of Markdown files in a cloud repo that a team shares and that agents read. Cursor 3.2 added `/multitask` subagents. Team Followups let teammates send follow-ups to another user's cloud agent, executing under the creator's integration tokens; their own forum flagged this as bearer-token-shaped. No participant model, no fork of a conversation, no approvals routed to another person.
3. **Devin multiplayer** (docs.devin.ai/collaborate-with-devin, blocked; docs.devin.ai/release-notes/2026 and cognition.com/blog/devin-can-now-manage-devins snippets in `docs/10_sources.md`, UNVERIFIED). Devin 2.0 (3 Apr 2025) shipped parallel Devins, Interactive Planning, Devin Wiki and a $20 Core plan. "Multiplayer Mode": a session has a shareable link, any teammate with it can send messages, and follow-ups are queued server-side and applied at the next turn boundary. Slack and Linear are entry points: a thread or ticket becomes a session, and replies in the thread are relayed. Devin 2.2 (late 2025) added manager Devins that spawn and brief child Devins. There is no desktop app; the surface is web plus Slack. Messages from several people are serialised; there is no authority order, no quorum, no branch.
4. **Zed Delta** (zed.dev/blog/introducing-delta, blocked; github.com/zed-industries/zed docs SUMMARY.md accessed 2026-10-02, verified for the collaboration and agent docs). Zed has shipped CRDT-based multiplayer editing, channels and calls since 2023, the Agent Panel since 2025, and the Agent Client Protocol (Aug 2025, UNVERIFIED) that runs Claude Code, Codex and Gemini CLI as external agents inside the panel. Delta (announced Aug 2026, private beta, UNVERIFIED) extends the CRDT to the *agent conversation plus worktree*: teammates see the same thread live, comment, co-edit the prompt, and pick up the work, with third-party harnesses synced starting with Claude Code. The current docs tree has pages for channels, external agents, tool permissions and agent-server extensions but no Delta page, which supports "private beta". It is editor-bound and single-vendor-desktop (GPUI, no web client).
5. **Codex app-server README** (github.com/openai/codex/blob/main/codex-rs/app-server/README.md, accessed 2026-10-02, verified in an earlier memo). The cleanest published contract for thread, turn, item, approval and fork; the reference for what a desktop agent client expects from its kernel.

## What to borrow

- **Run-first desktop layout.** Codex and Cursor 3 both put a rail of runs on the left and one conversation in the centre; the editor is optional. Henosis's `design/desktop.html` already does this; keep it and resist a file tree.
- **Worktree-per-branch as the default isolation.** Codex and Cursor isolate parallel agents by git worktree. Henosis's fork already snapshots a workspace; mapping a fork to a worktree directory on the desktop makes "open the branch locally" one click.
- **Server-side follow-up queue with turn-boundary application** (Devin). Henosis's arbitration already applies directives at epoch boundaries; the UI should show "queued for next turn" the way Devin does, so a second human does not think their steer was lost.
- **Automations** (Codex). A scheduled run that wakes a session is a natural fleet feature: a lead schedules "nightly triage" and the run reports to the project ledger.
- **Approval modes** (Codex `acceptedForSession`). A per-session "allow this command class for the rest of the session" vote reduces approval fatigue; Henosis can keep it hash-bound by scoping it to a command pattern rather than a free pass.
- **Projects as shared planning files** (Cursor). A project-level planning doc that agents read maps to Henosis's project directives and fleet brief; Henosis's version is attributed and versioned, which Cursor's is not.
- **Thread sync of third-party harnesses** (Zed Delta). Delta's harness adapter list (Claude Code first) is the same order Henosis's `packages/runner` adapters should follow.

## What is unsolved

- Nobody has arbitration: Devin serialises, Cursor executes as the creator, Zed co-edits the prompt without an authority order. Two humans disagreeing mid-turn is unhandled everywhere.
- Approvals are single-approver in all four; none has quorum or an approval bound to the hash of the exact call after rewrite.
- Fork exists for one person (Codex `thread/fork`, Cursor worktrees); merge of two *conversations* with directive carry-over exists nowhere.
- Cross-session awareness in a team (claims, contentions) is absent; Codex/Cursor parallelism hides collisions until the PR.
- Replay and verification: no product offers a hash-chained, replayable record a third party can verify.
- Desktop presence: no product shows *who else is in this run right now* beyond Zed's editor cursors.

## Concrete recommendations for Henosis

1. **Expose fork as a local worktree in the desktop shell.** Add a `henosis.fork.checkout` Tauri command in `apps/desktop/src-tauri/src/main.rs` that materialises a branch's workspace snapshot into `<project>/.fold/worktrees/<branchId>` and returns the path; show "Open folder" on the branch row in `apps/web/src/views`. Matches the Codex/Cursor worktree expectation with Henosis's snapshot semantics.
2. **Queued-steer affordance.** When a directive arrives mid-turn, render a quiet notice "Queued, applies at next turn" under the composer (`apps/web/src/ui.tsx`), driven by the existing epoch boundary in `packages/kernel`; no kernel change.
3. **Scoped session approvals.** Add an `approval.scope` event in `packages/protocol` with a command pattern and a `turns` TTL, voted like any approval (quorum for irreversible classes), consumed in `packages/kernel` before emitting a new approval request. This is Codex's `acceptedForSession` without an unbounded grant.
4. **Automations on the project ledger.** Add `schedule.create` / `schedule.fire` events in `packages/fleet` so a lead can schedule a run that starts a session with a project directive attached; fired runs appear in the fleet brief. Desktop: register the schedule with the OS notification path already researched in `docs/research/desktop-notifications-tray.md`.
5. **Agent command center keyboard parity.** Codex 0.160.0's keyboard-accessible task browsing is the bar; make the sessions rail in `apps/web/src/views` fully navigable with j/k, Enter, and `/` filter, per `docs/research/keyboard-first-ux.md`.
6. **Harness adapter order.** Prioritise Claude Code, then Codex app-server (`thread/fork`, `requestApproval`), in `packages/runner`, mirroring Zed Delta's sync order so Henosis can import a Delta-synced thread later.
7. **Competitive table refresh.** Update `docs/02_competitive_landscape.md` rows for Codex (desktop app, Automations, Guardian) and Cursor (Agents window, Projects) with the dates above and the UNVERIFIED flags until vendor pages can be fetched.

## Sources

- github.com/openai/codex/releases (accessed 2026-10-02, verified: 0.160.0 on 1 Oct 2026)
- github.com/openai/codex README (accessed 2026-10-02, verified: `codex app`)
- github.com/openai/codex/blob/main/codex-rs/app-server/README.md (accessed 2026-10-02, verified)
- github.com/zed-industries/zed/blob/main/docs/src/SUMMARY.md (accessed 2026-10-02, verified)
- openai.com/index/introducing-the-codex-app (blocked, UNVERIFIED)
- cursor.com/changelog; forum.cursor.com/t/cursor-cloud-agent-sessions-are-shared-across-users-act-on-behalf/158866; eesel.ai/blog/cursor-projects-review (blocked or snippet, UNVERIFIED)
- docs.devin.ai/collaborate-with-devin; docs.devin.ai/release-notes/2026; cognition.com/blog/devin-can-now-manage-devins (blocked or snippet, UNVERIFIED)
- zed.dev/blog/introducing-delta (blocked, UNVERIFIED)
