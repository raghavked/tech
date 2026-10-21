# Presence and agents for Henosis

Henosis is one session where a team's people and agents work together. Two crafts feed it: multiplayer presence and the way agent products make an agent watchable. The test for "colleague, not tool": can you see it working, point at it, hand it a note without stopping it, and read its status in the same grammar as everyone else's. Sources read October 2026.

## What the best work does

**Presence answers two questions, cheaply and in colour.** Figma's launch post set the brief, "Who else is here? Where are they working?", and cursors double as gesture, "waving your cursor around to get someone's attention" (https://www.figma.com/blog/multiplayer-editing-in-figma/). Presence is ephemeral: about 30 Hz on the wire, interpolated in `requestAnimationFrame`, never journaled (https://www.figma.com/blog/how-figmas-multiplayer-technology-works/). Following is opt-in: click an avatar and your canvas gets a border in that person's colour and a strip naming who you follow (https://help.figma.com/hc/en-us/articles/360040322673-Present-to-collaborators-using-spotlight). Google Docs encodes attention in the avatar: full colour means looking, half-transparent means the tab is behind; screen readers hear joins, never moves (https://support.google.com/docs/thread/118796085, https://support.google.com/docs/answer/6239410). Four kinds of presence: who is here, where they point, what they will change, what they see (https://completefrontend.com/system-design/learn/presence-and-cursors).

**Agents enter the same presence system with no new UI.** Liveblocks ships cursors on springs, avatar stacks with `+N`, selections as a 2px outline in the holder's colour, typing flags cleared by timeout, and the decisive piece: a server can `setPresence` for an agent with a name, colour and TTL, so it "appears in `useOthers` like any human"; a crashed workflow simply expires (https://liveblocks.io/docs/use-cases/presence). Do not build an agent panel; put the agent in the room.

**Pairing tools make control legible, not exclusive.** Tuple rings the avatar of whoever holds mouse and keyboard, gives each participant one colour for cursor, paint and highlight-click, and fades drawings after two seconds (https://docs.tuple.app/pairing-with-tuple/interacting-with-a-shared-screen). Multi's founding line was "I would have pointed with my finger": cursors shared by default, then one cursor each because "it felt clunky when mouse inputs collided" (https://multi.app/changelog/cursor-sharing, https://multi.app/changelog/multicursor-shared-control). Arc's Live Folders are presence for objects: the PR folder fills itself, clears finished work, and "peeks out" when something new arrives (https://techcrunch.com/2024/04/11/arc-browsers-live-folders-will-auto-update-tabs-for-you/).

**Agents feel like colleagues when they have a desk you can look over and manners you can predict.** Devin's session has Shell, IDE and Browser tabs, a Progress view where every step links to the tool that produced it, and side chats that never interrupt the work (https://docs.devin.ai/work-with-devin/devin-session-tools). In Slack its instructions begin "Silence is your default": an emoji reaction to say it is on it, replies in thread, a video of the fix, a working / blocked / done chip with a stop button (https://devin.ai/blog/devins-slack-etiquette). Cursor lets you queue a note or "steer the active turn at the agent's next tool call", and its dashboard gives each agent a verb phrase (https://cursor.com/docs/agent/overview, https://cursor.com/cloud). Replit's board runs Drafts / Active / Queued / Ready / Done with an icon per state (https://docs.replit.com/features/agent/task-lifecycle). Claude Code folds repeated calls into "Called slack 3 times", names which subagent is asking at a permission prompt, and keeps a five-item checklist in the status area (https://code.claude.com/docs/en/interactive-mode). Perplexity's Model Council shows one synthesis "with each contributing model listed below it", split by agree, disagree, and what only one surfaced (https://www.perplexity.ai/help-center/en/articles/13641704-what-is-model-council). Linear supplies the ethics: disclose it is an agent, give instant unobtrusive feedback, show thinking / waiting / executing / finished, step back when asked, never be the one held accountable (https://linear.app/developers/aig). Slack adds: react first, glanceable status, plan blocks that collapse under the result (https://docs.slack.dev/concepts/agent-design/).

The pattern: same room, same primitives, same courtesy. One presence stream; a worklog that is the conversation; interruption as handoff.

## Ten elements for Henosis

Person = Chocolate Fondant arc, agent = Apricot Illusion arc, both on cream, Dress Blues for shared chrome. Hue and a disclosed label are the only differences between the two kinds of participant.

1. **Arc Pointer.** Remote cursors are the brand arc: one `<path pathLength="1" stroke-dasharray="0.5 0.5">` in `--who`, moved by `transform: translate(calc(var(--x) * 1%), calc(var(--y) * 1%))` on a 100ms `linear()` spring; two pointers on one element rotate to close the ring. Screen: Session, Details. Unity: the logo is two participants meeting.

2. **Step Bubble.** An agent's current step rides its pointer like cursor chat: `max-inline-size: 52ch`, `animation: fade 300ms 5s forwards` after each update, never logged. Screen: Session, Details. Unity: a person's typed aside uses the identical bubble.

3. **Hold Outline.** Whatever someone is editing takes `outline: 2px solid var(--who); outline-offset: 2px` plus a `::after` name tab. Screen: Plan card, Memory, Details. Unity: a held field looks the same whoever holds it.

4. **One Stack, Two Inks.** A single avatar stack, `margin-inline-start: -8px; border: 2px solid var(--canvas)`; agents are the mark, not a robot; `opacity: .5` when the tab is behind, `animation: expire var(--ttl) linear forwards` so a lapsed heartbeat dims before it leaves. Screen: Session header, Team panel. Unity: nobody is in a separate list.

5. **Follow Band.** Click any avatar to follow; the pane gets `box-shadow: inset 0 0 0 2px var(--who)` and a `position: sticky; top: 0` strip in Dress Blues reads "Following Cy's agent · Esc to stop". Screen: Session, Desktop panes. Unity: following a colleague or an agent is one gesture.

6. **One Column.** Messages and tool-call cards share one stream and one card, differing by `border-inline-start: 3px solid var(--who)`; repeated calls fold into a `<details>` summary ("Ran 4 commands") that closes when the next message lands. Screen: Session. Unity: the worklog is the conversation.

7. **Steer Line.** The composer placeholder names who hears it and when, "reaches Cy's agent at its next step"; queued notes stack above the input via `translate: 0 var(--travel)` with Send now. Screen: Session composer, Mobile. Unity: you do not stop a colleague, you tell them.

8. **Fade Paint.** Anyone can draw on the preview: `<path pathLength="1">` animates `stroke-dashoffset` 1 to 0, holds, fades over 2s; an agent pointing at "this button" uses the same stroke in apricot. Screen: Details preview, Release gate. Unity: pointing is the same act for both.

9. **Agreement Ring.** Where several participants weigh in, each summary line carries a 12px ring: `stroke-dasharray="1 0"` closed where they agree, `"0.42 0.08"` open where they differ, contributors named beneath in `--ink-muted`. Screen: Approvals, Council room. Unity: consensus is the brand's closed shape.

10. **Same Byline.** Every finished turn ends in one grammar, `font-variant-numeric: tabular-nums; color: var(--ink-muted)`: "Mira · 3 edits · 2m 10s", "Cy's agent · 11 tool uses · 1m 06s"; a running turn's dot is `@keyframes pulse`, easing toward the warning ink as updates stall. Screen: Session, Inbox, Manager overview. Unity: effort is measured the same way for everyone.

Across all ten: joins and holds announced in a polite live region, batched; cursor motion never announced; `prefers-reduced-motion` swaps springs for a dissolve; every arc carries a text name.
