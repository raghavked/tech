# Composer · notes

## The idea
One field with two listeners: the Agent/Team segment decides who hears you, and a mono chip next to it always states how the next send will land ("steer · goal", "constrain · tax-lines", "steer · checkout · interrupt") so the popover only ever edits what the chip already says. Everything else the composer needs to tell you lives on one quiet line above the field (the plan waits for ratings, Bo is writing a directive, Dee is writing to the team) or one line below it (Reconnecting, who you are), so the field itself never moves or changes shape. Colour carries the meaning: apricot wash for the team (the pulse, never the hand), amber only for interrupt, a clock in place of the send when the socket is gone.

## What to keep
- The chip as the contract: mono, always visible, rewrites live while the popover is open; the popover's footer repeats it ("Sends as constrain · tax-lines") and on mobile the sheet's Done button repeats it again.
- The Team state: 14% apricot wash on the field, the Team segment filled apricot, an italic serif "to the team" with the people's avatars beside the segment, and a hint that says the words are kept in the log and never sent to the agent.
- Interrupt as the only warn colour in the composer: warn ring on the chip with a bolt, the send turns amber with a bolt and a "Sends now" label, the hint says the step in flight finishes its write first.
- Offline: the field never locks; the send becomes a clock; the queue note carries a count and the queue list speaks in the stream's voice (mode tag, text, time, Remove), with "Reconnecting" pulsing in the hint.
- Plan waiting: a card-line above the field with the Planning pill, Bo's four stars, "yours is missing" and a primary "Rate the plan"; the field stays open for a revision or a rule.
- Presence line: small avatars, plain sans for "writing a directive", italic serif accent for "to the team", three apricot dots; it is the line that keeps two phones from steering the same scope at once.
- The send press: dip to .92 with the shadow gone, then a 6px apricot ring that widens to 16px and fades over 500 ms; calm mode removes the ring, the caret blink and the dots.

## Open questions
- The popover holds mode, scope, interrupt and "show queue"; is "show queue" better as a tap on the queue note itself, leaving the popover about the next send only?
- Should a non-driver see the Agent/Team segment default to Team, or stay on Agent with the chip saying "steer · goal · arbitrated"?
- The scope field suggests goal/api/tests/pdf-layout; where do those come from (the project's claims, the plan's steps, the last ten directives)?
- The amber send for interrupt is louder than any other control in the stream; keep it, or keep the chocolate send and let only the chip carry the warn ring?
- Mobile drops the hint line; the role ("as Cy, contributor") then has no home. Does it belong in the title row's avatar stack instead?
- Screenshots are quantised to 256 colours to meet the size budget, which bands the canvas wash; the board itself (states 02–04) is only in index.html, not in a kept PNG.
