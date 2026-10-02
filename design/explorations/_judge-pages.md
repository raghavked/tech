# Judging: page explorations

Reviewed as a set: `project-page`, `team-page`, `home-onboarding`, `empty-states`,
`notifications-inbox`, `memory-browser`, `branch-fold-flow`, `approvals-queue-desktop`,
`settings-page`, `share-invite`. Each judged on its `index.html`, its `rationale.md`, and the light
and dark captures in `shots100/<slug>/`. Scale 1–10 per criterion; overall is the mean. The register
being judged against: ultra-minimal, claude.ai/ChatGPT; one accent; rows not cards; status as words.

**Theme.** The ten pages already speak one language, and it is the right one: a serif title, a
sentence in secondary ink instead of a stat row, rows with the title in the serif and a second line
in the agent's own grammar, a status word with a dot on the right, and one filled control per
screen. The only boxed things anywhere are notices drawn with the apricot hairline (a contention, a
memory conflict, a fold, an offline state), and none of them carries a primary button. Nothing is a
card, nothing is a tile, nothing is a toggle. The set's one structural idea worth naming is that
"the empty page is the full page with sentences where the rows would be", and that "a row becomes a
grey line when it settles"; both hold across inbox, approvals, memory, branches and empty states.
What is left is convergence rather than invention: the pages disagree on a handful of small things
(whether an empty list gets a filled button, whether a sidebar row carries a count, how the team
picker marks selection, which sidebar is in use) and, in dark mode, six files lose the brand mark
because they load `mark.svg` (a Dress Blues sheet) instead of inlining it with `fill: var(--fg)`.
Those are fixes, not rethinks.

## Scores

| Exploration | Register | Primary action | Restraint | Both themes | Craft | Overall | Verdict |
|---|---|---|---|---|---|---|---|
| empty-states | 9 | 9 | 9 | 9 | 8 | **8.8** | keep |
| approvals-queue-desktop | 9 | 9 | 9 | 9 | 8 | **8.8** | keep |
| team-page | 9 | 8 | 9 | 9 | 8 | **8.6** | keep |
| memory-browser | 9 | 8 | 9 | 9 | 8 | **8.6** | keep |
| share-invite | 9 | 9 | 8 | 9 | 8 | **8.6** | keep, small revisions |
| project-page | 9 | 8 | 8 | 9 | 8 | **8.4** | keep |
| home-onboarding | 9 | 9 | 8 | 8 | 8 | **8.4** | keep, revise the picker and the mark |
| branch-fold-flow | 8 | 9 | 8 | 9 | 7 | **8.2** | keep, revise compare density |
| notifications-inbox | 8 | 8 | 7 | 9 | 7 | **7.8** | revise |
| settings-page | 8 | 7 | 7 | 8 | 8 | **7.6** | revise |

No rejects. Every page sits on `tokens.css`, none has a script, a shadow or a card, and every one
reads as the same product in both captures. The two "revise" verdicts are about density and the
accent count, not direction.

## empty-states — keep (8.8)

The cleanest statement of the register in the set. Five frames, each the page it would be when
full: the same shell, the same sidebar, the same serif title, then exactly one sentence in
secondary ink ("No sessions here yet; the first directive you send starts one.") and one action.
The action is the page's real affordance rather than a stand-in: the composer for the empty
project, a link onward for the empty inbox, a human-written first entry for memory. The sidebar
echo (three italic serif words, "no sessions yet", "none yet") is a small idea with a large payoff:
the state is readable before the page opens. Offline is handled correctly as a notice over a
readable log, the status word by the name turning to "offline" and the send arrow stepping back to
ink. Both captures are quiet; the dark frames read as the same five objects. Two notes. The empty
team and empty memory get a filled button where `project-page` deliberately gives the empty project
a hairline "New session" to keep the accent off a second control; pick one rule (I would take this
file's: when there is no composer on screen, the one action may be filled). And this file loads
`mark.svg`, so the lockup in dark mode shows only the apricot corner; inline the mark as
`project-page` does.

## approvals-queue-desktop — keep (8.8)

The approval row from the stream, grouped under a serif project header that repeats the lead's
direction, with a cursor that is a whole row. That is the whole design and it is right. The two-line
row (the exact call as a sentence, then requester, session and state as words with one dot, the
quorum as a count, time left in grey) carries five states with nothing changing but the words and
which button is filled. The "against your direction" state is an apricot dot and nothing more; the
direction text it is read against sits in the header, so no second colour is needed. Only the
cursor row carries the filled button and its key hints, so a screen with five open calls has one
accent. "Decided today" rows dropping to grey lines matches the inbox and the fold notice. Dark is
clean; the cursor tint and the apricot bar read the same way in both. Craft notes: the sidebar here
is a third variant (Approvals and Memory above Projects, projects carrying "4 live", recents by
name), and should be reconciled with `sidebar-variants` A; the Need me / All / Decided segmented
control is the one piece of chrome on the page and could be three words with the active one in ink,
as the inbox's tabs could too. And the mark again: `mark.svg`, invisible sheet in dark.

## team-page — keep (8.6)

The summary as a sentence ("Five sessions open across three projects, two of them running. Three
things need you.") in place of a stat row is the move to carry into the product, and the four lists
sharing one row shape makes the page learnable once. The lead's extra list, Memory housekeeping, is
the curator speaking in the same rows with kind, finding and citations and a status word, which is
far better than a banner. One accent per page, and it is the thing only that person can do: Decide
for Dee, Approve for Ana; everything else (Renew, Let lapse, Keep Cy's, Retract, Compact, Look
first) is a quiet text action. The quorum in words ("Bo approved, yours makes two") and the
contention Ana cannot resolve shown as a state, "Held for Dee", are both correct. Dark is a faithful
twin. Small craft notes: the "Schema freeze ends Thursday" row carries two text actions on the
right plus "2 days left" beneath them, which is the one crowded right slot on the page; and the
"Three things need you." in weight 500 inside the sentence is the only emphasis on the page, which
is fine, but it should not also be bold in the sidebar count.

## memory-browser — keep (8.6)

One column, the open conflict first and boxed in the crease colour with both entries attributed and
a quiet Keep beside each, then entries grouped by scope from the project outward. The row grammar
(key in mono · text · engineer · session · commit, right-aligned) is the attribution line from the
brand doc made into a list, and the distinction between "Ana's agent" and "Ana" in the same slot
carries the trust tier without a pill. Retracted and superseded rows staying in place, greyed, with
the reason in words, is the right call for a ledger. The scope switch narrowing to "what an agent
here would be given" with a sentence saying so is the right mental model. The curator report as four
rows with a status word matches the team page. The only accent is the send arrow on the Remember
field. Craft notes: the key column in grey mono at a small size is at the edge of legibility in
light mode; the attribution column is narrow enough that "Ana's agent · billing-42 · 9f3c1a" is
the smallest text on the page and will truncate for longer session names. Consider a fixed
attribution width and dropping the hash to hover. Dark is clean.

## share-invite — keep, small revisions (8.6)

A popover, not a modal: hairline, no scrim, no shadow, anchored under Share, and the in-situ frame
proves it works over the stream with the send arrow stepped back to ink. Four groups in the order
people need them, the link first with the one filled button beside it, scope as three radio rows
where the wider ones always say "opens as observer", people as rows with a presence word and a role
word, and a field to add someone. Roles that follow from the project ("owner · from the project")
are static with a reason and no remove, and the driver appears as presence rather than as a role,
which is the correct reading of the kernel. The footnote stating the live approval rule in names is
exactly the voice. The invite popover sharing the skeleton is right. Revisions: the in-situ sidebar
carries numeric counts (4, 2, 1) on session rows, which contradicts `sessions-list-states` (unread
is weight 500, never a count; the only number is "1 of 2"); every person row shows a remove ×
at rest where the rationale says boxed-on-hover; and the mark is `mark.svg` again.

## project-page — keep (8.4)

Laid out as claude.ai lays out a Project, and that is the point: a direction field where the
instructions would be, what stands as direction as one serif line beneath it with who set it and
how far it reaches, sessions as rows with the status word on the right, then team memory. The
second line in the agent's grammar ("Ana's agent · with Bo, Cy · waiting on delete
legacy_invoices, 1 of 2 drivers approved") does the work a status pill would have done badly. The
contention and the memory conflict are the only boxed things, both crease-coloured, neither with a
primary button, both with a status line naming who acts. The empty state keeps the skeleton. Both
themes are clean and the mark is inlined correctly. Two notes for convergence: the direction field
is drawn as a composer with a filled send arrow, and `home-onboarding` puts a session-creating
composer at the bottom of the same project home, so a lead would see two composers on one page;
the direction field should become the field it is (hairline, a quiet Set on the right) and the
session composer should keep the arrow. And "Open all" beside Team memory plus the "New session"
hairline button under Sessions are both fine, but with the direction arrow make three right-side
actions; one of them should go.

## home-onboarding — keep, revise the picker and the mark (8.4)

Three screens with nothing new in them, which is the correct ambition. Sign in is one field and one
button, GitHub and Google as hairline buttons so the primary path reads first, and the fine print
says what will happen and what will not in Fold's voice. The third screen is simply the product:
sidebar with its crease, a greeting line that says what needs Ana, the course as one dotted line,
live sessions as rows, the composer at the bottom as the way a session is created. The accent moves
from Continue to the send arrow and stays there. Two revisions. The team picker marks the selected
row with a filled tint box, which is the one card-like selection in the set; use the two-pixel
apricot bar the sidebar uses, or just the radio. And in dark mode the lockup loses its sheet
(`mark.svg` on navy), so the sidebar reads "◥ Fold"; inline the mark. A smaller note: "Team" and
"Memory" as bare links in the top-right are a fine answer to where those pages live and should be
the product's answer, not a tab bar.

## branch-fold-flow — keep, revise compare density (8.2)

The most ambitious page and the one that most needed the register, and it gets the shape right: a
branch is an action on a turn (a thin hover rail, one notice with a name and a line of why), a
settled line at that turn, an indented row in the sidebar reading "folding" or "folded". Compare is
the only place the column splits and it splits into two copies of the same column from a shared
checkpoint divider, which is correct. The fold is a notice in main's stream with one row per file,
the one conflict as the row that opens (three mono lines each, a radio each, a link to let the
agent rewrite), and under it what the fold carries in: Dee's constraint by union, Cy's steer meeting
Ana's as a contention. Settled, it is a line and a divider. The accent discipline holds through all
four steps (Fork, then Fold into main carrying the mark, then Fold with the branch's tax.ts, then
back to the arrow). Craft is where it slips: two panes inside a 760 column give each roughly 350px,
so steers, tool lines and code wrap hard and the pane headers (name, avatars, status word, three
facts) crowd; the conflict's two code blocks are legible but just. Let compare widen the column to
the window (it is the one view allowed to) and set the three facts under the name rather than
beside it. Mark is `mark.svg` again.

## notifications-inbox — revise (7.8)

The thinking is right and should be adopted: rows under a project name, the same four parts for
every kind, "needs you" as the only counted state, rows that are not yours listed in grey with
"not yours to answer", a settled row dropping to a grey line under "Done today", the accent on the
first undecided answer only. The tray popover as the same rows narrowed is a good desktop answer.
What needs revising is the amount of chrome around the rows. There is a segmented filter, a kind
icon per row, "Mark all read" and a dots menu in the header, and on a six-row screen there are
eleven outlined buttons (Deny, Stripe Tax API, Local tables, Open, Allow once, Keep the freeze,
Approve, Deny ...). The rationale's own claim that "nothing on the row is coloured except the dot"
is true, but the outlines are a second visual weight and the eye reads them as chrome. Make the
non-cursor answers text actions (as the team page does) and keep outlined buttons for the row in
focus; drop the kind icon where the sentence already says the kind (a question mark before a
question). Craft notes: the sidebar session row "Invoice PDF + tax line..." truncates against
"needs you", which the 760 sidebar should never do; and the by-line wraps to three lines on the
first row because it carries the state, the quorum, "cannot be undone" and the wait time, which is
one clause too many for one line. Dark is a faithful twin; the mark is `mark.svg`.

## settings-page — revise (7.6)

The structure is the right one: one column, rows with a label and a one-line reason on the left and
the control on the right, six plain headings, the apricot crease as the boundary between what is
yours and what is the team's with one line saying who may change it. Policy rules as five sentence
fragments chosen by radio with the default marked by a faint word is better than any matrix, and
the quiet notice reporting what the last policy change did ("Since then one call has waited on it")
is exactly the voice. Native controls, no toggles, no save bar: correct. The revision is about the
accent count. Every checked box and chosen radio carries the accent, so the page has around
twenty-five accent marks, and in dark mode those are apricot, the colour that is meant to mean "a
human's attention is here". The page is still restrained, but the brand doc's rule that the only
strong colour is the send button does not hold here, and the notifications block (five kinds by
three channels of checkboxes) is the rules matrix the rationale says it rejected. Options: draw
checked states in ink with the accent only on focus, or collapse notifications to one row per kind
with the chosen channels as words ("desktop, phone, Slack"). Smaller notes: the section links under
the title read as a tab bar; the × in the top right implies a sheet where the page is a sidebar
destination; and the five-option radio rows fit 760 with nothing to spare, so a longer rule word
will wrap.

## Convergence list

Decisions the product should take once, drawn from where the ten disagree:

- Inline the mark with `fill: var(--fg)` everywhere; never load `mark.svg` into a navy sidebar.
- Sidebar: `sidebar-variants` A with sessions nested under projects and the lead's direction as an
  italic line; no numeric counts on session rows; "1 of 2", "needs you", "blocked", "folding",
  "folded" as the only trailing words.
- Empty list: one sentence, one action; the action is filled only when no composer is on screen.
- One composer per page. The project's direction is a field, not a second composer.
- Selection is the two-pixel apricot bar, never a tinted box.
- Non-focused actions are text; outlined buttons only on the row in focus; filled only on the one
  action that is this person's to take.
- Filters are words with the active one in ink, not segmented controls.
