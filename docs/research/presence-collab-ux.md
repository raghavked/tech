# Presence in a shared agent session: what transfers from Figma, Docs and Linear

*Research memo, presence-collab-ux, 2 October 2026. Vendor pages (help.figma.com, liveblocks.io, dourish.com, cs.usask.ca) were blocked by the egress proxy; claims from those are taken from search snippets and marked UNVERIFIED where the page itself was not read.*

## Why it matters for Henosis

Henosis's session is one agent with many humans around it. The kernel already answers the hard
authority question (the driver token, quorum approvals, arbitration), and `docs/05_kernel_design.md`
section 6 fixes the policy: presence is ephemeral, broadcast on change, never logged. What the
product does not yet say is *which* presence facts a watcher needs, and how to show them without
breaking the register of a quiet, one-column conversation.

The cost of getting it wrong is concrete. Two contributors who cannot see that the other is
composing a directive will produce a contention the agent then has to work around. Two drivers
asked for a quorum on an irreversible call will each wait for the other if neither can see that
the other is looking at it. An incoming driver who cannot tell whether the owner is still in the
room will hesitate to take the seat. Presence is the cheap signal that prevents the expensive
event.

Today `PresenceEntry` carries actor, role, branch, a free-text `status` and `online`; the web
session header draws up to four avatars with a driver ring and a "+N". That is Linear's model,
which is right for an issue page but thin for a live session.

## Prior art

1. **Dourish and Bellotti, "Awareness and Coordination in Shared Workspaces", CSCW 1992.**
   https://www.dourish.com/publications/1992/cscw92-awareness.pdf (accessed 2026-10-02, via
   https://acawiki.org/Awareness_and_coordination_in_shared_workspaces snippet; PDF UNVERIFIED).
   Awareness is "understanding of the activities of others, which provides a context for your own
   activity". The ShrEdit study found that awareness exploited *passively* through the shared
   workspace let people move between close and loose collaboration and coordinate dynamically,
   where explicit informational mechanisms and role-restrictive ones (locks, roles) did not.
   Henosis is deliberately role-restrictive at the authority layer; the paper's lesson is that the
   presence layer must supply the passive awareness that roles alone remove.

2. **Gutwin and Greenberg, "A Framework of Awareness for Small Groups in Shared-Workspace
   Groupware", 1999 TR.** https://www.cs.usask.ca/faculty/gutwin/1999/WA-theory/Theory-submitted-TR.html
   (accessed 2026-10-02; blocked, UNVERIFIED beyond the abstract). Workspace awareness is the
   "up-to-the-moment understanding of another person's interaction with a shared workspace",
   organised as who (presence, identity, authorship), what (action, intention), where (location,
   gaze, view). The framework names the trade-off every presence feature pays: awareness
   information against distraction and display space.

3. **Figma: spotlight, follow and multiplayer cursors.**
   https://help.figma.com/hc/en-us/articles/360040322673-Present-to-collaborators-using-spotlight
   (accessed 2026-10-02, snippet). Spotlight shares one person's canvas view; others follow and see
   zoom and page changes but nothing from the toolbar or sidebars. Clicking an avatar follows that
   person; "Ask to spotlight" is a request the presenter accepts or rejects. Figma does not tell
   someone they are being followed. The forum thread
   https://forum.figma.com/t/make-show-multiplayer-cursors-setting-sticky-across-sessions/20614
   shows that cursors are the first thing people turn off.

4. **Google Docs live presence pattern.** https://aiuxplayground.com/pattern/live-presence
   (accessed 2026-10-02). Avatars, per-person cursor colour, "typing" or "reviewing" states and
   optional focus indicators, so collaborators do not step on each other's edits. The value is
   positional: seeing *where* someone edits lets you choose a different part.

5. **Linear-style ticket presence (Thena docs as the clearest written spec).**
   https://docs.thena.ai/guides/ticketing/live-presence (accessed 2026-10-02). A row of avatars
   for everyone who has the item open; appear and disappear instantly; hover for the name; more
   than three collapse into "+N"; a small indicator when the connection drops and presence may be
   stale. Linear's own page was not reachable (UNVERIFIED that Linear matches this exactly).

6. **Liveblocks presence.** https://liveblocks.io/docs/products/sync/presence (accessed
   2026-10-02, snippet). Presence is temporary per-user state kept apart from persisted storage,
   for avatars, cursors, selections and typing indicators. Guidance from the related write-up
   https://www.saasui.design/blog/saas-avatar-user-presence-ux-patterns: debounce so nothing
   flashes per keystroke, fade idle cues, name the typer rather than an anonymous ellipsis, keep
   one colour per person across cursor, selection and avatar, and let presence answer "am I alone
   or with others?" without competing for attention.

7. **Typing-indicator service design.**
   https://www.techinterview.org/post/3233471606/lld-typing-indicators/ (accessed 2026-10-02,
   snippet). First keystroke emits start; later keystrokes reset a 3 s idle timer without new
   events; stop after 3 s idle; server TTL 5 s so a dropped client clears itself. Slack's copy:
   "Jane is typing", "Jane and John are typing", "Several people are typing". Microsoft Teams turns
   typing indicators off in group chats above 20 people.

## What to borrow

- **Presence is a separate channel, never the log** (Liveblocks, and Henosis's own rule). Keep
  `PresenceEntry` on the websocket; joins, leaves and role changes stay events.
- **Passive over explicit** (Dourish and Bellotti). The watcher should learn who is composing by
  looking at the composer region, not by anyone announcing it.
- **The Linear avatar row is the right amount of "who"**: at most four faces, "+N", name on hover,
  a stale marker when the socket drops.
- **Spotlight's asymmetry**: one person's view can be followed, following is silent, and only the
  canvas is shared. For Henosis the "canvas" is the stream position: following the agent (auto-scroll
  to the live turn) versus reading history.
- **Debounce and TTL numbers** from the typing-indicator design: 3 s idle, 5 s server TTL, name the
  person, aggregate above two.

## What does not transfer

Cursors. There is no spatial canvas in a 760 px column; "where" collapses to *which branch* and
*which turn is being read*. Per-person colours also do not transfer: Henosis has one accent and
identity is carried by the serif name and the apricot driver ring. And an unqualified "typing"
is wrong in Henosis because composing has three targets that mean different things to a watcher: a
message to the agent, a directive (steer or constrain), and a note to the team that never reaches
the model.

## What is unsolved

- **Composing in a long turn.** A human may compose for minutes while the agent runs; a 5 s TTL
  model built for chat produces flicker. Presence needs a "composing" state with a longer
  horizon and an idle fade, not a typing pulse.
- **Content leakage.** Showing "Bo is composing a constraint" is enough to prevent a collision;
  showing the text invites pre-emptive argument. Figma's silent follow and the forum demand to
  turn cursors off argue for scope without content.
- **Quorum bystanders.** Two drivers each waiting for the other on an irreversible approval is a
  presence problem no editor has, because editors have no quorum. "Dee is looking at this" on the
  approval notice is a hypothesis, not evidence.
- **Reading history is private-ish.** Docs shows where you are; Figma lets you hide. Whether
  "Ana is reading turn 12" should be visible to everyone, to the driver only, or on hover only, is
  a team-norm question, not a design one.
- **Off-surface participants.** Slack-side humans and a mobile watcher on a flaky socket have
  no honest "online". The stale indicator covers the socket; it does not cover a Slack thread.

## Concrete recommendations for Henosis

1. **Replace free-text `status` with a typed activity.** In `packages/protocol/src/index.ts`,
   extend `PresenceEntry` with `activity: "watching" | "reading" | "composing" | "deciding" | "away"`,
   `composing?: "agent" | "directive" | "team"`, `readingSeq?: number` and `approvalId?: string`.
   Keep `status` for one release, then drop it. The client `presence` message gains the same
   fields. Nothing is logged.
2. **Debounce and expire on the host.** In `packages/server/src/host.ts`, accept `composing`
   on first keystroke, ignore repeats, clear after 20 s without a refresh (not 5 s: a directive
   takes longer than a chat line), and mark a client `away` after 5 min without focus. Broadcast
   on change only; coalesce bursts within 250 ms.
3. **One quiet line above the composer, Slack's templates, Henosis's nouns.** In
   `apps/web/src/views/SessionView.tsx`, render at most one line in `--fg-3`: "Bo is writing to
   the agent", "Bo is writing a directive", "Bo and Dee are writing", "Several people are writing".
   A directive in progress gets the apricot folded corner; a team note gets nothing. No ellipsis
   animation.
4. **Keep the avatar row, add the three states it lacks.** In `apps/web/src/ui.tsx` `Avatar`:
   driver ring as today; `away` at 50 % opacity; `reading` shows "reading turn 12" in the hover
   title only; a hairline "presence may be stale" note in the header when the socket is
   reconnecting. Four faces then "+N" stays.
5. **Presence on the approval notice.** When a pending approval's `approvalId` appears in any
   entry's `deciding`, the approval line in `SessionView.tsx` gains "Dee is looking" after the
   quorum count ("1 of 2 · Dee is looking"). This is the one place presence should change what a
   person does.
6. **Follow the agent, silently.** A watcher scrolled back is `reading`; a watcher at the bottom is
   `watching`. The "jump to live" affordance already implied by auto-scroll is the Henosis equivalent
   of following a spotlight; nobody is notified when someone scrolls back. Document the state
   machine and the no-content rule in `docs/05_kernel_design.md` section 6.
7. **Desktop first.** In `apps/desktop/src-tauri`, feed window focus and blur into the `away`
   timer so a minimised desktop app does not read as a present watcher; on mobile, default to
   `reading` while the app is backgrounded and never send `composing` from the on-the-go surface.

## Sources

- https://www.dourish.com/publications/1992/cscw92-awareness.pdf (accessed 2026-10-02, UNVERIFIED)
- https://acawiki.org/Awareness_and_coordination_in_shared_workspaces (accessed 2026-10-02, snippet)
- https://www.cs.usask.ca/faculty/gutwin/1999/WA-theory/Theory-submitted-TR.html (accessed 2026-10-02, UNVERIFIED)
- https://help.figma.com/hc/en-us/articles/360040322673-Present-to-collaborators-using-spotlight (accessed 2026-10-02, snippet)
- https://forum.figma.com/t/make-show-multiplayer-cursors-setting-sticky-across-sessions/20614 (accessed 2026-10-02, snippet)
- https://aiuxplayground.com/pattern/live-presence (accessed 2026-10-02)
- https://docs.thena.ai/guides/ticketing/live-presence (accessed 2026-10-02)
- https://liveblocks.io/docs/products/sync/presence (accessed 2026-10-02, snippet)
- https://www.saasui.design/blog/saas-avatar-user-presence-ux-patterns (accessed 2026-10-02, snippet)
- https://www.techinterview.org/post/3233471606/lld-typing-indicators/ (accessed 2026-10-02, snippet)
- https://github.com/anthropics/claude-code/issues/60082 (accessed 2026-10-02; shows the unmet demand for multi-human agent sessions)
