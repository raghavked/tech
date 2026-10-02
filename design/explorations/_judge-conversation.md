# Judge: conversation explorations

Seven explorations of the session column and the things that happen inside it, judged in
light and dark at desktop width. Register under test: ultra-minimal, claude.ai/ChatGPT; one
accent; rows not cards; status as words.

**Theme of this round: a box only while it is a question.** Every strong exploration here
reached the same rule from a different side: an approval, a contention, an offer is a
bordered row while someone has to answer it, and a grey line the moment it is settled;
authority is shown by one ring and one divider, never a banner; the accent sits on
whichever single thing the reader must press, and the send arrow steps back to ink while
that is true. The two weaker ones are the ones that add standing chrome (a bar, a busy top
row) rather than a moment.

## Scores (1 to 10)

| Exploration | Register | Primary action | Restraint | Both themes | Craft | Mean | Verdict |
|---|---|---|---|---|---|---|---|
| approval-notice | 9 | 10 | 9 | 9 | 9 | 9.2 | keep |
| contention-notice | 9 | 8 | 9 | 9 | 8 | 8.6 | keep |
| handoff-flow | 9 | 9 | 8 | 9 | 8 | 8.6 | keep |
| session-view-variants | 9 | 8 | 8 | 9 | 8 | 8.4 | keep (C) |
| composer-variants | 8 | 9 | 7 | 9 | 8 | 8.2 | keep, one revision |
| presence-driver | 8 | 7 | 6 | 9 | 7 | 7.4 | revise |
| replay-scrubber | 7 | 8 | 6 | 9 | 7 | 7.4 | revise |

## approval-notice: keep

The best page of the round and the one the others should be measured against. Every
pending state shares one shape (the call as a sentence, an amber dot and status words, two
small buttons, expiry in grey at the right), and the second a decision lands the border
goes away and the thing reads like "Ran pnpm vitest". Irreversible differs from exec only
by words and a verb-named button, which is exactly the discipline the brand asks for.
While a decision is pending the accent sits on Approve and the send arrow goes to ink, so
the in-place screen still has one strong colour in both themes (Chocolate in light,
Apricot in dark, both correct). The sidebar grammar ("needs you" as the only imperative,
"1 of 2" otherwise, no badge) is right. Craft is clean: columns align across all nine
specimens, mono is used only for the call. Nothing to change.

## contention-notice: keep

Same discipline applied to the harder case, and it holds: two verbatim rows with the
author's name in the serif, a plain Pick at the end of each, and no primary button because
the product must not lean. The apricot hairline on the box is the right call (a human
disagreement is where attention goes), though on linen it is faint enough that the box
nearly disappears at a glance; worth one notch darker or a 1.5 px rule in light only.
"Write a replacement" tucked into the status row is the one action that is easy to miss;
it could sit beside the Picks rather than at the far right of the meta line. Goal
contention changing only the status words ("Session blocked") is the correct way to say
"this one is worse". Settled lines are good. Dark theme is faithful.

## handoff-flow: keep

An offer, a brief, an answer, all drawn with shapes the stream already has. The I-PASS
brief as five labelled rows is readable in twenty seconds and is the right component for
every brief in the product. The divider line "Bo took the seat from Ana · 17:02 · turn 10"
with the ring moving in the top bar, sidebar and by-line is the whole authority change,
and it is enough. The receiver's one-line restatement as a required field before Accept is
a genuinely good idea. Two nits: the "Hand off" control in the top bar is drawn as a filled
pill, the only one of its kind on the screen, and should be the same quiet text button as
Team and Details; and the "Hand the seat to" picker is close to a card (radio rows plus a
field plus two buttons). It gets away with it because it is a question; keep it that way.

## session-view-variants: keep, variant C

The right decision for the right reason. A is the prettiest single frame but hides the
approval two screens up; B folds the tool calls, which are what engineers scan for. C keeps
A's spacing and moves time and turn into a tertiary gutter, and "15 quiet minutes" as a
serif italic row is the kind of detail that makes a Fold screen recognisable. Tool calls
expanded one per line, approvals and contentions as the only bordered rows, the only
accent on the arrow: all correct. The gutter must hide under 1200 px as the rationale says,
otherwise the column loses its 760 px. B's one-line summary should survive only as the
collapsed state of a turn with more than five tool calls.

## composer-variants: keep, with one revision

One sheet, six states, everything that changes is a word inside the sheet: this is the
composer. The chip grammar (mode word, scope word plus value, Agent/Team as one segmented
word), the struck-through frozen scope, the dashed hairline plus a sentence while an
approval is pending, and the single hint line are all product-ready. Revise one thing: the
"interrupt now" state turns the entire sheet border apricot, which with the send arrow puts
two strong accents on the same 100 px, and the brand reserves apricot for "a human's
attention is here", not for a modifier. A checked checkbox plus the "Will stop after the
current edit" line already says it; keep the hairline grey, or limit the apricot to the
folded corner. The mode popover's five rows carry small icons it does not need; the words
and the authority line do the work.

## presence-driver: revise

As a specification it is thorough and mostly right: two avatar sizes, one ring that means
"holds the seat", a dashed ring for a pending offer, five verbs in the brand's voice, and
the chair rule (driver sees Hand off, contributor Ask to drive, observer Brief). Where it
slips is the top bar. Stack, sentence, eye count, Hand off and Details in a 48 px row is
busier than any other exploration's bar and reads as a widget despite the rationale's
"presence is a sentence". Drop the eye count from the bar (it belongs in the people list
and above the composer only when observers outnumber faces), and let the sentence yield to
the latest human act as described but return to nothing rather than to "Ana is driving"
when Ana is the reader. Craft: the "Six" stack specimen overhangs the left of its column in
section 2, and the specimen grids use three different label widths. The in-session frame
at the bottom is the strongest part and shows the system working quietly.

## replay-scrubber: revise

The mechanics are excellent and should be adopted wholesale: a native range input with
transparent track, one dot per turn (solid, hollow, larger for a decision), the column
folding the log up to that turn so the approval is pending again, the "5 more turns after
this" divider, the composer going quiet and losing its arrow so Return to now is the one
accent, Esc as the way back. Two things break the register. First, the strip is always
there, a 24 px bar under the top row of every live session; the brand says no chrome bars,
and at rest it is a bar. It should appear on demand (a "Replay" word in the top row, or
when the reader scrolls past the top of the log) and fold away on Return to now. Second,
status words: the top row says "Working" (not one of the five) and "Viewing the past" is a
sixth; use "running" and let the strip's own label carry "Viewing turn 9 of 14". The
"Team" pill in the top row is also a pill the register bans. Phone frame is a fair
secondary.

## Rejects

None. Every exploration here is a serious attempt at the register and the two marked
"revise" are a day's work from keep. The decisions already rejected inside the explorations
(red interrupt button, coloured status rings, a right-hand timeline drawer, a modal brief,
a banner for the transfer) stay rejected.
