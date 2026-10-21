# Generative and organic visuals for Henosis

Henosis means unity. The mark is two arcs closing into a ring; every generative surface should rehearse that: two things becoming one. What the best brands ship, what it costs, and ten elements in our palette (Fondant #56352D, Apricot #E2C4A6, Dress Blues #2A3244, cream, Fraunces, Inter).

## What the best work does

**Stripe's ribbon is a displaced plane, not a fullscreen shader.** Kevin Hufnagl's teardown via Bramus (https://www.bram.us/2021/10/13/how-to-create-the-stripe-website-gradient-effect/) and the Exocortex survey (https://github.com/Stranglehold/Exocortex/blob/main/docs/ui_references/beyond_css/shaders.md) agree: a tiny WebGL wrapper, about 600 vertices, 3D simplex noise in the vertex stage, four CSS colour variables, stopped offscreen. Cost: 2 to 5% of an integrated GPU, zero main thread. Whatamesh packages it (https://github.com/jordienr/whatamesh). Stripe's rule: cheapest tool per effect, only `transform` and `opacity`, one gradient carries the colour while text stays on white (https://frontenddesignbasics.vercel.app/docs/cases/stripe-connect).

**Linear's glow is CSS.** No canvas on linear.app: a `radial-gradient` wash, a dot grid whose cells fade on 2.8 to 3.2 second opacity keyframes, `mask-image` everywhere. A mirrored Tailwind config has the recipe: `radial-gradient(ellipse 80% 50% at 50% -20%, ...)`, a `conic-gradient` hero glow, and `glow-line` keyframes that run a 1px gradient along an edge and fade (https://github.com/Zrital3265/Linear.app/blob/main/tailwind.config.ts). Themes come from three LCH variables (https://linear.app/now/how-we-redesigned-the-linear-ui).

**Grain is a tile, never a live filter.** CSS-Tricks set the recipe: `feTurbulence`, `contrast()`, `brightness()`, blend modes (https://css-tricks.com/grainy-gradients/). Gustavo Fior measures the catch: a live `feTurbulence` recomputes on every repaint and can drop a phone hero to a few fps, so render a 200px tile once as a data URI, `stitchTiles`, saturate 0, repeat (https://craft.gustavofior.com/noise). Gradiently adds the dials: `soft-light` at 0.3 to 0.45, finer grain on small parts, motion only by shifting an oversized tile in `steps(3)` (https://gradiently.design/guide/css-noise-texture). Arc grains every cobalt band at 2 to 3% so flat colour reads as printed, and cuts bands with wavy SVG edges so sections feel stitched (https://pageproofer.com/inspiration/calm-minimal/arc/).

**Vercel's frame is gradients, masks and layers.** Rauno Freiberg's hero stacks heading, SVG triangle, CSS grid lines, SVG rays, CSS rainbow gradient and, last and optional, a GLSL shader that fades in after load, skipped on weak hardware (https://rauno.me/craft/vercel). The Next.js guides are Stripe's dotted line: a 1px `linear-gradient`, `background-size: 5px 1px`, masked at both ends (https://rauno.me/craft/nextjs). Geist's Grid draws guides with `display: contents` and print crosshairs (https://vercel.com/geist/grid); GodUI adds a sweep and cursor spotlight from one keyframe and two variables (https://godui.design/docs/lab/backgrounds/blueprint-grid/learn).

**Joining is a filter graph.** The gooey effect is `feGaussianBlur`, `feColorMatrix` with alpha row `19 -9`, `feComposite atop` (https://css-tricks.com/gooey-effect/). It reads as fusion because blur sums neighbouring alpha like a field and the matrix thresholds it: two discs snap into one surface with a neck that stretches and breaks as they part; filter the group, keep it small (https://vocab.design/gooey-effect). The multiplier sets stickiness, `25 -15` for soft joins (https://dev.to/antogarand/svg-metaballs-35pj).

**Flow and particles are cheap on 2D canvas.** A flow field is `angle = noise(x*s, y*s, t) * 2π`, a step, a 3 to 5% veil instead of a clear; 3,000 to 5,000 particles hold 60fps on a laptop (https://www.mysimulator.uk/articles/flow-fields/, https://www.emergentmind.com/visualizations/flow-field). In three.js one `Points` object draws 100,000 particles in one call for 0.5ms of CPU (https://www.mysimulator.uk/articles/particle-system/).

**Rings animate with `@property` or `pathLength`.** Registering `--angle` as `<angle>` lets a `conic-gradient` fill or spin without snapping, a radial mask punches the hole, `pathLength="100"` makes `stroke-dasharray` a percentage (https://codefronts.com/components/css-animated-cards/progress-ring-fill-on-load/). Two arcs on one circle at different speeds, frozen opposite under reduced motion, is a 40-line loader (https://designforai.dev/snippet/loaders-042).

**Video brands ration colour.** Runway: near-black, zero shadow, one typeface, one gradient as designation, never decoration (https://designbycurio.com/learn/runway-2024). Higgsfield spends chartreuse on one element per viewport and reads depth as luminance (https://github.com/educlopez/design-bites/blob/main/design-mds/higgsfield.ai/DESIGN.md). Henosis is warm and light; glow-on-black does not transfer, the rationing does: one Fondant moment per screen, grain, mesh, goo and ink elsewhere.

## Ten elements for Henosis

1. **The Closing Ring** (logo reveal). Two SVG arcs, `pathLength="100"`, `stroke-dasharray: 50 50`, `stroke-dashoffset` animated from opposite ends over 600ms, `cubic-bezier(.16,1,.3,1)`, round caps. Screen: Onboarding first paint and Desktop splash. Reads as: a person's arc and an agent's drawn toward each other until the seam is gone.

2. **Fondant Mesh** (hero). A Whatamesh-style vertex-noise plane in all three colours at low amplitude, dpr capped at 1.5, 30fps, paused offscreen, fallback three `radial-gradient` blobs under `filter: blur(80px)`. Screen: marketing hero and Project page header only. Reads as: three colours that never resolve into separate regions.

3. **Paper Grain** (everywhere). A 200px `feTurbulence` tile (`baseFrequency 0.8`, 3 octaves, saturate 0) as a data URI on `::after`, `mix-blend-mode: soft-light`, opacity 0.35, `isolation: isolate`. Screen: every cream surface and Apricot band. Reads as: one sheet of paper that people and agents write on together.

4. **Gooey Presence** (Session header). Member and agent avatar discs inside one `filter: url(#goo)` group (`feGaussianBlur 8`, alpha matrix `20 -9`, `feComposite atop`), moved with 2D transforms so joiners fuse. Screen: Session roster pill and Team panel. Reads as: presence as one body, a neck stretching when someone steps away.

5. **Confluence Field** (empty session). A 2D canvas flow field, 800 particles from left and right edges in Fondant and Dress Blues, noise angles bent toward centre so trails braid into one Apricot stream, 5% veil per frame, stopped when hidden. Screen: Session empty state. Reads as: two currents becoming one river.

6. **Stitched Guides** (workspace chrome). `linear-gradient` dots at `background-size: 6px 1px`, `mask-image` fading both ends, between a person's column and an agent's, a 6px print cross where they meet. Screen: Session stream, Plan card, Manager overview. Reads as: the seam is stitched, not walled.

7. **Turning Ring Focus** (interactive). `@property --angle` on `conic-gradient(from var(--angle), fondant, apricot, blues, fondant) border-box` under a cream `padding-box`, 8s linear, paused under reduced motion. Screen: whoever holds the turn in Session and Groups. Reads as: one ring passed around the table; colour circulates rather than changing hands.

8. **Ink Bloom Reply** (message arrival). An agent reply fades in under `feDisplacementMap` fed by the grain tile, `scale` 30 to 0 over 400ms so text settles from wash to crisp. Screen: Session stream and Inbox. Reads as: thought arriving on the shared page, not a card dropping in.

9. **Edge Light Handoff** (approval). Linear's `glow-line`: a 1px Apricot gradient travels the card edge from requester to approver and fades at the corner, `transform` only, 1.2s. Screen: Approvals notice, Release gate, Approvals queue. Reads as: the decision crossing from one hand to the other along one wire.

10. **Shared Halo** (team identity). Two blurred `radial-gradient` discs, Fondant and Dress Blues, offset half a radius under a `backdrop-filter: blur(60px)` pane with grain on top, their overlap tinted Apricot. Screen: Team look, Rail header, Mobile home. Reads as: two lights whose overlap is the warmest place in the room.
