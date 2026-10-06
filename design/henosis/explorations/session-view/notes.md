# Session view · notes

## The idea
The session is a room, not a log: the navy rail holds the fleet (crews first, then solos, each card saying what the agent is on, who it is with and what it has spent), and the cream column holds one conversation where people, the agent and the team all speak in the same voice but in distinct shapes. Named things are serif (the title, Ana, Bo, the crew "Invoice rollout", "to the team"), read things are sans, and tool lines and numbers are mono, so a newcomer can tell who is talking and what it cost at a glance. The stream opens at the latest moment, with the pending release gate sitting directly above the composer, so the thing that needs you is always the last thing before your cursor.

## What to keep
- The three message shapes: a human goal in a white bubble with a `goal` scope chip and an italic serif "Goal" label; the agent's words as plain prose with a grid of tool steps under them (icon, mono line, result on the right, an expandable navy output block); a team message on apricot wash with "to the team" in italic serif, never reaching the agent.
- The plan card as a ledger: step rows with used tokens beside the estimate, a totals line against the budget bar, and the raters as chips with their stars plus "by the team's ratings" in green, so the approval reads as a team act.
- The approval under a release gate: the irreversible chip, Bo's vote with his note, your stars with the "4 if you leave it" default baked into the button label ("Approve with 4"), the 1-of-2 progress with the two gate segments.
- The title row: serif title, status with turn, the Team pill "Team · with Bo", a mono token chip with a hairline budget under it, presence avatars with the driver ringed in apricot, Team button lit when the panel is open.
- The rail's "me" row with role and driving state, and inbox/approvals counts in apricot as the only live colour in the rail.
- Mobile: rail folds into a menu button; title row wraps once; plan rows drop the estimate column; the approval stacks stars, note and progress.

## Open questions
- Should the stream scroll to the latest (as here) or to the first unseen item for someone who just joined? The handoff brief may be the better landing.
- The pending step in the plan (step 4) and the release-gate approval are the same thing from two angles; should the approval be rendered inside the plan row rather than as a separate notice?
- The token chip's hover breakdown (in, out, cache) needs a design; so does the budget bar past 80% and 100% inside the title row.
- "Approve with 4" bakes the default rating into the button; is that clearer than the hint text the app uses today, or does it hide that the rating is a choice?
- Team messages carry a time on the right; agent turns carry "turn 7 · step 3 of 4". Do we want both, or one consistent right-hand meta?
