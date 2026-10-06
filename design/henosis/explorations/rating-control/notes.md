# Rating control · notes

## The idea
The rating is one control everywhere a vote is taken: five stars in a single tab stop with a serif word under the cursor (Not yet, Risky, Fine, Good, Ship it) that says what the pick does, so nobody has to remember that 3 approves a plan and 4 is where a release gate starts counting. A hairline after the third star marks that gate threshold without a sentence, and the Approve button carries the number it will send ("Approve with 4") so the default is never a surprise. It comes in a full size for the plan card and the gate notice, and a compact size for the approvals queue, the inbox and the command palette, with the same keys (arrows preview, 1 to 5 jump, Enter picks, 0 clears) in all of them.

## What to keep
- The word beside the stars: Instrument Serif italic, coloured by level (danger, warn, ink, ok, ok), lighter set on the navy canvas; it doubles as the accessible name ("4 of 5, Good") and the live-region text.
- Preview is lighter than the pick (apricot fill over apricot-deep), so you can see what you chose while hovering something else; hover never changes the value.
- The gate tick between 3 and 4, shown only under a ratings rule, in both sizes.
- "Approve with 4" on the button plus "4 if you leave it" as the hint; "Rate 4" on a plan; the low-rating nudge ("Say what worries you") that asks for a note at 1 and 2 without blocking the vote.
- The submitted state keeps the stars read-only and adds the drawn check and the quoted note; the viewer state greys the stars and says who can rate and whom to ask.
- Roving tabindex radiogroup, Tab lands on the pick or on 4; Esc drops the preview without leaving.
- Mobile: 38px hit area, the word moves to the label row, a second tap on the pick clears.

## Open questions
- Should clicking the picked star again clear it (as here) or should clearing be only 0 / Backspace? Accidental clears in the queue are the worry.
- The words are opinionated; "Ship it" on a plan (where nothing ships yet) may read oddly. Alternatives for plans: "Go ahead" for 5, "Start" for 3.
- The half star for a 4.5 average is a shape the product has nowhere else; a mono "4.5" next to five plain stars may be enough.
- Does the low-rating nudge belong in the kernel's policy (a note required below 3) or stay a UI prompt?
- The compact queue row now puts the rating on its own line under the title; at 1440 with the full-width queue the right-hand layout from the app may fit again, so the row should switch at a width, not always stack.
- The status colours in tokens.css (ok, warn, danger) are tuned for cream; this page overrides them for the words in dark. Tokens v6 should carry dark variants so pages stop doing this.
