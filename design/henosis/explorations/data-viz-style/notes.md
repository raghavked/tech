# Data visualisation style · notes

## The idea
Charts in Henosis answer a manager's question in a sentence, then prove it with as little ink as the data allows, so this guide starts with four rules (one sentence then one axis; colour follows the entity; text wears text tokens; nothing is gated by colour or hover) and spends the rest of the page on the pieces that make them true. The brand palette does not draw the data: navy and chocolate are stepped into a chart band (#3B66A8 / #A85236 on cream, #5F88C8 / #C96A50 on the dark surface) with teal and gold as the only other categorical slots, validated with the dataviz six checks in both modes, while the hand keeps the one total and the pulse keeps the washes and the live dot. Every chart ships with a legend for two or more series, one direct label on the point that matters, a crosshair or per-mark tooltip whose values lead, a table underneath, and a dark mode that is restepped from the same ramps rather than flipped.

## What to keep
- The series contract: input navy, output chocolate, projects in slots 1–4 in fixed order, a fifth folds into Other (#B9BEC9 / #555E70); the ok/warn/danger tokens are reserved for status and always travel with an icon and a word.
- Mark specs as numbers: columns ≤ 24px with a 2px surface gap and a 4px rounded top on the last segment only; 2px lines, r 4 end dots with a 2px surface ring; area wash at 10%, projection band at 8%; hover lifts the mark 12% brighter and nothing else moves.
- Axis grammar: hairline solid grid in `--line`, one baseline in `--ink-3`, JetBrains Mono ticks at 11px in `--ink-3`, compact numbers (25k, 1.0M), the month once at the first day, four or five gridlines.
- Tooltip grammar: date, then value in mono first and series name second, a short stroke key for lines and a 10px box for bars, the context line last; sits beside the crosshair on the side with more room and never over a reference label; an empty day is a dash.
- Stat tile contract: label · serif value with the unit small and faint · signed delta against a named period · 12-point sparkline with only the current period in colour; one hero per view on the brand gradient; a 6px meter that turns amber past 80%; loading keeps the label and shimmers the value; empty is a dash and a sentence.
- Sparkline sizes (110×26 in a row, 64×18 on a rail card, 56×16 in a chip) with apricot as the current period on the navy rail.
- The table is rendered under the chart, never behind a toggle; texture (45° / 135° tone on tone) is the backup for hue under the team look, print and forced colours.

## Open questions
- The stat-tile value is Instrument Serif here because numbers with a name's weight read as Henosis; the dataviz skill prefers the same sans as everything else. Decide once for the whole product (the usage-charts exploration also chose serif).
- Series 4 gold passes the validator but is the weakest slot on cream (3.0:1 just clears). Should the fourth project fold into Other at three, or should the gold step darker and lose warmth?
- The 14-day column chart needs its own 7-day viewBox on a phone; this board shows the desktop one shrunk. Which explorations own the phone variants of each chart form?
- The hover state on a stacked column lifts the whole column; should only the hovered segment lift when the tooltip lists both?
- No shot-mobile.png is included: three full-page captures of a 5,000px board could not fit the 300 KB limit together with the page; the mobile layout is in the page (one-up tiles, hidden table columns, wrapped chart heads) and was checked at 390px during the build.
- The screenshots are half-scale, 19-colour palette PNGs to stay under the size limit; the canvas wash bands in them. Is a size budget per exploration the right rule for boards, or should boards ship viewport shots plus the HTML?
