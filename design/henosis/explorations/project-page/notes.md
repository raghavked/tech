# Project page · notes

## The idea
The project page is the fleet board: the lead's direction field sits at the top as a composer with a constrain/steer segment, and every active direction hangs under it as a chip that names its mode in italic serif, its author and its age, ringed in apricot when it is yours so Withdraw is right there. Below it, one white board lists every session under its crew (a hollow apricot ring and the crew's claims in mono), each row carrying the serif title, the owner with who they are with, the agent's one italic line of what it is on, a per-agent token meter with its budget (amber when over), the status, and Team up / Leave crew inline, with the Team up form opening in place and offering the crews that already exist. The right column is the team's own things, which never reach an agent: spend this week by session, the people with who joined today, team chat kept in the ledger, and team memory with a two-entry conflict asking for a Keep.

## What to keep
- The one-sentence summary under the title in the manager's voice ("Four agents on two tasks. One contention waits for you.") with the hot thing in bold and a link to the manager view.
- Direction chips: italic serif mode tag (apricot wash for constrain, plain for steer), author avatar and age, apricot ring plus Withdraw on your own; the hint that it enters every session as `[project]`.
- Crew headers as the rail does them (hollow apricot ring, serif name, "2 agents on one task") plus the crew's claims in mono; the Solo header gets a dashed ring.
- The row grid: status dot · what · usage meter · status · action; the usage meter at the end of the line as the spec asks, with "of 120k", "no budget" and "spent" as the three cases, and a tinted row for one held in a contention.
- Team up inline: the input takes the glow, the primary button stays off until there is a name, and existing crews are one tap away.
- The contention notice reuses the contention-handoff grammar: amber stripe, a serif sentence, the rule line naming who picks, two numbered sides each with the agent's one-line read, and lead-only "Cy wins / Bo wins / Dismiss"; a resolved one folds into a soft grey notice with Replay.
- Memory conflict as an amber block with two Keep buttons; agent-written entries say "Cy's agent" in italic serif so authorship reads at a glance.
- Dark lifts `--ok`, `--warn`, `--danger` at page level (same override as contention-handoff); worth folding into tokens.css.
- Mobile: rail gone, side column stacks under the board, rows fold to three lines, direction chips wrap with the author on their own line.

## Open questions
- Should the per-agent meter show the plan estimate as a tick on the bar (as the token-optimisation exploration does) so "came in under" is visible per row, not only in the spend card?
- Who may Leave crew on another owner's row: the spec says owner or lead; should the button hide or dim for a member, and should leaving ask for confirmation when the crew drops to one?
- Is a closed session still a row on the board (as drawn, greyed with Replay) or does it move under the Brief fold after a day?
- The spend card's budget is per project here; the spec only has per-branch budgets. Does a project budget exist, or should the card show the sum of branch budgets instead?
- Should the direction composer also accept a scope ("checkout/*") inline, since the server takes `scope` with every directive, or is "goal" scope enough on this page?
