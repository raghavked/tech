# sig-unity-field · The unity field

A living background behind the home and the welcome brief. A field of faint half-arcs, a person's and
an agent's for every pair, drifts across the cream like a slow tide. Near the cursor, beside a live row
of the brief, and when a join ripples out from its line, a pair travels to its shared centre and swings
from the mark's "apart" pose (±60°) into one ring; only once the ring is one does the apricot centre
land. Everywhere else the arcs stay apart and faint. The page is a room where joining keeps happening,
quietly, where you look.

Files: `index.html` (self-contained: tokens inlined, light and dark via `prefers-color-scheme` and
`[data-theme]`, every animation under the one guard with `[data-motion="calm"]` and
`prefers-reduced-motion`, Fraunces/Inter asked first with Instrument and system fallbacks, no external
assets, no fonts fetched), `light.png`, `dark.png` (1440×900), `phone.png` (390×844).

## What it is

| Layer | What | Where it lives |
|---|---|---|
| The tide | 12–64 loose pairs (one per ~23 000 px², seeded so the composition repeats at a given size), each two half-arcs apart on a slowly turning axis, drifting at 2–5 px/s, wrapping at the edges | the whole `.main` under the topbar, over the apricot wash |
| Quiet zones | over the headline, the brief and the session rows (`[data-field-quiet]`) the arcs draw at half alpha and never close; the words stay the loudest thing | hero, ledger, rows |
| Near the hand | within 150 px of the pointer a pair closes (spring ζ 0.72, k 55–110, the −4° / +2° overshoot of the mark's own curve); leaving, it opens again and resumes the tide | anywhere not quiet |
| Marginalia | one ring per live row (`[data-field-anchor]`: the baton row, the plan waiting for ratings), sitting 44 px into the left margin beside the row, closed at rest; on a phone, where there is no margin, it sits in the row's empty lower-right corner at a smaller radius | the brief, the session list |
| The join | "Ana joins" (the inspector's button; in the app, the join event) pulses outward from the join line at 2.4 ms/px over 340 px; pairs close as the wave passes and open 1.5 s later; the marginal ring stays | the brief |
| The still frame | Calm and reduce: no clock runs; every pair sits at its end state. Rings beside the live rows and under the demonstration cursor are closed with their centres; everything else is apart and faint | all of it |

The exploration carries a small **inspector** in the topbar (arcs, ms per frame, fps, % of one core,
"Ana joins", Calm, Dark). It is the exploration's own control and is not part of the design; the app
does not ship it. The 1440 screenshots show a **demonstration cursor** drawn by the field itself, so the
still can show the effect; it disappears the moment a real pointer moves. The app does not draw one.

## Why it is ours

- **It rehearses the mark, and nothing else.** Person = chocolate, right; agent = navy on cream,
  apricot on the dark canvas (SYSTEM §5's colour-by-ground table; the illustration board's fix for the
  night); the centre is the lightest colour present and appears only after the ring is one (MOTION §8).
  The apart pose is ±60°, the same frame the tokens' `arc-a / arc-b` start from (SYSTEM §14), so a ring
  closing in the field is the same gesture as the join line in the stream, at a different scale.
  generative-visuals says every generative surface should rehearse "two things becoming one"; this is
  that sentence as a background (its §1 Closing Ring, §10 Join Breath).
- **Motion means joining or living (BRIEF).** The field never animates for its own sake: the tide is
  below the threshold of attention (sub-pixel steps at 12 fps), and the only visible motion is a pair
  closing because a hand is there, a row is live, or someone joined. No orbit, no travelling bead, no
  shader bloom, no dot grid pulsing on a 3 s cycle (Linear), no purple, no sparkle (ai-interfaces-avoid
  §6). The rings beside the live rows are **marginalia** (presence-and-agents §1 arc pointer,
  ai-interfaces-avoid §9 margin notes): the page's own copy of "who is here" without a second panel.
- **The still frame is finished.** Rest is the end state (MOTION §1, §3, §11): under Calm or
  `prefers-reduced-motion` the field is a drawing, not a paused video. The marginal rings are closed,
  the rest of the field is apart; nothing waits for a clock. The Apple criterion in motion-choreography
  (keep motion that carries meaning, stop ongoing motion, avoid sustained oscillation near 0.2 Hz) is
  met: the only loop is the drift, which is not an oscillation, and it stops entirely under Calm.
- **Warm and light, not glow-on-black.** On cream the arcs are ink at 15–17 % and the halo under a closed
  ring is an apricot wash at 12 % (three-colour-brands: cream does 70 % of the work, apricot is spent on
  one object). In dark the canvas stays navy `#1A202C` (SYSTEM §16), the person's arc is the dark hand
  `#7A4B3E` drawn a step heavier so it survives the night, the agent's arc and the centre are apricot.
  The wash is one blurred disc, the one gradient on the screen (BRIEF: one gradient per screen).
- **Hierarchy survives.** The field is the ornament; the words are the page. Quiet zones (half alpha, no
  closing over text) keep the ledger column clean (ai-interfaces-avoid §1 ledger, premium-product-ui:
  colour withheld then spent). The hero is text on the page with the resting mark, not a gradient card.
- **It is not Claude's, ChatGPT's or Linear's.** Claude's warmth is a serif and a clay seal with no
  motion in the ground; ChatGPT's ground is empty; Linear's is a dot grid and a glow. A field of brand
  arcs that close where you look belongs to a product whose mark *is* two arcs closing. The navy in
  dark and the chocolate hand are the colours Claude does not have (three-colour-brands).

## The technique

- **2D canvas, not SVG and not WebGL.** Up to 64 pairs plus one per live row (98 arcs at 1440×900, 32 on
  a phone). SVG would mean ~130 nodes re-laid out per frame; a shader is a cost rule violation for a
  background on a product page (generative-visuals: one WebGL surface per page at most, and none here).
  `devicePixelRatio` is capped at 1.5 (the flow-field craft rule, cited in generative-visuals).
- **Batched rest strokes.** Every apart arc at a given alpha is one `beginPath … stroke` (four batches:
  person/agent × loud/quiet); only the pairs in motion draw individually. Most frames are four path
  strokes and a clear.
- **Two clocks.** 30 fps while any ring is moving, 12 fps when only the tide moves (steps are
  sub-pixel; nobody sees 12 fps drift). The `requestAnimationFrame` loop idles out entirely when
  nothing is active and the pulse has passed; it stops on `visibilitychange`, when the canvas leaves
  the viewport (IntersectionObserver), under Calm and under reduce.
- **Springs, not tweens.** Each pair has a closing value `u` driven by a damped spring toward its
  target (0 apart, 1 ring), so a pointer that passes through retargets mid-flight without a restart
  (motion-choreography: springs for interruptibility; ζ 0.72 gives the mark's small overshoot). The
  centre has its own stiffer spring that starts only once `u > 0.94`, so the dot pops after the ring
  closes and never before (MOTION §8).
- **Anchors are measured from the DOM.** `[data-field-anchor]` rows and `[data-field-quiet]` blocks
  are measured on resize and (throttled to a frame) on scroll; the marginal rings follow their rows as
  the column scrolls. The canvas sits under the topbar rather than behind it, so the topbar's backdrop
  blur never repaints over a changing surface.
- **Colour from custom properties.** `--field-person`, `--field-agent`, `--field-centre`,
  `--field-halo` and their rest/ring alphas are read from `.main`'s computed style at start and on
  every theme change (MutationObserver on `data-theme`, `prefers-color-scheme` listener). The field has
  no colours of its own; a team look that retints the tokens retints the field.
- **The guard.** `--motion` is 1 only inside `@media (prefers-reduced-motion: no-preference) {
  :root:not([data-motion="calm"]) … }` (MOTION §3). The script reads that one property; it never
  reads the media query itself, so the field and the CSS motion agree by construction. The inspector's
  Calm button toggles `data-motion="calm"` on `<html>`, exactly as `theme.ts` does.

## The cost

Measured headless (Chromium, 1440×900 and 390×844, after the first second, which carries the JIT and
is excluded from the figure). "% core" is ms per frame × fps ÷ 10, i.e. the share of one CPU core the
script takes; compositing a single 2D canvas is below that.

| Situation | arcs | ms/frame | fps | % of one core |
|---|---|---|---|---|
| Desktop, idle (tide only) | 98 | 0.31–0.43 | 11–12 | 0.3–0.5 |
| Desktop, pointer moving through the field | 98 | 0.14–0.18 | 24–30 | 0.4 |
| Desktop, a join pulsing | 98 | 0.19 | 25–26 | 0.5 |
| Desktop, dark | 98 | 0.14–0.43 | 12–30 | 0.2–0.5 |
| Phone, idle / touched | 32 | 0.10–0.30 | 11–12 | 0.1–0.4 |
| Reduced motion or Calm | 98 | still | 0 | 0 |

Memory: one canvas at ≤ 1.5× dpr (≈ 7.8 MB at 1440×844) and ~100 small objects. Nothing allocates per
frame.

## How it ports into `apps/web`

The field is one file and two attributes. Nothing in the stream, the rail or the tokens changes.

1. **`apps/web/src/field.ts`** (new): the IIFE from `index.html`'s `<script>` as a module exporting
   `mountField(main: HTMLElement, opts?: { onJoinSelector?: string }) => { pulseAt(x, y), destroy() }`.
   Same code, minus the inspector and the demonstration cursor (`S.demo`, the drawn pointer and the
   `[data-field-demo]` lookup go). It reads `--motion` from `<html>` the way the exploration does; no
   call to `useMotion()` is needed, but the MutationObserver on `data-motion` stays so a team's Calm
   switch stops the clock.
2. **`apps/web/src/views/Home.tsx`**: the `Home` view mounts it. Render `<canvas className="field"
   aria-hidden="true" />` as the first child of `.main` (the `Shell` in `App.tsx` owns `.main`; add an
   optional `field?: boolean` prop to `Shell` that renders the canvas before `.topbar`, and pass
   `field` from `Home` only). A `useEffect` in `Home` calls `mountField(mainRef.current)` and returns
   `destroy`. The hero and `FirstRun` column get `data-field-quiet`; the brief's live rows (the baton
   row, a plan waiting for ratings) get `data-field-anchor`. The welcome brief is the same `Home`
   view (the "Welcome back, Ana." ledger is what `FirstRun` collapses to once the steps are done), so
   one mount covers both homes in the task.
3. **The join**: where the stream appends a join line (`ui.tsx`'s toast region announces "Ana joins
   the circle."), call `field.pulseAt(x, y)` with the line's position when the home is on screen.
   One line in the join handler; nothing elsewhere.
4. **`apps/web/src/tokens.css`**: add the eight `--field-*` properties to the light block and the
   dark block (values in `index.html`'s `:root` and dark blocks). They are derived from `--accent`,
   `--rail` and `--apricot`, so a team look that changes those should set `--field-person` to the
   team's hand as well; `theme.ts`'s `applyTeamTheme` is the place.
5. **`apps/web/src/styles.css`**: the three rules under "the field lives here" in `index.html`
   (`.main { position: relative; isolation: isolate }`, `canvas.field { position: absolute; inset:
   var(--topbar-h, 56px) 0 0 0; pointer-events: none; z-index: 0 }`, `.main > .topbar, .main >
   .scroll { position: relative; z-index: 1 }`).

Accessibility (MOTION §11): the canvas is `aria-hidden`; the rings beside the live rows are decoration,
the words in the row carry the state; nothing flashes (the fastest change is a ring closing over
~400 ms); contrast of text over the field is unchanged because the arcs under text are at ≤ 9 %.

## Open

- Whether a pair should close under a **touch** the way it does under a pointer. The exploration holds
  the touch point for 2.4 s after a tap on empty canvas; a pointer-style close is read as a response
  to a gesture that was really a scroll. Watch it on a device.
- The marginal ring beside a live row sits 44 px into the margin; at `--col` 780 in a 1024-wide main
  that margin is 122 px, so the ring never touches the text, but at 960 it would. Below 1100 px main
  width the anchor could move to the row's trailing corner as it does on a phone.
- The tide's seeded layout repeats at a given canvas size; the app may prefer one seed per team so two
  teams' homes do not share a composition.
- The demonstration cursor is the exploration's device for a still. If a judge wants the screenshot
  without it, drop `[data-field-demo]` from the hero before shooting.
