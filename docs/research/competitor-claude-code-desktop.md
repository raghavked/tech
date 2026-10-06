# Competitor deep dive: Claude Code on desktop and web, and Claude Cowork (2026)

*Research memo for Henosis, 2 October 2026. All claims below come from Anthropic's own documentation fetched today unless marked UNVERIFIED. The web-search budget for this session was exhausted, so coverage is docs-only; nothing from third-party reviews.*

## Why it matters for Henosis

Claude Code is the closest shipped neighbour to Henosis's shape: a long-running agent you can watch from a browser, a phone or a desktop shell, with cloud sessions that outlive a laptop and a "project" that coordinates many sessions. It also defines the visual register Henosis copies (one column, quiet sidebar). What it does *not* do is make the session a shared object: every surface is built for one account, sharing is a read-only snapshot link, and cross-session coordination is the owner's own sessions talking to each other. That gap is Henosis's thesis, so the memo is as much about what to leave alone as what to borrow.

## Prior art

1. **Claude Code Desktop application** (code.claude.com/docs/en/desktop, accessed 2026-10-02). Three-tab app: Chat, Cowork, Code. In Code, "each conversation is a session: it has its own chat history and project folder". Parallel sessions get git worktrees under `<project-root>/.claude/worktrees/`. Panes: chat, diff, browser, terminal, file editor, iOS simulator. Side chats (`Cmd+;` or `/btw`) read the thread but "don't add anything back to the main conversation" and are not saved. "Work across sessions": Claude can list the owner's other local sessions, read them and message them; a received message shows "as a card labeled with the sending session's title and a link back", is held while the receiver is mid-task, and is checked against the receiver's inbound controls. Archiving any session requires an approval card "in every permission mode, including Auto and Bypass". A **Continue in** menu sends a local session to the cloud: "Desktop pushes your branch, generates a summary of the conversation, and creates a new cloud session with the full context." Dispatch-spawned sessions carry a badge and push a phone notification "when it finishes or needs your approval". Linux is beta.

2. **Claude Code in the cloud** (code.claude.com/docs/en/claude-code-on-the-web, accessed 2026-10-02). Sessions run in isolated VMs, started from browser, phone, desktop, `claude --cloud`, or routines. CLI handoff is one-way: `--teleport` pulls a cloud session down ("the terminal gets its own copy of the session: new work there stays local"); `claude -p "msg" --cloud <id>` queues a message into a running session and exits. Sharing: visibility toggles Private/Team (Team and Enterprise) or Private/Public (Pro and Max); "Recipients see the latest state when they open the link, but their view doesn't update in real time." Repository-access verification gates recipients by GitHub access. Diff view with inline comments sent "with your next message"; Auto-fix watches a PR and pushes fixes, asking "if a reviewer's comment could be interpreted multiple ways". Credentials never enter the VM; a proxy attaches them server-side.

3. **Remote Control** (code.claude.com/docs/en/remote-control, accessed 2026-10-02). A local CLI session exposed to claude.ai/code and the mobile app. "The conversation and the progress of subagents and dynamic workflows stay in sync across all connected devices." One remote session per interactive process; `claude remote-control` server mode serves many, with `--spawn worktree`. Transcript is stored on Anthropic servers while connected; "multiple short-lived credentials, each scoped to a single purpose". Trusted Devices (org toggle, Face ID or passkey re-prompt after 18 hours). Push notifications: "Push when Claude decides" and "Push when actions required". Permission prompts and `AskUserQuestion` stay open until answered; other forwarded dialogs expire in five minutes. Connected devices get a diff pane and model and effort controls.

4. **Projects** (code.claude.com/docs/en/claude-projects, accessed 2026-10-02). Public beta on Pro and Max only, "not available on Team or Enterprise plans yet". One coordinating conversation starts a thread (cloud session) per task; threads "report back to the conversation when it finishes", each on its own branch with its own PR and auto-fix on. An **Overview** pane with a **Waiting on you** tab (threads that "need your reply or approval, or that failed"). Project instructions (16,000 chars) and project memory (`MEMORY.md` index written by Claude) are read by every new thread. A thread can run on the owner's computer via Remote Control, "but not with its memory files loaded". Thread limits saved to memory "are instructions Claude keeps to, not enforced settings".

5. **Claude Code on mobile** (code.claude.com/docs/en/mobile, accessed 2026-10-02). "A client for Claude Code sessions rather than a place where code runs." Cloud sessions offer Accept edits, Plan, Auto; Remote Control offers Manual, Accept edits, Plan; Bypass is never selectable from the phone. Photos are seen directly and saved under `~/.claude/uploads/`.

6. **Claude Cowork** (claude.com/product/cowork, accessed 2026-10-02; marketing page, lightly UNVERIFIED on detail). Desktop shipped, "web and mobile remain in beta". Reads, edits and creates files in chosen folders; scheduled tasks "run unattended"; a side-panel browser; plugins, connectors, skills; "Claude asks before acting". Team features are a Slack connector plus enterprise admin controls over "feature access, control spend, and track Claude Cowork usage". Dispatch (a persistent Cowork conversation that spawns Code sessions) is Pro and Max only.

## What to borrow

- **The Continue-in handoff pattern.** Push branch, generate a conversation summary, open a new session with full context, offer to archive the old one, refuse on a dirty tree. Henosis's computed brief already exists; the UI gesture and the clean-tree precondition are worth copying verbatim.
- **Cross-session message cards.** Attributed card with the sender's title and a back-link, held until the receiver's turn ends, checked against inbound controls, quoted rather than injected. This is exactly how fleet contentions and lead directives should surface in a session.
- **Waiting-on-you as the fleet brief's first tab.** Projects' Overview reduces a fleet to the threads that need a human. Henosis's fleet brief (`packages/fleet/src/brief.ts`) should lead with that list, not with status.
- **Two push toggles.** "When Claude decides" versus "when actions required" is the right granularity for approval and contention notifications.
- **Permission prompts that never expire, other dialogs that do.** Approvals bound to a hash of the call should stay open; model-choice and similar prompts can time out.
- **Server-side credentials.** Credentials attached by a proxy and never entering the sandbox is the baseline a security reviewer will expect of Henosis's runner.
- **Side chats.** A question that reads the session but writes nothing back is a cheap, popular feature and does not disturb the event log if it is never appended.

## What is unsolved (and where Henosis is ahead)

- **Sharing is a snapshot.** Shared cloud sessions are read-only and do not update live; the recipient cannot steer, approve or fork. Remote Control syncs multiple *devices* of one account, not multiple people. Nothing in the docs lets a teammate answer a permission prompt.
- **Coordination is single-owner.** Cross-session messaging sees only the owner's own desktop sessions ("Claude doesn't see cloud sessions, or sessions you started from the terminal"). Projects coordinate one person's threads and are not on Team or Enterprise plans at all.
- **Limits are advisory.** A thread cap in project memory is "not a hard cap". Henosis's claims and quorum are enforced in the kernel.
- **Handoff forks state.** Teleport makes a copy; after it, phone steering stops unless Remote Control is restarted. Henosis's single hash-chained log avoids the two-copies problem.
- **Dirty-tree and same-dir hazards.** Remote Control's default `same-dir` spawn "can conflict if editing the same files"; the docs push this onto the user. Henosis's path claims are the answer.
- **Memory without provenance.** Project memory is files Claude writes; there is no attribution to a person, session or commit, and no conflict handling. Henosis's attributed, conflict-aware memory is unmatched here.
- **Team-plan gaps.** Dispatch and Projects exclude Team and Enterprise; Cowork's team story is a Slack connector and admin spend tracking.

## Concrete recommendations for Henosis

1. **Ship a `Continue in` menu in the desktop shell** (`apps/desktop/src-tauri` command plus `apps/web/src/views`): targets are Web, Desktop, Terminal (`henosis join <session>` from `packages/cli/src/join.ts`). The web and desktop targets open the same live session; the terminal target attaches, not copies, since the log is shared. Precondition: no uncommitted workspace changes, enforced in `packages/kernel/src/workspace.ts`.
2. **Render inbound fleet events as attributed cards** in `apps/web/src/ui.tsx`: lead directive, contention, and cross-session note each show the originating session title and a back-link, and are delivered at a turn boundary (queue them in `packages/fleet/src/propagate.ts`). Match the "held until the current work finishes" behaviour.
3. **Reorder the fleet brief** (`packages/fleet/src/brief.ts`, rendered in `packages/fleet/src/render.ts`) to lead with a *Waiting on you* section: pending approvals needing quorum, unresolved contentions, failed sessions. Status reports come second.
4. **Two notification toggles per user** in `packages/server/src/notify.ts` and `apps/web/src/notify.ts`: "when the agent decides" and "when action is required". Approval and quorum requests always go through the second; suppress pushes while the user is focused on the session (Remote Control's presence rule).
5. **Make approvals non-expiring and other prompts expiring** in `packages/kernel/src/approvals.ts`: approval requests persist in the log until resolved or superseded by a new call hash; informational prompts carry a TTL event.
6. **Add non-logged side chats** as a client-only feature in `apps/web/src/views`: read the session state via `packages/kernel/src/state.ts`, call the model, append nothing. Document in `docs/05_kernel_design.md` that side chats are explicitly outside the chain so `henosis verify` is unaffected.
7. **Position against the sharing gap in `docs/12_brand.md` and the one-pager**: "shared link that updates, with a seat" versus Claude Code's static Team-visibility snapshot; and "enforced claims" versus advisory memory limits. Both are verifiable from Anthropic's own docs and will stay true until they ship live multi-user sessions.

## Sources

- https://code.claude.com/docs/en/desktop (accessed 2026-10-02)
- https://code.claude.com/docs/en/claude-code-on-the-web (accessed 2026-10-02)
- https://code.claude.com/docs/en/remote-control (accessed 2026-10-02)
- https://code.claude.com/docs/en/claude-projects (accessed 2026-10-02)
- https://code.claude.com/docs/en/mobile (accessed 2026-10-02)
- https://claude.com/product/cowork (accessed 2026-10-02; marketing page)
- Not reached: support.claude.com Cowork and Dispatch help articles (404 on the guessed URL; details on Dispatch pairing are UNVERIFIED beyond what the desktop doc states).
