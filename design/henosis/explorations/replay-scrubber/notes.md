# Replay scrubber · notes

## The idea
The scrubber is a thin row under the top bar with one dot per turn: the newest dot is now and pulses apricot, the viewed dot is ringed in apricot, and the plan's steps sit on the track as spans over the turns they took, so you can scrub to "step 2" rather than to "turn 5". Dragging folds the session up to that turn in the client, so the stream below shows exactly what the team saw then (the plan at step 2, Bo's team message, the agent's steps), ends at a dashed "The session goes on · 6 more turns to now" edge, and the composer goes read-only with "Nothing is sent while you look back". "Return to now" is the one chocolate action on the row, and the Details drawer carries the pinned switch plus a turn list grouped by plan step, with the viewed turn on apricot wash and everything after it dimmed.

## What to keep
- One dot per turn on a hairline; seen dots filled ink, the viewed dot large and ringed in apricot, dots ahead faint, the release gate drawn as a hollow diamond, and now as a pulsing apricot dot with "NOW" under it. Times under the line only at the start, the viewed turn and now.
- Plan steps as spans above the track with the step chip reusing the plan card's states (green done, apricot-ringed running, hollow later), so the track reads as the plan laid over time.
- The left label in two lines: "Viewing turn 5 of 11" bold, then "09:31 · Ana's agent writes proration.ts" in faint; "Return to now" as a small primary button on the right. Arrow keys and End live in the drawer's Time travel text, not on the row.
- The stream's "edge of the past": a dashed divider with what comes next as quiet chips (turn 6 tests pass, turn 8 Bo steers, turn 10 release gate, turn 11 now), so the past has a visible end and a reason to return.
- The read-only composer: dashed border, surface-2 fill, dimmed bar, "Viewing the past · Return to now to steer the agent" as the hint. Notices keep their words and lose their buttons.
- The drawer's turn list grouped by plan step, mono token figure on each turn, the viewed turn on apricot, later turns at half opacity.
- Mobile: label and button on one row, the track on its own full-width row, step spans keep their number chip and drop the label, no hover tip.

## Open questions
- The row is pinned here; unpinned it appears on hover of the strip under the top bar. Does a 64px track need a thinner "resting" form (dots only, no step spans) when it is merely hovered, growing to this when pinned or viewing?
- Hover tip under the dot covers the stream's first line for a moment; should the tip live inside the left label instead (the label previews the hovered turn, then snaps back)?
- Step spans are placed from `agent.turn.started` to the next step's first turn; a step that spans one turn (PDF, turns 10–11) gets a very short span and its label clips at narrow widths. Number-only chips below ~420px of track?
- Should a scrubbed position be shareable (a link to "Billing page at turn 5") for the handoff brief and for the release gate's reviewer?
- Team messages are kept in the log and so appear while scrubbing; do we also fold the Team panel's chat and the token chip in the top bar to that point, or does only the stream travel in time?
