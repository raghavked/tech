# Generative and organic visuals for Henosis

Henosis means unity. The mark is two arcs closing into a ring; every generative surface should rehearse that gesture: two things becoming one. This note records what the best brands ship, what it costs, and ten elements buildable in our palette (Chocolate Fondant #56352D, Apricot Illusion #E2C4A6, Dress Blues #2A3244, cream canvas, Fraunces and Inter).

## What the best work does

**Stripe's ribbon is a vertex-displaced plane, not a fullscreen shader.** Kevin Hufnagl's teardown (https://kevinhufnagl.com/how-to-stripe-website-gradient-effect/) and the recovered shader (https://gist.github.com/dkaraush/6cbf93eac983c777314445437d495672) show a tiny WebGL wrapper, four CSS colour variables, simplex noise in the vertex stage, colour layers blended with `pow(noise, 4)`, and an observer that switches it off offscreen. Bramus's Whatamesh packages it (https://www.bram.us/2021/10/13/how-to-create-the-stripe-website-gradient-effect/). One coloured object carries the brand while text stays on white.

**Linear's glow is CSS.** A reverse-engineering note (https://github.com/Stranglehold/Exocortex/blob/main/docs/ui_references/beyond_css/shaders.md) found a radial-gradient background plus a dot grid with opacity keyframed on 2.8 to 3.2 second cycles. Anthony Hobday (https://anthonyhobday.com/blog/20230119.html) adds light pulses streaking along a screenshot's edge and strip-light section dividers. Gavin Nelson's render notes (https://nelson.co/work/linear-renders) give the banding fix: 2% monochrome gaussian noise at 50% grey, set to overlay.

**Grain is a tile, never a live filter.** CSS-Tricks (https://css-tricks.com/grainy-gradients/) established `feTurbulence` plus contrast, brightness and blend modes. Gustavo Fior (https://craft.gustavofior.com/noise) and Gradiently (https://gradiently.design/guide/svg-noise-filter) measure the cost: `feTurbulence` recomputes per pixel on every repaint and can drop a phone to single-digit frame rates on a hero, so render a 240px tile once as a data URI, repeat it, keep three octaves, never animate `baseFrequency`. Ana Tudor (https://blog.master.dev/grainy-gradients/) uses the noise as a `feDisplacementMap` instead, so colour is not muddied. Arc overlays grain at 2 to 3% on every saturated band so flat colour reads as printed (https://pageproofer.com/inspiration/calm-minimal/arc/).

**Vercel's guides are gradients with a mask.** Rauno Freiberg (https://rauno.me/craft/nextjs) borrows Stripe's dotted line: a 1px `linear-gradient` at `background-size: 5px 1px` with a mask fading the ends. His Vercel essay (https://rauno.me/craft/vercel) sets rhythm rules: high-novelty motion never in two consecutive sections, loops paused with `animation-play-state` under reduced motion. Designing Depth (https://rauno.me/craft/depth) prefers staggered siblings and blurred backdrops to drop shadows.

**Joining is a filter graph.** The gooey effect (https://tympanus.net/codrops/2015/03/10/creative-gooey-effects/) is `feGaussianBlur`, then `feColorMatrix` with alpha row `19 -9`, then `feComposite atop`. Robin N (https://www.robinn.io/crafts/metaballs) explains why it reads as fusion: blur sums neighbouring alpha like a field, the matrix thresholds it, so two discs snap into one surface with a neck that stretches and breaks as they part. Filter the group and keep the area small.

**Flow and particles are cheap on 2D canvas.** Emergent Mind's flow field (https://www.emergentmind.com/visualizations/flow-field) runs two thousand particles on 3D Perlin noise with time as the third axis, veiling the canvas at 5% per frame so trails fade. Guillaume Couillard (https://guillaume-couillard.com/en/notes/flow-field-canvas) caps devicePixelRatio at 1.5 and stops when hidden. In three.js one `Points` object draws twenty thousand particles in one call (https://www.shanebrumback.com/tutorials/simple-particle-system.html).

**Rings animate with `@property`.** Registering `--angle` as `<angle>` lets a `conic-gradient(from var(--angle), ...)` border rotate without rebuilding the gradient, with the inner surface opaque so contrast never moves (https://gradiently.design/guide/css-property-animation). Draw-on strokes use `pathLength="1"` and an animated `stroke-dashoffset` (https://css-tricks.com/books/greatest-css-tricks/make-shape-draw/).

**Video brands restrain the chrome.** Runway is near-black, zero box-shadow, one typeface, all colour from footage (https://designbycurio.com/learn/runway-2024); Higgsfield sells lighting, logo idents and palettes held steady across clips (https://higgsfield.ai/ai-motion-design). Anthropic's identity by Geist (https://geist.co/work/anthropic) is our nearest cousin: cream canvas, serif voice, one clay accent used like a wax seal, hairlines instead of shadow (https://ai2.design/inspiration/anthropic). Henosis is warm and light: glow-on-black does not transfer; grain, mesh, goo and ink do.

## Ten elements for Henosis

1. **The Closing Ring** (logo reveal). Two SVG arcs with `pathLength="1"`, `stroke-dasharray: 1`, `stroke-dashoffset` 1 to 0 from opposite ends, staggered 120ms, 0.15s settle. Screen: splash and session first paint. Reads as: a person's arc and an agent's arc drawn toward each other until there is no seam.

2. **Fondant Mesh** (hero). A Whatamesh-style vertex-noise plane in Fondant, Apricot and Dress Blues at low amplitude, paused offscreen, with a static fallback of `radial-gradient` blobs under `filter: blur(60px)`. Screen: marketing hero only. Reads as: three colours that never resolve into separate regions.

3. **Paper Grain** (everywhere). A 240px `feTurbulence` tile (`baseFrequency 0.8`, 3 octaves, saturate 0) as a data URI on `::after`, `mix-blend-mode: soft-light`, opacity 0.08, `isolation: isolate`. Screen: every cream surface and apricot band. Reads as: one sheet of paper that people and agents write on together.

4. **Gooey Presence** (session header). Avatar discs for members and agents under one `filter: url(#goo)` group (`feGaussianBlur 8`, alpha matrix `20 -9`), moved with 2D transforms so joiners fuse. Screen: roster and the "who is here" pill. Reads as: presence as one body, with a neck that stretches when someone steps away.

5. **Confluence Field** (empty session). A 2D canvas flow field, 800 particles spawned from two edges in Fondant and Dress Blues, noise angles bent toward centre so trails braid into one apricot stream, 5% veil per frame, dpr capped at 1.5. Screen: empty state before the first message. Reads as: two currents becoming one river.

6. **Dotted Guides** (workspace chrome). `linear-gradient` dots at `background-size: 6px 1px` with a mask fading the ends, drawn between a person's column and an agent's. Screen: session canvas and timeline. Reads as: the seam is stitched, not walled.

7. **Turning Ring Focus** (interactive). `@property --angle` on `conic-gradient(from var(--angle), fondant, apricot, blues, fondant) border-box` beneath a cream `padding-box`, 8s linear, paused under reduced motion. Screen: whoever holds the active turn. Reads as: one ring passed around the table; colour circulates rather than changing hands.

8. **Ink Bloom Reply** (message arrival). An agent reply fades in under `feDisplacementMap` driven by the grain tile, `scale` animated 40 to 0 over 400ms so text settles from wash to crisp. Screen: chat stream. Reads as: thought arriving on the shared page, not a card dropping in.

9. **Dot Pulse Grid** (status band). Linear's trick in daylight: a CSS grid of 2px Fondant dots, each with its own opacity keyframe between 2.8 and 3.2s, brighter near active agents. Screen: dashboard header and activity strip. Reads as: a pulse that belongs to everyone, with no single source.

10. **Join Breath** (invitation and handoff). Two `radial-gradient` discs, Apricot and Dress Blues, on siblings animated with `transform: translateX` toward each other under `mix-blend-mode: multiply`, overlap producing Fondant. Screen: invite accepted, agent assigned, handoff confirmed. Reads as: the overlap is the brand colour; unity is what the two make together.

Cost rules: tile grain, never filter the viewport; animate only `transform`, `opacity` and typed custom properties; one WebGL surface per page at most; everything pauses offscreen or under reduced motion, and the still frame must look finished.
