# Henosis design system · v5

The synthesis of the design wave: 72 explorations, twelve judge panels, one file. This document is the
spec a front-end engineer implements in `apps/web/src/tokens.css`; the proposed file is beside it as
`design/henosis/tokens.v5.css`, written so that every selector and every custom property the app
reads today still resolves. Explorations are cited by slug (`design/henosis/explorations/<slug>`);
where two explorations disagreed, the judged winner is the rule and the loser is named.

Contents: 1 Principles · 2 Colour tokens · 3 Type · 4 Space, shape, depth, layout · 5 The mark ·
6 The rail · 7 Surfaces and messages · 8 Notices · 9 Plan card · 10 Rating control · 11 Pills, counts,
status, keys, mentions · 12 Avatars · 13 Loaders · 14 Motion · 15 Team customisation · 16 Dark ·
17 Frames (desktop, mobile) · 18 Accessibility contract · 19 Migration notes for apps/web · 20 Open.

---

## 1. Principles (the rules everything else is derived from)

1. **Four jobs, stated once** (colour-system, brand-board). Dress Blues is the frame, cream is the
   page, chocolate is the hand, apricot is the pulse. Every other value is derived: tints mix toward
   cream, shades toward `#0B0E14`, apricot's shades toward chocolate. Nothing is a fifth colour.
2. **Apricot has one meaning** (rail, badges-status, navigation panel). A solid apricot count means
   *something waits for you*. An apricot wash with a hairline ring means *where you are / what Enter
   will do*. An apricot dot or glow means *alive*. Nothing else in the chrome is apricot.
3. **The dot carries the colour, the word stays ink** (badges-status, colour-system). Five status
   words, no synonyms; the colour lives in the dot. A coloured word, when it is ever needed, takes an
   `-ink` token, never the dot colour (`--warn #B9792E` is 3.4 : 1 on cream; `--warn-ink` is 6.2 : 1).
4. **The hand is a verb** (micro-interactions, accessibility). Chocolate fills the primary action, the
   send, the driving flag and the one key that acts now. Switches, checkboxes, meters and diagrams
   are apricot-deep or surface-3, so a filled chocolate thing always means "press me".
5. **Colour by ground, never by theme** (brand-board). The mark's arcs recolour per ground (navy,
   cream, apricot, chocolate) and the centre is the lightest colour present; the theme never changes
   an arc. Status colours do change by theme, because they sit on the canvas.
6. **Named things are serif** (every session, chat and page winner). People, agents, crews, groups,
   sessions, projects, "Goal", "to the team", "Cy joins the circle". Sans for what is read, mono for
   keys, counts, commands, spend, hashes and times. Three fonts carry three kinds of thing in a row.
7. **One gradient per screen, and the rail's New session already is it** (onboarding, pages, mobile
   panels). Stripes, border-images, pills and avatars never take the gradient; the release-gate stripe
   is the one exception because it *is* the gate's signature, and then the "Release gate" pill is plain
   navy with apricot text.
8. **Rest is the end state** (motion-spec, micro-interactions). Every animation ends at the element's
   natural styles, so Calm mode and reduced motion are one guard and keep every end state.
9. **Dark is re-weighed, not inverted** (session-dark, dark-mode). Rail < canvas < surface; a 1 px top
   highlight instead of shadows; apricot as a hairline and a 9–16 % wash; cream ink, not white; a
   lifted chocolate hand so the hand and the pulse stay two things at night.
10. **Distinctiveness guard** (brand panel, session panel). Cream + chocolate + Instrument Serif alone
    sits next to claude.ai. The navy frame, the apricot pulse, the two-colour ring, the team message as
    a third voice and the multi-rater gate are what pull it away: keep navy dominant, never lift
    chocolate toward terracotta (`#B27A66` is retired from illustration), never put "you" on the right.

---

## 2. Colour tokens

Every token below exists in `tokens.v5.css` with the light value in `:root` and the dark value in both
dark blocks. The "app alias" column lists the name `apps/web/src/styles.css` reads today; it is kept as
`var()` of the canonical token so nothing in styles.css has to be renamed on day one.

### 2.1 Palette (names, never used directly by a component)

| token | value | note |
|---|---|---|
| `--fondant` | `#56352D` | Chocolate Fondant 19-1432 |
| `--apricot` | `#E2C4A6` | Apricot Illusion 14-1120 |
| `--blues` | `#2A3244` | Dress Blues 19-4024 |
| `--cream` | `#FBF7F1` | |
| `--night` | `#0B0E14` | the end of every shade ramp (colour-system) |

### 2.2 Canvas (the page)

| token | light | dark | role | app alias |
|---|---|---|---|---|
| `--canvas` | `#FBF7F1` | `#1A202C` | the page | `--bg` |
| `--wash` | apricot 35 % | apricot 10 % | the one wash, painted as a blurred disc by `.main::before` (loading-screens' flat-pixel technique replaces the dithered radial gradient; `--canvas-wash` stays as the fallback for pages that paint `body`) | `--wash` |
| `--surface` | `#FFFFFF` | `#242C3C` | a card, a bubble, a sheet, the palette | – (new) |
| `--surface-2` | `#F4EEE5` | `#2C3547` | raised: hover, composer, field | `--bg-2` |
| `--surface-3` | `#ECE3D6` | `#37425A` | pressed: segment track, off star tile, the empty quorum segment | `--bg-3` |
| `--out-bg` | `var(--rail)` | `#0E1218` | the agent's tool output block: the deepest surface in both themes (session-dark) | – |
| `--ink` | `#1F2634` | `#F0EAE0` | text; cream at night, never white (dark-mode) | `--fg` |
| `--ink-2` | `#5B6273` | `#B4BAC6` | meta lines, captions, hints | `--fg-2` |
| `--ink-3` | `#6A7183` | `#9CA3B2` | metadata only, 12 px floor, never a sentence (accessibility lifted it from `#8E94A3` at 2.85 : 1 to 4.6 : 1; colour-system wrote the rule) | `--fg-3` |
| `--line` | navy 12 % | cream 14 % | every hairline except the crease; dark goes to .14 so row dividers survive (dark-mode) | `--line` |
| `--edge` | `none` | `inset 0 1px 0 rgba(255,255,255,.055)` | the top highlight that replaces shadows at night (session-dark); appended to every raised surface's `box-shadow` | – |

### 2.3 Frame (the rail and everything navy)

| token | light | dark | role | app alias |
|---|---|---|---|---|
| `--rail` | `var(--team-surface)` = `#2A3244` | `#10141C` | the rail, titlebars, toasts, the output block, the mark's disc; the darker night rail is the one three navigation explorations re-derived so Dress Blues stays the frame at night (rail's fix) | `--rail-bg` |
| `--rail-2` | `#333C50` | `#1A2030` | hover, the account menu, the collapsed rail's hover card | `--rail-hover` |
| `--rail-fg` | `#F3EDE4` | `#F0EAE0` | text on the rail | `--rail-fg` |
| `--rail-muted` | `#AEB4C2` | `#8E95A5` | secondary text on the rail (6.6 : 1 light) | `--rail-fg-2` |
| `--rail-active` | apricot 18 % | apricot 12 % | where you are (rail) | `--rail-active` |
| `--rail-line` | cream 10 % | cream 8 % | hairlines on the rail | `--rail-line` |
| `--crease` | `var(--team-highlight)` | highlight 55 % | the one apricot hairline between rail and canvas | `--crease` |

### 2.4 The hand

| token | light | dark | role |
|---|---|---|---|
| `--accent` | `var(--team-hand)` = `#56352D` | `#7A4B3E` | fills: `.btn.primary`, `.send`, the driving flag, `.kbd.live`, Keep this, Return to now. The dark value is session-dark's lifted chocolate (6.9 : 1 with `--accent-fg`), chosen over the v5-draft's apricot so "Approve with 4" is never the same colour as the live step beside it |
| `--accent-hover` | `#6B4339` | `#8A5748` | |
| `--accent-fg` | `#FFF8F1` | `#FFF8F1` | text on the hand |
| `--accent-ink` | `var(--accent)` | `#CAA49B` | the hand as **text**: links, the Goal label, "You" in chat, "to the team", the consequence phrase. `#7A4B3E` is only 2.3 : 1 as text on the dark canvas, so text takes chocolate 300 (hue 12°, S 31 %, L 70 %; 7.2 : 1), a dusty brown that is clearly not apricot. `a { color: var(--accent-ink) }` |

On the brand gradient (`.hero`, `.hero-card`, `.on-gradient`) the hand is apricot with navy ink,
stated once in tokens as the brand panel asked: chocolate vanishes on navy→chocolate.

### 2.5 The pulse and selection

| token | light | dark | role |
|---|---|---|---|
| `--apricot-deep` | `#CFA782` | `#E2C4A6` | apricot 600: the count on cream, the driver ring, the gutter stripe of the keyboard cursor, the preview star; at night it is plain apricot (mobile panel) |
| `--apricot-soft` | apricot 30 % | apricot 16 % | the team wash, the chosen scope, the joining wash, the Planning pill. App alias `--highlight-soft` |
| `--glow` | `0 0 0 4px` team-glow 35 % | same | the halo on a focused composer, a picked star tile, a dragged card. App alias `--glow` (now a full box-shadow value) |
| `--select-wash` | apricot 16 % | apricot 12 % | the wash on a selected row, chip, palette row, search hit (navigation panel's `--select-wash`) |
| `--select-line` | apricot-deep 50 % | apricot 38 % | the hairline ring with it |
| `--live-line` | transparent | apricot 35 % | the 3 px bar beside the live step and the team message at night (session-dark) |
| `--team-wash` | `var(--apricot-soft)` | apricot 9 % | the team message's ground |
| `--pill-team-bg` / `-fg` | `#E2C4A6` / `#56352D` | apricot 18 % / `#E2C4A6` | the Team pill: solid by day, apricot text on a wash by night |
| `--count-bg` / `-fg` | `#CFA782` / `#2A3244` | `#E2C4A6` / `#2A3244` | the pending count (badges-status): apricot-deep on cream so it does not melt into the page, apricot on navy, navy ink in both |
| `--star-on` / `--star-pre` | `#B4865C` / `#CFA782` | `#E2C4A6` / `#CFA782` | the picked star and the hover preview (accessibility's star fill at 3.0 : 1 on cream; rating-control's "preview lighter than the pick") |
| `--highlight` | `var(--team-highlight)` | same | app alias for the pulse |

### 2.6 Gradients

| token | light | dark |
|---|---|---|
| `--gradient-brand` (app alias `--grad`) | 135° `--team-surface` → `--team-accent` (navy → chocolate) | 135° `#3A4661` → `#7A4B3E`, one notch up on both ends (session-dark; dark-mode's `#343E52 → #6B4339` loses to the pairing with the dark hand) |
| `--gate-stripe` | `var(--gradient-brand)` | 180° `#E2C4A6` → `#7A4B3E` (apricot → chocolate; navy → chocolate is invisible on navy) |
| `--gradient-warm` | apricot → cream | same |
| `--gradient-live` | apricot · apricot-deep · apricot at 200 % | same; the hairline's weave while a turn is spending (token-meter) |
| `--grad-fg` | `#F8F2EA` | same |

### 2.7 Status (one triplet, with inks)

| token | light | dark | note |
|---|---|---|---|
| `--ok` / `--ok-soft` / `--ok-ink` | `#4F7D4A` / 14 % / `#3E6639` | `#9BC88F` / 18 % / `#9BC88F` | running, approved, under estimate |
| `--warn` / `--warn-soft` / `--warn-ink` | `#B9792E` / 14 % / `#7F5320` | `#E2B06A` / 18 % / `#E2B06A` | awaiting, over 80 %, over estimate, a contention, an average under the bar |
| `--danger` / `--danger-soft` / `--danger-ink` | `#A8463A` / 14 % / `#8E3A30` | `#E2847A` / 18 % / `#E2847A` | blocked, denied, irreversible, over 100 %; red only for a human no or a conflict |
| `--info` / `--info-soft` / `--info-ink` | `#5B6273` / 14 % / `#4A5162` | `#B4BAC6` / 16 % / `#B4BAC6` | paused |
| `--badge` | `#E0463A` | same | the OS's red for the Dock and tray badge only (first-run-desktop); never inside the window |
| `--dot-idle` / `--dot-closed` | `--ink-3` / ink-3 62 % | same | the hollow ring and the faint ring (agent-card) |

The dark triplet is settled as the rail's own tints `#9BC88F / #E2B06A / #E2847A` with `.18` softs
(system panels 1 and 2, pages panel). Eight explorations shipped seven candidate sets
(`#8FC487`, `#8FC386`, `#7FB376`, `#7DB577`, `#8CC283`, `#EA9384`, `#D9766A` …); all are retired. In dark
the `-ink` tokens equal the dot colour because the lifted tints clear 7 : 1 as text on the canvas.

### 2.8 Overlays, scrims, focus

| token | light | dark | role |
|---|---|---|---|
| `--overlay` / `--overlay-edge` | `--surface` / `--line` | `#242C3C` / white 6 % | the palette, a sheet, a menu: at night a lit surface with `--edge` and a 6 % hairline instead of a shadow halo (command-palette, shortcuts, search) |
| `--scrim` | navy 46 % | black 55 % | under a sheet or the palette; no blur (mobile panel, navigation panel) |
| `--dim` | navy 52 % | black 62 % | the look-here layer for the tour, the first approval and the palette's "show me" (tour) |
| `--halo` | `0 0 0 3px apricot, 0 0 0 10px apricot 28 %` | same | the one lit target under the dim |
| `--focus-ring` | `var(--accent)` | `var(--ink)` | 2 px outline, offset 2; chocolate by day, cream by night so focus never borrows the pulse (accessibility's fix, micro-interactions rebuilt on it) |
| `--focus-halo` | team-glow 45 % | same | the 6 px halo outside the ring; the Team look editor recolours this, never the ring |

### 2.9 Mentions

| token | light | dark |
|---|---|---|
| `--mention-person-bg` / `-fg` | apricot-soft / `#56352D` | same |
| `--mention-you-bg` / `-fg` | `#E2C4A6` / `#56352D` | same |
| `--mention-agent-bg` / `-fg` | `#2A3244` / `#F3EDE4` | `#3A4458` / same (chat panel: four of five pages pasted `#3A4458` by hand) |

### 2.10 Paper (print-export)

`--paper-bg #FFFFFF`, `--paper-ink #1F2634`, `--paper-ink-2 #5B6273`, `--paper-cream #FBF7F1`,
`--paper-line`, `--paper-green #3E6639` (kernel rows), `--paper-amber #7F5320` (masked secrets).
Paper is `color-scheme: light`, never apricot, never a gradient, never a shadow; the mark on paper is
the cream variant (`.on-paper`) or one ink with a dotted agent arc (`.mark-ink`, `--mark-dash: 4 6`).

---

## 3. Type

Three voices (type-scale): Instrument Serif says *who*, Instrument Sans says *what*, JetBrains Mono
says *how much*. Fourteen steps, each a `font:` shorthand with a line height on the 4 px beat.

| token | value | used for |
|---|---|---|
| `--t-display` | 400 40/44 serif | page h1 |
| `--t-title` | 400 26/32 serif | section h2, the Team sheet's "The release gate." |
| `--t-name` | 400 20/24 serif | the plan card head, the drawer's crewmate, the topbar title |
| `--t-name-sm` | 400 16/20 serif | `.msg .meta .who`, people rows, crew names |
| `--t-body` | 400 15.5/24 sans | the agent's prose, measure `--measure: 600px` |
| `--t-text` | 400 15/24 sans | everything else that is read (body default) |
| `--t-ui` | 500 14/20 sans | buttons, rail items, row titles |
| `--t-caption` | 400 13/20 sans | meta lines, doing-lines, hints |
| `--t-micro` | 500 12/16 sans | the rail foot, roles, "you" |
| `--t-kicker` | 600 11.5/16 sans, .08em caps | section headers (AGENTS, PAYMENTS, IN THIS SESSION), the notice kind |
| `--t-mono` | 400 13/20 mono | tool lines, commands, the token chip, keys |
| `--t-mono-sm` | 400 12.5/16 mono | estimates, times, turn numbers, ids (one size smaller than the name beside them) |
| `--t-figure` | 500 28/32 mono | a stat tile's value (data-viz-style's serif value loses to the type rule) |
| `--t-figure-lg` | 400 40/44 mono | the Usage block's big number |

Rules: serif is weight 400 with italic as its only emphasis; sans 400/500/600 by job; mono 400 with
500 for a total; `tabular-nums` on every mono number; a true minus. On the phone (`≤ 480`) body and
text go to 16/24, name-sm to 18/24, display to 32/36 and title to 22/28, and inputs are 16 px so iOS
does not zoom. The sentence-as-titlebar on the phone is 23 px serif on navy (mobile-manager).

---

## 4. Space, shape, depth, layout

- **Space**: a 4 px beat, `--s-1 … --s-9` = 4 8 12 16 20 24 32 40 56. Card padding 18/20 (the type
  board's open question about the 2 px drift inside cards is accepted). Stream gap `--stream-gap 26px`.
- **Radii**: `--radius-sm 6` (keys 5, kind chips), `--radius 14` (rail items, cards in the rail, tiles),
  `--radius-lg 22` (cards, bubbles, notices, the composer), `--radius-sheet 26` (every bottom sheet),
  `--radius-full`. The agent's shape is `--radius-agent: 9px 9px 9px 3px` (tight bottom-left corner),
  `7 7 7 2` at 26 px and below, `8 8 8 2` on the agent mention.
- **Depth**: `--shadow-soft 0 10px 30px navy 8 %` (cards, buttons on hover), `--shadow-pop 0 18px
  50px navy 16 %` (composer, overlays). In dark both go black and heavier and every raised surface adds
  `--edge`. Soft shadows are allowed by the brief; palette-reduced screenshots are not (desktop panel).
- **Layout**: `--col 780px` with `--gutter 24px` fixed (desktop panel; the app's 760 becomes 780);
  `--rail-w 296px`, `--rail-collapsed 72px`, `--drawer-w 340px` (the app's 320 becomes 340, team-panel),
  `--lane-w 364px` (keyboard-first's right lane), `--rail-sheet 332px` (the phone's rail drawer).
  `--sidebar` is kept as an alias of `--rail-w`.
- **Breakpoints, written once** (desktop-compact): 1180 the rail folds to 72; 960 compact (topbar drops
  words, Team and Details become 34 px icon buttons); 720 the drawer overlays at 300 with a scrim; 480
  phone (rail becomes a 332 px sheet, overlays become bottom sheets). Add 40 px hysteresis and let
  `[` `]` pin the choice. The column and gutters never give way; the rail and the drawer do.

---

## 5. The mark

**File.** `design/mark.svg` does not exist yet and every board cites it; ship the brand board's five
`<symbol>` cuts as that file (brand panel, carry-forward 1):

| symbol | geometry (96 grid) | use |
|---|---|---|
| `#mark` | disc r46, arcs r28 stroke 10, centre r7 | default, 32 px and up |
| `#mark-small` | disc r48 (to the edge), arcs r29 stroke 13, centre r8.5 | 20–31 px: rail brand at 24, chips, avatars |
| `#mark-tiny` | no disc, arcs r32 stroke 16, centre r10; the ground is the disc | below 20 px: favicon, tray, the 18 px widget head (widgets' fix: under ~24 px always the disc form) |
| `#mark-bare` | no disc, arcs r30 stroke 12, centre r8 | on a coloured ground that is the disc (app icons, the hero at 160) |
| `#mark-mono` | `currentColor`, agent's arc at 55 % (or dotted via `--mark-dash`) | tray template, print |

**Colour reaches a `<use>` only through custom properties** (print-export's fix): `--mark-disc`,
`--mark-arc-a`, `--mark-arc-b`, `--mark-dot`, `--mark-dash`. Page CSS cannot style inside the shadow
tree; every board re-checks its marks at 3× in both themes before shooting.

**Arc roles are brand constants.** Person = chocolate `#56352D`, right, 12→6 clockwise. Agent =
apricot `#E2C4A6`, left. Centre = the lightest colour present. `--mark-arc-a: #56352D` in tokens,
never `var(--accent)` (the v5 draft's `var(--accent)` turned both arcs apricot in dark: the brand
board's first misuse tile). The word is "centre", never "bead" (app-icons' 31 "beads" are renamed).
The disc keeps Dress Blues `#2A3244` in dark: the draft's `#0F131B` dropped chocolate-on-disc to 1.7 : 1.

**Colour by ground** (brand-board's table, as ground classes on bare cuts; a disc is always "on navy"):

| ground | person's arc | agent's arc | centre |
|---|---|---|---|
| navy (the disc) | chocolate | apricot | apricot |
| cream `.on-cream` | chocolate | navy | apricot |
| apricot `.on-apricot` | chocolate | navy | cream |
| chocolate `.on-choc` | apricot | navy | apricot |
| paper `.on-paper` | chocolate | navy | apricot, on a cream disc |
| any non-palette ground | keep the disc | | |

On the navy rail at 22 px the chocolate arc takes a 62 % lift toward apricot (`.rail .mark .arc.a`),
the one place the arc is tinted, kept from the app.

**Size ladder.** Default from 32; small cut 20–31; tiny below 20; no swing below 24 (the closed mark
fades in over 200 ms); emblem only at 48 and up (team-emblems' fix: a crest for 48+, the centre dot at
32 and below, so a team is identified in the shell by its two arc colours, not by initials).

**States** (onboarding panel, owned by the brand board): faint ring → one arc → two arcs apart
(`.mark.apart`, ±60°, 50 %) → closed ring with centre (first-run steps); a five-segment ring with a
ghost centre (tour); apart arcs with a dashed ghost centre (`.mark.ghost`: server gone). A ghost centre
means "not yet in the circle, or the circle cannot be seen"; the dot pops only on a join.

**Joining** is the tokens' own animation, see §14: `.mark.joining` (loop), `.mark.joining.once` (a
join, a first load), `.mark.settle` (0.8 s arrive). The joining line (welcome-agent, members-drawer):
a 30 px mark playing arcs-close, a serif sentence with the name in chocolate, the time in mono; the
same line for a person, an agent or a session, and the toast is the same sentence on navy. Leaving is
a quiet divider with no motion.

---

## 6. The rail

The rail is the team's roster, not a menu (rail, 7.5 keep; the frame is drawn once and every page uses
this rail, not a local redraw: search, project-page and agent-profile re-ordered it and should not).

**Order, top to bottom** (pages panel carry-forward 9): brand row (mark at 24, "Henosis" in 24 px serif);
`.new` New session on the one gradient (the `N` cap lives in the tooltip, not through a ring); Search
(⌘K); Inbox and Approvals with apricot counts; **AGENTS** with crews first (`.crew`: a 9 px hollow
apricot ring, the crew name in 15 px serif apricot, "Ana and Bo") then solos, every card titled by its
session (agent-profile's "Ana's agent" titles lose); the project section (Overview, Usage, Inbox,
Approvals, Groups, Memory with its conflict count); Chats with unread per group; the **me row** last
(serif name, "owner · driving *Invoice PDF*", the account menu from its three dots).

**One row, four states**: rest in `--rail-muted`; hover on `--rail-2` with the icon warmed to apricot;
active on `--rail-active` with an inset `--select-line` hairline; keyboard focus as the ring (§18).

**The agent card** (`.agent`, agent-card 7.5 revise, drawn from one definition for rail, palette,
search, project page and the collapsed rail's hover card):

- head: 8 px status dot · serif session name 15.5 · amber mono badge or the Solo/Team pill;
- `.doing`: the italic serif lead word in apricot ("*Writing proration.ts* · step 3 of 4"), plain tail,
  clamped at two lines; the dot, the status word and the lead always agree;
- `.foot`: the stack capped at three with the driver ringed in apricot-deep, "with Bo", and
  `.tokens` in mono at the end with a 2 px hairline (`--spent`) that warms to `--warn` past 80 % and
  `--danger` past 100 %;
- six dot states from `.dot`: running (filled, green, the only one that moves), awaiting (filled amber
  with a halo), blocked (red), paused (slate), idle (hollow ring), closed (hollow ring at 62 %), plus
  offline (dashed). All promoted to tokens so the pages stop re-declaring hexes.

The card rule is `.agent:not(.avatar):not(.msg)` so it can no longer reach an agent avatar or an
agent message (brand carry-forward 11's collision).

**Collapsed rail (72 px)** (desktop-compact 8.3): the same order as avatars with the status dot at the
corner and the active one ringed; the project initial in serif apricot; counts as corner discs; the
hover card in `--rail-2` with serif name, Team pill, italic doing, rating count and mono spend, opened
after a 400 ms rest and placed beside the stream, never over the live message.

**Phone**: the rail is a 332 px navy sheet over the session with a "who · where" line, 44 px rows and
the me row pinned; in dark it carries an `--edge` hairline so the frame has an edge over the scrimmed
page (mobile-rail 8.8). The four-tab bar (Sessions, Chats, Approvals, Me) is the phone's frame; the
needs-you count sits on the Approvals tab, mentions on Chats, nothing on the menu button.

---

## 7. Surfaces and messages

**The three message shapes** (session-view, locked by the session panel):

| shape | drawing |
|---|---|
| human `.msg.human` | a white `--surface` bubble with a hairline and `--shadow-soft`, `align-self: flex-start` always (chat-view's right-aligned "you" is the iMessage shape and loses); the Goal label in italic serif `--accent-ink`; a mono scope chip in the meta; your own messages (`.mine`) only a slightly warmer wash and "you" as a meta word, never a side |
| agent `.msg.agent` | no bubble; prose at `--t-body` with `--measure 600`; a step grid (`.step`: 14 px icon, mono line, mono result right-aligned; the live step on `--apricot-soft` with the `--live-line` bar); a navy `.out` output block that is the deepest surface on screen in both themes |
| team `.msg.team` | on `--team-wash` with "to the team" in italic serif, never reaching the agent; at night a 9 % wash with a 22–35 % apricot hairline |

**One right-hand meta rule**: people carry a time (`.when`, mono 12.5 ink-3); the agent carries
"turn N · step k of m" (`.turn`); the viewed turn in replay carries "turn N · time · you are here".

**Other surfaces**: `.card` (surface, hairline, `--shadow-soft` + `--edge`); `.card.navy` / `.drawer .tile`
(the crewmate as a navy tile inside cream, team-panel); `.hero` / `.hero-card` (the one gradient, the
hand turned apricot, the mark's disc deepened to `#1C2230`, no radial glow on top); `.empty` (a 5 px
chocolate stripe, never the gradient); `.wash` (the joining wash: an apricot-soft block with the mark
and a serif sentence, with a dark variant that keeps the pulse rather than greying, agent-profile);
`.overlay` / `.palette` / `.sheet` / `.menu` (`--overlay` with `--overlay-edge`; sheets 26 px corners,
a 40 × 5 handle, 16 px gutters, half and full detents, a 50 px full-width primary beside a quiet pill,
one line of fine print; one sheet for mobile-rail, mobile-approvals and mobile-manager).

**The drawer** (`.drawer`, 340 px, team-panel 8.8): one drawer, two faces (Team | Details) on a `.seg`
in the drawer head with the live dot and count; section headers (`h3`) carry their summary in `.sum`
("2 here · 1 away", "proration · 1 conflict", "25 % · about 37.6k left"); Memory, Catch-up and the
Branches file list collapsed by default; Usage moves above Branches when the budget is past the 80 %
tick; each branch row has one labelled action plus a menu; the chat input pinned with "Kept in the
session log. Never sent to the agent." Every child of `.drawer .group` is `flex: none` (welcome-agent's
collapsed brief).

**The title row** (`.topbar`): serif title · status with turn · Team pill "Team · with Bo" · the mono
token chip ("12.4k tokens", faint percent, a 3 px `.hair` with the 80 % tick, colour only when the
budget turns; a pulsing apricot dot, never a turning ring, while spending: token-meter's fix) · the
presence stack with the driver ringed · Team and Details buttons lit with `--apricot-soft` (`.btn.on`)
when open.

**The lede** (pages panel): serif h1, then one sentence in the manager's voice with the hot thing bold,
counts medium, token figures mono and one link; the range control top right drives every number.
**The attribution line** (`.attribution`): "added by *Bo* · session invoice-pdf-3 · commit 0c8d44 ·
Billing page", name in serif, session and commit in mono, scope last so it wraps.

---

## 8. Notices

`.notice` is one card with a 4 px stripe by kind, and the stripe says the kind before the words do:

| kind | stripe | where |
|---|---|---|
| plan waits (default) | `--apricot` | the plan card, "The plan waits for two ratings" |
| release gate `.gate` | `--gate-stripe` (the gate's only gradient; the "Release gate" pill is plain navy with apricot text, mobile-approvals' fix) | the approval under a gate |
| contention `.contention` | `--warn` (settled; manager-overview's red loses to project-page's amber) | contention and handoff notices |
| denied / conflict `.denied`, `.danger` | `--danger` | a human no, branches that disagree |
| quiet `.quiet` | `--surface-3` | superseded, resolved |

Anatomy (session-view, approvals-queue, approval-notice): `.kind` kicker ("RELEASE GATE"); a serif
sentence with the thing in italic; the `.command` in mono on `--surface-2` with the `irreversible` pill
beside it; `.origin` tag when the gate reached you from another session ("# billing · steered from the
group", "Waiting in Checkout"); the rule in one sentence; others' votes as rows (§10); the `.quorum`
meter (filled apricot segments, the next one outlined, mono "1 of 2 at 4+ · avg 4.0", amber under the
bar); `.actions` with the one primary ("Approve with 4"), the secondary verb quiet, Reject/Deny as a
ghost in `--danger-ink`; "step 4 of 4 · Migrate stored invoices" on the notice so the gate and the plan's
pending row are one object (session-view's fix). `.edited` state for a notice whose buttons went when
the decision landed (surfaces panel: one message, edited in place).

**The bad-moment sentence** (error-states): what happened with a time, what still works, what Henosis
is doing, one chocolate action; "as of HH:MM" stamped on anything stale; presence dimmed to 45 %;
grey for the network, amber for what waits, red only for a human no or a conflict. The composer under a
dead socket says "Not sent · kept here until you are back" with one Resend until the product commits to
holding and replaying directives.

**Toasts** (`.toast`, notifications 7.5): navy, a crease by kind, the serif who, the sans sentence, mono
for the call, the `.acts` row on one line (`nowrap`; Open becomes an icon when tight), the apricot `.life`
line draining over 8 s for news; decisions stay and carry `y` / `n`; beyond three, a navy tail counts
what waits. One sentence at three distances: toast, banner, inbox row, the same words.

---

## 9. Plan card

`.plan` (plan-card, session-view): a ledger that lives in one shape through four moments (proposed,
approved/running, done, revision asked), the stripe carrying the state (apricot, green, surface-3).

- **Head**: serif title 20, status word with the dot, the rule in mono ("needs 2 at 3+").
- **Step row** `.pstep`: grid `22px 1fr auto auto auto` = number ring · title + detail · risk pill ·
  `.used` · `.est`. The ring is a hairline when pending, apricot-ringed with a halo when running, green
  with a white check when done, dashed chocolate when it waits at the gate (`.gate`). `.used` is ink,
  "so far" in `--accent-ink` while running, `--warn-ink` over estimate (never red), `--ok-ink` under;
  `.est` is faint mono with a tilde. The irreversible step's detail says "waits at the release gate" so
  the plan and the gate point at each other.
- **Risk words** as `.pill.risk`: read (neutral), write (apricot-soft), exec (navy 12 %), external
  (warn-soft, warn-ink), irreversible (danger-soft, danger-ink), all mono.
- **Totals**: `.budget` with the actual fill, the estimate tick, the 80 % tick and "14.1k of 40k";
  budget counts input + output only, cache never moves it; "Soft budget · nothing stops at 100 %" once
  in the foot.
- **Rating row**: your `.stars` and a note; "1 of 2 ratings · 4.0 average · waiting · needs 2 at 3+"
  in mono; `.raters` as chips with a serif name, mini stars and the quoted note, people who have not
  rated as dashed `.rater.missing`; "approved by the team's ratings" in `--ok-ink`, "approved by Ana" in
  serif when an owner overrides.
- **Decisions**: Approve now (primary) only while proposed; Ask to revise and Reject stay while
  approved (Reject is a ghost in danger ink); one line under them says what each does to the agent.
- Phone: risk and estimate fold under the detail; stars and progress share one row.

---

## 10. Rating control

`.stars` (rating-control, accessibility, approvals-queue) is one control everywhere a vote is taken:
five SVG stars in one radiogroup with roving tabindex (Unicode `★` is retired from manager-overview and
agent-profile), 1.5 px outlined when empty, `--star-pre` on preview, `--star-on` when picked; a
hairline `.tick` after the third star marks the gate threshold under a ratings rule; the `.word`
beside it in italic serif says what the pick does (Not yet, Risky, Fine, Good, Ship it; coloured by
level with the `-ink` tokens) and doubles as the accessible name ("4 of 5, Good"); the button carries
the number it sends ("Approve with 4") with "4 if you leave it" as the hint; keys: arrows preview,
1–5 jump, Enter picks, 0 clears; sizes `.sm` (queue, inbox, palette), default (plan card, notice),
`.lg` (sheet). The low-rating nudge asks for a note at 1 and 2 without blocking.

**Votes as rows** (surfaces panel): serif name, role in faint sans, italic note, stars plus the number;
an observer's approve dimmed as "a voice, not a vote"; the verdict line computed from the rule.

**The star tile** (`.star-tiles`, mobile panel): five-up at 48–50 px with 12 px corners; off tiles
`--surface-2` at .55; tiles up to the pick on `--apricot-soft` with the star in `--apricot-deep`; the
pick solid apricot with a chocolate star and the team glow; the words in the labels; the primary is
always "Approve with N". `DEFAULT_RATING = 4` is the product's; no surface pre-selects a number with a
primary colour, and the Slack adapter must send 4, not 5 (slack-templates).

---

## 11. Pills, counts, status, keys, mentions

- **`.pill`**: 22 px (18 `.sm`, 26 `.lg`), 11.5 caps-ish sans 600. `.team` on `--pill-team-bg`;
  `.solo` outlined; `.planning` apricot-soft with a slow apricot dot; `.status` variants carry an ink
  word on the tinted ground with the dot carrying the colour, in both themes (badges-status' fix);
  `.irreversible` mono on danger-soft; `.gate` navy with apricot text (an apricot edge in dark).
- **`.count`** (and the app's `.pill.badge`, now the same thing): the pending count, mono 600 on
  `--count-bg` with navy ink, 20 px (16/18/24 as `.xs .sm .lg`), absent at zero, 99 + cap, pops on
  change; counts only what you can act on (approvals, handoffs, unread). `.count.at` is the chocolate
  serif "@" for a mention (mobile-chat).
- **`.status`** (dot + word, 13 px ink-2) and the bare `.dot` at 6/8/10/12: the five drawings in §6.
- **`.chip`** 28 px on surface-2; `.on` is `--select-wash` with the inset `--select-line`.
- **Selection grammar** (`.selected`, `.cursor`, `.rowitem.cursor`, micro-interactions, memory-browser's
  fix): wash at `--select-wash` + inset 1.5 px `--select-line` + a 3 px apricot-deep gutter stripe, the
  row hint in `--ink-2`; pointer hover is `--surface-2` so hover and keyboard selection show at once;
  keys never while you type. One component shared by the approvals queue and the memory browser.
- **Keys** (`kbd`, `.kbd`, keyboard-first, shortcuts): 20 px mono caps on `--surface` with a hairline and
  a 1 px drop, inside the button at the right (`.btn .kbd`); `.live` filled with the hand for the one
  key that acts now; `.pressed` apricot; in the rail on `--rail-2`; hidden on touch. The `.mode` chip
  ("Keys live" / "Typing") is the one mode indicator. An irreversible action from another session takes
  two presses (first lights the card and prints "`a` again approves · `esc` leaves it").
- **Mentions** (`mark.mention`, chat panel): a person on apricot-soft with chocolate text (7 px radius);
  `.you` on solid apricot; `.agent` on navy in serif with the agent's corner.
- **Matches** (palette, search): weight and ink (`600`, `400` inside serif names), never a background.

---

## 12. Avatars

`.avatar` (avatar-system 7.3 revise, chat panel): one element, two shapes. A person is a circle
(initials, serif from 40 px up, on a palette wash); an agent is the rounded square with the tight
bottom-left corner on the brand gradient. State is a dot (`.pr`, bottom-right, cut out with
`--avatar-edge` set by the ground: canvas, surface, rail, team wash), a ring (`.driver`, 2 px
apricot-deep: the baton) or a fade (`.off`, 45 %, desaturated) and never a tint change. The agent's
face: below 40 px only the apricot centre (`::after`); from 40 px (`.lg`, `.xl`) the true mark is inset
inside the gradient square (ui.tsx `Mark`), never a cream arc (the judge's fix). `.missing` is the dashed
empty avatar for the voice not yet heard. Stacks overlap 8 px, order driver → people → agents, four then
"+n"; agent tiles get a 2 px canvas seam and the dot on the outer corner so it never lands on a
neighbour (groups-list). Sizes `.xs 18 · .sm 22 · 28 · .lg 40 · .xl 56`.

---

## 13. Loaders

Four loaders, each with a meaning (loading-screens 8.75, the wave's most product-true board):

| class | meaning | where | still frame | copy |
|---|---|---|---|---|
| `.loader.join` (the mark, `arcs-close`) | the app joins you | app launch 120 px, the splash 160, a join line 48, the rail brand 28 | the closed ring | "Opening the circle." |
| `.loader.orbit` (three dots converge, 54 px) | you join people | the page centre on a first join, nowhere smaller (the judge's fix: 18 px orbits drift toward chat "thinking" dots) | three dots stacked as one | "Joining Bo, Cy and Dee in Billing page · Checkout." + "1,204 of 2,310 events folded" |
| `.loader.halo` (18 px apricot dot pulsing) | a small wait | inline, a toast, reconnecting, a chat opening | the dot | "Reconnecting · Bo still has the baton." |
| `.loader.weave` (two strands) | rows arrive | under a title, 3–4 px | a plain strand | "Opening Payments. 3 of 5 sessions in" |
| `.loader.shimmer` | words arrive | only the lines where the summary will land | flat lines | "Bo's agent is uniting pdf-layout into main. About a minute." |

Rules: copy names who and what, never "loading"; counts, not bars; after 8 s a cause, after 30 s one
chocolate action; loading is never a blank page (the rail is live while a session joins, finished steps
stay checked while one runs). The orbit's first dot is `--ink` (not navy) so it survives the dark
canvas; its chocolate dot is a fixed `#56352D`.

---

## 14. Motion

**Clocks and curves** (motion-spec, micro-interactions): `--t-fast 120` hover and focus, `--t 200`
press and toggle, `--t-slow 320` arrive and settle. Plain `ease` for colour and shadow; `--ease-mark
.3,.9,.3,1` for anything that moves; `--ease-arrive / --ease-leave / --ease-move` kept for the app.

**One guard.** `@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }`
wraps every animation, and `[data-motion="calm"]` is a selector (the v5 draft's `(data-motion="calm")`
media query was invalid CSS and never matched: mark-motion, motion-spec). Rest states are written once
outside the guard: `.draw { stroke-dashoffset: 0 }`, the closed ring, the stacked dots, the slid thumb,
the apricot row. Under Calm or reduce nothing animates and every end state stays.

**Keyframe vocabulary** (the app's names are the vocabulary; the draft's `orbit`, `converge`, `rise`
are retired and `.rise` now plays `card-in`):

| keyframes | duration · curve | trigger | calm shows |
|---|---|---|---|
| `arc-a` `arc-b` `dot-in` | 1.8 s `--ease-mark`, 15 % hold, arcs from ±60° (mark-motion's fix for the muddy crescent at 48 px), overshoot −4° / +2°, the centre only after the ring is one (60 %) | `.mark.joining`; `.once` for a join or first load | the closed ring |
| `arc-a-once` `arc-b-once` `dot-once` | 0.8 s / 1 s `--ease-arrive` | `.mark.settle` | the closed ring |
| `orbit-1/2/3` | 1.5 s `--ease-move` | `.loader.orbit` | dots stacked |
| `halo` | 1.8 s | `.loader.halo` | the dot |
| `weave-slide` `weave-over` `weave-under` | 1.4 s linear / 0.7 s | `.loader.weave` | a plain strand |
| `weave` | 1.2 s linear | `.hair.live`, `.budget.live` while a turn spends | the filled hairline |
| `shimmer` | 1.5 s | `.loader.shimmer` | flat lines |
| `card-in` | 320 ms `--ease-arrive`, staggered 36 ms × `--i` (max 8) | `.agent.enter`, `.notice.enter`, `.msg.enter`, `.rise` | the card |
| `dot-live` | 1.8 s | every running dot (`.dot.running`, `.status.running`, `.avatar .pr.running`) | the green dot |
| `pulse` | 1.8 s | the Keys-live chip, the Planning pill, `.mark.live .dot` | the dot |
| `pop` | 320 ms `--ease-arrive`, 1.15 overshoot | `.count.pop`, `.pill.badge` | the count |
| `ripple` | 0.9 s `--ease-leave`, once | `.avatar.joined` | nothing |
| `toast-up` / `drain` | 320 ms / 8 s linear | `.toast`, `.toast .life` | the toast, no line |
| `draw` | 450 ms | `.draw`, `.ic.draw path` (a granted check) | the drawn check |
| `pressed` `word-in` `fade-in` `ring-draw` | 450 / 320 / 500 ms | `.send.pressed`, `.pill .w`, the hero, the tour ring | the end state |

**The join timeline** (motion-spec): line 0–320 ms, arcs 0–800, dot 550–1000, ripple 900–1800, badge
and pulse from 1000, Team pill crossfade only on the first join; nothing overlaps the mark's swing except
its own line; leaving has no motion.

**Side motion**: press is a sink (send scale .92 then the message rises; a star fills then pops; a chip
sinks by scale), release is the meaning; the Agent/Team toggle tints the composer on the mark's curve;
drag lifts ×1.02–1.25 with `--shadow-pop` and the team glow and lands in a dashed apricot slot; the
long-press ring (400 ms linear) is a platform expectation and stays off the index.

---

## 15. Team customisation

A lead sets three dials (team-emblems, team-look-editor): an accent, a highlight and a surface, from
curated pairs, with live checks computed by the product's own `contrast()` (team-look-editor's fix: a
hand-typed 4.2 : 1 shipped where the real value was 2.6 : 1). Variables, all registered or derived:

| variable | default | what it moves |
|---|---|---|
| `--team-accent` | `#56352D` | `--team-hand` → `--accent`: the hand on cream |
| `--team-highlight` | `#E2C4A6` | glows, selection, the crease, the Team pill, the halo of the focus ring |
| `--team-surface` | `#2A3244` | the rail, the mark's disc, the dark end of the gradient |
| `--team-glow` | highlight | the halo colour (`--glow`, `--focus-halo`) |
| `--team-hand` / `--team-hand-fg` | accent / `#FFF8F1` | the hand as a fill and its text; on the dark canvas the editor's `--p-hand` is the highlight and `-fg` flips to the surface colour |
| `--team-mark-ring` / `--team-mark-bead` | the agent's / the person's arc | kept as aliases for the app's `Mark`; teams recolour glows and selection, **never the brand mark's arcs** |
| `--motion` | 0/1 | 1 only under the one guard; Calm sets `data-motion="calm"` on `<html>` |

Checks (the checks table as the system's contrast control): accent and highlight 3 : 1 on the disc,
4.5 : 1 as text on cream and on the dark canvas, 3 : 1 between the two arcs; a fix line names the
nearest passing hex with a one-tap Use; warn, never block, and the save bar says who will struggle.
The emblem is a crest at 48 px and up only; the preview is a slice of the shell painted only through
`--p-*` variables; changed rows take the apricot wash + CHANGED tag + a save bar that counts and names
the changes. The `.rail .new` reset must also reach the preview's `.prail .new`.

---

## 16. Dark

The dark block (byte-identical under the system media query and `[data-theme="dark"]`) is the fold of
session-dark's knobs, dark-mode's proposal and the navigation panel's rail: rail `#10141C` < canvas
`#1A202C` < surface `#242C3C` < surface-2 `#2C3547` < surface-3 `#37425A`, with the output block
`#0E1218` as the one thing deeper than the canvas; `--edge` on every raised surface; `--line` .14; cream
ink; the hand `#7A4B3E` as a fill and `#CAA49B` as text; apricot-deep → apricot; the status triplet
`#9BC88F / #E2B06A / #E2847A`; the brand gradient `#3A4661 → #7A4B3E`; the gate stripe apricot →
chocolate; the mark's disc held at `#2A3244`; scrim black 55 %, dim 62 %; the focus ring cream.
"Shape keeps the hand and the pulse apart": filled pills are the hand, dots, rings, hairlines and
washes are the pulse; never an apricot text link beside an apricot pill. Boards prove both themes with
pinned `.t-light` / `.t-dark` panes (dark-mode), which the tokens now provide.

---

## 17. Frames

**Desktop** (desktop panel): default window 1280 × 840 with the navy rail from the top edge; macOS
hiddenInset traffic lights in the rail, the brand row dropped 32 px, the title row as the drag region
(buttons `no-drag`); Windows a 36 px `--rail` titlebar with the mark and "Henosis" only, 46 × 36 caption
buttons, the rail brand row hidden. The OS keeps its own colours: Henosis owns the tray icon (template
/ linen), the attention dot, the badge count (decisions only: approvals + handoffs) and the strings;
menu highlights, taskbar underlines, notification buttons and the Dock badge (`--badge`) stay native.
One cast: Billing page is Ana's (with Bo), Checkout Bo's (with Ana), Invoice PDF Cy's, Tax lines Dee's;
Ana Moreau, Bo Lindqvist, Cy Okafor, Dee.

**Mobile** (mobile panel): the top block is 48 px status bar + 44 px bar on `--rail`, a 40 px menu
button left, a serif title 19–22 with a 12 px `--rail-muted` subtitle whose status word is `#9BC88F`, a
40 px right control on `--rail-active`, an optional strip (Team button "Team · with Bo" with the stack,
mono tokens with the 3 px hairline, a "1 waits for you" apricot chip when the pending gate has scrolled
away). One needs-you number (approvals I can still vote on + handoffs offered to me; mentions never
count) on the app badge, the Approvals tab, the manager's sentence and the lock screen. Charts on the
phone keep §7's chart rule: bars stepped inside Dress Blues, the hand for a lone total only, an apricot
tip for live, a reading sentence. Under 24 px the mark is always the disc form; widget figures are mono.

**Charts** (data-viz-style 6.8 revise, usage-charts, manager-overview): one component; in/out stacked
bars with navy and chocolate stepped at the family's saturation (~S26–31, near `#45527A` and `#8A4A3C`
on cream; `#3B66A8` cobalt is retired), a 2 px surface gap; the hand only for a lone series; `--bar-agent`
for the agent series; texture as the second discriminator before any new hue; a reading sentence and a
table under every chart; the hover readout replaces the row's value column; deltas in ink with the sign,
coloured only against a budget; stat tile = label · mono value · small unit · a detail line.

**Off-platform** (surfaces panel): every surface opens with `copy.team.summary`; one message edited in
place; the five-part anatomy (emblem · product name · sentence · context line · actions, link last);
mocks render what the host renders (Slack, GitHub and email in the host's type; the brand in the emblem
and the words).

---

## 18. Accessibility contract

- **Contrast**: every text/ground pair in this file is at or above 4.5 : 1 for text and 3 : 1 for
  components, with the named exceptions `--ink-3` (metadata only, 12 px floor) and apricot-on-cream
  (never text; the brand board's 1.5 : 1 "never" pair). Status words take `-ink` tokens.
- **Focus**: 2 px `--focus-ring` (chocolate / cream) with offset 2 and a 6 px `--focus-halo`; the
  composer, the search field and the palette query show focus on their wrapper (`focus-within` glow).
- **State in words beside every colour** (accessibility): hidden text in the status dot, a sentence on
  the Team pill and the presence stack, `role="meter"` on budgets, one composed label per rail card, the
  send button named after the toggle, stars as one radiogroup, approvals and gates announced once via
  the polite `.toasts` region, the Loader's `role="status"`.
- **Keys** never fire while a field has focus; irreversible actions from elsewhere take two presses.
- **Motion**: the one guard; every end state survives Calm and reduce; the granted check is drawn
  (`stroke-dashoffset: 0`) when motion is off.
- **The tour** ends, not pauses, when an approval arrives: the dim lifts, the approval takes the halo.

---

## 19. Migration notes for apps/web

`tokens.v5.css` is a drop-in for `apps/web/src/tokens.css`: every selector the app file defined is
still defined (the comparison was run against the app file's selector list), and every custom property
`styles.css` reads resolves (`--bg/-2/-3`, `--fg/-2/-3`, `--rail-bg/-fg/-fg-2/-fg-3/-hover/-press/-line/
-active`, `--highlight/-soft`, `--glow`, `--grad/-fg`, `--crease`, `--focus-ring/-halo`, `--sidebar`,
`--ok/--warn/--danger/--info`, `--t/-fast/-slow`, `--ease-*`, `--team-*`, `--mark-*`, `--fondant`,
`--apricot`, `--blues`, `--cream`). The only per-element inputs (`--i`, `--spent`, `--left`) are set by
markup.

Changes the app will see on day one, all deliberate:

| what | before | after | why |
|---|---|---|---|
| `.agent` card rule | reached `.avatar.agent` | `.agent:not(.avatar):not(.msg)` | brand carry-forward 11 |
| `.composer::after`, `.msg.human .text::after`, `.folded` | the "bead" | `content: none`; `.folded` keeps an apricot centre dot | the ring-and-bead is retired |
| `.hero-card::before` | radial glow over the gradient | none | one gradient per screen |
| `--accent` in dark | apricot | `#7A4B3E`; text via `--accent-ink` | session-dark |
| `--ok/--warn/--danger` in dark | `#8FB07A / #DDA363 / #D9826F` | `#9BC88F / #E2B06A / #E2847A` | one triplet |
| `.pill.badge` | warn on white | the apricot count | badges-status |
| `.notice.contention` | highlight ring | amber stripe | pages panel |
| `:focus-visible` | accent ring + 5 px halo | same ring, cream in dark, 6 px halo | accessibility |
| `--col`, `--sidebar`, `.drawer` | 760 / 288 / 320 | 780 / 296 / 340 | desktop and session panels |
| `body` font | `15px/1.6` | `--t-text` 15/24 | type-scale |
| `.stars` | 26 px glyph buttons | SVG stars with `.tick` and `.word` | rating-control |
| `.sidebar` | only | `.sidebar, .rail` share every rule | explorations and app agree |

Follow-ups in `ui.tsx` (not CSS): `Mark` renders the arcs (`.disc .arc.a .arc.b .dot`) from
`design/mark.svg`'s symbols and inset in `Avatar` from 40 px; `Stars` adds the gate `.tick` and the
`.word`; `Loader` gains `kind="halo"` and reserves `orbit` for the page centre; `Status` adds idle,
closed and offline; `ICONS` takes icon-set's manifest (16 grid, 1.5 stroke, 14 px floor for crew and
group); `.sidebar .section` may adopt `.rail-section`. The Slack adapter sends `DEFAULT_RATING` (4).

---

## 20. Open

- `--accent-ink` in dark (`#CAA49B`) is derived, not shot: confirm it on the session page beside the
  apricot pulses before the next wave inherits it.
- The blurred-disc wash (`.main::before`, `filter: blur(110px)`) needs a paint measurement against the
  radial gradient on the fleet board.
- Whether "All" in search is a group cut or a ranked list; whether the Team panel and the token chip
  fold during replay; the rank a group role gives a mention; owner override on a gate ("Decide as owner"
  only when the policy returns an owner-override rule).
- `ring-draw` has keyframes but no rule plays it; keep for the tour's five-segment ring or remove.
- The pricing seat is defined by role (driver or owner); the estimator and the invoice must be one
  ledger.
