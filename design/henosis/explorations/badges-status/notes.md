# Badges and status words

## Idea
Five things, and only five, get to be a badge: the status word (Running, Awaiting approval, Blocked, Paused, Idle, straight from `copy.ts`), the pending count, the Solo and Team pills, the Planning pill, and the crew name. Each has one drawing scaled to four sizes (dot 6/8/10/12, count 16/18/20/24, pill 18/22/26, crew ring 7/9/12) and is shown on cream and on navy, so a rail card, a top row, a fleet row, an inbox line and a mobile row can all be read with the same eye. Colour is divided by meaning: green, amber and coral live only in the dot, solid apricot means only "this many things wait for you", apricot on chocolate means Team, apricot-soft means the plan waits, and the hollow apricot ring is a crew, the mark's ring with nothing in it yet.

## Keep
- The five words with no synonyms, and the word never coloured: the dot carries the state, the text stays ink (rail-fg or rail-muted on navy).
- The dot drawings survive without colour: filled, filled with halo (awaiting), hollow (idle), hollow and faint (closed), hollow with a bar (cancelled), dashed (offline). Only Running moves.
- The pending count: mono on solid apricot, navy ink in both themes (apricot-deep on cream so it does not melt into the page), absent at zero, pops on change, caps at 99+, sits off the mark's disc in the tray because the disc already has an apricot dot.
- Counts only count things you can act on (approvals, handoffs, unread chat); tokens, steps and people are text, never badges.
- Solo is an outline, Team is apricot with an optional avatar stack, Planning is apricot-soft with a slow apricot dot; a session wears one of Solo/Team and may add Planning. The Team pill crossfades over 240 ms when someone joins; the avatar ripples once.
- Crew names in Instrument Serif behind the hollow ring, three sizes; solos get a dashed ring and no name and follow the crews, never sit inside one.
- The status pill (tinted ground) exists only for fleet rows, inbox and Slack cards; in the rail and the top row the dot plus word is enough.

## Open
- In dark the token status colours (`--ok` #4F7D4A, `--warn`, `--danger`) sit at under 2:1 on the dark surface; this page lifts them one step (#7FB376, #D9A35A, #D9766A). Should tokens.css carry those dark tints?
- "Awaiting" alone is allowed at 390 wide: should the mobile row keep the full "Awaiting approval" on two lines instead, since the word is the contract?
- The count is apricot-deep on cream and apricot on navy; is one fill (apricot-deep everywhere) worth the slight loss on the rail for the sake of one rule?
- Cancelled, Closed and Offline: do they belong in the rail at all after an hour, or only in the project page and replay?
- Should the Planning pill carry the rating progress ("1 of 2") in the top row, or stay a single word and leave the progress to the plan card?
- The whole board is 4000 px tall and a full-page PNG of it is 220 KB even at 24 colours, so the shots are the 1440x900 viewport only; decide whether spec boards should get a larger screenshot budget or be split into two pages.
