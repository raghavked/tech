# sig-token-art · Spend, drawn

Token usage as the one thing on the page worth looking at. Three forms, one hue, one living point:

- **The ring.** Each agent's spend fills a ring from the top, clockwise, against its plan. The plan is the
  top seam; input is the lighter step and output the darker step of the same chocolate; the share past
  80 % turns amber; the overflow past the plan draws as a thin red lap outside the ring; cache is a dotted
  arc inside the track, beside the budget and never in it. An apricot **ember** sits at the leading edge
  of the agent that is spending now and breathes on the 1.8 s clock.
- **The waveform.** The manager's week, turn by turn: one bar per turn, stacked by agent from a centre line
  outward and mirrored, so the project's spend reads like a recording of the room's voice. Days are
  hairlines; the live turn carries the ember and a warm glow and breathes; the heaviest turn is labelled
  once; everything else is in the tooltip and the table.
- **The tide.** October as water rising against the soft budget: the water (a wash with a 2 px shore-line),
  the **tide line** (today's level, a dotted hairline back across the plot, labelled), the shore (the
  budget, dotted, "soft"), the high-water mark (80 %, one amber hairline), the pace carried forward as a
  dashed line in a ±8 % band, and one dated dot where the pace crosses amber. The ember sits at today.

Every form has a **table twin** as a disclosure under it (`<details>`, so it is reachable by keyboard and
by a screen reader with no colour and no hover), a `role="img"` label with a `<desc>` that says the
conclusion, and the ring is a `role="meter"` whose `aria-valuetext` reads the four numbers. The sentence
above everything says the story in words before any chart (usage-charts' rule): *"Billing has spent 612k
of its 1.0M this month. Bo's agent is spending now …"*

Files: `index.html` (self-contained: tokens inlined from SYSTEM v5, light in `:root`, dark twice
byte-identical under the system media query and `[data-theme="dark"]`; every animation inside the one
guard with `prefers-reduced-motion: no-preference` + `:root:not([data-motion="calm"])`; Fraunces / Inter
asked first, then Instrument Serif / Instrument Sans, then the system faces; no external assets, no fonts
fetched), `light.png`, `dark.png` (1440×900), `phone.png` (390×844). The topbar's **Turn · Tables · Calm ·
Dark** buttons (keys `t` `b` `c` `d`) are the exploration's inspector and not part of the design; *Turn*
lets Bo's agent finish a turn so the three forms can be seen moving together.

## What it is

| Piece | Encoding | Value |
|---|---|---|
| Spend hue | chocolate stepped in lightness only, OKLCH h 34°, C .06 | light `#502920 #6D433A #8B5F55 #AA7C71` on `#FFFFFF` (12.5 / 8.4 / 5.4 / 3.6 : 1); dark `#F9C7BA #DBAA9E #BD8E83 #A17468` on `#242C3C` (9.3 / 6.8 / 4.9 / 3.5 : 1) |
| Ring | r 36, stroke 9, `pathLength="100"`, `stroke-dasharray` per segment, 2 px surface gaps (1.2 hundredths) | input `--spend-4`, output `--spend-2`, track `--spend-track` (a lighter step of the ramp), amber share `--warn`, overflow lap r 43.5 stroke 2.5 `--danger`, cache dotted arc r 28.5 `--ink-3` |
| 80 % tick, plan seam | a radial hairline at 80 %, a hairline at 12 | `--ink-3`; the tick takes `--warn` once the ring is past it |
| Ember | r 4 apricot point with a 2 px surface ring and an r 7 halo | `--ember` `#CFA782` by day, `#E2C4A6` at night; halo `ember-halo` 1.8 s (mark-halo's shape) |
| Waveform | bar 16 px, gap 4, half-height 60 (viewBox), stacked from the centre outward in a fixed order, 2 px surface gaps, 4 px rounded outer ends only | the four steps, Ana → Dee; the live column `breath` .72 → 1 on 1.8 s; glow a radial gradient of the ember at `--glow-alpha` (.28 day, .72 night) |
| Tide | 560 × 212 viewBox, x = day of October, y = 0 … 1.15 M | water `--spend-wash` (10 %) + 2 px `--spend-line`; tide line `1 3` dotted; budget `2 4` dotted `--ink-2`; 80 % 1 px `--warn`; pace 1.5 px `4 3` dashed `--ink-2`; band `--ink-3` at 8 %; the dated dot `--warn` |
| Tooltip | value first in mono, name second, context last; beside the crosshair on the side with more room | `.tip`, `role="status"` |
| Type | names in Fraunces (`"SOFT" 50, "WONK" 0`), what is read in Inter, every number and tick in JetBrains Mono tabular | the stat number inside the ring is mono, not serif: it is a count, not a name |

## Why it is ours

- **One hue, and the living thing is apricot.** data-craft's palette rule for all ten elements: data ink
  stepped in lightness only, spend in chocolate, "the living thing is Apricot", status hues only against
  a budget. Here spend is *only* chocolate, every agent is a step of it, and apricot appears in exactly one
  place per form: the point that is spending now. SYSTEM principle 2 (apricot has one meaning) and 3 (the
  dot carries the colour, the word stays ink: the status word under each ring is ink, the state in the
  table takes the `-ink` tokens) hold. SYSTEM 4 ("a filled chocolate thing always means press me") is kept
  by never using the hand's `#56352D` as a fill: the ring's output step is `#6D433A`, a lightness step
  away, and nothing in the charts is a pill.
- **The ring is the mark as data** (data-craft §10 "Session ring", ai-interfaces-avoid §5 "Ring meter",
  motion-choreography §6 "progress arc bound to real work"): a `pathLength="100"` circle whose
  `stroke-dasharray` is the spend, closing at the top seam where the plan is. It is the same gesture as the
  brand's two arcs closing into one ring, scaled to a number. The estimate tick of data-craft §7 lives on
  it at 80 %, and the hairline-tally rule of §4 ("cache a dotted outline beside the bar", input a lighter
  step, output darker) is bent into the circle.
- **The waveform is Tufte's word-sized graphic grown into a room's voice** (data-craft: sparklines "scaled
  by the words and numbers beside them", Cleveland's 45° "lumpy, not spiky"; premium-product-ui: density is
  a feature). A mirrored stack reads as sound, and sound is what a team at work makes. Nobody else draws
  spend this way: Claude's usage page is a bar list, ChatGPT has none, Linear's insights are cycle graphs
  with grey scope and dotted target. The waveform refuses the stacked-area streamgraph (curves imply
  continuity between turns that does not exist) and the per-model colour stack of token dashboards
  (data-craft's "the better ones split every measure between people and agents"): it is by agent, in one
  hue, with the person who steered named in the tooltip and the table.
- **The tide is the pace line with its band** (data-craft §5: solid so far, dashed at this pace, ±8 %
  band, "the amber dot is dated, never a percentage") given a metaphor the brief's voice can carry: *"At
  this pace the month turns amber on Saturday 24 October."* The tide line is new: a horizontal hairline at
  today's level, the way a tide mark on a harbour wall says how high the water got, so the eye reads the
  level against the 80 % mark and the shore without an axis.
- **Direct labels, no legend where one series** (data-craft §8, dataviz): the ring has none; the waveform
  has the four-name legend the stack needs and one direct label on the heaviest turn; the tide labels the
  budget, the high-water mark, today and the crossing, each with a canvas-coloured outline where text
  crosses a line (`paint-order: stroke`).
- **Motion means living** (BRIEF, MOTION §1): the only loops are the ember's halo, the live column's
  breath and the running dot, all on the 1.8 s clock, all apricot or the status green, far from the 0.2 Hz
  band motion-choreography warns about. The ring's fill eases 300 ms when a turn records (MOTION §6.11)
  and the new column grows 320 ms on `--ease-arrive`; the live gradient does not scroll. Rest is the end
  state: under Calm the ember is a still point, the live column sits at full opacity, every ring is at its
  figure (MOTION §3, §11).
- **Dark is re-weighed, not inverted** (SYSTEM §16): the ramp is restepped lighter from the same hue and
  validated on `#242C3C`; the track goes to a warm dark `#33303A`; the glow takes more alpha because a
  translucent apricot over navy greys; the wash drops to 12 %; status takes the night triplet. The three
  colours Claude does not have, navy ground, chocolate spend, apricot pulse, are what the night version is
  made of (three-colour-brands).
- **Paper, hairlines, serif names** (three-colour-brands §1, premium-product-ui §1, editorial-type §1,
  §6): the grain tile at 6 % soft-light, every edge a 1 px line, names in Fraunces, ledger numerals in
  tabular mono so people's and agents' numbers align on the same decimal.

## The technique

```js
// the ring: one circle per segment, pathLength 100, the gap is the surface showing through
<circle class="seg in"  pathLength="100" stroke-dasharray="{in − 1.2} 100" stroke-dashoffset="0" />
<circle class="seg out" pathLength="100" stroke-dasharray="{out − 1.2} 100" stroke-dashoffset="{−in}" />
<circle class="seg amber" … stroke-dasharray="{min(100, pct) − 80 − 1.2} 100" stroke-dashoffset="−80" />
<circle class="lap" r="43.5" pathLength="100" stroke-dasharray="{pct − 100} 100" />   // only past the plan
```

- The ring's `<g>` is rotated −90° so 0 is the top seam; the cache arc, the tick and the seam are drawn
  as paths in the unrotated frame with `polar(r, pct)`. `stroke-dasharray` transitions over `--t-fill`
  (300 ms, zeroed under Calm), so a turn landing eases the fill without touching layout.
- The waveform is plain SVG built from the turn table: each column is a `<g data-i>` of rects (interior
  segments) and two paths (the outer segment, rounded on the outer corners only). Segments under 1.6
  units are dropped from the picture and kept in the table, so the centre does not fill with slivers.
  The live column's segments breathe; its glow is one `<ellipse>` filled with a radial gradient of the
  ember, animated on `transform` and `opacity` only.
- The tide is one `<path>` for the water, one for the shore-line, one for the band, one for the pace; the
  hover is a crosshair and a dot moved by attribute, with the tooltip positioned in HTML beside it.
- All colour comes from custom properties (`--spend-1…4`, `--spend-in/out/line/wash/track`, `--ember`,
  `--ember-soft`, `--glow-alpha`), light in `:root`, dark in both dark blocks; the SVG reads them through
  `var()` in `style` and in gradient stops, so a theme change repaints without a redraw. A team look that
  retints `--team-highlight` should retint `--ember` the same way the glow is retinted.
- The guard: `--motion: 1` only inside `@media (prefers-reduced-motion: no-preference) {
  :root:not([data-motion="calm"]) … }`; the inspector's Calm button toggles `data-motion="calm"` exactly as
  `theme.ts` does. The page checks `document.getAnimations()`: 13 running at rest, 0 under Calm.
- Phone: the waveform redraws with the last 24 turns at 10 px bars and its own labels (not a shrunken
  48-turn one); the rings go two-up; the tide keeps its viewBox with a taller plot; the topbar shows words
  instead of keys.

## The cost

- **DOM.** 372 SVG nodes on the desktop page: 285 in the waveform (48 columns × ~6 segments), 13 per ring,
  30 in the tide. The waveform at 24 turns on a phone is ~145. Everything else is HTML text.
- **Animated properties.** `opacity` and `transform` on the ember's halo, the glow and the live column
  (compositor); `stroke-dasharray` transitions on the ring only when a turn lands (paint, 118 px). No
  filters at paint time: the grain is a 240 px tile decoded once.
- **Frame time**, measured headless in Chromium at 1440×900 with the three loops running: median 16.7 ms
  (vsync) in both themes, p95 33 ms; under Calm p95 16.8 ms. The p95 with motion is one skipped vsync in
  150 frames in the headless shell, not a paint cost; a real display should be checked, but the paint
  surface is a 118 px halo, a 60 px glow and a 7 px dot.
- **Script.** The data generators and three draw functions are ~9 KB; the page is 55 KB. A hover on the
  waveform toggles a class on 48 groups and rewrites one tooltip; the tide hover moves two attributes.
- **Redraws.** Only on a turn landing and across the phone breakpoint. Theme and Calm changes are CSS.

## How it ports into `apps/web`

The three forms replace the manager's `Bars` and `Area` for tokens and give the session its ring; the
`TokenMeter` chip and the drawer's Usage block keep their grammar and gain the ring.

1. **`apps/web/src/tokens.css`**: add `--spend-1 … --spend-4`, `--spend-in`, `--spend-out`,
   `--spend-line`, `--spend-wash`, `--spend-track`, `--ember`, `--ember-soft`, `--glow-alpha` to `:root`
   and to both dark blocks (values in `index.html`'s three blocks; both ramps are validated). Add the
   `ember-halo`, `breath`, `glow-breath` and `grow` keyframes beside `dot-live`, and the four rules from
   this page's guard inside the existing `@media (prefers-reduced-motion: no-preference) {
   :root:not([data-motion="calm"]) … }` block. Add `--t-fill: 300ms` to the clocks and zero it in the
   Calm / reduce rules.
2. **`apps/web/src/viz.tsx`**: add three components beside `Bars` and `Area`:
   - `SpendRing({ usage, plan, live, who, size })`: the `ring()` function as React (`<svg viewBox="0 0 96 96">`
     with the segment circles, the cache arc, the tick, the seam, the ember and the two texts), the
     wrapper a `role="meter"` with the composed `aria-valuetext`. Budget maths from
     `budgetStatus({ usage, policy: { tokenBudget } })` in `@henosis/kernel`, as `TokenMeter` does; the
     ring counts input + output only, cache never fills it.
   - `TurnWave({ turns, agents, liveId })`: `drawWave()` as a component over `{ n, v: Record<agentId,
     number>, lead, steer, time, day }[]`, with the legend, the one direct label, the crosshair tooltip
     (`role="status"`) and the table twin; the phone cut (last 24 turns) from `matchMedia`.
   - `BudgetTide({ days, budget, today })`: `drawTide()` and `tideSeries()` (the pace from the last five
     weekdays and two weekend days carried forward, the ±8 % band, the dated crossing), with its table.
   The table twin is a `<details className="twin">` in all three, not a toggle button: the app's `Table`
   button on `Bars` / `Area` can stay, but the disclosure is what a screen reader finds without a hover.
3. **`apps/web/src/views/Team.tsx`**, the *Overview* group (`copy.team.overview`): replace
   `<Area title={copy.team.tokensOverTurns} points={overTurns} />` with `<TurnWave turns={…} agents={…}
   liveId={…} />` built from the same `overTurns` source split by agent (the `byAgent` rows already carry
   the agent ids), keep the three `Bars` for project / person / agent, and add `<BudgetTide …>` under the
   stat tiles fed by the usage report's per-day totals and the project's soft budget. The `StatTile`
   trend sparkline stays as it is.
4. **`apps/web/src/stream/TokenMeter.tsx`**: in the popover and in the drawer's `open` block, render
   `<SpendRing size={64} …>` to the left of the `kv` rows (the stacked bar becomes the ring; the four rows,
   the rule, the budget row and the consequence line stay in their fixed order). The chip in the title row
   is unchanged: at 24 px a ring does not read, the hairline does.
5. **`apps/web/src/Rail.tsx` · `AgentCard`**: the foot's `tokens` span may take a 16 px `SpendRing` cut
   (track + fill only, no ember, no tick) beside the number when `row.report?.plan?.estTokens` is set;
   the `--spent` hairline stays for the collapsed rail. Optional; the number plus hair already carries it.
6. **`apps/web/src/styles.css`**: the `.ring`, `.wave`, `.tide`, `.twin`, `.tip` and `.legend` rules from
   this page under the "manager's view" block at `.stats`; `.chart-tip` can merge with `.tip`.
7. **`apps/web/src/copy.ts` · `viz`**: `asTable`, `thatDay`, `atThisPace`, `spendingNow`, `pastEighty`,
   `overThePlan`, `withinPlan`, `softBudget`, `nothingStops` ("the budget is soft; nothing stops at …").
8. **`theme.ts` · `applyTeamTheme`**: set `--ember` from `--team-highlight` so a team's colour recolours
   the living point the way it recolours the focus halo; never the spend ramp.

Accessibility (SYSTEM §18, MOTION §11): every ring is a meter with its numbers in words; every SVG has a
label and a description that states the conclusion; every chart has its table in the DOM; tooltips are
polite status regions; the status word beside each ring carries the state in text; the amber and red
appear only with a number and a word ("86 %", "past 80 %"); nothing flashes (1.8 s loops only); contrast
of the lightest spend step is 3.6 : 1 by day and 3.5 : 1 at night, with the 2 px surface gaps and the
direct labels as the second channel.

## Open

- **Is the mirrored stack honest enough?** The waveform halves each column's visual height by drawing it
  both ways; the proportions are exact and the table is under it, but a judge who wants Tufte's data-ink
  ratio may prefer the same bars from a baseline. The mirror is the signature; it should be shown to the
  founder beside the baseline version before it ships.
- **The ring's amber share** draws the part of the spend past 80 % in the status colour (so the ring says
  "this much of the spend is in the amber zone"). `token-meter` turned the *whole* meter amber from 80 %.
  One rule for both the hairline and the ring; this page proposes the share.
- **Stacking order.** Ana → Dee from the centre outward is the roster order; the manager might want the
  heaviest agent nearest the centre, which would change the order per week and break "colour follows the
  entity". Keep the roster order.
- **The pace band at day 19** is ±8 % of the pace, as usage-charts drew it; with only 13 weekdays in the
  average the band may be too narrow. Widen until two weeks are in?
- **Cache on the ring** is a dotted arc scaled to the plan, so a session that leans on the cache shows a
  long dotted arc *inside* a short fill: that is the point (the cache is beside the budget, not in it),
  but it needs the tooltip's "not counted" to be read once.
- **The glow in dark** needs .72 alpha where day needs .28; a translucent apricot over navy greys. If it
  still reads as a smudge at 1× on a real display, drop the glow at night and keep the ember and the
  breath, which carry the same meaning.
- The rail cut at 16 px (item 5) is untested here; the 24 px chip in the title row stays a hairline.
