# Judge panel · signature elements · 1

Twelve `sig-*` explorations, read against BRIEF.md, SYSTEM.md and the reference notes each one cites.
Every `index.html` was opened, every `notes.md` read, `light.png` and `dark.png` looked at in full and
cropped at 2–3× where something looked off (`-now` stills for editorial-session and paper-and-lacquer,
where the signature part sits below the fold). Scores are 1–10 for originality (is this a shape nobody
else has, and does it come from the mark rather than from a trend), craft (alignment, type, states, both
themes, the still as a finished frame), fit (the brief's roles, voice and motion rule, and whether the
thing belongs on a screen the product has) and shippable (how much of `apps/web` moves, and what has to
be decided first). The overall is the mean. One concrete fix per element.

## Four findings above every exploration

1. **The whole wave asks for Fraunces and Inter first.** All twelve `--serif` / `--font` stacks read
   `"Fraunces", "Instrument Serif", …` and `"Inter", "Instrument Sans", …`. BRIEF and SYSTEM §3 say
   Instrument Serif, Instrument Sans, JetBrains Mono. The swap comes from two reference notes
   (three-colour-brands §10, premium-product-ui §9), not from a decision, and because neither face is on
   the render machine every screenshot in this wave shows Instrument. The panel judged what it saw. This
   needs one decision in SYSTEM §3, not twelve defaults; until then nothing here should be shot as final.
2. **Tokens are inlined, not linked.** The brief's rule is `../../tokens.css` plus a page `<style>`;
   every page inlines a copy of `tokens.v5.css` and three of them add twelve or more new properties
   each. Fine for self-containment, but the `--glass-*`, `--table-*`, `--dial-*`, `--cst-*`, `--spend-*`,
   `--field-*`, `--sky-*` families are now seven uncoordinated namespaces in one `tokens.css`.
3. **Six of the twelve share one material vocabulary** (a lamp at the top-left corner, a 160–240 px
   `feTurbulence` grain tile at soft-light, a 170° lacquer sheen with a lit top edge). glass-rail,
   night-mode, paper-and-lacquer, kinetic-mark, token-art and welcome-cinematic each reinvent it with
   slightly different alphas (.05 / .06 / .07 / .085 / .12 grain; 14 % / 15 % / 20 % lamp). They are one
   surfaces patch, and should ship as one, with one grain alpha per theme and one lamp.
4. **Every page carries an exploration-only inspector** (Dark, Calm, and the page's own buttons) in the
   product's topbar, drawn in the product's own pill style. Every note says the app does not ship it;
   good, but the stills then show a topbar the product will never have. Mark them `data-inspector` and
   hide them before shooting.

## The table

| slug | originality | craft | fit | shippable | overall | verdict |
|---|---|---|---|---|---|---|
| sig-approval-dial | 8 | 9 | 9 | 8 | **8.5** | ship |
| sig-council-table | 9 | 8 | 9 | 7 | **8.25** | ship |
| sig-baton-handoff | 9 | 8 | 9 | 7 | **8.25** | ship after the kernel grows recall |
| sig-night-mode | 6 | 8 | 9 | 9 | **8.0** | ship |
| sig-glass-rail | 6 | 8 | 8 | 9 | **7.75** | ship |
| sig-token-art | 8 | 8 | 8 | 7 | **7.75** | ship, the founder picks mirror or baseline |
| sig-welcome-cinematic | 8 | 8 | 9 | 6 | **7.75** | keep, after constellation lands |
| sig-paper-and-lacquer | 6 | 8 | 8 | 8 | **7.5** | ship as part of the surfaces patch |
| sig-presence-constellation | 8 | 7 | 8 | 7 | **7.5** | fix the dark avatars, then ship |
| sig-editorial-session | 9 | 7 | 7 | 5 | **7.0** | keep as a direction, not a patch |
| sig-kinetic-mark | 7 | 8 | 6 | 7 | **7.0** | revise: the mark is the founder's |
| sig-unity-field | 6 | 7 | 5 | 7 | **6.25** | revise or drop |

---

## 1 · sig-approval-dial · 8.5 · ship

**What it is.** The release gate's 1–5 rating as a 240° dial: five serif stops with detents, the rule's
bar cut into the rim as a notch, the band past it washed apricot, the team's average as a thin navy
needle, your pick as the one chocolate knob, the consequence as a sentence beside it, and every ballot
row carrying a 26 px miniature of the same dial.

**Originality 8.** A gauge is a known instrument, but nobody rates anything with one, and the three
numbers a gate is about (your pick, the bar, the average) have never sat on one face before. The
miniature per ballot row is the better idea: a column of votes becomes a row of small rings, each with
its hand, which is the mark's grammar without saying so. One point held back because the dial is still
a gauge, and the brand's own gesture (two arcs closing) is only implied by the rim.

**Craft 9.** The tightest page in the wave. Rest state honest ("4 if you leave it", dashed pointer), the
detent is one cubic, the needle has a surface-coloured halo so it cuts a tick cleanly, the word is
coloured through the `-ink` tokens only, the locked state draws the check. Dark re-weighs (cream rim,
apricot needle, lifted hand) and the drawing is the same at night. The one flaw the crop shows: with one
rating in, the needle lies exactly along the "3 · Fine" tick and covers the mono "3" at the rim; the
notes know it and chose that case for the still anyway.

**Fit 9.** The brief's selling moment is the gate held by the people who consume the code; this makes
the gate something you read before you turn it. Chocolate is only the knob and *Approve with 4*;
apricot is the clear band and the live dot; the voice is right ("Your rating decides.", "no third
rating can lift it").

**Shippable 8.** Replaces `Stars` only where a gate is rated; the plan card keeps stars. One new
component, nine tokens, ~90 lines of CSS. The 5 ms per key press is the exploration's `innerHTML`, not
the dial. Open: arrows turn or preview, the plan card, a bar of 4.5.

**The fix.** Draw the stop numbers at r 78 (inside the needle's reach, which runs r 50–114) and put the
needle under the tick layer, so when the average lands on a word the number stays readable and the
needle reads as "the team is here", not as a thicker tick.

## 2 · sig-council-table · 8.25 · ship

**What it is.** A council as the round table it is: member models on a ring, the chair at twelve, every
word an arc curling from its seat to the centre where the chair's plan forms as a dashed ghost and then
an apricot disc with step numbers at the owners' seats; a dissenting seat parts its segment and steps
outward; the ledger on the right is the same council as words; the scrubber under it is its clock.

**Originality 9.** The most original drawing in the wave and the one no competitor can have: several
arcs closing on one centre is literally the mark multiplied, and the dissent gap is the mark's apart
pose at one seat. Perplexity's "board" is a column of cards; this is a thing you read at a glance.

**Craft 8.** Geometry is disciplined (angle linear, radius on a smoothstep, labels anchored by cosine),
every state is a class, Calm sits at any event as a finished drawing, the SVG has a rewritten
description. Two things cost it: in light mode the table's segments are ~10 px of near-solid navy and
the ring reads first as a very large loader, with the words tangling in a sheaf near the centre; and
the eleven arcs have no hierarchy between round one and round two beyond a 5° offset. Dark is the
better still, where the apricot segments sit back.

**Fit 9.** The council room now exists in the web client, so this has a home; chair, dissent, owners
and "waits for Ana and Cy" are all real kernel facts, and the colour rule (model arcs navy, people
chocolate, the centre the only apricot, the warn ink only on DISSENT) is SYSTEM to the letter.

**Shippable 7.** One component beside the council room, driven by `Council` and `councilNext`; 120
nodes at five seats. Needs the seven-seat cap and the second-round fold before a real team hits it.

**The fix.** In light mode take the segment stroke from ~10 px to 6 px and `--table-rest` down to navy
at 22 %, so the table is a thin ring the words sit inside and the apricot disc is the heaviest thing
on the stage; the heavy ring only belongs to the lit segments once every model has spoken.

## 3 · sig-baton-handoff · 8.25 · ship after the kernel grows recall

**What it is.** SYSTEM §12's 2 px apricot driver ring made literal: on a handoff it opens into an arc,
lifts off Ana, rolls with mass along a hairline lane across the top of the composer (the lane sags
under it), arrives at Bo with a 6.9 % overshoot, waits open and breathing beside Accept and Decline,
and closes into the ring on Accept; a decline raises a red stop and it rolls home heavier.

**Originality 9.** The ring the system already calls the baton, made into the thing that is handed.
Giving the handoff weight (the sag, the dip in the lane, the tired return) says what a handoff is
better than any notice copy has. The decline-stop as the only red on the lane, and the policy refusal
having no motion at all, is the best motion thinking in the wave.

**Craft 8.** Springs sampled into `linear()` so every device lands on the same frame; the seven frames
in the drawer are drawn from the live geometry; the state machine derives from the kernel, not from
clicks. The crop shows the topbar presence stack sitting on the token meter's hairline track (the A
avatar overlaps the meter's end), and "B · you" under a 30 px seat is small. The still is otherwise
clean in both themes.

**Fit 9.** "Ana offers the baton to Bo", "Bo has the baton": the brief's own sentences, drawn. The
composer as the place the hand acts is right; the agent at the lane's end with no ring is a good
answer to "is the agent ever the driver".

**Shippable 7.** The lane is a new first row on every composer; `Baton` in `ui.tsx`; four spring
curves and three keyframes. Recall ("Take it back") has no kernel event today, and the lane needs a
stack past six seats. `linear()` falls back to `ease` below Chrome 113 / Safari 17.2, which is fine.

**The fix.** Fold the lane to zero height when no handoff is pending, offered or being recalled, and
unfold it (on `--t-slow`) only when one starts or when "Hand off to…" is chosen; as drawn it spends
~56 px of every session's composer on a row that is empty most of the day.

## 4 · sig-night-mode · 8.0 · ship

**What it is.** Dark mode as three colours at three depths: apricot the only light (a lamp at the
top-left, the lit top edge of every raised surface, every pulse), Dress Blues the air (a hue-222°
ramp from `#0C1019` to Dress Blues itself as the pressed step), chocolate the shadow (chocolate-black
terminal, warm shadows, a lower hand told apart by its lit edge). A full sheet of every component.

**Originality 6.** A warm lamp on a dark ramp is a known move; "the shadow is chocolate" is the real
idea and the one nobody else has, and the terminal as the warmest thing on the sheet answers an old
open question well. The rest is a careful re-weighing rather than a new shape.

**Craft 8.** Measured contrast for every pair, the ladder reads its own hexes from `getComputedStyle`,
`--edge` is a token change not a selector change. Two things in the still: the toast sits on top of the
release gate and hides its ask and command, so the one sheet meant to show every component hides one;
and the hand at `#6B4339` is 1.9 : 1 against a surface, carried only by a 1 px apricot edge.

**Fit 9.** Dark mode is on the brief's list and SYSTEM §16's "re-weighed, not inverted" is honoured;
navy stays dominant, the status triplet is unchanged, and the daytime gradient finally works at night.

**Shippable 9.** A token change in both dark blocks plus two pseudo-elements on `.main`. No markup moves.

**The fix.** Ship the night hand as SYSTEM's `#7A4B3E` with the new lit edge on top, not `#6B4339`
under it: at 1.9 : 1 the only thing that says "press me" is one device-pixel row, and the Team look
editor cannot promise that row on a lead's custom surface; the chocolate-as-shadow idea survives in
the terminal, the shadows and the output block, where it is strongest.

## 5 · sig-glass-rail · 7.75 · ship

**What it is.** The rail as layered navy glass on lacquer, lit by one apricot lamp at the top-left:
panes with a lit top edge and a hairline foot, cards nested at concentric radii (18 → 14), a running
card holding an apricot light pooled under its edge that breathes on the 1.8 s clock.

**Originality 6.** Glass panes are a trope; the lamp giving the roster a direction of light, and the
pulse being light under an edge rather than a dot or a spinner, are what make it this product's. The
rail's content and order are untouched, which is the point and also why it cannot score higher here.

**Craft 8.** Everything is 1 px and axis-aligned, the edge lights land on device pixels at 1× and 2×,
the active/hover/running states compose through two knobs. The grain at 26 % is invisible in a 1×
still (the note admits it). The card feet use two-letter initials ("AN BO", "BL AN") in 20 px circles,
which are cramped and disagree with the single-initial avatars every other page and SYSTEM §12 use.

**Fit 8.** Navy dominant, apricot spent on the lamp and the pulse, the rail stays SYSTEM §6. It is the
same lamp night-mode puts on the whole page, which argues for shipping them together as one light.

**Shippable 9.** CSS plus two wrapper classes in `Rail.tsx`; two backdrop layers, measured.

**The fix.** Use the system's `.sm 22` single-initial avatars in the card foot (A, B, C, D) in place of
the 20 px two-letter circles, and let the stack order be driver → people as §12 says; the glass is
fine, the people on it are the thing that reads wrong.

## 6 · sig-token-art · 7.75 · ship, the founder picks mirror or baseline

**What it is.** Spend as three drawings in one chocolate ramp with one apricot ember: a ring per agent
filling from the plan's seam (amber share past 80 %, a red lap past the plan, cache as a dotted arc
inside), the week as a mirrored waveform of turns stacked by agent, and October as a tide rising against
the soft budget with a tide line at today and a dated amber crossing.

**Originality 8.** The waveform is new and reads exactly as the note says, like a recording of the
room; the tide line is a good small invention; the ring is the mark as a meter. Held back because the
ring and the pace-with-band are usage-charts' own forms redrawn, and the mirror halves the honesty of
the bars (the note flags it).

**Craft 8.** One hue stepped in lightness, validated on both grounds; table twins under every form;
`role="meter"` with the four numbers. At the tide's right edge the "soft budget · 1.0M" and
"80 % · 800k" labels are crossed by the dashed pace line and its band (crop confirms). The page has no
rail, so it is a usage page floating without the frame every other screen has.

**Fit 8.** Token meters, budgets and the manager's tokens-by-agent are on the brief's list; chocolate
spend, apricot alive, status only against a budget is data-craft's rule kept. Mono for the counts
inside a serif sentence is SYSTEM §3, correctly.

**Shippable 7.** Three components in `viz.tsx`, ten tokens, 372 SVG nodes at 48 turns (145 on the
phone). The mirror needs a founder's yes beside a baseline version before it is the signature.

**The fix.** Anchor the budget and 80 % labels at the left end of their lines (x = 1 Oct), where nothing
rises to meet them, with a 6 px canvas-coloured `paint-order` stroke; the right edge is where the
pace, the band and the dated dot all arrive and no label can live there.

## 7 · sig-welcome-cinematic · 7.75 · keep, after constellation lands

**What it is.** The first ninety seconds as one scene with one camera: Dee's arc alone; her agent's arc
swings in and the ring closes on a ghost centre; the camera pulls back and the ring is one session in a
sky of rings; her agent introduces itself in the ledger column; one cream card on the lacquer with
*Enter the circle*; the lacquer becomes the rail as the page slides in and the stream says "Dee joins
the circle."

**Originality 8.** A product tour with a clock, a camera and a voice instead of dots and Next; the ring
you watched close turning out to be your session in the sky is a real idea, and it ends in the product.
It is built from constellation's drawing and kinetic-mark's thinking state, so it is a composition more
than an invention.

**Craft 8.** Beat 3 is a handsome still in both themes (which are nearly the same still, because the
stage is navy either way; the storyboard strip is where light and dark differ). The sky's names in
italic serif, the crew thread as a dotted bow, the score at the foot: all clean. The strip's sixth
thumbnail is a navy block with three cream lines and a cropped ring fragment at its right edge, which
reads as broken rather than as "the page slides in". Beats 1–2 put pure chocolate on Dress Blues at
hero size (1.7 : 1), which the note itself flags.

**Fit 9.** "Onboarding: join the circle" is on the list and the brief says the selling moment is
joining; the copy is in the brief's voice throughout ("Your agent is already here.", "It waits for
you."). The join plays once, in the stream, where MOTION §7 puts it.

**Shippable 6.** A route, a view, `copy.brief`, four clocks, and a server event (`session.briefed`) for
the agent's byline; the real `SessionView` mounting under a sliding layer is a route-transition
system the app does not have. Depends on `constellation.ts` landing first.

**The fix.** Give the hero arc in beats 1–2 the rail's 62 % lift (`--sky-person-lift`) rather than pure
chocolate on the lacquer, and shoot it at 2.3× beside the pure version for the founder; a newcomer's
first six seconds are one arc on an empty stage and it has to be visible.

## 8 · sig-paper-and-lacquer · 7.5 · ship as part of the surfaces patch

**What it is.** Three materials: cream stock with a grain and sheets of paper laid on it (ring, two 5 %
layers, a debossed label), every navy surface lacquered (170° sheen, lit top edge, no grain), chocolate
as ink (the hand, drawn rules under titles, and a rotated stamp whose ink breaks on the grain for a
decision that landed). Print is the same paper with the lacquer collapsed to one navy rule.

**Originality 6.** Paper grain and lacquer are familiar materials; "edges are cut, rules are drawn" is
a real rule and the *UNITED · 13:41* stamp is the one object here nobody else has. Measured against
glass-rail and night-mode it is the quietest of the three material pages.

**Craft 8.** The sheet/stock/pressed ladder is consistent, the stamp's thresholded mask is right, the
print stylesheet is complete (A4, running head, cream bands kept). The grain at .085 is not visible in
the 1× still, so `light.png` reads as flat v5 until `light-now.png` shows the stamp; the composer cuts
the plan card's head in the opening still.

**Fit 8.** Navy stays the first and deepest thing on screen, the output block as the machine's one
lacquered surface is a defensible call, export and print are on the brief's list.

**Shippable 8.** CSS, a `Stamp` component, an `@media print` block the app lacks today; `mask-mode`
needs both prefixes (written).

**The fix.** Raise the day grain to .11 and step it to .10 at `min-resolution: 2dppx`, so the material
reads in a 1× still without the 3× inspector; at .085 the page is indistinguishable from flat v5 and
the whole idea rests on the viewer trusting the drawer.

## 9 · sig-presence-constellation · 7.5 · fix the dark avatars, then ship

**What it is.** The team page's header as a sky: every open session a hairline ring, each present
member drawing the arc centred on itself in its own colour, so a session of one person and one agent
is exactly the mark; two shared people make two rings a vesica, one shared person makes them kiss; an
away member's share is a dotted guide; the apricot centre lands only when the ring is whole.

**Originality 8.** The brand as the page's data, not placed on it; the vesica and the kiss from shared
people are a genuinely new way to show "the same person in two sessions". Shares the mark-as-roster
idea with welcome-cinematic, which borrows from it.

**Craft 7.** The solver is sound, the figure is labelled, every point is a link with its sentence. But
`dark.png` shows the rail's people avatars as blank cream discs: `.avatar.t1–t4` are fixed light
washes with `color: var(--ink)`, which is cream at night, so "with Dee" has no D and the "AN BL" pair
is two white blobs. At r 58 the rings and their 11 px agent squares are small for a page header, and
the two-letter initials in the rail repeat glass-rail's problem.

**Fit 8.** The team page is on the list and the data already exists in `Team.tsx`; nothing animates on
navigation; apricot is the baton's halo and the centre only.

**Shippable 7.** `constellation.ts` as pure functions plus a `Constellation` component; the cap past
eight rings and three-shared-people are open.

**The fix.** Derive the four avatar tints per theme (or set `color: var(--blues)` on `.avatar.t1–t4`
in both dark blocks) so the initials survive the night; it is a two-line bug but it is in the one
still that is meant to prove dark is correct.

## 10 · sig-editorial-session · 7.0 · keep as a direction, not a patch

**What it is.** The session as a long read: one 68-character column, the goal as a masthead with
"Goal." in the hand's ink, every turn a serif heading with a numeral hung in the gutter, the team's
words a pull-quote with a hung opening mark, tool steps as a mono commit log, and every decision (the
plan's ratings, the gate with your stars and *Approve with 4*) a marginal note stitched to its passage.

**Originality 9.** The bravest page in the wave and the one that most completely refuses the chat
template: nobody gets a different typeface, the serif marks structure, the approvals are marginalia
because that is where a reviewer writes. The masthead is the best single composition of the twelve.

**Craft 7.** Subgrid across masthead, turns and composer; hanging punctuation twice; numerals as a
class. But the opening still is flawed: the sticky composer's wrap fades to transparent over its top
28 %, so the `To` row floats over the plan's step 3 and "3 of 11 so far" shows through the chips (crop
confirms). Anchored notes collide on back-to-back approvals (the note admits it, the app would hit it
on day one). Fraunces numerals depart from SYSTEM §3's mono for counts.

**Fit 7.** The brief asks for a session stream with a composer and an Agent/Team toggle, and this is
that, re-set; but the app opens a running session at `#now`, where the masthead is a scroll away and
the page is a column with a note beside it. The voice is right; the reading posture is editorial where
a running session is operational.

**Shippable 5.** Eight files including `Message`, `PlanCard`, `ApprovalNotice` and `Composer`, a
note-stacking pass, a new breakpoint at 960, and two self-hosted variable fonts with `size-adjust`.

**The fix.** Make `.composer-wrap`'s gradient opaque through the `To` row:
`linear-gradient(to top, var(--canvas) calc(100% - 20px), transparent)` or a solid canvas block behind
`.to`, so the composer never lets the previous passage bleed through its recipients.

## 11 · sig-kinetic-mark · 7.0 · revise: the mark is the founder's

**What it is.** The mark as the room's status in six states: idle, joining, settled (one apricot notice
ripples out), thinking (the working half breathes with an aura), blocked (the person's arc retracts to
70 % with a dotted stitch), baton (the centre leans 5 units toward the driver and that arc takes the
weight). A navy hero with the state's two seconds as a score, the six at 96 px, the 16 px tab states.

**Originality 7.** Status told by shape rather than colour, and a blocked state that is literally a
missing hand, are good; the score notation is a lovely way to specify motion. The thinking state is
the breathing-half-ring every agent product now has, in better colours.

**Craft 8.** A clean board in both themes, the favicons are real files, the technique (both arcs drawn
6 → 12 with `pathLength="100"`) is sound. The lean puts the centre 1.7 px off at 32 and 1 px at 20,
which the note itself calls possibly a flaw.

**Fit 6.** The brief says the mark's motion is for joining and that the founder chose this mark. Two of
the six states change its geometry (a retracted arc, a moved centre), and thinking puts a loop on a
brand element in every rail card; MOTION's "rest is the end state" holds but the mark no longer means
one thing. That is a brand decision, not a component prop.

**Shippable 7.** Props on `Mark`, three keyframes, `favicon.ts`; `stroke-width` keyframes and
`mix-blend-mode` in SVG need the Safari check; the lean needs the founder.

**The fix.** Drop the baton lean (the centre never moves; the receiver's 500 ms `take` pulse and the
word beside the mark carry the handoff) and keep blocked's open seam as the only change to the
mark's geometry; four states that leave the mark as drawn plus one that opens it is a vocabulary,
six is a drift.

## 12 · sig-unity-field · 6.25 · revise or drop

**What it is.** A canvas behind the home and the welcome brief: 12–64 faint pairs of half-arcs drifting
as a tide, closing into rings with an apricot centre near the pointer, beside live rows as marginalia,
and in a wave when someone joins; quiet zones over the text.

**Originality 6.** An ambient generative ground is the genre Linear and Vercel own; rehearsing the mark's
gesture in it is a fair twist, and the marginal rings beside live rows are the one part that carries
meaning. The rest is ornament.

**Craft 7.** Cheap (0.3–0.5 % of a core, two clocks, batched strokes, idles out) and the guard is read
from `--motion` by construction. But the still has a drawn demonstration cursor, six closed rings with
halos clustered beside the headline, and two more sitting in the rail's margin over "Welcome back,
Ana."; the quiet zones half-work, and the hero's resting mark competes with the rings around it.

**Fit 5.** The brief says motion means joining or living and "never garish". A ring that closes because
the pointer is nearby makes the brand's one gesture mean "the mouse is here", which spends the meaning
the join line needs. The tide is below attention, which is the argument for it and also the argument
that it is not needed.

**Shippable 7.** One file, two attributes, one `pulseAt` call; technically easy. The product question
is whether the home should have a moving ground at all.

**The fix.** Remove the pointer-proximity closing entirely and let only two things close a ring, a live
row's marginal ring and a join pulse from the join line, so the gesture keeps its one meaning; keep
the tide at half its present density, and shoot the still without the demonstration cursor.

---

## The five to ship first, and why

Ship them as two patches, not five.

**Patch one · the surfaces (night-mode + glass-rail + paper-and-lacquer).** Three explorations, one
material system: a lamp, a grain tile, a lacquer sheen, a lit edge, warm shadows. All three are token
and CSS changes with no component moving shape, all three were measured, and together they do what the
brief asks of the frame (navy dominant, apricot as the one light, cream as paper) on every screen at
once. Ship night-mode's dark blocks with the hand at `#7A4B3E` plus the lit edge; glass-rail's panes
and pulse on the rail with the single-initial avatars; paper-and-lacquer's ring/rest/edge ladder,
rules-as-ink, print block and `Stamp` with the grain at .11. One lamp, one grain alpha per theme.

**Patch two · the gate and the council (approval-dial + council-table).** The two highest-originality
elements that sit on screens the product has today. The dial replaces `Stars` at the gate only, is one
component with nine tokens, and makes the brief's selling moment an instrument; it ships first within
the patch. The table is the one drawing no competitor can make and the council room it belongs to is
already in the client; it needs the light-mode ring thinned and the seven-seat cap before a real team
sees it, which is a day's work against a signature.

**Next, in order.** baton-handoff once `handoff.withdrawn` exists in the kernel and the lane folds
when idle (it is as good as the top two and only the kernel holds it); token-art once the founder has
seen the mirrored waveform beside a baseline; presence-constellation after its two-line dark fix,
with welcome-cinematic following it because it draws with constellation's code.

**Held.** editorial-session is a direction the session view should learn from (the masthead, the
margin for decisions, the commit log) rather than a patch to land; kinetic-mark needs the founder to say
whether the mark may open or lean; unity-field should lose the pointer-closing or be dropped.
