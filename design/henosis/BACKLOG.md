# Henosis · implementation backlog

The ordered list of work that takes `apps/web` (and the desktop shell in `apps/desktop`) from the v5 app
to the judged designs. Written from `BRIEF.md`, `tokens.css`, the twelve `explorations/_judge-*.md`,
the winners' `index.html` and `notes.md`, and the synthesis files beside this one (`SYSTEM.md`,
`MOTION.md`, `SCREENS.md`). Explorations are cited by slug; where two disagreed, the judged winner is
the spec and the loser is named.

How to read an item:

- **Size**: S = under half a day, M = a day, L = two to three days, XL = a week. Sizes are for one
  front-end engineer who has read SYSTEM.md.
- **Server** flags work that cannot land in `apps/web` alone (`packages/server`, `packages/kernel`,
  `packages/slack`, `packages/fleet`). The web item can ship behind the current API where it says so.
- **Checks** are the acceptance tests. Every screen item ends the same way: shot at 1440×900 (or 390×844)
  at 1:1 in light and dark with `apps/web/shoot.design.mjs`, the top row of each PNG read before filing,
  and the marks looked at at 3× ("Aprove", the black-coin mark and the 40 px welcome brief all shipped
  because nobody looked).
- Order inside each group is the order to build; items depend on the ones above them unless they say
  otherwise. Nothing in *next* starts before W1–W4 are merged, because every page item reads the tokens,
  the mark, the status component and the rail.

Decisions the founder owes before the item that needs them starts are collected at the end
(`Decisions`, mirrored from `SCREENS.md` Appendix C).

---

## This week · the foundation

The wave's most repeated finding, in twelve panels out of twelve: the pages drift because the tokens are
missing (four dark status triplets, three rail orders, five redrawn marks). These eight items are the
system; they are small individually and everything else is cheaper once they are in.

### W1 · Tokens v6 in the app

**From** `colour-system` (8.3), `dark-mode` (8.5), `session-dark` (8.0), `motion-spec` (8.3),
`accessibility` (7.8), `badges-status` (7.5), `rail` (7.5), the `SYSTEM.md` §2 and §16 tables and
`MOTION.md` §12 patch. **Size L.** No server.

**Files.** `apps/web/src/tokens.css` (the only file explorations do not share with the app; start from
`design/henosis/tokens.v5.css`, which SYSTEM.md §19 verified as a drop-in that keeps every selector and
custom property `styles.css` reads), `design/henosis/tokens.css` (land the same patch so explorations and
app animate with one vocabulary; delete `tokens.v5.css` once both agree), `apps/web/src/styles.css`
(remove the per-view dark overrides at lines ~1982–1983 in `.look-preview`, retire `.pill.badge` on
`--warn`), `apps/web/src/theme.ts` (no change to the `--team-*` contract; `THEME_VARS` stays).

**What lands.**
- Dark block: `--rail #10141C`, `--rail-2 #1A2030`, `--rail-line` 8 %, canvas `#1A202C`, surface
  `#242C3C`, `--line` .14, `--edge: inset 0 1px 0 rgba(255,255,255,.055)` on raised surfaces instead of
  shadows, `--out-bg #0E1218` for the agent's output block, cream ink `#F0EAE0` not white.
- The dark hand: `--accent #7A4B3E` with `--accent-fg #FFF8F1` (7.2 : 1), so "Approve with 4" is never the
  same colour as the live step beside it (`session-dark`'s one fix). Apricot stays the pulse.
- One dark status triplet: `--ok #9BC88F`, `--warn #E2B06A`, `--danger #E2847A`, softs at .18; the
  light `-ink` tokens `--ok-ink #3F6A3B`, `--warn-ink #7F5320`, `--danger-ink #8A3A30`, `--info-ink
  #5B6273` for any word that must be a status colour; `--ink-3` documented as metadata-only with a
  12 px floor.
- `--gradient-brand` one notch up on both ends in dark (`#3A4661 → #7A4B3E`); `--gate-stripe`
  (`180deg, #E2C4A6, #56352D`) for the gate's one gradient; `--gradient-live` deleted (the budget meter
  does not scroll).
- Chrome selection: `--select-wash rgba(226,196,166,.30)`, `--select-line rgba(207,167,130,.5)`
  (apricot 38 % in dark), `--scrim` navy .42 light / black .52 dark, `--mention-agent` (#2A3244 /
  #3A4458), `--badge #E0463A` (declared because the OS is red there, `first-run-desktop`).
- Focus: `:focus-visible` = 2 px `--accent` outline, offset 2, `--team-glow` as the halo outside it; in
  dark the ring is `--ink` (cream) so focus never borrows the pulse (`accessibility` fix).
- Mark constants: `--mark-disc: var(--rail)`, `--mark-arc-a: #56352D`, `--mark-arc-b: #E2C4A6`,
  `--mark-dot: #E2C4A6`; in dark keep the disc at `#2A3244` (chocolate on `#0F131B` is 1.7 : 1);
  `--mark-ring` / `--mark-bead` kept one release as aliases, then deleted (`brand-board`, `mark-motion`).
- Motion: one keyframe vocabulary (`dot-live`, `orbit-1/2/3`, `weave-slide/over/under`, `card-in`,
  `mark-halo` new, `arc-a/b` with the ±60° start and the 15 / 70 / 85 % hold), one guard
  (`@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }`), Calm keeps
  every end state including `.draw { stroke-dashoffset: 0 }`; the blanket `animation: none !important`
  goes. `--ease-mark: cubic-bezier(.3,.9,.3,1)` added beside the three curves.
- Collisions fixed centrally: the rail card rule becomes `.agent:not(.avatar):not(.msg)`; `.sidebar
  .section` gains the `.rail-section` alias; `.sidebar, .rail` share every rule so explorations' markup
  and the app's agree; `--canvas-wash` drawn as a blurred disc (`loading-screens`), measured against the
  radial gradient on the fleet board before it ships.

**Checks.**
- `grep -c "#8FB07A\|#DDA363\|#D9826F\|#8FC487\|#8FC386\|#EA9384" apps/web/src/*.css apps/web/src/**/*.tsx`
  returns 0: no hard-coded status hex anywhere in the app.
- A contrast script over the dark block (reuse `TeamLook.tsx`'s `contrast()`): `--accent-fg` on
  `--accent` ≥ 4.5, each status colour on `--surface` ≥ 3, `--ink-2` on `--surface` ≥ 4.5, the chocolate
  arc on `--mark-disc` reported (it is 1.2 : 1 by design; the check is that it does not drop below).
- `pnpm --filter @henosis/web typecheck && pnpm --filter @henosis/web smoke` green; the session, rail,
  project and overview pages shot light and dark and compared by eye to `dark-mode`'s proposed panes.
- With `data-motion="calm"` on `<html>` the running dot is still green, the drawn check is drawn, the
  Team pill is apricot, and no element is hidden at rest.

### W2 · One mark file and one `Mark` component

**From** `brand-board` (8.5), `mark-motion` (8.5), `print-export` (7.8, the `<use>` lesson), `widgets`
(7.5, the small cut). **Size M.** No server.

**Files.** New `design/mark.svg` (the file every page cites and which does not exist) holding the five
`<symbol>` cuts from `brand-board/index.html` lines 228–258 (`#mark`, `#mark-bare`, `#mark-small`,
`#mark-tiny`, `#mark-mono`), every colour as `style="fill:var(--mark-disc, #2A3244)"` so a `<use>`
inherits it and page CSS never has to reach inside the shadow tree. `apps/web/src/ui.tsx` `Mark`
(lines 32–110): render the same geometry inline (React, not `<use>`, so the team look and the joining
class keep working), choose the cut from `size` (default ≥ 32, small 20–31, tiny < 20), accept
`joining`, `once`, `halo`, `ghost` (dashed centre: not yet in the circle, `tour` / `error-states` /
`first-run-desktop`), and `segments` (the tour's five-segment ring). Replace `apps/web/public/logo.svg`
and `favicon.svg` with exports of the symbols (favicon = `#mark-tiny` on the navy disc; the current
`logo.svg` draws the cream variant and is right for the lockup only). Retire "bead" from every comment
and class (`.folded::after`, `.composer::after` → `content: none`, SYSTEM.md §19).

**Checks.**
- The mark at 16, 20, 24, 32, 48, 96 in both themes on cream, navy, apricot and chocolate grounds (a
  storybook page or a `test/mark.spec.ts` screenshot) matches `brand-board`'s colour-by-ground table:
  person's arc chocolate everywhere except on chocolate, agent's arc apricot on navy and navy on cream,
  centre the lightest colour present.
- `.mark.joining` at 48 px: frame 0 shows two arcs resting at ±60°, not a crescent; the centre never
  appears before 60 %; `.once` runs one iteration and holds. Below 24 px nothing swings and the closed
  mark fades in over 200 ms.
- The rail brand, the hero on `#/`, the joined-the-circle line, the loader and the toast all draw from
  `Mark`; `grep -rn "<path d=\"M48 18" apps/web/src` finds exactly one file.

### W3 · Loaders with a meaning

**From** `loading-screens` (8.75), `motion-spec`. **Size M.** No server for the loaders; the join
count's "1,204 of 2,310 events folded" needs the server to send a total with the replay (flag, optional:
fall back to "events folded so far").

**Files.** `apps/web/src/ui.tsx` `Loader` (line 122): `kind="join" | "orbit" | "weave" | "shimmer" |
"halo"`; `orbit` only at the 54 px page centre on a first join, `halo` (the mark's centre pulsing) for
every inline and toast wait so no Henosis wait is three dots in a row; `apps/web/src/copy.ts` gains the
copy table (`Opening the circle.`, `Joining Bo, Cy and Dee in Billing page · Checkout.`, `Opening
Payments. 3 of 5 sessions in`, the 8 s cause line and the 30 s action per wait); `apps/web/src/
reconnect.tsx` `ReconnectLine` uses `halo` and `error-states`' sentence (`Reconnecting · attempt 3 ·
again in 4s · the stream is as of 14:02 · Try now`); `App.tsx` launch and `SessionView.tsx` join use
the four screens as drawn (rail live while joining, direction readable while rows ride in, finished
steps checked while one runs, shimmer only where the summary will land, composer muted with "You can
type once the history is in.").

**Checks.** No `.loader` without a sentence; each wait shows exactly one loader; after 8 s a second
line appears, after 30 s a chocolate action; Calm freezes each at its finished frame (closed ring,
stacked dots, plain strand, flat lines). `Loader` keeps `role="status"`.

### W4 · Status, counts, pills and stars

**From** `badges-status` (7.5), `agent-card` (7.5), `rating-control` via `approvals-queue` (8.3),
`colour-system`. **Size M.** No server.

**Files.** `apps/web/src/ui.tsx`: `STATUS` / `Status` gain the five words (running, awaiting approval,
blocked, paused, idle) plus closed and offline, one dot drawing (filled, filled + halo, hollow,
hollow-faint, dashed) at 6 / 8 / 10 / 12 with hidden text in the dot, and the rule that only Running
moves; a `Count` component (mono, apricot-deep on cream / apricot on navy, navy ink, absent at zero,
99+, pops on change) replaces `.pill.badge`; status pills (`.spill`) set the word in ink on the tinted
ground in both themes, the dot carrying the colour; `Stars` (line 269) becomes SVG with the gate tick
after the third star and the serif word (risky · unsure · fine · good · ship it), one `radiogroup` with
roving tabindex, "Approve with N" with `DEFAULT_RATING` baked into the label; `apps/web/src/styles.css`
`.stars`, `.pill`, `.status`, `.livedot` consolidated.

**Checks.** Unicode `★` no longer appears in any `.tsx` (manager overview and agent profile shipped it).
`grep -n "color: var(--warn)\|color: var(--ok)\|color: var(--danger)" apps/web/src/styles.css` returns
only `-ink` uses after the pass. The status pill screenshot is the same rule in light and dark. A
screen reader reads "Running" from the dot and "Approve with 4" from the button.

### W5 · The rail, drawn once

**From** `rail` (7.5), `agent-card` (7.5), `session-view` (8.3), the pages panel's carry-forward 9,
`team-look-editor` (the `.look .prail .new` reset). **Size L.** No server.

**Files.** `apps/web/src/App.tsx` `Shell` (line 186), `apps/web/src/ui.tsx` `AgentCard` (line 607),
`TeamPill`, `doingOf`; `apps/web/src/styles.css` `.sidebar` block (lines 167–300); `apps/web/src/
palette.tsx` `publishSidebarSessions` (the palette reads the same rows).

**What lands.** Order: brand (mark 24 px, serif wordmark), New session on the one gradient (the `N`
key moves into the tooltip, the decorative ring goes), Search with ⌘K, AGENTS with crews first (serif
crew name, ring glyph, claims count) then solos, each card the one component (8 px dot · serif
session title · Team/Solo pill or count; italic serif lead + plain tail clamped at two lines; foot =
stack capped at three with the driver ringed in apricot-deep, "with …", mono spend with a 2 px budget
hairline that warms past 80 %), then the project section (Overview, Usage, Inbox, Approvals, Groups,
Memory) with inbox and approvals counts as the only solid apricot in the rail, the me row last
(serif name, `owner · driving`). The account menu's theme segment reads the live theme. The collapsed
72 px rail (`desktop-compact`) keeps the order with avatars and corner dots; its hover card opens after
a 400 ms rest in `rail-2`, placed so it never covers the live message. The active row is
`--select-wash` plus a `--select-line` ring. Session-titled cards everywhere; "Ana's agent" is the
stream's name for the agent, not the card's (`agent-profile` fix).

**Checks.** The rail on `#/`, `#/p/:id`, `#/p/:id/s/:id`, `#/m/:team`, `#/c/:org`, `#/inbox`,
`#/approvals`, `#/memory/:org`, `#/settings` is pixel-identical apart from the active row (a Playwright
test that screenshots the `.sidebar` on each route and diffs). Dark rail `#10141C` is separable from the
canvas by eye. No page renders its own New session button (`project-page` had two).

### W6 · Focus ring and the keyboard cursor

**From** `accessibility` (7.8), `micro-interactions` (8.0), `memory-browser` (9.0), `approvals-queue`
(8.3). **Size S.** No server.

**Files.** `apps/web/src/tokens.css` (`:focus-visible` from W1), `apps/web/src/styles.css` (one
`.cursor` rule: inset 1.5 px `--apricot-deep` ring, 3 px gutter stripe, wash at 55 %, hint in
`--ink-2`), `apps/web/src/approvalsQueue.ts` `moveCursor` reused by `views/Memory.tsx`; switches and
checkboxes in `views/Settings.tsx` move off `--accent` to `--apricot-deep` so the hand stays a verb.

**Checks.** The ring is ≥ 3 : 1 against cream and against the dark surface; a focused row and a hovered
row can show at once (hover is `--surface-2`); keys never fire while `isTyping()`; the TeamLook editor
recolours the halo (`--team-glow`) and never the ring.

### W7 · The Slack adapter sends the product's default

**From** `slack-templates` (7.25), `surfaces` carry-forward 7. **Size S.** **Server:** `packages/slack/
src/adapter.ts` line 374 (`d === "approve" ? 5 : undefined`) sends `DEFAULT_RATING` (4) from one shared
constant (move it from `apps/web/src/approvalsQueue.ts` to `packages/kernel` or `packages/protocol`);
carry the rating in the button `value` under one `vote:…:approve` action_id; show Approve / Deny only
when the rule has no ratings; no star is primary.

**Checks.** A bare Approve from Slack and from the web app produce the same `ApprovalVote`; adapter unit
test for the five-button row; "4 is the default the app sends" is now true on the Slack board.

### W8 · Type and copy constants

**From** `type-scale` (unjudged, adopted by SYSTEM.md §3), the cast rule (`surfaces`, `desktop`).
**Size S.** No server.

**Files.** `apps/web/src/tokens.css` (`--t-text` 15/24, h1 40, h2 26, `.mono` 13 tabular, `--col 780`,
`--sidebar 296`, drawer 340), `apps/web/src/copy.ts` (one cast: Ana Moreau, Bo Lindqvist, Cy Okafor,
Dee; "X's agent"; the joining line "X joins the circle."; the session summary sentence stays
`copy.team.summary`), `apps/web/test/fixtures` updated to the one cast.

**Checks.** Fixture names appear once; `grep -rn "Ferreira\|Aprove" apps design` is empty.

---

## Next · the session and the pages

### N1 · Session view

**From** `session-view` (8.3), `session-dark` (8.0), `token-meter` (8.3), `keyboard-first` (8.3),
`mark-motion` (the join line). **Size XL.** No server for the layout; the plan step ↔ gate link needs
the approval record to carry the step it waits at (**server**, `packages/kernel/src/approvals.ts`:
add `stepIndex` to the gate notice payload; the web item ships with the notice saying "step 4 of 4 ·
Migrate stored invoices" from the plan it already has).

**Files.** `apps/web/src/views/SessionView.tsx` (1 592 lines; split the title row, the three message
shapes, the gate approval and the composer into `src/stream/` components while here),
`src/stream/PlanCard.tsx`, `src/stream/blocks.ts`, `src/stream/VirtualList.tsx` (the enter animation
`.enter` removed after first paint so re-renders do not replay `card-in`), `apps/web/src/ui.tsx`
`TokenMeter` (line 488), `apps/web/src/styles.css` conversation and `.meter` blocks.

**What lands.**
- The three shapes: human = white bubble, italic serif "Goal" label, mono scope chip, left-aligned;
  agent = bubble-less prose, step grid (icon · mono line · mono result), navy output block on
  `--out-bg`, the deepest surface in both themes; team = apricot wash with "to the team" in italic serif.
- One right-hand meta rule: people carry a time; the agent carries `turn N · step k of m`.
- Title row: serif title · status with turn · Team pill "Team · with Bo" · mono token chip with a 3 px
  hairline and the 80 % tick, colour only when the budget turns, a pulsing apricot dot (not a turning
  ring) while spending · presence stack with the driver ringed · Team / Details buttons lit with
  `--apricot-soft` when open.
- Plan ledger: used beside estimate (green under, amber over), totals against the budget bar, rater
  chips with SVG stars, "by the team's ratings" in green, the soft-budget sentence in the foot; budget
  counts input + output only.
- The gate approval tied to its step: mono command, `irreversible` chip, others' votes with notes,
  stars with the default baked into "Approve with 4", "1 of 2 raters" in mono, two gate segments, and
  the plan's pending row pointing at the notice ("waits at the gate below").
- Token breakdown popover's fixed shape (head, stacked bar, four rows including zeros, rule, budget
  row, consequence line, foot); drop "saved ~4.4k" until a price exists.
- The join line: 30 px mark playing arcs-close once, serif sentence with the name in chocolate, mono
  time; the newcomer's avatar ripples; leaving is a quiet divider with no motion.
- Keys printed on the thing they act on while nobody types (`h` `f` `i` in the topbar buttons, `/` in
  the empty composer, `1`–`5` under the focused plan's stars, `↵` printed as "sends 4 and approves");
  one "Keys live / Typing" chip; caps hidden on touch. (`shortcuts.ts` gains the number keys as
  proposals; see N7 for the two-step `a`.)

**Checks.** The light shot is taken scrolled to the top and to the gate (two shots), not mid-pulse;
one gradient on the screen (New session); "Approve with 4" is chocolate in light and `#7A4B3E` in dark
beside apricot pulses; the stream's first line is never clipped under the topbar; `flows.spec.ts` covers
rate → approve → gate granted → check drawn.

### N2 · One drawer, two faces (Team | Details)

**From** `team-panel` (8.8), `mobile-rail` (8.8, the same panel state on the phone). **Size L.** No
server (the catch-up brief reads `packages/fleet/src/brief.ts` as today).

**Files.** `apps/web/src/views/SessionView.tsx` (one `panel` state with two values instead of two
sibling panels), `apps/web/src/styles.css` `.drawer` block, `apps/web/src/views/BranchCompare.tsx`
(the branch row's one labelled action plus a `…` menu).

**What lands.** A 340 px drawer with a segmented Team | Details switch in its head (live dot and count
on Team); section headers carry their summary ("2 here · 1 away", "proration · 1 conflict", "25 % ·
about 37.6k left"); people rows (serif name, "you" small, role in grey, driving as a chocolate flag,
away rows dimmed together, role select only where an owner can change it, Hand off only where the
driver can); the crewmate as a navy tile inside cream with its claims; chat with the pinned input and
"Kept in the session log. Never sent to the agent."; Details with the Goal chip, mono scope keys, the
held-until-a-pick line, the replay strip, Branches with its file list folded by default and one action
per row, Usage above Branches when the budget is past the 80 % tick, Memory and Catch-up collapsed.
The "Cy joins" divider gets 6 px more bottom padding so the pinned input never clips it.

**Checks.** The Details face fits 900 px with Memory and Catch-up folded; the four states strip (Solo
with Team up, handoff offered, nobody else here, over budget) each render from fixtures; the same
`panel` state drives the mobile sheet (L3).

### N3 · Replay scrubber

**From** `replay-scrubber` (8.3, revise). **Size M.** No server.

**Files.** `apps/web/src/views/ReplayScrubber.tsx`, `apps/web/src/replay.ts`, `apps/web/src/styles.css`
`.scrubber` and `.past` blocks (lines 1060–1143).

**What lands.** A 36 px resting row (dots only) that grows to the 64 px track only when pinned or
viewing; plan spans above the track; the viewed turn ringed in apricot; now pulsing with "NOW" in ink
and an apricot dot beside it (apricot-deep on cream is 2.3 : 1); the gate as a hollow diamond; the
hovered turn's preview in the left label ("Turn 8 · 09:44 · Bo steers") and no tip under the track; the
dashed "The session goes on · 6 more turns to now" edge with future chips; a read-only composer whose
only action is a chocolate "Return to now"; `turn N · time · you are here` on the viewed turn.

**Checks.** The row never covers the stream at any hover; 56 + 36 px of chrome at rest; arrow keys and
End move the view; nothing is sent while looking back (`flows.spec.ts`).

### N4 · Approvals queue

**From** `approvals-queue` (8.3), `badges-status`, `keyboard-first`. **Size L.** **Server:** the gate
policy must say whether an owner override exists for a risk class (`packages/kernel/src/approvals.ts`
`describeRule` / policy returns `ownerOverride?: boolean`); "Nudge Cy" has no kernel event (ship as
"open the team chat with @Cy prefilled" until it does, Decision 3).

**Files.** `apps/web/src/views/Approvals.tsx`, `apps/web/src/approvalsQueue.ts`, `apps/web/src/
styles.css` `.queuerow` block.

**What lands.** One flat list, oldest first; every row a sentence (agent and session in serif, the
call in a mono chip), the project, risk pills, votes and age on a second line; gates carry the one
gradient hairline (the "Release gate" pill is plain navy with apricot text, apricot edge in dark),
the `irreversible` pill, the two-segment quorum meter with "1 of 2 at 4+ · avg 4.0" in mono, amber only
where a vote is missing or the average is under the bar; the cursor row (W6) shows the compact rating
with "Approve with 4"; the action column carries the one verb the row waits for; Cy's row reads "waits
for the driver · Cy · away until 13:00" with Nudge Cy as its only action, and "Decide as owner" appears
only when the policy returns an override rule, saying what it does ("Approve for Cy · logged in your
name"); a quiet Done list; the aside with At a glance, the gates as meters and the keys; the filters
Needs you / Gates / Others / All where Others is the complement of Gates. Status words in `-ink`
tokens, never `--warn`.

**Checks.** Filter counts add up; the quorum meter has one width in the row and the aside; a decision
in the session folds the row here within one socket message (`flows.spec.ts`); the seven gradients on
the old board are one per gate row at most.

### N5 · Memory browser

**From** `memory-browser` (9.0). **Size L.** **Server:** a per-entry read log for "read in the last
hour" / "oldest still read" (today only reads per conflict side); ship the aside without those two rows
until it exists. Decision 1 (who may Keep) before the Keep buttons get a role check.

**Files.** `apps/web/src/views/Memory.tsx`, `apps/web/src/ui.tsx` `attribLine` / `MemoryLine` (one
attribution grammar: "added by *Bo* · session invoice-pdf-3 · commit 0c8d44 · Billing page", scope
last so it wraps), `apps/web/src/search.tsx` (memory hits reuse the row), `apps/web/src/styles.css`
`.memtools` / `.memrow`.

**What lands.** Scope segment (Org / Team / Project with counts) with picker, search and History
toggle; conflicts first as a two-sided notice (both quotes in serif, session · commit · scope under
each, "Keep this" under each side, "read by N sessions", the foot "Both can be wrong · Write the rule
yourself"); the resolved conflict folded to two lines with the loser struck through; entries as
attributed rows with the kind disc (summary disc and the aside's agents bar in `--rail` with an apricot
edge, so the screen has one gradient); the curator's report last; the aside with counts, who
remembers, and the scope tree with "1 open". "blocks Tax lines" in `--danger-ink`, not `--danger`.

**Checks.** The cursor row keeps `--ink-3` metadata ≥ 3 : 1 in dark (55 % wash, W6); the attribution
line survives 390 px; one gradient on the screen.

### N6 · Manager overview and the chart component

**From** `manager-overview` (8.3), `usage-charts` (7.8), `data-viz-style` (6.8, revise: the series
re-stepped inside Dress Blues' hue). **Size L.** **Server:** `GET /api/usage` must return the in/out
split per project, person and agent row (the charts are labelled "in + out" and must show it); a
forecast and the cache rows for the Usage page (N6b); a project-level budget is Decision 8 until then
the bars show branch budgets only.

**Files.** `apps/web/src/viz.tsx` (`StatTile`, one `Bars` component with stacked in/out marks, the
area chart, the table twin), `apps/web/src/views/Team.tsx` (the lede, needs-you cards, roster),
`apps/web/src/styles.css` `.stats` / `.chart` blocks (lines 1580–1776).

**What lands.** Serif h1 then `copy.team.summary` with the hot thing bold, counts medium, token figures
mono, one link; the range control top right driving every number; three needs-you cards with a stripe
by kind (apricot plan, gate stripe, contention in `--warn`, settled against `manager-overview`'s red);
stat tiles (label · value in **mono** · small unit · a detail line that splits the number; colour only
for a budget past 80 %; deltas in ink with a sign, coloured only against a budget); bar charts as
stacked in/out in navy and chocolate stepped at the family's saturation (near `#45527A` / `#8A4A3C` on
cream, lifted in dark, six checks re-run, texture as the second discriminator), the hand only for the
lone-series area chart, the hover readout replacing the row's value column so it never covers a
neighbour, a reading sentence and a table under every chart; gates with votes as avatar + number and a
dashed empty avatar; SVG stars; agents in the same roster grid as people with two-letter initials;
"Refresh" removed from the topbar.

**N6b · Usage page** (`SCREENS.md` §11): a new `#/usage` route in `apps/web/src/router.ts` and
`views/Usage.tsx` built from the same component: the sentence, five stat tiles with sparklines, tokens
by day as stacked columns with last week's wash, October against the budget with the dashed projection
and the 80 % hairline, by project / person / agent bars with avatars, the table with Copy as CSV, the
phone's 7-day chart re-laid. Size L on top of N6; server flag as above.

**Checks.** The six contrast checks from `data-viz-style` pass for both steps on cream and the dark
surface; `+18%` is the same colour on Usage and the overview; `prefers-contrast: more` / forced colours
show the texture; every chart has a `<title>`, `<desc>` and a table twin.

### N7 · Palette, search, shortcuts: the overlays as registers

**From** `command-palette` (7.3), `search` (7.8), `shortcuts` (8.5), `keyboard-first` (8.3),
`notifications` (the toast is N8). **Size L.** **Server:** search over messages, people and agents
(today sessions and memory only); "Keep this search" needs a saved-search notification path. Ship
search over what exists and hide the other kind tabs.

**Files.** `apps/web/src/palette.tsx` (`CommandPalette`, `fuzzyScore` highlight: `Ap<b>pro</b>ve`,
never eating a letter), `apps/web/src/search.tsx` and a `views/Search.tsx` page, `apps/web/src/
useShortcuts.tsx`, `apps/web/src/shortcuts.ts` (a `context` so the sheet can say what a key would do
now), the `ShortcutSheet` in `App.tsx`, `apps/web/src/styles.css` `.palette` / `.sheet` / `.kbd`.

**What lands.** The one lit surface over `--scrim`, no blur; selection as `--select-wash` plus
`--select-line`; matches as weight and ink (`--match` / `--rest`), never a background; one key cap
(22–26 px mono, 1 px line, 1 px drop; `.kbd.live` in the hand, `.kbd.pressed` in apricot) and one footer
legend ("↑↓ move · ↵ run · esc close", ⇥ where groups exist); ↵ only on the highlighted row; the
palette's scope chip and a release-gate row that shows its rating step ("Rate it first · Enter alone
sends 4 · Bo already rated 4"); the shortcuts sheet as a register (each session key says what it would
do right now, live rows apricot-washed, the "Would act now" legend as a key-cap swatch, `?` on the This
sheet row with a different you-pressed-this treatment); `a` on an off-page irreversible gate is a
two-step (first press lights the card and prints "`a` again approves · `esc` leaves it", second press
sends); rating keys and ↵ on the revisable plan stay one-step; the 364 px lane collapses to a chip row
under 1280. Mobile: every overlay is a bottom sheet with a handle (L3).

**Checks.** The first two palette rows read "Approve push origin main" and "Approvals queue"
(screenshot read before filing); `shortcuts.test.ts` covers the two-step and the typing guard;
`esc` precedence is toast → palette → composer.

### N8 · Notifications: one sentence at three distances

**From** `notifications` (7.5, revise), `desktop-tray` (the grammar table), `surfaces` carry-forward 3.
**Size M.** **Server:** `packages/server/src/notify.ts` titles are generic ("Approval needed",
"Agent finished"); they must become the grammar `who · verb · what` with a body `where, then what it
means for you`, a `tag` so a repeat replaces, and a `route` per item, because the toast, the banner,
the inbox row and the tray menu all read the same record.

**Files.** `apps/web/src/toast.ts` (typed toasts beside the text one; `MAX_SHOWN 3` kept, the overflow
becomes the navy tail), `apps/web/src/ui.tsx` `Toasts`, `apps/web/src/inbox.ts`, `apps/web/src/views/
Inbox.tsx`, `apps/web/src/notify.ts`, `apps/web/src/styles.css` `.toasts` block.

**What lands.** A crease by kind on the left, the serif who, the sans sentence, mono for the call;
decisions stay and carry `y` / `n` with the rating step visible, news drains over 8 s along an apricot
life line; the actions row on one line (`white-space: nowrap`, Open becomes an icon when tight); beyond
three, a navy tail counts what waits in the inbox; "Dee joins the circle." plays arcs-close once; the
inbox row is the same sentence; `(edited)` state on the notice when a decision lands (surfaces
carry-forward 2); the `y` / `n` collision with the approval notice resolved in favour of the on-screen
notice.

**Checks.** The stack never covers the composer; the dark board shot at 1:1 in sections; a repeat with
the same tag replaces rather than stacks; the polite toasts region announces approvals and gates once.

### N9 · Groups and chats

**From** `new-group` (8.8), `mention-flow` (8.5), `groups-list` (8.3), `chat-view` (7.8, revise: your
messages on the left), `members-drawer` (7.5, revise: inline results). **Size XL.** **Server:** the
Host role (`packages/chat`) is new; a live "name is free" check (today create and wait for
`group.created`); whether the list knows an agent is "answering" (a live event per group) or only the
open group does; Decision 5 (the rank a group role gives a mention). Ship with Creator / Member only,
check the name on create, and show "answering" only in the open group.

**Files.** `apps/web/src/views/ChatView.tsx` (958 lines; split the groups list, the stream, the @
completion, the members drawer and the new-group sheet into `src/chat/`), `apps/web/src/chat.ts`,
`apps/web/src/chatClient.ts`, `apps/web/src/styles.css` `.chatcol` / `.mention-list` / `.sheet.newgroup`
blocks.

**What lands.** Groups list: a lead sentence instead of a count, filter chips with counts, rows with
emblem (flat navy, not the gradient), serif name and purpose, the attributed last line, time, the
people | agents stack with a 2 px canvas seam and the status dot at the outer corner, chocolate unread
count, apricot `@n`, bell-off for quiet; the New group panel closed on this page. Chat view: human
messages left with "you" as a meta word and the warmer wash as the only sign; the agent reply as prose
behind a 2 px navy→chocolate rule with the 26 px avatar, live dot, serif name, owner in faint sans,
dot-separated meta with mono turn and an outlined "Open session" chip, never tool steps; three mention
marks (person on apricot-soft, you on solid apricot, agent on `--mention-agent` in serif with the
agent's corner); "New since you looked away · n" as the only warm rule; read markers as tiny stacks; the
@ completion with its header, query echoed in mono, matched letters chocolate, owner rows "not a match,
listed for the owner", the footer sentence. In the session the steer wears the origin tag "# billing ·
steered from the group" and the scope line "answers in #billing". New group: two halves with the live
preview, scope as rule cards, pick lists of one shape with the owner greyed, the warn-soft note, the
roster footer, "Create #proration"; no Team | Agent segment in the preview composer. Members drawer:
one add field whose results push the list down, role chips as a menu, inline Leave / Remove with the
confirm that names what stays, agent rows with owner · status · what it is on, the Changes ledger with
the mark for joins and a minus ring for leaves, "Never sent to the agents."

**Checks.** One screenshot per drawer state (picker, confirm, just-joined); the light chat shot taken
with the @ list closed so the typing line and read markers show; the rail's Chats count is one number
across the pages; the join toast "Tax lines joins the circle. Undo" plays arcs-close once and offers
Undo.

### N10 · Project page

**From** `project-page` (8.0), `agent-profile` (7.8, revise: in the shell). **Size M.** No server for
the layout; project-level budget is Decision 8; "Leave crew" for anyone vs owner or lead is the spec's
(owner or lead).

**Files.** `apps/web/src/views/Project.tsx`, `apps/web/src/styles.css` `.agentrow` block; a new
`views/AgentProfile.tsx` (route `#/p/:id/a/:agentId`) only after W5, using the header rule (serif
"Ana's agent", the session title as the rail card) and one Message / Open session pair.

**What lands.** Direction composer with the constrain / steer segment and direction chips (italic serif
mode tag, author, age, Withdraw on your own); agents by crew (hollow apricot ring, serif crew name,
mono claims), each row dot · serif title · owner-with-whom · italic line · token meter · status word ·
the one verb the row waits for (Rate, Pick for the lead, Replay; nothing on running rows); Leave crew
and Team up in the row overflow and crew header; the contention notice in the contention-handoff
grammar with the stripe in `--warn`; the topbar's New session removed; the spend card's bars in the
hand (single series); the joining wash (apricot-soft block with the mark and a serif sentence) for
"joined the circle today", with a dark variant that keeps the pulse. Rename the fixture crew so it does
not collide with the sibling Checkout project.

**Checks.** One New session on the screen; the five-column row holds for running, awaiting, held,
idle, closed; no word in `--warn` on cream.

### N11 · Team look editor

**From** `team-look-editor` (7.0, revise), `team-emblems` (7.25, revise: crest at 48+, dot below).
**Size M.** No server (`PUT /api/teams/:id/theme` as today); Decision 10 (warn vs block on a low
check: warn, say who will struggle).

**Files.** `apps/web/src/views/TeamLook.tsx` (`checksOf` gains the dark column and the "two arcs apart"
row computed from `contrast()`, never typed; fine / low words, bar widths, the fix line and the save
bar's count all derive from the result; `toFixed(1)` vs `>= 4.5` reconciled), `apps/web/src/theme.ts`
(`TEAM_PRESETS` as tiles that are the look in miniature), `apps/web/src/styles.css` `.teamlook` /
`.look-preview` (add the `.look .prail .new` reset; the preview painted only through `--p-*`).

**What lands.** Colours card with three preset tiles and four hex rows; the checks table (rows = what
must stay readable, columns = cream and dark, each cell a mono ratio + word + 4 px bar with the minimum
tick); a fix line naming the nearest passing hex with a one-tap Use; the Mark card dressing the ring
only (centre dot / emblem / dot only; the emblem is a crest at 48 px and up and the centre dot at 32 and
below, so the rail, avatars, pills and toasts identify a team by its two arc colours); the live preview
as a slice of the shell; the changed-row grammar (apricot wash + CHANGED tag) and a save bar that counts
and names changes and says who gets them and when. Team accents change glows and selection, never the
brand mark's arcs (`--team-highlight` never follows the accent).

**Checks.** `#A8623F` vs `#E4B98C` prints 2.6 : 1 low; three low checks on the judged draft; the
preview's New session renders like the rail's; `aria-checked` on the chosen preset.

### N12 · Avatars, icons, empty states

**From** `avatar-system` (7.3, revise), `icon-set` (7.8), `illustration` (8.0), `empty-states`
(unjudged, adopted through `illustration`). **Size M.** No server.

**Files.** `apps/web/src/ui.tsx` `Avatar` (two shapes: circle = person, rounded square with the tight
bottom-left corner = agent; the true mark inset from 40 px, only the apricot centre below; state as a
`.pr` dot, ring or fade, never a tint; `--edge` from the ground; stack order driver → people → agents,
four then +n), `ICONS` (icon-set's manifest: 16 grid, 1.5 stroke, round caps, dots as stroked circles,
icon colour = text colour, 14 px floor for crew and group with person / agent + count below it),
`apps/web/src/empty.tsx` (the twelve spots as the arcs moved, dashed or shortened in four inks, no disc
behind a spot on cream, the page's sentence as the only caption; on dark use apricot-deep and cream,
never `#B27A66`).

**Checks.** Agent avatars at 16–80 from one variable; `.avatar.agent` no longer collides with the rail
card; no icon heavier at 12 px; the empty Billing page, approvals, memory, branches and inbox each show
their spot and sentence.

---

## Later · frames, surfaces, onboarding

### L1 · Desktop shell: window, tray, compact

**From** `desktop-window` (7.8), `desktop-compact` (8.3), `desktop-tray` (7.0, revise), `first-run-
desktop` (7.5). **Size L** (web) + **M** (Rust). **Server:** `GET /api/notifications` items must carry
`who · verb · what`, `kind: "mention"`, the route and an age (N8's record), plus the last five sessions
and rooms for Quick open (`GET /api/recents` or the client's `recents.ts` mirrored to the shell).

**Files.** `apps/desktop/src-tauri/tauri.conf.json` (default window 1280×840; macOS `titleBarStyle:
"Overlay"` / hiddenInset with the rail from the top edge; Windows `decorations: false` with a 36 px
`--rail` titlebar drawn by the web app), `apps/desktop/src-tauri/src/main.rs` (`build_menu` lists items
not counts: serif who · verb · muted what · age, five per section then "and N more… in the queue";
Quick open; Pause with a moon on the icon; Open ⌥⇧H / Ctrl+Shift+H; Quit; the badge counts approvals +
handoffs only and never mentions; notifications with two buttons at most and the OS's own button
style, a decision under a ratings rule opening the notice rather than approving blind; `tag` replaces),
`apps/desktop/src/bridge.js` + `apps/web/src/shell.ts` (`Shell.items`, `onTray` routes, action events),
`apps/web/src/App.tsx` + `styles.css` (the brand row dropped 32 px on macOS with the title row as the
drag region and `no-drag` on its buttons; the Windows titlebar with mark, "Henosis" only and 46×36
caption buttons; breakpoints written once: 1180 rail folds to 72, 960 compact, 720 drawer overlays,
480 phone, with 40 px hysteresis and `[` `]` pinning the choice; the compact topbar drops words not facts;
the composer hint names the platform's keys and says the window closes into the tray),
`apps/web/src/views/FirstRun.tsx` (the four mark states as step markers, the tray taught by dropping it
open, the "Already waits for you" wash card with avatar + mono tool name, `--badge` for the Dock red).

**Checks.** The OS keeps its own colours (menu hover, taskbar underline, notification buttons, Dock
badge); the hover card never covers the live message; Share, Team and Details do not drag the window;
shots at full colour, the whole board in dark.

### L2 · Onboarding: welcome brief, tour, bad moments

**From** `welcome-agent` (7.5, revise), `tour` (7.0, revise), `error-states` (7.0), `onboarding` and
`share-invite` (unjudged, adopted where `first-run-desktop` and `email-digest` carry the pattern).
**Size L.** **Server:** `session.briefed` (a standing brief at join, `packages/fleet/src/brief.ts` +
the log) for "What it was told"; the reconnect attempt count and next delay in the snapshot; Decision 4
for the composer's offline promise (the app already has `apps/web/src/offlineQueue.ts`, which holds
directives in order; the open question is the kernel's safe-point rule, and the copy must say exactly
what the queue does until it is decided: "Not sent · kept here until you are back · Resend").

**Files.** `apps/web/src/views/SessionView.tsx` (the arrival card with facts, the hearing rule, Say
hello / Open session / What it was told; the drawer's navy brief paragraph with `flex: none`, then the
ledger sections with the mono "as the model reads it" fold), a new `src/tour.tsx` (five coach marks on
the look-here layer: navy dim .52 / near-black .62, 3 px apricot + 10 px soft halo on one target, the
five-segment ring with a ghost centre closing step by step; an arriving approval **ends** the tour, lifts
the dim and gives the approval card the halo; reopenable from Settings), `apps/web/src/reconnect.tsx`
and `views/SessionView.tsx` (the bad-moment sentence: what happened with a time, what still works, what
Henosis is doing, one chocolate action; "as of HH:MM" on stale things, presence to 45 %, grey for
network, amber for waiting, red only for a human no or a conflict; the mark loses its centre only when
the server is gone), `apps/web/src/views/ShareSheet.tsx` (the invite as the digest's hero: "Cy, *Bo*
invites you to the circle.", people and agents in two matching boxes, the agent's `henosis join` line).

**Checks.** The brief paragraph renders in both themes (a card with `overflow: hidden` in a flex column
carries `flex: none`); stripes and border-images never take the gradient; the tour never traps focus
over a live control; the composer's chip says what the code does.

### L3 · Mobile: one frame, one sheet, one needs-you number

**From** `mobile-rail` (8.8), `mobile-approvals` (8.8), `mobile-session` (8.5), `mobile-manager`
(8.3), `mobile-chat` (7.8, revise), `tablet` (unjudged). **Size XL** across `apps/web` (the Capacitor
shell loads the same `dist`). **Server:** none for the screens; the one needs-you number (approvals I can
still vote on + handoffs offered to me, never mentions) must be computable from `/api/notifications` or
a `GET /api/glance` (also the widgets' endpoint, L5); push payloads (`apps/mobile/src/push.ts`,
`POST /api/push/subscribe`) carry the same figure for the app badge and the lock screen.

**Files.** `apps/web/src/App.tsx` + `styles.css` (the phone's top block: 48 px status area + 44 px bar on
`--rail`, serif title 19–22 with the 12 px subtitle whose status word is `--ok` dark, a 40 px right
control on `--rail-active`, the optional strip; a four-tab bar Sessions · Chats · Approvals · Me as the
frame with the needs-you count on Approvals and mentions on Chats and no badge on the menu button; the
332 px rail drawer from Sessions, the desktop rail at 44 px rows with the you row pinned, an `--edge`
hairline in dark, the crew's claims folded by default in the full Team sheet), a `src/Sheet.tsx` (one
bottom sheet: `--surface`, 26 px corners, 40×5 handle, 16 px gutters, `--scrim`, half / full detents
with the drawer head, a 50 px full-width primary beside a quiet pill, one line of fine print; used by the
Team panel, the approvals sheet, the rating sheet, the palette, the shortcuts sheet and the members
drawer), `src/stream/StarTiles.tsx` (five-up 48–50 px grid; the pick solid apricot with a chocolate star
and the team glow; "Good · 4 of 5" in italic serif; "Approve with N"), `views/Approvals.tsx` (the gate
row's phone form and the filters), `views/SessionView.tsx` (a "1 waits for you" apricot chip in the
strip when the pending gate scrolls out of view; the Team pill merged into the Team button; the mark on
the screen), `views/Team.tsx` (the sentence as a 23 px serif titlebar on navy with the needs clause in
apricot and a pulsing dot, green when nothing needs you, folding to the subtitle on scroll; bars
re-hued to the pages rule), `views/ChatView.tsx` (viewer Ana; "Agents replied" as a filter chip; no
"Enter sends").

**Checks.** Every phone screen at 390×844 1:1; the same needs-you figure on the tab, the manager's
sentence and the push badge; counts as apricot 20 px discs with mono chocolate numbers; one bottom
sheet implementation (`grep -c "border-radius: 2[468]px" styles.css` finds the sheet once).

### L4 · Print and export

**From** `print-export` (7.8, revise), `export-evidence` (unjudged). **Size M.** No server
(`packages/server/src/export.ts` and `henosis replay --verify` exist).

**Files.** `apps/web/src/views/ShareSheet.tsx` or a new `views/Export.tsx`, `apps/web/src/print.css`
(`--paper-*` tokens with `color-scheme: light`; the cream mark variant on paper; a dotted agent arc in
one ink through a `stroke-dasharray` variable; serif names with the role at that moment; mono ids a
size smaller; kernel rows in one green, masked secrets in one amber; rows never split; omissions in one
italic line; the verify line and signature on both documents).

**Checks.** Every mark on the A4 sheets renders the cream variant at 3× (not a navy coin with a black
dot); page CSS colours the mark only through custom properties.

### L5 · Widgets and the glance endpoint

**From** `widgets` (7.5, revise). **Size M** web + native work outside this backlog. **Server:**
`GET /api/glance` (decisions I can still make, the top gate with its quorum, agents running, tokens
today) and an App Intent that sends `DEFAULT_RATING`.

**Files.** `apps/mobile/` (native widget targets, not in this repo yet), `apps/web/src/api.ts` (the glance
client for the menu-bar panel in `apps/desktop`). The mark is the disc variant under 24 px; every small
widget's figure in mono; the over-budget line's "· nothing stops" moves to the foot.

### L6 · Surfaces outside the window

**From** `email-digest` (8.25), `slack-templates` (7.25), `pr-template` (7.25), `pricing-page` (6.5).
**Size M** each. **Server:** no email exists (`notify.ts`); no GitHub adapter exists; both are new
packages. The Slack join line ("Dee's agent joins the circle" with the emblem in template 01's thread)
is `packages/slack` after W7. The PR comment is plain Markdown (bold names, ★★★★☆ glyph stars, ✓ in the
table) and the ladder says "4 or above". The pricing page is marketing (`docs/08`), rebuilt only after
Decision 9 defines the seat by role (driver or owner) and makes the estimator and the invoice one ledger
($254.40 with the 20 included hours).

**Shared rules** (surfaces carry-forward): every off-platform surface opens with `copy.team.summary`;
one message edited in place; the five-part anatomy (emblem · product name · sentence · context line ·
actions, link last); the needs-you card with a stripe by kind; votes as rows; estimate → actual as
`est 44k → 61k, +38%`; mocks render what the host renders.

### L7 · Measurements and leftovers

- The blurred-disc wash vs the radial gradient: paint cost on the fleet board with 40 rows
  (`loading-screens` open question; W1 ships whichever wins).
- The team-colour crossfade's 500 ms repaint of every `--team-*` reader on route change (`motion-spec`).
- `ring-draw` keyframes: kept for the tour's five-segment ring (L2) or deleted.
- `--accent-ink` in dark (`#CAA49B`, SYSTEM.md §20) confirmed on the session page.
- Search: "All" as a group cut or a ranked list with kind pills (N7 ships the group cut).
- Replay: whether the Team panel and the token chip fold while looking back (N3 ships them unfolded).

---

## Server changes, collected

| Item | Package | Change |
|---|---|---|
| W7 | `packages/slack` | bare Approve sends `DEFAULT_RATING` (4); rating in `value` under one action_id; shared constant moved out of `apps/web` |
| N1 | `packages/kernel` approvals | gate notice carries the plan step it waits at |
| N4 | `packages/kernel` approvals | policy returns whether an owner override exists per risk class; a nudge event (or none, Decision 3) |
| N5 | `packages/memory` / server | per-entry read log for the aside's "read in the last hour" |
| N6 | `packages/server` usageApi | in/out split per row; forecast and cache rows; project budget (Decision 8) |
| N7 | `packages/server` | search over messages, people and agents; saved searches |
| N8 / L1 | `packages/server` notify | items as `who · verb · what` + body + tag + route + age; `kind: "mention"`; recents for Quick open |
| N9 | `packages/chat` | Host role; name-free check; per-group "answering" event; mention rank (Decision 5) |
| L2 | `packages/fleet` + log | `session.briefed`; reconnect attempt and delay in the snapshot; the offline safe-point rule (Decision 4) |
| L3 / L5 | `packages/server` | `GET /api/glance` and the needs-you figure in push payloads |
| L6 | new packages | email digest, GitHub adapter |
| W3 | `packages/kernel` replay | total event count sent up front (optional) |

## Decisions (from SCREENS.md Appendix C) and the item that waits on each

1. Memory: who may **Keep this** → N5's role check.
2. Approvals: does one deny hold an otherwise granted gate → N1's tally sentence.
3. Owner override on a driver-only approval, per risk class → N4.
4. Composer offline: hold and replay with a safe-point rule, or "Not sent · kept here" → L2 (ship the
   honest copy until decided).
5. Does a group role lift a mention above contributor → N9's origin tag.
6. Policy per project or per team → Settings (`views/Settings.tsx`, unjudged; no item above changes it).
7. May a crew span projects → L2's welcome brief fixture.
8. Project budget → N6 / N10 meters.
9. The pricing seat is driver or owner → L6.
10. Team look: a low check warns and saves → N11 (built as warn).
