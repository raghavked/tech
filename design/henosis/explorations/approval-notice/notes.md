# Approval notice · notes

## The idea
An ordinary approval (exec, external) is one sentence a person can answer with one press: the agent's name in serif, the verb, the argument in mono, the risk as a pill, then the policy verbatim ("Needs one contributor or above") and what it means for the reader ("You can approve, Bo" / "That is you, Ana" / "Ana decides"). The stars are present but folded to the right as a voice, not a vote: unlit, 16px, "Rate it"; the first pick unfolds the row into the full rating control with the word and the note, and the Approve button shows the number it will carry. When the kernel answers, the card thins to a divider (check that draws itself, name, number, quoted note; denials in danger ink), and in a long stream consecutive grants fold into one line while the pending one takes a compact row and a strip over the composer.

## What to keep
- The three-clause second line: rule · what it means for you · where the agent is. The rule string comes straight from `describeRule`, so the notice and Settings never disagree.
- Reader-dependent buttons: a contributor on an external call gets "Nudge Ana" and "Take the baton" instead of a greyed Approve; a replay keeps the words and loses the buttons.
- Crease colours by class: apricot for exec, apricot-deep for external, the navy→chocolate gradient only for a release gate.
- Folded stars at rest, unfolded on first pick; "Approve · 4" on the button once a star is picked; the low-pick nudge asks for a note at 1 and 2 without blocking.
- Dividers: granted keeps name, rating and note; denied never folds; a gate's line lists every rater and the average.
- The fold line ("6 approved between 10:41 and 11:04 · Bo, Cy · 5 exec, 1 external · Show") and the compact row with `y` / `n` printed.
- The rail-coloured strip above the composer with the latest pending approval; "2 approvals wait" and `g a` for the queue.
- Mobile: full-width buttons at 40px, stars at 28px with a 38px hit area under them, the strip without keys.

## Open questions
- The app today shows stars only under a ratings rule. Carrying an optional rating on exec/external votes needs the kernel to accept `rating` on any vote; is a "voice" worth storing, and where does it surface (agent track record in the manager view)?
- "The first voice decides" is true for `one contributor or above`; for a quorum rule the hint should count ("1 of 2 contributors"). Needs a third hint variant.
- Compact row after the third approval: is a count the right trigger, or should the stream always start compact and grow only on hover/focus?
- Folding hides who answered what; "Show" expands in place, but should the fold also appear in the inbox and the brief?
- `y` / `n` as single-key shortcuts collide with nothing today but should be reserved in the shortcuts sheet before they ship.
- Status colours (ok, warn, danger) are overridden for dark on this page, as on rating-control; tokens v6 should carry dark variants.
- The shot budget forced the light board to 640px wide and the dark shot to the first viewport; the full-size dark board was checked during the work.
