# sig-night-mode · The night has a horizon

Second pass. The first pass (judged 8.0 / 8.25, "ship with the lifted hand") was a careful re-weighing of the
v5 dark block with one real idea, *the shadow is chocolate*. This pass keeps that idea and gives the night a
shape of its own: **a room with a horizon**. Dress Blues is the sky and everything you *read* hangs in it.
Chocolate is the ground and everything you can *touch* stands on it: the composer, the me row, the phone's
tab bar, and every hand (a chocolate button is a piece of the ground lifted into the sky). Apricot is the one
lamp, hung over the table, so every lit edge, hairline, count and pulse is the same light. The horizon is one
hairline that runs at the same height across the rail and the page; by day it is a quiet desk edge.

The judges' three fixes are in: the hand ships as SYSTEM's `#7A4B3E` with the lit edge on top (the lower
`#6B4339` is kept for shadows and the ground only, and the sheet shows both in the approvals column); the
toasts region is anchored above the horizon, right-aligned at 360 px, so it can never cover a notice's
command or Approve row; and the specimen lane carries six primaries in a column so the hand's fill is
judged on the queue, not on a specimen.

Files: `index.html` (self-contained, 87 KB with the grain tile inline; the v5 light values in `:root`, the
night byte-identical under `prefers-color-scheme: dark` and `[data-theme="dark"]`; every animation inside
`@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }` with the clocks
zeroed under Calm and reduce and every rest state written outside; Fraunces / Inter asked first with
Instrument and the system faces behind them, nothing fetched), `light.png`, `dark.png` (1440 × 900, the
session opened at *now*), `phone.png` (390 × 844, the night on the phone with the four-tab bar standing on
the ground).

The sheet is the app's shell with every component on it: the rail (brand, New session, Search, Inbox and
Approvals with counts, the crew, agent cards in five states, the project rows, a chat, the me row on the
ground); the title row (serif title, status with turn, Team pill, token chip with its hairline and spending
dot, presence stack with the driver ringed, Team / Details); the stream (a join line, a human message with
its Goal and scope chip, an agent message with steps, the live step and the output block, a team message
with a mention, a contention notice, the plan card with four step states, risk pills, the budget with its
estimate and 80 % ticks, the rating control with its tick and word, raters and decisions, the release gate
with its command, votes, quorum and actions, the *now* divider); the composer on the ground; and the specimen
lane (the three-place ladder, the hand in a column, buttons, chips, segment, switch, checkbox, field, keys,
pills, counts, mentions, status dots, avatars and stack, the five loaders, a stat tile with its spark-word,
keyboard-selected rows, a toast). The Day / Night / Sys segment and the Calm button in the lane's head are
the page's inspector (keys `d`, `c`), not part of the design.

## What it is

| Place | Role | By day (v5, unchanged) | By night | What it does |
|---|---|---|---|---|
| **Sky** | `--rail` · `--canvas` · `--surface` · `--surface-2` · `--surface-3` | Dress Blues · cream · white · cream-2 · cream-3 | `#0C1019` · `#121826` · `#1A2131` · `#222A3C` · `#2A3244` | Dress Blues' own ramp (hue 222°, saturation held at 33–36 % so it never greys); the pressed step is Dress Blues itself; everything you read sits in it |
| **Ground** | `--ground` · `--ground-2` · `--out-bg` | `#F4EEE5` · `#ECE3D6` · navy | **`#140F0E` · `#1E1613` · `#140F0E`** | chocolate-black: the band under the composer, the rail's foot, the phone's tab bar, and the agent's output block (a patch of ground inside the sky: the agent's work is grounded) |
| | `--shadow-soft` / `--shadow-pop` | navy 8 / 16 % | **chocolate-black 50 / 65 %** | a shadow is the ground showing through; nothing on the night casts black |
| | `--accent` (the hand) | `#56352D` | `#7A4B3E` + `--hand-edge` apricot 45 % + `--hand-rim` apricot 22 % | the hand is a piece of the ground lifted into the sky and lit on its top edge |
| | `--accent-ink` | chocolate | `#CAA49B` | the hand as text (7.9 : 1) |
| **Horizon** | `--horizon` / `--horizon-rail` | navy 16 % / cream 14 % | **apricot 24 %** | one hairline, `--ground-h` (136 px) from the bottom, across the rail and the page |
| **Light** | `--lamp` | the v5 wash, top-left (daylight from the window) | `radial-gradient(1100px 620px at 50% -6%, apricot 30 %, transparent 62%)` on `.main::before` | one lamp, hung over the table; the title row is 62 % canvas so the lamp shows through it |
| | `--dusk` | none | `linear-gradient(to top, chocolate 34 % at the horizon, transparent 280px above)` | the sky warms toward the ground, which is what makes the horizon a horizon |
| | `--edge` | none | `inset 0 1px 0 apricot 14 %` | the lamp caught on the top edge of every raised surface |
| | `--line` | navy 12 % | apricot 11 % | hairlines are lit, not drawn |
| | the pulse | apricot-deep, 30 % washes | apricot, 16 % washes, `--live-line` 35 %, the Team pill as apricot text on an 18 % wash | unchanged in meaning (SYSTEM §2.5) |
| | `--ink` · `--ink-2` · `--ink-3` | navy inks | `#F2E9DD` · `#C4BAAE` · `#9A948C` | apricot-tinted cream, never white, never a cool grey |
| | `--rail-muted` | `#AEB4C2` | `#A39D95` | the rail's second voice warms with the rest (7.1 : 1) |
| | `--gradient-brand` | navy → chocolate | **navy → chocolate, the daytime one** | on `#121826` the true pair reads at full strength; the lifted `#3A4661 → #7A4B3E` is no longer needed |
| | the paper | a 160 px `feTurbulence` tile at soft-light, 5 % | the same tile at 7 % | one sheet in both themes |
| | status | the day triplet | `#9BC88F / #E2B06A / #E2847A`, softs 18 % | SYSTEM §2.7, unchanged |
| | the mark's disc | `#2A3244` | `#2A3244` | held (SYSTEM §5) |
| | `--focus-ring` | chocolate | cream ink | never the pulse |

Contrast, measured on the night (canvas `#121826`, surface `#1A2131`, ground `#140F0E`): ink 14.8 : 1,
ink-2 9.3, ink-3 5.9 (5.4 on a surface; metadata only, 12 px floor), accent-ink 7.9 / 7.1, apricot as text
10.7, the count's ink on apricot 7.7, the hand's text on the hand 6.9, the hand's lit edge on a surface 4.6,
the status triplet 8.5 / 8.2 / 6.0 on a surface, rail-muted on the rail 7.1, ground ink on the ground 15.8,
ground-muted 8.1, the Team pill's text on its wash 6.4. By day the rail's ground band carries rail-fg at
12.5 : 1 and rail-muted at 7.0.

## Why it is ours

- **Three colours, three places.** three-colour-brands' closing rule for dark ("deepened canvas, apricot-tinted
  ink, navy as the lit surface; never grey, never blue-black") is kept, and its interiors give the geometry:
  Homestyler's "navy serves as an anchoring colour, adding weight to the room while showcasing peach
  accents", Rampley's "darker below, lighter above, brighter on top", VELA's 0.5 pt horizon rule that recurs
  "just enough to become a signature". Darker below is the chocolate ground, lighter above is the navy sky,
  brightest on top is the lamp, and the horizon is the rule. Every value on the night derives from one of
  the three (SYSTEM principle 1); there is no fifth colour and no neutral.
- **The ground is the thing no one else has.** Claude's dark mode is a warm near-black, Linear's is `#010102`
  with an indigo glow, ChatGPT's is a grey ladder; all of them are one material. A navy room standing on
  chocolate earth, with the composer, the me row and every button made of the ground, is a night that only
  this palette can make, and the rule is a sentence a team can repeat: *sky is what you read, ground is what
  you can touch*. It also makes SYSTEM principle 4 ("the hand is a verb") visible at night: the hand is the
  ground's colour because the ground is where hands go.
- **One lamp, hung over the table.** premium-product-ui: "depth from light and tone, not drop shadows",
  edges as light (Raycast's `inset 0 1px` sheen), "dimmed rail, lit session". The lamp sits over the stream,
  not in a corner, so the session is lit and the rail is the dark of the room; glass-rail's lamp can stay
  the rail's own small light or share this one. The dusk under the lamp is the opposite warmth, rising from
  the ground: the sky is lit from above and warmed from below, which is how a room at night actually looks.
- **The horizon is the join.** It is one straight line through the rail and the page at the same height,
  and the two things that stand on it are the two things a person does in Henosis: write to the circle
  (the composer) and be in it (the me row). On the phone the four tabs stand on it too. editorial-type's
  registration ticks and ai-interfaces-avoid's "composer as a bottom rule" argue for the composer as a
  structural line rather than a floating pill; here the line is the ground's edge.
- **Rest is the end state** (MOTION §1, §3). The lamp fades up over 500 ms on a theme change (`lamp-on`,
  inside the guard); under Calm it is simply on. The join line's mark is a resting `<use>`; the moving mark
  lives only in the loaders strip. Measured: 20 running animations at rest (the loaders, the running dots,
  the spending dot, the toast's life line), 0 under Calm, in both themes; 2 on the phone.
- **Type and numerals.** Names in Fraunces with `"SOFT" 50, "WONK" 0`, tuned by ground not author (dark
  takes `"opsz" 9, "SOFT" 100`, editorial-type §3); what is read in Inter with `calt` and `case`; spend and
  counts in tabular mono with a slashed zero; the tile's spark-word carries a team-normal band and an
  apricot last point (data-craft §1, §2, §9); the output block nests at `radius-lg − 13px`
  (premium-product-ui §3).
- **Distinctiveness guard** (SYSTEM principle 10): navy dominant, chocolate never lifted toward terracotta,
  no purple, no sparkle, no glow-on-black; the ground is the darkest thing and it is warm.

## The technique

```css
/* the three places, by night (once under the media query, once under the attribute) */
--canvas: #121826; --surface: #1A2131; --surface-2: #222A3C; --surface-3: #2A3244;
--ground: #140F0E; --ground-2: #1E1613; --out-bg: #140F0E;
--ground-rail: #140F0E; --ground-rail-ink: #F2E9DD; --ground-rail-muted: #B3A79D;
--horizon: rgba(226,196,166,.24); --horizon-rail: rgba(226,196,166,.24); --ground-h: 136px;
--lamp: radial-gradient(1100px 620px at 50% -6%, rgba(226,196,166,.30), transparent 62%);
--dusk: linear-gradient(to top, rgba(86,53,45,.34) var(--ground-h), transparent calc(var(--ground-h) + 280px));
--line: rgba(226,196,166,.11); --edge: inset 0 1px 0 rgba(226,196,166,.14);
--shadow-soft: 0 10px 30px rgba(20,15,14,.5); --shadow-pop: 0 18px 50px rgba(20,15,14,.65);
--accent: #7A4B3E; --hand-edge: rgba(226,196,166,.45); --hand-rim: rgba(226,196,166,.22);

/* the sky and the lamp */
.main { position: relative; isolation: isolate; background: var(--canvas); }
.main::before { content: ""; position: absolute; inset: 0; z-index: -2; background: var(--lamp), var(--dusk); }
.main::after  { /* the paper: a 160 px feTurbulence tile, soft-light, var(--grain-alpha) */ }
/* the ground: the composer stands on it; its top edge is the horizon */
.composer-wrap { position: sticky; bottom: 0; height: var(--ground-h); padding: 16px var(--gutter) 0;
                 background: var(--ground); border-top: 1px solid var(--horizon); }
.composer-wrap::before { /* 48 px fade above the horizon so words settle before they reach it */ }
/* the rail's foot: the same band, the same line, drawn by the rail's own background */
.rail { background: linear-gradient(to top, var(--ground-rail) 0 var(--ground-h),
                    var(--horizon-rail) var(--ground-h) calc(var(--ground-h) + 1px), transparent 0), var(--rail); }
.rail .ground { margin-top: auto; height: var(--ground-h); color: var(--ground-rail-ink); }
/* the hand: a piece of the ground, lit on top */
.btn.primary, .send, .kbd.live, .rail .new { box-shadow: inset 0 1px 0 var(--hand-edge), 0 0 0 1px var(--hand-rim); }
.toasts { position: absolute; right: 20px; bottom: calc(var(--ground-h) + 16px); width: 360px; }
```

- The horizon is one number, `--ground-h`, read by the rail's background, the composer wrap and the toasts
  region, so the line cannot drift between the two columns (measured: both at y = 764 in a 900 px window).
  The phone sets it to 196 px so the tab bar fits under the composer.
- The lamp and the dusk are two gradients in one `background` list on one pseudo-element; nothing runs per
  frame (the L7 measurement that retired the blurred disc stands: gradients scroll at the frame tick).
- The grain is a 160 px SVG tile rasterised once and repeated (generative-visuals §3, "grain is a tile,
  never a live filter").
- `--edge` and `--hand-edge` are zero-blur inset shadows, which Chromium paints as fills, landing on one
  device-pixel row at 1× and 2×.
- The ladder reads its hexes from `getComputedStyle` at runtime, so it prints the day values by day and the
  night values by night; it is a picture of the tokens, not a copy.
- Colour reaches a `<use>` only through custom properties; the moving mark is inlined so the `.arc` and
  `.dot` keyframes apply.

## The cost

- **The ground and the sky are the same darkness.** `#140F0E` against `#121826` is 1.07 : 1 by luminance;
  they are told apart by hue (warm against cool), by the horizon hairline (1.7 : 1 against either) and by
  the dusk above it. On a poorly calibrated panel the band could read as "slightly different black". The
  honest alternative is a lighter ground (`#1E1613`, ground-2) at the cost of the ground no longer being
  the deepest thing in the room; shoot both on a 2019 laptop before deciding.
- **The hand's fill is 2.2 : 1 against a surface** (`#7A4B3E`, SYSTEM's own value). It is found by its
  shape (the only filled pill besides a count), its lit edge (4.6 : 1 against the surface) and its rim; in
  the approvals column six of them read as a column of buttons at a glance, which the first pass could not
  claim. The Team look editor's contrast table should check the edge at 3 : 1 in dark, since the fill no
  longer carries it.
- **The composer wrap is a fixed height.** `--ground-h` is 136 px, enough for a one-line composer with its
  bar; a composer that grows with its text (the app's does, to a cap) needs the wrap to grow too, which
  moves the horizon on the page but not in the rail. Either cap the composer at the height the band
  allows (two lines fit at 160 px), or let the rail's foot read the same live height through a registered
  property set by the composer. The second is the right one and is a few lines in `Composer.tsx`.
- **Two full-page layers** (lamp + dusk on `::before`, grain on `::after`) per `.main`, static except the
  500 ms `lamp-on` on a theme change. The title row's blur is the app's existing 8 px.
- **The lamp sits behind a scrolling `.scroll`**, so the top of the page is always the lit part and a long
  stream is darker toward the ground by design; that is the room, not a vignette.
- Page weight 87 KB; the grain tile is 400 bytes.

## How it ports into `apps/web`

The night is a token change plus one structural rule for the ground. No component markup moves except the
rail's foot, which gains a wrapper.

1. **`apps/web/src/tokens.css`**, both dark blocks (`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) … }`
   at the `DARK (system)` banner and `:root[data-theme="dark"]` at `DARK (chosen)`): `--canvas #1A202C → #121826`,
   `--surface #242C3C → #1A2131`, `--surface-2 #2C3547 → #222A3C`, `--surface-3 #37425A → #2A3244`,
   `--out-bg #0E1218 → #140F0E`, `--ink → #F2E9DD`, `--ink-2 → #C4BAAE`, `--ink-3 → #9A948C`,
   `--line cream 14 % → apricot 11 %`, `--edge white 5.5 % → apricot 14 %`, `--rail #10141C → #0C1019`,
   `--rail-2 → #161C28`, `--rail-muted → #A39D95`, `--rail-line → apricot 8 %`,
   `--shadow-soft / --shadow-pop → rgba(20,15,14) at .5 / .65`, `--gradient-brand → the light value`,
   `--overlay → #1A2131`, `--overlay-edge → apricot 12 %`, `--scrim → rgba(20,12,10,.6)`,
   `--seg-on → #333D52`, `--bezel → #0B0E14`. Keep `--accent #7A4B3E`, `--accent-ink #CAA49B`, the status
   triplet, `--count-*`, `--pill-team-*`, `--star-*`, `--focus-ring`, `--mark-disc #2A3244`.
   **New properties**, with their `:root` (day) values first: `--ground #F4EEE5 / #140F0E`,
   `--ground-2 #ECE3D6 / #1E1613`, `--ground-ink`, `--ground-muted`, `--ground-rail #222938 / #140F0E`,
   `--ground-rail-2`, `--ground-rail-ink #F3EDE4 / #F2E9DD`, `--ground-rail-muted #AEB4C2 / #B3A79D`,
   `--horizon navy 16 % / apricot 24 %`, `--horizon-rail cream 14 % / apricot 24 %`, `--ground-h 136px`
   (196px under the 480 breakpoint), `--lamp` (the day value is today's `--canvas-wash`), `--dusk none /
   the gradient`, `--hand-edge transparent / apricot 45 %`, `--hand-rim transparent / apricot 22 %`,
   `--grain-alpha .05 / .07`.
2. **`apps/web/src/tokens.css`**, the `.main` rule (`.main { … background: var(--canvas-wash), var(--canvas); isolation: isolate }`):
   paint `var(--canvas)` on `.main` and move the wash to `.main::before { background: var(--lamp), var(--dusk) }`;
   add the grain on `::after`. `--canvas-wash` stays as the alias for pages that paint `body`.
3. **`apps/web/src/tokens.css`**, `.composer-wrap` (the sticky wrap with the `linear-gradient(to top, var(--canvas) 70%, transparent)`):
   replace with the ground rule above (`height: var(--ground-h)`, `background: var(--ground)`,
   `border-top: 1px solid var(--horizon)`, the 48 px `::before` fade). `.composer` keeps `--surface`; its
   text stays `--ink`.
4. **`apps/web/src/tokens.css`**, `.sidebar, .rail` (the shared frame rule): the two-layer background that
   draws the ground band and the horizon from `--ground-h`; add `.rail .ground` and give `.rail .me` the
   `--ground-rail-*` colours. **`apps/web/src/Rail.tsx`**: wrap the me row (and the "today · spend · waits"
   line, which is new copy from `copy.ts`) in `<div className="ground">`; the list above it becomes
   `.list` with `flex: 1; min-height: 0; overflow: auto` so the foot is pinned.
5. **`apps/web/src/tokens.css`**, `.btn.primary`, `.send`, `.kbd.live`, `.rail .new`, `.avatar.agent`:
   prepend `inset 0 1px 0 var(--hand-edge)` to each `box-shadow`, and `0 0 0 1px var(--hand-rim)` on
   `.btn.primary` and `.send`. `.toasts { bottom: calc(var(--ground-h) + 16px); right: 20px; width: 360px }`
   in `notify.tsx`'s stylesheet block.
6. **`apps/web/src/theme.ts`** `applyTheme`: after setting `data-theme`, remove and re-add a `lit` class on
   the `.main` element so `lamp-on` plays once per switch; `useMotion()` already says whether it will.
   `applyTeamTheme` derives `--hand-edge` from `--team-glow` the way it derives `--focus-halo`.
7. **`apps/web/src/styles.css`**, the phone block (`≤ 480`): the tab bar takes `--ground-rail-*` colours
   and sits inside the ground band under the composer; `--ground-h: 196px`.
8. **`apps/web/src/views/TeamLook.tsx`**: the contrast table gains "the hand's edge on the surface",
   checked at 3 : 1 in dark.

Accessibility (SYSTEM §18, MOTION §11): every text/ground pair above is at or over 4.5 : 1 except
`--ink-3`, which keeps its metadata-only, 12 px-floor exception (5.9 : 1 here); the focus ring is cream and
never the pulse; the status word stays ink and the dot carries the colour; hidden "running" text, the
composed card labels, the `radiogroup`, `role="meter"` on both budgets, the polite toasts region and the
loaders' `role="status"` are on the sheet. Nothing flashes: the slowest loop is 1.8 s, the fastest 1.4 s.

## Open

- **The ground's darkness** (above): `#140F0E` as the deepest thing in the room, or `#1E1613` so the band
  reads on any panel. Shoot on a dim laptop.
- **The composer's growth** (above): cap it to the band, or let the rail's foot follow a live
  `--ground-h`. The second keeps the horizon straight; decide when `Composer.tsx` is touched.
- **The lamp's home.** Over the table (this page) or top-left shared with glass-rail's. If glass-rail
  ships first, its lamp at top-left could be this lamp's spill into the rail; if this ships first, the
  rail stays dark and glass-rail's running card keeps only its pooled light.
- **OLED.** `#121826` is navy, not black; dark-mode's "pure black" question stands and this page's
  answer is still no: a black sky would swallow the chocolate ground and the dusk.
- Whether the day should take the horizon's apricot too. Not done: by day the lamp is daylight and the
  hairlines are ink; the asymmetry is what makes the night a night.
