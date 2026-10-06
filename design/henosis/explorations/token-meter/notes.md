# Token meter · notes

## The idea
Spend is one quiet mono number in the title row ("12.4k tokens · 62%") with a 3px hairline under it, and the same number grows into a ledger as you ask for more: hover opens a 264px breakdown with a stacked bar of the four kinds the log records (input navy, output chocolate, cache read apricot, cache write hatched) and the budget line in words, and the Details drawer's Usage section repeats it at full size with the last turns newest first, each turn carrying its own stacked bar on one shared scale. Colour is reserved for the budget turning: apricot weaves while a turn is spending, amber from 80% (a tick on every track says where that is), red past 100% with the percent carrying the overflow, and nothing ever stops. Cache reads and writes are shown beside the bar but never inside it, so a session that leans on the cache does not look expensive.

## What to keep
- The chip grammar: `12.4k tokens` + faint percent, hairline under it, the 80% tick, states `.none / plain / .live / .warn / .over`; the small turning ring is the only sign that a turn is spending right now.
- The breakdown's fixed shape (head, stacked bar, four rows in a fixed order including zeros, rule, budget row, one line of consequence, foot) so the eye lands in the same place in every session; "saved ~4.4k" beside cache read.
- The budget counts input + output only; cache figures never move the bar. The soft-budget sentence ("nothing stops at 100%") appears once under the bar and once in the plan card foot.
- The drawer's Usage section: serif big number, percent in the bar's tone, the owner's action at the end of the consequence line (Edit budget / Raise budget), legend in two columns, per-turn rows with a sub-line saying what the turn was (plan step, who joined, who steered), heavy turns in medium weight.
- Per-turn echoes elsewhere: the agent message foot ("this turn 2.1k · 1.5k in · 0.4k out · 0.2k cache"), used-vs-estimate columns on plan rows with green under / amber over, and the 2px hair under the rail card's number.
- Mobile: the chip shrinks to the number plus hair; the breakdown is a bottom sheet with the same Usage block.

## Open questions
- Should the chip's percent live in the title row at all, or only in the hairline and the popover? It costs 36px in a row that is already tight when the drawer is open.
- Cache read "saved ~4.4k" assumes a cache-read price of roughly a tenth of input; the spec records tokens, not money. Is a savings note welcome, or does it invite billing questions phase 0 does not answer?
- The per-turn bars are scaled to the heaviest turn in the visible list; when the list pages to 12 turns the scale may jump. Scale to the session's heaviest turn instead?
- Green-once for a finished branch under budget (handoff brief, replay) adds a fourth tone; worth it, or keep the meter to apricot / amber / red?
- Where does "Edit budget" go for contributors who cannot change policy: hidden, or shown disabled with "ask Ana"?
