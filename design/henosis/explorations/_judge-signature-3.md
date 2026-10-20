# Judge panel · signature elements · 3 · product lead

Lens: does the element carry the unity story (one circle, people and agents as members, the baton,
the gate held by the people who consume the code) and does it earn its place in a team's ordinary
Tuesday. Read BRIEF.md, every `sig-*/notes.md` and `index.html`, and looked at every `light.png` and
`dark.png` (plus the `-now` stills for editorial-session and paper-and-lacquer and the constellation's
phone still). Scores 1–10: originality, craft, fit (unity story and daily use), shippable. Overall is
the mean. One concrete fix per element.

## Three things to say once

- **Every page asks for Fraunces and Inter before Instrument.** BRIEF says Instrument Serif, Instrument
  Sans, JetBrains Mono. The stills were rendered with the fallbacks, so the panel judged Instrument. The
  one decision belongs in SYSTEM §3; until it is made, no exploration here should be shot as final, and
  editorial-session (whose whole idea rests on serif numerals) is the one most exposed to the answer.
- **Six pages invent the same material** (a lamp at the top-left, a `feTurbulence` grain tile at
  soft-light, a lacquer sheen): glass-rail, night-mode, paper-and-lacquer, kinetic-mark, token-art,
  welcome-cinematic. That is one surfaces patch with one lamp and one grain alpha per theme, and the
  team should see it land once, not six times with six alphas.
- **Every still carries an exploration inspector** (Dark, Calm, Grain, Replay, frame numbers) in the
  product's own pill style in the product's own topbar. Each note says it does not ship; the stills
  still show a topbar the product will never have. Hide `data-inspector` before shooting.

## The table

| # | slug | originality | craft | fit | shippable | overall | verdict |
|---|---|---|---|---|---|---|---|
| 1 | sig-approval-dial | 8 | 9 | 8 | 8 | **8.25** | ship first |
| 2 | sig-baton-handoff | 9 | 8 | 9 | 7 | **8.25** | ship, after the lane learns to fold |
| 3 | sig-night-mode | 6 | 8 | 9 | 9 | **8.0** | ship |
| 4 | sig-presence-constellation | 8 | 7 | 9 | 7 | **7.75** | ship, after the dark avatars |
| 5 | sig-glass-rail | 6 | 8 | 8 | 9 | **7.75** | ship as the surfaces patch |
| 6 | sig-welcome-cinematic | 8 | 8 | 9 | 6 | **7.75** | second wave, on the constellation |
| 7 | sig-council-table | 9 | 8 | 7 | 7 | **7.75** | second wave, with the council patch |
| 8 | sig-paper-and-lacquer | 6 | 8 | 8 | 8 | **7.5** | second wave, inside the surfaces patch |
| 9 | sig-token-art | 8 | 8 | 7 | 7 | **7.5** | second wave, the ring first |
| 10 | sig-editorial-session | 9 | 6 | 7 | 5 | **6.75** | keep as a direction |
| 11 | sig-kinetic-mark | 7 | 8 | 5 | 7 | **6.75** | revise: the favicon ships, the lean does not |
| 12 | sig-unity-field | 6 | 7 | 4 | 7 | **6.0** | cut to the join moment or drop |

---

## 1 · sig-approval-dial · 8.25

The gate's 1–5 rating as a 240° dial: five serif stops with detents, the rule's bar cut into the rim,
the band past it washed apricot, the team's average as a needle, your pick as the chocolate knob, and a
26 px miniature of the same dial on every ballot row.

- **Originality 8.** Nobody rates with a gauge, and nobody has put the three numbers a gate is about
  (your pick, the bar, the average) on one face. The miniature per ballot row is the better idea: a
  column of votes becomes a row of rings with hands, which is the mark's grammar without a word.
- **Craft 9.** The tightest page of the twelve. The rest state is honest ("4 if you leave it", dashed
  pointer), the word recolours through ink tokens only, the locked state draws its check, dark
  re-weighs rather than inverts. Two things the still shows: with one rating in, the needle lies along
  the "3 · Fine" tick and covers the mono 3; and "Your rating decides." sits in italic serif beside a
  mono status line, two voices on one row.
- **Fit 8.** The brief's selling moment is the gate held by the people who consume the code, and this
  makes the gate something you read before you turn it. For daily use it is a second rating idiom:
  the plan card keeps stars, so a rater learns stars at 09:14 and a dial at 09:31 for what is, to
  them, the same act. The right drawer's "Reading the dial" legend is the tell that the instrument
  needs explaining.
- **Shippable 8.** One component, nine tokens, ~90 lines of CSS, only where a gate is rated.
- **Fix.** One rating idiom: put `MiniDial` on the plan card's rating row and in the approvals queue,
  so the dial is the one shape a team meets everywhere ratings appear; then the legend can go. And
  shoot the still with two ratings in, so the needle sits between words.

## 2 · sig-baton-handoff · 8.25

The driver's ring as a baton that leaves Ana's avatar, rolls along a lane above the composer with
weight (the hairline sags 6.9 %), waits open beside Bo for 32 s, closes around him on accept, rolls home
on decline. Seven frames, five springs as `linear()`.

- **Originality 9.** The one exploration where the brief's verb ("Bo has the baton") became a thing
  you can watch happen. The sag is the detail that makes it physical rather than an icon sliding.
- **Craft 8.** The frames and springs are specified to the millisecond. The still shows the cost: the
  composer is now three rows (lane, sentence with Accept/Decline, field with toggle), and the agent's
  square sits at the far end of the lane with no ring, which reads as "Checkout is not in the circle"
  on a page whose brief says it is a member.
- **Fit 9.** Handoff is the daily act that makes a team of people and agents one team rather than four
  people each with a tool. Living in the composer, where everyone's hands already are, is the right
  home. Decline leaving everything unchanged is the right manner.
- **Shippable 7.** `Composer.tsx` gains a lane, `ui.tsx` gains `Baton`, tokens gain four curves and
  three keyframes. Safari does not interpolate `d`, and the lane has no answer for six or more seats.
- **Fix.** Let the lane fold: when no handoff is pending and the session is Solo, the lane collapses to
  the driver's ringed avatar inside the composer's status line ("Ana is driving"), and only unfolds
  into seats when a handoff is offered or the Team toggle is on. A Solo session then pays nothing for
  a feature it is not using.

## 3 · sig-night-mode · 8.0

Dark as its own night: apricot is the only light (one lamp, lit top edges, every pulse), Dress Blues
is the air, chocolate is every shadow and the deepest surface. Nothing white, nothing grey.

- **Originality 6.** A warm dark theme with a lamp is a known move; what is Henosis's own is the
  three-colours-three-depths rule, which is a sentence a team can repeat.
- **Craft 8.** The dark still is the most cohesive dark frame in the wave: the stream, the gate, the
  toast and the specimen column all sit in one air. The hand at `#6B4339` is soft enough that
  "Approve with 4" reads as a shadow before it reads as a button; the light still has the toast
  covering the release gate's command, which is a content choice that hides the thing being rated.
- **Fit 9.** Engineers live in dark mode all day; this is the exploration with the most hours of use
  per line changed, and it keeps the roles (frame, page, hand, pulse) legible at night.
- **Shippable 9.** Tokens only, both dark blocks, no markup.
- **Fix.** Take the lifted `#7A4B3E` as the hand's fill and keep `#6B4339` for shadows: in the
  approvals queue six primaries sit in a column and each has to be found at a glance, and a button
  that relies on its lit edge to be a button fails the person on a dim laptop. Shoot the queue both
  ways to confirm, as the note proposes, but decide for the queue, not the specimen.

## 4 · sig-presence-constellation · 7.75

The Team page header as a sky: every session a ring, every person a point on it, a person on two
sessions sits where the rings cross, the baton is the lit point, an away member is a hollow point.

- **Originality 8.** The vesica for shared people is the first drawing in the wave that could only be
  Henosis: one circle per session, and the people who sit on two of them at the intersection.
- **Craft 7.** The light still reads. The dark still loses the rail's avatars: "with Dee", "with Bo",
  "with Ana" render as blank cream discs without initials, and the sky's hairline rings go faint. The
  ring labels (Billing page, Checkout) are the smallest serif on the page.
- **Fit 9.** This is the manager's view the brief asks for, as a picture rather than a roster, and it
  opens every morning. The sentence under the sky ("Ana has the baton in Billing page, Bo in Checkout
  … wait for Dee, away since 09:47") is the voice exactly. The phone still keeps the sky and the
  sentence, which is right.
- **Shippable 7.** A new layout solver and SVG renderer; the Team page already has the data. The cap
  past eight sessions is not decided.
- **Fix.** The dark avatars: the initials are drawn in a colour that equals the disc in the dark
  blocks; take `--rail-fg` for the glyph. Then make a point tappable: a tap on a person opens that
  member's row, so the sky is navigation and not only a hero.

## 5 · sig-glass-rail · 7.75

The rail as a stack of navy glass panes: one lamp lights every pane from above, a running card holds an
apricot light under its top edge and breathes, cards nest at 18 → 14 px.

- **Originality 6.** Frosted navy with a lamp is of its time; what is ours is that the only light on
  the rail is apricot and it means "live".
- **Craft 8.** Clean in both themes; the running card's pooled light is readable at 1×; the 2× crop
  shows the edges held at 1 px. The avatar initials in the cards ("AN BO", "BC AN") sit in discs too
  small for two letters.
- **Fit 8.** The rail is on screen every minute of the day, so a material that says "the room is lit
  where something is alive" pays off continuously. The lamp staying fixed (not following the active
  card) is the right reading of "motion means joining or living".
- **Shippable 9.** CSS, two wrapper classes, twelve tokens.
- **Fix.** Ship this as the one surfaces patch: fold in night-mode's lamp and paper-and-lacquer's grain
  with a single `--grain-alpha` per theme and one `--lamp`, and measure the frosted roster pane on a
  twelve-card rail on a 2020 laptop with `--glass-blur: 0` as the documented fallback.

## 6 · sig-welcome-cinematic · 7.75

The first ninety seconds after an invite as six beats on the lacquer: your arc alone, your agent's arc
swinging in to close the ring, the camera pulling back to the sky of sessions, your agent's byline,
the session paper, and the join line playing once as the page becomes the rail.

- **Originality 8.** An onboarding that is a film of the mark's own gesture rather than a tour of
  buttons. "Who is in, and where" as beat 3 is the brief's selling moment drawn.
- **Craft 8.** The stage is spare and the sky is the constellation's drawing. The chocolate arc on
  Dress Blues at hero size is 1.7 : 1 and reads quiet; the six-thumbnail strip under the stage is the
  exploration's editor and would never ship.
- **Fit 9.** The brief says the selling moment is joining; this is that moment with the agent entering
  the same circle on the same day. It happens once per member, so it is the opposite of daily, but it
  is what a lead shows a hiring manager.
- **Shippable 6.** A route transition into a live `SessionView`, a sky it shares with the constellation,
  and beat 4 assumes the server ran the agent's reading at invite time.
- **Fix.** Build it on the constellation's ring drawer (one drawer, two callers) and make beat 4
  honest: when the agent has read nothing yet, the byline is its manners alone and the plan chip in
  beat 6 does not appear. Then the clock stretches with the text rather than the text shrinking.

## 7 · sig-council-table · 7.75

A council of models as a round table: seats on a ring, each model's words as an arc toward the centre,
the chair at the top, the plan landing in the centre, dissent as a dashed arc, a scrubber under it
folding the table to any point in the council.

- **Originality 9.** The most beautiful drawing in the wave and the one nobody else has: a
  conversation between agents as geometry, with the dissent visible as a break in the ring.
- **Craft 8.** Both stills are composed; the ledger on the right does the reading the drawing cannot.
  Labels run out at seven seats; the scrubber's dots at 390 px are 17 px apart.
- **Fit 7.** The council is an occasional act, not a daily one, and on the table the people appear only
  as owners' labels ("Ana's model", "Dee's chair"); their decision (Bo 4, Dee 5) is a line of text in
  the centre. For a product whose story is people and agents in one circle, the people are off the
  drawing.
- **Shippable 7.** One component beside the council room the council patch adds; nothing in the
  stream or rail changes. Depends on that patch landing first.
- **Fix.** Put the people on the table: draw each rater as their circle on the ring filling to their
  star count (the note's own open question), so the vote sits on the same drawing as the models'
  words. Then cap seats at seven and fold the owner's line into the hover card past that.

## 8 · sig-paper-and-lacquer · 7.5

Cream stock with a faint grain, navy lacquered with a sheen and a lit top edge, chocolate as ink for
every rule, a debossed "UNITED · 13:41" stamp on a united notice, and print as a theme.

- **Originality 6.** Paper and lacquer are a known pairing; the stamp is the one gesture that is a
  Henosis word ("United pdf-layout into main") made physical.
- **Craft 8.** The `-now` still is the one to judge: the United card with its stamp above the gate is
  calm and finished, and the lacquer output block is the deepest surface as SYSTEM asks. The grain at
  .085 does not read at 1×, which means a cost without a reward on most screens.
- **Fit 8.** The stamp on United, Approved and Denied is a daily small joy that also says what the team
  did in one glance of the stream. The chocolate rules keep "the hand" meaning something even in a
  hairline.
- **Shippable 8.** CSS; the grain and sheen are the same layers glass-rail and night-mode add.
- **Fix.** Ship the stamp and the chocolate rules now, inside the surfaces patch, and stop the grain at
  the Team panel and Details drawer so a white sheet stays a sheet; keep one stamp word set (United,
  Approved, Denied, Returned) and put it only on the notice in the stream, not the inbox row.

## 9 · sig-token-art · 7.5

Spend drawn three ways: a ring per agent filling from the top against its plan (amber share past 80 %,
red lap past the plan, cache as a dotted arc beside the budget), the week as a mirrored waveform of
turns, October as a tide against the soft budget, with an apricot ember at whatever is spending now.

- **Originality 8.** The mirrored waveform makes a week of agent spend look like a recording of the
  room, and the cache-beside-not-inside-the-budget ring is a rule nobody else draws.
- **Craft 8.** The light still is a finished page under one sentence; table twins under every form.
  In dark the agent tints lift toward pink and the glow at .72 smudges; the waveform's mirror halves
  each column's honest height.
- **Fit 7.** A manager opens Usage weekly, not daily; the ring is the part that reaches the session
  drawer, the rail chip and the plan card, where a team sees it every hour. The brief's token
  optimisation (estimate vs actual, savings) is not on this page.
- **Shippable 7.** Three components in `viz.tsx`, twelve tokens, four keyframes. The founder has to pick
  mirror or baseline first.
- **Fix.** Ship `SpendRing` first and alone (session drawer, plan card totals, the rail's 16 px cut),
  put the baseline version of the week chart beside the mirror for the founder's pick, and drop the
  glow at night, keeping only the ember and its breath.

## 10 · sig-editorial-session · 6.75

The session as a long read: one 68-character column, the Goal as a masthead at 44 px, a serif heading
and a gutter numeral per turn, team messages as pull-quotes, every decision (ratings, the gate) as a
marginal note stitched to its passage with a dotted guide, a "To" row in the composer.

- **Originality 9.** The only exploration that changes what a session *is* rather than how one part of
  it looks. The masthead Goal and the gutter numerals are the strongest idea in the wave for the
  stream.
- **Craft 6.** The light and dark stills both show the composer painted over the plan's third row
  ("Run the PDF snapshot tests…" and its "3 of 11 so far" sit under the To row): the page does not
  reserve the composer's height. The notes know marginal notes collide when closer than their own
  height. The `-now` still, with the gate as a marginal note beside turn 4, is the frame to judge
  and it is good.
- **Fit 7.** For reading a finished session, or a replay, this is the best frame in the wave. For a
  live session with tool steps landing every few seconds it fights the stream: a masthead at the top
  of a running session is a page nobody is at, and the marginal notes move the one thing the brief
  wants directly above the composer (the pending gate) into a side column.
- **Shippable 5.** Rewrites `Message.tsx`'s shapes, the measure, the fonts, and asks `VirtualList` to
  keep working under a grid with margins.
- **Fix.** Fix the overlap (padding-bottom on the page equal to the composer's height) and stack
  marginal notes; then split the idea: ship the masthead Goal and the gutter numerals as a small patch
  to the stream now, and keep the full editorial page for replay and export, where it is right.

## 11 · sig-kinetic-mark · 6.75

The mark as the room's status in six states (idle, joining, settled, thinking, blocked, baton), with
the centre dot leaning 5 units toward whoever drives, the person's arc retracting 30 % when a hand is
needed, and a favicon in three states.

- **Originality 7.** A mark that breathes on only the agent's half, and a favicon that says "needs you",
  are both ours.
- **Craft 8.** A spec board, not a product screen; the timeline per state is clear and Calm has an
  answer per state.
- **Fit 5.** The brief is explicit: the founder chose this mark. Blocked retracts the person's arc and
  Baton moves the centre: both redraw the founder's geometry to carry status that the rail's dot and
  the status word already carry. At 20 px in a rail card a breathing half-ring beside a status word is
  two tells for one fact. The favicon is the one piece a team uses daily (which tab needs me).
- **Shippable 7.** `Mark` gains props, tokens gain four keyframes, `favicon.ts` is new; Safari needs a
  check on dasharray transitions.
- **Fix.** Keep the ring whole: drop the lean and the retraction, ship the three-state favicon and the
  "thinking" breath on the agent's arc only (the states that say "living"), and leave "needs you" to
  the status word and the dot.

## 12 · sig-unity-field · 6.0

The Home as a canvas of 98 drifting half-arcs that pair and close into rings under the pointer and
around the things that are alive on the page, with a hero line ("Many hands, one team. One holds the
baton at a time.") and a "Welcome back, Ana" list under it.

- **Originality 6.** A particle field that responds to the cursor is a landing-page hero.
- **Craft 7.** The still is handsome and the "Welcome back" list under it (Bo has the baton, the plan
  waits for two ratings, Checkout united into main, Cy left the circle) is the best morning brief in
  the wave, written in the voice exactly.
- **Fit 4.** The brief's rule is that motion means joining or living; ambient drift is neither, and the
  pairs close in response to a cursor, not to a member. The hero line is marketing voice on an app
  screen that a lead opens every morning, and under Calm the signature disappears for exactly the
  people who asked for quiet. The demonstration cursor in the still is the exploration selling itself.
- **Shippable 7.** One file and two attributes.
- **Fix.** Cut the field to the join moment: no drift at rest, one pair closes into a ring beside the
  row that just changed (a join, a handoff, a gate opening) and settles, as the brief's own motion
  rule says. Drop the hero line and let "Welcome back, Ana" and its list be the top of Home.

---

## The five to ship first, and why

1. **sig-night-mode.** The most hours of use per line changed: tokens only, both dark blocks, and the
   whole app becomes one night in one patch. Ship with the lifted hand fill.
2. **sig-approval-dial.** The gate is the brief's selling moment and a daily act; this is the tightest
   craft in the wave and replaces one component where a gate is rated. Ship with `MiniDial` on the
   plan card so the team learns one rating shape.
3. **sig-baton-handoff.** "Bo has the baton" is the unity verb and the composer is where everyone's
   hands already are. Ship once the lane folds for Solo sessions so nobody pays for it idle.
4. **sig-presence-constellation.** The one drawing that could only be Henosis (a person on two
   sessions sits where the rings cross), on the page a lead opens every morning. Ship after the dark
   avatars are fixed; it also becomes the ring drawer the welcome brief needs.
5. **sig-glass-rail, carrying the surfaces patch.** The rail is on screen every minute; one lamp, one
   grain alpha per theme, paper-and-lacquer's stamp and chocolate rules folded in, night-mode's lamp
   shared. Cheap, visible all day, and it stops six pages reinventing the same material.

Second wave, in order: paper-and-lacquer's remainder (already inside the surfaces patch), token-art's
`SpendRing` alone, welcome-cinematic once the constellation's drawer exists, council-table once the
council patch lands and the people are on the table.

Hold: editorial-session as the direction for replay and export (ship only its masthead and gutter
numerals into the stream now); kinetic-mark's favicon alone; unity-field cut to the join moment or
dropped.

Before any of the five is shot as final: decide Instrument versus Fraunces/Inter in SYSTEM §3 and hide
every inspector.
