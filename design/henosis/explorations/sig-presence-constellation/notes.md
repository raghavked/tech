# sig-presence-constellation · The presence constellation (take 3)

The team page header draws who is here. Every open session is a hairline ring. Its members, the people
and the agent, are the points on the ring, and each present member draws the arc of the ring centred on
itself in its own colour: a person's arc chocolate, an agent's arc navy on cream (apricot on the navy
canvas at night). A session of one person and one agent is therefore the mark itself, two arcs closing
into one ring, drawn from presence rather than placed on the page. A person in two sessions sits where
the rings cross: two shared people make the rings a vesica (Billing page and Checkout, held by Ana and
Bo), one shared person makes them kiss (Dee is the point where Invoice PDF and Tax lines touch). The
baton holder is the brightest point: larger, in the hand's colour, wearing the driver ring, breathing an
apricot halo. An away member's share of the ring is a dotted guide, so the ring is open where someone is
missing, and the apricot centre lands only while the ring is whole. Crews stitch their agents with a
dotted bow under the rings, the crew's name set along it. One sentence beneath reads the sky aloud;
hovering, focusing or tapping a point reads that member's own.

Take 3, rebuilt from scratch after `_judge-signature-1/2/3.md` (7.5 → 8.0 → 7.75, "ship after the dark
avatars"). What is new or fixed against the panels' notes:

- **Night is legible.** Hairlines are 1.9 px at night (1.6 by day), a person's arc is the hand-as-text
  `#CAA49B` at full opacity, an agent's is apricot at .8, the guides and the stitch sit at .36 / .62, and
  the holder's point is cream. The panel's "the sky's hairline rings go faint" is answered in `dark.png`.
- **Avatars keep their initials in both themes.** `.avatar.t1–t4` set the glyph colour with their fill
  (`#2A3244` on the four light tints), never `var(--ink)`; the agent tile is `--agent-bg` (`#2A3244` by
  day, `#3A4458` at night, SYSTEM §2.9) with the apricot centre.
- **Nothing animates on load** (MOTION §6.9: the overview opens still). Take 2's `card-in` on the
  needs-you cards is gone. What moves at rest is the holders' breath and the running dots.
- **The rail's brand arc takes the 62 % lift** toward apricot on navy at 24 px (`#AD8E78`, SYSTEM §5).
- **Bigger rings.** The radius runs from 104 down to 44 and the solver keeps the fewest rows at the
  largest radius that fits them. At 1440 the sky is one row at r 88 (the labels, not the rings, set the
  cap: measured widths below); at 1180 one row at r 56, which is where the app's rail folds to 72 px and
  gives the band its width back (SYSTEM §4); on the phone two rows at r 44 with the crew's name under a
  deeper bow. A header never trades a row for a bigger ring: two rows at r 104 measured 545 px tall.
- **Arrow keys walk the points** in reading order inside the figure; Tab still enters and leaves it.
- **The exploration's inspector is hidden** unless the URL carries `#inspector`, so every still shows the
  product's topbar.
- **`.main { overflow: clip }`** keeps the blurred wash from widening the phone (`scrollWidth` 390 at 390).

Files: `index.html` (self-contained: tokens inlined, light and dark via `prefers-color-scheme` and
`[data-theme]`, every animation under the one guard with `[data-motion="calm"]` and
`prefers-reduced-motion`, Fraunces / Inter asked first with the Instrument faces and the system's serif,
sans and mono as fallbacks, no external assets, nothing fetched), `light.png`, `dark.png` (1440 × 900),
`phone.png` (390 × 844).

## What it is

| Part | Drawing | Meaning |
|---|---|---|
| A ring | r 88 on the 1440 desktop (104 cap, 44 floor); arcs 1.6 px by day, 1.9 at night, round caps, a 4.5 px seam where two arcs meet | an open session |
| A person's arc | chocolate `#56352D` at .86; `--accent-ink #CAA49B` at 1 on the dark canvas | this person is here |
| An agent's arc | navy `#2A3244` at .74; apricot at .8 at night; a paused agent's arc at .45 | the agent is in the session |
| The baton holder | a 6.6 px point in `--cst-bright` (chocolate by day, cream by night), the 2 px apricot-deep driver ring `.avatar.driver` already wears, a 2.6 px arc, and the halo that breathes | who is driving, brighter than anyone |
| A person | a 5 px point; away: a hollow point and a dotted guide where their arc would be | here / away |
| An agent | the 14 px rounded square with the tight bottom-left corner (SYSTEM §12) with the status dot on its outer corner: green running (its own halo breathes), amber awaiting, slate paused | the agent and its state; the colour in the dot, the word in the label |
| The centre | a 3.8 px apricot dot at the ring's centre while every member is present; a dashed ghost centre otherwise (MOTION §8) | the circle is whole / someone is missing |
| Shared points | two shared people: a vesica (d = 1.12 r, the people at the two intersections, the first listed on top); one: the rings kiss at that person | the same person in two sessions |
| The crew stitch | a dotted quadratic between crew-mates' agents bowing under the rings, the crew's name in italic serif on a `<textPath>` (above the bow on the desktop, under a deeper bow on the phone) | a crew |
| Labels | the name in 16 px serif beside its point, outward from the ring; beneath it the state in 12 px sans: *has the baton*, *here*, *away since* `09:47`, *running*, *awaiting approval*, *paused* | named things are serif, state in words beside every colour (SYSTEM §1.6, §18) |
| The reading | "Ana has the baton in *Billing page*, Bo in *Checkout*, Cy in *Invoice PDF*. *Invoice PDF* and *Tax lines* wait for Dee, away since `09:47`." · on hover or focus: "Bo Lindqvist · member · in *Billing page* with Ana · has the baton in *Checkout* · `4.6k` tokens" · when everyone is in: "… Every circle is whole." | the manager's sentence |

Hover or focus a point and the rest of the sky dims to a fifth while the member, its rings (arcs,
guides, centre), the other members of those rings at 62 % and any crew stitch naming it stay lit.
Points are links in reading order (Ana, Bo, Billing page, Checkout, Cy, Dee, Invoice PDF, Tax lines);
each carries its sentence as its accessible name and a `<title>` tooltip, a 32 px hit circle, and a
drawn focus ring in `--focus-ring`; ← → move between them. A click or tap opens the member's row in the
roster beneath (the row takes `--select-wash` with the `--select-line` ring: "where you are", SYSTEM
§1.2), so the sky is navigation, not only a hero. The figure carries the resting sentence as its label;
the figcaption is `aria-live="polite"`.

## Why it is ours

- **It is the mark, drawn from the room.** Person = chocolate, agent = navy on cream and apricot on the
  navy canvas, the centre the lightest colour present and only once the ring is one (SYSTEM §5's
  colour-by-ground table, MOTION §8). A lone session takes the mark's own pose by construction, the
  person on the right, the agent on the left. Four memos asked for this from four sides and the sky is
  their union: presence-and-agents §1 (the arc pointer: "two pointers on one element rotate to close the
  ring") and §9 (the agreement ring: consensus as the brand's closed shape); three-colour-brands §3
  ("closing-ring presence … the brand mark is the live state of the room"); data-craft §10 (the session
  ring as data: "two arcs, two kinds of participant, one whole"); motion-choreography §1 ("the ring closes
  only when both are present"). What none of them had, and what the panels called the one drawing that
  could only be Henosis: the same person on two rings, at the intersection.
- **One stack, one grammar.** People and agents are points on the same ring, differing only in shape and
  hue; there is no agent panel, no robot, no sparkle (presence-and-agents §4 "nobody is in a separate
  list"; Atlassian AMP's reserved shape for agents and the "no badge, no sparkle" rule in
  ai-interfaces-avoid §6; Linear's agents-as-users in premium-product-ui). Circles stay human; the agent
  keeps the rounded square with the tight corner from the avatar system.
- **The baton is the driver ring.** The bright point wears the same 2 px apricot-deep ring as
  `.avatar.driver` (SYSTEM §12), so the sky, the rail's stacks, the topbar stack and the roster say "Bo
  has the baton" with one mark (Tuple's ring on whoever holds the keyboard, presence-and-agents). Apricot
  keeps its one meaning (SYSTEM §1.2): the halo and the centre are the pulse, alive; nothing here is a
  primary action, so no chocolate fills anything but the holder's point.
- **Motion means joining or living** (BRIEF, MOTION §1). The sky does not animate on navigation. The
  things that breathe are the holders' halos and the running agents' status dots (1.8 s, 0.55 Hz, well
  under Apple's 0.2 Hz oscillation warning in motion-choreography and MOTION §11.5's 3 Hz ceiling). A
  join follows the join timeline (MOTION §7): the newcomer's arcs draw (450 ms), the point pops and
  ripples (320 / 900 ms), and the centre lands with `dot-once` only after the ring is one. Leaving is no
  motion: the ring simply opens. Passing the baton pops the driver ring on the new holder; nothing
  travels around the ring (MOTION §8). Under Calm and reduce the drawing is finished (measured below).
- **Annotation instead of apparatus** (data-craft §8, Datawrapper's outlined direct labels): names at the
  tips of their own marks in one serif with `paint-order: stroke` in the canvas colour, no legend, no
  frame, no axis; the state word under each name is the chart's annotation; the layout is deterministic,
  so the same team sees the same sky every morning and learns where Billing lives. The dotted guide for
  an away member and the dotted crew stitch are generative-visuals §6's stitched guides: "the seam is
  stitched, not walled". The crew's name on the stitch is the one star-chart gesture, a constellation
  named along its own line.
- **Editorial type by register** (editorial-type §2, §4, §5): Fraunces asked first for everything that has
  a name (people, agents, sessions, the crew), Inter for the state words and the sentence, JetBrains Mono
  for `09:47` and the token counts; lining numerals in the sky; `font-optical-sizing: auto`.
- **It is not Claude's, ChatGPT's or Linear's.** None of them has a header that draws who is here;
  Linear's presence is an avatar pile, Claude's and ChatGPT's is nothing. Brand arcs on cream beside a
  navy frame belong to a product whose mark is two arcs closing. No purple, no dot grid, no glow-on-black,
  no gradient but the rail's New session (ai-interfaces-avoid §4; three-colour-brands: "take the
  discipline, not the hue"; SYSTEM §1.7, §1.10).

## The technique

- **Inline SVG, not canvas.** 92 nodes and 8.3 KB of markup for four sessions and eight members; every
  point is a focusable `<a>` with a native tooltip and an accessible name, which a canvas cannot give
  without a parallel DOM. SVG `<text>` inherits the page's font tokens; `paint-order: stroke` with a
  canvas-coloured 4 px stroke keeps a name legible where it crosses an arc; the crew name is a
  `<textPath>`.
- **The layout is a chain solver, not physics** (~120 lines, pure). Sessions that share a person form a
  chain, adjacent in the input or not (a greedy pre-pass appends any unplaced session sharing a person
  with the chain's last). Inside a chain the centre distance is `1.12 r` for two shared people (a vesica)
  and `2 r` for one (a kiss); shared people take the intersection angles (`±acos(d / 2r)`, the first
  listed on top); the agent sits at the middle of the largest free gap, or at the foot of its ring (90°)
  when it is in a crew and every other point is at least 50° away, so the stitch bows under the sky; the
  remaining people spread evenly through the largest gap left; a lone ring takes the mark's pose. Label
  direction is the sum of the outward normals of the point's rings (straight up at a kiss, where they
  cancel); a crew'd agent's label points away from its crew-mate. Extents are estimated from character
  counts (0.5 em serif, 0.56 em sans: safe for Fraunces, which is wider than the stills' fallback; the
  measured widths at 1440 are "awaiting approval" 97 px, "has the baton" 75, "Billing page" 64) and rows
  are centred.
- **Rows.** The radius is the largest from 104 down to 44 that keeps the fewest rows with every chain
  inside the band (1440: one row at 88; 1180: one row at 56; 390: two rows at 44). Chains that do not
  fit a row wrap; a header never takes an extra row to grow its rings.
- **Each member owns the arc centred on itself**, from the midpoint to the previous member to the
  midpoint to the next, with a 4.5 px seam at each end; the shares are computed over every member, present
  or not, so an away member's share is exactly the gap, drawn as the dotted guide. Arcs carry
  `pathLength="1"` so the draw animation is one keyframe (`stroke-dashoffset: 1 → 0`) at any size.
- **Colour reaches the drawing only through custom properties**: `--cst-person`, `--cst-agent`,
  `--cst-bright`, `--cst-baton`, `--cst-centre`, `--cst-guide`, `--cst-thread`, `--cst-halo`, the two
  rest alphas and the two widths, set in the light block and both dark blocks. The sky has no colours of
  its own; a team look that retints the hand retints the people's arcs. The rail's mark is a `<use>` whose
  symbol reads `--mark-*` itself (SYSTEM §5).
- **The guard.** Every animation sits inside `@media (prefers-reduced-motion: no-preference) {
  :root:not([data-motion="calm"]) … }`; rest states (`stroke-dashoffset: 0`, halo `opacity: 0`, the
  ripple absent, the centre at scale 1) are written outside it. The script reads `--motion` from `<html>`
  to decide whether to wait 1.9 s before dropping the join classes, never `animationend` (MOTION §3).
- **Hover and focus are one state**: `pointerenter` / `focus` add `.dim` to the sky and `.hot` / `.warm`
  to the member, its rings and the stitch; `pointerleave` / `blur` clear. Opacity only, on `--t` (200 ms),
  so Calm makes it instant. A click adds `.here` to the roster row for 2.4 s and lets the hash scroll.

## The cost

Measured headless (Chromium, 1440 × 900 light, 1440 × 900 dark under `prefers-reduced-motion: reduce`,
390 × 844).

| Situation | DOM | per frame | notes |
|---|---|---|---|
| Render (layout + markup) | 92 SVG nodes, 8.3 KB; sky 1040 × 240 at 1440, 358 × 330 on the phone | once per resize | `ResizeObserver`; a resize to the same width is a no-op |
| At rest, full motion | 12 compositor animations on the page: 3 holder halos (transform + opacity), 2 running-dot halos in the sky, 2 running dots in the rail, 5 in the roster and stack | 0 ms script | no `requestAnimationFrame`, no per-frame JS; names: `cst-breathe`, `cst-pr-live`, `dot-live` |
| Hover / focus | class toggles on ≤ 30 nodes | 0 ms after `--t` | opacity transitions only |
| A join (Dee returns) | 20 animations for 1.9 s (`cst-draw`, `pop`, `cst-ripple`, `dot-once` added), one `setTimeout`, then 14 at rest (one more holder, one more running dot) | 0 ms script | the markup is re-rendered once before and once after; every centre present afterwards (4 centres, 0 ghosts) |
| Calm or reduce | 0 animations before, during and after a join; every arc at `0px` dashoffset; halos at opacity 0 | 0 | the reading sentence still changes: "Every circle is whole." |
| Overflow | `scrollWidth` 1440 at 1440, 390 at 390 | | `.main { overflow: clip }` |

Nothing allocates after render; the sky costs what a static illustration costs, plus the halos and dots
the compositor runs.

## How it ports into `apps/web`

The team page already has the data: `apps/web/src/views/Team.tsx` builds `people` (a `Map` with
`online`), `agents` (each `{ d, s: SessionRow, owner }` with `s.people[].online`, `s.people[].driving`,
`s.crew`, `s.live`) and `crews`. The header is `.lede` in that file: the serif `h1`, the `.seg.range`
control, the `.lede-line`. The constellation is one new component rendered between `.lede-head` and
`.lede-line`.

1. **`apps/web/src/constellation.ts`** (new): the layout and markup from `index.html`'s `<script>` as pure
   functions: `chainsOf`, `layoutChain`, `layoutSky(sessions, people, width) → { rows, r, height }` and
   `renderSky(layout, width, opts) → string` (the markup is static per state, so a memoised
   `dangerouslySetInnerHTML` keeps the SVG string unit-testable with Vitest next to `glance.test.ts`).
   Input type: `{ id, title, status, word, doing, baton: string | null, members: string[], owner, mode,
   tokens, crew? }[]` plus `{ id, name, full, role, online, since?, tokens }` for people. Derive in
   `Team.tsx` from what it already has: `baton = s.people.find(p => p.driving)?.id ?? null`,
   `members = s.people.map(p => p.id)`, `online` from the `people` map, `word` from `copy.status`,
   `tokens` from `compactTokens(s.report.usage)`.
2. **`apps/web/src/ui.tsx`**: a `Constellation` component (`<figure class="constellation">` with the
   `<div class="band">`, the `ResizeObserver`, the hover / focus / click / arrow-key wiring and the
   `<figcaption class="reading" aria-live="polite">`). It reads `useMotion()` (exported from `ui.tsx`,
   defined in `theme.ts`) for the join timeout instead of the exploration's `--motion` probe, and takes
   `justJoined` (the id `ui.tsx` already keeps for the avatar ripple) to set `joined` / `drawFor` /
   `joinedRings` on one render. The sentences move to `copy.ts` under `copy.team.sky` ("has the baton
   in", "wait for", "away since", "Every circle is whole.", "here", "has the baton").
3. **`apps/web/src/views/Team.tsx`**: render `<Constellation sessions={…} people={…} />` inside `.lede`
   after `.lede-head`; the `.lede-line` stays beneath it. Points link to `paths.session(projectId,
   sessionId)` for agents and to the roster row (`#roster-<id>`, the grid at the foot of the page) for
   people; the row's `.here` wash is the `rowitem` highlight the page already uses for "where you are".
4. **`apps/web/src/tokens.css`**: the eleven `--cst-*` properties in the light block and both dark blocks
   (values in `index.html`'s `:root` and dark blocks), plus `--agent-bg`. `--cst-person` should follow
   `--team-hand` in `theme.ts`'s `applyTeamTheme` so a team look retints the people's arcs; the agent's arc
   and the centre stay brand constants like `--mark-arc-b` and `--mark-dot`.
5. **`apps/web/src/styles.css`**: the rules under "the constellation" in `index.html` (`.constellation`,
   `.sky …`, `.reading`) and, in the motion block under the one guard, the three keyframes
   (`cst-breathe`, `cst-pr-live`, `cst-draw`, `cst-ripple`; `dot-once`, `pop` and `dot-live` already
   exist) with their rest states outside the guard. The avatar fix travels with it: `.avatar.t1–t4` set
   their glyph colour with their fill, never `var(--ink)`.

Accessibility (SYSTEM §18, MOTION §11): the figure is labelled with the resting sentence; each point is a
link whose name is its sentence, with a 32 px hit area and arrow-key movement; the status word lives in
the label and the sentence, the colour only in the dot; the focus ring is `--focus-ring`, never the
pulse; nothing flashes (the breaths are 0.55 Hz); the reading line is polite live text; under Calm the
drawing is complete; the hairlines are 3 : 1 or better on both canvases (chocolate .86 on cream,
`#CAA49B` on `#1A202C` at 7.2 : 1).

## Open

- **Many sessions.** The chain solver is right for a team of four to eight sessions. Past two rows the
  header should fold to the busiest chains with "+3 sessions" in the reading line, or the sky should
  become the project page's, one per project. Decide the cap (eight rings?) on the fleet board.
- **Three shared people.** Two rings sharing three people have only two intersection points; the third
  should sit on the vesica's inner arc. Not needed for the cast; the solver places extra members in the
  free gap.
- **The first load.** The sky does not animate on navigation (MOTION §4.4, §6.9). A cold open could draw
  the rings once, 120 ms apart, as the rail's brand closes; the brief's "motion means joining" argues
  against it, and the join already shows the gesture. Left off.
- **Touch.** On the phone there is no hover; the tap opens the row, and the sentence sits under the sky
  exactly as it does on the desktop. A long-press could read the member's sentence without leaving the
  sky (the 400 ms long-press ring, MOTION §11.9).
- **Label widths** decide the radius more than the rings do (at 1440 the cap is r 88 because
  "awaiting approval" and "has the baton" sit beside their points). The app can measure once with
  `getComputedTextLength` after the first paint, or shorten the state words on narrow bands ("awaiting").
- **Fraunces versus Instrument** is still the system's open decision (judge, "three things to say
  once"); the stills were rendered with the serif fallback, and Fraunces will set the names a little wider.
