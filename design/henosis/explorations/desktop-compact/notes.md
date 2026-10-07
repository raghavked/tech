# Desktop compact · notes

## The idea
Between 1180 and 720 wide the window gives the rail's width to the column, not the other way round: the rail folds to 72px of icons and avatars (same order, counts at the corner, the card as a hover tooltip), and the stream keeps its full 780 column with the same gutters and type sizes, so the plan card, the release gate and the composer never reflow. The title row drops words before facts (Team and Details become icon buttons, the title truncates first, status, Team pill and token chip stay), and the Details drawer and Team panel ride over the stream as a 300px overlay with a scrim instead of sitting beside it. The page shows the 960×760 window with Bo's tooltip open, and the rules beside it; under 1000px the page is the window itself, so `shot-960.png` is the truth shot.

## What to keep
- The rule: the column's 780 is the fixed thing; the rail and the drawer give way. The app today narrows the sidebar to 220px between 641 and 1024, which leaves a 616 column at 960 and squeezes the plan card and the gate; collapsing to 72 is the better trade.
- The collapsed rail from the rail exploration, unchanged: mark, gradient New, Search, Inbox and Approvals with apricot counts, the project initial in serif apricot, one avatar per agent with the status dot at the corner, the active one ringed, Memory, Chats, you, expand. The hover tooltip is navy (rail-2) with the serif session name, the Team pill, the italic "what it is on", the rating count and the spend in mono.
- Topbar at 888 wide: serif title (truncates first), status with turn, Team pill, token chip with hairline budget, presence stack, Team and Details as 34px icon buttons; the open panel keeps the apricot wash.
- The release-gate notice tightens to one rating row (stars, note field, "1 of 2" progress) and one action row with the gate segments at the right; nothing else in the stream changes.
- Breakpoints: 1180 rail folds, 960 compact (this page), 720 drawer overlays, 480 phone sheet. The ruler on the right is the single place these are written down.

## Open questions
- Should the rail fold at 1180 by itself, or only remember the user's `[` `]` choice? A rail that folds and unfolds as a window is resized can feel jumpy; a hysteresis of 40px or a "fold below" setting may be needed.
- The hover tooltip covers the stream (here it sits over Bo's team message). Should it be delayed, or open to the right only when the pointer rests for 400ms, or should the collapsed rail prefer a click-to-peek card?
- The Details drawer as an overlay loses the "glance at usage while reading" habit; a 56px vertical strip of the drawer's counters (tokens, branches, open items) at the right edge could stay visible in compact mode.
- At 720 the topbar runs out of room for the Team pill and the token chip together; one of them probably moves into the title's tooltip. Which one goes first?
- The pins and spec on the right are a board convention; should every desktop exploration carry the same ruler so breakpoints are stated once per screen?
