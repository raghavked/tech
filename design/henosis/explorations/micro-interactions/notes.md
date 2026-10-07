# micro-interactions · Micro-interactions catalogue

## The idea
One sheet catalogues the six small answers a Henosis surface gives a hand (hover, press, focus, toggle, select, drag) as live demos beside their frozen states and a three-line spec (property, clock, Calm), all set in the Payments team's own session: Bo's agent on the invoice PDF, Ana steering the proration, Cy and Dee rating the plan. The rules are decided once at the top: three clocks (120 hover/focus, 200 press/toggle, 320 arrive/settle), two curves (plain ease for colour and shadow, the mark's .3,.9,.3,1 for anything that moves), and colour as state (hover is surface-2 and shadow, focus is the team glow, selection and the live thing are apricot, the hand only on the primary action and the drawn check). An index at the end lists every interaction with its trigger, property, clock and what Calm shows instead, so the app's useMotion and the tokens can be checked against one list.

## Keep
- One focus ring for everything: the team glow on a field, a button, a star, a switch, a chip, a list row and the whole composer (focus-within), so the keyboard always knows where it is and leads can recolour it in the Team look editor.
- Press is a sink, release is the meaning: send scale .92 then the message rises; Approve draws its check on a 40-unit dash; a star fills then pops with 1.12 overshoot; a chip sinks by scale only because it has no shadow to lose.
- The Agent / Team toggle tints the composer: thumb slides on the mark's curve while the placeholder and border crossfade, so a team message is apricot before it is sent. Solo → Team is a pill crossfade plus one avatar pop and ripple; leaving has no motion.
- Selection is apricot with a hairline: wash at 30 % plus inset 1 px apricot-deep (chip) or a 3 px edge (row, option). Pointer hover (surface-2) and keyboard selection (apricot) can show at once and never fight.
- Drag lifts: ×1.02 to ×1.25, shadow-pop, the team glow while held, no easing while following the pointer, 320 ms settle; the gap it will land in is a dashed apricot slot.
- Calm and reduced motion keep every end state (glow, apricot row, slid thumb, drawn check, 60 % row actions, both token values) and only make the change instant; touch has no hover, so the press is the hover and a long press is a 400 ms conic ring.
- Live demos use CSS :has for toggles, chips and checkboxes and one small inline script (no external scripts) for send, approve, stars, multi-select, scrubber, reorder, slider and divider.

## Open questions
- Hover on tool lines shows actions at 60 % always under Calm; should Calm also apply on touch, where a row has no hover at all? Mobile may need the actions behind the long-press sheet only.
- The long-press ring is 400 ms linear, which does not match the three clocks; it is a platform expectation rather than a Henosis motion. Keep it off the index of keyframes, or give it a clock of its own?
- The multi-select bar wording ("2 selected · both low", "one needs two") is written in the team's voice; the approvals queue exploration should own that copy and this sheet should quote it.
- The reorder demo uses position: fixed for the lifted item, which breaks inside a scrolling drawer; the app should use a transform-based lift with the list as the scroll container.
- Size budget: the 1440-wide full board is 7.2k px tall and even at half scale and 48 colours is 260 KB on its own, so the folder keeps only the three viewport shots (light and dark at 48 colours, mobile at 32) and no shot-board.png; the whole folder is 260 KB. If reviewers want the board, the budget should exclude screenshots.
- The index duplicates the motion-spec sheet for the hover/press/focus transitions; one of them should become the source and the other a pointer.
