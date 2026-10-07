# Henosis · the screens

The design wave produced 86 explorations in `design/henosis/explorations/`; twelve judge panels scored 60 of
them (`explorations/_judge-*.md`). This file is the synthesis: for every screen the app has, the direction
we build, the exploration it is built from, the layout in words, the states, the copy, and the judge's
verdict with the one fix that must land before the screen ships. Where a screen's owning exploration was
not judged (plan-card, release-gate, approval-notice, rating-control, composer, inbox, settings,
onboarding, share-invite, empty-states, contention-handoff, branch-unite, agent-reply, team-messages,
roster, timeline, token-optimisation, cost-forecast, export-evidence, tablet) it is marked **unjudged**
and is adopted only where a judged winner already carries the same pattern or the judges' carry-forward
asks for it.

Verdict key: **keep** = build it as drawn plus the one fix; **revise** = the idea is right, redraw before
building; score = the panel's overall mean out of 10.

Sources read: `BRIEF.md`, `tokens.css` (v5), the twelve `_judge-*.md`, every winner's `notes.md` and
`index.html`, and the light, dark and mobile PNGs of the top explorations.

---

## 0 · What is true on every screen

These are the carry-forwards the panels agreed on independently. They are stated once here and assumed
in every section below.

**The shell is drawn once.** Every desktop page uses the rail from `rail` (navigation panel, 7.5 keep)
and the topbar, 780 px column and 340 px drawer from `session-view` (session panel, 8.3 keep). The pages
panel found three rail orders and two card-naming rules across six pages and ruled: *"The rail is one
rail. New session, AGENTS (crews first, session-titled cards), then the project section (Overview, Usage,
Inbox, Approvals, Groups, Memory); the 'me' row last."* `project-page` and `agent-profile` reorder it and
must not. The navigation panel's rule is the same from the other side: *"Pages must use the rail
exploration's rail (card anatomy, serif project names, no hairlines between cards, the you row with role),
not a local redraw."*

**Four colours, four jobs.** Dress Blues `#2A3244` is the frame (rail, titlebars, the dark canvas), cream
`#FBF7F1` is the page, Chocolate Fondant `#56352D` is the hand (every primary action), Apricot Illusion
`#E2C4A6` is the pulse (live things, the centre dot, selection, team messages). In the chrome apricot has
exactly two meanings (navigation panel, carry-forward 1): a **solid apricot count** means something waits
for you; an **apricot wash plus hairline ring** means where you are or what Enter will do. Nothing else in
the chrome is apricot. System panel 2: *"The dot carries the colour, the word stays ink."* Status words are
never set in `--ok / --warn / --danger`; if a coloured word is ever needed it takes the `-ink` tokens.

**One gradient per screen**, and it is the rail's New session button. Stripes, border-images, emblems and
avatars do not get the gradient (onboarding panel: *"The gradient count includes the rail"*). The release
gate's stripe is the one exception the session and mobile panels allow, and the "Release gate" pill is
plain navy with apricot text, never a second gradient.

**Three fonts carry three kinds of thing in a row.** Instrument Serif for anything with a name (people,
agents, crews, sessions, groups, "Goal", "to the team", "Cy joins the circle"); JetBrains Mono for keys,
counts, commands, spend and ids; Instrument Sans for the row itself. The session panel: *"Named things are
serif, everywhere … together with the navy frame and apricot as a live colour rather than an accent, this
is what keeps the screens apart from claude.ai's cream-and-serif register."*

**The mark** is `design/mark.svg`, built from `brand-board`'s `<symbol>` cuts (`#mark`, `#mark-bare`,
`#mark-small`, `#mark-tiny`, `#mark-mono`) and coloured only through `--mark-disc / --mark-arc-a /
--mark-arc-b / --mark-dot` on the `<use>`. Person = chocolate, right, 12→6; agent = apricot, left; centre
= the lightest colour present; the word is "centre", never "bead". Size ladder: default from 32, small cut
20–31, tiny below 20, no swing below 24, emblem only at 48 and up, the disc variant under 24 everywhere
(mobile panel, widgets fix). Joining plays `arc-a / arc-b / dot-in` at 1.8 s with the 15 % hold; the centre
appears only after the ring is one.

**Dark is re-weighed, not inverted** (session-dark, dark-mode, rail): `--rail #10141C` < canvas `#1A202C`
< surface `#242C3C`; depth from a 1 px `--edge` top highlight and hairlines instead of shadows; cream ink
`#F0EAE0` not white; apricot as hairline and 9–16 % wash; a lifted chocolate hand `#7A4B3E` for primaries,
links and the goal label so hand and pulse stay distinct at night; the brand gradient lifted one notch
(`#3A4661 → #7A4B3E`); the gate stripe apricot→chocolate; one dark status triplet `#9BC88F / #E2B06A /
#E2847A` with 18 % softs. Six panels asked for that triplet; it is the wave's most repeated bug. The focus
ring in dark is a 2 px cream `--ink` ring with the apricot halo outside it, never apricot (accessibility).

**Three clocks, two curves, one guard.** 120 ms hover/focus, 200 press/toggle, 320 arrive/settle; plain
ease for colour and shadow, the mark's `cubic-bezier(.3,.9,.3,1)` for anything that moves; every end state
survives Calm and reduced motion under one `prefers-reduced-motion` + `[data-motion="calm"]` guard
(motion-spec, micro-interactions). Four loaders, each with a meaning (loading-screens, brand panel,
8.75 keep): arcs-close = the app joins you; orbit-converge = you join people, page centre only; weave =
rows arrive; shimmer = words arrive. Loading is never a blank page; after 8 s a cause, after 30 s one
chocolate action.

**Keys live on the thing they act on** (keyboard-first, 8.3 keep): 20 px mono caps with a hairline and a
1 px drop inside the button at the right; `.kbd.live` in the hand for the one key that acts now; one mode
chip ("Keys live" / "Typing"); letters only work when nobody is typing; an irreversible action in another
session takes two presses.

**The cast and the names.** Ana Moreau (lead, owner of Billing page), Bo Lindqvist, Cy Okafor, Dee (the
newcomer); projects Billing page and Checkout; sessions titled by their work (Invoice PDF, Tax lines,
Proration); the agent is "Ana's agent" in the stream and its session title is the rail card. One spelling
everywhere (surfaces panel caught "Ana Ferreira").

**The voice.** Calm, specific, warm, present tense. A sentence replaces a count wherever a page opens
("Six things need you. Two wait on a rating, and Ana is holding the baton out."). Never "AI-powered",
never "bot", never "loading".

---

## 1 · Rail

**Direction.** `rail` (navigation panel, **7.5 keep**), with the agent card from `agent-card`
(**7.5 revise**, reshoot only) and the collapsed form from `desktop-compact` (desktop panel,
**8.3 keep**). The judge: *"The role discipline for apricot is the clearest in the set and should be the
rule for the whole system."*

**Layout.** 296 px of Dress Blues from the top edge, 14 px padding. Order, top to bottom: brand row (mark
+ "Henosis" in serif 24, collapse chevron at the right); **New session** on the one gradient; **Search or
jump to** field with `⌘K` cap; **Inbox** and **Approvals** with solid apricot counts (mono chocolate
numerals, 20 px discs); **AGENTS** header with "4 LIVE" at the right, then crews first (hollow apricot
ring, crew name in serif apricot, "Ana and Bo"), their cards indented, then solos; the project section
(Project / Overview, Usage, Inbox, Approvals, Groups, Memory with its conflict count, chats with unread);
the **me row** pinned last: avatar, serif name, "owner · driving" or "Payments · owner", a gear that opens
the account menu.

**The agent card** (one component drawn once, used by rail, palette, search, project page and the phone
drawer): head = 8 px status dot · serif session title · Team pill (apricot, chocolate text) or Solo pill
(outline); lead = italic serif verb phrase with the named thing in apricot italic ("Writing *proration.ts*
· step 3 of 4", "Waits to *run db:migrate* · release gate", "Paused · *plan waits for one rating*"); foot =
avatar stack capped at three with the driver ringed in apricot-deep, "with Bo", and spend in mono at the
end of the line with a 2 px budget hairline that warms past 80 % and goes coral past 100 %. The active card
sits on the apricot wash with a 1 px inset hairline and a 3 px apricot bar in the gutter.

**Collapsed (72 px, below 1180).** Same order as icons: mark, gradient `+`, search, Inbox and Approvals
with corner counts, the project initial in serif apricot, one avatar per agent with the status dot at the
corner and the active one ringed, Memory, Chats, you, expand. The hover card opens in `rail-2` with the
serif session name, Team pill, italic doing-line, rating count and mono spend, after a 400 ms rest, and
never over the live message (desktop panel's one fix).

**States.** One row, four states: rest in `rail-muted`; hover on `rail-2` with the icon warmed to apricot;
active on the apricot wash with the hairline inset; focus as the team glow. Six dot drawings for the
agent: running (green `#9BC88F`, pulses, the only thing that moves), awaiting approval (amber `#E2B06A`
with halo), blocked (coral `#E2847A`), paused (grey disc), idle (hollow ring), closed (faint ring at 62 %
opacity). Counts: never shown at zero, cap at 99+, pop once on change and stay still in calm mode. A
pending badge in mono on amber beside the name when approvals queue while running.

**Copy.** "New session", "Search or jump to", "AGENTS · 4 LIVE", "Invoice rollout · Ana and Bo",
"Solo", "Team", "with Bo", "owner · driving", "#billing · Cy's agent answered". Account menu: Theme
(Auto / Light / Dark), Notifications ("on while hidden"), Calm mode, Team look ("Payments"), Shortcuts
(`?`), Sign out. The rail's own empty state: "No agents running… appears here" (empty-states, unjudged).

**Fix before build.** Adopt `--rail #10141C` and `--rail-2 #1A2030` for dark so Dress Blues stays the frame
at night; let the account menu's Theme segment read the live theme (it lit "Light" in the dark shot); drop
the decorative ring on New session or move `N` into the tooltip. From agent-card: promote the six dot
drawings and the four status hexes to tokens so rail, palette and search stop re-declaring them. Open
question for the founder: should a project fold its agents when it is not the active project?

---

## 2 · Session

**Direction.** `session-view` (session panel, **8.3 keep**) for the stream; `session-dark` (**8.0 keep**)
for the night; `token-meter` (**8.3 keep**) for the title-row chip; `replay-scrubber` (**8.3 revise**) for
time travel; the unjudged `agent-reply`, `composer`, `team-messages` and `contention-handoff` for the
parts the judged pages already draw the same way. The judge on session-view: *"The session as a room …
Every role is honoured and only once."*

**Layout.** Rail · 780 px cream column · optional 340 px drawer. **Title row**: serif title ("Billing
page") · status dot with turn ("Running · turn 7") · Team pill "Team · with Bo" · the token chip (mono
"12.4k tokens", faint percent, a 3 px hairline with the 80 % tick, colour only when the budget turns) ·
presence stack with the driver ringed in apricot · Share · Team (count) · Details; Team and Details light
with `--apricot-soft` when open. The stream opens at the latest moment so the thing that needs you is the
last thing above the composer.

**The three message shapes** (locked by the session panel):
- *Human*: white bubble, `align-self: flex-start`, soft shadow; meta = serif name, mono scope chip
  (`goal`), time at the right; an italic serif "Goal" label inside the bubble on the first message.
- *Agent*: no bubble; serif name "Billing page" with "turn 7 · step 3 of 4" at the right; prose at
  15.5 px; a step grid under it (icon · mono verb and path · mono result on the right · chevron), the live
  step on the apricot wash with the two-strand weave and "now"; a navy output block that is the deepest
  surface on screen in both themes. From `agent-reply`: words, deeds, words; the verb is the tense of the
  state (Read / Wrote / Ran, Running, "held at the release gate", "Then: write …"); a failed step opens
  itself with the one ✗ visible; a finished turn folds to an icon trail, a summary and a mono cost.
- *Team*: apricot wash with a 3 px apricot-deep left edge, no shadow; meta = avatar, serif name, "to the
  team" in italic serif, time. Never reaches the agent.

**Right-hand meta rule.** People carry a time; the agent carries "turn N · step k of m"; the viewed turn
in replay carries "turn N · time · you are here".

**Composer** (`composer`, unjudged; its chip grammar is what every judged page draws). One field; the
Agent | Team segment decides who hears you; a mono chip beside it always states how the next send lands
("steer · goal", "constrain · tax-lines", "scope tests"); a popover only edits what the chip says. Team
mode: 14 % apricot wash on the field, the Team segment filled apricot, an italic "to the team" with the
people's avatars. Send is the chocolate circle. Hint line under the field: "Enter to send · Shift+Enter
for a new line · ? for shortcuts · as Ana, owner, driving"; in Team mode "Enter to say it · kept in the
session log, never sent to the agent · as Ana"; while a plan waits "Every tool call above read is refused
until the plan is approved · as Ana, owner, driving"; during a live step "The agent is running tests ·
what you send now reaches it when the step ends". Offline the field never locks: the send becomes a
clock and an amber chip says what happens to the draft (see §19, error-states fix).

**Time travel** (replay-scrubber). A row under the title bar: one dot per turn on a hairline, plan steps as
spans above it reusing the plan card's chip states, the viewed dot ringed in apricot, "now" pulsing with a
"NOW" label set in ink with an apricot dot beside it (apricot-deep on cream was 2.3 : 1), the release gate
as a hollow diamond. Resting form 36 px (dots only); grows to the 64 px track only when pinned or viewing.
The hovered turn's preview lives in the left label ("Turn 8 · 09:44 · Bo steers"), never in a tip under the
track. The stream folds to that turn and ends at a dashed "The session goes on · 6 more turns to now" edge
with quiet future chips ("turn 6 · tests pass", "turn 10 · release gate"); the composer goes read-only
with "Nothing is sent while you look back" and "Viewing the past · Return to now to steer the agent"; the
only action on the row is a chocolate **Return to now**.

**States.** Running; awaiting approval (the gate above the composer, §5); plan waiting (§3); a contention
(`contention-handoff`, unjudged, adopted by project-page and inbox): amber stripe, serif "Two directions
for `proration`.", the rule line naming who picks, two numbered direction cards whose numbers are the keys,
"2 · yours" ringed with Withdraw, the agent's "What I see: …" note, and the resolved divider "Bo picked
Cy's direction for proration"; a handoff: apricot stripe, the offerer's quote, a three-card brief, the
baton drawn as two avatars with a dashed lane, Accept / Decline, closing to "Bo has the baton"; joining:
"Cy joins the circle" as an italic serif divider with the 30 px mark playing arcs-close; reconnecting:
one grey line under the title row (§19); replay (above); dark (session-dark).

**Copy.** "Goal", "to the team", "Cy joins the circle", "turn 7 · step 3 of 4", "step 3 of 4", "now",
"Steer the agent", "Steer, constrain, or ask…", "Bo has the baton", "Two directions for `proration`.",
"until Ana picks one · you own this session, so you can too · policy block", "Return to now",
"Viewing turn 5 of 11".

**Fix before build.** Session-view: the gate notice and plan step 4 are one event shown twice; put
"step 4 of 4 · Migrate stored invoices" on the notice and make the plan's pending row point at the gate.
Token-meter: replace the turning ring in the chip with a pulsing 8 px apricot dot and let the hairline's
weave be the only "spending now" motion; drop "saved ~4.4k" until the spec records a price. Session-dark:
add the lifted chocolate hand and fold its knobs (`--edge`, `--out-bg`, `--team-wash`, `--live-line`,
`--pill-team-bg`, `--gate-stripe`) into tokens.css. Replay-scrubber: the resting form and the label
preview above. Agent-reply, composer, team-messages, contention-handoff were not judged: build them only
as far as session-view, project-page and inbox already draw them.

---

## 3 · Plan card

**Direction.** `plan-card` (**unjudged**) is the ledger; its shape is already the one `session-view`
(8.3 keep) draws in the stream, `keyboard-first` (8.3 keep) draws with its rating keys and
`mobile-session` (8.5 keep) folds to one line, so it is adopted with the judged pages as the evidence. The
session panel: *"The plan ledger: used beside estimate (green under / amber over), totals against the
budget bar, rater chips with stars, 'by the team's ratings' in green, the soft-budget sentence in the
foot; budget counts input + output only."*

**Layout.** A white card with a 4 px stripe on the left edge that carries the status before the words.
Head: "Plan · 4 steps" in serif, "proposed on turn 3", the status word with its dot at the right. The goal
in reading type with the italic serif "Goal" label, then the agent's one-line reason. Step rows on a grid
of ring · title + detail · risk pill · actual · estimate: the ring is a hairline number when pending, an
apricot pulse when running, a green check when done; the risk word as a pill (read neutral, write
apricot, exec navy wash, external amber, irreversible red); actual in ink ("3,640 · so far" in chocolate
while running, amber never red when over), estimate faint mono with a tilde. The totals meter: actual
fill, the estimate as a tick labelled "est", caption "9.9k of 40k". Rating row: "Your rating" with five
stars (§4 control), a note field, and at the right "1 of 2 ratings · 4.0 average · waiting · needs 2 at
3+" in mono. Raters as chips (serif name, mini stars, the note in quotes); people who have not rated as
dashed chips. Decisions: **Approve now** (primary, only while proposed), Ask to revise, Reject (ghost in
danger ink), with one sentence under them saying what each does to the agent.

**States.** Waiting for ratings (amber pulse in the status); Approved / running (green stripe, the running
step counting); Done (green ledger, "2,380 under · 14 % under estimate"); Revision asked (dimmed, grey
stripe, "Replaced by a newer plan" with a jump link). The irreversible step's detail says "waits at the
release gate" so the plan and the gate point at each other. On the phone: "Plan · 3 of 4 steps · 11.9k of
13.2k est." with four step dots, opening the full card.

**Copy.** "Plan · 4 steps", "proposed on turn 3", "Waiting for ratings", "Approved", "1 of 2 ratings ·
4.0 average · waiting · needs 2 at 3+", "2 of 2 ratings · 4.5 average · approved by the team's ratings",
"approved by Ana" (owner override, serif), "keep step 4 behind the gate", "Approve now overrides the
ratings; the agent starts at step 1. Until then every tool above read is refused.", "Ask to revise stops
the agent after this step and brings a new plan that supersedes this one."

**Fix before build.** Keyboard-first's rating keys (`1`–`5` under the stars, `↵` printed as "sends 4
and approves") stay one-step because a plan is revisable. Open: should "Approve now" carry the owner's
own rating so the ledger stays complete? Should a superseded plan collapse to its head?

---

## 4 · Approvals (the notice in the stream, and the rating control)

**Direction.** `approval-notice` and `rating-control` (**both unjudged**) for the ordinary exec / external
approval and the one star control; `badges-status` (system panel 2, **7.5 keep**) for the status
vocabulary; the behaviour of the control is proven on the judged `approvals-queue` (8.3), `release-gate`
pages and `mobile-approvals` (8.8). The surfaces panel settled the default: *"`DEFAULT_RATING = 4` is the
product's … no surface pre-selects a number with a primary colour."*

**Layout.** One sentence a person can answer with one press: the agent's name in serif, the verb, the
argument in mono, the risk as a pill; then a second line of three clauses, rule · what it means for you ·
where the agent is ("Needs one contributor or above · You can approve, Bo · the agent waits at step 2").
The crease colour is the class: apricot for exec, apricot-deep for external, the navy→chocolate stripe
only for a release gate. Stars folded to the right at rest (16 px, unlit, "Rate it"); the first pick
unfolds the full control. Buttons: Approve (primary; "Approve · 4" once a star is picked), Deny, and for a
reader who cannot vote "Nudge Ana" and "Take the baton" instead of a greyed Approve.

**The rating control** (one control everywhere a vote is taken): five stars in a single tab stop, a serif
italic word under the cursor coloured by level (Not yet, Risky, Fine, Good, Ship it), a hairline tick
after the third star under a ratings rule, preview lighter than the pick (apricot over apricot-deep),
hover never changes the value; keys: arrows preview, `1`–`5` jump, Enter picks, `0` clears, Esc drops the
preview; roving-tabindex radiogroup whose accessible name is "4 of 5, Good". Full size on the plan card
and the gate, compact in the queue, inbox and palette. Stars are SVG; the Unicode `★` is retired (pages
panel).

**States.** Pending; your vote in (stars read-only, the drawn check, the quoted note, "Change to deny"
still live); granted (thins to a divider: check that draws itself, name, number, note); denied (never
folds; the reason in danger ink); viewer ("a voice, not a vote", greyed stars, who can rate and whom to
ask); low-pick nudge at 1 and 2 ("Say what worries you") that asks for a note without blocking; after the
third consecutive grant the stream folds them: "6 approved between 10:41 and 11:04 · Bo, Cy · 5 exec,
1 external · Show". The latest pending approval also sits as a rail-coloured strip above the composer
("2 approvals wait · `g a`").

**Copy.** "Ana's agent wants to run `pnpm db:migrate` on staging.", "needs a contributor", "You can
approve, Bo", "That is you, Ana", "Ana decides", "Rate it", "Approve with 4", "4 if you leave it",
"Approve without a pick sends 4", "a 3 is a voice, not a vote".

**Fix before build.** Status pills obey rule 2 in both themes: ink words on the tinted ground, the dot
carrying the colour (badges-status fix); the dark status lift is the one token triplet. The `y` / `n` keys
proposed on the notice collide with the toast's; the focused notice wins. Open: the kernel accepts
`rating` only under a ratings rule; a "voice" on exec votes needs a decision.

---

## 5 · Release gate

**Direction.** `release-gate` (**unjudged**) as the ledger, which is exactly the notice `session-view`
(8.3 keep), `desktop-window` (7.8 keep) and `mobile-approvals` (8.8 keep) draw. The session panel's
carry-forward 6: *"The approval under a gate: mono command, irreversible chip, others' votes with notes,
stars with the default baked into 'Approve with N', '1 of 2 raters' in mono, gate segments, tied to the
plan step it waits at."*

**Layout.** A white notice with the navy→chocolate stripe (the gate's only gradient; apricot→chocolate in
dark). Ask line: "The release gate." in serif, "The agent wants to deploy `checkout` to production" with
the call in mono chips and `irreversible` as a red pill, "waiting 3 min" with the pulsing dot at the right.
Rule line in plain words: "Needs two contributors rating 4+ on average · the Payments policy for
irreversible calls". Voices as rows: serif name, role and time, the note as an italic quote, stars and
"5 of 5" in mono at the right; a deny row on the danger wash; a viewer's approve "a voice, not a vote";
people still to act as dashed rows ("your rating decides it"). The tally box at the right: "1 of 2 raters"
with the count big in mono, "5.0 average", two segments (filled apricot, the next outlined, amber when
the average is under the bar), and the consequence sentence computed from the rule: "One more rating at
3 or above grants it. Any deny holds it." Your row ends the ledger and flows into the stars, the note
field and **Approve with 4** · Deny · "Approve without a pick sends 4" · key legend `A` approve `D` deny
`1–5` rate. The notice carries "step 4 of 4 · Migrate stored invoices" so it is one object with the plan
row (session-view fix). A gate from another session carries an origin line (desktop panel).

**States.** Waiting; your vote in; granted (green edge, the check ring drawing with `.draw`, rater chips
with mini stars, "2 of 2 · 4.5 average", the commit and diff size "a3f91c2 · 14 files · +412 −86", then
folds into a divider a moment later); denied (both votes stay so the arithmetic shows: "one voice does
not carry a gate"); the held tool step in the agent's turn: lock icon, "deploy checkout to production ·
held at the release gate" in bold mono, "waiting" in amber; the rail card says "Waits at the release gate".
On a phone the gate is a sheet (§21).

**Copy.** "The release gate.", "Needs two contributors rating 4+ on average", "One more rating at 3 or
above grants it. Any deny holds it.", "Your rating counts once; Bo's is already in.", "Granted. The agent
pushed `checkout-proration` to `origin/main`", "Two of the Payments team rated it at 4.5 on average · the
rule asked for two at 4+", "a voice, not a vote", "held at the release gate".

**Fix before build.** The gate's second button is one verb (Deny; the desktop pages drew "Hold" and "Ask
to revise"). Mobile-approvals: the "Release gate" pill in navy with apricot text, never gradient. Open:
does a single deny hold an otherwise granted gate until withdrawn? The kernel's fold decides and the
sentence must follow it.

---

## 6 · Team panel

**Direction.** `team-panel` (session panel, **8.8 keep**, truth 10): *"The best use of the palette roles
in the set … Section headers that carry their summary are the brief's 'calm, specific' voice turned into
layout."*

**Layout.** One 340 px drawer with two faces, **Team | Details**, on a segmented switch in the drawer head
(the Team tab carries a live apricot dot and the count; the topbar buttons stay as the shortcut). Under
it a breadcrumb "Billing page · Invoice rollout · Payments". **IN THIS SESSION** ("2 here · 1 away"):
people rows with serif name, "you" in small sans, role in grey, the driving flag in chocolate, "writing to
the team…" in apricot italic, a role select only on the rows an owner can change, **Hand off** only where
the driver can hand off; away rows dim avatar and name together; "A team: two people are steering this
agent." with Invite. **CREW** ("1 other agent"): "Working on *Invoice rollout* with one other agent.", the
crewmate as a navy tile that is exactly the rail card, the claims list under it (`apps/web/src/billing/**
· this agent`, `db/migrations/** · Checkout`), "Leave crew" ghost beside "Crewmates share one brief."
**CHAT** ("3 today"): serif names, "You" in chocolate, times under the line, "Cy joins the circle" as an
italic divider, the typing line with three apricot dots, the input pinned at the bottom with the team glow
and the one rule under it.

**States.** Team open; Solo with "Team up"; a handoff offered to you (Accept / Decline on the apricot
wash with one sentence about what accepting means); nobody else here and empty memory; over the budget
with the brief loader. On the phone the panel is the bottom sheet of `mobile-rail` (§21).

**Copy.** "2 here · 1 away", "proration · 1 conflict", "Working on Invoice rollout with one other
agent.", "Crewmates share one brief.", "Cy joins the circle", "Bo is writing to the team…", "Kept in the
session log. Never sent to the agent.", "Bo offers you *the baton*. He is stepping out for an hour. Accept
and you drive Checkout proration; the agent keeps its plan and its claims."

**Fix before build.** The Team shot clips the "Cy joins" divider behind the pinned input: 6 px more bottom
padding on the list. Open: one `panel` state with two values (assumed) versus two sibling panels; with
four or more crewmates collapse the tiles to a stack of names after two.

---

## 7 · Details

**Direction.** The Details face of `team-panel` (**8.8 keep**), with the Usage block from `token-meter`
(**8.3 keep**), the Gates tab from `release-gate` (unjudged), the Time travel block from
`replay-scrubber` (8.3 revise), and the compare page from `branch-unite` (unjudged) behind the Branches
rows.

**Layout.** Same 340 px drawer, Details lit on the switch. Sections in order, each header carrying its
summary, Memory and Catch-up collapsed by default: **INTENT** (the Goal chip in italic serif on the apricot
wash, scope keys in mono `goal · api · tests · always` with who set them, the held-until-a-pick line in
warn, the replay strip under the control row); **USAGE** ("25 % · about 37.6k left": the big mono number,
the four-way split as a stacked bar, four rows including zeros, the budget row, one line of consequence
with the owner's action at the end, per-turn stacked bars newest first on one scale, each with a sub-line
saying what the turn was); **BRANCHES** ("1 conflict": the current row with "+3 ahead of main" and Fork,
other rows with one labelled action plus a "…" menu, the file list folded by default, the conflict pill on
the file); **GATES** (the live gate on the apricot wash, granted and denied with their raters, the policy
table with the active row in ink, "Who can vote" with each person's state); **MEMORY** (folded; the
conflict line); **CATCH-UP** ("since 14:02", folded; the computed brief); **TIME TRAVEL** ("Show the
scrubber" switch, the turn list grouped by plan step with mono tokens, the viewed turn on apricot wash,
later turns at half opacity). When a budget is past the 80 % tick, Usage moves above Branches.

**Branch compare and unite** (branch-unite, unjudged; opens from a Branches row): `main · here` on the
left, `try/monthly` on the right, the mark in the gutter drawn apart until the unite closes it; files that
differ with an origin dot (both sides warn, fork apricot, here navy); each side's last three turns; the
unite as a sticky bar in the composer's place that says what the fold will do ("six files, two changed on
both sides, Bo's `tax` directive meets Ana's and becomes a contention"); after the fold "United
try/monthly into main · 5 clean · 1 conflict", the conflicted file with hunks tinted and attributed to the
agent and turn that wrote them, Keep main / Keep try/monthly / "Ask the agent to rewrite it".

**States.** Budget under / past 80 % (amber) / over (red, "nothing stops"); a gate live / granted / denied;
a branch clean / conflicted; time travel off / on.

**Copy.** "Soft budget · nothing stops at 100%", "Edit budget" / "Raise budget", "+3 ahead of main",
"held until a pick: tests (Bo and Ana disagree)", "since 14:02", "Scrub back through the agent's turns;
nothing is sent.", "Folding needs the driver or an owner".

**Fix before build.** The team-panel fix: fold the Branches file list by default, move Usage above
Branches past the 80 % tick, one labelled action plus a menu per branch row so Switch / Compare / Unite
stop fighting in 340 px. Token-meter's per-turn scale should be the session's heaviest turn, not the
visible page's.

---

## 8 · Groups and chats

**Direction.** `new-group` (chat panel, **8.8 keep**) for the sheet; `groups-list` (**8.3 keep**) for the
list; `mention-flow` (**8.5 keep**, truth 10) for the three mention marks and the @ completion; `chat-view`
(**7.8 revise**) for the open group with one change; `members-drawer` (**7.5 revise**) for membership. The
judge on new-group: *"No competitor previews the room as you build it, and none lists live agents with
their owner and state beside people as equal members."*

**The list.** Title "Payments chats" then a lead sentence in place of a count ("Nine unread across four
groups. **Cy's agent answered in** *#billing*, and Ana said your name in *#invoice-rollout*."); filter
chips with counts (All, Unread, Mentions, With agents) and a Latest / A–Z segment; three scope sections in
order, Team ("everyone is in these"), Projects, Direct ("one person, or one agent, and you"). One row
shape: 44 px emblem (flat navy `#` for a team group, apricot-wash `#` for a project group, a round avatar
or the agent squircle), serif name with the purpose and a scope tag, the attributed last line (serif name
for a person, "Cy's agent" in italic chocolate, `code` for branches and tools, your mention in apricot),
time at the right, the people | agents stack with a hairline seam and a 2 px canvas seam around each agent
tile so its corner status dot never lands on a neighbour, then the badge: a chocolate count for unread, an
apricot `@1` when your name was said, the bell-off glyph for a quiet group. Read rows lose the card, the
shadow and the emblem colour. An agent still answering shows the weave and "Bo's agent is answering Cy…"
in the time slot. The New group side panel is closed; the sheet owns that gesture.

**The sheet (New group).** Two halves over the shell: left, NAME (`#` as a serif prefix inside the field,
the glow on focus, "free" check, "Lowercase and dashes. People will say `#proration`."), PURPOSE, SCOPE as
three radio cards each with its one-sentence rule (Whole organisation / Team Payments / Project Billing
page; the chosen card apricot-washed with a chocolate radio), MEMBERS as one search bar with On Payments /
Live now / Everyone chips above two pick lists, PEOPLE and LIVE AGENTS, in one row shape ("you · owner"
already in and unpickable; agent rows "Billing page · *Ana's agent* · running"); a warn-soft note under the
lists ("**Checkout** is at the release gate. A mention reaches it now, and it answers once Ana or Cy opens
the gate."); footer with the roster, "3 people and 2 agents in the circle", Cancel, **Create #proration**.
Right, "HOW IT WILL OPEN · updates as you pick": a miniature of the group page with the joining line ("*Bo*
starts *#proration*. *Ana*, *Cy*, *Billing page* and *Checkout* join the circle." with the mark playing
arcs-close), the roster, "Nothing said yet. Mention an agent with @ to bring it in.", the composer with the
@ completion over the picked members and the chat composer's own hint, and three facts under it (who can
find it; "A message that says *@Billing page* reaches Ana's session as a steer; its next words come back
here as *Ana's agent*, never as Ana."; "Kept in the Payments ledger, attributed and replayable. Team
words never go to an agent unless its name is said.").

**The open group (#billing).** Header: serif `#billing` with an apricot hash, the purpose beside it, the
stack split people | agents, a Members button pressed (apricot-soft) when the drawer is open. Day dividers
as small caps on a hairline; "New since you looked away · 2" as an apricot-deep rule with a chocolate
pill, the only warm rule in the stream. Every human message on the left, yours a shade warmer with "you"
as the small meta word. Agent reply: plain prose behind a 2 px navy→chocolate rule, 26 px avatar with the
live dot, serif name, "Ana's agent" in faint sans, "replied · in reply to Ana · turn 12 · Open session"
(mono turn, outlined chip); a plan chip inside it ("Plan · Per-day proration · 2 steps · ~6.1k tokens · ★★
· waits for two ratings") that links to the session; a question back to the people in italic serif. The
chat never shows tool steps. Read markers as tiny stacks under the last message each person read ("Ana and
Cy read to here"). Typing: "Billing page · Ana's agent ── answering Dee · turn 13" with the weave. The @
completion anchored at the caret: "PEOPLE AND AGENTS IN #BILLING" with the query echoed in mono, matched
letters in chocolate, person rows with role, agent rows "Ana's agent · Billing page · running", the owner
listed under the agent as "not a match, listed for the owner", the selected row on apricot-soft with ↵,
footer "Mentioning an agent *steers its session*; its next words come back here." Three mention marks: a
person on apricot-soft with chocolate text, you on solid apricot, an agent on navy (`#3A4458` in dark) in
serif with the agent's corner. In the session the steer wears a 22 px apricot-soft origin tag "# billing ·
steered from the group" and a mono scope line ending "answers in #billing"; under the live turn a dashed
"Its next words answer Bo in #billing as well as here".

**Members drawer.** One add field offers people and live agents together (agent rows carry owner,
status, what it is on and spend; an ended session greyed "not live · can't join"), with results inline so
the list pushes down; role chips (Creator on solid apricot, Host on wash, Member plain) that are a menu
only where you may change them; Leave on your row, Remove in danger on hover with an inline confirm that
names what stays and offers "Also remove Billing page, her agent"; agent rows with "Open" and the lock
"Cy or Dee" where you may not remove; a Changes ledger with the mark for joins and a minus ring for
leaves, "Never sent to the agents."; the join toast "Tax lines joins the circle. Undo" with the mark
closing its arcs and the just-joined row apricot-washed with the avatar rippling.

**States.** Unread / mention / quiet / read rows; agent answering; the four edge states a mention must
say plainly (mention-flow): paused ("Checkout is paused; it answers when Cy resumes it"), plan waits,
contention, not in the session ("Bo can read Checkout · cannot steer from inside it").

**Copy.** "A circle of people and agents. Say an agent's name with @ and it answers here.", "Create
#proration", "Say something; @ mentions a person or an agent", "Reached Checkout · Cy's agent · steer in
turn 13 · Open session", "An agent here hears only what **mentions it**; the rest of the chat stays with
the people.", "Bo adds Tax lines, Dee's agent · 09:46".

**Fix before build.** New-group: remove the Team | Agent segment from the preview composer (a group has
no mode). Groups-list: close the side panel, give the width to the rows, the 2 px seam. Chat-view: your
messages on the left (`align-self: flex-start` as tokens and the session pages have it), retake with the
@ list closed. Members-drawer: inline results, one screenshot per state, decide the "also remove her
agent" default. Mention-flow: two-cap initials, Checkout as "CO" everywhere, no empty band above "Today".
Promote `--mention-agent` and the dark status triplet into tokens.css: four of five chat pages paste them.
The rail's Chats count must be one number across pages (9 vs 6).

---

## 9 · Project page

**Direction.** `project-page` (pages panel, **8.0 keep**): *"Direction chips with a mode in italic serif,
a crew header with its claims, and a contention with two numbered sides and 'Both owners see this too'
are not in claude.ai, ChatGPT or Linear."*

**Layout.** Breadcrumb "Payments › Billing page · 4 agents live" with Invite and Share in the topbar (no
second New session). Serif h1, then the lede in the manager's voice ("Four agents on two tasks. **One
contention waits for you.** The invoice PDF renders on staging; the tax lines wait for two ratings. Manager
view"). The direction composer: a field "Set direction for everyone in this project", a constrain / steer
segment, the hint "Enters every session above owner rank · shown as `[project]` in each intent", a
chocolate send; active directions as chips under it (italic serif mode tag on apricot wash for constrain,
plain for steer; author avatar and age; your own ringed in apricot with Withdraw). **Agents** board ("5
sessions · 2 crews", Replay any): crew headers as the rail draws them (hollow apricot ring, serif name, "2
agents on one task", claims in mono), Solo with a dashed ring after the crews; each row = status dot ·
serif title with the Team pill · owner "Ana with Bo" and the agent's italic line · the usage meter with its
budget ("48.2k of 120k", "no budget", "spent"; amber over) · the status word · the one verb the row waits
for (Rate, Pick for the lead, Replay; nothing on a running row), with Leave crew and Team up in the row
overflow and the crew header. A row tinted for a contention; the contention notice in the
contention-handoff grammar with "Cy wins / Bo wins / Dismiss" for the lead; a resolved one folded to a
soft grey notice with Replay; Brief folded. Right column: Spend this week by session (bars in the hand,
"Plans came in **41k under** their estimates · nothing is cut off at the budget"), People ("joined the
circle today" with the ripple), Team chat ("kept in the ledger"), Team memory with a conflict asking for a
Keep.

**States.** Running, awaiting rating, held in a contention, idle, closed (greyed with Replay); the Team up
form open in place (the input takes the glow, the primary off until there is a name, existing crews one
tap away); the memory conflict as an amber block with two Keep buttons.

**Copy.** "Set direction for everyone in this project", "Plan first on anything that touches proration",
"Invoice rollout · 2 agents on one task", "Holds *proration.ts* for a pick · writing fixtures around it ·
in a contention", "Both owners see this too", "Never sent to an agent · replayable", "Dee joined the
circle today".

**Fix before build.** The action column carries one verb; rename the "Checkout proration" crew (it
collides with the sibling Checkout project); drop the topbar New session; the contention stripe is
`--warn`, decided for the whole system (manager-overview used `--danger`); per-session spend bars in the
hand, not apricot. Open: a project-level budget does not exist in the spec (only branch budgets); who may
Leave crew on another owner's row.

---

## 10 · Manager overview

**Direction.** `manager-overview` (pages panel, **8.3 keep**), with its charts rebuilt on the contract
from `usage-charts` (7.8 keep) and `data-viz-style` (system panel 1, **6.8 revise**) once the band is
re-stepped inside the family. The judge: *"The sentence first and the charts as its proof is the brief's
'calm, specific, warm' done as a page."*

**Layout.** Serif h1 "Payments", the range control (Since · Today / 7 days / 30 days) top right driving
every number, then the sentence: "**4 open sessions** across **2 projects**: 1 running, 1 awaiting
approval, 1 blocked, 1 paused. **3 things need you.** This week the team spent `212k` tokens, rated 7 plans
and held 2 release gates." (counts medium, token figures mono, one link). **Needs you** (3, "Open the
approvals queue"): three cards with a 4 px stripe by kind (gradient gate, apricot plan, amber contention),
an uppercase kind label with the age in mono, a serif sentence with the thing in italic, one line of why
(the rule), who, the vote dots with a dashed empty avatar for the missing voice, one button (Approve /
Read the plan / Resolve). **Where the week went**: five stat tiles in a fixed order (Tokens with a
sparkline, Agents, Plans, Release gates, Members) on the contract label · serif value · small unit · a
detail line that splits the number ("161k in · 51k out · +18 % on last week" with the delta in ink); three
charts from one component, Tokens by project / person / agent as stacked in + out bars (navy and chocolate
stepped at the family's saturation, 2 px surface gap), a reading sentence and a Table under each, the hover
readout replacing the row's value column ("58,412 · 27 %"); the area chart of tokens over turns in the hand
with the 10 % wash and a crosshair readout. Then Plans (SVG stars, average in mono, "est 44k → 61k, +38 %"
amber or "19k, under" green), Release gates (rule in mono, votes as avatar + number, the dashed empty
avatar, "Gate health" with the median wait), Crews ("together" tokens, who has the baton), Groups (hash
name, member stack, the last thing said), and the Roster where people and agents share one grid ("8
members: 4 people · 4 agents").

**States.** Needs-you with cards; quiet ("Nothing needs you right now." in green on the phone's block);
budget past 80 % as the only colour in a tile; dark from tokens with the triplet.

**Copy.** As above plus "Even spread; no one person is over a third.", "1 granted · 1 waiting on a vote",
"5 approved · 1 revised · 1 waiting · average 4.1", "Rule: two contributors at 4+. Ana gave 4; the gate
waits for one more voice from someone who consumes the code."

**Fix before build.** Settle the chart contract with Usage: stacked in/out bars from one component, the
hand only for the lone-series area chart, the hover readout in the value column, SVG stars; "+18 % on
last week" in ink with the sign, coloured only against a budget; drop the Refresh ghost button.
Data-viz-style's band must hold Dress Blues / Chocolate saturation (S26–31, near `#45527A` and `#8A4A3C`
on cream) and set stat-tile values in mono per the type rule; where two steps cannot clear 3 : 1, texture
is the second discriminator, never cobalt.

---

## 11 · Usage, budgets and optimisation

**Direction.** `usage-charts` (pages panel, **7.8 keep**, craft 9) for the page; `token-meter`
(**8.3 keep**) for every meter; `token-optimisation` and `cost-forecast` (**unjudged**) for the two pages
the brief lists under "token optimisation" and budgets, adopted only for the parts the judged pages
already set (one track, estimate as a tick, the hand for a lone total, the forecast vocabulary).

**Layout (Usage).** Breadcrumb "Payments · Usage", Edit budget, Export CSV, search. Serif h1, then the
sentence that states the conclusion ("This week the team spent `212k` tokens, **18 % more** than last
week, most of it on the **Billing page** and most of that in Ana's and Cy's sessions. At this pace October
lands at about `981k` of the `1.0M` budget; the meter turns amber around **26 Oct**. Nothing stops at
100 %."), range (7 days / 30 days / Quarter), project and people pickers, the Texture control moved to the
team setting. Five stat tiles (Tokens this week with sparkline; Per open session; Cache "read · never
counted against the budget"; October budget with the 80 % tick; Forecast with the band). **Where the week
went**: Tokens by day as stacked columns (input stepped from Dress Blues' hue, output chocolate, cache
read beside and never inside, last week's wash, columns capped at 24 px with a 2 px gap and a rounded top
on the output only, a tooltip that leads with the value) beside **October against the budget** (So far
solid, At this pace dashed, ±8 % band, the 80 % amber hairline with a dot where the pace crosses it, the
budget dotted and labelled "soft"). Then by project, by person and by agent as stacked horizontal bars
with avatars (agents as the agent avatar in the same list as people) and the value at the tip, hover
readout replacing the value column; the same numbers as a table at the foot with Copy as CSV; every SVG
with a title and desc, the hatch pattern wired for `forced-colors`.

**Every meter** (token-meter): mono number + faint percent, a 3 px hairline with the 80 % tick, states
`.none / plain / .live / .warn / .over`; the budget counts input + output only; cache never moves the bar;
apricot weaves while spending, amber from 80 %, red past 100 % with the percent carrying the overflow;
"Soft budget · nothing stops at 100 %" once under the bar.

**Token optimisation** (unjudged; opens from "Token optimisation" on Usage and the overview): one track
with three quantities, spent (chocolate), forecast (hatched apricot), planned (the track with its estimate
tick); per-step estimate above actual on one scale; the forecast line as the hero in serif ("~26.9k of the
40k budget · 4.3k under plan") with the method in one sentence at the foot; suggestions as verbs a person
performs (Compact now, Reuse memory, Trim a read, Raise budget) with the gain in mono green and the name of
whoever acted. **Cost forecast** (unjudged; the owner's money page): one money series in the hand, the
±8 % band, the budget dotted, the 80 % line in amber; alert rules in words ("to *Bo* · inbox and email");
team meters with "Over around 27 Oct", never a bare percentage.

**States.** Under / warming / over; forecast within the band / crossing the budget; empty (the meter at
zero with a budget edge and ghost bars by project, person and agent, from empty-states).

**Copy.** "Nothing stops at 100 %", "Counted by who holds the session, not who steered", "The pace is the
last five weekdays and two weekends, carried forward. The budget is soft: the meter turns amber, then red,
and **nothing stops**.", "a number people watch, not a gate".

**Fix before build.** Re-step the input series from Dress Blues without leaving its hue and chroma
(`#3B66A8` is a cobalt the family never had); spend deltas in ink with the sign, coloured only against a
budget so "+18 %" means the same on Usage and the overview; the by-person tooltip must not cover Ana's
label; the Texture chip follows the team setting. Open: split team spend by who steered?

---

## 12 · Inbox

**Direction.** `inbox` (**unjudged**) as the page, adopted because it is the row form every judged page
reaches for: the needs-you card of the surfaces panel, the notification grammar of `notifications`
(navigation panel, **7.5 revise**), the sentence-at-three-distances rule, and the keyboard cursor of
`approvals-queue` / `memory-browser`. The surfaces panel: *"The needs-you card … use in inbox, digest,
Slack brief, PR ladder."*

**Layout.** Title row "Inbox · 6" with `j k` move · `a` approve · `e` done, Mark all read, Search. Serif
h1 and the lead sentence ("Six things need you. *Two wait on a rating*, and Ana is holding the baton
out."). Filter chips with counts and a colour dot that matches the row stripe (Needs you, Mentions,
Approvals, Handoffs, Contentions, Done) and an Unread / All segment. Three groups ordered by consequence:
**Needs you** ("something stops until you act"), **Mentions**, **Done** folded quiet. One row shape: a
4 px stripe by kind (gradient hairline for a release gate, chocolate for a plain approval, apricot for the
baton, amber for a contention, red for blocked, green for done, navy for a mention), an icon or avatar, a
serif title that is the sentence, a plain body with the rule or the quote, a meta line (session · step ·
pill · people · age), and at the right exactly what you can press now: stars beside Approve so the approve
carries the rating, Accept / Not now for the baton, two miniature directions with Pick for a contention,
Retry step / Open for a block, an inline reply box "as Bo in #billing" under a mention. Aside: "Where
things stand" (waiting on you / on others / moving), "Waiting on others" with a face and a wait time, the
keys, and the quiet toggle ("Quiet until 13:00 · mentions still come through").

**Toasts and banners** (notifications): one sentence at three distances with the same words in toast,
banner and inbox row. A 340 px toast with a crease by kind, 28 px icon or avatar or the mark, the serif
who, the sans sentence, mono for the call, at most two buttons plus Open on one line (`white-space:
nowrap`; Open becomes an icon when tight). Decisions stay and carry `y` / `n`; news drains over 8 s along a
2 px apricot life line that pauses on hover; three show above the composer (bottom 112 px, right 24 px,
newest nearest) and the rest fold into a navy tail "2 more wait in the inbox · Open `g i`". "Dee joins the
circle." is the only toast with motion of its own (the mark closing). Same ref twice updates in place.
The plain text toast ("Copied the share link") stays bottom-centre, 3 s. Under a ratings rule a decision
from a toast or banner opens the notice; approving blind is never offered on an irreversible action.

**States.** Unread (apricot dot before the title, white card, soft shadow) / read (dot, shadow and title
weight gone, stripe at half); pressing: "Joining…" with the orbit loader, then the outcome word in green
with the check drawing ("Approved · ★ 4 · the gate opened"), or the refusal in red with the reason ("Ana
took the offer back") and Open left behind; Done rows at a smaller size with the body hidden; empty:
"Nothing has needed you yet." under the open mark (empty-states) or the "Already waits for you" wash card
on a first run.

**Copy.** "Checkout asks to deploy to production.", "Release gate: **two contributors at 4 or better**.
Ana rated it 4; the plan waits for one more.", "Ana offers you the baton on Billing page.", "Two
directions for `proration` on Billing page.", "Invoice PDF is blocked.", "Cy mentioned you in #billing",
"Bo offers you the baton.", "You can approve, Ana".

**Fix before build.** Settle `y` / `n` precedence (notice, then toast); a badge counts decisions only
(approvals + handoffs), mentions never (desktop and mobile panels); the one dark status triplet instead of
the page's override. Open: flat list with the session in the meta (drawn) or grouped by project at twenty
items; does a release gate break quiet hours?

---

## 13 · Approvals queue

**Direction.** `approvals-queue` (pages panel, **8.3 keep**): *"The sentence rows in serif, the quorum
meter that turns amber at a 3, and 'Approve with 4' on the button are ours."*

**Layout.** Title row "Approvals · 5" with `j k` move · `a` approve · `d` deny · Enter open, Search. Serif
h1, the lede ("Five approvals waiting in four sessions across two projects. *Two are release gates;* one
waits for Cy."), filter chips (Needs you, Release gates, Waiting on others, All) and "Oldest first". One
flat list, oldest first: each row on a grid gutter · avatar · body · controls; line one is the sentence
with agent name and session title in serif and the call in mono ("Bo's agent in Checkout wants to deploy
`checkout-proration` to production."); line two the project, the Release gate pill (navy, apricot text),
`irreversible`, the votes ("Ana approved with 4"), "42 of 42 pass", the age in mono; gates carry a two-segment
quorum meter with "1 of 2 at 4+ · avg 4.0 · the plan waits for one more"; the decision line = a hint dot
("needs one more at 4+"), the compact rating with the gate tick after the third star and the serif word,
the key hint "`a` sends 4", **Approve with 4** · Deny. The keyboard cursor is one component shared with the
memory browser: inset 1.5 px apricot-deep ring, a 3 px gutter stripe, the wash at 55 %, the hint in ink-2.
Done list quiet below with rows folded to one line (result coloured, the voters and quotes). Aside: At a
glance (Need you / Your vote is in / Cy's call), the three open gates as meters, and the keys.

**States.** Cursor row with preview; an exec row with no votes; a gate where your vote is in (stars
locked, drawn check, "Approved" disabled, "Change to deny" live); a driver-only row ("needs the driver ·
Cy" with Nudge Cy as its only action; "Decide as owner" only when the gate policy returns an owner-override
rule for that risk class, and then the button says what it does: "Approve for Cy · logged in your name");
a gate at avg 3.0 ("a 3 is a voice, not a vote", meter amber); a row that just folded (the fold-in
animation); a decision anywhere folds the row.

**Copy.** "a decision anywhere folds the row", "Irreversible actions grant when **two contributors
approve at 4 or better**. An approve without a pick sends 4; a 3 is heard but does not count.", "never
while you type", "Open the oldest".

**Fix before build.** Do not promise an override the policy may not grant (above); words in `--warn` on
cream (3.4 : 1) take the `-ink` token; the quorum meter has one width in the row and the aside; the
gradient appears once per row at most (the hairline) and the Release gates filter dot is apricot. Open:
should gates float to the top?

---

## 14 · Memory

**Direction.** `memory-browser` (pages panel, **9.0 keep**, the highest score of the wave): *"Nobody's
memory page shows who said a thing, in which session, at which commit, and which sessions are reading it.
The side-by-side conflict with two primary buttons and 'Write the rule yourself' is the most Henosis moment
in the panel."*

**Layout.** Title row "Team memory · Payments" with `/` search · `j k` move · Enter open · `r` retract,
Refresh, **Remember** (primary). Serif h1 and the lede ("Forty-one entries in Payments, every one signed.
*Two entries disagree on proration; Tax lines waits on it.*", then "Tuesday 12:06 · the curator last ran at
06:00"). Tools: the scope segment (Org 118 / Team 41 / Project 17) with a picker, the search field ("Search
a key, a sentence, a person"), a History toggle. **Conflicts** first ("two entries disagree; nothing reads
either until someone keeps one"): the open conflict as a two-sided notice with an amber edge, "OPEN · Two
entries disagree on `billing.proration.rounding` · since Monday · blocks Tax lines", each side with the
author (agent or person), "remembered Monday 16:40", the quote in serif, "session billing-42 · commit
9f3c1a · Billing page", **Keep this** and "read by 3 sessions"; the foot "Both can be wrong. **Write the
rule yourself** · the loser is retracted with your name and the reason." and "Dee is blocked on this · Ask
Dee in #payments". A resolved conflict folded to two lines (kept with a drawn check; the loser struck
through, "retracted by Bo", the reason in italic serif in the header). **Entries** (39, "newest first ·
every row says who, where and which commit"): kind disc (check = decision, lines = rule, i = fact, a navy
disc with an apricot edge for the curator's summary), mono key, the sentence, the attribution line "added
by *Bo* · session invoice-pdf-3 · commit 0c8d44 · Billing page" with scope last so it wraps, the kind word
and age at the right. The curator's report last. Aside: At this scope (entries, open conflicts, retracted
this week, read in the last hour, oldest still read), Who remembers (people in apricot bars, agents in a
navy bar with an apricot edge, "Agents wrote 15 of 41. Each one is signed by the person who was driving."),
Scopes tree with "1 open" beside Payments.

**States.** Open conflict · resolved · retracted (key and sentence struck, Ana's reason) · superseded
(dimmed) · stale (an agent entry waiting for "Still true" / Retract) · proposed by the curator (Retract /
Keep for a person; the curator never retracts) · the keyboard cursor row with its own hint. History on
shows retracted entries inline. Empty: the first entry's form with the scope chip and "as Dee"
(empty-states).

**Copy.** "every one signed", "nothing reads either until someone keeps one", "Both can be wrong.",
"Write the rule yourself", "folded by the curator from 6 entries · Ana, Bo and Ana's agent", "only a
person can retract; the curator never does", "Still true".

**Fix before build.** The cursor as the one shared component (above) so ink-3 metadata stays legible in
dark; collapse the three gradients to one by drawing the summary disc and the agents bar in `--rail` with
an apricot edge; "blocks Tax lines" takes `--danger-ink`, not `--danger`. Open: who may Keep (driver,
owner, or any contributor); the per-entry read log the API does not have.

---

## 15 · Settings

**Direction.** `settings` (**unjudged**); adopted because its two patterns are already the judged
system's: the changed-row grammar the pages panel 2 asks every saving form to adopt (*"Changed-row
grammar: apricot wash + CHANGED tag + a save bar that counts and names changes and says who gets them and
when; same as the settings board, adopt everywhere a form saves"*), and the policy sentence generated from
the kernel's `describeRule` (surfaces panel: *"the verdict line computed from the rule, never restated
from the policy"*).

**Layout.** Title row "Settings" with the team and role chips at the right. Serif h1, "You, your keys,
and the *Payments* team's manners.", a tab row (Profile, Notifications, Keyboard, Team policy,
Integrations, Appearance). Two columns at 1440: **yours** on the left (Profile: serif name, "Lead ·
Payments team · owner of Billing page and Checkout", project chips, user id in mono with "what @ana points
to in groups and chats", Identity; Notifications: the seven kinds the app has, each with a one-line
meaning and a switch, plus "Send a test" using a real line; Keyboard: the real map with glyph key caps and
the ⌘ / Ctrl segment), **the team's** on the right (Team policy "What every new session is born with" with
a project picker; the policy sentence in serif with the mark in front of it and the counts in italic
chocolate: "Every new session in *Billing page* starts with a plan. The plan goes ahead when *two*
contributors rate it 3 or more. Nothing irreversible happens until two contributors rate it 4 or more.";
then the controls: Plan first switch, Plan approval as stepper + five stars + "3+ avg" in mono, Token
budget with the meter drawn under it (0 · 80 % amber · 100 % red, "nothing is cut off", the input "400 k"
in mono), Turn budget stepper, risk classes in mono with one rule chip each ("No approval", "One
contributor", "One driver", "2 contributors · 4+ avg"), the contention policy; Integrations saying what
each connection means in one line and naming the live things; Appearance with Theme, Motion (Full / Quiet
/ Calm) and the Team look row with a swatch preview and Edit (§16)). A changed row takes the `--changed`
wash and a small CHANGED tag; the sticky save bar names the change and its reach ("Plan approval changed,
1 → 2 contributors. New sessions only: Bo's plan for *invoice PDF* keeps the rule it was born with." ·
Discard · **Save to Billing page**). Save is the only chocolate button on the page.

**States.** Clean; changed (wash, tag, bar); saved; a notification the browser blocked (in the row's hint,
not a toast); mobile in one column (Profile, Team policy, Notifications, Integrations, Appearance,
Keyboard).

**Copy.** "What every new session is born with", "The agent proposes steps, token estimates and risk
before any work; until the plan is approved every call above `read` is refused", "Soft. Input plus output
per branch; the agent is told what it has spent, the card shows it, nothing is cut off", "Dee's agent is
waiting on proration" (the test line).

**Fix before build.** Settings was not judged; before it is built, confirm `PUT /api/projects/:id/policy`
for new sessions only, and whether policy is per project (the picker assumes it) or per team. Phase-1
integrations (VS Code / Zed, the harness SDK) show as "Not connected".

---

## 16 · Team look

**Direction.** `team-look-editor` (pages panel 2, **7.0 revise**) for the editor, with the three dials and
the crest rule from `team-emblems` (brand panel, **7.25 revise**). The judge: *"the preview is a real slice
of the shell with real people and a real plan, not a palette card; the checks are a two-canvas table with
a minimum tick and a one-tap 'Use'; the save bar says who gets the look and on which load; the mark is a
crest you can only dress, never redraw."*

**Layout.** Breadcrumb "Settings › Team look", serif h1, "How *Payments* looks to everyone in it: the
rail, the buttons, the glow and the mark.", the team picker top right. **Editor left**: a Colours card with
three preset tiles that are the look in miniature (a rail strip with the highlight crease, a cream page,
one button in the accent; Fondant / Apricot / Blues), a Custom pill, and four rows (Accent "The hand:
buttons, links, the person's arc"; Highlight "The pulse: the Team pill, the driver ring, the agent's arc
and the centre"; Surface "The rail and the disc of the mark"; Glow "Around anything live or focused") each
with a swatch and a 96 px mono hex field; the **contrast table** as the system's contrast control: rows =
what must stay readable (the hand as text on the canvas, text on the hand, rail text on the surface, the
highlight on the surface, the two arcs apart), columns = cream and dark, each cell a mono ratio computed
by the product's `contrast()` + fine / low word + a 4 px bar with the minimum tick; a fix line naming the
nearest passing hex with a one-tap **Use**. A second card for Mark (the centre only: centre dot, emblem,
dot only; the arcs and disc are never options), Motion (Full / Quiet / Calm with the reduced-motion
override spelled out) and Emblem (one or two serif letters, a crest at 48 px and up only; below 32 the
centre dot returns). **Preview right, sticky**: a slice of the shell painted only through `--p-*`
variables (rail with the brand, New session, a Team and a Solo card; canvas with a title, the Team pill, a
team message with a link, Approve / Revise, a focused field) with a Cream / Dark segment that switches the
preview independently; a "where the four colours go" key; a "who sees it" card. A fixed save bar: "Three
changes to the *Payments* look: accent, highlight, emblem. **Two checks are low** on cream; the accent will
be hard to read for some of the team." · Reset to the palette · **Save to Payments**. Warn, never block.

**The hand rule for custom looks.** `--team-hand` is the accent on cream and the highlight on the dark
canvas, `--team-hand-fg` flips to the surface colour; team accents change glows, selection and the
person's arc of the *team* ring, never the brand mark's arcs.

**States.** Preset chosen (`aria-checked`); Custom; changed rows; low checks (fix line, save bar); saved
("on their next load").

**Copy.** "A preset starts over", "Checked on both canvases", "only the paint changes", "Ana, Bo, Cy, Dee
and the two agents in Payments get the look on their next load."

**Fix before build.** Every ratio computed, never typed: the "two arcs apart" row printed 4.2 : 1 fine
while `#A8623F` vs `#E4B98C` is 2.6 : 1; derive the words, bars, fix line and the save bar's count from
the real result and add the dark column to `checksOf`; give the preview's New session its own `.look
.prail .new` reset so the one gradient looks like the one in the rail. From team-emblems: the emblem is a
crest at 48+ and the centre dot at 32 and below, so a team is identified in the shell by its two arc
colours, not an initials avatar. Open: should a low check block Save (warn-and-save keeps leads in charge
but ships an unreadable link colour)?

---

## 17 · Command palette

**Direction.** `command-palette` (navigation panel, **7.3 keep**): *"the scope chip, the inline rating
step, the serif names and the per-group 'why' are what make this one Henosis."*

**Layout.** ⌘K lifts one lit surface (640 px, white on cream; `#242C3C` in dark with a 1 px top highlight
and a 6 % hairline instead of a shadow halo) over the page behind a navy scrim (42 % on cream, near-black
50 % on dark, no blur). The query bar with the typed text at 20 px, a scope chip naming the session the
Actions belong to ("Invoice PDF: tax lines" with the status dot), `esc`. Five groups in one fixed order
with the count beside the title and a quiet right-aligned "why": **Actions** (on this session), **Switch
session**, **Go to**, **People and agents** (on what matched), **Team memory** (Payments). Matches as
weight and ink (`--match` ink 600, `--rest` ink-2), never a background. Rows: icon · label with names in
serif and keys in mono · subtitle · the hint word (project · page · person · memory) at the right, which
hides on the highlighted row where ↵ appears instead. The highlighted row is the apricot wash plus a
hairline ring with the icon turned to the hand; a release-gate action carries the `irreversible` pill and
a second line with the rating step ("Rate it first ★★★★☆ · Enter alone sends 4 · Bo already rated 4").
Footer legend: ↑↓ move · ↵ run · ⇥ next group · esc close, the mark and "11 of 38 across Payments" at the
right. Keyboard focus and mouse hover are two states (hover is surface-2 so both can show).

**States.** Typed; empty (nothing typed: Actions, Switch session, plus Recent and the two newest memory
entries); no match; mobile as a bottom sheet with a handle, subtitles hidden, the legend reduced to move /
run / close.

**Copy.** "Ap**pro**ve push origin main · Cy's agent · Checkout", "Ap**pro**vals queue · 2 waiting on you",
"Open pro**ject** Billing page", "Pro**ration** credits on plan change · Bo's agent · Billing page ·
Running", "Bo · Payments · driving Pro**ration** credits".

**Fix before build.** The markup `>A<b class="m">pro</b>ve` printed "Aprove" and "Aprovals" on the first
two lines of the page; change to `Ap<b>pro</b>ve` / `Ap<b>pro</b>vals` and reshoot. Open: what a person
row opens (profile, session, or chat); ⇥ as next group versus `>` `@` `#` scoping; whether a memory hit
expands inline.

---

## 18 · Search

**Direction.** `search` (navigation panel, **7.8 keep**): *"The refine column with people and agents in
one list, the 'why' line per group, a memory hit with full attribution and a conflict pill: not Linear's
filter bar, not a chat app's search."*

**Layout.** The rail from §1 with its search item lit in the same apricot wash as the page. Title row
"Search · Payments · everything the team keeps". The query bar as the one glowing surface (`--team-glow`,
20 px query, the scope chip "in Payments" with the pulse dot, a round clear). Filters as chips with a grey
key word and a bold value, each with its own ×, plus a dashed "Add a filter", and the syntax hint in mono
at the right (`from:bo` `in:#billing` `before:friday`). Kind tabs with mono counts in pills (All 39 ·
Sessions 6 · Messages 14 · Memory 9 · People 4 · Agents 6; the active pill apricot, the underline
apricot-deep); "39 results in `0.08` s" and the sort as a small outlined control ("newest first ⌄"). The
counts add up. **All** shows every kind as a short group with its count, a "why" ("title, goal or intent";
"human 6 · agent 5 · team 3"; "facts, decisions, conventions") and "Show all 6 →". One `.hit` row for every
kind: a 30 px lead (icon, avatar, or the agent avatar), a title line (serif name + grey "in Billing page" /
"to Team in #billing"), a two-line snippet with the match in weight, an attribution line; status, time and
pills at the right; sessions carry who drives and with whom, plan ratings and tokens of budget; memory
rows carry the mono key, a kind pill and the full attribution. The highlighted row = apricot wash + ring
with ↵ open. Refine column: SAID BY (people and agents in one list with small apricot count bars), WHERE,
WHEN, kinds of message, ending in "Keep this search".

**States.** Results; "Nothing matches" (closed mark, no ghost); mobile folds the refine column into
"Filters · 2" and scrolls the tabs.

**Copy.** "everything the team keeps", "Cy appears through Cy's agent only", "Keep this search".

**Fix before build.** Use the rail exploration's rail (the page drew caps project headers, hairlines
between cards and a "Payments" pill on the you row); then settle whether All is a group cut or a ranked
list with kind pills. "Keep this search" promises a notification path that does not exist; build it as a
rail item or an inbox rule, or cut it.

---

## 19 · Onboarding

**Direction.** The web onboarding from `onboarding` (**unjudged**, "Join the circle"), the desktop first
run from `first-run-desktop` (onboarding panel, **7.5 keep**), the agent's arrival from `welcome-agent`
(**7.5 revise**, distinct 9: *"the exploration that most makes the product's argument"*), the coach marks
from `tour` (**7.0 revise**), the share and invite dialog from `share-invite` (unjudged), the waits from
`loading-screens` (brand panel, **8.75 keep**), the nothing-yet pages from `empty-states` (unjudged) and
the bad moments from `error-states` (**7.0 keep**). The panel's one idea: *"joining is told by the mark."*

**Join the circle (web).** Two halves. Navy left: "Join *the circle*." in serif display, "**One team of
people and agents.** You enter the same ring Bo's agent did this morning: the same groups and chats, the
same plan-first manners, the same release gate."; the big mark with its arcs nearly closed and the centre
as a dashed ghost that becomes the apricot dot the moment the session opens; "Already in": a stack of
people and agents, Bo with the driver ring, "Ana, Bo, Cy and two agents are in. Bo has the baton."; three
stage tiles that are the mark's own stages (one arc "Your arc, the person's", two arcs apart "The agents'
arc swings in", the ring with its centre "The centre settles when you arrive"), the current stage on
apricot wash; the terminal foot "In a terminal? `henosis join billing-page`" and "Skip, open the demo".
Cream right: "Welcome, Dee." · "Two of three. Open a session and you are in the circle."; done steps
folded to one serif line with the facts in mono ("Dee Okafor `dee` · as in `users.json`" · Change); the
team row kept in its chosen state (apricot ring, "Chosen" in chocolate, projects as dots green when live);
the role line on apricot wash ("You join Payments as a *contributor*: steer, pause, rate plans and vote at
the release gate. Ana, the lead, can raise you to owner."); **Your first session** as one card with tabs
(New session · Join live 2 · Open by id), Project, "Who sits with you" ("Bo and his agent, Solo until you
team up"), "What it is for" (the session title, "the first line of the agent's brief"), two policy tick
cards (Plan first; Token budget "Payments' default is `120,000` a session"), and the one gradient action
**Enter the circle →** with "The stream will say *Dee joins the circle*. Ana and Bo are told; the agent
reads your brief first."

**First run (desktop).** The whole desktop at step 4 of 4: the window with a 312 px navy side (the four
stages of the mark as step marks: faint ring, one arc, two arcs apart, closed ring with centre; done steps
folded with their facts, `henosis.payments.internal · Payments team · 4 projects`), the cream page
teaching the tray by dropping the real menu open in the menu bar; three tiles (the middle one showing the
apricot pending dot on the tray glyph, large, with the Dock badge demoted to a small second picture);
three preferences; the "Already waits for you" card on apricot wash ("Three things already wait for you,
Dee." with avatars and mono tool names) before **Enter the circle**. The badge red is a declared `--badge`
token, red only because the OS is red there. The server step's two outcomes: the green line with version,
team and projects; the red line with the timeout, "Is the VPN on?", Retry and "Use the local server".

**Welcome an agent.** In #billing the joining line with the 30 px mark playing arcs-close ("*Checkout*,
Ana's agent, joins the circle." · 09:46), the owner's toast on navy ("Checkout is in. Bo and Cy hold its
gate."), the arrival card: name and "Ana's agent · project Checkout · crew Invoice rollout ·
`checkout/proration` · fresh workspace", the italic serif line of what it is on, four facts (Status
Planning · Mentioned by Ana, Bo, Cy, Dee · Gate Bo and Cy · Budget 0 of 400k soft), the hearing rule with
the ear ("It hears only what **mentions it**; a mention steers its session, and its next words come back
here as **Ana's agent**, never as Ana."), **Say hello** · Open session · "What it was told ›"; "Who it
joined" beside it with roles ("holds the gate" in chocolate) and the crewmates. The drawer **What
Checkout was told**: a navy serif brief paragraph ("written by the system from the ledger · kept in the
log · replayable") with `flex: none` so it renders, then THE CIRCLE, YOUR CREW, MANNERS ("Plan before
work.", "Ask for risky calls.", "In #billing you hear mentions only.", "400k tokens, soft."), IN YOUR
CONTEXT with three entries attributed by name and commit, a greyed "Not told" line, and a mono fold "As
the model reads it" with its token cost. Reuse the same brief for the handoff and for the human page so
the new engineer and the new agent read the same thing.

**Tour.** Five coach marks on the real session in order rail → stream → plan → gate → composer: the
look-here layer (navy dim `rgba(42,50,68,.52)`, near-black `.62` in dark; one target lit with a 3 px apricot
ring and a 10 px soft halo), one mark at a time with a serif headline in the voice ("Plans come first.",
"The gate is held by the people who consume the code.", "Agent, or Team."), Back / Next / Skip, `→ ← esc`
hints, and the five-segment ring in the mark's corner closing one segment per step (chocolate now, apricot
done, the centre a dashed ghost until **Close the ring** pops it and the toast says *Dee is in the
circle*). An arriving approval **ends** the tour (ring closes, dim lifts, the approval card gets the halo,
the tour reopens from Settings) so nothing live ever sits under an `aria-hidden` dim. The same layer serves
the first approval and the palette's "show me".

**Share and invite** (unjudged). One dialog in two columns: Share left (the link with the rule in one
sentence "Leads and admins open it as owners, members as contributors, everyone else observes"; Copied as
a real state that draws its check; the observer callout "Outside Payments, it opens as *observer*"; people
rows with role words, "driving" on solid apricot, the picker inline under the row with the hand-off warning
on Driver), Invite right (a person: one field, a found row with "not on Payments yet" in amber, a Guest /
Member segment that rewrites the consequence; an agent: the joined row on apricot wash with the arcs-close
mark and "09:52 · Dee was told", "Add to crew" for a live agent, the terminal path with a one-time key
"good for 15 minutes and one use", and the closing rule "Same manners, same gate… its owner answers for it;
it never votes.").

**Waits.** App launch: the mark closing its arcs on navy, "Opening the circle."; session joining:
orbit-converge at 54 px in the centre of a live shell, "Joining Bo, Cy and Dee in Billing page · Checkout."
with "1,204 of 2,310 events folded", the composer muted with "You can type once the history is in.";
project opening: the weave under the title while the direction is readable, "Opening Payments. `3 of 5`
sessions in"; long operation: finished steps checked, the running one timed, shimmer only where the
summary will land, "Bo's agent is uniting pdf-layout into main. About a minute."; after 8 s a cause ("The
server is slow to answer"), after 30 s one chocolate action ("Try again", "Watch tests"); failed: "Could
not join Billing page · Checkout." · Try again · Open the replay. The 18 px inline and toast waits
(reconnecting, a chat opening) use the mark's halo pulse, never three dots.

**Nothing yet.** The mark with its arcs apart and a dashed ghost centre at 56 px, one serif sentence ("No
sessions on Billing page yet."), one line of who fills it, one chocolate action, and a dashed ghost row of
what the first real thing will look like with real names and policy numbers; row size (22 px mark, one
line, a ghost button) inside pages that have other things; when the first thing lands the arcs swing in.
"Nothing matches" is not an empty state: closed mark, no ghost.

**Bad moments.** Four parts the way a colleague tells it: what happened with a time, what still works,
what Henosis is doing, one chocolate action. The connection line under the title row: "Reconnecting ·
attempt 3 · again in 4s · the stream is as of 14:02 … Try now"; presence dims to 45 % with "as of 14:02";
server down takes the page (rail cards at half with "Last seen 14:02", the apart mark with the ghost
centre, the host, "What it last saw", Retry); plan rejected (steps after it struck, the note as an italic
quote, "Steer towards a new plan"); approval denied (both votes stay); unite conflicts in the stream's own
words. Grey for the network, amber for what waits, red only for a human no or a conflict.

**Fix before build.** First-run-desktop: the middle tile and the `--badge` token. Welcome-agent:
`.brief { flex: none }`, re-shoot, flatten the stripe and border-image gradients. Tour: end on an arriving
approval. Error-states: the composer's promise must be one the app keeps: either commit to holding and
replaying directives in order (then the chip, the Held-for-you drawer and a safe-point rule are the spec)
or say "Not sent · kept here until you are back" with a single Resend. Loading-screens: orbit-converge only
at page centre. Craft rule: a card with `overflow: hidden` in a flex column needs `flex: none`.

---

## 20 · Desktop

**Direction.** `desktop-window` (desktop panel, **7.8 keep**) for the frame, `desktop-tray`
(**7.0 revise**) for the tray and notifications, `desktop-compact` (**8.3 keep**) for the breakpoints and
collapsed rail, `tablet` (unjudged) for the two orientations, `widgets` (mobile panel, **7.5 revise**) for
the macOS menu-bar panel, `print-export` (system panel 2, **7.8 revise**) and `export-evidence`
(unjudged) for paper.

**The window.** 1280 × 840 default on a 1440 × 900 display, the navy rail from the very top edge, one
frame hairline plus one soft drop shadow, 11 px radius on macOS and 8 px on Windows. macOS: traffic lights
hiddenInset in the rail (12 px, 8 apart, 4 below the edge), the brand row dropped 32 px, the session's title
row as the drag region with `no-drag` on its buttons, no app name inside the window; the menubar carries a
template mark with a corner attention dot and the order File · Edit · View · Session · Team · Window · Help.
Windows: a 36 px `--rail` titlebar with the mark and "Henosis" only, 46 × 36 caption buttons with 10 px
glyphs and close hover in Windows red, the rail brand row hidden; the session name lives in the title row.
The OS keeps its own colours: menu highlights, taskbar underlines, notification buttons and the Dock badge
are native; Henosis owns the tray icon (template on macOS, linen on Windows), the attention dot, the badge
count and the strings. The composer hint names the platform's keys and says what closing does ("⌘ ↵ sends ·
⌘ K jumps · the window closes into the tray").

**The tray.** A native menu listing items, not counts: section headers as disabled items with the count at
the right ("Pending approvals · 2", "Handoffs offered · 1", "Mentions · 2" only when there are any), one
line per item (serif who · verb · muted what · age), five per section then "and 3 more… in the queue";
Quick open with the last five sessions and rooms by name plus Inbox, Approvals queue, New session…; Pause
notifications (an hour, until tomorrow, until you say; the icon dims with a moon); Open Henosis (⌥⇧H /
Ctrl+Shift+H); Quit. Every row is a `henosis://p/<project>/s/<session>` route to the notice. The badge
counts decisions only; "Nothing awaits you, Ana." when empty. Notifications are drawn where the OS puts
them (top-right under the macOS menubar, bottom-right above the Windows taskbar), as a second moment after
the menu, with the OS's own buttons and the one grammar (title who · verb · what, body where + what it
means for you, two buttons max, a tag so a repeat replaces); under a ratings rule a banner opens the
notice. The macOS menu-bar panel (widgets) is the ring plus two numbers (decisions, running) opening the
tray's menu made rich.

**Breakpoints, written once.** 1440 full · 1180 the rail folds to 72 · 960 compact (the title truncates
first; status, Team pill and token chip stay; Team and Details become 34 px icon buttons, the open one
keeps the apricot wash; the gate tightens to one rating row) · 720 the drawer overlays at 300 px with a
scrim · 480 phone sheet. The column's 780 and its 24 px gutters are fixed; the rail and the drawer give
way; 40 px of hysteresis so the rail does not flap; `[` `]` pin the choice. Tablet: landscape (1024 ×
768) is the compact layout with 44 px targets and long-press in place of hover (the collapsed card, the
token breakdown, a presence avatar); portrait (768 × 1024) removes the rail, which returns unchanged as a
left sheet from the Agents button (with the needs-you count in chocolate) or an edge swipe; the Details
sheet has no scrim and can pin (the one case where the column gives way, to 640).

**Paper.** Export is one sheet with three doors (Markdown for people, the audit view for the reviewer who
was not in the room, the compliance bundle for the machine); paper is its own theme (`--paper-*` tokens
with `color-scheme: light`, the cream mark variant with a dotted agent arc in one ink, never the navy disc
on white); serif names with the role at that moment, mono ids a size smaller, kernel rows in one green
with the rule stated inline, masked secrets in one amber, nothing splits that belongs together, what is
omitted says so in one italic line, the verify line "Replays to the same hash." and the signature row on
both documents; the export is itself a row in the ledger ("Bo exported the audit view.").

**States.** Window light / dark (the dark desk's wallpaper navy→chocolate; the traffic lights native);
tray quiet / attention / paused (moon) / linen on Windows; compact; tablet landscape / portrait; export
format chosen.

**Fix before build.** Desktop-window: system highlight on the tray-menu hover, the Windows accent on the
taskbar underline, re-shoot at full colour. Desktop-tray: notifications in the OS's places as a second
moment, OS-styled buttons, the whole board in dark; the highlighted parent row when a submenu is open.
Desktop-compact: the hover card beside the stream after a 400 ms rest. Print-export: inline the SVG or
move every mark colour onto custom properties the `<use>` inherits (today every mark on the board renders
as a navy disc with a black dot). One cast across the theme: Billing page is Ana's (with Bo), Checkout is
Bo's (with Ana), Invoice PDF Cy's, Tax lines Dee's.

---

## 21 · Mobile

**Direction.** `mobile-rail` (mobile panel, **8.8 keep**, truth 10), `mobile-approvals` (**8.8 keep**),
`mobile-session` (**8.5 keep**), `mobile-manager` (**8.3 keep**), `mobile-chat` (**7.8 revise**),
`widgets` (**7.5 revise**). The panel: *"That block is the set's biggest win: the frame stays Dress Blues
on a phone without a rail, and the brief's palette roles survive the fold."*

**The top block (settled, shared to the pixel).** 48 px status bar + 44 px bar on `--rail`; a 40 px menu
button at the left; a serif title (19 px on a session, 22 px on a page) with a 12 px subtitle in
`--rail-muted` whose status word is `#9BC88F` ("Running · turn 7 · Ana drives"); a 40 px right control on
`--rail-active` (the Team button with the stack, the range pill, the members stack); an optional strip
(Team pill folded into the Team button as "Team · with Bo" with the stack, mono "12.4k / 20k" with a 3 px
hairline, the crew in serif apricot, and the "1 waits for you" apricot chip when a gate has scrolled away).
The mark sits in the block (right, 32 px) on every page.

**One navigation.** A four-tab bar (Sessions, Chats, Approvals, Me) is the phone's frame; the 332 px rail
drawer opens from Sessions (the desktop rail at 44 px rows and 76 px agent cards, a "who · where" line
"Ana · Payments · 3 agents · 2 chats", the you row pinned, the account menu rising on `rail-2`, an
`--edge` hairline in dark). The needs-you count lives on the Approvals tab, mentions on Chats, no badge on
the menu button. **One needs-you number**: approvals I can still vote on plus handoffs offered to me;
mentions never count; the app badge, the tab, the manager's sentence and the lock-screen line show the
same figure.

**One bottom sheet.** `--surface`, 26 px top corners, a 40 × 5 handle, 16 px gutters, scrim
`rgba(42,50,68,.46)` (black 58 % in dark), half and full detents with the drawer head (title with the live
dot and summary, a Team | Details segment where it applies), a 50 px full-width primary beside a quiet
pill, one line of fine print. The Team sheet (mobile-rail): half at 424 px shows Bo's handoff offer on the
apricot wash (Accept / Decline, one sentence about what accepting means) and the people rows; full at 96 px
from the top adds the crew (navy crewmate tile, claims folded by default under "proration · 1 conflict",
"Leave crew"), "Cy joins", "Bo is writing to the team", and the pinned input with "Kept in the session log.
Never sent to the agent."

**The session.** Stream anchored to the latest moment; human bubbles full width with the scope chip
inline; team messages keep the wash and "to the team"; the plan as one line ("Plan · 3 of 4 steps · 11.9k
of 13.2k est." with step dots); the release gate above the composer with the `irreversible` chip, Bo's vote
with stars and note on one line, five 48 px star tiles, the note, "1 of 2 raters · 4.0 average" with the
two segments, **Approve with 4** beside a quiet Deny; the composer keeps Agent | Team and the scope chip
with one send. When the gate scrolls out of view the strip shows "1 waits for you" and taps back to it.

**The star tile.** Five-up grid at 48–50 px, 12 px corners; off tiles `--surface-2` at .55; tiles up to the
pick on `--apricot-soft` with the star in apricot-deep; the pick solid apricot with a chocolate star and the
team glow; the words (risky, unsure, fine, good, ship it) in the labels; "Good · 4 of 5" or "4 if you leave
it" in italic serif; the primary is always "Approve with N" (N in mono); a second tap on the pick clears.

**Approvals.** One stack of cards under the block ("Approvals · 2 need you · 4 waiting · Payments"): the
sentence per row with agent and session in serif and the call in a mono chip; gate rows with the stripe as
the only gradient, a plain navy "Release gate" pill with apricot text (apricot edge in dark), the
`irreversible` pill, the quorum meter (filled, outlined next, mono "1 of 2 · avg 4.0") and a chocolate
consequence phrase nowrap ("your 4 grants it", "waits for Ana or Bo"); exec rows with a 44 px full-width
Approve and a quiet Deny; a gate where your vote is in (green check, locked stars, "Change to deny"); a
driver-only external call ("Bo has the baton; this one is his call" · Nudge Bo). The filter bar at the
thumb: Needs you 2 / Gates 2 / Others 2 / All 4 (Others is the complement of Gates). Opening a gate lifts
the sheet over the dimmed queue with the opened row ringed: "The release gate." in serif, the held call in
a navy mono bar with a lock and "held", the rule in plain words, the voices ledger (serif names, italic
quotes, stars, dashed rings for people still to act), the star tiles, the note, the tally line "Your 4
grants it", **Approve with 4** · Deny, "Approve without a pick sends 4 · a 3 is a voice, not a vote". The
rating sheet on the manager page is this same sheet.

**Manager.** The sentence as the titlebar: "4 open sessions across 2 projects. **3 things need you.**" in
23 px serif on navy, counts in white, the needs clause in apricot with a pulsing dot, green ("Nothing
needs you right now.") when quiet, folding to the subtitle "4 open · 3 need you · 212k this week" on
scroll; status tags on `rail-2`; need cards with the stripe, kind, serif sentence, why, who, vote dots and
one button (Rate / Rate / Resolve); tiles two-up with Tokens full width and a sparkline; bars at label 92 /
track 14 / mono value stepped inside Dress Blues with the hand for a lone total only and a 4 px apricot tip
for a session running now, a reading sentence under each; plans, gates, crews, members and agents in one
grid; the quiet state names what the agents are on.

**Chat.** The groups list with a lead sentence, All / Unread / Mentions / Agents replied as chips with mono
counts, rows (44 px emblem with the live dot, serif name + member count, the attributed last line, time in
`--accent` when unread, an apricot count, a chocolate serif "@" disc for a mention); the open group with a
back chevron and the members stack, Bo's number, Cy's steer with the @mention, Cy's agent's reply
("replied · in reply to Cy · turn 4", steps as a quiet ledger "+41 −6 · 9 pass"), "Dee joins #billing" with
the mark, "Ana's agent is working on turn 13"; your messages on the left; the @ sheet above the composer
with people first and agents with their status word; no "Enter sends".

**Widgets.** Head = the disc mark under 24 px, an uppercase label, the count in an apricot pill (grey at
zero, a moon when paused). Needs you rows: who's agent · session in serif, "wants to" + the call in mono,
Gate + segments, "Approve · 4" chocolate with a quiet round Deny. Small Agents: "3 running" then one line per
agent with a status dot. Small Tokens: the figure in mono, "of 200k · 57.4k left", the apricot meter; over
budget turns red with "nothing stops" moved to the foot. States: empty (closed ring, "Nothing waits for
you."), paused (moon), just granted (drawn check, "Your 4 granted it"), stale (hollow dots, "As of 9:26 ·
reconnecting", never a guess). Lock screen: "2 approvals · 3 running · 142.6k" above the clock, monochrome
but the apricot pulse. Approve from a widget is the same vote as in the session (sends the default 4);
under a rule that needs a note it opens the sheet.

**Copy.** "2 need you · 4 waiting · Payments", "your 4 grants it", "waits for Ana or Bo", "Bo has the
baton; this one is his call", "Nothing needs you right now.", "Two mentions wait for you in #billing and
#invoice-pdf", "Nothing waits for you.", "As of 9:26 · reconnecting".

**Fix before build.** Mobile-rail: fold the claims, the `--edge` hairline in dark. Mobile-approvals: the
pill in navy, Others the complement of Gates. Mobile-session: the gate survival chip, the merged Team
button, the mark on the screen. Mobile-manager: re-hue the bars, the rating sheet is the approvals sheet.
Mobile-chat: the tab bar is the frame (no menu badge), "Agents replied" as a chip, the viewer is Ana, phones
at 390 × 844. Widgets: the disc mark under 24 px, the truncated over-budget line, mono figures. Tokens v6
carries the dark triplet with 18 % washes, `--apricot-deep → --apricot` in dark, the scrim, the gate
stripe's apricot inner edge and the `--edge` hairline.

---

## Appendix A · Surfaces outside the window

Not screens of the app, but every panel asked that they speak the app's sentence. From `email-digest`
(surfaces panel, **8.25 keep**), `slack-templates` (**7.25 revise**), `pr-template` (**7.25 revise**),
`pricing-page` (**6.5 revise**), `landing` and `docs-site` (unjudged):

- The sentence first, everywhere: every off-platform surface opens with `copy.team.summary`; the Slack text
  fallback, the email subject + preheader and the PR comment's first line carry it whole.
- One message, edited in place: a Slack root and a PR comment are the session's address; buttons go when
  the decision lands, the result line takes their place with "(edited)"; add an `(edited)` state to the
  app's notice component.
- The five-part anatomy for any host: emblem · product name · the sentence · a context line · actions,
  then the link last as a link. Never "bot", never "@mention".
- Votes as rows; the verdict computed from the rule; `DEFAULT_RATING = 4` is the product's and the Slack
  adapter must send it (today it sends 5); no surface pre-selects a number with a primary colour; stars as
  ★★★★☆ glyphs where the host cannot draw ours.
- Mocks render what the host renders: Slack, GitHub and email in the host's type and controls; the brand
  lives in the emblem and the words. The PR mock must be literally what the Markdown template produces.
- The digest gets its join moment ("Cy joined Monday with her agent · crew Invoice rollout is Ana + Cy")
  and the Slack session thread its join line, since joining is the selling moment.
- Pricing defines the seat once, by role (driver or owner, per the kernel's Role lattice), and the
  estimator and the invoice are the same ledger.

## Appendix B · Tokens v6, the patch every panel asked for

Land these in `design/henosis/tokens.css` before the next wave; six pages carried four different dark
status sets because they were missing.

```
/* mark: brand constants, never var(--accent) */
--mark-disc: var(--rail); --mark-arc-a: #56352D; --mark-arc-b: #E2C4A6; --mark-dot: #E2C4A6;
/* dark: keep the disc #2A3244 (chocolate on #0F131B is 1.7:1) */
/* status inks for any word in a status colour (light) */
--ok-ink: #3F6A3B; --warn-ink: #7F5320; --danger-ink: #8A3A30; --info-ink: #5B6273;
/* --ink-3 is metadata only, 12px floor */
/* dark block */
--rail: #10141C; --rail-2: #1A2030; --rail-line: rgba(243,237,228,.08);
--canvas: #1A202C; --surface: #242C3C; --line: rgba(240,234,224,.14);
--edge: inset 0 1px 0 rgba(255,255,255,.055);   /* in place of shadows on raised surfaces */
--accent: #7A4B3E; --accent-fg: #FFF8F1;          /* the dark hand; apricot stays the pulse */
--gradient-brand: linear-gradient(135deg, #3A4661 0%, #7A4B3E 100%);
--ok: #9BC88F; --warn: #E2B06A; --danger: #E2847A;  /* + softs at .18 */
--apricot-deep: #E2C4A6;                            /* apricot-deep → apricot in dark */
--out-bg: #0E1218;                                  /* the agent's output block, deepest surface */
--gate-stripe: linear-gradient(180deg, #E2C4A6, #56352D);
--scrim: rgba(0,0,0,.52);                           /* light: rgba(42,50,68,.42) */
--mention-agent: #3A4458;                           /* light: #2A3244 */
/* selection and cursor */
--select-wash: rgba(226,196,166,.30); --select-line: rgba(207,167,130,.5);
/* focus: 2px var(--accent) outline, offset 2, --team-glow as the halo; dark: 2px var(--ink) */
/* badge (OS red, declared): --badge: #E0463A */
/* keyframes: dot-live, orbit-1/2/3, weave-slide/over/under, card-in; one guard:
   @media (prefers-reduced-motion: reduce), :root[data-motion="calm"] — the (data-motion="calm")
   media query in v5 is invalid */
/* collisions: rename .rail .section → .rail-section; .avatar.agent vs rail .agent; the presence dot is
   .pr; --canvas-wash as a blurred disc, not a radial gradient */
```

## Appendix C · Open questions for the founder

1. Memory: who may **Keep this** (driver, owner, or any contributor)?
2. Approvals: does one deny hold an otherwise granted gate until withdrawn, or only count against the
   average? The tally's sentence must follow the kernel's fold.
3. Approvals queue: is there an owner override on a driver-only approval, per risk class?
4. Composer offline: hold and replay directives in order (new kernel behaviour with a safe-point rule), or
   "Not sent · kept here until you are back · Resend"?
5. Mentions: does a group role lift a mention above contributor rank in the session?
6. Policy: per project (the settings picker) or per team?
7. Crews: may a crew span a team's projects (welcome-agent draws it; the spec says per project)?
8. Project budget: the spec has only branch budgets; the project page and the usage page assume one.
9. Pricing: the seat is a driver or an owner; confirm before the page is rebuilt.
10. Team look: does a low contrast check block Save, or warn and save?
