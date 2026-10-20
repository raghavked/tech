# Judge panel · signature · 2 (front-end lead: craft, performance, accessibility)

Theme: **signature elements** (the twelve `sig-*` folders). Judged against BRIEF.md and tokens.css
v5 from the seat of the person who would have to build, measure and ship each one in `apps/web`.
Every `index.html` and `notes.md` was read; `light.png` and `dark.png` (and the `-now`, `frame-*`,
`phone*` and `print` shots where present) were opened and read. Because the notes make performance
and accessibility claims, each page was also run headless (Chromium, Playwright, 1440×900 light and
dark, 390×844 touch, and once more under `prefers-reduced-motion: reduce`) to check what the notes
say: running animations with and without the guard, console errors, horizontal overflow, control
count under 24 px, accessible names, and a text-contrast sweep (approximate: nearest opaque ancestor
background, so gradient and SVG fills show as false positives and were discarded by hand). Scores are
1–10 for originality, craft, fit to the brief, and shippable (how far from `apps/web` it is, and how
much of the notes' port plan survives contact with the code). No exploration was edited.

What every one of the twelve gets right, so it is said once: no external script, no font fetched,
no console error in either theme; every animation sits inside the one guard and **all twelve report
zero running animations under reduced motion** (`document.getAnimations().length === 0`), with rest
states written outside the guard; light and dark are both declared twice (media query and attribute);
a Calm control exists on every page and does what `theme.ts` does; the notes carry a port plan that
names real files. That is a higher floor than any earlier panel saw. Two departures are shared by all
twelve and are counted once, lightly, under fit: every page asks for **Fraunces and Inter before
Instrument Serif and Instrument Sans** (the brief names Instrument for everything; the screenshots show
Instrument because nothing is fetched, so the judged stills are on-brief and the proposal is not), and
the inspector controls in the topbars are the exploration's own, which the notes say, and which the
app must not ship.

| # | Exploration | Originality | Craft | Fit | Shippable | Mean | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | sig-baton-handoff | 9 | 8 | 9 | 7 | 8.25 | keep · ship |
| 2 | sig-night-mode | 7 | 8 | 9 | 9 | 8.25 | keep · ship |
| 3 | sig-paper-and-lacquer | 8 | 8 | 9 | 8 | 8.25 | keep · ship |
| 4 | sig-presence-constellation | 9 | 7 | 9 | 7 | 8.0 | keep · ship after the dark fix |
| 5 | sig-token-art | 8 | 8 | 8 | 8 | 8.0 | keep |
| 6 | sig-council-table | 9 | 8 | 7 | 7 | 7.75 | keep |
| 7 | sig-glass-rail | 7 | 8 | 8 | 8 | 7.75 | keep · ship |
| 8 | sig-welcome-cinematic | 9 | 7 | 9 | 6 | 7.75 | keep · later |
| 9 | sig-approval-dial | 8 | 8 | 7 | 7 | 7.5 | revise |
| 10 | sig-kinetic-mark | 8 | 7 | 8 | 7 | 7.5 | revise |
| 11 | sig-unity-field | 7 | 7 | 6 | 7 | 6.75 | revise |
| 12 | sig-editorial-session | 8 | 6 | 7 | 5 | 6.5 | revise |

Ties are ordered by what a front-end lead can ship this quarter without a kernel change.

---

## Ship these five first

1. **sig-night-mode.** It is a token diff (both dark blocks, one new `--hand-edge`, the `.main`
   pseudo-elements) and nothing in the markup moves. It fixes a real complaint from session-dark (the
   output block as "a hole in the page") and the measured contrast table holds up: ink 14.8 : 1,
   accent-ink 7.9, the status triplet 8.5 / 8.2 / 6.0. The one honest trade (the hand's fill at
   1.9 : 1, carried by its lit edge) is stated, measured and has a Team look editor check named for it.
   Lowest risk, highest reach: every other signature element inherits the night the day it lands.
2. **sig-paper-and-lacquer.** CSS only; the ring-not-border change is the one thing to do carefully
   (the box shrinks 2 px). The grain is a tile decoded once, the stamp's mask is one tile per screen,
   and the `@media print` block is the app's first print stylesheet, which print-export has been
   asking for. The materials map one-to-one onto the brief's roles (frame = lacquer, page = paper,
   hand = ink). Fix the 48 px horizontal scroll before merging (below); it is one line.
3. **sig-glass-rail.** Two wrapper classes in `Rail.tsx` and a block of tokens. It is the least
   original of the five, but it is the cheapest way to make the rail read as the brief's "one glossy
   object in a matte room", it keeps SYSTEM §6's order and content exactly, and the measured cost is
   two compositor layers. Ship it with the roster pane's frost removed (below); the waits pane keeps it.
4. **sig-baton-handoff.** The one signature *motion* in the set that is also a product feature the
   kernel already has (`handoff.request / accept / decline`). The four springs are sampled to CSS
   `linear()` so every device lands the same frame, nothing animates layout, and Calm gets the end
   frame free. "Take it back" waits on a `handoff.withdrawn` event; ship without it (the sentence row
   replaces today's handoff notice, the recall button appears when the kernel grows the event).
5. **sig-presence-constellation.** The most "ours" element on the manager's page, and `Team.tsx`
   already holds every input it needs (`people[].online`, `people[].driving`, `crew`). 69 SVG nodes, no
   per-frame script, every point a real link with a sentence as its name. It is fifth and not third
   because its dark screenshot has a visible defect (the rail's avatars lose their initials) and the
   band overflows the phone; both are small, both must be fixed before the first PR.

Sixth, close behind: **sig-council-table** is the best drawing in the set and would be in the five if
the council room were already a shipped screen; it should land with the council patch, not before it.

---

## 1 · sig-baton-handoff · 8.25 · keep

**What it is.** The driver ring, which SYSTEM §12 already calls the baton, lifts off Ana's avatar,
rolls along a hairline lane on the composer's first row, sags the lane, overshoots 6.9 % at Bo and
waits open beside Accept and Decline; Accept closes it, Decline raises a red stop and rolls it home
on a heavier spring.

- **Originality 9.** A ring with mass that travels along a tightrope between people is not a
  pattern anyone else has, and it is the brand's own ring doing it (open = apart, closed = yours).
  The refusal grammar (a human no has a stop and a bump; a policy refusal has no motion) is the kind
  of thinking that makes motion mean something.
- **Craft 8.** Transform, rotate and scale as individual properties on three nested elements, the
  rolling angle accumulated in JS so a return rolls backwards, seat positions measured once. Measured
  here: 4 running animations at rest, 0 under reduce, 345 nodes, no overflow at 390. Deductions: in
  both desktop shots the topbar's token chip (`12.4k tokens 31 %`) runs under the presence stack (the
  "31 %" sits beneath the "A" avatar); and in dark the avatar initials in the seven-frame column and
  the rail stay cream while their fills lighten (cream on `rgb(214,217,201)` is **1.2 : 1** at 8–12 px).
- **Fit 9.** "Bo has the baton" is the brief's own sentence; the composer is the right home; apricot
  is spent on one object; red appears only for a human no; one gradient on the screen.
- **Shippable 7.** `linear()` needs Chrome 113 / Safari 17.2 / Firefox 112 and the fallback is
  graceful. The state machine must derive from kernel events, not clicks, which the notes already
  say. Recall needs a protocol event; six or more seats need a stack that is not drawn.
- **Fix.** Give the title row's token chip its own flex slot (`.tokens { flex: none; margin-right:
  12px }`, the presence stack `flex: none`) so the percentage never sits under an avatar; and derive
  the avatar initial's colour from its fill in dark (`.avatar { color: var(--avatar-fg, var(--rail-fg)) }`
  with the light fills setting `--avatar-fg: var(--rail)`), which clears the 1.2 : 1.

## 2 · sig-night-mode · 8.25 · keep

**What it is.** The dark theme as three depths: apricot the only light (a lamp, a lit top edge on
every raised surface, every pulse), Dress Blues the air (a ramp at hue 222° from `#0C1019` to
`#2A3244`), chocolate the shadow (warm shadows, a chocolate-black output block, the hand as a
chocolate object with a lit edge). The sheet is the whole app shell with a specimen column.

- **Originality 7.** A dark theme is a dark theme, but "the shadow is chocolate" is an idea no
  competitor has and it follows from the palette rather than being applied to it.
- **Craft 8.** The most complete specimen sheet in the set, with the ladder read from
  `getComputedStyle` so it cannot lie. Measured: 20 running animations at rest (the loaders strip),
  0 under reduce, no overflow. The contrast table in the notes checks out against the probe. Two
  deductions: the toast (`Cy's agent answered in #billing`) sits over the release gate's command line
  in both stills, so the one thing the user must read is the thing covered; and the hand's fill is
  1.9 : 1 against its surface, which the page argues for honestly but which the approvals queue (six
  primaries in a column) has not been shot to confirm.
- **Fit 9.** Dark mode is in the brief; the dark canvas is Dress Blues; nothing white, nothing grey;
  the gradient returns to the daytime navy → chocolate.
- **Shippable 9.** A token diff plus two pseudo-elements and one new property. `theme.ts` toggles a
  `lit` class for the 500 ms lamp-on; `applyTeamTheme` derives `--hand-edge` from `--team-glow`.
- **Fix.** Anchor the toast region above the composer's top edge (`.toasts { bottom: calc(var(--composer-h) + 16px) }`)
  and keep it right-aligned at 360 px so it can never cover a notice's command or its Approve row;
  then shoot the approvals queue with both `#6B4339` and `#7A4B3E` and settle the hand's fill before
  the token diff merges.

## 3 · sig-paper-and-lacquer · 8.25 · keep

**What it is.** Three materials: cream stock with a 240 px grain tile at soft-light, lacquered navy
with a 170° sheen and a lit edge, chocolate ink for the hand, the drawn rules and a debossed risk
label, plus a rotated stamp masked by thresholded noise for a decision that landed. A print
stylesheet that is the same paper.

- **Originality 8.** The stamp and the deboss are small, memorable and earned; the cut-edge /
  drawn-rule distinction is a rule a team can keep.
- **Craft 8.** Shadows at 4–5 % as a ring that never moves layout, a measured 2.7 % luminance
  deviation for the grain, the mask with both prefixed and unprefixed properties, `print-color-adjust`
  on the two cream bands. Measured: 7 animations at rest, 0 under reduce, 0 low-contrast text in
  either theme (the only page with a clean sweep). Deductions: **the page scrolls 48 px sideways at
  1440** (`scrollWidth` 1488) because `.paper::before` is `left: 8%; width: 1100px; max-width: 100%`
  on a `.paper` that does not clip, and 31 px on the phone from the `.c` chips; and the title row's
  token chip collides with the presence stack (`31 % (CO AM`) as in the baton page.
- **Fit 9.** Frame, page and hand as touchable things; apricot only as the pulse; one gradient.
- **Shippable 8.** CSS only; the border → ring change needs one pass over `.card`, `.notice`,
  `.plan` so boxes do not shrink; `mix-blend-mode` on a 2019 phone is the one thing to measure.
- **Fix.** `.paper { overflow: clip }` (and `.main` in the app, which already isolates) removes the
  48 px scroll; on the phone let `.c` chips wrap (`flex-wrap: wrap; min-width: 0`).

## 4 · sig-presence-constellation · 8.0 · keep

**What it is.** The team page header as a sky: every open session a ring, each present member an
arc centred on itself in its colour, shared people where rings intersect (a vesica for two, a kiss
for one), the baton holder bright with the driver ring, away members a dotted guide, the centre only
while the ring is whole, crews stitched beneath, one sentence reading the sky aloud.

- **Originality 9.** The brand's geometry produced from presence data rather than placed on the page.
  Nothing in Linear, Claude or ChatGPT draws who is here.
- **Craft 7.** A chain solver instead of physics, `paint-order: stroke` for names over arcs,
  `pathLength="1"` for one draw keyframe, hover and focus one state. Measured: 12 animations at rest,
  0 under reduce, no per-frame script. Deductions: **in dark the rail's avatars render as blank cream
  discs**: the initials are cream on fills of `rgb(228,224,212)` / `rgb(217,222,232)` (**1.1 : 1**,
  11 instances), plainly visible in `dark.png` ("with Dee" has no D); the sky's wash
  (`.main::before`, 760 px at `left: 8%`) pushes the phone 52 px wide; 14 controls under 32 px on
  the phone (the points), which the notes admit need a tap-to-row behaviour.
- **Fit 9.** Manager overview, mark as data, serif names, status in words beside every colour.
- **Shippable 7.** `Team.tsx` has the data; the layout is ~90 pure lines; the cap on sessions and
  the three-shared-people case are open. The dark defect is in the rail, not the sky, so it is a
  token slip, not a design problem.
- **Fix.** In the dark block set `.rail .avatar { color: var(--rail) }` when the fill is a light
  tint (or keep person fills navy with a `--rail-2` ring as the app does) so initials clear 4.5 : 1;
  and `.main { overflow: clip }` to stop the wash widening the phone.

## 5 · sig-token-art · 8.0 · keep

**What it is.** Three forms for spend in one chocolate ramp with one apricot ember: a ring per agent
against its plan (80 % tick, overflow lap, cache as a dotted arc inside), a mirrored turn-by-turn
waveform of the week stacked by agent, and October as a tide against the soft budget with a pace
band and a dated amber dot. Every chart has a `<details>` table twin and a `<desc>` that states the
conclusion.

- **Originality 8.** The waveform is new and reads as the room's voice; the tide line is a good
  idea; rings and pace bands are known.
- **Craft 8.** OKLCH-stepped ramps validated on both grounds, `pathLength="100"` dasharrays, the
  surface showing through as the gap, the glow animated on transform and opacity only. Measured: 13
  animations at rest, 0 under reduce, 1,172 nodes (372 SVG) which the phone cuts to 24 turns. Two
  deductions: the key hint inside the active *Turn* button (`t`) is `--ink-3` on the hand at
  **2.2 : 1** (2.9 : 1 in dark); and the lightest spend step at 3.6 : 1 is carried by the 2 px gaps
  and labels, which is defensible but leaves Dee's agent the hardest to read in every form.
- **Fit 8.** Token usage meters and budgets are in the brief; chocolate as data at a lightness step
  away from the hand is argued, not assumed. The mirrored stack halves the visible height, which the
  notes flag themselves.
- **Shippable 8.** Three `viz.tsx` components with named inputs; the turn table split by agent
  exists in the usage report; `--t-fill` is one new clock.
- **Fix.** Give the kbd inside a primary button its own tokens
  (`.btn.primary .kbd { background: rgba(255,248,241,.18); color: var(--accent-fg); border-color: transparent }`),
  and put the baseline (non-mirrored) wave beside the mirror in the same page before the founder
  chooses; the port should carry only the chosen one.

## 6 · sig-council-table · 7.75 · keep

**What it is.** A council as a round table: member models on a ring, the chair at twelve, each word
an arc curling to the centre where the chair's plan lands as an apricot disc with the step numbers
at their owners' seats; a dissenting seat parts the ring into two stubs and steps back; a ledger
column is the same council as words; a scrubber under the table is its clock.

- **Originality 9.** The dissent gap and the owner marks on the disc's rim are the two best single
  ideas in the twelve. Refusing the "board of model cards" is right.
- **Craft 8.** One SVG built once, every state a class flip (`setAt`, 0.09 ms per step measured
  there and nothing per frame measured here), transitions for the draw-ins so stepping backward
  undraws them. Measured: 3 animations at rest, 0 under reduce, 526 nodes, no overflow at either
  width. Deductions: **19 controls under 24 px** at desktop and 24 on the phone (the scrubber's dots
  and the seat buttons' hit areas); and in dark the person circles' initials (A, B, C, D) are
  `rgb(154,95,78)` on `#242C3C` at **2.75 : 1** at 12 px, which is visible in `dark.png`.
- **Fit 7.** The brief's palette, serif and voice are kept exactly; a council is not one of the
  brief's listed screens, it is the product growing, so fit is to SYSTEM rather than to BRIEF. More
  than seven seats and a second discussion round are drawn only in prose.
- **Shippable 7.** `CouncilTable.tsx` with the `Council` type from `@henosis/chat` is a clean
  mapping; it waits on the council room view existing in the client.
- **Fix.** Give each scrubber dot and each seat a 24 × 24 minimum hit target (an 8 px dot inside a
  `padding: 8px` button; `<g role="button">` with a transparent 24 px circle behind the tile) and
  lift the dark person initials to `--accent-ink` (`#CAA49B`, 7.9 : 1).

## 7 · sig-glass-rail · 7.75 · keep

**What it is.** The rail as a stack of translucent panes on navy lacquer lit by one apricot lamp at
the top-left corner; a working card pools apricot under its top edge and breathes on the 1.8 s
clock; the rail's order and content are SYSTEM §6's exactly.

- **Originality 7.** Glass on a dark ground is a known look; the restraint (two tiers, 1 px edge
  lights, no travelling light, no blur over the canvas) is what makes it Henosis's.
- **Craft 8.** Every edge is 1 px and axis-aligned, the pulse is a pseudo-element so a card gains no
  DOM, `--pane-tint` and `--pane-edge` are the only two knobs a state turns, the grain is a tile.
  Measured: 10 animations at rest, 0 under reduce, no overflow at 390. Deductions: in dark the plan
  card's done-step numerals are white on `#9BC88F` at **1.9 : 1** (11 px); the two-letter initials
  (`AN`, `BO`) in 18 px circles are cramped, and the stacked pair reads as one blob in both shots.
- **Fit 8.** Navy dominant, apricot spent on one thing, the rail's content untouched.
- **Shippable 8.** CSS, a token block and two wrapper classes in `Rail.tsx`. The frost on the
  roster pane is one tall `backdrop-filter` layer that scrolls, which the notes flag; Safari untested.
- **Fix.** Remove `frost` from the roster pane and keep it on the waits pane only: the roster sits on
  opaque lacquer, so the blur samples nothing a tint cannot give, and it costs a full-height
  compositor layer on a long roster. Set the done-step numeral to `--rail` on the green disc.

## 8 · sig-welcome-cinematic · 7.75 · keep, later

**What it is.** The first ninety seconds as one scene with one camera: Dee's arc alone, her agent's
arc swings in and the ring closes on a ghost centre, the camera pulls back and the ring is one session
in the constellation's sky, the agent speaks in the ledger column, one paper card on the lacquer,
and the lacquer becomes the rail as the page slides in and the stream says *Dee joins the circle.*

- **Originality 9.** A clock, a camera and a voice instead of a carousel; the brand mark becoming
  the roster is the one moment in the set a newcomer would remember.
- **Craft 7.** Beats as a number on the stage, one `<g class="cam">` transform, `stroke-dashoffset:
  1.03` to kill the round-cap dot, boot frames so first paint is never a swing. Measured: 7
  animations at beat 3, 0 under reduce, 637 nodes (364 SVG with the thumbnails). Deductions: the
  stage is always navy but some of its text follows the page's ink, so in **light mode the crew
  label "Invoice rollout" in the storyboard thumbnails is `#1F2634` on `#2A3244` (1.18 : 1)** and the
  beat-6 join line's second "D" avatar is white on cream (1.07 : 1); the stage's kickers and the
  reading's metadata are `--rail-muted` at 4.27 : 1 at 12–13 px; three `<h1>`s on one page.
- **Fit 9.** "Join the circle" onboarding, the founder's arcs-close gesture played once and only
  once, the brief's voice throughout, one gradient (the rail's New session, only when the rail does).
- **Shippable 6.** Needs a route, `copy.brief`, a `session.briefed` event or a turn-0 brief from
  the server, and the real `SessionView` mounting under the slide. Ninety seconds is a promise the
  notes themselves question; the empty-sky and unread-agent cases are open.
- **Fix.** Bind every text on the stage to stage tokens, not page tokens: `--stage-ink`,
  `--stage-ink-2` (cream at 100 % / 72 %) declared once for `.scene` and the thumbnails, so the
  light theme cannot sink a label into the navy; raise the kickers from `--rail-muted` to cream at
  72 % (≥ 4.5 : 1 on `#2A3244`).

## 9 · sig-approval-dial · 7.5 · revise

**What it is.** The gate's rating as a 240° dial: five serif stops with detents, the rule's bar cut
into the rim as a notch, the band past it washed apricot, the team's average a thin needle, your
hand a chocolate knob that rests dashed at the 4 a plain Approve sends; ballots as rows each with a
26 px miniature of the same dial; *Approve with 4* carrying the number.

- **Originality 8.** It puts the three numbers a gate is about on one face. The miniature in every
  row is a good move. A gauge is still a gauge, and the stars it replaces are SYSTEM §10's.
- **Craft 8.** One SVG driven by four custom properties, the detent as one line of arithmetic,
  pointer capture, a single `role="slider"` with `aria-valuetext`. Measured: 2 animations at rest, 0
  under reduce, 323 nodes, 5.2 ms per key press (the notes own it: `innerHTML` rebuilds four rows).
  Deductions: **the phone overflows 39 px** because the actions row's hint (`4 of 5 · Good`, 397 px)
  and the Deny button do not wrap; the rail's role text ("maintainer", 12 px `--ink-3` on navy) is
  2.63 : 1; four controls under 24 px.
- **Fit 7.** Approvals with 1–5 ratings and the palette are honoured; but the brief's and SYSTEM's
  rating control is stars, the plan card keeps stars, and the page itself leaves arrows-turn-or-
  preview open. Two rating grammars in one product is a cost the notes do not price.
- **Shippable 7.** `RatingDial.tsx` is well specified; the 340 px face needs a `size="sm"` cut for
  the queue and a decision on clearing by second tap.
- **Fix.** On ≤ 640 let `.actions` wrap (`flex-wrap: wrap`) with the hint on its own full-width line
  under the buttons (`.hint { flex: 1 1 100%; white-space: normal }`), and in `render()` touch only
  your own ballot row (two custom properties) instead of rebuilding four rows with `innerHTML`.

## 10 · sig-kinetic-mark · 7.5 · revise

**What it is.** One markup, six states for the mark: idle, joining, settled, thinking (the working
half breathes), blocked (the person's arc retracts to 70 % with a dotted stitch), baton (the centre
leans 5 units toward the driver). A navy hero with the mark at 270 px and a score of its two
seconds; six at 96 px; the 16 px tab strip; four homes.

- **Originality 8.** "Blocked is a missing arc" and "only the working half breathes" are precise
  and readable; the score as notation is a lovely way to specify.
- **Craft 7.** Arcs drawn 6 → 12 with `pathLength="100"`, state as data attributes, the symbol
  inlined once so page CSS can reach it. Measured: 56–62 running animations at rest (the six
  pickers, six cards and the hero all loop), 0 under reduce. Deductions: **the phone scrolls 156 px
  sideways** because the score's `<svg>` is a fixed 640 px (`g.rule` to 683 px); the hero's
  secondary text is `--rail-muted` on navy at **4.27 : 1** at 11–14 px (12 instances); no landmark but
  five `<header>`s.
- **Fit 8.** The founder's gesture is kept as the joining state; the retracting arc and the leaning
  centre change the mark's shape for two states, which the notes rightly send to the founder first.
- **Shippable 7.** Six extra nodes per mark (240 in a 40-card rail), `stroke-width` and
  `stroke-dasharray` on the main thread, `mix-blend-mode` per mark, Safari unchecked; the favicon
  swap is cheap and done right.
- **Fix.** Make the score responsive (`svg { width: 100%; height: auto }` with its `viewBox`, the
  hero's two halves stacked under 720 px) so the phone does not scroll sideways; lift the hero's
  secondary text to `rgba(243,237,228,.72)` (≥ 4.5 : 1 on `#2A3244`).

## 11 · sig-unity-field · 6.75 · revise

**What it is.** A 2D-canvas field of faint half-arc pairs drifting across the home; near the
cursor, beside a live row, and when a join ripples out, a pair swings from ±60° into one ring and
the centre lands. Quiet zones over text; two clocks (30 fps moving, 12 fps tide); idles out.

- **Originality 7.** An ambient ground that rehearses the mark is a good answer to Linear's dot
  grid, but it is still an ambient ground.
- **Craft 7.** The engineering is careful: batched rest strokes, springs for interruptibility, DPR
  capped at 1.5, `IntersectionObserver` and `visibilitychange` stop the loop, colours read from
  custom properties with a `MutationObserver` on the theme; measured 0.3–0.5 % of a core idle and 0
  under reduce. Deductions: the desktop still carries eight closed rings with apricot halos in the
  hero's quadrant, so the headline competes with its own ornament (worse in dark, where the rings are
  brighter than the words); the demonstration cursor is baked into the still; the rail's avatars
  (`C`, `I`) are cream on a gradient my probe could not read, and the done/awaiting dots carry hidden
  text that the sweep flags, both false positives.
- **Fit 6.** The brief says motion means joining or living and "never garish"; rings closing because
  a pointer passed is motion for its own sake, which the notes argue around rather than away.
  `aria-hidden`, no text under the arcs above 9 %, one gradient: the hygiene is right.
- **Shippable 7.** One module, two attributes, a `Shell` prop; touch, seed-per-team and the 44 px
  margin at narrow widths are open.
- **Fix.** Cap the number of closed rings on screen at three (the live rows first, then the
  nearest pair to the pointer) and stop pointer-closing within 24 px of any text or control, so the
  home never shows the eight-ring cluster the still shows; drop `[data-field-demo]` before shooting.

## 12 · sig-editorial-session · 6.5 · revise

**What it is.** The session as a long read: the brief as a masthead at 44 px, turns with serif
headings and a numeral hung in the gutter, the team message as a pull-quote, tool steps as a mono
commit log, every decision (ratings, "to the team", the gate with stars and *Approve with 4*) a
marginal note stitched to its passage, Fraunces numerals for counts, the composer a rule under the
text.

- **Originality 8.** The marginal note as the place a reviewer writes is the strongest idea here,
  and refusing bubbles entirely is braver than any other session page in the set.
- **Craft 6.** Subgrid across masthead, turns and composer; hanging punctuation done twice; the
  measure actually measured (67–70 characters). Measured: 5 animations at rest, 0 under reduce, no
  overflow at either width, and 0 low-contrast text in either theme. The big deduction is visible
  in the primary stills of both themes: **the sticky composer is painted with a gradient that is
  transparent for its top 28 %, so the plan's third row and "~2,400 … of 11 so far" show through
  and collide with the `To · Ana's agent · Bo · @ adds anyone` row.** The topbar's token meter also
  runs under the presence stack (`14,118 of 40,000` under `A B D`). Seven controls under 24 px.
- **Fit 7.** Serif for names and sans for reading are kept; moving counts to serif numerals breaks
  the brief's "JetBrains Mono inside tool lines and numbers" (the notes know and offer `.n` as one
  class to drop). The 967 px main needs a 1263 px window, one breakpoint more than the app has.
- **Shippable 5.** Rewrites `Message.tsx`, `PlanCard`, `ApprovalNotice` and `Composer` at once;
  anchored notes collide on back-to-back approvals and need a stacking pass or anchor positioning;
  `VirtualList` height estimates change; ~220 KB of self-hosted variable fonts.
- **Fix.** Make `.composer-wrap` opaque (`background: var(--canvas)`) and move the fade to a
  separate `::before` strip 24 px tall above it, then give `.scroll` a `padding-bottom` equal to the
  composer's measured height so the last plan row and the colophon clear it; while there, give the
  topbar's meter and the presence stack fixed slots as in the baton fix.

---

## Cross-cutting notes for the five that ship

- **The title row collision** (token chip under the presence stack) appears in baton-handoff,
  paper-and-lacquer and editorial-session; it is one rule in `styles.css` (`.topbar .tokens`,
  `.topbar .stack` both `flex: none` with a 12 px gap) and should be fixed once, before any of them.
- **Dark avatars.** Three pages (presence-constellation, baton-handoff, council-table) lighten a
  person's fill in dark and leave the initial in cream or dim chocolate. The avatar system should
  own this: initial colour derived from the fill, never from the theme's foreground.
- **Wash pseudo-elements widen the page.** `left: 8%` plus a fixed width on `.main::before` /
  `.paper::before` adds 31–52 px of horizontal scroll on the phone (and 48 px at 1440 on
  paper-and-lacquer). `overflow: clip` on `.main` in `tokens.css` fixes every instance at once.
- **`--rail-muted` on `#2A3244` is 4.27 : 1.** It passes nowhere at 11–14 px. Two pages (kinetic-mark,
  welcome-cinematic) use it for stage text; night-mode's `#A39D95` (7.1 : 1) should replace it in
  the day block too.
- **Reduced motion is honoured everywhere**: zero animations under `reduce` on all twelve in both
  themes, with rest states correct. This panel did not find a single page that hid a state behind a
  clock. Keep that bar.
