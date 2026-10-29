# sig-approval-dial · The rating as a dial (second pass)

The release gate's 1–5 rating drawn as the instrument it is. A rim of five stops over 240°, each stop a
serif word (Not yet, Risky, Fine, Good, Ship it) with a detent that pulls the hand in and clicks as it
crosses. The rule's bar is cut into the rim as a notch and the band past it is washed apricot, so the
picks that clear the gate are a zone you can see. The team's average so far is a thin needle from the
centre. Your hand is the chocolate knob and its pointer; until you turn it the hand rests, dashed, at
the 4 a plain Approve sends. Beside the face sit the word, the number and the consequence ("With your
4 the average is 4.3: the gate opens"), the ballots run under both as rows each carrying a 36 px
miniature of the same dial, and the one chocolate button carries the number it will send. Keys, drag
and tap turn the same hand. When your approval lands and the gate opens, the rim's two ends swing down
and close into a ring, chocolate on the person's side and navy on the agent's, and the centre lights
apricot: the mark's own gesture, two arcs closing on one centre, performed by the gate itself.

This is the second pass on the element. The first was judged 8.5 / 7.5 / 8.25 (`_judge-signature-1/2/3`)
with seven concrete fixes, all taken here: the stop numbers moved inside the needle's reach and the
needle drawn under the stops; the still shot with two ratings in so the needle sits between words;
the phone's actions wrap and the hint takes its own line (the first page overflowed 39 px); your
ballot row updates by two custom properties, never an `innerHTML` rebuild of four rows; the plan's
ratings are the same miniature so a team learns one rating shape, and the "Reading the dial" legend
is gone; the verdict is sans beside mono counts, one voice per row; the exploration's Dark and Calm
buttons are `data-inspector` and hidden when the shooter opens the page (`navigator.webdriver`), so
the stills show the product's topbar. Two of the first page's open questions are settled below.

Files: `index.html` (self-contained: tokens inlined from `tokens.v5.css`, light and dark via
`prefers-color-scheme` and `[data-theme]`, every animation inside the one guard with
`prefers-reduced-motion` and `[data-motion="calm"]`, Fraunces and Inter asked for first with the
Instrument and system faces as fallbacks, no external asset, no font fetched, no script loaded),
`light.png`, `dark.png` (1440×900, the gate waiting for Ana's rating with her hand at 4, Cy's 4 and
Bo's 5 in, the needle at 4.5), `phone.png` (390×844, the dial at the width of the thumb, the action
bar stuck at the bottom). The stills show the fallback faces: Fraunces and Inter are not on the
render machine and the page fetches nothing. `?pick=N` opens the page with the hand turned to a stop,
`?locked` opens it after the approval (the check drawn, the ring closed), `?calm` opens it under
Calm, `?dark` in the dark theme.

## What it is

| Part | What | Where |
|---|---|---|
| The rim | a 2 px arc of radius 100 on a 360 × 212 grid, from −120° to 120° with 0° at twelve, `pathLength="240"` so one unit is one degree; `--dial-rim` (navy at 16 %, cream at 16 % by night) | the dial |
| The stops | five, 60° apart; a 14 px tick across the rim, the word outside at r 126 in italic serif anchored by the side it sits on, the number inside at r 78 in mono with a 3 px surface-coloured `paint-order: stroke` so it stays readable under the needle, a 48 px hit circle; the picked stop's tick turns chocolate and thickens | the rim |
| The detent | while the hand is dragged its angle is `s + 4·d³` of the finger's value (`s` the nearest stop, `d` the distance to it, \|d\| ≤ ½), so the hand lingers at a word and jumps between words; crossing into a new stop pops that tick (`detent`, 180 ms, ×1.55) and, on Android, vibrates 6 ms; release snaps on `--ease-mark` over `--t` | the hand |
| The notch | at the rule's bar (3.5): a 7 px cut through the rim in the surface colour and a V dented inward, `--dial-notch` (the ink); `bar 3.5` in tracked mono outside it | the rim |
| The clear band | a 14 px arc in `--dial-zone` (apricot at 30 %, 14 % by night) from the notch to the end of the rim: where a pick clears the gate | behind the rim |
| The needle | a 1 px line in `--dial-needle` (navy; apricot by night) from r 30 to r 92 with a cap at the tip and a 4 px surface-coloured halo under it, drawn **under** the stops so a number stays whole when the average lands on a word; rotated to the team's average of the ratings that count; hidden while there is none; turns on `--t-slow` when a rating lands | the centre |
| The hand | a 44 px chocolate knob (`--dial-hand` = the hand, lifted by night) with a cream slot, and a 3 px pointer from r 28 to r 84; `transform: rotate(var(--deg))` on `--ease-mark`; the knob sinks to .94 while pressed | the centre |
| Rest | before a pick the hand points at `DEFAULT_RATING` with a dashed pointer and a dim slot, no fill arc; the word reads "Good" in `--ink-3` with "4 if you leave it" beside it and the sentence says "A plain Approve sends 4"; the button still says "Approve with 4" (SYSTEM §10: no surface pre-selects a number with a primary colour) | the dial, the word |
| The fill | the arc from the first stop to the hand in `--dial-fill` (apricot-deep; apricot by night), `stroke-dasharray: var(--len) 240`; a preview arc in `--dial-pre` (plain apricot: lighter than the pick, rating-control's rule) appears while a stop is hovered and the number reads "3 of 5 · preview" | the rim |
| The word | 38 px italic serif, coloured by level with the `-ink` tokens (danger 1–2, warn 3, ok 4–5), the number in mono beside it, "clear `0`" as a 24 px ghost when a pick is in, a crossfade (`word-in`) when it changes | right of the dial |
| The consequence | the app's `Tally` arithmetic as two sentences: the average with your pick and whether it clears the bar; then the lowest pick that opens it ("A 2 or above opens it; a 1 holds it.", "No third rating can lift the average to the bar.") | under the word |
| The ballots | the votes as rows (SYSTEM §10, surfaces panel): serif name with `you`, role in faint sans, the note in italic serif, the 36 × 28 miniature with the number and the word; a waiting rater's miniature is an empty dashed rim with "waiting"; your row mirrors the big dial live under "rating now" with the breathing apricot dot; an observer's approve is "a voice, not a vote · 4", dimmed | under the dial and the word |
| The tally | the quorum segments (`role="meter"`), `2 of 3 raters · 4.5 average` with the counts in mono, and the verdict in sans 500 ("Yours is the third; it decides.", "The gate opens.", "Under the bar; waits for a revision."), coloured through `--ok-ink` / `--warn-ink` only once decided | under the rows |
| The actions | *Approve with 4* (the hand, the number in mono), *Deny* in `--danger-ink`, the hint "4 of 5 · Good" or "4 if you leave it", the notice's keys `a` `d` `1–5` | last |
| Locked | after Approve the hand stays, the slot and pointer fade, a check draws inside the knob (`draw`, 450 ms); if the gate opens, the rim's two ends swing to six o'clock (`ring-close`, 600 ms, the person's end chocolate, the agent's navy) and the centre lights (`centre-in`, an apricot ring round the knob); the word gains "· sent", your row takes your note, the tally settles, a toast rises on navy; under the bar the ring stays open and the verdict says so | the dial, the rows |
| Keys | the dial is one `role="slider"` (1–5, `aria-valuetext` "4 of 5, Good" / "4 if you leave it", `aria-describedby` the consequence): ← → ↑ ↓ turn by one stop, 1–5 jump, Home/End, 0 clears to rest, Enter moves to *Approve with N*, Esc drops a preview; on the notice `a` approves, `d` denies, 1–5 rate and 0 clears while nobody types; a polite live region reads the word, the number and the consequence on every change | the dial, the notice |
| Touch | the whole face is the drag surface (`touch-action: none`, pointer capture); a tap on a word picks it; the bottom line reads "turn the hand, or tap a word" on coarse pointers | the phone |
| Phone | the rail and drawer fold away, the dial fills the width with the words a step larger, the word and consequence centre under it, the rows lose their note column, the actions are a bar stuck to the bottom of the stream (`position: sticky`; the notice's `overflow` becomes `clip-path` so it does not become the bar's scrollport) with *Approve with N* at 46 px and the hint on its own line | 390 |
| The plan | the plan's rating row and the drawer's "The plan" group use the same miniature (`MiniDial`), so the shape a rater meets at 09:14 on the plan is the shape at 14:21 on the gate; no legend is needed anywhere | the stream, the drawer |

## Why it is ours

- **It is the ring with a hand in it, and it closes.** The brand is two arcs closing on one centre; a
  gate is the team's arcs closing on one decision. The open rim is the mark's apart pose (not yet one),
  the needle is where the others have put the centre so far, your hand closes the gap or leaves it
  open, and when the gate opens the two ends of the rim swing down and meet: the person's end in
  chocolate, the agent's in navy, the centre in apricot, the mark's own ground rule for cream (SYSTEM
  §5, brand-board's table). The first pass only implied the mark through the rim; the panel said so,
  and the ring-close is the answer. The miniature in every ballot row is the same drawing, so a page
  of votes reads as a row of small rings each with its hand (presence-and-agents §9, the agreement
  ring; data-craft §6, the rating glyph with a line at the required average).
- **It refuses the five-star row.** Five stars is the rating control of every store and every chat
  product's thumbs-up grown by three; a dial with a notch and a needle is an instrument you read
  before you turn it, and it puts the three numbers a gate is about (your pick, the bar, the average)
  on one face instead of in three sentences (ai-interfaces-avoid: Wattenberger's controls baked into
  the interface rather than prose; the artifact as the interface). Nothing on it is a star, a sparkle
  or a pill. It is now the one rating shape in the product, on the plan as well as the gate (judge 3's
  fix), so it is not a second idiom beside stars.
- **Colour by job, one meaning each** (SYSTEM principles 1, 2, 4, 5; data-craft's palette rule). The
  rim and the needle are navy stepped in lightness, the fill is the pulse's deep step like every
  meter, the only chocolate on the face is the knob and its pointer because it is the one thing you
  press, the only other chocolate on the screen is *Approve with 4*; the clear band is the apricot
  wash that elsewhere means "where you are"; the status hues appear only in the word, against the
  gate, through the `-ink` tokens. By night the hand is the lifted chocolate and the needle is apricot,
  so the drawing is the same at night (dark-mode: re-weighed, not inverted). The closing arcs keep
  their ground colours in both themes, like the mark's.
- **The detent is motion that means something** (MOTION principles 1, 2, 7; motion-choreography: the
  Kowalski and Family rules, interruptible, overshoot keyed by the hand). The hand travels on
  `--ease-mark`, the one curve for anything that moves; the click is the status pulse's `pop` in
  miniature on the stop you crossed; the check is the granted approval's drawn stroke (MOTION §6.5);
  the ring-close is the join timeline in miniature (arcs then centre, MOTION §7). Rest is the end
  state: every keyframe declares its `from`, the transitions read the clocks, the clocks are zero under
  Calm and reduce, and the page opens as a finished instrument at whatever state it is asked for.
- **Progress bound to real arithmetic** (motion-choreography §6, data-craft's annotation rule). The
  needle is `ratingProgress`'s average, the notch is `rule.ratings.average`, the quorum segments are
  `rule.ratings.min`, the consequence is `Tally`'s lift. Nothing on the face is decorative and nothing
  needs a legend: every colour has its sentence beside it (SYSTEM §18).
- **Named things are serif, read things are sans, counts are mono** (SYSTEM principle 6;
  editorial-type §7 for the tracked mono `bar 3.5` and the stop numbers; premium-product-ui §9
  Fraunces for the words and the names, Inter for the consequence and the button). The five words
  are the scale's names, so they are serif on the face and italic beside it; the pick's number is mono
  wherever it appears, tabular, so "4 of 5" and "4.5 average" line up in every row; the verdict is
  sans because it is read, beside mono counts, one voice per row (judge 3's note).
- **It is not Claude's, ChatGPT's or Linear's.** None of them rates anything with a dial; a gauge with
  a notch for a rule, a needle for a team's average and a ring that closes when people and an agent
  agree belongs to a product whose claim is that people gate what agents ship. The navy rim, the
  apricot band and the chocolate hand keep it in the three colours and off the clay-and-ivory of
  Claude (SYSTEM principle 10; three-colour-brands: take the discipline, not the hue).

## The technique

- **One SVG, built once, driven by four custom properties.** The band, the rim, the fill, the preview,
  the closing arcs, the notch, the five stops, the needle and the hand are placed by `pt(angle, r)` at
  mount; after that the script only sets `--deg` (the hand), `--len` (the fill, in degrees because
  `pathLength="240"`), `--plen` (the preview) and `--avg-deg` (the needle) on the dial, and toggles
  `rest`, `previewing`, `dragging`, `pressing`, `locked`, `open`, `noavg` and the stop's `cur` / `pre`
  / `click`. CSS does the rest: the hand and the needle rotate with `transform-box: view-box;
  transform-origin: 180px 136px`, the fill is a dasharray transition, the knob's press is a scale.
  48 SVG nodes.
- **The detent is one line of arithmetic**: `detent(v) = s + 4·(v − s)³`. Continuous at the half-way
  points (±½ → ±½), flat at the stops (the cube), so a finger sweeping the rim feels each word catch
  and let go. Crossing is detected on the rounded value, which is also what the pick becomes, so the
  hand can never rest between words. Pointer capture keeps the drag alive off the face; the bottom gap
  (beyond ±120°) resolves to the nearer end so a swipe past Ship it does not flip to Not yet.
- **The ring-close is two dashoffsets.** Each closing arc is 60° of the same circle with
  `pathLength="60"`, `stroke-dasharray: 60`, and its rest state (`stroke-dashoffset: 0`) is written on
  `.dial.locked.open .close` outside the guard; the keyframe `ring-close` goes `from 60` to `0`, 400 ms
  after the check starts, and `centre-in` pops the apricot ring at 950 ms, so under Calm the closed
  ring and the lit centre are simply present (MOTION §3: a guard that only adds motion cannot hide a
  rest state).
- **Transitions for travel, keyframes for events, all under one guard.** The eight animation rules
  (`detent`, `word-in`, `dot-live`, `draw`, `ring-close`, `centre-in`, `toast-up`, `card-in`) live
  inside `@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }`; the
  transitions read `--t`, `--t-fast`, `--t-slow`, which the calm attribute and the reduce query set to
  zero. The click's class is removed on a 200 ms timer, never on `animationend`, which does not fire
  under Calm; the toast's delay reads `--motion` and is zero under Calm.
- **The miniature is the same geometry at r 11**, a 36 × 28 view with the same `--deg` / `--len`
  properties and the notch at the same angle, so a ballot row, the plan card and the big dial can
  never disagree about where 4 points.
- **Your row is two properties.** `render()` sets `--deg` and `--len` on your miniature and two words
  in your row; the other rows are built once. The per-press cost that remains is the word's crossfade
  restart (one forced layout) and the consequence sentence.
- **Accessibility.** The dial is a single `role="slider"` with `aria-valuetext` and
  `aria-describedby` on the consequence; the stops are hit areas inside it, not separate controls, so a
  screen reader meets one thing with one value; the word, the number and the consequence are text
  beside every colour; the quorum is a `role="meter"`; the live region reads each change once; focus
  is the 2 px `--focus-ring` with the 6 px halo on the dial's rounded box; every control is 24 px or
  more (measured: none under); the rail's role text is `--rail-muted` (6.6 : 1 on navy).

## The cost

Measured headless (Chromium 1440×900 and 390×844), the page at `?pick=4`, 200 key presses 1–5.

| | 1440×900 | 390×844 |
|---|---|---|
| SVG nodes in the dial | 48 | 48 |
| nodes in the four ballot rows | 69 | 69 |
| nodes on the page | 408 | 408 |
| script per key press (1–5) | 1.9 ms | 3.4 ms |
| animations running at rest | 1 (the breathing dot) | 1 |
| animations running under reduce, locked | 0, the check drawn and the ring closed | 0 |
| horizontal overflow | 0 px | 0 px |
| controls under 24 px | none | none |
| JS heap after mount | 9.5 MB (the page, not the dial) | 9.5 MB |
| page, uncompressed | 72 KB (tokens, styles, the rail and drawer, the script) | |

The 1.9 ms per press (5.2 ms in the first pass) is the consequence sentence plus the one forced layout
that restarts the word's crossfade. Dragging sets two custom properties per `pointermove` and nothing
else, so the compositor animates one rotation and one dasharray; the click is one `transform`
keyframe on a 14 px line; the ring-close is two dashoffsets and one opacity. In the app your row is a
React child and only its two properties change per press, so the per-press cost is the slider's
`setState`.

## How it ports into `apps/web`

The dial replaces `Stars` everywhere a rating is picked, and `MiniDial` replaces `MiniStars`
everywhere a rating is shown, so the product has one rating shape (judge 3's fix). The gate's face has
the notch and the needle; the plan's face has neither (a plan's rule has a minimum but no bar), which
is `bar={null}` and `average={null}` on the same component.

1. **`apps/web/src/stream/RatingDial.tsx`** (new): the `<script>`'s builder as a component
   `RatingDial({ value, onChange, onClear, bar, average, count, min, locked, open, size })`. `bar`
   and `average` come from `ratingProgress(s, a)` (`approvalsQueue.ts`: `{ count, min, average, bar }`),
   `value` is the notice's `rating` state, `onClear` the `0` key, `open` whether the decided gate
   cleared its bar (the ring closes only then). Build the SVG once with JSX (`useMemo` on `bar`);
   drive it with the four style properties and the classes exactly as the exploration does; the
   detent, the drag and the keys are the exploration's handlers; `motionNow()` / `useMotion()` is read
   only to skip the 200 ms click timer and the toast's wait. Export `MiniDial({ value, bar? })` from
   the same file for the rows.
2. **`apps/web/src/stream/ApprovalNotice.tsx`**: in the `.rating` block, replace both branches
   (`<StarTiles …>` on the phone and `<Stars value={rating} onChange={setRating} />` on desktop,
   under `copy.plan.yourRating`) with one `<RatingDial value={rating} onChange={setRating}
   onClear={() => setRating(null)} bar={gate.bar} average={gate.average} count={gate.count}
   min={gate.min} />`; move the `.picked` mono and the note input beside it into the `.say` column;
   give `Tally` the verdict line as sans; let `VoteRow` (`kind="rated" | "waiting" | "voice"`) render
   `<MiniDial>` in place of `<MiniStars>`. `Decided` passes `locked` and `open` so the dial draws its
   check and closes its ring. The `1–5` keys on the notice already exist (`onKeyDown`); add `0`.
   `StarTiles.tsx` and the `.star-tiles` blocks in `styles.css` go.
3. **`apps/web/src/stream/PlanCard.tsx`**: `<Stars value={mine?.rating ?? null} …>` becomes
   `<RatingDial size="sm" bar={null} average={null} …>` on the `.rating` row, and the raters' chips
   render `<MiniDial value={x.rating} />` for `<MiniStars n={x.rating} />`. `MiniStars` is then
   unused and goes.
4. **`apps/web/src/copy.ts`**: `approval.withoutPick(n)` becomes `ifYouLeaveIt(n)`'s text
   ("4 if you leave it", SYSTEM §10's hint; `ifYouLeaveIt` already exists), `approval.picked(n)`
   stays `"${n} of 5"`, and the two consequence sentences (`withYour(n, avg, opens)`,
   `lowestOpens(lo)` / `cannotLift`) join `approval.oneMore` / `lifts` / `cannotLift`; the verdicts
   `decidesThird`, `opens`, `underBar` beside `approval.decides`; the dial's `aria-valuetext` is
   `copy.rating.name(n)`. `queue.ratingWord` keeps its own five words for the queue's compact rows or
   takes `RATING_WORDS`, one decision.
5. **`apps/web/src/tokens.css`**: the twelve `--dial-*` properties (`rim`, `zone`, `fill`, `pre`,
   `hand`, `hand-fg`, `needle`, `tick`, `notch`, `arc-person`, `arc-agent`, `centre`) in the light
   block and, byte-identical, in both dark blocks (values in `index.html`'s `:root` and dark blocks).
   `--dial-hand` is `var(--accent)` so `theme.ts`'s `applyTeamTheme` recolours it with the team's
   hand for free. These twelve are the dial's whole namespace (judge 1's finding 2).
6. **`apps/web/src/styles.css`**: the rules under "the dial itself", "the miniature", "the ballots"
   and "the tally and the actions" from `index.html` (about 110 lines) beside `.notice .rating`; the
   eight animation rules into the existing guard block; the keyframes `detent`, `ring-close` and
   `centre-in` beside `pop` and `dot-live`; the `≤ 640` block from this page in place of the
   star-tile block (the dial fills the width, the action bar sticks; the notice takes `clip-path`
   instead of `overflow: hidden` on the phone).
7. **`apps/web/src/views/Approvals.tsx`** and **`ApprovalsPhone.tsx`**: the expanded row rates with
   `<RatingDial size="sm">` (the 340 px face at 260), the collapsed row shows `<MiniDial>` per rater;
   the Slack adapter is untouched and still sends `DEFAULT_RATING`.

## Settled from the first pass

- **Arrows turn; hover previews.** The hand *is* the pick, so arrows turn it and Enter goes to the
  button; hover is the one preview and Esc drops it. SYSTEM §10's "arrows preview, Enter picks" was
  written for stars, where the pick is a separate press; on a dial a second dashed state would be a
  second thing to learn for no gain.
- **0 clears, a second tap does not.** The first pass cleared on a second tap of the picked word,
  which is the accidental clear rating-control worried about in the queue. Now a tap on the pick does
  nothing, `0` clears, and "clear `0`" is a 24 px ghost beside the word so the mouse has a way too.

## Open

- **A bar of 4.5** puts the notch 15° from Ship it and `bar 4.5` would sit over the word; the label
  then wants to move inside the rim. One rule in the product has it; one pass with that rule.
- **The plan's dial without a notch** is specified above but not drawn here; the plan-card's rating
  row is the place to check that the face without a band still reads as the same instrument.
- **Haptics on the web** are a 6 ms vibrate on Android only; iOS Safari gives none. The detent's
  visual click and the word's change carry the feel on the phone; whether the desktop app should ask
  the trackpad for a haptic tick is a desktop-window question.
