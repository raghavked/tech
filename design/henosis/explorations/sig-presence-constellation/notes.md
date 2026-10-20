# sig-presence-constellation · The presence constellation

The team page header draws the team as a sky. Every open session is a ring. Its members, the people
and the agent, sit on the ring as points, and each present member draws the arc centred on itself,
halfway to each neighbour, in its own colour: a person's arc chocolate, an agent's arc navy on cream.
A session of one person and one agent is therefore exactly the mark, two arcs closing into one ring,
drawn from real presence. A person in two sessions sits where the two rings meet: two shared people
make the rings overlap (Billing page and Checkout, held by Ana and Bo, are a vesica), one shared person
makes them touch (Dee is the point where Invoice PDF and Tax lines kiss). The baton holder is the bright
point with the driver ring. An away member's share of the ring is a dotted guide, so the ring is open
where someone is missing, and the apricot centre lands only while the ring is whole. Crews stitch their
agents with a dotted thread under the rings. One sentence beneath reads the sky aloud.

Files: `index.html` (self-contained: tokens inlined, light and dark via `prefers-color-scheme` and
`[data-theme]`, every animation under the one guard with `[data-motion="calm"]` and
`prefers-reduced-motion`, Fraunces/Inter asked first with Instrument and system fallbacks, no external
assets, no fonts fetched), `light.png`, `dark.png` (1440×900), `phone.png` (390×844).

## What it is

| Part | Drawing | Meaning |
|---|---|---|
| A ring | r 58 (48 on the phone), hairline arcs 1.6 px with round caps and a 3 px seam where two arcs meet | an open session |
| A person's arc | chocolate `#56352D` at .78; `--accent-ink #CAA49B` at .82 on the dark canvas | this person is here |
| An agent's arc | navy `#2A3244` at .66; apricot at .58 at night; a paused agent's arc at .45 | the agent is in the session |
| The baton holder | the point at r 5.5 in `--cst-bright` (chocolate by day, cream by night), the 2 px apricot-deep ring that `.avatar.driver` already wears, a 2.4 px arc, and the halo that breathes | who is driving |
| A person | a 4.6 px point; away: a hollow point at .55 and a dotted guide where their arc would be | here / away |
| An agent | the 11 px rounded square with the tight bottom-left corner (SYSTEM §12) with the status dot on its outer corner: green running, amber awaiting, slate paused | the agent and its state, the colour in the dot, the word in the label |
| The centre | a 4 px apricot dot at the ring's centre, only while every member is present | the circle is whole |
| Shared points | two shared people: a vesica (d = 1.12 r, the people at the two intersections); one: the rings touch at that person | the same person in two sessions |
| The crew thread | a dotted quadratic between crew-mates' agents bowing under the rings, the crew name in italic serif `--accent-ink` with the rail's hollow apricot ring | a crew |
| Names | people in serif beside their point, outward from the ring; a session's name inside its ring when the free chord holds it, else outside on the free side | named things are serif (SYSTEM §1.6) |
| The reading | "Ana has the baton in *Billing page*, Bo in *Checkout*, Cy in *Invoice PDF*. *Invoice PDF* and *Tax lines* wait for Dee, away since `09:47`." · on hover or focus the member's own line: "Bo Lindqvist · member · in *Billing page* with Ana · has the baton in *Checkout* · 4.6k tokens" | state in words beside every colour (SYSTEM §18) |

Hover or focus a point and the rest of the sky dims to a fifth while the member's rings, arcs and any
crew thread stay lit; the points are links in reading order (left to right), each with the sentence as
its accessible name, a `<title>` tooltip and a drawn focus ring in `--focus-ring` (chocolate by day, cream
by night). The figure itself carries the resting sentence as its label; the figcaption is `aria-live`.

The exploration carries a small **inspector** in the topbar (Dee returns / leaves, Pass the baton, Calm,
Dark). It is the exploration's own control and is not part of the design; the app does not ship it.

## Why it is ours

- **It is the mark, drawn from the room.** Person = chocolate, right; agent = navy on cream, apricot on
  the dark canvas; the centre is the lightest colour present and appears only once the ring is one
  (SYSTEM §5's colour-by-ground table; MOTION §8). The two-member case reproduces the mark's geometry
  with the person's arc on the right by construction, so the brand is not placed on the page, it is the
  page's data. presence-and-agents §1 (the arc pointer: "when two pointers rest on the same element the
  second arc draws in and the ring closes") and §9 (the agreement ring: consensus as the closed shape),
  premium-product-ui §2 and three-colour-brands §2 (the two-arc ring as the "who is here" indicator) and
  data-craft §10 (the session ring as data) all asked for this; the constellation is their union as one
  header.
- **One stack, one grammar.** People and agents are points on the same ring, differing only in shape and
  hue (presence-and-agents §4 "nobody is in a separate list"; Atlassian AMP's reserved shape for agents,
  cited in ai-interfaces-avoid and premium-product-ui: the circle stays human, the agent keeps its
  rounded square with the tight corner from the avatar system). There is no agent panel and no robot icon.
- **The baton is the driver ring.** The bright point wears the same 2 px apricot-deep ring as
  `.avatar.driver` (SYSTEM §12), so the sky and the presence stack say "Bo has the baton" with one mark.
  Apricot keeps its one meaning: the baton's halo and the centre are the pulse, alive (SYSTEM §1.2);
  the only chocolate that moves is nothing here, because nothing here is a primary action.
- **Motion means joining or living (BRIEF, MOTION §1).** The sky does not animate on navigation. The two
  things that breathe are the baton holder's halo and a running agent's halo (the `dot-live` gesture,
  1.8 s). A join follows the join timeline (MOTION §7): the newcomer's arcs draw (450 ms), the point pops
  and ripples (320 / 900 ms), and the centre lands with `dot-once` only after the ring is one. Leaving is
  no motion: the ring simply opens. Passing the baton pops the ring on the new holder; nothing travels
  around the ring (MOTION §8: the bead is retired). Calm and reduce show a finished drawing with every
  arc at `stroke-dashoffset: 0` and no halo.
- **The still frame is finished.** Rest is the end state (MOTION §1.2, §3, §11): the screenshot is the
  rest state, not a frame from the middle. The Apple criterion in motion-choreography (keep motion that
  carries meaning, stop ongoing motion, avoid sustained oscillation near 0.2 Hz) holds: the halos are the
  only loops, at 0.55 Hz, 20 px wide, and they stop entirely under Calm.
- **Data craft, not decoration.** Hairlines, no fills, no frame (data-craft §1: word-sized, data-ink
  ratio near 1); names at the tips of their own marks in one serif, no legend (data-craft §8); the
  layout is deterministic, so the same team sees the same sky and a manager learns where Billing lives.
  The dotted guide for an away member and the dotted crew thread are generative-visuals §6's dotted
  guides: "the seam is stitched, not walled".
- **It is not Claude's, ChatGPT's or Linear's.** Neither has a header that draws who is here; Linear's
  presence is an avatar pile, Claude's and ChatGPT's is nothing. A sky of brand arcs with the navy frame
  beside it and the cream page under it belongs to a product whose mark is two arcs closing. No sparkle,
  no purple, no dot grid, no glow-on-black (ai-interfaces-avoid §6; three-colour-brands "take the
  discipline, not the hue").

## The technique

- **Inline SVG, not canvas.** 69 nodes and 7.3 KB of markup for four sessions and eight members; every
  point is a focusable `<a>` with a native tooltip and an accessible name, which a canvas cannot give
  without a parallel DOM. SVG `<text>` inherits the page's font tokens and `paint-order: stroke` with a
  canvas-coloured 4 px stroke keeps a name legible where it crosses an arc.
- **The layout is a chain solver, not physics** (~90 lines). Consecutive sessions that share a person
  form a chain; inside a chain the centre distance is `1.12 r` for two shared people (a vesica) and `2 r`
  for one (a kiss); shared people take the intersection angles (`±acos(d / 2r)`, the first listed on top);
  the remaining members, the agent first, spread evenly through the widest free gap; with no shared
  people the person sits at 0° and the agent at 180°, the mark's own pose. Radius starts at 58 and steps
  down to 48 to fit the band; chains that still do not fit wrap into rows (the phone). Session names go
  inside the ring when `min(d_left, d_right, 2r) ≥ textWidth + 16`, else outside on the free side.
- **Each member owns the arc centred on itself**, from the midpoint to the previous member to the
  midpoint to the next, with a 3 px seam at each end. The shares are computed over every member, present
  or not, so an away member's share is exactly the gap, drawn as the dotted guide. Arcs carry
  `pathLength="1"` so the draw animation is one keyframe (`stroke-dashoffset: 1 → 0`) at any size.
- **Colour reaches the drawing only through custom properties**: `--cst-person`, `--cst-agent`,
  `--cst-bright`, `--cst-baton`, `--cst-centre`, `--cst-guide`, `--cst-thread` and the two rest alphas, set
  in the light block and both dark blocks. The sky has no colours of its own; a team look that retints
  the hand retints the people's arcs. The rail's mark is a `<use>` whose symbol reads `--mark-*` itself,
  which is SYSTEM §5's rule and the reason the first shot showed a plain disc.
- **The guard.** Every animation sits inside `@media (prefers-reduced-motion: no-preference) {
  :root:not([data-motion="calm"]) { … } }`; rest states (`stroke-dashoffset: 0`, halo `opacity: 0`,
  the ripple absent) are written outside it. The script reads `--motion` from `<html>` to decide
  whether to wait 1.9 s before dropping the join classes, never `animationend` (MOTION §3).
- **Hover and focus are one state**: `pointerenter` / `focus` add `.dim` to the sky and `.hot` to the
  member, its rings' arcs, guides, centre and name, and any crew thread naming it; `pointerleave` / `blur`
  clear. Opacity only, on `--t` (200 ms), so Calm makes it instant.

## The cost

Measured headless (Chromium, 1440×900 and 390×844).

| Situation | DOM | per frame | notes |
|---|---|---|---|
| Render (layout + markup) | 69 SVG nodes, 7.3 KB | once per resize | ResizeObserver; a resize to the same width is a no-op (0.001 ms) |
| At rest, full motion | 5 compositor animations in the sky (3 baton halos, 2 running halos; transform + opacity only) + the rail's two running dots | 0 ms script | no `requestAnimationFrame`, no per-frame JS at all |
| Hover / focus | class toggles on ≤ 30 nodes | 0 ms after `--t` | opacity transitions only |
| A join | 8 more animations for 1.9 s | 0 ms script | one `setTimeout` to drop the classes |
| Calm or reduce | 0 animations | 0 | verified with `document.getAnimations().length === 0` after a join under Calm, arcs at `0px` |

Nothing allocates after render; the sky costs what a static illustration costs, plus five tiny
transform loops the compositor runs.

## How it ports into `apps/web`

The team page already has the data: `views/Team.tsx` builds `people` (with `online`), `agents` (each
`SessionRow` with `people[].online`, `people[].driving`, `crew`, `live`) and `crews`. The header is
`.lede` in that file: serif `h1`, the `.seg.range` control, the `.lede-line`. The constellation is one
new component rendered between `.lede-head` and `.lede-line`.

1. **`apps/web/src/constellation.ts`** (new): the layout and markup from `index.html`'s `<script>` as
   pure functions: `layoutSky(sessions, width) → { circles, r, height }` and `renderSky(...) → string`
   (or JSX; the string is 7 KB and the markup is static per state, so `dangerouslySetInnerHTML` on a
   memo is fine and keeps the SVG string testable). Input type:
   `{ id, title, status, baton: string | null, members: string[], crew?: string }[]` plus
   `{ id, name, online, since? }` for people. Derive from `Team.tsx`: `baton = s.people.find(p => p.driving)?.id ?? null`,
   `members = s.people.map(p => p.id)`, `online` from the `people` map it already builds.
2. **`apps/web/src/ui.tsx`**: a `Constellation` component (`<figure class="constellation">` with the
   `<div class="band">`, the `ResizeObserver`, the hover / focus wiring and the `<figcaption
   class="reading" aria-live="polite">`). It reads `useMotion()` for the join timeout instead of the
   exploration's `--motion` probe, and takes `justJoined` (the id `ui.tsx` already keeps for the avatar
   ripple) to set `.joined` / `.draw` / `.settle` on one render. The reading line's sentences move to
   `copy.ts` under `copy.team.sky` ("has the baton in", "wait for", "away since", "joins the circle",
   "Every circle is whole.").
3. **`apps/web/src/views/Team.tsx`**: render `<Constellation sessions={…} people={…} />` inside
   `.lede` after `.lede-head`. The hover sentence replaces nothing; the `.lede-line` stays beneath it.
   Points link to `paths.session(projectId, sessionId)` for agents and to the roster row for people.
4. **`apps/web/src/tokens.css`**: the nine `--cst-*` properties in the light block and both dark blocks
   (values in `index.html`'s `:root` and dark blocks). `--cst-person` should follow `--team-hand` in
   `theme.ts`'s `applyTeamTheme` so a team look retints the people's arcs; the agent's arc and the
   centre stay brand constants like `--mark-arc-b` and `--mark-dot`.
5. **`apps/web/src/styles.css`**: the rules under "the constellation" in `index.html` (`.constellation`,
   `.cst …`, `.reading`) and, in the motion block under the one guard, the three keyframes
   (`cst-breathe`, `cst-draw`, `cst-ripple`; `dot-once` and `pop` already exist) with their rest states
   outside the guard.

Accessibility (SYSTEM §18, MOTION §11): the figure is labelled with the resting sentence; each point is a
link whose name is its sentence; the status word lives in that sentence, the colour only in the dot;
the focus ring is `--focus-ring`, never the pulse; nothing flashes (the halos are 0.55 Hz); the reading
line is polite live text; under Calm the drawing is complete.

## Open

- **Many sessions.** The chain solver is right for a team of four to eight sessions. Past two rows the
  header should fold to the busiest chains with "+3 sessions" in the reading line, or the sky should
  become the project page's, one per project. Decide the cap (eight rings?) on the fleet board.
- **Three shared people.** Two rings sharing three people have only two intersection points; the third
  should sit on the vesica's inner arc. Not needed for the cast; the solver currently places the extra
  members in the free gap.
- **The first load.** The sky does not animate on navigation (MOTION §4.4: never on navigation). A cold
  open could draw the rings once, 120 ms apart, as the rail's brand closes; the brief's "motion means
  joining" argues against it, and the join already shows the gesture. Left off.
- **Touch.** Hover is the tooltip; on the phone a tap on a point should open the member's row rather
  than only reading the sentence. The sentence should also sit under the sky on the phone exactly as it
  does, since there is no tooltip there.
- The text-width estimate (`0.5 em` per character) decides inside / outside placement without measuring;
  the app can measure once with `getComputedTextLength` after the first paint if a long session name
  ever misplaces.
