# sig-editorial-session · The session as an editorial page

The session view set like a long read instead of a chat. One text column on cream, 68 characters
wide. The brief is the masthead: Ana's goal in a display serif at 44 px, with "Goal." in the hand's
ink. Every turn opens with a serif heading and a numeral hung into the gutter; the byline under it is
on the page's one line-height, with the two-arc ring saying who (person, agent, or the whole team).
The team's words are a pull-quote whose opening quote hangs into the margin. Everything that is a
decision (the ratings on the plan, "to the team", the release gate with your stars and *Approve with
4*) is a **marginal note** anchored to the passage it answers and stitched to it with a dotted guide.
Token counts are numerals in Fraunces, lining and tabular, so spend reads as part of the sentence.
The composer is a rule under the text, aligned to the text edge, with a *To* row instead of a toggle.

Files: `index.html` (self-contained: tokens inlined from `tokens.css` v5, light and dark via
`prefers-color-scheme` and `[data-theme]`, every animation inside the one guard with
`prefers-reduced-motion` and `[data-motion="calm"]`, Fraunces and Inter asked for first with
Instrument and the system faces as fallbacks, no external assets, no fonts fetched, no external
script); `light.png`, `dark.png` (1440×900, the page as it opens); `light-now.png`, `dark-now.png`
(the same page scrolled to the live turn and the gate, `index.html#now`, which is where the app
opens a running session); `phone.png`, `phone-gate.png` (390×844). The screenshots show the
fallback faces (Instrument Serif, Instrument Sans, JetBrains Mono): Fraunces and Inter are not on
this machine, and the page fetches nothing.

## What it is

| Part | What | Where |
|---|---|---|
| The masthead | the brief as the headline: "Goal." in `--accent-ink` italic, the sentence at `clamp(30px, 3.2vw, 44px)/1.08`, `opsz 144 SOFT 50`, `text-wrap: balance`, `hanging-punctuation: first last`; a kicker in tracked mono ("THE BRIEF · Ana · Tuesday 09:12 · Billing page"); a dek in `--ink-2` with the budget as numerals | the top of every session; the human block that carries the Goal label |
| The gutter | 72 px: the turn's numeral in the serif at 30 px, right-aligned 22 px from the text; the author's ring beside the masthead | left of the measure; folds to an inline "7 ·" before the heading on the phone |
| The turn heading | serif 26/32, `opsz 48`, the named thing in italic (*four steps*, *proration.ts*, *to the team*); the byline on `--lh` with the ring, the serif name, the state word, the mono time and the Fraunces count | every agent turn, every human turn after the brief, the gate |
| The measure | `--measure: 58ch` of Inter = 67–70 characters of prose per line, measured (see The cost); `--lh: 26px` is the one line everything sits on | the text column; the composer shares it |
| The plan | an `ol` with hung markers (`::before` at `inset-inline-start: -2.2ch`, serif 500 in the hand's ink, green when done); each row title · risk word · detail, with the actual in Fraunces and the estimate in faint mono on the right; totals as a sentence | turn 2; the same markup is the plan card |
| The pull-quote | the team message as a serif italic quote at 22/30 (`opsz 22 SOFT 100`) on an apricot rule, the opening quote hung by `text-indent: -0.42em`, "read by Ana and Dee" under it | every `.msg.team` |
| The log | tool steps as a mono commit log: tick, command, result right-aligned; the live step on `--apricot-soft` with a dotted underline and an apricot sweep passing over it every 1.6 s | under an agent's prose |
| The fold | turns already read, folded to one hairline sentence with the tokens they cost; `<details>` opens them as a short ledger | between the plan and the live turn |
| Marginal notes | 272 px in the margin, 44 px off the text, a hairline on the left, a dotted guide to the passage; kinds: **rated** (Bo 4, Dee 5, the verdict in `--ok-ink`), **to the team** (who hears it), **release gate** (Bo's vote and note, your five stars with the serif word, *Approve with 4*, Deny as a ghost, the quorum segments) | the plan, the team message, the gate; on the phone they fold under the passage on a warm wash |
| Numerals | `.n`: Fraunces 500, `lining-nums tabular-nums`, `opsz 14 SOFT 30`; "of" in Inter `--ink-3` | the running head's meter, the rail's cards, the plan, bylines, the dek, the colophon |
| The composer | a rule in `--ink` under the text, the *To* row with serif chips (navy dot for the agent, chocolate for a person), the steer line "reaches Ana's agent at its next step", the Agent/Team segment, the chocolate send; the margin beside it says who is here and what waits | the bottom of the page, sticky |
| The colophon | one line: session id, opened when, turns, tokens, who | after the last turn |

## Why it is ours

- **It refuses the template.** No bubbles, no alternating sides, no centred pill at the bottom, no
  suggestion chips: the twelve-platform sameness that ai-interfaces-avoid names. People and agents
  write into the same column and the same type; who spoke is marginalia (its §1 ledger column, §2
  composer as a bottom rule, §3 addressing chips, §7 mono commit log, §9 margin notes, not a second
  chat). Irvan Lathief's test ("the AI cannot show a chat box; what does the product become?") is
  answered: it becomes the record of the work.
- **Named things are serif, read things are sans, counts are figures** (SYSTEM principle 6), and the
  serif is now carrying the *structure* of the page and not only the names: editorial-type §1
  (masthead on the optical axis), §3 (the 66-character column), §4 (rhythm from one line), §5
  (decision pull-quotes), §6 (ledger numerals, tabular), §7 (tracked mono eyebrows), §10 (hung
  markers). three-colour-brands §10 and premium-product-ui §9: Fraunces for address, Inter for what
  the room did.
- **The decision is in the margin because that is where a reviewer writes.** A rating, an approval,
  the gate: each is a note beside the passage it judges, in the reviewer's own voice (the serif name,
  the italic quote), with the one chocolate verb. The quorum, the threshold tick after the third star,
  "4 if you leave it", *Approve with N*: all SYSTEM §10's rating control, moved to the margin
  unchanged. presence-and-agents §10's same byline closes every finished turn ("Ana's agent · 11
  tool uses · 1 m 06 s · 3,612 tokens so far").
- **The ring is the byline.** The bare mark on cream (person chocolate on the right, agent navy on
  the left, the colour-by-ground table in SYSTEM §5); one voice shows its arc with the other as a
  ghost, the team shows the closed ring with its centre. presence-and-agents §9's agreement ring,
  without a new element.
- **Apricot keeps one meaning** (SYSTEM principle 2): the live step's wash and sweep, the quote's rule,
  the meter's fill, the quorum's filled segment. Chocolate is only the hand: "Goal.", the hung step
  numerals (the numbers you act on), *Approve with 4*, the send. The gate's stripe is the one
  gradient in the column; the rail's New session is the one in the frame.
- **Warm paper, not a terminal and not a chat.** Cream does most of the work (three-colour-brands:
  "a four-colour system pretending to be three"); hairlines, not boxes; the only shadow is under the
  send button (premium-product-ui §1, §4). Dark re-weighs rather than inverts (SYSTEM §16): the
  agent's arc and the live line turn apricot, the person's arc is the dark hand, the ink is cream.
- **It is not Claude's, ChatGPT's or Linear's.** Claude sets the assistant's prose in a serif and the
  person's in a sans (type.today, via editorial-type), with bubbles and a floating composer; here
  nobody gets a different typeface, the serif marks *structure* (headline, heading, quote, figure) and
  the composer is a rule. ChatGPT has no margin and no numbers. Linear's column is dark, dense and
  13 px with an indigo glow. A navy frame beside a long read with marginal approvals belongs to a
  product where approving is reviewing.

## The technique

- **One grid, four columns**: `grid-template-columns: var(--gutter-w) minmax(0, var(--measure))
  var(--margin-gap) var(--margin-w)` on `.page`; every child uses `grid-template-columns: subgrid`
  so the gutter, the text and the margin line up across the masthead, the turns, the colophon and the
  composer.
- **Notes are anchored, not stacked.** A `.note` is a child of the passage it answers (`.body`,
  `position: relative`) at `left: calc(100% + var(--margin-gap))`, so it sits beside its own
  paragraph as the column scrolls; the dotted guide is its `::before` across the gap. When the note is
  taller than the passage (the gate), the passage holds the page open with a `min-height`. On the
  phone (`≤ 720`) the same element goes `position: static` under the passage on a warm wash.
- **Hanging punctuation twice.** `hanging-punctuation: first last` on the masthead and the prose for
  the engines that have it (WebKit); for the others the quote's opening mark is hung by
  `text-indent: -0.42em` and the plan's numerals by `inset-inline-start: -2.2ch`. The still looks the
  same in both.
- **Numerals as a class.** `.n` sets `font-family: var(--serif)`, `font-variant-numeric: lining-nums
  tabular-nums`, `font-variation-settings: "opsz" 14, "SOFT" 30, "WONK" 0`; the opsz is pinned low so
  Fraunces keeps its text contrast beside Inter at 13–18 px, `.n.lg` opens it to 36 for the meter.
  With the Instrument fallback the settings are inert and the figures are Instrument Serif's.
- **The ring through custom properties.** One `<symbol id="ring">` with the arcs drawn 6 → 12
  (`pathLength="100"`, `stroke-dasharray: 97 100` for the seam); page CSS cannot reach inside a
  `<use>` (SYSTEM §5), so the paths take `stroke: var(--arc-a)`, `opacity: var(--arc-a-o)` and the
  `.person`, `.agent`, `.both` classes set the variables on the `<svg>`.
- **Motion under the one guard** (MOTION §3): `card-in` on the newest turn, `dot-live` on the running
  dots, the live step's apricot `sweep` at 1.6 s (motion-choreography §9: well away from 0.2 Hz;
  under Calm the dotted underline alone says it is live), the picked star's `pop`. All inside
  `@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }`; the clocks
  go to 0 ms under either guard, so hover, press and the composer's focus are instant. Every rest
  state is the element's natural style.
- **The rating** is one `radiogroup` with roving tabindex: arrows and 1–5 pick, hover previews in
  `--star-pre`, the serif word doubles as the accessible name ("4 of 5, Good"), the button carries the
  number it sends.
- **The exploration's own controls** (Calm, Dark in the running head) set `data-motion` and
  `data-theme` on `<html>` exactly as `theme.ts` does; they are not part of the design.

## The cost

- **Width.** Gutter 72 + measure 531 + gap 44 + margin 272 + 48 of padding = 967 px of main; with the
  296 px rail that is a 1263 px window. Between 1180 and ~1000 px of main the rail folds to 72
  (desktop-compact) and the page still fits; under ~1000 px of main the margin must fold under the
  passage as it does on the phone (one more breakpoint than the app has today, at `960` where the
  compact topbar already lands).
- **The measure, measured** (headless Chromium, the fallback faces, `Range.getClientRects` per
  paragraph): 1440 wide, prose 67–70 characters per line in a 531 px column; the dek 45 (two short
  lines of figures); the phone 45–47 in 358 px. `58ch` is what gives 68 characters, because `ch` is the
  zero's advance (0.6 em in Inter) and a prose character averages 0.51 em; `68ch` would set ~80
  characters, over webtypography's 75.
- **Fonts.** Fraunces variable (wght, opsz, SOFT, WONK) is ~390 KB as woff2 for the full file, ~120 KB
  subset to Latin; Inter variable ~100 KB subset. Self-host both in `apps/web/public/fonts` with
  `font-display: swap` and `size-adjust` on the Instrument fallbacks so the swap does not reflow the
  measure. Nothing is fetched by this page.
- **Vertical room.** The page is ~1,700 px at 1440×900: the masthead and the plan fill the first
  screen, the live turn and the gate the second. The app opens a running session at the latest moment
  (session-view's rule: the pending gate directly above the composer), which is the `#now` shots;
  someone who scrolls up gets the masthead. The composer's sticky fade covers ~110 px of the column,
  the same as the app's today.
- **Anchored notes can collide** when two passages shorter than a note sit together (two approvals in
  a row). The page avoids it by content; the app needs one pass that pushes a note down to clear the
  one above it (Tufte-style sidenote stacking: measure, then `translate`), or CSS anchor positioning
  with `position-try` where it exists.
- **Numerals in Fraunces** depart from SYSTEM §3 (mono for counts). Here the figures sit inside prose
  and bylines, where mono breaks the line's colour; the mono stays for times, estimates, commands and
  ids, which are not read as part of a sentence. If the system keeps mono for every count, `.n` is one
  class to drop and the page still stands.
- **Paint.** No filters, no blur except the running head's backdrop, no canvas; the sweep animates
  `background-position` on a pseudo-element with `opacity` (compositor only). The dotted guides and
  hairlines are borders.

## How it ports into `apps/web`

1. **`apps/web/src/tokens.css`**: `--serif` and `--font` take Fraunces and Inter as their first
   entries (Instrument stays second); add `--lh: 26px`, `--measure: 58ch` (today `600px`),
   `--gutter-w`, `--margin-w`, `--margin-gap`, `--ring-person / --ring-agent / --ring-centre` (light
   and both dark blocks, values in `index.html`'s `:root`), and the `.n` numeral class. The
   `@font-face` rules and the two woff2 files go in `apps/web/index.html` and `public/fonts`.
2. **`apps/web/src/stream/Message.tsx`** (`Stream`, `renderBlock`): the `.column` section becomes the
   `.page` grid; a `human` block with the Goal label at the head of the session renders the
   `.masthead` (kicker, `h1`, dek from the plan's budget); every other block renders a `.turn` with
   `.gutter` (the numeral from the block's turn index) and `.body` (the `h2` from the block's
   heading, the `.byline`, then the prose, the `ol.plan`, the `.quote` or the `.log`). The three
   message shapes map one to one: `.msg.human` → heading + prose, `.msg.agent` → heading + prose +
   `.log`, `.msg.team` → heading + `.quote` with the "to the team" note. `VirtualList` keeps working:
   a note is inside its row, so windowing never orphans it; `estimateHeight` in
   `stream/blocks.ts` adds the note's height on the phone where it is in flow.
3. **`apps/web/src/stream/PlanCard.tsx`**: the card becomes the `ol.plan` ledger inside the agent's
   turn; `.raters` (Bo and Dee's chips, the verdict line) move to the `.note.approved` in the margin,
   `MiniStars` unchanged.
4. **`apps/web/src/stream/ApprovalNotice.tsx`**: the notice becomes the `.decision` line in the
   column (the `.kind` kicker as the "Release gate" pill, the `.ask` sentence, the rule) and the
   `.note.gate` in the margin (`.votes`, `.rating` with the stars radiogroup, `.actions` with
   *Approve with N* and Deny, the quorum segs). Same handlers, same copy keys.
5. **`apps/web/src/stream/Composer.tsx`**: the floating card becomes the `.composer` bottom rule on
   the page grid; the Agent/Team `.seg` stays and the `.to` row shows the recipients the toggle
   implies; the steer line is the placeholder's suffix on desktop and the line under the field on
   the phone.
6. **`apps/web/src/ui.tsx`** (`Mark`): add the bare `ring` cut with the `--arc-*` custom properties
   and a `who: "person" | "agent" | "both"` prop; `Avatar` keeps its circle and cornered square.
7. **`apps/web/src/styles.css`** lines 927–960 (`.msg .meta`, `.msg .text`): replaced by the
   `.turn`, `.byline`, `.prose`, `.plan`, `.quote`, `.log`, `.note` rules from `index.html`'s `<style>`,
   plus the `≤ 720` block for the phone.
8. **Nothing in the rail, the topbar's data or the kernel changes.** The running head reads the same
   session fields it does today; only the token chip becomes the `.spend` numerals with the hairline.

Accessibility (MOTION §11): the rings are `aria-hidden` and the byline carries the name and the state
word; the meter has `role="meter"` with `aria-valuetext`; the stars are one `radiogroup` with roving
tabindex and the word as the name; the live step is `aria-live="polite"`; the composer's label and
the send's name say who hears it; the focus ring is chocolate by day and cream by night and never
borrows the pulse; nothing flashes (the sweep is 0.6 Hz).

## Open

- Whether the brief should stay as a masthead when a session has several goals (a re-steer from
  the project page): a second human directive could become a second masthead-sized heading, or an
  ordinary turn whose heading is the new goal in italic. The exploration shows one goal.
- The gutter numeral is the turn number; replay-scrubber's "turn N · you are here" wants the same
  number, so the two should share the index.
- Two notes closer than their own height collide (see The cost); the app needs the stacking pass
  before this ships on a session with back-to-back approvals.
- Fraunces figures at 13 px in the rail's cards are small; the rail could keep mono counts
  (SYSTEM §6's `.tokens`) while the page takes the serif, if the two reading contexts are judged
  different enough.
