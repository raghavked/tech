# Judge panel · pages · 1

Theme: **pages** (approvals-queue, project-page, manager-overview, usage-charts, agent-profile,
memory-browser). Judged against BRIEF.md and tokens.css v5. Every folder PNG was opened; because all six
pages run 1 250–2 520 px tall and the folder shots stop at 900, each page was also rendered full-height at
1440 in light and dark and read to the foot. Scores are 1–10 for on-brief (vibrant, unity, palette roles),
craft (alignment, type, states), truth to the product, and distinctiveness from claude.ai, ChatGPT and
Linear. Explorations were not edited.

| Exploration | On-brief | Craft | Truth | Distinct | Overall | Verdict |
|---|---|---|---|---|---|---|
| memory-browser | 9 | 9 | 9 | 9 | 9.0 | keep |
| approvals-queue | 9 | 8 | 9 | 7 | 8.3 | keep |
| manager-overview | 9 | 8 | 9 | 7 | 8.3 | keep |
| project-page | 8 | 8 | 8 | 8 | 8.0 | keep |
| usage-charts | 7 | 9 | 9 | 6 | 7.8 | keep |
| agent-profile | 8 | 7 | 8 | 8 | 7.8 | revise |

Three things run through the panel. First, the pages agree on a voice and disagree on a shell: the rail
is ordered three different ways (Agents first on four pages; search, inbox, projects, then agents on
project-page; Payments, Inbox, Approvals, Memory, then agents on agent-profile), and agent cards are
titled by session on five pages and by owner ("Ana's agent") on one. Second, the two chart pages carry
two contracts: manager-overview draws every bar in one hue (the hand) and says so in its notes, while
usage-charts draws input and output in a stepped blue and rust from the data-viz-style board; the
overview's bars are even labelled "in + out" while showing one colour. Third, the dark status triplet
is overridden on three pages with two different greens (`#8FC487` on approvals and memory, `#8CC283` on
project-page) and not at all on agent-profile, where `--ok #4F7D4A` sits on `#232B3B` at about 2.3 : 1.
Panel 1 asked for `#9BC88F / #E2B06A / #E2847A` in the dark block; this panel makes it the sixth candidate
for one token, which is the clearest sign that tokens v6 should land before the next wave.

---

## memory-browser · 9.0 · keep

**What it is.** Team memory for Payments at 1440: a scope segment (Org 118 / Team 41 / Project 17) with
a picker, a search field and a History toggle; conflicts first as a two-sided notice with both quotes in
Instrument Serif, the session, commit and scope under each, "Keep this" under each side, "read by 3
sessions" beside it, and a foot that says both can be wrong; a resolved conflict folded to two lines with
the loser struck through and the reason in italic serif; then 39 entries as attributed rows (kind disc,
mono key, the sentence, "added by Bo · session invoice-pdf-3 · commit 0c8d44 · Billing page") with the
kind word and age on the right; then the curator's report. The aside carries counts, who remembers, and
a scope tree with "1 open" beside Payments.

- **On-brief 9.** The roles are kept: navy rail, cream page, the hand on Remember and Keep this and
  Retract, apricot for the cursor row, the selected scope, the decision kind and the who-remembers bars,
  amber for the open conflict and green for the resolved one. The voice is the brief's: "every one
  signed", "nothing reads either until someone keeps one", "only a person can retract; the curator never
  does". One deduction: the brand gradient appears three times (the summary kind disc, the agents bar in
  the aside, the rail's New session), and "one gradient per screen" is the brief's own rule; the summary
  disc could be navy with an apricot glyph and lose nothing.
- **Craft 9.** The best-built page in the set. Conflict → resolved → retracted → superseded → stale →
  proposed are all drawn, each one calmer than the last; the attribution line survives wrapping at 390
  because the scope word sits last; the mobile stack puts the search first and the sides one above the
  other with a hairline between. Two small misses: in dark the cursor row's fill is `--apricot-soft` on
  the dark surface, and the kind word and "1 h" age in `--ink-3` drop below 3 : 1 on that wash (the
  approvals queue solves the same row with an inset ring and a 55 % wash, which keeps the ink); and
  "blocks Tax lines" in the conflict header is set in `--danger` as a word on cream, the same contrast
  bug panels 1 and 2 already named for `--warn`.
- **Truth 9.** Scopes org / team / project, entries signed by the driver, conflicts that block a reader
  until a person keeps one, the curator that compacts with attribution and proposes but never retracts,
  "read by N sessions" per side, a stale agent entry waiting for "Still true". The open questions are the
  right ones (who may Keep; the read log the API does not have yet).
- **Distinct 9.** Nobody's memory page shows who said a thing, in which session, at which commit, and
  which sessions are reading it. The side-by-side conflict with two primary buttons and "Write the rule
  yourself" is the most Henosis moment in the panel.
- **The fix that matters.** Make the keyboard cursor one component shared with the approvals queue: an
  inset 1.5 px `--apricot-deep` ring, a 3 px gutter stripe, the wash at 55 % so `--ink-3` metadata stays
  legible in dark, and the row hint in `--ink-2`. Then the three gradients collapse to one (New session)
  by drawing the summary disc and the agents bar in `--rail` with an apricot edge, which also keeps the
  aside's bars one colour per entity as the data-viz contract asks.

## approvals-queue · 8.3 · keep

**What it is.** The queue as one flat list, oldest first, every row a sentence ("Bo's agent in Checkout
wants to deploy `checkout-proration` to production.") with the project, risk pills, votes and age on a
second line; release gates carry a gradient hairline, a "Release gate" pill, an `irreversible` pill and
a two-segment quorum meter with "1 of 2 at 4+ · avg 4.0"; the cursor row shows the compact rating with
the gate tick after the third star and "Approve with 4" baked into the button; five real states in one
list (cursor with preview, exec with no votes, your vote in with "Change to deny", driver-only with the
owner override, a gate at avg 3.0); a quiet Done list; an aside with At a glance, the three gates as
meters and the keys. Phone drops the aside and hints, stretches the buttons and grows the stars to 34 px.

- **On-brief 9.** Frame, page, hand and pulse are used exactly: the hand only on Approve, apricot for
  the cursor row, the counting quorum segment, the filter dot and the live counts in the rail, amber only
  where a vote is missing or an average is under the bar. "A 3 is a voice, not a vote" and "a decision
  anywhere folds the row" are the brief's voice. Deduction: the brand gradient is drawn seven times on
  one screen (three gate hairlines, three gate pills, the Release gates filter dot) plus New session; the
  hairline alone already says "gate".
- **Craft 8.** A finished screen with every state on it, the row grid (gutter · avatar · body · controls)
  holds across all five rows, Done rows fold to one line with the result coloured. Misses: `.word.warn`
  and the `avg 3.0` on row five set words in `--warn` on cream (3.4 : 1), the same rule the badges board
  wrote and panel 2 flagged; the two-segment quorum meter is drawn at 44 px per segment in the row and
  as flexible bars in the aside, so the same fact has two widths; the Done row's `openexchangerates.org`
  code chip is inline-styled rather than the row's `code` rule.
- **Truth 9.** The gate rule "2 at 4+", irreversible vs exec vs external, "Approve with 4" as the default
  the kernel sends, a changed vote accepted, the row that folds whether decided here, in the notice, the
  inbox or the palette. The one claim the kernel does not make is "Approve as owner" on Cy's row: today
  the vote is sent and the policy decides whether it counts, which the notes admit.
- **Distinct 7.** A keyboard-driven queue with `j k a d` is Linear's and Superhuman's shape. The sentence
  rows in serif, the quorum meter that turns amber at a 3, and "Approve with 4" on the button are ours.
- **The fix that matters.** Do not promise an override the policy may not grant. Cy's row should read
  "waits for the driver · Cy · away until 13:00" with Nudge Cy as its only action, and show "Decide as
  owner" only when the gate policy returns an owner-override rule for that risk class; when it does, the
  button says what it does ("Approve for Cy · logged in your name"). Then the row's hint line and the
  At-a-glance "Cy's call · you can override as owner" say the same true thing.

## manager-overview · 8.3 · keep

**What it is.** The Payments overview at 1440: a serif title and one sentence ("4 open sessions across
2 projects … 3 things need you. This week the team spent 212k tokens, rated 7 plans and held 2 release
gates"), a range control, three Needs-you cards with a stripe each (gradient gate, apricot plan, red
contention), five stat tiles with a detail line that splits each number, three bar charts in one hue with
a reading under each, an area chart of tokens over turns with a crosshair readout, Plans with stars and
estimate-vs-actual, Release gates with votes as avatar + number and a dashed empty avatar, Gate health,
Crews, Groups, and a roster where people and agents share one grid. Phone goes one column with tiles
two-up.

- **On-brief 9.** The sentence first and the charts as its proof is the brief's "calm, specific, warm"
  done as a page; the hand carries every bar and nothing else is coloured, so it reads as a ledger. The
  roster's "8 members: 4 people · 4 agents" is the product's point in one tile. Deductions: "+18% on
  last week" is a word in `--warn` on cream; the contention stripe is `--danger` here and `--warn` on
  project-page, so the same notice has two colours in the set.
- **Craft 8.** 2 521 px that stay aligned on a 1 088 px measure; the stat tile contract (label · serif
  value · small unit · split line) is exact; gate votes as avatar + number with a dashed empty avatar for
  the missing voice is a drawing worth keeping. Misses seen in the shot: the hover readout on Cy's bar
  sits over Ana's bar and label, which the notes admit; the stars are Unicode `★` glyphs at 15 px while
  the approvals queue draws SVG stars with the gate tick; the roster's agent avatars are single letters
  (P, I, C, T) where every other page uses two; "Refresh" as a ghost button in the topbar is a control
  the page should not need.
- **Truth 9.** Sessions by state, plans with the rule and the estimate against the actual (+38% on
  Invoice PDF, carried into the chart's reading), gates with the irreversible rule and who voted what,
  crews with "together" tokens and the baton holder, groups with the last thing said. "Gate health" is new
  and honestly flagged as such.
- **Distinct 7.** Stat tiles, bar charts and an area chart are every admin page. The sentence lede, the
  gate card with its vote dots, "Even spread; no one person is over a third" under a chart, and agents in
  the same roster grid as people are what make it Henosis.
- **The fix that matters.** Settle the chart contract with Usage and build the three bar charts from one
  component. The overview's bars are labelled "in + out" and should show it: the stacked in/out bar from
  usage-charts (navy and chocolate stepped, 2 px surface gap), with the single-series total in the hand
  only where there is one series (the area chart). Put the hover readout where the value column is,
  replacing "58k" with "58,412 · 27%" for the hovered row, so it never covers a neighbour; and swap the
  `★` glyphs for the approvals queue's SVG stars.

## project-page · 8.0 · keep

**What it is.** Billing page as a fleet board: a direction composer with a constrain / steer segment and
the active directions as chips (italic serif mode tag, author, age, an apricot ring and Withdraw on your
own); the agents board grouped by crew (hollow apricot ring, serif crew name, claims in mono), each row a
status dot, serif title, owner-with-whom, the agent's italic line, a token meter with its budget, the
status word and an action, one row tinted for a contention, the Team up form open in place; a contention
notice in the contention-handoff grammar with "Cy wins / Bo wins / Dismiss"; a resolved one folded;
Brief folded. The right column is spend this week by session, people with "joined the circle today",
team chat kept in the ledger, and team memory with a conflict asking for a Keep.

- **On-brief 8.** The page is cream with the rail as frame, the hand on Set direction, Team up and Cy
  wins, apricot for the constrain tag, the crew rings, the live spend bar and Dee's ripple. The summary
  sentence with the hot thing in bold and the "Never sent to an agent · replayable" foot are the voice.
  Deductions: two New session buttons on one screen (the gradient one in the rail, a chocolate one in the
  topbar); "131k of 120k" and "1 approval waiting" are words in `--warn` on cream.
- **Craft 8.** The five-column row (dot · what · meter · status · action) holds for running, awaiting,
  held, idle, closed; the Team up form's input takes the glow and the primary stays off until there is a
  name; directions wrap correctly at 390 with the author on its own line. Misses: "Leave crew" is a ghost
  button on every live row, a destructive verb shown permanently where the row's own live verb (Rate,
  Pick, Replay) should sit; the spend card's per-session bars are apricot while every other spend bar in
  the set is the hand; the "Checkout proration" crew lives inside the Billing page project while
  Checkout is a sibling project in the rail, which a reader will take as a mistake.
- **Truth 8.** Directions entered above owner rank and shown as `[project]` in each intent, crews with
  claims, the contention denied under `block` with the lead picking, memory conflicts asking for a Keep,
  team chat never reaching an agent. Two assumptions are drawn as fact: a project-level budget (320k)
  where the spec only has branch budgets, and "Leave crew" for anyone on any row where the spec says owner
  or lead; both are in the open questions.
- **Distinct 8.** Direction chips with a mode in italic serif, a crew header with its claims, and a
  contention with two numbered sides and "Both owners see this too" are not in claude.ai, ChatGPT or
  Linear. The right column's cards are ordinary.
- **The fix that matters.** Make the action column carry the one thing the row is waiting for and hide
  the rest. Tax lines shows "Rate", Proration shows "Pick" (lead only), the closed row shows "Replay",
  running rows show nothing; "Leave crew" and "Team up" move to the row's overflow and the crew header.
  Then rename the crew so it does not collide with the sibling project ("Proration" under Billing page),
  and drop the topbar's New session so the rail's gradient button is the only one.

## usage-charts · 7.8 · keep

**What it is.** The Usage page: a sentence that states the conclusion (18% more, Billing page, 981k of
1.0M, amber around 26 Oct), five stat tiles with a sparkline, an in/out split, a cache row, a budget
meter with the 80% tick and a forecast; tokens by day as stacked columns with last week's wash and a
tooltip; October against the budget as a cumulative line with a dashed projection, a ±8% band, the 80%
amber hairline and the budget as a dotted "soft" line; by project, person and agent as stacked horizontal
bars with avatars; and the same numbers as a table at the foot with Copy as CSV. Phone draws a 7-day
column chart with its own viewBox.

- **On-brief 7.** The page is Henosis in its frame, type and voice ("Nothing stops at 100%", "Counted by
  who holds the session, not who steered"), and the hand keeps the total line and the budget meters. The
  deduction is the series pair: `#3B66A8` is a saturated cobalt that Dress Blues never was, and with the
  rust it makes the column chart read as any analytics product's; the brand "steps into a chart band" per
  the data-viz-style board, but the step moved hue and chroma, not just lightness. Also "+18% on last
  week's 179k" is green here (`.up`) and amber on the overview for the same fact; a spend delta is not
  good news by default.
- **Craft 9.** The most careful chart work in the set: every SVG has a title and desc, the table is
  always rendered, columns are capped at 24 px with a 2 px gap and a rounded top on the output segment
  only, the forecast's vocabulary (So far / At this pace / ±8% / 80%) is in the legend and the foot, the
  phone chart is re-laid rather than shrunk, texture is wired for forced-colours. Misses: the by-person
  tooltip covers Ana's label (admitted in the notes); the Texture chip is a page control for what is a
  team setting; the "Closed (3)" row's avatar slot is an empty hidden element that leaves a gap.
- **Truth 9.** Input and output in the budget, cache read beside it and never inside, a soft budget that
  turns amber then red and stops nothing, team sessions counted to the driver, the forecast from five
  weekdays and two weekend days. The open question about splitting team spend by who steered is the one
  finance will ask.
- **Distinct 6.** Stacked blue-and-rust columns, a forecast line and a KPI row are the shape of every
  usage page. The sentence lede, the serif values, "nothing stops", and agents as avatars in the same bar
  list as people are the Henosis parts; they are carried by type and words, not by the charts.
- **The fix that matters.** Re-step the input series from Dress Blues without leaving its hue and chroma
  (a lighter, still-grey navy on cream, a cream-tinted slate on the dark surface), re-run the six checks
  against the chocolate step, and where the pair fails on one check let the texture channel be the second
  discriminator rather than reaching for cobalt. Then put spend deltas in ink with the sign and colour
  them only against a budget, so "+18%" means the same thing on Usage and the overview.

## agent-profile · 7.8 · revise

**What it is.** A member page for Ana's agent: the agent avatar (rounded with one square corner, on the
brand gradient, carrying the mark, a green live dot), serif name with the Team pill, "Owned by Ana · Crew
Invoice rollout · Payments team", a mono model line, "Working on *Proration for mid-cycle upgrades* ·
Ana has the baton · Bo and Dee are in"; four tiles (sessions, tokens against the soft budget with a day
sparkline and "saved 37k", approvals earned with the average, memory added with a conflict); sessions
and approvals it earned on the left; membership, the "joined the circle the same morning as Ana" wash
with the mark, memory in Ana's name, and manners on the right. Phone stacks the header through grid areas
and adds a bottom bar.

- **On-brief 8.** The header grammar is the brief's whole argument on one page: an agent with an owner, a
  crew, a team, a joined date and manners, like a person. The gradient is on the avatar and the New
  session button only, which the notes name. Deductions: the apricot "joined" wash on the dark surface
  renders as a flat grey-brown block in the dark shot and loses the pulse; the only place on the page the
  hand appears as text is the "Working on" italic, which is fine, but the Open session primary appears
  twice (topbar and header), so the hand is doubled.
- **Craft 7.** The identity header, the tiles and the two columns are well set, and the sparks tile with
  today haloed is a good small drawing. The misses are in the set, not the page: the rail puts Payments /
  Inbox / Approvals / Memory above AGENTS and titles the cards "Ana's agent" where the other five title
  them by session, so this page does not sit in the same app; it is the only page with no dark status
  override, so the green checks and the live dot run at ≈2.3 : 1 on the dark surface; stars are Unicode
  `★` again; the "Message" and "Open session" pair is drawn in both the topbar and the header; the
  Approvals it earned list shows only grants, which the notes admit is the flattering half.
- **Truth 8.** Sessions with their state and spend, approvals with who granted and the rule met,
  memory in Ana's name with a conflict, manners that match the policy (plan first, gate held by Bo who
  consumes the code, soft budget set by Bo). The name is the unresolved truth: the product calls it
  "Ana's agent" and the rail elsewhere calls it "Proration"; a profile is where that has to be decided.
- **Distinct 8.** A profile page for an agent with "joined the circle the same morning as Ana", manners
  as a checked list, and approvals it earned from named people is not something claude.ai, ChatGPT or
  Linear draw. The layout itself is a GitHub profile.
- **The fix that matters.** Put the page in the shell. Rebuild the rail to the settled grammar (New
  session, AGENTS with crews first and session-titled cards, then the project section), add the dark
  status triplet, keep one Message / Open session pair in the header and leave the topbar with the
  breadcrumb and the live status, and let the header answer the name question in one line: the serif
  name is "Ana's agent", and the session it is on ("Proration for mid-cycle upgrades") is the card title
  the rail uses, so both pages say the same thing.

---

## Carry forward

Patterns the system should adopt from this panel, in the order they should land in tokens.css and the
component set.

1. **The lede.** Serif h1, then one sentence in the manager's voice: the hot thing in bold, counts in
   medium weight, token figures in mono, one link to the next page; the range control sits top right and
   drives every number. Five of six pages already do it; write it once. (manager-overview, usage-charts,
   project-page, memory-browser, approvals-queue)
2. **The attribution line.** "added by *Bo* · session invoice-pdf-3 · commit 0c8d44 · Billing page",
   name in serif, session and commit in mono, scope last so it wraps; the same line under memory
   entries, approvals ("Ana approved with 4"), plans ("rated by Bo, Dee") and gates. (memory-browser)
3. **Stat tile contract.** Label · serif value · small unit · a detail line that splits the number; the
   only colour in a tile is a budget meter past 80%; deltas are ink with a sign, coloured only against
   a budget. (manager-overview, usage-charts, agent-profile)
4. **One chart component.** In/out stacked bars from the data-viz contract with the input step re-done
   inside Dress Blues' hue; the hand for a lone total; a reading sentence under every chart; a table under
   every chart; the hover readout replaces the row's value column. (usage-charts, manager-overview)
5. **The row that waits.** The action column carries the one verb the row is waiting for (Rate, Pick,
   Approve with 4, Replay) and nothing permanent; destructive verbs live in the overflow.
   (approvals-queue, project-page)
6. **Quorum and votes.** Two apricot segments with "1 of 2 at 4+ · avg 4.0" in mono for progress, and
   avatar + number with a dashed empty avatar for who; amber when the average is under the bar.
   (approvals-queue, manager-overview)
7. **The keyboard cursor.** One state: inset `--apricot-deep` ring, gutter stripe, wash at 55 %, the
   row's hint in `--ink-2`, keys never while you type. (approvals-queue, memory-browser)
8. **Stars are SVG.** The approvals queue's star with the gate tick after the third and the serif word;
   retire the Unicode `★` on manager-overview and agent-profile.
9. **The rail is one rail.** New session, AGENTS (crews first, session-titled cards), then the project
   section (Overview, Usage, Inbox, Approvals, Groups, Memory); the "me" row last. project-page and
   agent-profile reorder it and should not.
10. **Tokens v6 now.** The dark status triplet from panel 1 (`#9BC88F / #E2B06A / #E2847A` + softs), the
    status inks (`--ok-ink`, `--warn-ink`, `--danger-ink`) for every word in a status colour, and the
    contention stripe decided as `--warn` (project-page) rather than `--danger` (manager-overview). Six
    pages, four overrides, one page with none, is the evidence.
11. **The joining wash.** An apricot-soft block with the mark and a serif sentence ("Joined the circle the
    same morning as Ana", "Dee joins the circle") for any joining fact, with a dark variant that keeps the
    pulse rather than greying. (agent-profile, project-page)
