# Judging: system explorations

Reviewed as a set: `dark-mode-audit`, `icon-set`, `motion-spec`, `microcopy-guide`. Each judged on its
`index.html`, its `rationale.md`, and the light and dark captures in `shots100/<slug>/`, with the
captures cropped to native resolution for the craft pass. Scale 1–10 per criterion; overall is the
mean.

**Theme.** These four are the layer under the screens: colour, glyphs, motion and words. They agree on
one thesis, that the system is a small vocabulary with hard limits (five status words, twenty-eight
glyphs, three durations and three easings, four token values moved) and that a spec page should be
written in the product's own register: rows and hairlines, the proposed fix on the same line as the
fault, one filled button per page, status as a word with a dot. All four hold that register in both
themes without a second set of styles, which is the first time a set has done so cleanly. Where they
disagree is vocabulary, and the disagreement is the finding of this round: the motion spec says
"Decline", "quorum of 2" and draws an avatar square for the agent; the icon set says "needs 2 drivers"
with a dot and no status word, and puts glyphs inside Approve and Deny; the microcopy guide says
"Approve · Deny", "needs two drivers", "awaiting approval", and sets the agent as plain text. The guide
is the better document and should be the source of truth; the other three are re-read against it
before anything ships. One further tension to settle in tokens: the audit darkens light `--fg-3` from
60% to 45% lightness, and both the guide (its "not this" column) and the icon set (14px event lines)
lean on that tier for quiet; the audit's own specimen shows the tier survives because it is also
smaller, and that is the trade to accept.

## Scores

| Exploration | Register | Primary action | Restraint | Both themes | Craft | Overall | Verdict |
|---|---|---|---|---|---|---|---|
| microcopy-guide | 10 | 9 | 9 | 9 | 8 | **9.0** | keep |
| dark-mode-audit | 9 | 8 | 9 | 9 | 8 | **8.6** | keep |
| icon-set | 9 | 8 | 8 | 9 | 8 | **8.4** | keep, revise three things |
| motion-spec | 9 | 8 | 7 | 9 | 8 | **8.2** | keep, revise the streaming demo |

No rejects.

## microcopy-guide — keep (9.0)

The best page of the four and the one the others should defer to. It is a grammar before it is a
list: ten rules, each with one example and the phrasing it replaces, then nine tables that are
consequences of them, all with the same three columns (where, Fold says, not this) at the same
widths, so a reader learns the voice by contrast instead of by instruction. The rejected string in
tertiary italic beside the kept one is the whole lesson, and it needs no colour. The one section that
renders strings inside the real components (Dee's bubble with the folded corner, the agent as plain
text with two collapsed steps, the quorum notice, the handoff divider) gives the table a sound and
puts exactly one accent on an 8,750px page: Approve. Light and dark are the same object; the accent
goes apricot on dark and nothing else changes. The content is right against the kernel docs: five
status words with the dot as the only colour, "Ana approved · 1 of 2", "offers the fold", errors as
what failed plus where plus the number, Slack and push saying the same sentences as the stream. Craft
loses a point for two small things: "then" and "or" inside the say column use the same tertiary
italic as the "not" prefix, so the eye has to re-read which is which; and the rules list runs the
rejected phrase straight on from the example with only a space before "not:", which the tables handle
better by giving it its own column. Keep, and name `copy.ts` as the implementation of this page.

## dark-mode-audit — keep (8.6)

An audit written as rows: one per pair tokens.css actually produces, grouped by target (text 4.5:1,
dots and boundaries 3:1, tone exempt and said so), with the ratio computed on the page from the hex
values and every failing row carrying its replacement and the ratio that replacement reaches. The
summary is three status words with dots ("7 of 27 pairs fail", "3 of 27 pairs fail", "All proposed
values pass") and a drift check against the live tokens, which is what makes it trustworthy next
quarter rather than only today. The decision is sound and narrow: four values move, one rule is
added (tertiary text lives on the canvas; on bg-2 and bg-3 the 12px labels use fg-2), and the
hairlines stay at 10% with a `prefers-contrast: more` block for the people who asked, instead of a
grey frame for everyone. The rejections are the right ones, especially refusing to lift fg-3 until
it meets fg-2. The specimen strips, painted in their own palette whatever the page theme, are the
right way to review any colour change and should be reused. Both captures are the same page with the
same numbers, which is the point. Craft: the "ratio" column header is set in mono because it inherits
the class meant for the numbers, while every other header is sans; the "proposed" column wraps its
"use fg-2 here" note onto a second clause that reads as part of the ratio. Primary action loses a
point because the thing to do (the diff block) sits below two long tables and a specimen; a reader
arriving to act rather than to verify would be served by the diff first and the evidence after.
Keep; the four values, the on-canvas rule and the high-contrast block go into tokens.css.

## icon-set — keep, revise three things (8.4)

Twenty-eight line glyphs in one sprite on a 20-unit grid at a 1.5 stroke, round caps, no fills,
`currentColor` only, so an icon is never a colour on its own. The vocabulary is the product's
(session is the mark's turned corner drawn as a line; fork and fold are a mirrored pair; conflict is a
diamond, not a warning triangle; claim is a flag) and the rejections are disciplined: no state icons,
because status stays a word with a dot. The in-context section is the strongest part: sidebar at
16px in secondary grey with recents carrying no icon, four 34px icon buttons on the top bar each with
a name, event lines at 14px in tertiary grey, and a composer where the send arrow is the only
coloured icon on the page. Both surfaces are shown inside the page as fixed panels, and the dark
capture is the same drawing in linen. Three revisions. First, the approval notice reads "needs 2
drivers · cannot be undone · Ana approved" behind a dot with no status word; the microcopy guide's
rule is a word and a dot, so it should read "awaiting approval · needs two drivers · cannot be
undone · Ana approved". Second, the glyphs inside "Approve delete" and "Deny" add a second thing to
read on the two most important buttons in the product; the guide's buttons are verbs alone, and the
page's own rule ("the icon names the act, the word carries it") argues for dropping them. Third, at
16px "team" (a figure with two side dots) and "agent" (a square with two dots) read as an asterisk
and a face; both want a redraw before they go in a sidebar row. Craft is otherwise clean: the set
grid, the construction panel, the size row all sit on the same baselines.

## motion-spec — keep, revise the streaming demo (8.2)

The spec itself is exactly right and should be adopted as written: three durations (120, 200, 320),
three easings (arrive, leave, move), one idle motion, only opacity and transform plus one measured
width, closing faster than opening, and the rule that makes reduced motion free ("the rest state is
the end state", hidden starts in keyframes with `fill: backwards`, so the global `animation: none`
in tokens.css is the whole fallback with two lines on top). Each of the five motions is drawn in the
real components with a row table under it naming property, duration, easing and the reduced-motion
result. The drawer as a pane that widens while the column gives way, the notice slot opening before
the notice fades so text below never jumps, and the driver ring travelling without the avatars
moving are all the right calls, and the rejections (no typewriter, no spring on the ring, no pulse on
awaiting approval, no sliding overlay) are the right ones. Both captures are the same page. The
restraint score is where it loses: the streaming demo breaks three of the page's own five rules. It
reveals 56 words with a per-word stagger (`--i` up to 55, so the run lasts about two seconds) where
rule 3 caps staggers at the eighth sibling; its `reveal` keyframe animates `max-width` and
`margin-right`, where rule 2 allows a measured width only on the drawer and the notice slot; and it
runs a blinking caret and the pulsing "running" dot at the same time, where rule 1 allows one idle
dot. The fix is the rationale's own position: chunks arrive whole with a 2px fade, the stagger stops
at eight, and the thinking dot either replaces the status pulse while a turn is open or is cut. Two
vocabulary slips to align with the microcopy guide: "Decline" should be "Deny" on an approval
("Decline" belongs to the handoff), "quorum of 2" should be "needs two drivers", and the agent should
be plain text without the avatar square. Craft: tables align, the "Settling" row is crowded but
legible, and numbering the rules section 0 reads as a joke beside "1 Tokens".
