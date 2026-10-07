# Usage charts · notes

## The idea
Usage is one page that answers the manager's three questions in order: how much (five stat tiles with one sentence above them), when (tokens by day as stacked columns beside October's cumulative line against the soft budget, with the pace carried forward as a dashed projection in a ±8% band), and who (by project, by person, by agent as horizontal stacked bars with the value at the tip). Only two series ever carry colour, input and output, in the brand's navy and chocolate stepped into the chart band (#3B66A8 / #A85236 on cream, #5F88C8 / #C96A50 on the dark surface, validated with the dataviz six checks in both modes); cache reads live beside the bars and in the tooltip, never inside the stack, and the single-series total wears the hand. Every chart has a legend, a direct label on the one point that matters, a hover tooltip, a "Table" button, and the same numbers as a real table at the foot of the page.

## What to keep
- The colour contract: input navy, output chocolate (stepped, not raw brand hex), cache apricot wash beside and never inside the budget bar, total in `--accent`. Stat values in serif, every axis tick and value in mono, labels in text tokens, never in the series colour.
- Mark specs: columns capped at 24px with a 2px surface gap between segments and a 4px rounded top on the output segment only; 2px lines with surface-ringed end dots; recessive hairline grid; the "This week" wash and the "Last week · 179k" comparison in the same chart instead of a second axis.
- The forecast card's vocabulary: "So far" solid, "At this pace" dashed, ±8% band, the 80% amber hairline with a dot where the pace crosses it, the budget as a dotted line labelled "soft", and the foot that says nothing stops.
- The sentence under the title says the chart's conclusion in words (18% more, Billing page, 981k of 1.0M, amber around 26 Oct) so a reader on a phone gets the story before any chart.
- Mobile: tiles two-up with the hero tile full width, a 7-day version of the column chart with its own viewBox (not a shrunken 14-day one), the forecast re-laid, person and agent rows with avatars, the table with cache and heaviest columns hidden.
- Accessibility channel: each SVG has a title and desc; the hatch pattern is wired for `forced-colors` and the Texture chip in the controls; the table is always rendered, not behind a toggle.

## Open questions
- "By person" counts the session holder (the driver). For team sessions should the spend be split by who steered, or shown twice (holder and steerer) with a note? Finance will ask.
- The forecast uses the last five weekdays and two weekend days carried forward. Is a ±8% band honest at day 7, or should the band widen until there are two weeks of October?
- Cache read is "outside the budget" by spec; the Cache tile shows 96k read without a saving in tokens or money. Keep it a count, or add "saved ~86k of input" as the token-meter exploration proposed?
- The hover tooltip on the horizontal bars sits above the row (sibling grammar) and covers the row above. Try a tooltip that replaces the value column on hover instead.
- Should the Texture chip be a page control at all, or only follow the team setting in Settings → Team look and `forced-colors`?
- At 30 days and Quarter the column chart needs 30 or 13 columns; do the week washes stay, or does the quarter switch to weekly columns?
