# Judging: navigation explorations

Reviewed as a set: `sidebar-variants`, `details-drawer`, `command-palette`, `keyboard-shortcuts`,
`search`, `sessions-list-states`. Each judged on its `index.html`, its `rationale.md`, and the
light and dark captures in `shots100/<slug>/`. Scale 1–10 per criterion; overall is the mean.

**Theme.** All six agree on one row grammar (status dot · title in ink · name or context in grey ·
at most one mark in the right slot), one selection mark (the two-pixel apricot bar), and one filled
control per screen (the send arrow, which drops to ink whenever a sheet or palette is open). That
is the register, and it holds in both themes because every file sits on `tokens.css` rather than
inverting. What is left is convergence, not invention: the explorations disagree with each other on
small things (three different sidebars, two search entry points, a square brand mark in one file, a
drawer with ten text actions) and the product should take one answer for each.

## Scores

| Exploration | Register | Primary action | Restraint | Both themes | Craft | Overall | Verdict |
|---|---|---|---|---|---|---|---|
| command-palette | 9 | 9 | 9 | 9 | 8 | **8.8** | keep |
| sidebar-variants | 9 | 8 | 8 | 9 | 8 | **8.4** | keep (A, with C as collapse) |
| sessions-list-states | 9 | 8 | 9 | 9 | 7 | **8.4** | keep, fix the mark |
| search | 8 | 8 | 8 | 9 | 8 | **8.2** | keep, revise the entry rule |
| keyboard-shortcuts | 8 | 7 | 8 | 9 | 8 | **8.0** | keep, small revisions |
| details-drawer | 8 | 7 | 7 | 9 | 7 | **7.6** | revise |

No rejects. Variants B and C of `sidebar-variants` are rejected as defaults (B entirely, C as a
default), which the exploration itself already does.

## command-palette — keep (8.8)

The strongest of the six. One field over one list, groups as small grey words with a count, a row
that is a 16px line icon, a verb or a name, and grey context on the right. The empty state leads
with the verbs of the session in view, and the second row already says "needs you · 1 of 2 drivers
· cannot be undone" in words, with no red. Typed, the first row offers the words back as a steer,
which makes ⌘K the fastest way to talk to the agent without inventing a form. The selection bar is
the same two pixels the sidebar uses; matches are underlined in apricot, not highlighted; the send
arrow beneath goes to ink. Both captures are clean and the dark palette reads as the same object.
The only craft note is the scrim: in light mode the dimmed column behind the palette is faint
enough that the approval notice beneath still competes slightly. Adopt as drawn, and let it own
"act and jump"; see the search note for the boundary.

## sidebar-variants — keep A, C as the collapsed form (8.4)

A, projects with nested sessions, is the right default for a fleet: the project is the group, the
lead's direction is one italic line under it, and each session row is dot · title · engineer. Rest,
hover, active and collapsed states are all shown and all quiet: hover one tint, active the paper
colour with the apricot bar, no pill anywhere. C's 56px rail with the project crumb in the top bar
is the correct collapse. B is rightly rejected: the switcher hides the fleet and recency is the
wrong order for three engineers in one project; its recency groups belong on the project page.
Craft is good in both themes. Two notes: "Search sessions" is drawn as a field in the sidebar here
but as a row that opens a page in `search`, and the brand lockup is the folded mark here but a
flat square in `sessions-list-states`; take this file's mark and `search`'s row.

## sessions-list-states — keep, fix the mark (8.4)

The most useful system piece in the set: a precedence rule rather than a picture. Left slot is the
status dot (amber, red, green, grey, two bars for a directive pause, faded, hollow, none); right
slot holds one mark, with "you" outranking the unread ink dot, and unread is weight 500 on the
title, never a count. The project page reuses the identical rule with a second line in the agent's
own grammar. No accent is spent anywhere on the list, so the send arrow stays the only strong
colour. Dark mode holds: semantic dots lift correctly and the faded and hollow states still
separate. Craft loses a point for two things visible in the capture: the sidebar's brand mark is a
plain filled square (`.sb .brand .mark` is a `border-radius` box), not the folded corner the brand
doc specifies, and the account row reads "AN" where every other file uses a single letter. Fix
both; adopt everything else.

## search — keep, revise the entry rule (8.2)

A page, not a popover, with one field, scope as three underlined words, and three headings with
counts (Sessions, Memory, People). The memory contention is drawn once as a pair under one apricot
rule with "Ask Dee to resolve" on the heading, which is the right way to show a disagreement.
The results screen has no accent; the empty state has exactly one, the button that turns the words
into a directive. Both themes are clean, the serif on session titles does its job. The revision is
about boundaries, not pixels: `command-palette` also searches sessions and memory when typed, so
the product now has two places that answer "tax". Set the rule that ⌘K is for acting and jumping
(top matches only, Enter opens) and the Search page is for reading the whole answer, and make the
palette's footer say "see all in Search" rather than growing its own list. Smaller: at rest, the
three-column explainer under Recent reads close to a tile row; one line of text would do.

## keyboard-shortcuts — keep, small revisions (8.0)

One sheet opened with ?, four groups in the order of a working day, rows as verb · grey context ·
soft borderless keycaps. The sheet is live (the approval row names the pending delete, the fold row
goes grey and says why), which is exactly the "status as words" rule applied to a reference. The
mac/win pair is in the markup and chosen by a radio, with no detection script. Both captures are
consistent. Revisions: the Mac / Windows segmented control is the only pill-shaped control in the
set and should become two plain words with an underline, matching the scope words in `search`;
"Fold branch into main · schema freeze until Thu" wraps to two lines in a column where every other
row is one, so shorten the context or truncate; the "⌘ [ / ⌘ ]" and "G then P / F / M" rows have
uneven gaps between keycaps. Primary action scores lower only because a reference sheet has none
beyond close, which is as it should be.

## details-drawer — revise (7.6)

The idea is right: five plain lists (Intent, People, Branches, Memory, Catch-up) under small grey
labels, every row with its author or count in grey on the right, the apricot left rule shared with
the contention notice, and the phone sheet as the same lists unchanged. Both themes are
consistent. It loses on restraint and primary action: at 1440 the drawer carries ten quiet text
actions (Pause, Withdraw offer, Invite, Fork, Checkpoint, Fold pdf-layout, Resolve conflict, All
memory, Mark read, Full brief) and three secondary notes in tertiary type, so it starts to read as
the inspector the brand doc says Fold does not have. In the dark capture, "Direction · Schema
freeze until Thursday" and the "Tax source" sub-row wrap under their right-hand meta, breaking the
one-line grammar the rationale promises. Cut actions to one per list at most (the rest live in ⌘K,
which already has them), keep rows to one line by moving meta to a second line only on the phone,
and keep the Catch-up brief and the contention pair exactly as drawn.

## Carry forward into the product

- Sidebar A: projects as groups, lead's direction as one italic line, sessions nested as dot · title · engineer; C's 56px rail as the collapse with the project crumb moving to the top bar.
- The two-pixel apricot bar as the only selection mark, shared by sidebar, palette and session rows.
- Session row precedence: left slot status dot (two bars for a directive pause), right slot one mark, "you" outranks the unread ink dot, unread is title weight 500, never a count; section line says "2 need you".
- ⌘K as one field over one list, verbs of the session first, any typed text offered back as a steer, consequence in words ("needs you · 1 of 2 drivers · cannot be undone"), no red row.
- Search as a page with headings and counts instead of tabs, matches underlined in apricot, contention drawn once as a pair under one apricot rule, empty state offering next places in the same row grammar with one filled button.
- Attribution line on every memory row in palette, search and drawer: "Ana · billing-42 · 9f3c1a".
- Send arrow drops to ink whenever a palette or sheet is open, so each screen keeps one strong colour.
- Keyboard sheet: four groups in day order, borderless keycap token (bg-3, 22px, 6px radius), rows that stay but say why they are off, letters only when the composer is empty, modifier pair preset by the shell.
- Drawer as five lists with the catch-up brief in three sentences and the phone bottom sheet identical to the desktop drawer.
