# Session timeline · notes

## The idea
A week-long session on one line: seven day columns across the top of the session, a single hairline carrying every turn as a tick, every approval as a diamond, every handoff as a ringed arrow, the plans as bracketed spans above it and the baton (who drove, for how long) as a band beneath it, with a fork drawn as a dashed curve that leaves the line and comes home at the unite mark. The weekend pause is a dashed gap in the line itself, today's column carries a warm wash and a pulsing "now", and one mark is in focus with a tip under the band ("United tax-lines into main · Mon 09:40 · turn 33 · Cy"). Below the line the chosen day opens as a ledger, time in mono on the left, every event with its who and what and the tokens it took, and the right panel reads the week back in one sentence, counts it, shows tokens by day and the baton by person, and carries the one thing that needs you (the release gate waiting for a second rating).

## What to keep
- One line, not lanes: turns, approvals, handoffs, the pause and the unite all sit on the same hairline; the plans float above as spans, the baton sits below as a band. Nothing needs a lane legend to read.
- The branch as a curve that leaves and returns: a fork dot, a dashed ok-green path dipping under the line with "tax-lines · Cy · 14 files", and the unite mark where it rejoins. This is the mark for "united into main".
- Plan spans reuse the plan card's step chip states (green check done, apricot-ringed running) and show "n of m", the ratings, and actual against estimate; the running span is washed apricot to the step it is on.
- The baton band: pills per driver with avatar, serif name and hours; the live driver's pill carries the apricot ring. Bo's pill says "94h · paused 47h" so the weekend does not count as driving.
- The day ledger: 52px mono time column, 26px round icon with the same colours as the line (ok green diamond, apricot handoff, apricot team message), the picked event on the apricot wash with its files as mono chips and a Compare action.
- The week panel: a serif sentence first, then the gate card with the stars and "Approve · 4", then counts, tokens by day with today on the live gradient, and the baton by person.
- Mobile: the same seven columns at 390px with titles dropped from the plan spans, initials only in the baton, the tip hidden, and the ledger stacked under the line.

## Open questions
- Dense days overlap: Monday's unite, approval and handoff sit 1–2% apart; at 1440px they clear each other with the canvas halo, at 1100px they touch. Should marks within a few px cluster into one "3 events" badge that expands on hover?
- Where should the focused tip live when the mark is in the first or last column: it is right-aligned to the mark here, so a mark in Wednesday needs a left-aligned variant.
- Clicking a day opens its ledger; should clicking a mark on the line also scroll the Stream tab to that turn, or open the replay scrubber at it?
- The baton band counts the paused weekend inside Bo's segment; should a pause split the band (Bo · paused · Bo) so hours read honestly without the "paused 47h" note?
- Longer than a week: does the line keep seven columns and page by week, or compress to a month with the day columns becoming weeks and turn ticks becoming a density strip?
