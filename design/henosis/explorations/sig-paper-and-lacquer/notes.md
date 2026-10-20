# sig-paper-and-lacquer · Paper, lacquer, ink

The surfaces of Henosis as three materials. **Paper**: the cream canvas is a sheet of stock with a
faint grain, and everything written on it (bubbles, cards, the plan, a notice) is more paper laid on
paper: a white sheet, a warmer card stock, a label pressed into the board. **Lacquer**: every Dress
Blues surface (the rail, the agent's output block, the phone's bar, a toast) is glossy and smooth, a
170° sheen with a lit top edge and no grain, the one shiny object in a matte room. **Ink**: chocolate
is what the room writes with: the hand (Approve with 4, the send), the drawn rule under a title, the
risk label debossed into the stock, the stamp on a decision that landed (*United · 13:41*) whose ink is
broken by the grain of the sheet. The print stylesheet is the same paper: the printed page drops the
grain (the stock supplies its own), the wash and every shadow, turns the lacquer into the running
head's navy rule, keeps the hand and the stamp as ink, and keeps cream only under a quoted human
message and the gate.

Files: `index.html` (self-contained: tokens.css v5 / SYSTEM §2 and §16 values inlined, light and dark
via `prefers-color-scheme` and `[data-theme]`, every animation inside the one positive guard with
`prefers-reduced-motion: no-preference` and `:root:not([data-motion="calm"])`, clocks zeroed under Calm
and reduce, Fraunces and Inter asked for first with Instrument and the system faces as fallbacks, no
external assets, no fonts fetched, no external script); `light.png`, `dark.png` (1440×900, the session
as it opens); `light-now.png`, `dark-now.png` (`index.html#now`: the united notice with its stamp and
the release gate); `phone.png` (390×844: the lacquered bar over the paper); `print.png` (the page under
emulated `print` media, full height). The screenshots show the fallback faces (Instrument Serif,
Instrument Sans, JetBrains Mono): Fraunces and Inter are not on this machine and the page fetches
nothing.

## What it is

| Layer (bottom → top) | What | Value |
|---|---|---|
| Stock | the page | `--canvas #FBF7F1`, night `#1A202C` |
| Wash | the system's one apricot disc, blurred (SYSTEM §2.2's flat-pixel disc, unchanged) | `.paper::before`, `--wash` .35 / .10, blur 110 |
| Grain | a 240 px `feTurbulence` tile (0.82, 3 octaves, desaturated) as a data URI, repeated, at soft-light over everything on the sheet | `.paper::after`, `--grain-opacity` .085 / .12 |
| Sheet | a white card resting on the stock: a 1 px ring plus two low-alpha layers, never a heavy drop | `.sheet`: `--ring 0 0 0 1px --line` + `--rest 0 1px 2px .05, 0 4px 12px .05` + `--edge` at night |
| Card stock | a warmer, heavier sheet: the scope chip, the command, a rater chip | `.stock`: `--surface-2`, ring only |
| Pressed | a label debossed into the board: risk words, the Agent/Team segment track, the budget track | `.pressed`: `--surface-3`, `inset 0 1px 2px chocolate .25`, white text-shadow .55 by day |
| Floating | the one thing that leaves the sheet: the composer (and the palette, a toast) | `--float = --shadow-pop` |
| Lacquer | every navy surface | `.lacquer`: `--rail` + `linear-gradient(170°, white .13 → .035 at 38 % → 0 at 56 %)` + `inset 0 1px 0 white .14, inset 0 -1px 0 black .18` |
| Ink | the drawn rule, the hand, the stamp | `--rule` chocolate .22, `--rule-strong` .58; `.btn.primary`, `.send`; `.stamp` masked by a thresholded 140 px noise tile |

**Edges are cut, rules are drawn.** A card's edge is the navy hairline (`--line`, SYSTEM's), drawn as
a ring so it never moves layout. A line *under* something (the divider, the rule above the ratings,
the running head on paper) is chocolate: ink on the sheet, not a cut. The two never swap.

**One floating sheet per screen.** Only the composer takes `--shadow-pop`; cards rest with the ring and
the two 5 % layers; the rail and the output block cast nothing because lacquer is a finish, not a
height. In dark every raised sheet keeps the ring and adds `--edge` (SYSTEM §16), the rest shadows go
black at .28, the sheen drops to .085 and the grain rises to .12 so the night stock still reads as
stock, not as a flat grey.

**The stamp.** `.stamp` is a 2 px chocolate frame with the word in Inter 600 caps at .14 em, rotated
−4°, masked (`mask-mode: luminance`) by a coarser `feTurbulence` tile thresholded to a bitmap, so the
ink breaks where the stock is rough. One per screen, only on a decision that landed (united, approved,
denied); never on anything live. On paper the mask comes off and it prints solid.

**On the phone** the top block is lacquer (the 48 + 44 px bar on `--rail` with the sheen and lit edge),
the paper runs under it with the grain, and the composer is the one floating sheet.

**The inspector drawer** (Grain, Lacquer, Dark, Calm, Print; keys `g` `l` `d` `c`; the grain at 3×; the
nine layers with their values; the cost) is the element's own anatomy and is not part of the design.
The app ships the surfaces alone.

## Why it is ours

- **Three jobs stated once, as materials.** SYSTEM §1.1 gives the four colours four jobs; this makes
  the three surfaces three *things you can touch*: matte paper, glossy lacquer, wet ink. Nothing is a
  fifth colour and nothing is glass or glow. The reference memos name the move: "colour, texture and
  gloss instead of more hues" (three-colour-brands: Olga Fradina's dark rooms kept light by rough
  texture, Architect George's one blue in gloss, matte and velvet), and "lacquer is the one shiny
  surface, never everything" (Veere Grenney's ten coats of chocolate; the memo's element 7, *Navy
  lacquer for committed*, is where the sheen recipe comes from).
- **Navy stays dominant.** SYSTEM §1.10's distinctiveness guard: cream + chocolate + a serif alone sits
  next to claude.ai. Here the lacquered Dress Blues rail is the first thing on screen and the deepest
  object in the stream (the output block); apricot is spent only as the pulse (SYSTEM §1.2); chocolate
  is never lifted toward terracotta. The warm-editorial counter-camp is where Henosis lives
  (premium-product-ui) and the memo's warning is honoured: no tracked-out eyebrows, no italic-serif
  highlights, no stacked rounded outlines, no under-glows. What is left is a *printed* object, which
  neither Claude (flat ivory, no texture), ChatGPT (flat white) nor Linear (glow on black) is.
- **People and agents write on the same sheet.** generative-visuals' *Paper Grain* ("one sheet of
  paper that people and agents write on together") and three-colour-brands' *Paper-grain canvas* are
  the brief for the grain: it covers the human's bubble, the agent's prose and the team's wash alike.
  The agent's output block is the one thing that is not paper, and that is right: it is the machine's
  surface, lacquered like the rail it came from.
- **Depth without species.** premium-product-ui's *Paper-tinted hairline system* and *Surface ladder,
  not shadows* (hairlines drawn as a ring, shadows only on floating layers, Dani Asyrofi's
  `0 1px 2px + 0 4px 12px` at 4–5 % for "a physical object resting on a surface") and three-colour-
  brands' *Three-cream elevation* give the ladder; elevation marks importance, never who wrote it.
- **Ink pressed into the stock.** three-colour-brands' *Debossed labels* (Hatch's brown ink debossed
  into uncoated board) for the risk words and tracks, and its *Dithered transitions* (Grosz Co.Lab's
  bitmap so the stock shows through the ink) for the stamp's mask. The stamp is the print-export
  board's "the kernel's decisions in one ink" made physical.
- **Print is the same paper**, not a second theme: print-export's rules (white page, ink, cream only
  under a quoted human message and the gate, no apricot, no gradient, no shadow, the mark's cream
  variant) are kept, and the lacquer collapses to the one 2.5 pt navy rule of the running head.

## The technique

```css
/* the stock, the wash, the grain */
.paper { position: relative; isolation: isolate; background: var(--canvas); }
.paper::before { /* SYSTEM's blurred apricot disc, unchanged */ }
.paper::after  { content: ""; position: absolute; inset: 0; background-image: var(--grain);
                 background-size: 240px 240px; mix-blend-mode: soft-light;
                 opacity: var(--grain-opacity); pointer-events: none; z-index: 5; }
/* lacquer */
.lacquer { background-color: var(--rail); background-image: var(--lacquer-sheen);
           box-shadow: var(--lacquer-edge); }
/* paper on paper */
.sheet   { background: var(--surface); box-shadow: var(--ring), var(--rest), var(--edge); }
.pressed { background: var(--surface-3); box-shadow: var(--deboss); text-shadow: var(--deboss-text); }
/* ink */
.rule    { border-top: 1px solid var(--rule); }
.stamp   { border: 2px solid var(--stamp); color: var(--stamp); transform: rotate(-4deg);
           mask-image: var(--stamp-mask); mask-mode: luminance; mask-size: 140px 140px; }
```

- The grain is `url("data:image/svg+xml,…")`: an SVG with `feTurbulence baseFrequency .82,
  numOctaves 3, stitchTiles stitch` and `feColorMatrix saturate 0`, 430 bytes. The image decoder
  rasterises it once per `background-size` and the compositor repeats the bitmap; the filter never
  runs against the viewport (generative-visuals' cost rule: "grain is a tile, never a live filter";
  Gustavo Fior and Gradiently's measurement of `feTurbulence` on a hero). `baseFrequency` is never
  animated.
- Soft-light at .085 on cream moves a pixel by ±3 levels; on navy by ±1, which is why the lacquer
  needs no mask: the overlay covers the output block too and is invisible there. Measured on
  `light.png`: the canvas's luminance standard deviation is 6.8 / 255 (≈ 2.7 %, Gavin Nelson's "2 %
  monochrome noise" for Linear's renders, Arc's 2–3 %); the rail's is 2.85 and that is the sheen's
  slope, not grain.
- The sheen is a `background-image` on the navy surface, so it rides along with the Team look
  editor: `--team-surface` recolours `--rail` and the white-alpha sheen reads the same on any dark
  surface a lead picks. The lit edge is an inset shadow and stacks with `--edge`.
- `--ring` is `0 0 0 1px var(--line)`: a border that changes no layout (Vercel's ring). Every sheet
  carries `--ring, --rest, --edge`; `--edge` is `none` by day so the list stays one declaration.
- The stamp's mask is a second data URI (noise at .22, two octaves, `feComponentTransfer discrete`
  with table `0 1 1 1 1 1 1`, so ~14 % of the tile is ink-free). `mask-mode: luminance` is needed
  because an image mask defaults to alpha; both the prefixed and unprefixed properties are written.
- Colour reaches the mark's `<use>` only through `--mark-*` custom properties set on `.mark` and read
  by the symbol's presentation attributes (print-export's finding: page CSS cannot style inside the
  shadow tree). The card rule is `.agent:not(.avatar):not(.msg)` so it never reaches an agent's prose
  (SYSTEM §6); the first shot of this board had the agent's words cream-on-cream for exactly that
  reason.
- Print: `@media print` re-declares the tokens (`--canvas` white, `--surface-2/3` cream steps,
  shadows `none`, `--grain-opacity 0`, `--wash transparent`, lacquer off, `--deboss` a 1 px ink ring),
  hides the rail, the drawer, the composer and every button, lets `.scroll` grow, sets A4 with 16 mm
  margins, writes the running head as `.topbar::after` under a 2.5 px navy rule, and marks the two
  cream bands `print-color-adjust: exact`. Sheets lose their radius and become sections separated by
  one ink rule; `break-inside: avoid` keeps a plan with its ratings and a gate with its votes.

## The cost

| | |
|---|---|
| paint | one 240 px tile decoded once and repeated; one blended layer over `.main`. `mix-blend-mode` needs a stacking context: the app's `.main` already has `isolation: isolate`, so no new one |
| scroll | the overlay is `position: absolute; inset: 0` on `.main`, not on the scroller, so it is one fixed-size compositor layer; the stream scrolls under it. On a 2019 phone the blend is a GPU pass per frame; if a device shows it, `--grain-opacity: 0` on `(max-width: 480px) and (prefers-reduced-transparency)` is the first knob and loses nothing but texture |
| bytes | 0.6 kB for both data URIs; no images, no fonts |
| dark | the same tile; opacity .12; nothing recomputed |
| print | the overlay is `display: none`; the rest is token values |
| motion | none of its own. The page's motion is the system's (the running dot, the token weave, `card-in` on the gate), all inside the guard; under Calm every surface is identical |
| the stamp | one 140 px mask tile per stamp, decoded once; a screen never carries more than one |

## How it ports into apps/web

Everything is CSS; no component changes shape. In order:

1. **`apps/web/src/tokens.css`** · `:root` (≈ line 58, the canvas block) and both dark blocks (≈ 188
   and 222): add `--grain`, `--grain-opacity` (.085 / .12), `--stamp-mask`, `--ring`, `--rest`,
   `--float: var(--shadow-pop)`, `--rule` / `--rule-strong` (chocolate .22 / .58; at night
   `--accent-ink` at .28 / .62), `--lacquer-sheen`, `--lacquer-edge`, `--deboss`, `--deboss-text`,
   `--stamp`. Then:
   - **`.main::before`** (line 357, the wash) stays; add **`.main::after`** with the grain overlay
     above it (z-index 5, `pointer-events: none`). `.main` already has `isolation: isolate`.
   - **`.sidebar, .rail`** (line 328): `background-image: var(--lacquer-sheen); box-shadow:
     var(--lacquer-edge)`. `Rail.tsx:273` (`className="sidebar rail"`) needs nothing. The same two
     declarations on `.out` (the agent's output block), `.toast` and the phone's top bar in
     `styles.css`.
   - **`.card`, `.notice`, `.plan`, `.msg.human .text`, `.drawer .tile`**: replace `border: 1px solid
     var(--line); box-shadow: var(--shadow-soft)` with `box-shadow: var(--ring), var(--rest),
     var(--edge)` (and drop the border so the box does not grow by 2 px). **`.composer`** keeps
     `--shadow-pop` plus the ring: it is the floating sheet.
   - **`.pill.risk`, `.seg`, `.budget`, `.hair`**: add `box-shadow: var(--deboss); text-shadow:
     var(--deboss-text)`.
   - **`.divider::before/::after`**, the plan's rule above the ratings, `hr`: `var(--rule)` instead of
     `var(--line)`.
   - **`@media print`**: the app has none today (`grep print src/*.css` finds only a comment). Append
     the block from this board; the running head's text is composed from `copy.team.summary` and the
     session id, so the `::after` content becomes an element the SessionView renders only for print
     (`.print-head`, `display: none` on screen).
2. **`apps/web/src/ui.tsx`**: a `Stamp` ({ word, when }) rendering `<span class="stamp">`, used by
   `stream/ApprovalNotice.tsx` for a granted or denied gate and by `views/BranchCompare.tsx` for a
   unite that landed. One per screen; the component refuses to render inside a live notice.
3. **`apps/web/src/theme.ts`**: nothing. Calm already sets `data-motion`; the surfaces have no motion.
   The Team look editor's `--team-surface` recolours the rail and the sheen rides along; the editor's
   preview (`.prail`) takes the same two lacquer declarations.
4. **Mark**: the app's `Mark` in `ui.tsx` already paints through `--mark-*`; the print block sets
   `.mark { --mark-disc: #FBF7F1; --mark-arc-b: #2A3244 }` for the cream variant.

## Open questions

- The grain's opacity is tuned on a 1× sRGB panel. On a 2× P3 display the tile rasterises at 480
  device pixels and reads finer; is .085 still "faint" or should it step to .10 at `min-resolution:
  2dppx`?
- Should the grain stop at the Details drawer and the Team panel (white `--surface`, a sheet) or run
  under them as it does here? The board runs it everywhere on `.main`; the drawer in the app is
  inside `.main`, so it is grained, which argues for "one sheet".
- The stamp word set: *United*, *Approved*, *Denied*, *Returned* (a handoff that went back)? And does
  a stamp belong on the inbox row, or only on the notice in the stream?
- `--rule` as chocolate means a hairline under a title is warmer than the hairline around a card by
  design. Does the data-viz rule (gridlines near 10 % in Dress Blues) stay navy, or does a chart's
  baseline become an ink rule too?
- The output block is lacquer here (the machine's surface). The memos' *Shared ink* argues that
  nothing the agent does should look like a different material; the counter is SYSTEM §7's "the
  deepest surface on screen in both themes". Kept as lacquer; worth one more look beside the Ledger
  column board.
