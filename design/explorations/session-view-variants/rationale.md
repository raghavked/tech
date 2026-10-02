# Session view variants: rationale

**Decision: carry C, turn markers, into the product, with A's spacing as its base.**

A two-hour session with 60 events is not read top to bottom; people arrive late, scroll back to the contention or the approval, and need to know *when* and *at which turn* something happened. Variant C answers that without touching the column: time and turn number sit in a quiet left gutter in tertiary grey, silences become a serif italic row ("15 quiet minutes"), and the meta line is reduced to the name. The 760 px column stays as clean as A, so the agent's prose still reads like a page.

**Rejected.** A (airy) is the most pleasant single screen but shows only four or five events, so a handoff brief and a contention sit two screens apart; its timestamps also compete with the role word inside the meta line. B (compact) fits seven, but folding tool calls into one summary line hides the thing engineers scan for (which file, how many tests), and the tighter bubbles start to feel like a chat log rather than a shared record.

**Carry into the product.** The gutter markers (12 px, tabular, right-aligned, hidden under 1200 px), the quiet-minutes row, tool calls always expanded to one line each, approvals and contentions as the only bordered rows, and a single accent reserved for the send arrow. B's summary line is worth keeping as the collapsed state of a turn with more than five tool calls.
