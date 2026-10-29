# sig-token-art · Spend, drawn (second cut)

Token usage as the one thing on the page worth looking at, inside the frame every other screen has.
Three forms, one hue, one living point, and under the week the hands of the people who steered it.

- **The ring.** Each agent's spend fills a ring from the top, clockwise, against its plan. The plan is the
  seam at twelve; the plan's *steps* are short ticks on the inside of the stroke at their cumulative
  estimates, so the fill reads against the step it is on; the 80 % mark is one longer tick on the outside.
  Input is the lighter step and output the darker step of the same chocolate; the share past 80 % turns
  amber; the overflow past the plan draws as a thin red lap outside the ring; cache is a dotted arc inside
  the track, beside the plan and never in it. Under each ring one line says the estimate against the
  actual: *9.7k under · step 3 of 4 next*, *3.8k over · the plan, done*. An apricot **ember** sits at the
  leading edge of the agent that is spending now and breathes on the 1.8 s clock. The same ring, cut to
  track and fill at 16 px, sits in every agent card in the rail.
- **The week.** The manager's five days, turn by turn: one column per turn stacked by agent from a
  baseline, in the four lightness steps, with 1.5 px of surface between segments. Days are hairlines; the
  heaviest turn carries the one direct label; the live turn carries the ember and breathes. **Beneath the
  baseline, "Steered by":** bracketed runs of turns with the person who held the session in serif, so the
  agents' spend sits on top of the people's hands. A segmented control offers the **mirrored** version
  (stacked from a centre line outward, the waveform of the first cut) so the founder can pick between
  honest heights and the recording-of-the-room look; the port carries only the chosen one.
- **The tide.** October as water rising against the soft budget: the water (a wash with a 2 px
  shore-line), weekends as faint bands where the water stands still, the **tide line** (today's level, a
  dotted hairline back across the plot), the shore (the budget, dotted, "nothing stops here"), the
  high-water mark (80 %, one amber hairline), the pace of the last five weekdays carried forward as a
  dashed line in a ±8 % band, and one dated amber dot where the pace crosses 80 %. Every level is
  labelled at its *left* end, where nothing rises to meet it. The ember sits at today.

Every form has a **table twin** as a disclosure under it (`<details>`, reachable by keyboard and by a
screen reader with no colour and no hover); the rings' table carries every plan step with its estimate,
its actual and the delta. Each SVG is a `role="img"` with a `<desc>` that states the conclusion, and
each ring is a `role="meter"` whose `aria-valuetext` reads the four numbers and the estimate line. The
sentence above everything says the story in words before any chart: *"Billing has spent 612k of its
1.0M this month. Bo's agent is spending now on Checkout … At this pace the month turns amber on Tuesday
27 October and ends near 976k, under the soft budget."*

Files: `index.html` (self-contained: tokens inlined from SYSTEM v5, light in `:root`, dark twice
byte-identical under the system media query and `[data-theme="dark"]`; every animation inside the one
guard `prefers-reduced-motion: no-preference` + `:root:not([data-motion="calm"])`; Fraunces / Inter
asked first, then Instrument Serif / Instrument Sans, then the system faces; no external assets, no fonts
fetched), `light.png`, `dark.png` (1440 × 900), `phone.png` (390 × 844), `light-mirror.png` (the week in
its mirrored form, for the founder's pick). The inspector (Turn · Tables · Calm · Dark, keys `t b c d m i`)
is a floating strip that is **hidden unless the URL ends in `#inspect` or `i` is pressed**, so no still
shows chrome the product will not have (judge panels 1 and 3). `#mirror` opens the page with the mirror.

## What changed since the first cut (the three panels' fixes)

| Panel asked | Done |
|---|---|
| Baseline beside the mirror; the founder picks (1, 2, 3) | Baseline is the default; *Mirrored* is a segmented control in the card head; `light-mirror.png` is the still of it |
| Dark tints lift toward pink; the glow at .72 smudges (3) | Dark ramp restepped at OKLCH h 45° C .045 (`#D8B5A6 #C19F91 #A9897A #927264`, 7.4 / 5.8 / 4.4 / 3.2 : 1 on `#242C3C`), a tan, not a pink; the waveform's glow is gone in both themes, only the ember and the breath remain |
| The page has no rail, floats without the frame (1) | The navy rail with the four agent cards, projects and groups; the 16 px ring cut in every card's foot |
| Tide labels crossed by the pace line at the right edge (1) | Budget, 80 % and today labels anchored at 1 Oct; the dated dot's label sits above-left of the dot between the two lines, with a 5 px canvas stroke |
| Dee's agent the hardest to read at 3.6 : 1 (2) | Light ramp restepped: lightest step `#966961` at 4.68 : 1 on white, 4.38 on cream |
| `kbd` inside the hand at 2.2 : 1 (2) | The inspector has no primary button, and is hidden in every still |
| Ship `SpendRing` first; the ring is what reaches the session (3) | The ring is first on the page and in the port; plan-step ticks and the estimate line bring the brief's *estimate vs actual* onto it |
| Six pages invent the same grain (1, 3) | One tile, the surfaces patch's alpha (.06 day, .05 night), named as borrowed, not re-derived |

## What it is

| Piece | Encoding | Value |
|---|---|---|
| Spend hue | chocolate stepped in lightness only | light OKLCH h 30° C .06 L .30/.395/.485/.565 = `#47211B #633A33 #7E524B #966961` on `#FFFFFF` (13.99 / 9.62 / 6.57 / 4.68 : 1); dark h 45° C .045 L .58/.655/.73/.80 = `#927264 #A9897A #C19F91 #D8B5A6` on `#242C3C` (3.21 / 4.36 / 5.76 / 7.38 : 1), Ana → Dee is step 1 → 4 in both |
| Ring | r 36, stroke 9, `pathLength="100"`, `stroke-dasharray` per segment, 1.2 hundredths of surface between segments | input `--spend-in` (step 4), output `--spend-out` (step 2), track `--spend-track` (`#F2E6E2` / `#3B3134`), amber share `--warn`, overflow lap r 43.5 stroke 2.5 `--danger`, cache dotted arc r 28.5 `--ink-3` |
| Seam and ticks | seam r 30 → 42 at 0 %, `--ink-2`; step ticks r 30.5 → 34 at each cumulative estimate, `--ink-3`; the 80 % tick r 41.5 → 45.5, `--ink-3`, `--warn` once the ring is past it | inside the stroke is the plan, outside the stroke is the budget |
| Ember | r 4 apricot point with a 2 px surface ring and an r 8 halo | `--ember` `#CFA782` by day, `#E2C4A6` at night; halo `ember-halo` 1.8 s on `--ease-leave` (mark-halo's shape) |
| Rail cut | 16 px, viewBox 96, stroke 14, track `rgba(243,237,228,.16)`, fill apricot, amber past 80 %, red past the plan | no ember, no tick, no number: the number is beside it |
| Week | column 20 (13 bar + 7 gap), baseline y 128, max column 106; mirrored: half-heights about y 70; segments under 1.6 units dropped from the picture and kept in the table | the four steps; the live column `breath` .72 → 1 on 1.8 s; the new column `grow` 320 ms `--ease-arrive` from the baseline |
| Steered by | a 1 px `--ink-3` bracket per run with 3 px end ticks, the name in italic serif 12.5, a 10.5 px kicker | people under the agents; the live turn's run says "Bo, now" |
| Tide | 440 × 250 viewBox, x = day of October, y = 0 … 1.1 M | water `--spend-wash` (10 % / 12 %) + 2 px `--spend-line`; weekend bands `--surface-2` at .7; tide line `1 3` dotted `--ink-2`; budget `2 4` dotted `--ink-2`; 80 % 1 px `--warn`; pace 1.5 px `4 3` `--ink-2`; band `--ink-3` at 8 %; the dated dot `--warn` with a surface ring |
| Tooltip | value first in mono, name second, context last; flips to the left near the right edge | `.tip`, `role="status"`, `aria-live="polite"` |
| Type | names in Fraunces / Instrument Serif (`"SOFT" 50, "WONK" 0`), what is read in Inter / Instrument Sans, every number and tick in JetBrains Mono tabular | the stat inside the ring is mono: it is a count, not a name; the estimate line is a mono number over sans words |

## Why it is ours

- **One hue, and the living thing is apricot.** data-craft's palette rule for all ten elements: data ink
  stepped in lightness only, spend in chocolate, "the current, living thing is Apricot Illusion", status
  hues only against a budget. Spend is *only* chocolate, every agent is a step of it, and apricot appears
  in exactly one place per form: the point that is spending now. SYSTEM §1.2 (apricot has one meaning),
  §1.3 (the dot carries the colour, the word stays ink: the status word under each ring is ink, the state
  in the table takes the `-ink` tokens) and §1.4 (a filled chocolate thing means press me: the hand
  `#56352D` is never a fill here; the output step is `#633A33`, a lightness step away) hold.
- **The ring is the mark as data** (data-craft §10 *Session ring*, ai-interfaces-avoid §5 *Ring meter*,
  motion-choreography §6 *honest progress arc* bound to real work). A `pathLength="100"` circle closing
  at the seam where the plan is: the brand's two arcs closing into one ring, scaled to a number. The
  *estimate tick* of data-craft §7 becomes the inner ticks (one per plan step), which is the brief's
  **token optimisation, estimate against actual**, drawn on the meter the team sees every hour; the
  hairline-tally rule of §4 (input a lighter step, output darker, cache a dotted outline beside the bar)
  is bent into the circle.
- **The week with its hands.** data-craft §4: "the avatar under each bar is whoever held the session;
  steering changes nothing." The *Steered by* brackets are that rule as a drawing: people in serif under
  the agents' spend, one baseline, which is the unity story (people and agents in one circle) on the
  manager's own chart. Tufte's word-sized graphic (data-craft) grown to a room; Datawrapper's sort-and-
  caption honesty (the sentence names the heaviest turn). The baseline is default because the panels
  asked for honest heights; the mirror stays one click away because it is the look nobody else has.
- **The tide is the pace line with its band** (data-craft §5: solid so far, dashed at this pace, a
  `fill-opacity .12` band, "the dot carries a date, never a percentage") given a metaphor the brief's
  voice can carry: *"the month turns amber on Tuesday 27 October."* The tide line (today's level back
  across the plot, as a tide mark on a harbour wall) and the still-water weekends are ours.
- **Annotation instead of apparatus** (data-craft §8, Datawrapper's no-axis-labels): no legend on the
  ring; the week's legend is the four names the stack needs; the tide's levels are labelled at the left
  end with `paint-order: stroke`; the y axis is three faint lines with the unit on the tick.
- **Motion means living** (BRIEF, MOTION §1, §6.11): the only loops are the ember's halo, the live
  column's breath and the running dot, all 1.8 s, apricot or the status green, far from the 0.2 Hz band
  motion-choreography warns about. The ring's fill eases 300 ms when a turn records (`--t-fill`, MOTION
  §6.11's budget fill) and the new column grows 320 ms on `--ease-arrive`. Rest is the end state: under
  Calm the ember is a still point, the live column sits at full opacity, every ring is at its figure
  (MOTION §3, §11). `document.getAnimations()`: 6 at rest, 0 under Calm.
- **Dark is re-weighed, not inverted** (SYSTEM §16, three-colour-brands "dark treatments keep the hue"):
  the ramp is restepped from a warmer hue so the lightest tint is a tan (`#D8B5A6`), clearly not the
  apricot ember (`#E2C4A6`) beside it; the track goes to a warm dark; the wash to 12 %; status takes the
  night triplet; the rail is `#10141C` under a `#1A202C` canvas with `--edge` on every card.
- **The frame** (premium-product-ui §1 "dimmed rail, lit session"; SYSTEM §6): navy rail, apricot crease,
  the agent cards' feet carrying the 16 px ring, so the signature is seen on the way to the page, not only
  on it. Paper, hairlines, serif names (three-colour-brands §1, editorial-type §1, §6): the grain tile at
  the surfaces patch's alpha, every edge a 1 px line, ledger numerals in tabular mono so people's and
  agents' numbers align on the same decimal.
- **Not Claude, not ChatGPT, not Linear** (ai-interfaces-avoid): no sparkle, no purple, no bar list, no
  cycle graph with grey scope and dotted target. The distinctness is structural: the ring with the plan
  inside and the budget outside, the people's brackets under the agents' columns, the tide mark.

## The technique

```js
// the ring: one circle per segment, pathLength 100, the gap is the surface showing through
<circle class="seg in"    pathLength="100" stroke-dasharray="{in − 1.2} 100" stroke-dashoffset="0" />
<circle class="seg out"   pathLength="100" stroke-dasharray="{out − 1.2} 100" stroke-dashoffset="{−in}" />
<circle class="seg amber" pathLength="100" stroke-dasharray="{min(100, pct) − 80 − 1.2} 100" stroke-dashoffset="−80" />
<circle class="lap" r="43.5" pathLength="100" stroke-dasharray="{pct − 100} 100" />   // only past the plan
<line class="tick" …polar(30.5, estSoFar/plan)… />                                   // one per plan step
```

- The ring's `<g>` is rotated −90° so 0 is the top seam; the ticks, the seam and the ember are drawn in
  the unrotated frame with `polar(r, pct)`. `stroke-dasharray` transitions over `--t-fill` (300 ms,
  zeroed under Calm), so a turn landing eases the fill without touching layout. The estimate line is
  `actual − Σ estimate of every step touched` and names the step from an explicit `now` index; the
  table twin lists every step.
- The week is plain SVG built from the turn table: each column a `<g data-i>` of `<rect rx="1.5">`
  segments; mirrored draws each segment twice about the centre line at half height. The steer strip is
  drawn from the `STEER` runs; the live run is appended. Hovering or focusing a column (`tabindex="0"`)
  dims the rest to .42 and writes one tooltip. Phone: the last 24 turns at 14 px columns, the live label
  anchored to the right.
- The tide is one `<path>` for the water, one for the shore-line, one polygon for the band, one path for
  the pace; `tideSeries()` averages the last five weekdays, carries the pace over the remaining weekdays
  (weekends flat) and finds the crossings by interpolation. Hover moves a dotted probe and a dot by
  attribute; the tooltip is HTML beside it.
- All colour comes from custom properties (`--spend-1…4`, `--spend-in/out/line/wash/track`, `--ember`,
  `--ember-soft`), light in `:root`, dark in both dark blocks; the SVG reads them through CSS classes, so
  a theme change repaints without a redraw. A team look that retints `--team-highlight` should retint
  `--ember` the same way the focus halo is retinted; never the spend ramp.
- The guard: every `animation` sits inside `@media (prefers-reduced-motion: no-preference) {
  :root:not([data-motion="calm"]) … }`; Calm and reduce zero the clocks (`--t-fast --t --t-slow --t-fill`).
  The inspector's Calm button toggles `data-motion="calm"` exactly as `theme.ts` does.

## The cost

- **DOM.** 1,410 nodes on the desktop page, 358 of them SVG: 252 in the week (49 columns × ~4 segments,
  the day lines, the steer brackets), 14 per ring, 35 in the tide, 4 rail cuts of 3. The week at 24 turns
  on a phone is 121. Everything else is HTML text; the tables are built once.
- **Animated properties.** `opacity` and `transform` on the three halos and the live column's rects
  (compositor); `stroke-dasharray` transitions on the ring only when a turn lands (paint, 100 px). No
  filter at paint time: the grain is a 240 px tile decoded once; no glow at all this cut.
- **Frame time**, headless Chromium at 1440 × 900 with the loops running: median 16.7 ms (vsync), p95
  50 ms in the headless shell (one skipped vsync in 150 frames; the paint surfaces are three 16 px halos
  and a 13 px column). Check once on a real display; if the three halos cost, keep only the ring's.
- **Script.** Data, three draw functions and the twins are ~12 KB of the 60 KB page. A hover on the week
  toggles a class on 49 groups and rewrites one tooltip; the tide hover moves three attributes.
- **Redraws.** The week redraws on a turn landing, on the segmented control and across the phone
  breakpoint; the rings redraw on a turn landing. Theme and Calm changes are CSS only.

## How it ports into `apps/web`

Ship the ring first and alone (judge 3), then the week and the tide into the manager's Overview.

1. **`apps/web/src/tokens.css`**: add `--spend-1 … --spend-4`, `--spend-in`, `--spend-out`,
   `--spend-line`, `--spend-wash`, `--spend-track`, `--ember`, `--ember-soft` to `:root` and to both dark
   blocks (values in this page's three blocks; both ramps are validated). Add the `ember-halo`, `breath`
   and `grow` keyframes beside `dot-live`, and the three rules from this page's guard inside the existing
   `@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }` block at
   line 720. Add `--t-fill: 300ms` to the clocks at line 174 and zero it in the Calm / reduce rules.
2. **`apps/web/src/viz.tsx`**: three components beside `StatTile`, `Bars` and `Area`:
   - `SpendRing({ usage, plan, steps, now, live, who, size })`: this page's `ring()` as React
     (`<svg viewBox="0 0 96 96">` with the segment circles, the lap, the cache arc, the step ticks, the
     80 % tick, the seam, the ember and the two texts), the wrapper a `role="meter"` with the composed
     `aria-valuetext`. Budget maths from `budgetStatus({ usage, policy: { tokenBudget } })` in
     `@henosis/kernel`, as `TokenMeter` does; the ring counts input + output only, cache never fills it.
     `steps` is the plan's `{ estTokens, actualTokens? }[]` from the session report; `size={16}` renders
     `ringCut()` (track + fill, no ember, no ticks, no text).
   - `TurnWave({ turns, agents, steer, liveId, mirrored })`: `drawWave()` over
     `{ n, v: Record<agentId, number>, day, time }[]` plus `steer: { from, to, person }[]`, with the
     legend, the one direct label, the steer strip, the crosshair tooltip (`role="status"`) and the table
     twin; the phone cut (last 24 turns) from `matchMedia`. `mirrored` is a prop, not a control, once the
     founder has chosen.
   - `BudgetTide({ days, budget, today })`: `drawTide()` and `tideSeries()` (pace from the last five
     weekdays, the ±8 % band, the dated crossing, weekends flat), with its table.
   The table twin is a `<details className="twin">` in all three, not a toggle button: the app's `Table`
   button on `Bars` / `Area` can stay, but the disclosure is what a screen reader finds without a hover.
3. **`apps/web/src/stream/TokenMeter.tsx`**: in the popover and in the drawer's `open` block, render
   `<SpendRing size={64} …>` to the left of the `kv` rows (the stacked bar becomes the ring; the four rows,
   the rule, the budget row and the consequence line stay in their fixed order). The 24 px chip in the
   title row is unchanged: at that size the hairline reads and a ring does not.
4. **`apps/web/src/stream/PlanCard.tsx`**: the totals row (`.plan .totals .budget` in `styles.css`
   line 2505) takes `<SpendRing size={40} steps={plan.steps} …>` beside the estimate, so the plan's own
   ticks are on the plan's own card.
5. **`apps/web/src/Rail.tsx` · `AgentCard`**: the foot's `tokens` span renders `<SpendRing size={16}>`
   before the number when `row.report?.plan?.estTokens` is set (the rail cut in this page's rail);
   the `--spent` hairline (`tokens.css` line 382) stays for rows with no plan and for the collapsed rail.
6. **`apps/web/src/views/Team.tsx`**, the *Overview* group: replace
   `<Area title={copy.team.tokensOverTurns} points={overTurns} />` (line 548) with
   `<TurnWave turns={…} agents={…} steer={…} liveId={…} />` built from the same `usage.byTurnBucket`
   source split by agent (the `byAgent` rows at line 278 already carry the agent ids; the steer runs come
   from the sessions' `driver` history), keep the three `Bars` for project / person / agent, and add
   `<BudgetTide …>` under the stat tiles fed by the usage report's per-day totals and the project's soft
   budget. The `StatTile` trend sparkline stays as it is.
7. **`apps/web/src/styles.css`**: the `.ring`, `.ring-cut`, `.wave`, `.tide`, `.twin` and `.tip` rules
   from this page under the "manager's view" block at `.stats` (line 7259); `.chart-tip` (line 7512) can
   merge with `.tip`.
8. **`apps/web/src/copy.ts` · `viz`** (line 1138): `asTable`, `steeredBy`, `atThisPace`, `spendingNow`,
   `pastEighty`, `overThePlan`, `underItsEstimates`, `stepOf`, `softBudget`, `nothingStops` ("the budget is
   soft; nothing stops at …").
9. **`apps/web/src/theme.ts` · `applyTeamTheme`** (line 145): set `--ember` from `--team-highlight` so a
   team's colour recolours the living point the way it recolours the focus halo; never the spend ramp.

Accessibility (SYSTEM §18, MOTION §11): every ring is a meter with its numbers and its estimate in words;
every SVG has a label and a description that states the conclusion; every chart has its table in the DOM;
tooltips are polite status regions; the week's columns are focusable; the status word beside each ring
carries the state in text; amber and red appear only with a number and a word ("86 %", "3.8k over"); nothing
flashes (1.8 s loops only); the lightest spend step is 4.68 : 1 by day and the darkest 3.21 : 1 by night,
with the 1.5 px surface gaps and the direct labels as the second channel.

## Open

- **Mirror or baseline** is still the founder's call; both are on one page now (`light.png`,
  `light-mirror.png`). The port should carry one `mirrored` default and no control.
- **Step ticks on a 40 px ring** (the plan card) may be too fine; at 64 px they read. If 40 px is too
  small, draw only the tick for the step now.
- **The estimate line** compares actual with the estimates of every step touched, including the running
  one, so a step that is half done reads "under". The alternative (completed steps only) hides the running
  overrun until the step ends. This page prefers the live reading; the table shows both.
- **The pace band at ±8 %** is usage-charts' number with only five weekdays in the average; widen until
  two weeks are in, or state the sample in the tooltip ("from the last 5 weekdays").
- **The steer strip** names a run only when it is wider than 26 units; short runs show the bracket and
  keep the name in the tooltip and the table. On a phone most runs are short.
- **Three halos at once** (ring, week, tide) are three places saying "now" for one agent. If a real
  display shows them as noise, keep the ring's and let the week's and the tide's embers be still points.
