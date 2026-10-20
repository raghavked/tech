# sig-approval-dial · The rating as a dial

The release gate's rating control drawn as the instrument it is. A rim of five stops over 240°, each
stop a serif word (Not yet, Risky, Fine, Good, Ship it) with a detent that pulls the hand in and
clicks as it crosses. The rule's bar is cut into the rim as a notch, with the band past it washed
apricot so the picks that clear the gate are a visible zone, not a sentence. The team's average so far
is a thin needle from the centre. Your hand is the chocolate knob and its pointer; until you turn it
the hand rests, dashed, at the 4 a plain Approve sends. The word, the number and the consequence sit
beside the dial ("With your 4 the average is 3.5: the gate opens"), the ballots run under both as
rows, each with a 26 px miniature of the same dial, and the one chocolate button carries the number it
will send. Keys, drag and tap all turn the same hand.

Files: `index.html` (self-contained: tokens inlined from `tokens.v5.css`, light and dark via
`prefers-color-scheme` and `[data-theme]`, every animation inside the one guard with
`prefers-reduced-motion` and `[data-motion="calm"]`, Fraunces and Inter asked for first with the
Instrument and system faces as fallbacks, no external asset, no font fetched, no script loaded),
`light.png`, `dark.png` (1440×900, the gate waiting for Ana's rating with her hand at 4), `phone.png`
(390×844, the dial at the width of the thumb, the action at the bottom). The screenshots show the
fallback faces: Fraunces and Inter are not on this machine and the page fetches nothing. `?pick=4`
opens the page with the hand turned to a stop; `?locked` opens it after the approval; `?calm` opens it
under Calm; the Dark and Calm buttons in the topbar are the exploration's own and set the attributes
`theme.ts` sets.

## What it is

| Part | What | Where |
|---|---|---|
| The rim | a 2 px arc of radius 100 on a 360 × 250 grid, from −120° to 120° with 0° at twelve, `pathLength="240"` so one unit is one degree; `--dial-rim` (navy at 16 %, cream at 16 % by night) | the dial |
| The stops | five, 60° apart; a 14 px tick across the rim, the word outside in italic serif anchored by the side it sits on, the number inside in mono, a 48 px hit circle; the picked stop's tick turns chocolate and thickens | the rim |
| The detent | while the hand is dragged its angle is `s + 4·d³` of the finger's value (`s` the nearest stop, `d` the distance to it, |d| ≤ ½), so the hand lingers at a word and jumps between words; crossing into a new stop pops that tick (`detent`, 180 ms, ×1.55) and, on touch, vibrates 6 ms; release snaps on `--ease-mark` over `--t` | the hand |
| The notch | at the rule's bar (3.5): a 7 px cut through the rim in the surface colour and a V dented inward, `--dial-notch` (the ink); `bar 3.5` in tracked mono outside it | the rim |
| The clear band | a 14 px arc in `--dial-zone` (apricot at 30 %, 14 % by night) from the notch to the end of the rim: where a pick clears the gate | behind the rim |
| The needle | a 1 px line in `--dial-needle` (navy; apricot by night) from r 50 to r 114 with a cap at the tip and a 4 px surface-coloured halo under it so it cuts cleanly across a tick; rotated to the team's average of the ratings that count; hidden while there is none; turns on `--t-slow` when a rating lands | the centre |
| The hand | a 34 px chocolate knob (`--dial-hand`, the lifted hand by night) with a cream slot, and a 3 px pointer from r 46 to r 86; `transform: rotate(var(--deg))` on `--ease-mark`; the knob sinks to .96 while pressed | the centre |
| Rest | before a pick the hand points at `DEFAULT_RATING` with a dashed pointer and a dim slot, no fill arc, and the word reads "4 if you leave it" in `--ink-3`; the button still says "Approve with 4" (SYSTEM §10: no surface pre-selects a number with a primary colour) | the dial, the word |
| The fill | the arc from the first stop to the hand in `--dial-fill` (apricot-deep; apricot by night), `stroke-dasharray: var(--len) 240`; a preview arc in `--dial-pre` (plain apricot: lighter than the pick, rating-control's rule) appears while a stop is hovered and the word beside says "3 of 5 · preview" | the rim |
| The word | 38 px italic serif, coloured by level with the `-ink` tokens (danger 1, warn 2, ink 3, ok 4–5), the number in mono beside it, a crossfade (`word-in`) when it changes | right of the dial |
| The consequence | the app's `Tally` arithmetic as a sentence: the average with your pick, whether it clears the bar, and the lowest next rating that would (`Bo at 5 would lift it`, `no third rating can lift it`) | under the word |
| The ballots | the votes as rows (SYSTEM §10, surfaces panel): serif name with `you`, role in faint sans, the note in italic serif, the 26 px miniature dial with the number and the word; a waiting rater's miniature is empty with "waiting"; your row mirrors the big dial live under "rating now" with the breathing apricot dot; an observer's approve is "a voice, not a vote · 4", dimmed | under the dial and the word |
| The tally | the quorum segments, `1 of 2 raters · 3 average`, and the verdict in italic serif ("Your rating decides.", "The gate opens.", "Under the bar: the release waits for Bo or a revision.") | under the rows |
| The actions | *Approve with 4* (the hand, with the number in mono), *Deny* in the danger ink, the hint "4 of 5 · Good" or "4 if you leave it", the notice's keys `a` `d` `1–5` | last |
| Locked | after Approve the hand stays, the slot and pointer fade, a check draws inside the knob (`draw`, 450 ms; drawn flat under Calm), the word gains "· sent", your row takes the note, the tally settles, a toast rises | the dial, the rows |
| Keys | the dial is one `role="slider"` (1–5, `aria-valuetext` "4 of 5, Good"): ← → ↑ ↓ turn by one stop, 1–5 jump, Home/End, 0 clears to rest, Enter moves to *Approve with N*, Esc drops a preview; on the notice `a` approves, `d` denies, 1–5 rate while nobody types; a polite live region reads the word and the consequence | the dial, the notice |
| Touch | the whole face is the drag surface (`touch-action: none`, pointer capture); a tap on a word picks it, a second tap on the pick clears; the bottom line reads "turn the hand, or tap a word" on coarse pointers | the phone |
| Phone | the rail and drawer fold away, the dial fills the width with the words a step larger, the word and consequence centre under it, the rows lose their note column, *Approve with N* is a 46 px bar at the thumb | 390 |

## Why it is ours

- **It is the ring with a hand in it.** The brand is two arcs closing on one centre; a gate is the
  team's arcs closing on one decision. The rim is the open ring (the mark's apart pose: not yet one),
  the needle is where the others have put the centre so far, and your hand closes the gap or leaves it
  open. The miniature in every ballot row is the same drawing, so a page of votes reads as a row of
  small rings each with its hand (presence-and-agents §9, the agreement ring: closed where they agree,
  open where they differ; data-craft §6, the rating glyph with a line at the required average).
- **It refuses the five-star row.** Five stars is the rating control of every store and every chat
  product's thumbs-up grown by three; a dial with a notch and a needle is an instrument you read
  before you turn it, and it puts the three numbers a gate is about (your pick, the bar, the average)
  on one face instead of in three sentences (ai-interfaces-avoid: the artifact becomes the interface;
  Wattenberger's controls baked into the interface rather than prose). Nothing on it is a star, a
  sparkle or a pill.
- **Colour by job, one meaning each** (SYSTEM principles 1, 2, 4, 5). The rim and the needle are
  navy stepped in lightness, data-craft's rule that data ink is Dress Blues; the fill is the pulse's
  deep step like every meter; the only chocolate on the face is the knob and its pointer, because it
  is the one thing you press, and the only other chocolate on the screen is *Approve with 4*; the
  clear band is the apricot wash that elsewhere means "where you are"; the status hues appear only in
  the word, against the gate, through the `-ink` tokens. By night the hand is the lifted chocolate and
  the needle is apricot, so the drawing is the same at night (dark-mode: re-weighed, not inverted).
- **The detent is motion that means something** (MOTION principles 1, 2, 7; motion-choreography: the
  Family and Kowalski rules, interruptible, on the mark's curve, overshoot keyed by hand). The hand
  travels on `--ease-mark`, the one curve for anything that travels; the click is the status pulse's
  `pop` in miniature on the stop you crossed; the check is the granted approval's drawn stroke. Rest
  is the end state: every transition reads the clocks, the clocks are zero under Calm and reduce, and
  the page opens as a finished instrument at whatever state it is asked for.
- **Progress bound to real arithmetic** (motion-choreography §6). The needle is `ratingProgress`'s
  average, the notch is `rule.ratings.average`, the quorum segments are `rule.ratings.min`, the
  consequence is `Tally`'s lift. Nothing on the face is decorative; the drawer's legend names each
  part in a sentence so no colour carries a meaning alone (SYSTEM §18).
- **Named things are serif, read things are sans, counts are mono** (SYSTEM principle 6;
  editorial-type §7 for the tracked mono `bar 3.5` and the stop numbers; premium-product-ui §9
  Fraunces for the words and the names, Inter for the consequence and the button). The five words are
  the scale's names, so they are serif on the face and italic beside it; the pick's number is mono
  wherever it appears, tabular, so "4 of 5" and "3.5 average" line up in every row.
- **It is not Claude's, ChatGPT's or Linear's.** None of them rates anything with a dial; a gauge with
  a notch for a rule and a needle for a team's average belongs to a product whose claim is that people
  gate what agents ship. The navy rim, the apricot band and the chocolate hand keep it in the three
  colours and off the clay-and-ivory of Claude (SYSTEM principle 10; three-colour-brands: take the
  discipline, not the hue).

## The technique

- **One SVG, built once, driven by four custom properties.** The rim, the band, the notch, the five
  stops and the needle are placed by `pt(angle, r)` at mount; after that the script only sets `--deg`
  (the hand), `--len` (the fill, in degrees because `pathLength="240"`), `--plen` (the preview) and
  `--avg-deg` (the needle) on the dial, and toggles `rest`, `previewing`, `dragging`, `pressing`,
  `locked`, `noavg` and the stop's `cur` / `pre` / `click`. CSS does the rest: the hand and the
  needle rotate with `transform-box: view-box; transform-origin: 180px 128px`, the fill is a dasharray
  transition, the knob's press is a scale. Fifty SVG nodes.
- **The detent is one line of arithmetic**: `detent(v) = s + 4·(v − s)³`. Continuous at the half-way
  points (±½ → ±½), flat at the stops (the cube), so a finger sweeping the rim feels each word catch
  and let go. Crossing is detected on the rounded value, which is also what the pick becomes, so the
  hand can never rest between words. Pointer capture keeps the drag alive off the face; the bottom gap
  (beyond ±120°) resolves to the nearer end so a swipe past Ship it does not flip to Not yet.
- **Transitions for travel, keyframes for events, all under one guard.** The eight animation rules
  (`detent`, `word-in`, `dot-live` ×2, `draw`, `toast-up`, `card-in`) live inside
  `@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }`; the
  transitions read `--t`, `--t-fast`, `--t-slow`, which the calm attribute and the reduce query set to
  zero. The click's class is removed on a 200 ms timer, never on `animationend`, which does not fire
  under Calm. The drawn check's rest state (`stroke-dashoffset: 0`) is written on `.locked .check`
  outside the guard, so Calm shows the check.
- **The miniature is the same geometry at r 11**, a 36 × 28 view with the same `--deg` / `--len`
  properties, so a ballot row and the big dial can never disagree about where 4 points.
- **Accessibility.** The dial is a single `role="slider"` with `aria-valuetext`, described by the
  consequence; the stops are hit areas inside it, not separate controls, so a screen reader meets one
  thing with one value; the word, the number and the consequence are text beside every colour; the
  needle and notch have their sentence in the drawer's legend; focus is the 2 px `--focus-ring` with
  the 6 px halo on the dial's rounded box; the fastest change is the 180 ms click on a tick.

## The cost

Measured headless (Chromium 1440×900 and 390×844), the page at `?pick=4`.

| | 1440×900 | 390×844 |
|---|---|---|
| SVG nodes in the dial | 45 | 45 |
| nodes in the four ballot rows | 54 | 54 |
| script per key press (1–5), 200 presses | 5.2 ms | 2.9 ms |
| JS heap after mount | 9.5 MB (the page, not the dial) | 9.5 MB |
| page, uncompressed | 66 KB (tokens, styles, the rail and drawer, the script) | |
| at rest, Calm or reduce | still; no clock | |

The 5 ms per press is the exploration's own waste: `render()` rebuilds the four ballot rows with
`innerHTML` and forces one layout to restart the word's crossfade. Dragging sets two custom properties
per `pointermove` and nothing else, so the compositor animates one rotation and one dasharray; the
click is one `transform` keyframe on a 14 px line. In the app the rows are React children and only
your row's two properties change per press, so the per-press cost is the slider's `setState`.

## How it ports into `apps/web`

The dial replaces `Stars` only where a gate is rated: the release-gate notice in the stream, its
sheet on the phone, and the approvals queue's expanded row. The plan card keeps `Stars` (a plan has
no bar and no needle; see Open).

1. **`apps/web/src/stream/RatingDial.tsx`** (new): the `<script>`'s builder as a component
   `RatingDial({ value, onChange, onClear, bar, average, count, min, locked, size })`. `bar` and
   `average` come from `ratingProgress(s, a)` (`approvalsQueue.ts`: `{ count, min, average, bar }`),
   `value` is the notice's `rating` state, `onClear` the `0` key. Build the SVG once with JSX
   (`useMemo` on `bar`); drive it with the four style properties and the classes exactly as the
   exploration does; the detent, the drag and the keys are the exploration's handlers; `motionNow()`
   / `useMotion()` is read only to skip the 200 ms click timer. Export `MiniDial({ value })` from the
   same file for the rows.
2. **`apps/web/src/stream/ApprovalNotice.tsx`**: in the `.rating` block, replace
   `<Stars value={rating} onChange={setRating} />` (the line under `copy.plan.yourRating`) with
   `<RatingDial value={rating} onChange={setRating} onClear={() => setRating(null)} bar={gate.bar}
   average={gate.average} count={gate.count} min={gate.min} />`; move the `.picked` mono and the note
   input beside it into the `.say` column; give `Tally` the verdict line and let `Ballot` (the rows
   with `kind="waiting" | "voice"`) render `<MiniDial>` in place of `.mini` stars. `Decided` passes
   `locked` so the dial draws its check. The `1–5` keys on the notice already exist (`onKeyDown`).
3. **`apps/web/src/copy.ts`**: `approval.withoutPick(n)` becomes `"${n} if you leave it"`
   (SYSTEM §10's hint), `approval.picked(n)` stays `"${n} of 5"`, and the consequence sentences
   (`opens`, `underBar(lift)`, `cannotLift`) join `approval.oneMore` / `lifts` / `cannotLift`, which
   already exist; the dial's `aria-valuetext` is `copy.rating.name(n)`.
4. **`apps/web/src/tokens.css`**: the nine `--dial-*` properties (`rim`, `zone`, `fill`, `pre`,
   `hand`, `hand-fg`, `needle`, `tick`, `notch`) in the light block and, byte-identical, in both dark
   blocks (values in `index.html`'s `:root` and dark blocks). **`theme.ts`** `applyTeamTheme`: set
   `--dial-hand` from the team's hand with the other `--team-*` properties.
5. **`apps/web/src/styles.css`**: the rules under "the dial itself", "the ballots" and "the tally and
   the actions" from `index.html` (about 90 lines) beside `.notice .rating`; the seven animation
   rules into the existing guard block; the keyframes `detent` and `word-in` beside `pop` and
   `dot-live`; the `≤ 640` star-tile block becomes the phone block from this page (the dial fills the
   width, the action bar at the thumb).
6. **`apps/web/src/views/Approvals.tsx`** (the queue) and the mobile approvals sheet: the expanded
   row rates with `<RatingDial size="sm">` (the 340 px face at 260), the collapsed row shows
   `<MiniDial>` per rater; the Slack adapter is untouched and still sends 4.

## Open

- **Arrows turn or preview?** SYSTEM §10's stars preview on arrows and pick on Enter. On a dial the
  hand *is* the pick, so arrows turn it and Enter goes to the button; the page keeps hover as the one
  preview. If the panel wants arrows to preview, the hand can turn dashed (the rest style) until Enter,
  at the cost of a second state to learn.
- **The needle on a stop.** With one rating in, the average always sits on a word and the needle lies
  along that tick; the halo keeps it legible, but a needle that lands between words (two or more
  ratings) is the better picture. The screenshots show the one-rating case on purpose, because that is
  the case the second rater meets most.
- **Clearing by a second tap** on the picked word (as here) against 0 only: the queue's accidental
  clears are the worry rating-control raised and this page does not settle.
- **The plan card.** A plan's ratings rule has a minimum but no bar, and the needle would be the
  average of the team's ratings; the dial without a notch may still be worth it for the plan's
  "waits for two ratings" line, or the plan keeps stars and the dial stays the gate's signature. One
  pass with both on a plan card would settle it.
- **A bar of 4.5** puts the notch 15° from Ship it; the `bar` label then wants to sit inside the rim.
- **Haptics on the web** are a 6 ms vibrate on Android only; iOS Safari gives none. The detent's
  visual click and the word's change carry the feel on the phone; whether the desktop app (Tauri)
  should ask the trackpad for a haptic tick is a desktop-window question.
