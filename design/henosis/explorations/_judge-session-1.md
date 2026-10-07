# Judge panel · session · 1

Theme: **session** (session-view, session-dark, team-panel, token-meter, replay-scrubber).
Judged against BRIEF.md and tokens.css v5, with every PNG opened (light, dark, mobile) and each page's
style and markup read. Scores are 1–10 for on-brief (vibrant, unity, palette roles), craft (alignment,
type, states), truth to the product, and distinctiveness from claude.ai, ChatGPT and Linear. Explorations
were not edited.

| Exploration | On-brief | Craft | Truth | Distinct | Overall | Verdict |
|---|---|---|---|---|---|---|
| team-panel | 9 | 8 | 10 | 8 | 8.8 | keep |
| session-view | 9 | 8 | 9 | 7 | 8.3 | keep |
| token-meter | 8 | 9 | 9 | 7 | 8.3 | keep |
| session-dark | 8 | 9 | 8 | 7 | 8.0 | keep |
| replay-scrubber | 8 | 7 | 9 | 9 | 8.3 | revise |

Shared facts, checked once: all five use `../../tokens.css` plus a page style, no scripts; all five draw the
two-arc mark (disc, arc a, arc b, centre dot), not the old ring-and-bead; every desktop screen carries
exactly one gradient (the New session button); "Return to now", "Approve with 4" and every other primary
are plain chocolate in light. The shell (navy rail, cream canvas, 780px column, sticky composer) is the same
markup in all five, which is why the rows below spend their words on what each one adds.

---

## team-panel · 8.8 · keep

**What it is.** One 340px drawer with two faces, Team | Details, on a segmented switch in the drawer head;
two desktop screens (Team open, Details open), a mobile sheet, and a strip of four states (Solo with Team
up, a handoff offered, nobody else here, over budget).

- **On-brief 9.** The best use of the palette roles in the set: the crewmate is a navy tile inside the cream
  drawer (the frame colour carried into the page, so "that is a rail card" reads instantly); chocolate is
  the hand everywhere it should be (the driving flag, "You" in chat, Hand off, the send); apricot is only
  the pulse (the live dot on the Team tab, "writing to the team…", the handoff offer, the composer glow).
  Section headers that carry their summary ("2 here · 1 away", "proration · 1 conflict", "25% · about
  37.6k left") are the brief's "calm, specific" voice turned into layout.
- **Craft 8.** People rows are exact (serif name, "you" in small sans, role in grey, away rows dim avatar
  and name together, the role select only where an owner can change it). Two things miss. The Details face
  runs past 900px even with Memory and Catch-up folded (Usage is cut at the bottom of the dark shot), and
  the Branches rows put four controls (Switch, a compare icon, Unite into proration; `+3 ahead of main`
  and Fork on the current row) into 340px, so the lone compare glyph reads as an orphan and the row is
  the one cramped line in an otherwise airy drawer. In the Team shot the "Cy joins" divider is clipped
  behind the pinned chat input; a 6px more bottom padding on the list fixes it.
- **Truth 10.** Owner / contributor / observer, who is driving and who may hand off, crew claims
  (`apps/web/src/billing/**` · this agent), intent keys (goal / api / tests / always) with who set them,
  "Held until a pick: tests (Bo and Ana disagree)", branches with a conflict and checkpoints, usage with the
  four-way split, memory with a conflict line, the catch-up brief since 14:02, and "Kept in the session log.
  Never sent to the agent." Nothing here is decoration; every line is a thing the product has.
- **Distinct 8.** No competitor has a people-and-crew room beside the stream; Linear's right panel is
  properties, claude.ai has none. The navy tile inside cream and the serif people rows make it ours.
- **The fix that matters.** Give the Details face an order that fits 900px: fold the Branches file list by
  default (the header already says "1 conflict"), move Usage above Branches whenever the budget is past the
  tick, and reduce each branch row to one labelled action plus a "…" menu so Switch / Compare / Unite stop
  fighting in 340px.

## session-view · 8.3 · keep

**What it is.** The session as a room: rail with crews then solos, a cream column holding the goal, the
agent's turn with its tool steps and a navy output block, Bo's team message, the plan ledger, and the
release-gate approval sitting directly above the composer. Light, dark and a 390px mobile cut.

- **On-brief 9.** Every role is honoured and only once: chocolate on "Approve with 4" and the send; apricot
  on the live step, the team wash, the Team pill, the driver ring and the inbox/approvals counts (the only
  solid apricot in the rail); navy for the frame and the agent's terminal. One gradient. The named-things-
  serif rule is applied with discipline: "Billing page", "Bo", "to the team", "Invoice rollout", "Goal".
- **Craft 8.** The three message shapes are the right three and they are spaced well; the plan ledger's
  used-beside-estimate columns and the rater chips are tight. Smaller misses: the light shot is scrolled to
  the bottom so the stream's first line sits clipped under the topbar ("I am leaving Checkout alone…" is
  half hidden) and the plan card is never seen; the topbar's Running dot was caught mid-pulse and reads
  grey on cream; and the right-hand meta changes grammar between rows (time on Bo's message, "turn 7 ·
  step 3 of 4" on the agent's), which the notes already flag. The mobile cut is good: the title wraps
  once, the approval stacks stars, note and progress in a sensible order.
- **Truth 9.** A release gate that needs two contributors at 4+, Bo's vote with his note, the `irreversible`
  chip on the exact command, "Your rating counts once; Bo's is already in", the two gate segments, the
  token chip with a hairline budget, "as Ana, owner, driving" in the composer hint. This is the product.
- **Distinct 7.** The honest risk of the set: cream page, serif names, warm brown primary and bubble-less
  agent prose sit close to claude.ai's register. What pulls it away is the navy rail as a frame, apricot as
  a live colour, the team message as a third voice and the multi-rater gate. Lean on those.
- **The fix that matters.** The gate notice and plan step 4 are the same event seen twice with no thread
  between them. Put "step 4 of 4 · Migrate stored invoices" on the notice and make the plan's pending row
  say "waits at the gate below" (or render the approval inside the row), so the thing that needs you is one
  object, not two.

## token-meter · 8.3 · keep

**What it is.** The spend as one mono chip in the title row ("12.4k tokens · 62%" over a 3px hairline with
an 80% tick), a 264px breakdown popover on hover, the Details drawer's Usage section with per-turn stacked
bars, echoes on plan rows and under the agent's turn, a rail hair, and a mobile bottom sheet; plus a board
of chip states, popover anatomy, and rounding rules.

- **On-brief 8.** Colour arrives only when a budget turns (apricot weave while spending, amber from 80%,
  red past 100%), which is the brief's "never garish" in practice. The four token kinds are mapped onto the
  three brand colours (input navy, output chocolate, cache apricot, cache write hatched): clever and
  readable, but it gives chocolate a second meaning as data in the legend and the stacked bars, so the hand
  is slightly diluted on this screen. The turning ring in the chip is the one glyph that misreads: it looks
  like a reload control, not a pulse.
- **Craft 9.** The popover keeps a fixed shape (head, bar, four rows including zeros, rule, budget row, one
  line of consequence, foot) so the eye lands in the same place every session; everything numeric is mono
  and tabular; per-turn bars share one scale; the rail card carries a 2px hair in the agent's tone; the
  mobile sheet is the Usage block unchanged. Rounding, reach (hover, focus, click pins, Escape) and the
  accessible name are written down. One rail inconsistency: a separate SOLO section header where the other
  four put solos under AGENTS after the crew.
- **Truth 9.** Budget counts input + output only; cache never moves the bar; "Soft budget · nothing stops at
  100%" appears where it should; per-turn sub-lines say what the turn was (plan, step 1, Bo joined). The
  "saved ~4.4k" beside cache read assumes a price the spec does not record; the notes know it.
- **Distinct 7.** Context and token meters exist elsewhere (Cursor, terminal agents); the restraint, the
  hatched cache write and the ledger popover are specific to us, the pattern is not.
- **The fix that matters.** Replace the turning ring in the chip with a static apricot dot that pulses (the
  rail's running dot at 8px), and let the hairline's weave be the only "spending now" motion; drop "saved
  ~4.4k" until there is a price to stand on.

## session-dark · 8.0 · keep

**What it is.** The session-view markup rendered under a tuned dark set: rail `#10141C` < canvas `#1A202C`
< surface `#242C3C`, depth from a 1px top highlight (`--edge`) and hairlines rather than shadows, apricot as
a hairline and a 9–16% wash, the status triad lifted two steps, the tool output block as the one surface
darker than the canvas, the gate stripe turned apricot→chocolate, every value a named knob.

- **On-brief 8.** The roles survive the night: the frame is still the darkest thing, the pulse is still
  apricot, Dress Blues returns as the mark's disc and inside the lifted brand gradient so all three colours
  remain on screen. The one role that does not survive is the hand: tokens make `--accent` apricot in dark,
  so "Approve with 4" sits in the same colour as the live step, the team wash and the Team pill beside it,
  and the hierarchy of "act here" versus "this is alive" flattens. The exploration asks the question; it
  should have answered it.
- **Craft 9.** The reasoning is exemplary and the page proves it: the same markup produces both shots, the
  knobs are set once per selector, `--edge` replaces shadow on cards, buttons, raters, search and the
  active agent card, and the lifted triad keeps "Running", "Approved" and `irreversible` legible on navy.
  The mobile dark cut is clean. The light shot inherits session-view's clipped first line.
- **Truth 8.** Same content as session-view, so the same product truth; nothing dark-specific is invented or
  lost (the terminal block as the deepest surface is a nice truth about what the agent is doing).
- **Distinct 7.** Near-black rail, lifted navy page and warm apricot pulses are more our own than the light
  screen is; Linear's dark is cool grey-violet, ChatGPT's neutral, claude.ai's warm grey. Keep the warmth.
- **The fix that matters.** Add a dark hand: `--accent` a lifted chocolate (`#7A4B3E`, 7.2:1 with
  `--accent-fg #FFF8F1`) for primary buttons, links and the goal label, and keep apricot for pulses only.
  Then fold the knobs (`--edge`, `--out-bg`, `--team-wash`, `--live-line`, `--pill-team-bg`,
  `--gate-stripe`, the lifted triad) into tokens.css as the dark half.

## replay-scrubber · 8.3 · revise

**What it is.** A 64px row under the top bar: one dot per turn on a hairline, plan steps as spans above the
track, the viewed dot ringed in apricot, now pulsing with "NOW" under it, the release gate as a hollow
diamond; dragging folds the stream to that turn, ends it at a dashed "The session goes on · 6 more turns
to now" edge with future chips, and makes the composer read-only. The drawer holds the pinned switch and
a turn list grouped by plan step. Light, dark and mobile.

- **On-brief 8.** "Return to now" is the one chocolate action on the row; apricot marks only now and the
  viewed turn; the step chips reuse the plan card's green / apricot-ringed / hollow states, so the track
  reads as the plan laid over time. The hover tip is a navy block, consistent with the terminal. One
  gradient. The "NOW" label in `--apricot-deep` on cream is roughly 2.3:1 and is the only legibility slip.
- **Craft 7.** The idea is complete, the row is not yet. The tip hangs under the dot and covers the first
  line of the stream (in the shot it sits over the plan card's step 4 row, which is itself clipped under the
  track); the step-span labels shrink to "4 PDF" at the right edge and will clip sooner on a narrower
  column; 56px of topbar plus 64px of track plus a 22px fade takes 142px of a 900px screen before any
  content; the times row carries three labels on a line that could carry the hovered time instead. The
  stream below the row is excellent: "turn 5 · 09:31 · you are here", notices keep their words and lose their
  buttons, the dashed edge with quiet future chips, the dashed read-only composer with "Nothing is sent
  while you look back". Mobile is right: label and button on one row, the track full width, number-only
  chips.
- **Truth 9.** Folding the session's own log to a turn, a release gate drawn as a different mark, tokens on
  every turn in the drawer, later turns at half opacity, the arrow-key and End hints in the drawer's Time
  travel text rather than on the row. The question of whether the Team panel and the token chip also fold is
  real and unanswered.
- **Distinct 9.** Nothing in claude.ai, ChatGPT or Linear scrubs a session by plan step with a visible end
  of the past. The dashed edge with "what comes next" chips is the most original moment in the set.
- **The fix that matters.** Put the hovered turn's preview in the left label (the label shows "Turn 8 ·
  09:44 · Bo steers" while hovering, then snaps back to the viewed turn) and remove the tip under the
  track, so the row never covers the stream; at the same time give the row a resting form (dots only,
  36px) that grows to the full track only when pinned or viewing, and set the "NOW" label in ink with an
  apricot dot beside it.

---

## Carry forward

Patterns the system should adopt from this panel, in the order they should land in tokens.css and the
component set.

1. **The shell grammar is settled.** Navy rail (crews first, then solos under AGENTS; each card: status dot,
   name, Team/Solo pill, doing-line with the named thing in italic serif, with-whom, tokens), the "me" row
   with role · driving, inbox and approvals counts as the only solid apricot in the rail. Pick one rail
   grouping; token-meter's separate SOLO header should not spread.
2. **The three message shapes.** Human: white bubble, serif italic "Goal" label, a mono scope chip in the
   meta. Agent: no bubble, prose at 15.5px, a step grid (icon, mono line, mono result on the right), a navy
   output block that is the deepest surface on screen in both themes. Team: apricot wash with "to the team"
   in italic serif, never reaching the agent. Lock these; all five already share them.
3. **One right-hand meta rule.** People carry a time; the agent carries "turn N · step k of m"; the viewed
   turn in replay carries "turn N · time · you are here". Write it once so session-view's inconsistency
   does not spread.
4. **The title row.** Serif title · status with turn · Team pill "Team · with Bo" · the token chip (mono
   number, faint percent, 3px hairline with the 80% tick, colour only when the budget turns) · presence
   stack with the driver ringed in apricot · Team and Details buttons that light with `--apricot-soft` when
   open.
5. **The plan ledger.** Step rows with used beside estimate (green under, amber over), a totals line
   against the budget bar, rater chips with their stars, "by the team's ratings" in green, and the soft-
   budget sentence in the foot. Budget counts input + output only.
6. **The approval under a gate.** The exact command in mono, the `irreversible` chip, others' votes with
   notes, stars with the default baked into "Approve with N", "1 of 2 raters" in mono, gate segments; tie
   it to the plan step it waits at.
7. **One drawer, two faces.** Team | Details on a segmented switch in the drawer head with the live dot and
   count; section headers that carry their summary; Memory and Catch-up collapsed by default; the crewmate
   as a navy tile inside cream; the chat input pinned with "Kept in the session log. Never sent to the
   agent." Fold Branches' file list by default.
8. **The token breakdown's fixed shape** (head, stacked bar, four rows including zeros, rule, budget row,
   one line of consequence, foot) and the per-turn stacked bars on one scale; the rail hair; the mobile
   bottom sheet that is the Usage block unchanged. Replace the turning ring with a pulsing dot.
9. **Dark is re-weighed, not inverted.** Rail < canvas < surface, `--edge` instead of shadows, apricot as
   hairline and 9–16% wash, the status triad lifted, the gate stripe apricot→chocolate, the brand gradient
   lifted one notch; plus a lifted chocolate hand (`#7A4B3E`) so hand and pulse stay distinct. Fold
   session-dark's knobs into tokens.css.
10. **Time travel has a shape.** Dots per turn with plan spans, the viewed turn ringed, now pulsing, the
    gate as a hollow diamond, the dashed "the session goes on" edge with future chips, and a read-only
    composer whose only action is a chocolate "Return to now". Move the hover preview into the left label.
11. **Named things are serif, everywhere.** People, agents, crews, sessions, "to the team", "Goal",
    "Cy joins the circle", the viewed turn's actor in the scrubber tip. All five keep this rule; it is the
    strongest thing that separates these screens from claude.ai's cream-and-serif, together with the navy
    frame and apricot as a live colour rather than an accent.
