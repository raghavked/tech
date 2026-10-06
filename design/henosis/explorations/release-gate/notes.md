# Release gate · notes

## The idea
The release gate is a ledger, not a prompt: the notice names the irreversible call and the rule in one line, then shows every voice the team has given (a rated approve with its stars and note, a deny in red, a viewer's approve marked "a voice, not a vote", and the people it still waits on as dashed rows), with a tally beside them (count of raters against the minimum, the average, two segments that fill as ratings land, and one sentence saying exactly what grants it next). Your own row ends the ledger and flows straight into your stars and note, so the primary button reads "Approve with 4" and Approve without a pick sends 4, as the kernel does. When the gate is granted the same card turns green at its edge, the check draws itself in a ring, the voices collapse into chips with their stars and the commit, and the card folds into a divider a moment later; the Details drawer keeps every gate of the session with its outcome and the policy that produced it.

## What to keep
- The ask line: "The release gate." in serif, then the call in mono chips, then the risk word as a red pill; the rule under it in plain words ("two contributors rating 4+ on average · the Payments policy").
- Voices as rows: serif name, role and time, the note as an italic quote, stars and "5 of 5" in mono on the right. Deny rows in danger wash; voice-only and waiting rows dashed, so who still has to act is visible without counting.
- The tally: count big in mono, average, segments (one per required rater, the next one outlined), and the consequence sentence "One more rating at 3 or above grants it. Any deny holds it." The threshold is computed from the rule and what has landed, not restated from the policy.
- "Approve with N" on the primary button once a star is picked; the hint "Approve without a pick sends 4"; keyboard legend A, D, 1–5 at the right edge.
- Granted state: green stripe, check ring with the stroke drawing (.draw), rater chips with mini stars, "2 of 2 · 4.5 average" in an outlined pill, the commit and diff size; the elapsed dot turns green.
- The held tool step: a lock icon, "held at the release gate" in bold mono, "waiting" in amber on the right, and the rail card saying "Waits at the release gate".
- Drawer "Gates" tab: the live gate in apricot wash, granted and denied with their raters, plus the policy table with the active row in ink and "Who can vote" with each person's state.
- Mobile: rail and drawer fold away, the ledger stacks (voices, then the tally as a row), stars and note stack, the keyboard legend disappears.

## Open questions
- Cy denied: does a single deny hold an otherwise granted gate until withdrawn, or do denies only count against the average? The tally says "Any deny holds it"; the kernel's fold should decide and the sentence must follow it.
- Should Dee's viewer approve appear at all in the ledger, or only in the drawer, to keep the notice to votes that count?
- Does the granted card stay for a few seconds (as drawn here) before folding into the divider, and does it fold on its own or on scroll?
- The waiting elapsed time ("waiting 3 min"): at what point does it turn amber and ping the inbox of the people who have not rated?
- The note field: should it carry over to the commit message or the deploy record, so the rater's reason outlives the stream?
