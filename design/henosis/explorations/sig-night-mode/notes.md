# sig-night-mode · The night

The dark theme as a night of its own, not cream turned inside out. Three colours take three depths:
**apricot is the only light** (one lamp in the top-left corner, the lit top edge of every raised surface,
every pulse), **Dress Blues is the air** (the sky, the room, every surface stepped toward the lamp until
Dress Blues itself returns as the highest step), **chocolate is the shadow** (every shadow is warm, the
deepest surface on screen is chocolate-black, the hand is a chocolate object that catches the lamp on its
top edge). Nothing on the night is white and nothing is grey. By day the sheet is the system's v5 light,
untouched; the night is what this exploration proposes.

Files: `index.html` (self-contained: the v5 light values in `:root`, the night twice and byte-identical
under `prefers-color-scheme: dark` and `[data-theme="dark"]`, every animation under the one guard
`@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }` with the clocks
zeroed under Calm and reduce, Fraunces / Inter asked first with Instrument and the system faces as
fallbacks, no font fetched, no asset loaded), `light.png`, `dark.png` (1440×900), `phone.png` (390×844,
the night on the phone's session with the four-tab bar).

The sheet is the app's own shell with every component on it: the rail (brand, New session, Search,
the waits with counts, a crew, six agent-card states, the project rows, chats, the me row), the title row
(status, Team pill, token chip, presence stack, Team / Details), the stream (a join line, a human message
with its Goal and scope, an agent message with steps, a live step and the output block, a release gate
with votes, quorum and the rating control, a team message, a contention, the plan card with four step
states, risk pills, the budget with its ticks and raters), the composer, and a specimen column (the
night ladder, buttons, chips, segment, switch, checkbox, field, keys, pills, counts, mentions, status
dots, avatars and stack, the five loaders, a stat tile with its spark-word, keyboard-selected rows, a
toast). The theme seg and Calm button in the title row are the page's inspector (keys `d`, `c`), not
part of the design.

## What it is

| Role | By day (v5, unchanged) | By night (proposed) | What it does |
|---|---|---|---|
| the lamp | the system's apricot wash at 35 % | `radial-gradient(1100px 640px at 14% -10%, apricot 20 %, transparent 62 %)` on `.main::before` | the one light source; everything lit is lit from here |
| `--edge` | `none` | `inset 0 1px 0 rgba(226,196,166,.14)` | the lamp caught on the top edge of every raised surface: cards, bubbles, buttons, keys, the composer, the output block |
| `--line` | navy 12 % | **apricot 11 %** | hairlines are lit, not drawn: the same light at a lower level |
| `--rail` / `--canvas` / `--surface` / `--surface-2` / `--surface-3` | | `#0C1019` · `#121826` · `#1A2131` · `#222A3C` · **`#2A3244`** | Dress Blues' own ramp, hue 222°, saturation held at 33–36 % so it reads as navy and never as grey; the pressed step is Dress Blues itself |
| `--out-bg` | navy | **`#140F0E`** (chocolate-black) | the agent's terminal is the deepest and warmest thing in the room |
| `--shadow-soft` / `--shadow-pop` | navy 8 / 16 % | **chocolate-black `rgba(28,14,10)` 45 / 60 %** | every shadow is warm; a card on the night casts chocolate, not black |
| `--accent` (the hand) | `#56352D` | `#6B4339` with `--hand-edge: apricot 45 %` on its top edge and a 22 % apricot rim | the hand is a chocolate object under the lamp; the lit edge is what says "press me" |
| `--accent-ink` | chocolate | `#CAA49B` (chocolate 300, 7.9 : 1) | the hand as text |
| `--ink` / `--ink-2` / `--ink-3` | navy inks | `#F2E9DD` · `#C4BAAE` · `#9A948C` | apricot-tinted cream, never white, never a cool grey (14.8 / 9.3 / 5.9 : 1 on the canvas) |
| `--rail-muted` | `#AEB4C2` | `#A39D95` | the rail's second voice warms with the rest (7.1 : 1) |
| the pulse | apricot-deep, 30 % washes | apricot, 16 % washes, the 3 px `--live-line` at 35 %, the Team pill as apricot text on an 18 % wash | unchanged in meaning from SYSTEM §2.5: a count waits, a wash is where you are, a dot is alive |
| `--gradient-brand` | navy → chocolate | **navy → chocolate, the daytime one** | the canvas finally got out of its way: on `#121826` the true Dress Blues → Chocolate Fondant reads at full strength, so the New session button and the agent tile no longer need the lifted `#3A4661 → #7A4B3E` |
| `--gate-stripe` | the brand gradient | apricot → chocolate | the gate's one gradient, kept from session-dark |
| status | the day triplet | `#9BC88F / #E2B06A / #E2847A`, softs at 18 % | SYSTEM §2.7's one triplet, unchanged |
| the paper | a 160 px `feTurbulence` tile as a data URI at soft-light, 5 % | the same tile at 7 % | one sheet for both; the night's grain keeps the navy from reading as a screen |
| `--focus-ring` | chocolate | cream ink | never the pulse (accessibility's fix) |
| the mark's disc | `#2A3244` | `#2A3244` | held; on the night rail at 24 px the person's arc takes the 62 % lift the app already has |

## Why it is ours

- **Three colours, three depths.** three-colour-brands' closing rule for dark ("deepened canvas, apricot
  ink at 90 %, navy as the elevated surface, cream only as highlight; never a grey or blue-black dark
  mode") is taken whole and turned on the task's axis: the air is navy, the shadow is chocolate, the
  light is apricot. Every value on the night derives from one of the three palette colours; there is no
  fifth colour and no neutral grey (SYSTEM principle 1). Dark is re-weighed, not inverted (SYSTEM
  principle 9, §16): rail < canvas < surface holds, `--edge` replaces the shadow, apricot is a hairline
  and a 9–16 % wash, the ink is cream.
- **One light source, so the room has a direction.** premium-product-ui: "depth from light and tone, not
  drop shadows", hairlines at 6–10 % alpha, surfaces that step 1–3 shades. Linear's step ladder is cool
  grey; ours is lit. The lamp is the glass rail's lamp (`sig-glass-rail`) let out of the rail and onto the
  whole page, so a card, a bubble and a button all catch the same light on the same edge. Interiors
  balance a dark room with one warm source and rough texture (three-colour-brands: Fradina's blue brick
  with a chocolate ceiling; Veranda's apricot ceiling that "casts a flattering glow"); the grain is the
  texture, the lamp is the glow.
- **The shadow is chocolate, which is the thing no one else has.** Claude's dark mode is a warm near-black
  with a 60° hue tint ("never blue-black"); Linear's is `#010102` with an indigo glow; ChatGPT's is a
  grey ladder. A navy room whose shadows are chocolate and whose only light is apricot is a night that
  belongs to a palette of exactly these three (SYSTEM principle 10: keep navy dominant, never lift
  chocolate toward terracotta; ai-interfaces-avoid: no purple, no sparkle, no glow-on-black). The
  terminal as chocolate-black answers session-dark's open question about the output block reading as "a
  hole in the page": it is now the warmest thing on the sheet, not a hole.
- **The hand and the pulse stay two things at night.** session-dark asked whether the dark hand should be
  a lifted chocolate so "Approve with 4" is never the same colour as the live step beside it; SYSTEM §2.4
  settled on `#7A4B3E`. Here the hand goes one notch lower (`#6B4339`, "chocolate as shadow") and is told
  apart from the surface by its lit edge rather than by lifting its fill; the pulse stays apricot in dots,
  rings, hairlines and washes; the only apricot fill is the count and the pressed key (SYSTEM §16 "shape
  keeps the hand and the pulse apart").
- **Rest is the end state** (MOTION §1, §3, §11). The lamp fades up over 500 ms on a theme change
  (`lamp-on`, inside the guard); under Calm it is simply on. The join line's mark is a resting `<use>`
  because that join landed at 14:06; the moving mark lives only in the loaders strip. Every loop on the
  sheet is the system's (dot-live 1.8 s, the arcs, orbit, halo, weave, shimmer, the toast's 8 s life) and
  every one has its finished frame written outside the guard.
- **Type and numerals.** Names in Fraunces with `"SOFT" 50, "WONK" 0` (editorial-type §1), what is read
  in Inter, spend and counts in tabular mono with a slashed zero (editorial-type §6); the ladder's
  labels and the tile's label are tracked mono eyebrows (editorial-type §7); the tile's spark-word
  carries a band for the team's normal and an apricot last point (data-craft §1, §2, §9).

## The technique

```css
/* the night block, once under the media query and once under the attribute */
--canvas: #121826; --surface: #1A2131; --surface-2: #222A3C; --surface-3: #2A3244; --out-bg: #140F0E;
--line: rgba(226,196,166,.11);  --edge: inset 0 1px 0 rgba(226,196,166,.14);
--shadow-soft: 0 10px 30px rgba(28,14,10,.45); --shadow-pop: 0 18px 50px rgba(28,14,10,.6);
--accent: #6B4339; --accent-hover: #7A4B3E; --accent-fg: #FFF3E6; --accent-ink: #CAA49B;
--hand-edge: rgba(226,196,166,.45);
--lamp: radial-gradient(1100px 640px at 14% -10%, rgba(226,196,166,.20), transparent 62%);
--grain-alpha: .07;

.main { position: relative; isolation: isolate; }
.main::before { content: ""; position: absolute; inset: 0; background: var(--lamp); z-index: -2; }   /* the lamp */
.main::after  { content: ""; position: absolute; inset: 0; z-index: -1; opacity: var(--grain-alpha);
                mix-blend-mode: soft-light; background: url("data:image/svg+xml,…feTurbulence…") 0 0 / 160px 160px; }
.card, .notice, .plan, .composer, .msg.human .text { box-shadow: var(--shadow-soft), var(--edge); }
.btn.primary, .send, .kbd.live, .rail .new, .avatar.agent { box-shadow: inset 0 1px 0 var(--hand-edge), …; }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) .main.lit::before { animation: lamp-on 500ms var(--ease-move) both; } }
```

- The lamp is one radial gradient on a pseudo-element, not the blurred disc (`filter: blur(110px)`)
  SYSTEM §20 still has to measure; it costs a gradient fill and nothing per frame.
- The grain is a 160 px SVG tile rasterised once by the browser and repeated; nothing runs
  `feTurbulence` at paint time (generative-visuals §3, cost rules). It is `soft-light` so it textures the
  navy without greying it.
- `--edge` and `--hand-edge` are inset shadows with zero blur, which Chromium paints as fills; at 1× and
  2× each lands on one device-pixel row. No `0.5px` hairlines anywhere.
- Every raised surface already appends `var(--edge)` in the app (`styles.css` does this since
  session-dark), so recolouring the edge from white 5.5 % to apricot 14 % is a token change, not a
  selector change. `--hand-edge` is the one new property, `transparent` by day.
- Colour reaches a `<use>` only through custom properties (print-export's finding): the symbols are
  drawn with `fill="var(--mark-disc)"` and `stroke="var(--mark-arc-a)"`, and the moving marks are
  inlined so the `.arc` and `.dot` keyframes apply. The rail lifts the person's arc with
  `.rail .mark { --mark-arc-a: #9B7A6A }`.
- The ladder in the specimen column reads its hexes from `getComputedStyle` at runtime, so it prints the
  day values by day and the night values by night; it is a picture of the tokens, not a copy of them.

Contrast, measured (`#121826` canvas, `#1A2131` surface): ink 14.8 : 1, ink-2 9.3, ink-3 5.9 (5.4 on
a surface), accent-ink 7.9, apricot as text 10.7, count ink on apricot 7.7, the status triplet 8.5 /
8.2 / 6.0 on a surface, rail-muted on the rail 7.1, the hand's text on the hand 7.7, apricot on the hand
(the lit edge) 5.1.

## The cost

- **The hand's fill is 1.9 : 1 against a surface.** Any chocolate dark enough to read as shadow sits
  under 3 : 1 on navy (SYSTEM's `#7A4B3E` is 2.2 : 1 as well). The button is told apart from its
  ground by its 45 % apricot top edge and 22 % rim, which measure above 3 : 1 against the surface, and
  by its shape (the only filled pill on the sheet besides a count). This is the honest trade: the hand is
  recognised by its lit edge, so the edge must ship with the fill. If a team look sets a highlight too
  close to its surface, the Team look editor's contrast check should warn on the edge, not the fill.
- **Two full-page pseudo-elements** (lamp, grain) per `.main`; both are static layers with no animation
  except the 500 ms `lamp-on` on a theme change. The grain is one decoded 160 px bitmap. No
  `backdrop-filter` beyond the title row's 8 px blur the app already has.
- **The lamp is composited behind a scrolling `.scroll`**, so it does not scroll with the content and
  the top-left of the page is always the lit corner; on a long page the lower stream is darker by
  design. If that reads as a vignette rather than a lamp, cap the gradient's height at the first fold.
- Paint, measured headless at 1440×900 in both themes with every loop running: no dropped frame on a
  60 Hz budget (the animated properties are `opacity`, `transform`, `box-shadow` on an 8 px dot,
  `background-position` on three 10 px lines).
- The page is 82 KB with the grain tile inline; the tile is 400 bytes.

## How it ports into `apps/web`

The night is a token change. No component markup moves.

1. **`apps/web/src/tokens.css`**, both dark blocks (`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) … }`
   at the `DARK (system)` banner and `:root[data-theme="dark"]` at `DARK (chosen)`): replace
   `--canvas #1A202C → #121826`, `--surface #242C3C → #1A2131`, `--surface-2 #2C3547 → #222A3C`,
   `--surface-3 #37425A → #2A3244`, `--out-bg #0E1218 → #140F0E`, `--ink #F0EAE0 → #F2E9DD`,
   `--ink-2 #B4BAC6 → #C4BAAE`, `--ink-3 #9CA3B2 → #9A948C`, `--line cream 14 % → apricot 11 %`,
   `--edge white 5.5 % → apricot 14 %`, `--rail #10141C → #0C1019`, `--rail-2 #1A2030 → #161C28`,
   `--rail-muted #8E95A5 → #A39D95`, `--rail-line → apricot 8 %`, `--accent #7A4B3E → #6B4339`,
   `--accent-hover → #7A4B3E`, `--shadow-soft / --shadow-pop → rgba(28,14,10) at .45 / .6`,
   `--gradient-brand → the light value`, `--scrim → rgba(20,12,10,.6)`, `--overlay → #1A2131`,
   `--overlay-edge → apricot 12 %`, `--wash → apricot 20 %`, `--bezel → #0B0E14`. Add `--hand-edge`
   (`transparent` in `:root`, `rgba(226,196,166,.45)` in both dark blocks) and `--grain-alpha`
   (`.05` / `.07`). Keep `--mark-disc #2A3244`, the status triplet, `--accent-ink #CAA49B`,
   `--count-*`, `--pill-team-*`, `--star-*`, `--focus-ring` as they are.
2. **`apps/web/src/tokens.css`**, the `.main` rules (`.main { … isolation: isolate }` and
   `.main::before { … filter: blur(110px) }`): replace the blurred disc with the `--lamp` gradient on
   `::before` and add the grain tile on `::after` (the two rules under "the lamp" and "the paper" in
   `index.html`). `--canvas-wash` stays as the fallback for pages that paint `body`.
3. **`apps/web/src/tokens.css`**, `.btn.primary`, `.send`, `.kbd.live` and `.rail .new`: prepend
   `inset 0 1px 0 var(--hand-edge)` to each `box-shadow`; in the dark blocks give `.btn.primary` the
   `0 0 0 1px rgba(226,196,166,.22)` rim. `.avatar.agent` (the gradient tile in `ui.tsx` `Avatar`) takes
   the same inset edge.
4. **`apps/web/src/styles.css`**, the block headed *"tokens.css draws the ground (.sidebar, .rail share
   every rule)"* at `.sidebar`: nothing to change; the rail reads `--rail`, `--rail-2`, `--rail-muted`
   and `--crease` and takes the night with the tokens. Check the hand-pasted `#3A4458` agent-mention
   hex the chat panel noted; it should read `--mention-agent-bg`, which stays `#2A3244` here.
5. **`apps/web/src/theme.ts`** `applyTheme`: after setting `data-theme`, toggle a `lit` class on the
   `.main` element (remove, force a reflow, add) so `lamp-on` plays once per switch; `useMotion()`
   already tells components whether it will. `applyTeamTheme` should derive `--hand-edge` from
   `--team-glow` the way it derives `--focus-halo`, so a team's highlight recolours the lit edge.
6. **`apps/web/src/views/Settings.tsx`** `Appearance`: the Light / Dark / System segment is unchanged;
   the word "Night" can stay a design name.
7. **`apps/web/src/views/TeamLook.tsx`**: the contrast table gains one row, "the hand's edge on the
   surface", checked at 3 : 1 in dark, since the fill no longer carries that contrast.

Accessibility (SYSTEM §18, MOTION §11): every text/ground pair above is at or over 4.5 : 1 except
`--ink-3`, which keeps its metadata-only, 12 px-floor exception (5.9 : 1 here, above the day's 4.6);
the focus ring is cream and never the pulse; the status word stays ink and the dot carries the colour;
the hidden "running" text, the composed card labels, the `radiogroup`, the polite toasts region and the
loaders' `role="status"` are all on the sheet. Nothing flashes: the slowest loop is 1.8 s, the fastest
the weave's 1.4 s.

## Open

- **The hand's fill.** Should the night hand be `#6B4339` (shadow, lit edge carries the contrast) or
  SYSTEM's `#7A4B3E` (lifted, 2.2 : 1 on its own)? Both are under 3 : 1 as fills; this page prefers the
  lower one because it keeps chocolate on the shadow side of the ladder and lets the edge do the work.
  Shoot both on the approvals queue, where six primaries sit in a column, before deciding.
- **Dress Blues as `--surface-3`.** It makes the pressed step the brand's own navy, which is a nice fact,
  but it is also the mark's disc, so a mark on a pressed segment or an off star tile has no disc edge.
  Either hold the disc at `#2A3244` and accept it, or give `#mark` a 1 px apricot 20 % ring in dark.
- **OLED.** `#121826` is navy, not black. dark-mode's open question about a "pure black" option
  stands; this page's answer is no, because a black canvas would turn the lamp into a spotlight and
  the chocolate shadows would vanish into it.
- **The lamp on the phone.** At 390 px the lamp's ellipse is wider than the screen and reads as a
  warm top edge rather than a corner. Fine in `phone.png`; a phone-specific `--lamp` at 640×420 would
  put the corner back.
- Whether `--line` as apricot 11 % should also replace the day's navy 12 %, so day and night share one
  hairline rule ("lit, not drawn"). Not done: by day the lamp is the wash and the hairlines are ink, and
  that asymmetry is what makes the night a night.
