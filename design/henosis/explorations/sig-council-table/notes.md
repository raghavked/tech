# sig-council-table · The council as a round table

A council drawn as the table it is. The member models sit on a ring, the chair at twelve, and each
person sits beside their model on the table's edge. Every word a model says is an arc that leaves its
seat and curls inward to the centre, where the chair's plan forms: a dashed ghost that fills as the
words come in, then a solid apricot disc once the chair has written it, with the step numbers at the
seats of their owners. The disc's rim is the brand's two arcs: the models' words close the left arc,
the people's ratings close the right one, and the plan is approved when they meet. A model that holds
out against the plan opens the ring: its segment parts into two stubs, its seat and its person step
back, and the dissent is written under the table. In the vote the five segments around each person
fill to their rating; the ones still owed a rating breathe. The ledger on the right is the same council
as words, round by round, and the scrubber under the table is the council's clock.

This is the second cut. The first (signature batches 11 and 23) was judged 8.25 then 7.75 with three
fixes: thin the ring in light so the apricot disc is the heaviest thing on the stage (judge 1), give
every dot and seat a 24 px target and lift the dark initials off the dim hand (judge 2), and put the
people on the table with their ratings (judge 3). All three are in, and the drawing was re-laid so the
people no longer collide with the labels (the first cut stacked the person outward from the tile, so
the chair's "D" and its rating sat on "Dee's model" and Tax lines' "C" sat on its own name).

Files: `index.html` (self-contained: tokens inlined from `tokens.v5.css`, light and dark via
`prefers-color-scheme` and `[data-theme]`, every animation and every draw-in transition inside the one
guard with `prefers-reduced-motion` and `[data-motion="calm"]`, Fraunces and Inter asked for first with
the Instrument faces and the system faces as fallbacks, no external asset, no font fetched, no external
script), `light.png`, `dark.png` (1440×900, the council at its vote), `phone.png` (390×844). The
screenshots show the fallback faces (Instrument Serif, Instrument Sans, JetBrains Mono): Fraunces and
Inter are not on this machine and the page fetches nothing. `?at=7` opens the page at any event of the
council's log; `?replay` plays it from the first word; `R` replays, `←` `→` step, `Home` `End` jump.
The exploration's own keys, not product: `c` toggles the team's Calm setting and `d` the theme, set
on `<html>` the way `theme.ts` sets them. No inspector is on the page.

## What it is

| Part | What | Where |
|---|---|---|
| The table | a ring of radius 238 (on a 760 × 720 grid) cut into one segment per member, 3° of air between seats, round caps; a segment is a 4 px hairline (`--table-rest`, navy at 20 %) until its model has spoken, then 6 px `--table-lit`; the lit segments are the only heavy navy on the stage, and the apricot disc outweighs them (judge 1's fix) | the stage, left of the ledger |
| The chair at twelve | seat 0 sits at the top with a tracked `CHAIR` kicker above its name and a short tick inside the ring; the rest follow clockwise in the order they were convened | the ring |
| A seat | the attribution pair (ai-interfaces-avoid §8, premium-product-ui §4) laid along the table's edge: the model's tile at the seat (44 px, 50 for the chair, the tight bottom-left corner, the brand gradient, the apricot centre) and its person a step clockwise (11°) on the same ring, a 30 px circle with a serif initial on an opaque disc so the table's stroke never runs through the letter; the team's shared model has no person | on the ring |
| A word | a `<path pathLength="1">` from under the tile to the disc's edge; round one is a spoke that bends in at once (a − 3° → a + 10°); round two runs along the inside of the table first for 40 % of its length, then turns in (a − 24° → a + 24°): a reply has been around the table before it reaches the centre; angle linear, radius on a smoothstep so it leaves tangent to the table and arrives tangent to the disc; drawn in by `stroke-dashoffset` 1 → 0 over 0.8 s on `--ease-mark`; every word stays inside its seat's ±36° sector, so no two seats' words ever cross (the first cut's sheaf at the centre) | inside the ring |
| Hierarchy of rounds | round one settles to `--table-settled` at 1.6 px once a later word is in; round two stays `--table-lit` at 2.4 px; the latest word is 3.2 px | the arcs |
| A stance | `AGREE` is a solid arc ending in a dot; `ADD` a solid arc ending in a hollow dot; `DIFFER` a dashed arc ending in a short cross in the warn ink. The word is also printed in tracked mono under the seat's name and beside the row in the ledger: never colour alone | the second round's arcs |
| The centre | a dashed ghost ring (`.mark.ghost`'s grammar: not yet in the circle) whose apricot fill rises 4.5 % per word, with "the plan forms here · 6 of 10 words in" in serif italic and mono; at synthesis `centre-land` (the mark's `dot-once`, scale .08 → 1.06 → 1 over 1 s) lands the disc with "The plan · 4 steps · 1 owner each · est. 9,800 tokens", then the vote's tally and who it waits for | the middle |
| The rim | two `pathLength="1"` arcs at r 106 outside the disc: the models' arc runs 6 → 12 on the left in `--table-lit` and fills by words said over words expected; the people's arc runs 12 → 6 on the right in `--table-person` and fills by ratings in over people; at 10 of 10 and 4 of 4 they meet at six and the plan is approved by every voice (data-craft §10's session ring, ai-interfaces-avoid §5's ring meter, drawn around the thing the two arcs are about) | the disc's edge |
| Owner marks | a small ring (r 10) with the step number inside, at r 87 on the disc at the angle of the step's owner, popping in after the disc lands | inside the disc's rim |
| The dissent | the dissenting seat's segment transitions its dasharray from `.5 0 .5` (whole) to `.15 .70 .15` (two stubs toward the neighbours, a gap at the seat) over 0.8 s on `--ease-mark`; the pair and the label step 16 px outward on the same clock; a dotted guide from the open ring to a note under the table: `DISSENT` in the warn ink, the holding in serif italic, centred below the ring where nothing else sits | under the ring |
| An instruction | Cy's private word to Tax lines fills Cy's circle with the hand and draws a 4 px chocolate bridge between the person and the tile (under both, so only the gap fills); the model's next word carries "instructed by Cy" in the ledger | the seat, the ledger |
| The vote on the table | each person's circle wears a five-segment ring (`pathLength="5"`, a dashed track at `--table-track`); when they rate, the segments up to their number fill in `--table-rating` (the picked star's colour) and a count disc (SYSTEM §11's `.count`: mono on apricot-deep with navy ink) pops at the circle's outer corner with the number; people still owed a rating get a finer dashed track and breathe one apricot ring outward (`person-wait`, 1.8 s, the status clock) | the people on the ring |
| Speaking | while a model speaks (its `council.said` is the latest event, or the chair during synthesis) its segment breathes one apricot halo outward (`seat-breathe`, 1.8 s) | the ring |
| The ledger | the words, round by round: the attribution pair, the serif name, the owner, the stance in mono, the tokens; the plan as the plan card (SYSTEM §9) with an owner chip per step; the dissent on a warn wash with the open-ring glyph (presence-and-agents §9); the vote as four rows of stars with the serif word, the quorum segments, "The plan waits for you.", *Rate the plan* as the one chocolate button; "In the circle" last | right column, 424 px |
| The scrubber | replay-scrubber's dot-per-event row under round spans (`individual · discussion 1 · synthesis · vote`), every dot a 24 × 24 button (judge 2's fix), the now dot in apricot-deep breathing `dot-live`, one sentence for the event with its mono time; ← → step, Home, End, R replays | under the table |
| Hover and focus | a seat (a focusable `<g role="button">` with an 88 px hit circle) or a ledger row lights that member's arcs and segment and dims the rest; a click on a seat scrolls the ledger to its latest word | both columns |
| Phone | the rail folds into the navy top block (mobile-session), the table takes the full width with the names only (owners and stances live in the ledger), side names outside the ring, the clock a slider and two 44 px keys, the round named in the top block's pill, *Rate the plan* and *Instruct Checkout* in a sticky bar at the thumb | 390 |

## Why it is ours

- **It is the mark, multiplied, and then the mark again in the middle.** A council is several arcs
  closing on one centre, which is what the brand's two arcs do (BRIEF: two arcs that close into one
  ring around one centre). The disc's rim makes it literal: the models' arc on the left and the
  people's arc on the right close around the plan as the words and the ratings come in, which is
  motion-choreography §1's two arcs drawn from opposite ends, and generative-visuals §1's closing ring,
  bound to the council's real counts. The centre lands only after the words are in and the chair has
  written the plan (MOTION §8: a ring without a centre is a loader, which is exactly what a council in
  deliberation is). The dissent is the mark's apart pose at one seat (SYSTEM §5's states;
  presence-and-agents §9, the agreement ring: closed where they agree, open where they differ).
- **People and models on one table.** The brief's claim is agents as members; judge 3's complaint was
  that the people were off the drawing. Now a person sits on the ring beside their model, the way two
  colleagues sit at a table, and their decision is drawn where the models' words are: the rating ring
  around their circle, the count at its corner, the people's arc on the plan. The private instruction
  is a bridge between the two seats. Nothing about a person is a line of text in the centre any more.
- **It refuses the board of cards.** The one named precedent, Perplexity's Model Council, frames
  several models as "a board" with one synthesis and contributors listed under it (presence-and-agents).
  Ours is a table you read at a glance: who has spoken, who holds out, whose plan it is, which steps
  are whose, who the vote waits for; nothing in it is a chat bubble or a column of model cards
  (ai-interfaces-avoid: the artifact becomes the interface; §1 the ledger column for the words, §8 the
  attribution pair for every seat, §9 the dissent as a margin note beside its passage, not a thread).
- **Colour by ground, one meaning each** (SYSTEM principles 1, 2, 5). On cream a model's arc is navy, a
  person is chocolate, the centre is the only apricot on the stage (three-colour-brands: apricot spent
  on one object, cream doing most of the work); the live things, a speaking seat's halo and a waited-for
  person's ring, are the pulse; the hand is *Rate the plan*, the instructed circle and the people's arc,
  and nothing else; the warn ink marks `DISSENT` and `DIFFER`, the one place a status hue appears,
  against a decision (data-craft's palette rule). In dark the models' strokes turn apricot and the
  people's take chocolate 300 (`#CAA49B`, 7.2 : 1, SYSTEM §2.4's `--accent-ink`), so the initials clear
  the contrast the dark avatars failed (judge 2) and the table is the same drawing at night.
- **Progress bound to real work** (motion-choreography §6, §3 the turn baton). Every arc is a
  `council.said` in the group's log; every lit segment a model that has answered; the ghost's fill and
  the models' rim arc are the count of words; the people's rim arc and the rating rings are the plan's
  ratings; the owner marks are the plan's `owner` fields; the breathing seat is the member the protocol
  is waiting on (`councilNext` → `await-answers`, `synthesise`, `await-vote`). Nothing moves that the
  log does not say. The draw-on stroke is the memos' `pathLength="1"` idiom, on the mark's own curve.
- **Named things are serif, read things are sans, counts are mono** (SYSTEM principle 6;
  editorial-type §7 tracked mono eyebrows for `CHAIR`, `AGREE`, `DISSENT`; premium-product-ui §9
  Fraunces for attribution, Inter for action; data-craft §8 direct labels at the seats, no legend). The
  dissent is a decision pull-quote in italic serif on a rule (editorial-type §5).
- **Rest is the end state** (MOTION principles 2, 6). The page opens at the council's last event as a
  finished drawing; the draw-ins are transitions that only play when the state changes; under Calm or
  reduced motion every clock is zero and the table sits at whatever event is asked for, dissent gap,
  owner marks, rating rings and all. The only loops are the halos of whoever is spoken to or waited
  for, on the 1.8 s status clock, well away from the 0.2 Hz oscillation Apple warns about
  (motion-choreography).
- **It is not Claude's, ChatGPT's or Linear's.** None of them has a table, a chair, a dissent or a plan
  with owners to draw; a radial drawing of named models and named people around a plan belongs to a
  product whose claim is that agents are members of a team. The navy frame, the apricot centre and the
  chocolate people keep it in Henosis's three colours and off the clay-and-ivory of Claude (SYSTEM
  principle 10).

## The technique

- **One SVG, drawn once, every state a class.** The table is built from a model shaped like
  `packages/chat`'s folded `Council` (chair, members, `rounds[].said`, `instructions`, `synthesis` with
  `dissent`, the vote) and the list of its events. Every arc, segment, halo, tile, person, rating ring,
  owner mark and note is created at mount; `setAt(k)` folds the events up to `k` and toggles classes
  (`on`, `latest`, `lit`, `gap`, `speaking`, `instructed`, `voting`, `waited`, `enter`) and five inline
  values (a segment's dasharray, the ghost's fill opacity, the two rim arcs' dasharrays, a rating ring's
  dasharray). The scrubber, the keyboard, the replay and `?at=` all call the same function, so the
  drawing cannot disagree with itself. 177 SVG nodes at five seats and ten words; the ledger is ordinary
  HTML under the same `data-at` rule.
- **Transitions, not keyframes, for the draw-ins.** An arc is `pathLength="1"`, `stroke-dasharray: 1`,
  `stroke-dashoffset: 1`; `.on` sets the offset to 0 and the transition (inside the guard, 0.8 s,
  `--ease-mark`) draws it. The dissent gap is a transition on `stroke-dasharray` between two three-value
  lists; the step back is a CSS `transform` on the pair's group, so stepping backward undraws both the
  same way. Only the centre's landing, the halos, the count's pop and the ledger's `card-in` are
  keyframes, all under the guard. Two things learnt this cut: a CSS `transform` on an element wipes its
  `transform` attribute, so anything that is both placed and animated is two nested groups (the first
  build of the owner marks collapsed to the origin); and the person's disc is opaque (`--canvas`) so the
  table's stroke never runs through the initial.
- **The guard is the one from MOTION §3.** `--motion: 1` is set only inside
  `@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }`; the nine
  animation rules and the fourteen transition rules live in that block; the calm attribute and the
  reduce query zero `--t-fast / --t / --t-slow`. The script reads `--motion` once per replay: under
  Calm, *Replay the council* jumps to the end instead of stepping, exactly as `useMotion()` tells
  components to skip a wait. Measured: 0 running animations under `reduce` and under
  `data-motion="calm"` at both widths.
- **Colour from custom properties only.** Thirteen `--table-*` tokens (rest, lit, settled, person,
  person-ink, person-fg, centre, centre-ink, centre-ink-2, ghost, halo, rating, track) are derived from
  `--blues`, `--fondant` and `--apricot` in the light block and from apricot and chocolate 300 in both
  dark blocks; the SVG gradient reads the brand gradient through `style="stop-color: var(--grad-a)"`.
  A team look that retints the hand retints the people.
- **Geometry.** `pt(a, r)` with 0° at twelve, clockwise; a seat's segment spans ±(180°/N − 3°); the
  person sits at a + 11° on the ring; a word is a 41-point polyline, angle linear, radius on
  `t²(3 − 2t)` from 230 (or 222 after the hold) to 108; the rim arcs sit at r 106, the owner marks at
  r 87; labels sit at r 292 and anchor by the cosine of the seat's angle (start on the right, end on
  the left, middle at the top and bottom), the top seat's block hanging upward and a bottom seat's
  downward, so no label can reach a person's circle or its count. On the phone the viewBox is the
  full width and the side names move outside the ring, anchored away from it.
- **Accessibility.** The SVG is `role="img"` with a title and a description that `setAt` rewrites
  ("5 member models around a ring … 10 of 10 words so far … Tax lines holds a dissent … The plan waits
  for you"); seats are focusable buttons with a drawn focus ring in `--focus-ring` and an 88 px hit
  circle; every state has a word beside its colour (the stance under the name and in the ledger,
  `DISSENT`, "waits for you", the count on the rating ring, the ledger's status words); the scrubber's
  dots are 24 px buttons named by their event. Measured: 0 controls under 24 px at either width.
  Nothing flashes; the fastest change is the 0.8 s draw.

## The cost

Measured headless (Chromium, 1440×900 and 390×844, the page at its vote).

| | 1440×900 | 390×844 |
|---|---|---|
| SVG nodes (paths / text) | 177 (30 / 35) | 177 (30 / 35) |
| running animations at rest | 4 (two waited-for people, the now dot, the rail's running dot) | 2 |
| under `reduce`, under Calm | 0 | 0 |
| script per step, Home → End → Home → End, table and ledger | 1.7 ms | 2.0 ms |
| JS heap after mount | 9.5 MB (the page, not the table) | 9.5 MB |
| controls under 24 px | 0 | 0 |
| horizontal overflow | none | none |
| page, uncompressed | 81 KB (tokens, styles, the ledger and the script) | |

While a word draws, the compositor animates one `stroke-dashoffset`; a seat's halo is one
`stroke-width` + `opacity` animation; a person's wait is one `r` + `opacity`; nothing in the table is
laid out per frame. Growing the council to seven seats adds a segment, a halo, a tile, a person with
its ring, a label and two arcs per seat (≈ 16 nodes each). Past seven the labels want the owner line
folded into the hover card and the stance moved onto the tile's corner (see Open); the sector rule
keeps the words from crossing at any count.

## How it ports into `apps/web`

The table is one component inside the council room that exists in the web client today
(`apps/web/src/views/Council.tsx`: `CouncilRoom` renders the task, the rounds as sections with
`AnswerCard` and `DiscussionLine`, `SynthesisCard` with the `PlanCard`, `Dissent`, the assignments
and the token meter). Nothing in the stream, the rail or the chat reducer changes.

1. **`apps/web/src/council/CouncilTable.tsx`** (new): the `<script>`'s builder as a component
   `CouncilTable({ council, at, vote, ratings, onFocusMember, focused })`. `council` is `@henosis/chat`'s
   `Council` (its `chair`, `members`, `rounds`, `instructions`, `synthesis`, `usage`, `status`); `at`
   is the seq to fold to (the room passes `council.lastSeq` live, the replay scrubber passes a seq);
   `vote` and `ratings` are the chair session's plan ratings (`councilProtocol`'s `CouncilVote` plus
   the raters' numbers from `usePlanSession`), which the chat log does not hold. Seats come from
   `modelsOf(council)` keyed by `councilMemberKey`, the chair first; a person comes from the member's
   `userId` through the room's `personName`; a word's angle from the seat's index and how many times
   that member has spoken (`roundRecord(...).said`); "speaking" is `councilNext(council, vote)`:
   `await-answers` lights the owed members, `synthesise` the chair, `await-vote` the people without a
   rating. Build the SVG with JSX once (`useMemo` on `council.id` and the member list); drive state
   with classes and the five inline values exactly as the exploration does, so the transitions are the
   component's whole animation and `motionNow()` is read only by the replay.
2. **`apps/web/src/views/Council.tsx`** `CouncilRoom`: mount `<CouncilTable>` above the rounds on
   desktop (this page's `.body` grid: table left, the rounds as the ledger right) and first on the
   phone. `AnswerCard` and `DiscussionLine` get `data-member` so hover and focus light a seat
   (`onFocusMember`); `SynthesisCard` keeps `PlanCard` with its owners, and the table's "Rate the
   plan" is the card's own rating control, scrolled to. `Dissent` stays as the ledger's warn row.
3. **`apps/web/src/stream/PlanCard.tsx`**: no change; the owner chip per step already exists.
4. **`apps/web/src/tokens.css`**: the thirteen `--table-*` properties in the light block and,
   byte-identical, in both dark blocks (values in `index.html`'s `:root` and dark blocks).
   **`apps/web/src/theme.ts`** `applyTeamTheme`: set `--table-person` from the team's hand with the
   other `--team-*` properties.
5. **`apps/web/src/styles.css`**, beside the council block that starts at "the council
   (docs/19_council.md, views/Council.tsx)": the rules under "the table", "a seat", "the centre" and
   "the dissent note" from `index.html` (about 90 lines), and the nine animation rules and fourteen
   transition rules into the existing guard block
   (`@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }`); the
   keyframes `centre-land`, `seat-breathe`, `person-wait` beside `dot-once` and `dot-live`.
6. **`apps/web/src/views/ReplayScrubber.tsx`**: the council's events are already a chain in the
   group's log; the scrubber's dot-per-turn row can show the council's events as spans and pass the
   seq to `at`. The scrubber in this page is the exploration's own copy of that row.

## Open

- **More than seven seats.** Labels at r 292 are comfortable to seven; a council of ten wants the
  owner's line folded into the hover card and the stance moved onto the tile's corner, and the person
  moved to a + 8°.
- **Two discussion rounds.** The page draws two words per seat (individual, discussion 1). A second
  discussion round is a third arc inside the sector (a − 30° → a + 30°, a longer hold); past three the
  arcs should fold into one per seat with the count printed on it, the way the scrubber folds turns.
- **The rim and the owner marks on a revision.** A revised plan (`councilNext` → `revise`) re-opens
  synthesis: the people's arc should empty and the disc should relight on `centre-land`; drawn only
  in prose here.
- **The chair's arc.** The chair speaks in the rounds like any member and its synthesis is the centre
  landing; a synthesis arc from the chair's seat was tried in the first cut and dropped (it read as
  the chair voting). Still dropped.
- **Touch.** Hover lights a member; on the phone the tap does the same and scrolls the ledger, which
  is right; the clock is the slider and the two keys, and the round spans are gone in favour of the top
  block's pill. Whether the spans deserve a phone form is open.
