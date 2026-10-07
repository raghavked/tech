# Widgets · notes

## The idea
A widget answers one of the three questions a glance should settle without opening the app: what waits for me (Needs you), who is running (Agents), and what today has cost (Tokens today); the medium and large sizes answer two or three in the order of the manager's view. Every row is a `henosis://p/<project>/s/<session>#<notice>` deep link, and the Approve button on a widget row is the same vote as in the session, so a gate row sends the default 4 and an exec row sends a plain approve. The menu-bar item on macOS is the ring and two numbers (decisions, running), and its panel is the desktop tray's menu made rich: buttons on the approval rows, dots that live, the token meter, Inbox, Pause notifications, Open Henosis.

## What to keep
- The widget head: the ring (chocolate and navy on cream, chocolate and apricot on a dark surface, apricot centre), an uppercase label, the count in an apricot pill at the right; a quiet grey pill when the count is zero, the moon in its place when notifications are paused.
- Needs you rows in the same grammar as the toast and the inbox: who's agent · session in Instrument Serif, "wants to" and the call in mono, Gate with its quorum segments (filled, then the outlined next one), Approve · 4 in chocolate and a quiet round Deny.
- Small Agents: the count in serif ("3 running"), then one line per agent with a status dot, the name in serif and the session; the waiting one in amber at the end. Medium adds what it is on in italic serif chocolate, the spend at the end of the line, and the crew line.
- Small Tokens: the number in mono, "of 200k · 57.4k left", the apricot meter, two bars by person. Medium puts the meter left and the sessions right, with the plan estimate as the last line. Over budget turns the number and the meter red and says "nothing stops".
- States in one family: empty (the closed ring, "Nothing waits for you.", the last decision time), paused (moon), just granted (green check, "Your 4 granted it", the row stays a minute), stale (hollow dots, "As of 9:26 · reconnecting", never a guess).
- Lock screen: the inline line "2 approvals · 3 running · 142.6k" above the clock, the rectangle with the oldest decision and "your 4 grants it" in apricot, the circular budget ring; all monochrome but the apricot pulse.
- The large widget keeps the manager's order: needs you, running, spent, with "12.1k saved against plan" on the token line.
- Counts: Needs you counts decisions I can still make (approvals plus handoffs); the app badge, the lock-screen line and the menu-bar number are the same count; mentions never badge a widget.
- Inline SVG symbols must carry their own presentation attributes (fill, stroke-width, linecap); page CSS cannot reach inside a `<use>` shadow tree, which is why the first pass rendered the ring as a disc.

## Open questions
- WidgetKit refreshes on a timeline, not on push, unless the app asks for a reload from a background notification; is "Needs you on push" honest, or should the small widget say "as of 9:40" always?
- Approve from a widget is an App Intent that runs without opening the app; on a gate that needs a note (a 3 is a voice, not a vote) should the button open the sheet instead, or always send 4 and let the note come later?
- The medium Tokens widget shows the project's budget while the small one shows mine; is the switch a configuration option per widget, or do we always show the project a person last opened?
- The menu-bar panel duplicates the desktop tray's native menu; one or the other, or the native menu on Windows and the panel on macOS where a popover under the item is the idiom?
- Should the lock-screen rectangle rotate through the decisions when there are two, or always name the oldest?
- `/api/notifications?unread=1` gives counts and rows; the Agents and Tokens widgets need a small `/api/glance` that returns the three answers in one call for the widget extension's timeline.
