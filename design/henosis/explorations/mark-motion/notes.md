# mark-motion · The mark in motion

Redone on the chosen mark: two arcs that swing in from apart (±70°) and close into one ring with a small
settle, then the centre appears. The older travelling-bead animation is gone.

## The idea
The animation is the tokens' own: `.mark.joining` with the `arc-a`, `arc-b` and `dot-in` keyframes from
`tokens.css`, 1.8 s, `cubic-bezier(.3,.9,.3,1)`. The person's arc starts at +70°, the agent's arc at −70°,
both at half opacity, both low; after a 270 ms hold they swing up about the centre, pass their rest by 4°,
come back through +2° and land at 0°; the centre scales in from 60 % (1 080 ms), pops to 1.25× at 80 % and
settles. The page shows it live at 16–256 px and on cream, as an eight-frame storyboard with a two-track
timeline (arcs, centre) and the keyframe table in ms and %, the easing curve, the rules, and the four homes
with Payments-team content: the loading screen (looping), the joined-the-circle line in the stream (once,
48 px) with its toasts, the rail brand on load (24 px small cut, once, then the cards rise in), and the
splash (160 px on the one gradient, wordmark rising as the centre appears). Resting states on navy, cream
and chocolate, the calm-mode tile and the 16 px favicon/tray close it.

## Keep
- The markup is `design/mark.svg` with the token classes (`.disc .arc.a .arc.b .dot`), so every mark on the
  page is the real mark and the animation is applied by adding `joining`. No page-level keyframes.
- The once-only run is just `animation-iteration-count: 1; animation-fill-mode: both` on `.mark.joining.once`;
  the loop and the once share one timing so the mark lands identically everywhere.
- The hold (0–15 %) is worth defending: it is what lets the eye read two arcs before they move. Without it the
  run reads as a spinner.
- The centre never appears before the ring is one (dot-in starts at 60 %, the arcs are within 4° by then).
- Join is a line in the stream, not a modal; the newcomer's avatar ripples as the centre appears (+1.3 s).
  Leaving is a quiet divider with no motion: the ring does not open again.
- Calm mode and `prefers-reduced-motion`: `animation: none` on the same markup gives the closed ring from the
  first frame. The page adds `[data-motion="calm"]` as a selector because the tokens' media query
  `(data-motion="calm")` is not valid CSS and never matches.
- Below 24 px there is no swing (the arcs are 2–3 px); the closed mark fades in over 200 ms.
- For the stills, the once-only marks and the rise cascade are offset with a page-level `--t0` / `--d` so a
  screenshot lands mid-run; the real delays stay written in the CSS.

## Open questions
- At 0 % the two arcs overlap for 140° at the bottom of the ring (each is a half ring rotated 70° towards the
  other) and blend at half opacity. It reads as "two arcs resting together" at 96 px and up, but at 48 px
  the overlap is a muddy crescent for the first 300 ms. Options: start at ±60°, or start the arcs at opacity
  .35 and bring them to .5 during the hold. Needs a look at real frame rate on a laptop.
- `tokens.css` `--mark-arc-a` is `var(--accent)`, apricot in dark mode: both arcs go one colour. This page
  pins the arc colours at `:root`; the token should be a brand constant.
- `tokens.css` `.avatar.agent` collides with the rail `.agent` card class (padding, flex column) and breaks
  every agent avatar; this page overrides it locally, the token should rename one of them.
- Should a session reconnecting loop the full swing, or only pulse the centre, so the swing is reserved for
  first loads and joins? The reconnecting toast currently loops the swing at 32 px.
- Exit from the loading screen: finish the current loop's settle (up to 1 s of waiting) or cut straight to
  the stream? The page says finish the settle.
- The storyboard angles were computed from the keyframes (bezier sampled at 0, 15, 25, 35, 60, 70, 80,
  100 %); if the keyframes change, the frames and the timeline must change together. A single source of
  truth in the design folder would help.
