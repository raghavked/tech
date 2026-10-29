# sig-editorial-session · The session as an editorial page

The session view set like a long read instead of a chat. One text column on cream, 68 characters
wide. The brief is the masthead: Ana's goal in a display serif, "Goal." in the hand's ink, the headline
running across the margin, the dek on the measure. Turns already read fold into a **contents ledger**
(one hairline row each, the serif heading, the time, the count), and each row opens to its passage:
the plan as a ledger with hung numerals, Bo's words as a pull-quote with the opening mark hung. The
live turn is a serif heading with its numeral hung in the gutter, a byline on the page's one line, two
lines of prose and a mono commit log with the running step on an apricot wash. The gate is the last
passage, inside registration ticks, directly above the composer. Everything that is a decision (the
plan's ratings, "to the team", the gate's vote with your stars and *Approve with 4*) is a **marginal
note** anchored to the passage it answers and stitched to it with a dotted guide; when two notes
would collide the lower one slides down and its guide bends into an L so it still points at its own
line. Token counts are numerals in Fraunces, lining and tabular, so spend reads as part of the
sentence. The composer is a rule under the text, with a *To* row of recipients; it covers only the
gutter and the measure, so the margin, and the gate's note in it, stay in view beside it.

Files: `index.html` (self-contained: tokens inlined from `design/henosis/tokens.css`; light in
`:root`, dark twice, byte-identical, under `prefers-color-scheme` and `[data-theme="dark"]`; every
animation inside the one `prefers-reduced-motion: no-preference` + `:root:not([data-motion="calm"])`
guard with the clocks zeroed under either; Fraunces and Inter asked for first with Instrument and the
system faces behind them; no asset, font or script fetched); `light.png`, `dark.png` (1440×900, the
page as it opens); `phone.png` (390×844). The stills show the fallback faces, Instrument Serif,
Instrument Sans and JetBrains Mono, because Fraunces and Inter are not on this machine and the page
fetches nothing. The exploration's own Calm / Dark / Join controls are hidden unless the url carries
`#inspector`, so no still shows a topbar the product will not have (judge 3's note).

## What it is

| Part | What | Where |
|---|---|---|
| The masthead | kicker in tracked mono ("THE BRIEF · Ana · Tuesday 09:12 · Billing page"); the goal at `clamp(28px, 2.5vw, 36px)/1.1`, `opsz 144`, `text-wrap: balance`, `hanging-punctuation: first last`, spanning the measure and the margin so it sets in two lines; "Goal." italic in `--hand-ink`; the dek on the measure; the bare ring (both arcs closed, centre lit) in the gutter | the top of every session |
| The contents | "READ · turns 2–6 · 09:14 to 09:46 · 10,506 tokens", then one 27 px hairline row per read turn: the numeral in the gutter, the serif heading with the named thing in italic and the speaker in the hand's ink, the mono time, the count in Fraunces; a `<details>` whose summary is the row and whose body is the passage | between the masthead and the live turn; replaces a wall of bubbles |
| The plan ledger | an `ol` with markers hung at `inset-inline-start: -2.2ch` in the hand's ink (green when done); title · verb chip · detail; the actual in Fraunces and the estimate in faint mono on the right; the total as a sentence | row 2 opened; the same markup is the plan card |
| The pull-quote | the team message in the serif at 21/30 italic, `opsz 22 SOFT 100`, on an apricot rule, the opening quote hung by `text-indent: -0.42em` (or `hanging-punctuation` where it exists); "Bo · read by Ana and Dee · never reaches the agent" under it | row 3 opened; every `.msg.team` |
| The live turn | numeral in the gutter in the hand's ink; h2 at 25/32 with the file in italic; byline on `--lh` (ring glyph, serif name, the running dot, mono "step 3 of 4 · 09:48", the Fraunces count); two lines of prose; the log | the newest agent turn, `#now` |
| The log | tool steps as a mono commit log: tick, command, result right-aligned; the live step on `--live-wash` with a dotted underline and an apricot sweep passing over it every 1.6 s (0.6 Hz, nowhere near 0.2 Hz); the finished-turn byline ("11 tool uses · 1 m 06 s") appears only when the turn finishes | under an agent's prose |
| The gate | the last passage before the composer: four 1 px registration ticks frame it (Stripe Press's device); kicker pill "Release gate" on the one gradient in the column, "step 4 of 4 · held by Billing and Checkout"; the ask as a serif italic sentence with the command in mono and the figure in Fraunces; the rule in a sentence; on grant, a drawn check and "Granted by Bo and you" | turn 8 |
| Marginal notes | 268 px, 44 px off the text, a hairline on the left, a dotted guide at the passage's line; kinds: **rated** (Bo 4, Dee 5 as 7 px rating dots, the verdict in `--ok-ink`), **to the team** (who heard it), **release gate** (Bo's stars and quote; your stars as one radiogroup with the threshold tick after the third and the serif word; *Approve with 4*, Deny as a ghost; "4 if you leave it"; the quorum segments) | beside the plan row, the team row and the gate; under the passage on a warm wash below 1296 px and on the phone |
| Numerals | `.n`: Fraunces 500, `lining-nums tabular-nums`, `opsz 14 SOFT 30`, `font-synthesis-weight: none` so the fallback never fakes the weight; "of" in Inter `--ink-3` | the running head's meter, the rail's cards, the ledger, the byline, the ask, the colophon |
| The composer | a rule in `--ink` under the text; *To* row with serif chips (navy dot for the agent, chocolate for a person), "@ adds anyone", the Agent/Team segment at its right; the field whose placeholder is the steer line ("reaches Ana's agent before step 4 · Bo hears it too"); the chocolate send | the bottom, sticky over the gutter and the measure only |
| The running head | serif title, scope, the running dot; the Team pill, the meter as Fraunces numerals over a 3 px hairline with the 80 % tick, the presence stack, Team and Details; the meter and the stack have fixed slots (`flex: none`, 12 px gap) so they never run into each other | the topbar |

## Why it is ours

- **It refuses the template.** No bubbles, no alternating sides, no centred pill, no suggestion chips:
  the twelve-platform sameness `ai-interfaces-avoid` names. Its §1 ledger column (author in the
  gutter, no background behind words), §2 composer as a bottom rule, §4 recipient chips, §7 mono
  commit log and §9 margin notes are all here, and nobody gets a different typeface by species.
- **The serif carries structure, not a speaker.** `editorial-type` §1 (the accent word: "Goal.", *to the
  team*, *four steps*), §3 (opsz low on the figures, high on the masthead), §5 (figures by register:
  lining in chrome, in sentences they belong to the sentence), §6 (one rag for all prose, 68
  characters, `text-wrap: pretty`), §7 (`calt` so "->" and digits sit right in chips), §8 (the gate's
  registration ticks), §10 (hung quotes). SYSTEM §3's three voices hold: serif says who and what is
  named, sans is read, mono is how; the one departure is counts in Fraunces (see The cost).
- **The decision is in the margin because that is where a reviewer writes.** A rating, an approval,
  the gate: each is a note beside the passage it judges, in the reviewer's own voice (the serif name,
  the italic quote) with the one chocolate verb. SYSTEM §10's control is unchanged: one radiogroup,
  the tick after the third star, the word as the accessible name, *Approve with N*, "4 if you leave
  it", the default shown as a preview and never pre-picked in the on colour. `data-craft` §6's rating
  dots carry the plan's ratings at caption size.
- **The contents ledger is the fold the brief asks for** (SYSTEM §7's folded turns, `presence-and-agents`
  §6's repeated calls folding into a summary) and it is also the table of contents an editorial page
  has: the session's record at a glance, each row a door.
- **The ring is the byline.** The bare mark on cream, coloured by ground (person chocolate on the right,
  agent navy on the left, apricot centre, BRIEF); one voice shows its arc with the other ghosted, the
  team shows the closed ring with its centre. `presence-and-agents` §10's same byline for everyone.
- **Apricot keeps one meaning** (SYSTEM principle 2): the live step's wash and sweep, the quote's rule,
  the meter's fill, the quorum's filled segment, the preview star. Chocolate is only the hand: "Goal.",
  the hung numerals and the live turn's numeral (the numbers you act on), the gate's verb, the send.
  The gate's pill is the one gradient in the column; the rail's New session is the one in the frame.
- **Warm paper, hairlines, no boxes.** Cream does the work (`three-colour-brands`: cream at 60, the
  darks at 30, apricot as light); the only shadows are under the send and the raised buttons
  (`premium-product-ui` §1, §4). Dark re-weighs rather than inverts (SYSTEM §16): the hand turns
  apricot for the verb, the live line's wash drops to 14 %, the ticks go apricot, ink is cream.
- **It is not Claude's, ChatGPT's or Linear's.** Claude sets the assistant's prose in a serif and the
  person's in a sans, with bubbles and a floating composer; here nobody's prose is serif, the serif
  marks structure, and the composer is a rule. ChatGPT has no margin and no numbers. Linear's column
  is dark, dense, 13 px with an indigo glow. A navy frame beside a long read with marginal approvals
  belongs to a product where approving is reviewing.

## The technique

- **One grid, four columns**: `grid-template-columns: var(--gutter-w) minmax(0, var(--measure))
  var(--margin-gap) var(--margin-w)` on `.page`; every block is `grid-template-columns: subgrid` so the
  gutter, the text and the margin line up across the masthead, the contents, the turns and the
  composer (which repeats the same template with the page's padding).
- **Notes are anchored, then stacked.** A `.note` is an absolutely positioned child of the passage it
  answers (`.body`, `position: relative`) at `left: calc(100% + var(--margin-gap))`; the dotted guide is
  its `::before` across the gap. A 20-line pass on load, resize and `<details>` toggle walks the notes
  in order and, when one would overlap the one above, pushes it down with `translateY` and sets
  `--up`, which the guide reads: `::before` stays at the passage's line and `::after` draws the
  vertical leg down to the note. Only the gate's passage (`data-hold`) grows to its note's height so
  the page never ends before the note does. Below 1296 px the same element goes `position: static`
  under its passage on `--team-wash`.
- **The composer covers only the text.** `.composer-wrap` is sticky and `pointer-events: none`; the
  opaque `.paper` (canvas, with a 22 px fade as its own `::before` strip) spans the gutter and the
  measure and re-enables pointer events. The margin keeps scrolling beside it, so a note's *Approve*
  stays clickable and nothing bleeds through the *To* row (judge 1 and 2's fix).
- **Hanging punctuation twice.** `hanging-punctuation: first last` on the masthead, the prose, the ask
  and the quote for engines that have it; for the others the quote's mark is hung by `text-indent:
  -0.42em` (removed under `@supports (hanging-punctuation: first)`) and the plan's numerals by
  `inset-inline-start: -2.2ch`.
- **The measure in `ch`.** `--measure: 52ch` resolves against the page's 15 px sans: 519 px with the
  fallback face, measured at 67 characters per line of 16.5 px prose (`Range.getClientRects` per
  character in headless Chromium); the previous pass's 58ch set 76. With Inter the zero is wider and
  the number of characters per line stays within 66–70; it should be re-measured once the font ships.
- **The ring through custom properties.** One `<symbol id="ring">`, arcs drawn with `pathLength="100"`
  and `stroke-dasharray: 94 100` for the seam. Page CSS cannot reach inside a `<use>` (SYSTEM §5), so
  the paths carry `stroke="var(--p)"`, `opacity="var(--po)"` as presentation attributes and the
  `.person`, `.agent`, `.both` classes set the variables on the `<svg>`. The masthead's ring is inlined
  so the joining run (arcs swing in, the centre appears, 1.6 s on `--ease-mark`) can move it; it plays
  when something joins (the inspector's Join, `#join`), not when the page opens.
- **Motion under the one guard** (MOTION §3): `card-in` on the live turn, `dot-live` on the running dots,
  the live step's `sweep` at 1.6 s on `background-position` and `opacity` (compositor only), the picked
  star's `pop`, the check's `draw` on grant, the masthead ring's `arc-p / arc-a / dot-in`. Measured: 5
  animations at rest, 0 under `prefers-reduced-motion: reduce`, 0 under `[data-motion="calm"]`; the
  clocks go to 0 ms under either, so hover, press and the segment are instant.
- **The rating** is one `radiogroup` with roving tabindex: arrows and 1–5 pick, hover previews in
  `--star-pre`, the serif word doubles as the name ("4 of 5, Good"), the button carries the number it
  sends; `a` approves from anywhere but the field.
- **Dark is the same bytes twice**, and the avatar's fill and initial are fixed (`#ECE3D6` / navy) in
  both themes so the initial is derived from the fill, never from the theme's foreground (judge 2).

## The cost

- **Width.** Gutter 72 + measure 519 + gap 44 + margin 268 + 48 padding = 951 px of main; with the
  296 px rail, a 1247 px window. From 1296 px down the margin folds under the passage (one breakpoint
  more than the app has; it sits between SYSTEM §4's 1180 and 960, and at 1180 the rail folds to 72
  so the page regains 224 px and could keep its margin: the app should fold the margin on the
  *main's* width, not the window's, with a container query).
- **Vertical room.** At 1440×900 the masthead, the contents, the live turn and the gate with its note
  all fit above the composer's rule (gate frame bottom 777, composer rule 815, note bottom 838).
  That holds for a five-row contents and a two-line prose; a longer live turn pushes the gate under
  the composer and the app must open at `#now` as it does today (scrolled to the latest moment, the
  masthead a scroll up). The contents ledger is what makes the opening frame possible: without it the
  plan and the quote alone take the screen.
- **Fonts.** Fraunces variable (wght, opsz, SOFT, WONK) is ~390 KB as woff2 for the full file, ~120 KB
  subset to Latin; Inter variable ~100 KB subset. Self-host both in `apps/web/public/fonts` with
  `font-display: swap` and `size-adjust` on the Instrument fallbacks so the swap does not reflow the
  measure. SYSTEM §3 has not decided Instrument versus Fraunces/Inter (judge 3's first note); the page
  stands on Instrument, as the stills show, but the numerals are its most exposed idea: Instrument
  Serif has one weight and its figures are narrow, so `.n` at 13 px in the rail is small. If the
  decision is Instrument, keep `.n` for the meter, the ledger and the ask (≥ 14 px) and let the rail
  keep mono counts.
- **Numerals in Fraunces** depart from BRIEF's "JetBrains Mono inside tool lines and numbers" and
  SYSTEM §3's mono for counts. Here the figures sit inside prose and bylines where mono breaks the
  line's colour; mono stays for times, estimates, commands and ids, which are not read as part of a
  sentence. `.n` is one class to drop and the page still stands.
- **Note stacking is a layout pass**, run on load, resize and fold toggles; in the app it also runs when
  `VirtualList` mounts or re-measures a row, and it is ~0.1 ms for ten notes (`getBoundingClientRect`
  per note, one `transform` write). CSS anchor positioning with `position-try` could replace it where
  it exists, but Safari's support is partial; the pass is the safe path.
- **The contents fold changes what is on screen** for someone who scrolls up to re-read: the plan and
  the quote are behind a row until opened. The app already folds the past (replay's edge, the agent's
  repeated calls); the row is the same move with a serif heading. "Open all" belongs in the head.
- **Paint.** No filters, no blur except the running head's backdrop, no canvas; borders for the
  hairlines and guides; the sweep is a pseudo-element on `background-position` + `opacity`.
- **Targets.** Stars 24 px, segment buttons 24 px high, every other control ≥ 30 px.

## How it ports into `apps/web`

1. **`apps/web/src/tokens.css`** (`--font`, `--serif`, `--mono` at lines 141–143; `--col` at 166): the
   serif and sans take Fraunces and Inter first with Instrument second once SYSTEM §3 decides; add
   `--lh: 26px`, `--measure: 52ch`, `--gutter-w`, `--margin-w`, `--margin-gap`, `--hand-ink`,
   `--ring-person / --ring-agent / --ring-centre`, `--live-wash`, `--tick` (light and both dark blocks,
   values in `index.html`'s `:root`) and the `.n` numeral class. The `@font-face` rules and the woff2
   files go in `apps/web/index.html` and `public/fonts`.
2. **`apps/web/src/stream/Message.tsx`** (`Stream`, `renderBlock`'s `human / agent / join / divider /
   approval / plan` cases): the `.column` becomes the `.page` grid. The first `human` block with the
   Goal label renders the `.masthead` (kicker from the author, time and scope; the h1; the dek from the
   plan's step count and the gate rule). Every block before the latest agent turn renders a contents
   row (`.fold .entry`: `<details>` with the row as summary and the block's current markup inside);
   the latest `agent` block renders `.turn.live` (numeral from `block.turn`, the `h2` from the step's
   `describeCall`, the `.byline`, the prose, `StepLine` rows as the `.log`); an `approval` block renders
   `.turn.gate` with its note. `VirtualList` keeps working: a note is inside its row, so windowing never
   orphans it; `estimateHeight` in `stream/blocks.ts` (line 427) adds 27 px for a folded row and, below
   1296 px, the note's height for an unfolded one. The stacking pass runs in a `useLayoutEffect` on the
   list's container after render and on `ResizeObserver`.
3. **`apps/web/src/stream/blocks.ts`** (`BlockFolder`, `blocksOf`): no new block kinds; a `read: true`
   flag on every block before the latest agent turn (or before the replay cursor) tells `renderBlock`
   to fold it, and the turn's token count already on `AgentBlock` fills the row's `.n`.
4. **`apps/web/src/stream/PlanCard.tsx`**: the card becomes the `ol.plan` ledger inside the folded row's
   body; the raters (Bo and Dee's `MiniStars`, the verdict line) move to the `.note.compact` beside the
   row as rating dots; `planSig` unchanged.
5. **`apps/web/src/stream/ApprovalNotice.tsx`**: the notice becomes the `.gate .frame` in the column
   (the kind pill, the ask, the rule sentence, the granted line) and the `.note.gate-note` in the margin
   (Bo's row, `Stars` from `ui.tsx` as the radiogroup, *Approve with N* and Deny, the hint, the quorum
   segments). Same handlers, same copy keys in `copy.ts`.
6. **`apps/web/src/stream/Composer.tsx`** (`Composer`, `styles.css` `.composer-wrap` at 1338): the
   floating card becomes `.composer-wrap > .composer > .paper`, sticky over the gutter and the measure
   only; the Agent/Team `.seg` moves into the *To* row and the `.bar .to` stack becomes the serif
   chips; the steer line (`.bar .how`) becomes the placeholder's suffix on desktop and stays a line on
   the phone.
7. **`apps/web/src/stream/TokenMeter.tsx`**: the chip becomes the `.spend` numerals over the 3 px
   hairline with the 80 % tick, in a fixed 150 px slot; the presence `Stack` gets `flex: none` beside it
   (the title-row collision judge 2 found in three pages, fixed once).
8. **`apps/web/src/ui.tsx`** (`Mark` at 77, `Stars` at 559, `Avatar` at 700): add the bare `ring` cut
   with the `--p / --a / --c` presentation attributes and a `who: "person" | "agent" | "both"` prop;
   `Stars` gains the `pre` state for the default; `Avatar` takes its initial colour from its fill.
9. **`apps/web/src/styles.css`** lines 891–960 (`.column.page`, `.msg .meta`, `.msg .text`): replaced by
   the `.page`, `.masthead`, `.fold`, `.turn`, `.byline`, `.prose`, `.plan`, `.quote`, `.log`, `.gate`
   and `.note` rules from `index.html`'s `<style>`, plus the `≤ 1296` and `≤ 720` blocks. The
   `.rail .agent` scoping matters: the exploration found `.agent` on the ring glyph picking up the
   rail card's padding.
10. **`apps/web/src/views/ReplayScrubber.tsx` and `views/Export.tsx` / `print.css`**: the same page with
    every row folded except the viewed turn is the replay frame ("turn N · you are here" shares the
    gutter numeral), and with every row open it is the export (judge 3's split: the masthead and the
    gutter numerals into the stream now, the full page for replay and export). Nothing in the rail,
    the topbar's data or the kernel changes.

Accessibility (MOTION §11): the rings are `aria-hidden` and the byline carries the name and the state
word; the meter has `role="meter"` with `aria-valuetext`; the stars are one `radiogroup` with roving
tabindex and the word as the name; the log is `aria-live="polite"`; the composer's label and the
send's name say who hears it; the focus ring is the hand's ink over a canvas halo and never borrows
the pulse; nothing flashes (the sweep is 0.6 Hz). Contrast: `--ink-3` is used only for decoration
(guides, hung numerals at 30 px, the "of"); readable secondary text is `--ink-2`.

## Open

- Instrument versus Fraunces/Inter (SYSTEM §3). The page is designed for Fraunces's optical axis and
  shown in Instrument; re-measure the measure and the `.n` sizes once the face is chosen.
- A session with several goals (a re-steer from the project page): a second directive could be a
  second masthead-sized heading, or a turn whose heading is the new goal in italic. One goal shown.
- Whether the contents ledger should open the plan row by default on a wide-enough window (the plan
  is the most re-read passage), and whether "Open all" lives in the head or the gutter.
- The margin folds on the window's width here; in the app it should fold on the main's width with a
  container query so a folded rail buys the margin back.
