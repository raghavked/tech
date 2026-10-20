# sig-council-table · The council as a round table

A council drawn as the table it is. The member models sit on a ring, the chair at twelve. Every word a
model says is an arc that leaves its seat along the table and curls inward to the centre, where the
chair's plan forms: a dashed ghost while they deliberate, a solid apricot disc once the chair has
written it, with the step numbers on its rim at the seats of their owners. A model that holds out
against the plan opens the ring: its segment of the table parts into two stubs and its seat steps
back, and the dissent is written beside the gap. The people are there too, each behind their model's
tile; a private instruction fills the person's circle; in the vote the ones still owed a rating
breathe. The ledger on the right is the same council as words, round by round, and the scrubber under
the table is the council's clock.

Files: `index.html` (self-contained: tokens inlined from `tokens.v5.css`, light and dark via
`prefers-color-scheme` and `[data-theme]`, every animation inside the one guard with
`prefers-reduced-motion` and `[data-motion="calm"]`, Fraunces and Inter asked for first with
Instrument and the system faces as fallbacks, no external asset, no font fetched, no external
script), `light.png`, `dark.png` (1440×900, the council at its vote), `phone.png` (390×844). The
screenshots show the fallback faces (Instrument Serif, Instrument Sans, JetBrains Mono): Fraunces and
Inter are not on this machine and the page fetches nothing. `?at=7` opens the page at any event of
the council's log (the sixth word), `?replay` plays it from the first.

## What it is

| Part | What | Where |
|---|---|---|
| The table | a ring of radius 252 (on an 800 × 760 grid) cut into one segment per member, 3.2° of air between seats, round caps; a segment is `--table-rest` until its model has spoken, then `--table-lit` | the stage, left of the ledger |
| The chair at twelve | the chair's seat is seat 0 and sits at the top with a tracked `CHAIR` kicker above its name; the rest follow clockwise in the order they were convened | the ring |
| A seat | the attribution pair (ai-interfaces-avoid §8, premium-product-ui): the model's tile leads (46 px, 52 for the chair, the tight bottom-left corner, the brand gradient, the apricot centre); its person's circle sits behind it a step outward with a serif initial; the team's shared model has no person | on the ring |
| A word | a `<path pathLength="1">` from the seat (r 245) along the table and inward to the centre's edge (r 107), angle linear, radius on a smoothstep so it leaves tangent to the table and arrives tangent to the disc; the first word of a seat curls close to it, the second beside it; drawn in by `stroke-dashoffset` 1 → 0 over 0.9 s on `--ease-mark` | inside the ring |
| A stance | `AGREE` is a solid arc with a small dot at its end; `ADD` a solid arc with a larger dot; `DIFFER` a dashed arc. The word is also printed in tracked mono under the seat's name and beside the row in the ledger: never colour alone | the second round's arcs |
| The centre | a dashed ghost ring (`.mark.ghost`'s grammar: not yet in the circle) whose apricot fill rises 4.5 % per word, with "5 words in · the plan forms here" in serif italic; at synthesis `centre-land` (the mark's `dot-once`, scale .08 → 1.06 → 1 over 1 s) lands the disc with "The plan · 4 steps · 1 owner each · est. 9,800 tokens", then the vote's tally and who it waits for | the middle |
| Owner marks | one short arc on the disc's rim at the angle of each step's owner, with the step number inside it, drawn in after the disc lands | the disc's rim |
| The dissent | the dissenting seat's segment transitions its dasharray from `.5 0 .5` (whole) to `.16 .68 .16` (two stubs toward the neighbours, a gap at the seat) over 0.8 s on `--ease-mark`; its tile and person step 16 px outward on the same clock; a dotted guide to a note outside the ring: `DISSENT` in the warn ink, the holding in serif italic | the ring, beside Tax lines |
| An instruction | Cy's private word to Tax lines fills Cy's circle chocolate and draws a short chocolate stroke into the seat; the model's next word carries "instructed by Cy" in the ledger | the seat, the ledger |
| Speaking, waiting | while a model speaks (its `council.said` is the latest event, or the chair during synthesis) its segment breathes one apricot halo outward (`seat-breathe`, 1.8 s, the status pulse's clock); in the vote, the circles of the people still owed a rating breathe the same way (`person-wait`) | the ring |
| The ledger | the words, round by round: the attribution pair, the serif name, the owner, the stance in mono, the tokens; the plan as the plan card (SYSTEM §9) with an owner chip per step; the dissent on a warn wash with the open-ring glyph (presence-and-agents §9); the vote as four rows of stars with the serif word, the quorum segments, "The plan waits for Ana and Cy.", *Rate the plan* as the one chocolate button; "In the circle" last | right column, 424 px |
| The scrubber | replay-scrubber's dot-per-event row under round spans (`individual · discussion 1 · synthesis · vote`), the now dot in apricot-deep breathing `dot-live`, one sentence for the event with its mono time; ← → step, Home, End, R replays | under the table |
| Hover and focus | a seat (a focusable `<g role="button">`) or a ledger row lights that member's arcs and segment and dims the rest; a click on a seat scrolls the ledger to its latest word | both columns |
| Phone | the rail folds into the navy top block (mobile-session), the table fills the width with its labels a step larger, the scrubber under it, the ledger under that, *Rate the plan* and *Instruct Checkout* in a sticky bar at the thumb | 390 |

## Why it is ours

- **It is the mark, multiplied.** A council is several arcs closing on one centre, which is what the
  brand's two arcs already do (BRIEF: two arcs that close into one ring around one centre). The
  centre lands only after the words are in and the chair has written the plan (MOTION §8: the centre
  appears only after the ring is one; a ring without a centre is a loader, which is exactly what a
  council in deliberation is). The dissent is the mark's apart pose at one seat: the ring is not one
  where someone holds out (SYSTEM §5's states; presence-and-agents §9, the agreement ring: closed where
  they agree, open where they differ, contributors named beneath).
- **It refuses the board of cards.** The one named precedent, Perplexity's Model Council, frames
  several models as "a board" with one synthesis and contributors listed under it
  (presence-and-agents). Ours is a table you can read at a glance: who has spoken, who holds out,
  whose plan it is, which steps are whose, who the vote waits for; and nothing in it is a chat bubble
  or a column of model cards (ai-interfaces-avoid: the artifact becomes the interface; §1 the ledger
  column for the words, §8 the agent-leads attribution pair for every seat, §9 the dissent as a margin
  note beside its passage rather than a second thread).
- **Colour by ground, one meaning each** (SYSTEM principles 1, 2, 5). On cream a model's arc is navy,
  a person is chocolate, the centre is the only apricot on the stage (three-colour-brands: apricot
  spent on one object, cream doing most of the work); the live things, a speaking seat's halo and a
  waited-for person's ring, are the pulse; the hand is *Rate the plan* and the people's circles and
  nothing else; the warn ink marks the dissent and `DIFFER`, the one place a status hue appears,
  against a decision (data-craft's palette rule). In dark the arcs turn apricot and the people take the
  lifted chocolate, the illustration board's fix, so the table is the same drawing at night.
- **Progress bound to real work** (motion-choreography §6, §3 the turn baton). Every arc is a
  `council.said` in the group's log; every lit segment a model that has answered; the ghost's fill is
  the count of words; the owner marks are the plan's `owner` fields; the breathing seat is the member
  the protocol is waiting on (`councilNext` → `await-answers`, `synthesise`, `await-vote`). Nothing
  moves that the log does not say. The draw-on stroke is the memos' `pathLength="1"` idiom
  (generative-visuals §1 Closing Ring; motion-choreography §1), on the mark's own curve.
- **Named things are serif, read things are sans, counts are mono** (SYSTEM principle 6;
  editorial-type §7 tracked mono eyebrows for `CHAIR`, `AGREE`, `DISSENT`; premium-product-ui §9
  Fraunces for attribution, Inter for action; data-craft §8 direct labels at the seats, no legend).
  The dissent is a decision pull-quote in italic serif on a rule (editorial-type §5).
- **Rest is the end state** (MOTION principles 2, 6). The page opens at the council's last event as a
  finished drawing; the draw-ins are transitions that only play when the state changes; under Calm or
  reduced motion every clock is zero and the table sits at whatever event is asked for, dissent gap,
  owner marks and all. The only loops are the halo of whoever is spoken to or waited for, on the 1.8 s
  status clock, well away from the 0.2 Hz Apple warns about (motion-choreography).
- **It is not Claude's, ChatGPT's or Linear's.** None of them has a table, a chair, a dissent or a
  plan with owners to draw; a radial diagram of named models and named people around a plan belongs
  to a product whose claim is that agents are members of a team. The navy frame, the apricot centre
  and the chocolate people keep it in Henosis's three colours and off the clay-and-ivory of Claude
  (SYSTEM principle 10).

## The technique

- **One SVG, drawn once, every state a class.** The table is built from a model shaped like
  `packages/chat`'s folded `Council` (chair, members, `rounds[].said`, `instructions`, `synthesis` with
  `dissent`, the vote) and the list of its events. Every arc, segment, halo, owner mark and note is
  created at mount; `setAt(k)` folds the events up to `k` and toggles classes (`on`, `latest`, `lit`,
  `gap`, `speaking`, `instructed`, `waited`, `enter`) and two inline values (a segment's dasharray, the
  ghost's fill opacity). The scrubber, the keyboard, the replay and `?at=` all call the same function,
  so the drawing cannot disagree with itself. 120 SVG nodes at five seats and 11 words; the ledger is
  ordinary HTML under the same `data-at` rule.
- **Transitions, not keyframes, for the draw-ins.** An arc is `pathLength="1"`, `stroke-dasharray: 1`,
  `stroke-dashoffset: 1`; `.on` sets the offset to 0 and the transition (inside the guard, 0.9 s,
  `--ease-mark`) draws it. The dissent gap is a transition on `stroke-dasharray` between two
  three-value lists, so stepping backward undraws it the same way. Only the centre's landing, the
  halos and the ledger's `card-in` are keyframes, all under the guard.
- **The guard is the one from MOTION §3.** `--motion: 1` is set only inside
  `@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }`; the ten
  animation rules and the nine transition rules live in that block; the calm attribute and the reduce
  query zero `--t-fast / --t / --t-slow`. The script reads `--motion` once per replay: under Calm,
  *Replay the council* jumps to the end instead of stepping, exactly as `useMotion()` tells components
  to skip a wait. The Calm and Dark buttons in the topbar are the exploration's own controls and set
  `data-motion` / `data-theme` the way `theme.ts` does; the app does not ship them.
- **Colour from custom properties only.** Twelve `--table-*` tokens (rest, lit, lit-soft, person,
  person-fg, centre, centre-ink, centre-ink-2, ghost, halo and the tile's two gradient stops) are derived from
  `--blues`, `--fondant` and `--apricot` in the light block and from the dark hand and apricot in both
  dark blocks; the SVG gradient reads them through `style="stop-color: var(--table-tile-a)"`. A team
  look that retints the hand retints the people.
- **Geometry.** `pt(a, r)` with 0° at twelve, clockwise; a seat's segment spans ±(180°/N − 3.2°); a
  word is a 37-point polyline, angle linear from a − 6° to a + 30° (the second word a + 5° to a + 46°),
  radius on `t²(3 − 2t)` from 245 to 107; the owner marks are 14° arcs at r 103; labels anchor by the
  cosine of the seat's angle (start on the right, end on the left, middle at the top and bottom) and
  the top seat's label stacks upward so the stance never touches the tile.
- **Accessibility.** The SVG is `role="img"` with a title and a description that `setAt` rewrites
  ("5 member models around a ring … 11 words so far … Tax lines holds a dissent"); seats are focusable
  buttons with a drawn focus ring in `--focus-ring`; every state has a word beside its colour (the
  stance under the name and in the ledger, `DISSENT`, "waits for Ana and Cy", the ledger's status
  words); the scrubber's dots are buttons named by their event. Nothing flashes; the fastest change is
  the 0.9 s draw.

## The cost

Measured headless (Chromium 1440×900 and 390×844). A state change is `setAt`: the class flips on
~120 SVG nodes and ~60 ledger nodes.

| | 1440×900 | 390×844 |
|---|---|---|
| SVG nodes (paths / text) | 120 (31 / 37) | 120 (31 / 37) |
| script per step, 18 steps Home → End | 0.09 ms | 0.12 ms |
| JS heap after mount | 9.5 MB (the page, not the table) | 9.5 MB |
| page, uncompressed | 72 KB (tokens, styles, the ledger and the script) | |
| at rest, Calm or reduce | still; no clock | |

While a word draws the compositor animates one stroke-dashoffset; a seat's halo is one
`stroke-width` + `opacity` animation, promoted by Chromium as a paint, not a layout; nothing in the
table is laid out per frame. Growing the council to ten seats adds a segment, a halo, a tile, a label
and two arcs per seat (≈ 11 nodes each). At twelve or more seats the labels want a second ring of
spacing or the owner's line folded into a tooltip (see Open).

## How it ports into `apps/web`

The table is one component beside the council room the council patch adds to the web client (the
threaded room inside a group, where `council.said`, `council.synthesised` and the vote are rendered
today as sections). Nothing in the stream, the rail or the chat reducer changes.

1. **`apps/web/src/council/CouncilTable.tsx`** (new): the `<script>`'s builder as a component
   `CouncilTable({ council, at, vote, onFocusMember, focused })`. `council` is `@henosis/chat`'s
   `Council` (its `chair`, `members`, `rounds`, `instructions`, `synthesis`, `usage`, `status`);
   `at` is the seq to fold to (the room passes `council.lastSeq` live, the replay scrubber passes a
   seq); `vote` is the chair session's plan ratings (`councilProtocol`'s `CouncilVote` plus the
   raters), which the chat log does not hold. Seats come from `[chair, ...members]` keyed by
   `councilMemberKey`; a word's angle from the seat's index and how many times that member has spoken
   (`roundRecord(...).said`); "speaking" is `councilNext(council, vote)`: `await-answers` lights the
   owed members, `synthesise` the chair, `await-vote` the people without a rating. Build the SVG with
   JSX once (`useMemo` on `council.id` and the member list); drive state with classes exactly as the
   exploration does, so the transitions are the component's whole animation and
   `motionNow()` is read only by the replay.
2. **The council room view** (the patch's `views/Council.tsx`, or wherever `council.synthesised` is
   rendered): mount `<CouncilTable>` above the rounds on desktop (the `.body` grid of this page:
   table left, the rounds as the ledger right) and first on the phone. The rounds' rows get
   `data-member` so hover and focus can light a seat (`onFocusMember`); the plan card keeps SYSTEM §9's
   markup with the owner chip per step from `PlanCard`'s owners.
3. **`apps/web/src/stream/PlanCard.tsx`**: no change to the card; the table's "Rate the plan" is the
   card's own rating control, scrolled to.
4. **`apps/web/src/tokens.css`**: the twelve `--table-*` properties in the light block and, byte-identical,
   in both dark blocks (values in `index.html`'s `:root` and dark blocks).
   **`apps/web/src/theme.ts`** `applyTeamTheme`: set `--table-person` from the team's hand with the
   other `--team-*` properties.
5. **`apps/web/src/styles.css`**: the rules under "the table", "seats", "the centre" and "the dissent
   note" from `index.html` (about 80 lines), and the ten animation rules into the existing guard block
   (`@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }`); the
   keyframes `centre-land`, `seat-breathe`, `person-wait` beside `dot-once` and `dot-live`.
6. **The replay scrubber** (`views/ReplayScrubber.tsx`): the council's events are already a chain in
   the group's log; the scrubber's dot-per-turn row can show the council's events as spans and pass
   the seq to `at`. The scrubber in this page is the exploration's own copy of that row.

## Open

- **More than seven seats.** Labels at r 310 are comfortable to seven; a council of ten wants the
  owner's line folded into the hover card and the stance moved onto the tile's corner.
- **Two discussion rounds.** The page draws two words per seat (individual, discussion 1). A second
  discussion round would be a third arc at a + 16°; past three the arcs should fold into one per seat
  with the count printed on it, the way the scrubber folds turns.
- **The vote on the table.** The people's ratings are only in the centre's text and the ledger; a
  rating could be drawn as the person's circle filling to the star count (five rings), which would
  put the people's decision on the drawing the models' words are on. Worth one more pass.
- **The chair's arc.** The chair speaks in the rounds like any member and its synthesis is the
  centre landing; whether the synthesis also deserves an arc from the chair's seat (the only chocolate
  arc, a person's plan from a model) was tried and dropped: it read as the chair voting.
- **Touch.** Hover lights a member; on the phone the tap does the same and scrolls the ledger, which
  is right, but the scrubber's dots at 390 are 17 px apart and want ← → in the bar to be the main way.
