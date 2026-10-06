# Team panel and Details drawer · notes

## The idea
One drawer, two faces: a segmented Team | Details switch sits in the drawer head (mirroring the topbar buttons), so the right edge of the session is always the same 340px surface and a person flips between "who is here" and "what the agent holds" without losing their place. Every section header carries its one-line summary ("2 here · 1 away", "proration · 1 conflict", "25% · about 37.6k left", "since 14:02"), so a drawer with Memory and Catch-up folded still reads as a dashboard, and the thing that needs you (a conflict, a held scope, a handoff) is visible before you expand anything. The Team panel is a room, not a roster: names in serif with the driving flag in chocolate, presence as a green dot on the avatar, "Bo is writing to the team…" in apricot italic, the crewmate as a navy tile that looks exactly like the rail card it came from, and a chat whose input is pinned to the bottom with the one rule stated under it: never sent to the agent.

## What to keep
- The drawer-head segmented switch with the live apricot dot on Team and the count; the topbar buttons stay as the shortcut.
- Section headers with summaries, and the collapsed-by-default Memory and Catch-up with chevrons; the danger colour only on counts (conflicts, over budget).
- People rows: serif name, "you" in small sans, role in grey, driving as a chocolate flag; away rows dim the avatar and name together; the role select only on the rows an owner can change; Hand off only where the driver can hand off.
- The crewmate tile in navy inside the cream drawer, plus the claims list under it (path · who holds it); the "Leave crew" ghost beside "Crewmates share one brief."
- Chat: serif names, "You" in chocolate, timestamps under the line, the "Cy joins" italic divider, the typing line with three apricot dots, the pinned input with the team glow, and the "Kept in the session log. Never sent to the agent." line.
- Details: the Goal chip in italic serif on apricot wash and scope keys in mono; the held-until-a-pick line in warn; the replay strip under the control row; "+3 ahead of main" and Fork on the current branch row; the conflict pill on the file; the Usage block with the big mono number, the four-way split and the per-turn bars.
- States: Solo with Team up, a handoff offered to you (Accept / Decline on apricot), nobody else here and empty memory, over the budget with the brief loader.

## Open questions
- Should the Team panel and Details drawer be one tabbed drawer in the app (one `panel` state with two values) or stay two sibling panels? The design assumes one.
- The Details drawer runs past 900px even with Memory and Catch-up folded; either Branches folds its file list by default or Usage moves above Branches when the budget is nearing.
- The crew section lists crewmates as navy tiles; with four or more crewmates the drawer gets dark fast. Collapse to a stack of names after two?
- Chat in the Team panel and team messages in the stream are the same note; the panel shows the last 30. Should sending from the panel also scroll the stream, or is the panel the quieter place on purpose?
- On mobile the sheet opens at 96px from the top; a half-height first state with the people rows only might be enough for a glance.
