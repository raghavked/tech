# Mobile manager overview · notes

## The idea
On a phone the manager's page keeps its one sentence and puts it where the title goes: in the navy top block, the rail folded flat, so "4 open sessions across 2 projects. 3 things need you." is the first thing read and the needs-you clause is the only apricot above the fold. Below it the sentence unfolds in the order a manager asks on the move: three need-you cards each with one action, then where the week went as tiles two-up with a full-width tokens tile and sparkline, bars in one hue with the value at the tip, plans with stars and estimate against actual, gates with their votes, crews, and people and agents in one roster grid. Rating a gate never leaves the page: Rate opens a sheet with the what, the why, the files, five thumb-sized stars and an Approve that carries the rating in its label, so a manager on a train can be the second voice.

## What to keep
- Top block: sys bar 48, bar 44; menu with the needs-you count as an apricot disc; team name in serif; the range (Today / 7 days / 30 days) as a pill on `--rail-2` driving every number below.
- The sentence in Instrument Serif 23/1.22, counts in white, the needs clause in apricot with a pulsing dot; green (`#9BC88F`, the rail's running colour) when nothing needs you, and the badge leaves the menu.
- Status tags (running, awaiting approval, blocked) 24px on `--rail-2` with the rail's agent-card dot colours. Once scrolled, the sentence folds into the subtitle: `4 open · 3 need you · 212k this week`.
- Need cards: 4px stripe (apricot plan, navy→chocolate gate, red contention), kind in caps with the age in mono, serif sentence that names the thing in italic chocolate, one line of why (the rule), who, the vote dots (1 of 2, dashed for the missing voice) and one button.
- Tiles two-up at 10px; Tokens full width with a 120×44 sparkline in the hand, the last point apricot; each tile's detail line splits the number (in/out, team/solo, approved/revised/waiting, people/agents).
- Bars: label 92px, track 14px on `--surface-2`, value in mono at the right; a 4px apricot tip marks a session running now; a one-line reading under each chart; Project / Person / Agent as a segment in the section head.
- Lists on one surface, rows 11/14: plans with five SVG stars, actual vs estimate with green "under" or amber "+38%", "waits for 2 ratings" as an amber tag; gates with the rule in mono, votes as avatars and a dashed empty one, "1 of 2" / "granted"; gate health as a reading line.
- Rating sheet: 28px corners on the canvas over `--scrim`; five 52px star buttons, chosen ones on the apricot wash and the last with the team glow; "Approve at 4" is the only chocolate, Later is quiet, the fine print says what the rating does and whose name goes on the release.
- Quiet state: the closed ring beside "Nothing waiting." and a sentence that names what the agents are on, so the page is never empty.
- Dark from the tokens alone; the gate stripe and the sparkline keep their hues.

## Open questions
- The sentence in the app today is the live-count sentence; the subtitle here adds the week's tokens. Should that figure join the sentence, or stay in the tiles?
- Rating from the sheet without reading the diff: is a file list with +/− enough for a release gate on a phone, or should the sheet require opening the compare view once before the stars enable?
- "Approve at 4" vs a plain "Approve" with the stars above: does putting the number in the label make the rating feel like a form field rather than a judgement?
- With four or more need-you cards the section becomes a list; the first card should stay as drawn and the rest collapse to one-line rows with a count.
- The Project / Person / Agent segment sits in the section head; on 360px phones it collides with "Tokens by". Move it under the heading, or make it a horizontal scroller?
- Per-person tokens in the roster ("Ana · lead · 71k") may read as a league table on a small screen where nothing else is around them. Keep, or show only in the chart?
- The range pill in the top block is 34px, under the 44px thumb target; grow it, or make the whole sentence a tap target that opens the range?
