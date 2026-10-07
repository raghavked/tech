# Judge panel · mobile · 1

Theme: **mobile** (mobile-session, mobile-rail, mobile-chat, mobile-approvals, mobile-manager, widgets).
Judged against BRIEF.md and tokens.css v5, with every PNG opened (light, dark, mobile, and mobile-chat's
groups shot; the widgets board was cut into four slices to read it at full size) and each page's style and
markup read. Scores are 1–10 for on-brief (vibrant, unity, palette roles), craft (alignment, type, states),
truth to the product, and distinctiveness from claude.ai, ChatGPT and Linear. Explorations were not edited.

| Exploration | On-brief | Craft | Truth | Distinct | Overall | Verdict |
|---|---|---|---|---|---|---|
| mobile-rail | 9 | 8 | 10 | 8 | 8.8 | keep |
| mobile-approvals | 8 | 9 | 9 | 9 | 8.8 | keep |
| mobile-session | 9 | 8 | 9 | 8 | 8.5 | keep |
| mobile-manager | 8 | 8 | 9 | 8 | 8.3 | keep |
| mobile-chat | 8 | 8 | 8 | 7 | 7.8 | revise |
| widgets | 7 | 7 | 8 | 8 | 7.5 | revise |

Shared facts, checked once: all six use `../../tokens.css` plus a page style and no scripts; five of six
draw the two-arc mark (mobile-session has no mark anywhere, which is the one brand gap in the set); every
phone screen that carries a gradient carries the brand one (New session, New group, the gate stripe), with
the exception noted under mobile-approvals. The five app pages share one top block to the pixel: a 48px
status bar and a 44px bar on `--rail`, a menu button with the needs-you count as an apricot disc, a serif
title at 19–22px with a 12px subtitle in `--rail-muted` whose status word is the rail's green `#9BC88F`,
and a 40px right control on `--rail-active`. That block is the set's biggest win: the frame stays Dress
Blues on a phone without a rail, and the brief's palette roles survive the fold. Three things the set does
not agree on, and that the carry-forward settles: how a phone navigates (five pages use the menu button
and a drawer, mobile-chat adds a four-tab bar as well), what the needs-you number counts (3 on session,
rail, chat and manager; 2 on approvals and widgets), and what a bottom sheet looks like (24px corners on
`--surface` in mobile-rail, 26px on `--surface` in mobile-approvals, 28px on `--canvas` in mobile-manager,
with three different star tiles and two different button labels, "Approve with 4" and "Approve at 4").

---

## mobile-rail · 8.8 · keep

**What it is.** A board of four phones: the rail as a 332px navy drawer over the session (open, and
scrolled with the account menu up), and the Team panel as a cream sheet with two detents (half for Bo's
handoff offer and the people, full for the crew and the chat). Light, dark and a 390px cut of the drawer.

- **On-brief 9.** The frame opens rather than changes: the drawer is the desktop rail's markup at 44px rows,
  the you row pinned under a hairline, the one gradient on New session. Apricot keeps one meaning in both
  overlays (solid for what waits: the menu's 3, Inbox 2, Approvals 1; a wash for where you are: the active
  card, the handoff offer); chocolate is the hand (the driving flag, Accept, the send). The crewmate as a
  navy tile inside the cream sheet is the team-panel pattern carried over intact.
- **Craft 8.** The drawer's order is exact and the counts are mono chocolate-on-apricot discs; spend past
  80% warms to amber on Checkout proration; away rows dim avatar and name together; "Cy joins" is an
  italic divider; the input's glow is the team glow. Misses: the h2 says the half sheet is 400px while the
  CSS makes it 424px; the full sheet is, by the notes' own count, 24px short of holding the crew line, so
  "Leave crew" is absent from the shot; in dark the drawer (`#161B26`) against the scrimmed canvas has no
  edge of its own and reads only by its shadow; the theme segment in the account menu is 12px type on a
  28px control, under the 44px target the rest of the drawer keeps.
- **Truth 10.** Owner / reviewer / engineer roles, who drives and since when, "Hand off" only on the row
  that can take the baton, Bo's offer with the one sentence about what accepting means, claims with the
  one held by Cy's agent in warn, Payments memory with its conflict as an amber hint, the account menu's
  calm mode and Team look with the team name, "Kept in the session log. Never sent to the agent."
- **Distinct 8.** No competitor's phone app has a people-and-crew sheet under a session; the navy drawer
  with serif crew names and a crewmate tile is ours. The drawer's top half (brand, who · where, search,
  Inbox, Approvals) is close to a generic mobile nav until the agent cards begin.
- **The fix that matters.** Fold the crew's claims by default in the full sheet (the section header already
  says "proration · 1 conflict") so the crew line with "Leave crew" and the last three chat lines fit at
  844px; and give the drawer an `--edge` hairline in dark so the frame has a visible edge over the page.

## mobile-approvals · 8.8 · keep

**What it is.** The queue as one stack of cards under the navy block, a four-way filter at the thumb, and
the release gate as a sheet over the dimmed queue for the opened row; `#closed` shows the queue alone with
every row decidable in place. Light, dark, and the closed queue at 390.

- **On-brief 8.** The sentence per row in serif with the call in mono, the quorum meter with the outlined
  next segment, the consequence phrase in chocolate ("your 4 grants it", "waits for Ana or Bo"), the pick
  lit apricot with the glow, and "2 need you" as the only apricot in the top block: the roles are right.
  The miss is the gradient. Each gate row carries the navy→chocolate stripe and a gradient "Release gate"
  pill, so the closed queue shows the brand gradient four times on one screen, against the brief's one.
- **Craft 9.** The best-built page in the set: 44px row buttons and a 50px sheet primary, the consequence
  phrase nowrap with ellipsis so it never wraps at 390, the voices ledger with dashed rings for people
  still to act and a solid apricot ring for you, the star tiles with their words (risky … ship it) in the
  aria labels, the dark block lifting the status triad and `--apricot-deep` and giving the gate pill an
  apricot edge, the opened row ringed above the scrim. One leak: the filter counts do not add up. Needs
  you 2, Gates 2, Others 1, All 4; the exec row is in neither Gates nor Others, so "Others" is not the
  complement of "Gates".
- **Truth 9.** "A 3 is a voice, not a vote", "Approve without a pick sends 4", Dee as "viewer · a voice,
  not a vote", the held call in the navy bar with its lock, a driver-only external call with "Bo has the
  baton; this one is his call", a gate where my vote is in with "Change to deny". The notes admit "Nudge
  Bo" has no kernel event; good that it is said.
- **Distinct 9.** A multi-rater quorum ledger with a consequence phrase, on a phone, with four row states
  in one list: nothing in claude.ai, ChatGPT or Linear decides anything this way.
- **The fix that matters.** Make the stripe the gate's whole signature and set the "Release gate" pill in
  navy with apricot text (apricot edge in dark), so a queue of gates carries one gradient per row at most
  and the pill stops competing with the irreversible pill; at the same time make Others the complement of
  Gates (exec and external both, so Gates 2 + Others 2 = All 4).

## mobile-session · 8.5 · keep

**What it is.** The session on a phone: the rail folded into the navy top block with a strip (Team pill,
token hairline, crew), the stream anchored to the latest moment, the plan as a one-line ledger, the release
gate with five 48px star tiles directly above a composer that keeps Agent/Team and the scope chip.

- **On-brief 9.** The top block is the frame, the page is cream, and apricot is only the pulse: the menu's
  3, the Team pill, the crew name, the live plan dot, the picked star with the glow. Chocolate is "Approve
  with 4" and the send and nothing else. No gradient on the screen is allowed by the brief and reads calm
  here. The one brand gap: there is no mark on the screen at all; every other page puts it somewhere.
- **Craft 8.** The gate is the right phone form: irreversible chip, Bo's vote with stars and note in one
  line, the tiles filled up to the pick, "4 if you leave it" in italic serif, the two gate segments, a
  full-width primary beside a quiet Deny. The plan line with step dots and "11.9k of 13.2k est." is the
  ledger at 390. Two duplications: "Team" is said twice in the block (the strip's "Team · with Bo" pill
  and the Team button with the stack), and the human message says "goal" twice (italic serif in the meta
  and a chip inside the bubble). The strip hides presence; the notes already ask the question.
- **Truth 9.** Running · turn 7 · Ana drives, 12.4k / 20k with the hairline, the three tool steps with the
  publish waiting, "needs two contributors at 4+ on average", 1 of 2 raters, the steer composer with the
  scope chip. The gate is only visible because the stream is column-reverse; once two more messages land
  it scrolls away and nothing in the top block says a gate waits.
- **Distinct 8.** The navy block with a live subtitle, serif title and token hairline is a frame no chat app
  has; the star tiles and the team wash keep it from claude.ai's phone. The composer alone is generic.
- **The fix that matters.** Give the gate a survival rule: when the pending gate scrolls out of view, a
  "1 waits for you" chip in apricot appears in the strip (where the duplicated Team pill is now) and taps
  back to it; merge the Team pill into the Team button ("Team · with Bo" with the stack) so the strip has
  room for the chip and for Ana · Bo · Cy presence.

## mobile-manager · 8.3 · keep

**What it is.** Four phones: the manager's sentence as the title of the navy block with the status tags
and the range; the page scrolled (tokens by person, plans, gates); the rating sheet from a need-you card;
and the quiet state with today's tiles and the roster.

- **On-brief 8.** "4 open sessions across 2 projects. 3 things need you." in 23px Instrument Serif on
  navy, with the needs clause in apricot and a pulsing dot, is the strongest brand moment in the whole
  mobile set, and it turns green when nothing needs you. The need cards carry the right stripes (apricot
  plan, gradient gate, red contention). The miss is the chart: the legend says "chocolate: the hand, and
  the only chart hue", and the pages panel already ruled the other way (bars stepped inside Dress Blues,
  the hand for a lone total). On this page the hand is both the Rate buttons and the token bars, so the
  colour that means "press me" fills four bars nobody presses.
- **Craft 8.** Bars label 92 / track 14 / mono value with the apricot tip for a live session and a reading
  sentence; plans with SVG stars and green "under" or amber "+38%"; gates with a dashed empty voter; the
  roster two-up. The sheet diverges from the set's: `--canvas` with 28px corners, star tiles as white
  bordered boxes with the chosen ones on the wash (a third tile style), "Approve at 4" where every other
  page says "Approve with 4", and "Later" as its secondary. The range pill is 34px, under target, as the
  notes say. The Project / Person / Agent segment and "Tokens by" collide at 360px.
- **Truth 9.** A contention card with "the loser's claims release and its session pauses on the file", a
  plan that "waits for two ratings", estimate against actual, "Your name goes on the release", a quiet
  state that names what the agents are on so the page is never empty. Per-person tokens in the roster do
  read as a league table; the notes ask, the panel says show them in the chart only.
- **Distinct 8.** A sentence as the titlebar and a rating sheet with the diff's file list are not things
  Linear's or claude.ai's phone views do. The tiles and bars are ordinary once past the sentence.
- **The fix that matters.** Re-hue the bars to the pages panel's rule (stepped Dress Blues, chocolate only
  for a lone total, the apricot tip stays) and make the rating sheet the approvals sheet: `--surface`,
  26px corners, the same star tiles, "Approve with 4" with Deny quiet, "Later" as the close.

## mobile-chat · 7.8 · revise

**What it is.** Two phones on one frame: the groups list (needs strip, All / Unread / Mentions, rows with
emblem, serif name, attributed last line, counts, an "Agents replied" section, a tab bar) and #billing
(Bo's number, Cy's steer with the @mention, Cy's agent's reply, a join line with the mark, "Ana's agent is
working on turn 13", the @ sheet over the composer).

- **On-brief 8.** Apricot is the pulse (counts, the mention highlight, the needs strip, the live dot on an
  emblem, the selected @ row); chocolate is the "@" badge, the send and the faint tint of my own bubble;
  one gradient on New group. The tab bar's apricot counts are the only colour in it, as the notes say.
- **Craft 8.** The row anatomy is exact and the agent reply ("replied · in reply to Cy · turn 4", text
  indented under the avatar, steps as a quiet ledger) is the desktop agent-reply carried to 390 well. The
  misses: the board phones are drawn at 408 × 862, not the brief's 390 × 844 (the mobile shot is 390, so
  the markup is fine, the board lies); "Enter sends" in the composer is a desktop sentence on a phone;
  the keyboard is not drawn, so the @ sheet sits where the keyboard would be and the home bar is where the
  keyboard's bottom would be; "Agents replied" is a section of a different kind inside the groups list.
- **Truth 8.** Mentions that wait, an agent member's live dot on the group emblem, an agent's answer with
  its turn number, "Dee joins #billing" with the mark, the @ sheet offering a person and then her agent
  with its status word. Two slips: the viewer is Cy here (my bubble is Cy's) and Ana on every other page;
  and the menu button carries a 3 while the Approvals tab carries a 3 and Chats a 2, so the same screen
  shows the needs-you count twice in two navigations.
- **Distinct 7.** The closest page to its neighbours: a groups list with emblems, counts and a four-tab bar
  reads as iMessage or Slack until the serif names and the agent reply arrive. The needs strip with the
  mark and the "@" in chocolate are the parts that are ours.
- **The fix that matters.** Decide the phone's navigation and draw it once. The panel's call (see carry-
  forward 2): the tab bar is the phone's frame and the rail drawer hangs off Sessions, so remove the needs
  badge from the menu button here, let the Approvals tab carry the one count, and make "Agents replied" a
  filter chip beside Mentions rather than a list section. Set the viewer to Ana and drop "Enter sends".

## widgets · 7.5 · revise

**What it is.** The home screen with three widgets in place (Needs you medium, Agents and Tokens today
small), then a 390-wide board: small sizes and their states (empty, over budget, paused, just granted,
stale), medium, large, the lock screen, the macOS menu-bar panel, and a spec table.

- **On-brief 7.** The grammar is right: who's agent · session in serif, "wants to" with the call in mono,
  Gate with its segments, "Approve · 4" in chocolate beside a quiet round Deny, counts in apricot, the
  apricot meter, "nothing stops" on an over-budget. The miss is the mark. The widget head draws the ring
  without its disc at 18px, chocolate and navy on cream, and at that size two arcs of near-equal
  darkness read as a plain circle: the brand's one symbol is lost in its own widget. The lock screen
  promises an apricot pulse that iOS renders monochrome, so the page's one live colour will not survive
  there. The home screen's app icons carry eight gradients, which is OS chrome, not Henosis, but the brief's
  "one gradient per screen" should at least be stated as waived for the home screen.
- **Craft 7.** Small and medium are tight and the states are a family (hollow dots and "As of 9:26" for
  stale, the moon for paused, a drawn check for granted). Misses seen in the shots: the over-budget small
  reads "12.4k over · nothing sto…", truncated; the two small widgets set their big number in different
  voices (Agents "3" in serif 34, Tokens "142.6k" in mono 26); the Needs-you small's "Release gate ▭▭ 4
  min" is one row doing three jobs at 158px. The page honestly notes the `<use>` presentation-attribute
  trap that made the first pass render the ring as a disc.
- **Truth 8.** Refresh on push versus timeline, Approve as an App Intent that sends the default 4, counts
  as "decisions I can still make", mentions never badging a widget, `/api/glance` as a missing endpoint:
  this is a widget spec, not a picture of one. The lock-screen tint is the one untrue promise.
- **Distinct 8.** No competitor ships approval widgets with a quorum, or a menu-bar panel that approves. The
  home screen itself is a stock iOS pastiche, which is fine for context.
- **The fix that matters.** Give the mark a small-size form and use it everywhere under ~24px: the disc
  variant (navy disc, chocolate and apricot arcs, apricot dot), which still reads at 14px in the menu bar
  and the lock-screen inline line; then fix the over-budget line (drop "· nothing stops" to the foot) and
  pick one number voice (mono) for every small widget's figure.

---

## Carry forward

Patterns the system should adopt from this panel, in the order they should land in tokens.css and the
component set.

1. **The phone's top block is settled.** 48px status bar + 44px bar on `--rail`; a 40px menu button at the
   left; a serif title (19px on a session, 22px on a page) with a 12px subtitle in `--rail-muted` whose
   status word is `#9BC88F`; a 40px right control on `--rail-active` with a hairline (the Team stack, the
   range, the members stack); an optional strip (Team pill, mono tokens with a 3px hairline, crew in serif
   apricot). All five app pages already share it to the pixel.
2. **One navigation for the phone.** A four-tab bar (Sessions, Chats, Approvals, Me) is the frame; the rail
   drawer (332px, the desktop rail at 44px rows, the you row pinned) opens from Sessions. The needs-you
   count lives on the Approvals tab, mentions on Chats; the menu button carries no badge. Session,
   approvals and manager adopt the bar; mobile-chat drops the duplicated menu badge.
3. **One needs-you number.** Decisions I can still make: approvals I can vote on plus handoffs offered to me
   (widgets' rule). Mentions never count. The app badge, the tab, the manager's sentence and the lock-screen
   line all show the same figure; the manager's "3 things" becomes that count plus contentions only when
   the viewer is the lead.
4. **One bottom sheet.** `--surface`, 26px top corners, a 40×5 handle, 16px gutters, scrim `rgba(42,50,68,.46)`
   (black at 58% in dark), half and full detents with the drawer head (title with the live dot and summary,
   a Team | Details segment where it applies), actions 50px with the primary full-width and the secondary a
   quiet pill, one line of fine print under. mobile-rail, mobile-approvals and mobile-manager fold into it.
5. **The star tile.** Five-up grid at 48–50px, 12px corners; off tiles `--surface-2` at .55, tiles up to the
   pick on `--apricot-soft` with the star in `--apricot-deep`, the pick solid apricot with a chocolate star
   and the team glow; the words (risky, unsure, fine, good, ship it) in the labels; "Good · 4 of 5" or "4 if
   you leave it" in italic serif beside "Your rating". The primary is always "Approve with N" (N in mono).
6. **The gate row.** The sentence (agent and session in serif, the call in mono), the stripe as the gate's
   only gradient, a plain "Release gate" pill in navy with apricot text, the irreversible pill in the danger
   wash, the quorum meter (filled segments, the next one outlined, mono "1 of 2 · avg 4.0") and a
   consequence phrase in chocolate, nowrap. Filters are Needs you / Gates / Others / All with Others the
   complement of Gates.
7. **The agent card in the drawer** is the desktop card at 76px: status dot, name, Team/Solo pill, one line
   of what it is on with the named thing in italic serif apricot, with-whom, mono spend that warms to amber
   past 80%; crews first with the ring glyph, Solo as a pill.
8. **Counts and badges.** Apricot 20px discs with mono chocolate numbers for what waits; a chocolate disc
   with a serif "@" for a mention; time in `--accent` when a row is unread; a live dot on an emblem or an
   avatar when an agent member is running (green) or waiting (amber).
9. **Charts on the phone** keep the pages panel's rule: label 92px / track 14px / mono value, bars stepped
   inside Dress Blues with the hand for a lone total only, a 4px apricot tip for a session running now, a
   reading sentence under every chart. mobile-manager re-hues.
10. **The sentence as a titlebar.** 23px Instrument Serif on navy, counts in white, the needs clause in
    apricot with a pulsing dot, green when nothing needs you; folds to a subtitle on scroll. Adopt for the
    manager and for any page that has one sentence to say.
11. **The widget grammar and the small mark.** Rows read who's agent · session in serif, "wants to" + the
    call in mono, Gate + segments, "Approve · N" chocolate with a quiet round Deny; small widgets set their
    figure in mono; states are empty (closed ring), paused (moon), granted (drawn check), stale (hollow
    dots, "As of"). Under 24px the mark is always the disc variant.
12. **Dark overrides into tokens v6.** `--ok #8FC487`, `--warn #E2B06A`, `--danger #E2847A` with their
    washes at 18%, `--apricot-deep → --apricot` in dark, the scrim at black 50–58%, a gate stripe with an
    apricot inner edge, and an `--edge` hairline for navy overlays over a dark page. mobile-approvals has
    the block; make it the token.
