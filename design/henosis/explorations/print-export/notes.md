# Print and export · notes

## The idea
Paper is one theme: a white page, ink, and cream only under a quoted human message and a release gate, with the kernel's decisions in one green and masked secrets in one amber; nothing apricot, no gradient, no shadow, nothing to press. The session PDF and the printed audit trail share one running head (mark, wordmark, team · project · kind, who exported it and when, session id and branch) and one foot (hash and masked count, title, page of pages), so a single sheet pulled from the stack still says where it came from and how to check it. Everything that is a name stays in Instrument Serif with the role as it was at that moment, everything that is an id, a time or a count sits in JetBrains Mono one size smaller, and wherever the export leaves something out the page says so in one italic serif line rather than leaving a gap.

## What to keep
- The paper block is theme-proof: its colours are its own `--paper-*` tokens with `color-scheme: light`, so the sheets stay white on the dark canvas while the board chrome follows the theme.
- The cream variant of the mark on paper (chocolate and navy arcs, apricot centre, cream disc); in one ink the agent's arc is dotted so two arcs still read as two; never the navy disc on white.
- Ratings drawn as five mono glyphs with the off stars in ink-3 plus the number, so a rating looks the same in the stream, the queue, the gate ledger and on paper.
- Kernel rows in green with the rule beside them in mono ("1 at 3+ · got 2, avg 4.5", "✓ fold"); the gate row with the ink stripe at the left, the export's own row on a cream band at the bottom.
- The facts strip (ran, tokens of budget, steps done, united) under the title on the session page; the six counts under the title on the audit page; both with a one-point ink rule above and a hairline below.
- Page-break rules: a plan card and its ratings never split; a gate keeps its votes and grant; ledger rows never split and the header row repeats; long tool results fold to one line with the exit.
- The "omitted says so" line: "Team chat, 14 messages, stays in the circle" in serif italic where the chat would have been.
- The verify line and the signature row at the foot of both documents, identical in both.
- The board's own `@media print`: hides the chrome, A4 with 16mm margins, the audit trail on its own page, external links print their address in brackets.
- The Export sheet is a three-way radio with the page count beside each format and an include list whose off rows carry their reason in italic; the hint says the export is itself recorded.

## Open questions
- Folded tool lines keep the PDF to six pages; should the dialog offer "unfold tool results" (forty-one pages) or is the bundle the only place for the full text?
- In one ink the agent's arc is dotted; is that the rule for every monochrome use of the mark (faxes, stamps, embossing) or only for paper?
- The running foot carries a truncated hash (9b1e…c47d); should the last page carry the full sha256 and a verification URL, or is the replay command enough?
- The audit page names the role a person had at each act; should a roster with final roles sit on page 1 under the counts, or only on the last page as the page map says?
- Dee's unrated approve prints as "a voice not a vote"; is that wording right on paper, where a reader cannot hover for the rule?
- Abandoned branches are off by default and named where they were; should the line say why the branch was abandoned, and who may include it?
- Does the printed audit trail need a per-page signature or only the one on the last page; auditors who receive a single page may expect both.
