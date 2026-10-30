# sig-paper-and-lacquer · Paper, lacquer, ink (second pass)

The surfaces of Henosis as three materials under one lamp. **Stock**: the cream page is a sheet of paper
with a faint tooth, and everything written on it is more paper laid on paper: a white sheet (a bubble, a
card, the plan, a notice, the drawer), a warmer card (a scope chip, the command), a label pressed into
the board (a risk word, the segment track, the budget track). **Lacquer**: every Dress Blues surface (the
rail, the agent's output block, the phone's top bar, the crewmate tile) is glossy, smooth and lit by the
same lamp, the one shiny object in a matte room. **Ink**: chocolate is what the room writes with: the hand
(Approve with 4, the send), the rule drawn under a title, and the **seal**, the mark in one ink pressed
at −4° on a decision that landed (*United · 14:03*), its ink broken by the tooth of the sheet. The print
stylesheet is the same paper: the printed page keeps the ink and the seal, drops the grain, the wash and
every shadow, collapses the lacquer into the running head's navy rule, and carries the stock's watermark
(the mark in one ink) in the foot.

This pass answers the three panels (`_judge-signature-1/2/3.md`): the grain now reads in a 1× still
(the first pass's .085 soft-light was invisible, and so would .11 have been, see *The technique*); the
grain lives in the stock, so a white sheet and the Details drawer stay smooth; the page no longer scrolls
48 px sideways; the title row's token chip and presence stack no longer collide; the stamp is one word
set (United, Approved, Denied, Returned), one per screen, only on the notice in the stream, and it now
carries the brand's own gesture; the inspector is hidden until `i`.

Files: `index.html` (self-contained: SYSTEM §2 / §16 values inlined; light and dark via
`prefers-color-scheme` and `[data-theme]`; every animation inside MOTION §3's one positive guard,
`prefers-reduced-motion: no-preference` and `:root:not([data-motion="calm"])`, clocks zeroed under Calm
and reduce; Fraunces and Inter asked for first with Instrument and the system faces behind them; no
asset fetched, no external script); `light.png`, `dark.png` (1440 × 900, the session as it opens, Details
open); `phone.png` (390 × 844 at `#now`: the lacquered bar over the paper, the seal, the team wash);
`print.png` (the page under emulated `print` media, full height). The stills show the fallback faces
(Instrument Serif, Instrument Sans, JetBrains Mono): Fraunces and Inter are not on this machine and the
page fetches nothing, which is the whole wave's open decision for SYSTEM §3, not this board's.

## What it is

| Layer (bottom → top) | What | Value |
|---|---|---|
| Lamp | one light, top-left, above the sheet; everything with a direction derives from it | `--lamp: 18% -10%` |
| Stock | the page, with the lamp's wash where it falls | `--canvas #FBF7F1` (night `#1A202C`) + `radial-gradient(1200px 600px at var(--lamp), apricot .35 / .10)` |
| Grain | in the stock, under the writing: a 240 px `feTurbulence` tile folded to toner, blended with the page's own background | `.main::before` at `z-index: -1`, `multiply` .22 by day, the inverted tile at `screen` .20 by night, −.02 at `2dppx` |
| Sheet | a white sheet resting on the stock: a navy ring and two warm 6 % layers; never a drop | `.sheet`: `--ring 0 0 0 1px --line` + `--rest 0 1px 2px, 0 4px 12px chocolate .06` + `--edge` at night |
| Card | a warmer, heavier sheet: the scope chip, the command, a rater chip | `.card-stock`: `--surface-2`, ring only |
| Pressed | a label debossed into the board: risk words, the segment track, the budget and the token hairline | `.pressed`: `--surface-3`, `inset 0 1px 2px chocolate .25`, white text-shadow .55 by day |
| Floating | the one sheet that leaves the page: the composer (and the palette, a toast) | `--float = --shadow-pop` |
| Lacquer | every navy surface; a finish, not a height: it casts nothing | `.lacquer`: `--rail` + `linear-gradient(170°, white .13 → .035 at 38 % → 0 at 56 %)` + `inset 0 1px 0 white .14, inset 0 -1px 0 black .18` |
| Ink | the drawn rule, the hand, the seal | `--rule` chocolate .22 / `--rule-strong` .58; `.btn.primary`, `.send`; `.seal` |

**One lamp.** The wash sits where the lamp falls on the stock; the lacquer's sheen is the same lamp caught
on gloss, which is why it runs at 170° (top-left to bottom-right) rather than straight down; every rest
shadow falls down and to the right of what casts it; a pressed label is dark along its top edge. The
three judge panels found six pages inventing "a lamp at the top-left" with six alphas; this board names
it once as a token so the surfaces patch can carry one lamp.

**The grain is in the stock, not over the writing.** A `z-index: -1` pseudo-element blended with the
page's own background inside `.main`'s isolated stacking context. Everything *laid on* the stock (a
sheet, a lacquered block, the drawer, the composer) is smooth by construction; everything that is a
*wash on* the stock (the team message, the live step, the selected row) shows the tooth through.
Measured on `light.png`: the bare stock's luminance spreads 4.0 levels (sd) and its mean moves 3; the
human sheet, the output block, the rail and the drawer all measure 0.0. By night the stock spreads 3.2
and the output block 0.0. The judge's fix ("stop the grain at the Team panel and Details drawer so a
white sheet stays a sheet") becomes the rule for every sheet, with no selector list to maintain.

**Edges are cut, rules are drawn.** A sheet's edge is the navy hairline (`--line`, SYSTEM's), drawn as a
ring so it moves no layout. A line *under* something (the divider, the rule above the ratings, the
drawer's section rules, the running head on paper) is chocolate: ink on the page, never a cut. The
drawer shows both at once: its left edge is cut, its sections are ruled.

**One floating sheet per screen.** Only the composer takes `--shadow-pop`; cards rest on the ring and the
two 6 % layers; the rail, the output block and the crewmate tile cast nothing because lacquer is a finish,
not a height. In dark every raised sheet keeps the ring and adds `--edge` (SYSTEM §16), the rest shadows
go black at .28, the sheen drops to .085 (the lamp is lower at night), the seal takes `--accent-ink`.

**The seal.** `.seal` is the mark in one ink (`#mark-ink`: SYSTEM §2.10's `.mark-ink`, the person's arc
solid, the agent's arc dotted, the centre solid) beside the word in Inter 600 caps at .14 em and the time
in mono, inside a 2 px frame with a 1 px inner line, rotated −4°, masked (`mask-mode: luminance`) by a
coarser `feTurbulence` tile thresholded to a bitmap (8.5 % of the tile is bare), so the ink breaks where
the stock is rough. It lands once with `press` (1.12× and 3° off, 320 ms, `--ease-arrive`) when the
decision arrives, and rests at exactly its natural styles. One per screen; one word set: **United**
(a unite that landed), **Approved** and **Denied** (a gate decided; Denied in `--danger-ink`), **Returned**
(a handoff that went back; `--warn-ink`); only on the notice in the stream, never on an inbox row, never
on anything live. On paper the mask comes off and it prints solid.

**The watermark.** The stock is Henosis stock: the mark in one ink at 55 % in the foot of every printed
page beside "Henosis stock · printed 29 Oct 2026 · verify with henosis verify 0c8d44", the way a mill's
watermark says whose paper this is. On screen it does not appear; paper shows its watermark when it is
held to the light, and print is that moment.

**On the phone** the top block is lacquer (the 48 + 44 px bar on `--rail`, the same sheen, the same lit
edge), the paper runs under it with the tooth, the team wash shows the tooth through, and the composer is
the one floating sheet. `phone.png` is shot at `#now` so the seal is in frame.

**The inspector** (`i`: Grain, Lacquer, Dark, Calm, Print; keys `g` `l` `d` `c`; the stock at 3×; the four
seals; the layer legend) is the element's own anatomy and is not part of the design; it is hidden by
default so no still shows a topbar the product will never have. The app ships the surfaces alone.

## Why it is ours

- **The brief's four jobs as three things you can touch.** SYSTEM §1.1 gives the colours jobs; here
  the frame is lacquer, the page is paper, the hand is ink, and apricot is spent only as the pulse (the
  wash, the live step, the count, the quorum segment). Nothing is a fifth colour, nothing is glass, no
  glow. The memos name the move: "colour, texture and gloss instead of more hues" (three-colour-brands:
  Fradina's dark rooms kept light by rough texture; Grenney's ten coats of chocolate; Home Stratosphere's
  one lacquer wall that "multiplies light" while the other walls stay matte; Derek Guy: within a narrow
  range vary "texture, fibre and sheen" instead of colour). Element 1 *Toothy cream stock* and element 6
  *Lacquer card* of that memo are the stock and the lacquer here; its element 7's `color-mix` linen is
  not used because SYSTEM's `--ink-2` already clears 4.5 : 1.
- **The seal is the mark's gesture made physical.** The panels asked whether a signature "comes from
  the mark rather than from a trend". A stamp is a trend; a seal that is the closed ring in one ink,
  pressed only when two arcs' worth of people have said yes, is Henosis saying "this landed" in its own
  handwriting. It is print-export's "the kernel's decisions in one ink" and SYSTEM §5's `#mark-mono`
  cut, used on screen for the first time; ai-interfaces-avoid's rule holds (no badge, no sparkle: the
  seal marks an outcome, never an author). The watermark is the same cut on paper.
- **Navy stays dominant** (SYSTEM §1.10's distinctiveness guard). The lacquered rail is the first thing
  on screen and the deepest object in the stream; chocolate is never lifted toward terracotta;
  premium-product-ui's warning is honoured (no tracked-out eyebrows, no italic-serif highlights as
  decoration, no stacked rounded outlines, no under-glows). What is left is a *printed* object, which
  neither Claude (flat ivory, no texture), ChatGPT (flat white) nor Linear (glow on black, "elevation is a
  lightness step") is. Jim Nielsen's "beige, orange accents, serif" clichés are the camp Henosis lives in;
  the texture, the lamp and the seal are structure, which is where the memo says distinctness must come
  from.
- **People and agents write on the same sheet.** generative-visuals' *Paper Grain* ("one sheet of paper
  that people and agents write on together") is kept as the stock under everyone; the human's sheet, the
  agent's prose and the team's wash sit on the same tooth, and the one thing that is not paper is the
  agent's output block, which is right: it is the machine's surface, lacquered like the rail it came
  from (SYSTEM §7: "the deepest surface on screen in both themes").
- **Depth without species.** premium-product-ui's *One edge, three layers* (ring + contact + ambient,
  chocolate-tinted, never black, "draw each border once") and *Materials ladder* give the sheet; its
  "elevation marks importance, never who wrote it" is why a human bubble and a plan card share one
  edge. three-colour-brands' *Debossed labels* (Hatch's brown ink pressed into uncoated board) for the
  risk words and tracks, and its *Dithered transitions* (Grosz Co.Lab's bitmap so the stock shows
  through the ink) for the seal's tooth.
- **Print is the same paper**, not a second theme (print-export, SYSTEM §2.10): white page, ink, cream
  only under a quoted human message and the gate, no apricot, no gradient, no shadow, the cream mark;
  the lacquer collapses to the one 2.5 px navy rule of the running head. editorial-type's *Registration
  ticks* (Stripe Press's print vocabulary) were considered for the gate and set aside: the watermark and
  the running head are enough print on one page.

## The technique

```css
/* one lamp */
:root { --lamp: 18% -10%; --wash-paint: radial-gradient(1200px 600px at var(--lamp), var(--wash), transparent 60%); }
/* the stock: wash and canvas as the app paints them; the grain IN the stock */
.main { position: relative; isolation: isolate; overflow: clip; background: var(--wash-paint), var(--canvas); }
.main::before { content: ""; position: absolute; inset: 0; z-index: -1; background-image: var(--grain);
                background-size: 240px 240px; mix-blend-mode: var(--grain-blend); opacity: var(--grain-alpha); pointer-events: none; }
/* lacquer */
.lacquer { background-color: var(--rail); background-image: var(--sheen); box-shadow: var(--lacquer-edge); }
/* paper on paper */
.sheet { background: var(--surface); box-shadow: var(--ring), var(--rest), var(--edge); }
.pressed { background: var(--surface-3); box-shadow: var(--deboss); text-shadow: var(--deboss-text); }
/* ink */
.rule { border-top: 1px solid var(--rule); }
.seal { border: 2px solid var(--seal); color: var(--seal); transform: rotate(-4deg);
        mask-image: var(--tooth); mask-mode: luminance; mask-size: 140px 140px; }
.seal::before { content: ""; position: absolute; inset: 2px; border: 1px solid var(--seal); border-radius: 4px; }
```

- **Why not soft-light.** The first pass laid the grain at `soft-light` .085 and the judges could not see
  it; their fix was .11. Measured here, `soft-light` at .11 on `#FBF7F1` moves a pixel by 0.16 levels
  (sd), because soft-light on a near-white base has almost no room: at full strength it ranges −7 … +3
  levels, and at .11 that is under one. No opacity makes it visible without making it a different blend.
  The stock therefore takes the tile at **`multiply`** (toner on paper), with the noise *folded* so only
  the half below mid-grey darkens: `feComponentTransfer` table `.3 .65 1 1 1`, so a pixel at noise 0
  darkens to .3, at .25 to .65, and above .5 not at all. At .22 the cream spreads 4.0 levels (Gavin
  Nelson's "2 % monochrome noise" is 5) and its mean moves 3 (`#FBF7F1` reads `#F8F4EE`). The night tile
  is the same noise inverted (`feColorMatrix -1 … 1`) and laid at **`screen`** .20: light fibres on the
  dark stock, 3.2 levels of spread, the mean up 2. At `2dppx` both step down .02 because the tile
  rasterises at 480 device pixels and reads finer.
- The tile is `url("data:image/svg+xml,…")`: `feTurbulence baseFrequency .8, numOctaves 3,
  stitchTiles stitch`, `feColorMatrix saturate 0`, the fold, and `feFuncA table 1 1` so the alpha is
  opaque and the opacity knob is one number; `color-interpolation-filters="sRGB"` so the fold is
  applied to the values the compositor will blend. 0.9 kB for both tiles. The image decoder rasterises
  it once per `background-size` and the compositor repeats the bitmap; the filter never runs against the
  viewport (generative-visuals' cost rule: "grain is a tile, never a live filter"; Fior's and Gradiently's
  measurements of live `feTurbulence` on a hero). `baseFrequency` is never animated.
- **Under, not over.** A `z-index: -1` child of an `isolation: isolate` element blends with that
  element's own background, so the grain is part of the stock and never needs a selector list of things
  to stop at, never needs `pointer-events: none` on top of buttons, and never puts the composer under an
  overlay. The first pass's `.main::after` at `z-index: 5` was a compositor layer over every sheet; this
  is one layer under them.
- The sheen is a `background-image` on the navy surface, so it rides along with the Team look editor:
  `--team-surface` recolours `--rail` and the white-alpha sheen reads the same on any dark surface a
  lead picks. The lit edge is an inset shadow and stacks with `--edge`.
- `--ring` is `0 0 0 1px var(--line)`: a border that changes no layout (Vercel's ring). Every sheet
  carries `--ring, --rest, --edge`; `--edge` is `none` by day so the list stays one declaration.
- The seal's mask is a second data URI: noise at .34, two octaves, `feComponentTransfer discrete` with
  table `0 0 0 1 1 1 1 1`, measured at 8.5 % bare. `mask-mode: luminance` is needed because an image
  mask defaults to alpha; both the prefixed and unprefixed properties are written. The mark inside the
  seal is `<use href="#mark-ink">` with `currentColor`, so one `--seal` colours frame, word, time and
  mark; print-export's finding (page CSS cannot reach inside a `<use>`) is honoured by never styling
  `.arc` through the symbol.
- The title row: `.topbar .right > * { flex: none }` with a 12 px gap and the title as the one thing
  that gives way (`flex: 1 1 auto; min-width: 0`), the collision the second panel found in three pages
  fixed once.
- Print: `@media print` re-declares the tokens (`--canvas` white, `--surface-2/3` cream steps, shadows
  `none`, `--grain-alpha 0`, `--wash-paint none`, sheen and edge off, `--deboss` a 1 px ink ring, the
  seal's mask off), hides the rail, the drawer, the composer, every button and the inspector, lets
  `.scroll` grow, sets A4 with 16 mm margins, writes the running head as `.topbar::after` under a 2.5 px
  navy rule, marks the two cream bands `print-color-adjust: exact`, and shows the `.watermark` foot.
  Sheets lose their radius and become sections separated by one ink rule; `break-inside: avoid` keeps a
  plan with its ratings and a gate with its votes.

## The cost

| | |
|---|---|
| paint | one 240 px tile decoded once and repeated; one blended layer *under* `.main`'s content, not over it; `.main` already isolates in the app, so no new stacking context |
| scroll | the layer is `position: absolute; inset: 0` on `.main`, not on the scroller, so it is one fixed-size compositor layer and the stream scrolls over it; on a 2019 phone the blend is a GPU pass per frame on a layer nothing paints over, which is the cheap case; if a device shows it, `--grain-alpha: 0` under `(max-width: 480px) and (prefers-reduced-transparency)` is the first knob and loses nothing but texture |
| bytes | 0.9 kB for the three data URIs (day tile, night tile, tooth); no images, no fonts |
| dark | a second tile (the inverted one) at `screen`; nothing recomputed per frame |
| print | the layer is `display: none`; the rest is token values |
| motion | 10 animations at rest (four running dots, the title's status dot, the token hairline's weave, three `card-in` rises, one `press`); **0 under Calm, 0 under reduce**, measured; every end state is the element's natural style |
| the seal | one 140 px mask tile per seal, decoded once; a screen never carries more than one |
| overflow | `scrollWidth` 1440 at 1440 and 390 at 390 (the first pass's 48 px and 31 px are gone) |

## How it ports into apps/web

Everything is CSS plus one small component; no component changes shape. In order:

1. **`apps/web/src/tokens.css`** · `:root` (≈ line 58, the canvas block) and both dark blocks (≈ 188
   and 222): add `--lamp`, `--grain` / `--grain-night`, `--grain-blend` (`multiply` / `screen`),
   `--grain-alpha` (.22 / .20, with the `2dppx` step), `--tooth`, `--ring`, `--rest`, `--float:
   var(--shadow-pop)`, `--rule` / `--rule-strong` (chocolate .22 / .58; at night `--accent-ink` at .28 /
   .62), `--sheen`, `--lacquer-edge`, `--deboss`, `--deboss-text`, `--seal`. Then:
   - **`.main`** (line 363) keeps its `background: var(--canvas-wash), var(--canvas)` and its
     `isolation: isolate`; add **`.main::before`** with the grain layer at `z-index: -1`, and
     `overflow: clip`. `.main::before` is free: the L7 blurred disc that used it is gone (line 357's
     comment). Because the layer is under the content, the Details drawer and the Team panel inside
     `.body` are smooth with no further rule.
   - **`.sidebar, .rail`** (line 329): `background-image: var(--sheen); box-shadow: var(--lacquer-edge)`.
     `Rail.tsx:273` (`className="sidebar rail"`) needs nothing. The same two declarations on **`.out,
     .step-out`** (line 463), **`.toast`** (line 643), **`.drawer .tile`** (`styles.css` 406) and the
     phone's top bar in `styles.css`.
   - **`.card`** (606), **`.notice`** (473), **`.plan`** (496), **`.msg.human .text`** (450),
     **`.composer`** (552): replace `border: 1px solid var(--line); box-shadow: var(--shadow-soft),
     var(--edge)` with `box-shadow: var(--ring), var(--rest), var(--edge)` and drop the border so the
     box does not shrink by 2 px (the second panel's one caution: do it in one pass with the padding
     checked). `.composer` keeps `--shadow-pop` plus the ring: it is the floating sheet.
   - **`.pill.risk`** (519), **`.seg`** (560), **`.hair`** (545), the plan's `.budget`: add `box-shadow:
     var(--deboss); text-shadow: var(--deboss-text)`.
   - **`.divider::before/::after`** (465), the plan's rule above the ratings, the drawer's section
     borders, `hr`: `var(--rule)` instead of `var(--line)`.
   - **`.topbar`** (364): `.topbar .right > * { flex: none }`, gap 12, title `flex: 1 1 auto; min-width: 0`.
2. **`apps/web/src/print.css`** already owns the Export panel's paper (`.paper`, A4, the running head,
   the cream bands, `.mark-ink`), so the exploration's `@media print` block does not land as a second
   stylesheet: the session's print path is the Export panel's document. Two things do land there: the
   `.seal` prints solid (`mask-image: none`) wherever a decision row is printed, and the `.watermark`
   foot (the `#mark-ink` cut at 55 % beside "Henosis stock · printed … · verify …") is added to the
   paper's last page. The watermark's text is composed from `copy.team.summary` and the verify hash
   `print.ts` already computes (line 191).
3. **`apps/web/src/ui.tsx`**: a `Seal({ word, when, tone })` rendering `<span class="seal">` with the
   `#mark-ink` symbol (`Mark` already inlines the symbols; add the one-ink cut from SYSTEM §5's
   `#mark-mono`). Used by **`stream/ApprovalNotice.tsx`'s `Decided`** (line 371: the granted / denied
   divider; the seal sits at the right of the sentence, Approved or Denied), by **`views/BranchCompare.tsx`**
   (line 148: "United {other} into {here}"), and by the handoff notice when a handoff is returned. One
   per screen: the component refuses to render inside a live notice, and the stream shows the newest
   seal only when two decisions land in one viewport (the older keeps its sentence).
4. **`apps/web/src/theme.ts`**: nothing. Calm already sets `data-motion`; the seal's `press` sits inside
   the one guard and its rest state is its natural style. The Team look editor's `--team-surface`
   recolours the rail and the sheen rides along; the editor's preview (`.prail`) takes the same two
   lacquer declarations.
5. **Mark**: the app's `Mark` already paints through `--mark-*`; the one-ink cut reads `currentColor`
   and needs no new property.

## Open questions

- The alphas are tuned on a 1× sRGB panel and stepped by .02 at `2dppx`; a P3 panel at 2× has not been
  looked at. The right check is one still on a MacBook with the inspector's "stock at 3×" crop.
- The stock's mean moves 3 levels under the toner (`#FBF7F1` reads `#F8F4EE`). The alternative is to
  lift `--canvas` 3 levels so the *grained* page lands on `#FBF7F1`; the surfaces patch should decide
  which value is the one the brand board names.
- The seal word set: United, Approved, Denied, Returned. Does a plan approved by the team's ratings
  (not by an owner) take Approved, or is the seal only for the gate and the unite?
- `--rule` as chocolate means a hairline under a title is warmer than the hairline around a card by
  design. The data-viz rule (gridlines near 10 % in Dress Blues) stays navy; a chart's baseline is a cut,
  not a rule, under this board's reading.
- The output block is lacquer (the machine's surface). The memos' *Shared ink* argues nothing the agent
  does should look like a different material; the counter is SYSTEM §7's "the deepest surface on screen
  in both themes". Kept as lacquer; worth one more look beside the Ledger column board.
- Whether the watermark belongs on screen anywhere: the one candidate is the empty session (the verb
  shelf), where the stock is bare and a watermark would say whose paper this is before anyone writes.
