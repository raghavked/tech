# Judge panel · brand · 1

Six explorations, all redrawn on the chosen mark (two arcs, a person's and an agent's, closing into one
ring around one centre). Read against BRIEF.md and tokens.css v5; every PNG was opened at full resolution
and cropped where the board is tall. Scores are 1–10 for on-brief (vibrant, unity, palette roles), craft
(alignment, type, states), truth to the product, and distinctiveness from claude.ai, ChatGPT and Linear.
The overall is the mean.

One finding sits above every exploration: `design/mark.svg` does not exist. All six boards cite it as
their source and each one redraws the mark locally, which is exactly how the arc-role inversion in
app-icons slipped through. The brand board's four `<symbol>` cuts should become that file.

| slug | on-brief | craft | truth | distinct | overall | verdict |
|---|---|---|---|---|---|---|
| brand-board | 9 | 9 | 8 | 8 | **8.5** | keep |
| mark-motion | 9 | 8 | 9 | 8 | **8.5** | keep |
| app-icons | 6 | 7 | 8 | 8 | **7.25** | revise |
| team-emblems | 7 | 8 | 8 | 6 | **7.25** | revise |
| loading-screens | 9 | 9 | 9 | 8 | **8.75** | keep |
| illustration | 8 | 8 | 9 | 7 | **8** | keep |

---

## brand-board · 8.5 · keep

**What it is.** The mark treated as one sentence and every rule derived from it: construction on the
96-unit grid, four cuts (default, small 20–31 px, tiny below 20, one-ink), colour-by-ground table,
wordmark and three lockups, clear space in arc widths, eight misuse tiles, four colour cards with eight
contrast pairs, and the "Join the circle" hero on the one gradient.

**On-brief 9.** Roles are exactly the brief's: navy frame, cream page with the apricot wash, chocolate
hand, apricot pulse; one gradient, used once, in the hero. The misuse row names the three failures that
turn the mark into someone else's (one colour, no centre, swapped). The colour-by-ground rule ("arcs
recolour by ground, never by theme; the centre is the lightest colour present") is the best single rule
produced by the wave.

**Craft 9.** Strong left-rail/12-column rhythm; section numbers, mono captions and serif titles are
consistent; dark mode is fully themed, with the cream wordmark and lockup cards deliberately kept cream so
the "on cream" case is still shown. Nits: at 390 px the browser-tab tile wraps "Billing page · Ana's
agent" into three lines around a 10 px mark, and the apricot app-icon ground shows a mis-offset blurred
squircle shadow behind the tile. Hover states are absent, but this is a board, not a screen.

**Truth 8.** Rail, release-gate notice, stars and budget bar are the product's own components with real
Payments content. The hero's apricot "Join as Ana" button contradicts the brief's "chocolate is the hand"
until you read the board's own rule (on the gradient the hand turns apricot, as in dark mode); that rule
should be stated in tokens, not only here.

**Distinct 8.** Cream + chocolate + Instrument Serif on its own sits uncomfortably close to claude.ai;
the navy disc, the apricot pulse and the two-colour ring are what pull it away, and the board keeps the
navy dominant.

**The one fix.** Ship the four `<symbol>` cuts as `design/mark.svg` (the file every page claims to draw
from, which does not exist) and pin `--mark-arc-a` to `#56352D` in tokens rather than `var(--accent)`,
which turns both arcs apricot in dark mode, the board's own first misuse tile.

## mark-motion · 8.5 · keep

**What it is.** The tokens' `.mark.joining` run shown live at 16–256 px, an eight-frame storyboard with a
two-track timeline, the keyframe table in ms and %, the easing curve, rules, and the four homes (loading
screen, joined-the-circle line with toasts, rail brand on load, splash) plus resting states at small sizes.

**On-brief 9.** Motion means joining: the arcs swing in from ±70°, overshoot 4°, settle, and only then
the centre appears. The 15 % hold is argued well (it is what stops the run reading as a spinner). Calm mode
and reduced motion are the closed ring from the first frame, same markup. The splash is the only gradient
on its screen.

**Craft 8.** The storyboard and timeline are genuinely useful engineering artefacts; angles are computed
from the bezier, not guessed. Two things are visible in the stills: at 0 % the two half-rings overlap for
140° at the bottom and blend into a muddy crescent at 48 px (the notes admit this), and the splash still
catches the tagline mid-rise at near-zero opacity, so the screenshot shows an unreadable line. The 16 px
"favicon · still" in the Live tile is a blob at that size, which the page itself concedes by not swinging
below 24.

**Truth 9.** The join is a line in the stream with the newcomer's avatar rippling, not a modal; leaving is
a quiet divider with no motion. The loading screen shows what is already folded. Reconnecting toast,
session-connected toast, rail cascade: all real product moments with Payments content.

**Distinct 8.** No one else's loader looks like two coloured arcs closing. The splash on the gradient with
the large ring echo is handsome and its own.

**The one fix.** The 0 % frame: start the arcs at ±60° (or hold them at .35 opacity and bring them to .5
during the hold) so the first 300 ms reads as two arcs resting, not a crescent, at 48 px.

## app-icons · 7.25 · revise

**What it is.** One master artwork cut for macOS, Windows, iOS (light/dark/tinted), Android adaptive and
monochrome, favicons, template and colour trays, Slack; four grounds, size ladder, four tray states with a
tray menu, an export manifest and six don'ts.

**On-brief 6.** The board inverts the arc roles. Its master spec reads "arc, person (left) · Apricot" and
"arc, agent (right) · Chocolate", and its "Arcs swapped" don't states "the person's arc is on the left,
apricot". The brand board, mark-motion, team-emblems and illustration all have the person on the right in
chocolate (the hand) and the agent on the left in apricot (the pulse). The pixels match the brief (right
arc chocolate) so nothing drawn is wrong, but the vocabulary is, and a vocabulary inversion in the file
that becomes the export manifest will propagate. It also calls the centre "the bead" throughout (31 times),
the word the brief retires with the old ring-and-bead; "the centre dot is the bead: it means joined" is a
rule other boards will misread.

**Craft 7.** The platform ladder, safe-zone maths and manifest are thorough, and the tray menu that names
what is live is a nice touch. But the light shot is 640 px wide at 24 colours and the dark shot is
viewport-only, so none of the 16 px claims (seam opening, two colours at favicon size) can be checked from
what was shipped. The iOS tinted icon reads as a target at 60 pt, which the notes also admit.

**Truth 8.** Tray idle = empty ring, live = centre, needs-you = coral pip, offline = 55 %: a status
language that matches the app's. The in-place mocks (dock, iOS home, browser tab, Slack) use real session
names.

**Distinct 8.** A two-colour ring on a navy squircle is not a Linear "L" or an OpenAI knot; the empty
ring as the tray's idle state is a quietly original idea.

**The one fix.** Swap the role labels so the person's arc is chocolate, right, 12 to 6, in the master
spec, the don't and the manifest, and replace "bead" with "centre" throughout; then re-shoot the light
board at 1440 so the 16 px cuts can be judged.

## team-emblems · 7.25 · revise

**What it is.** A team is the Henosis ring dressed in three dials: an accent for the person's arc, a
highlight for the agent's arc and centre, and a one- or two-letter Instrument Serif emblem in place of the
centre dot. Twelve teams, the Payments ring in the shell, the Team look editor with live contrast checks,
and eight refusals.

**On-brief 7.** Three dials only, curated pairs, contrast floors checked live: this is the disciplined
version of "Team look editor (accent, mark, motion, emblem)" that the brief asks for. Two tensions. The
brief gives the centre dot a meaning (it appears when something joins) and the emblem removes it from
every team surface. And twelve curated accents (moss, teal, indigo, plum, rust) on one screen stretch
"three colours, one page" further than any other board; the twelve-tile grid reads like a product with
twelve palettes.

**Craft 8.** Anatomy, grounds and size rules are drawn cleanly; the editor is a credible settings screen
with its three checks. Dark mode is complete. Only light and dark board shots were kept (no mobile, which
is acceptable for a board but should be said once in the brief). The "Tray and favicon" tile leaves its
two tiny marks sitting left of centre.

**Truth 8.** The Payments shell is the real session screen: rail, plan steps, team message, release-gate
notice, Team panel with the look tokens in it. Avatars, Team pills and the join toast all carry the
emblem, so the claim "the emblem names the team's agents everywhere" is demonstrated.

**Distinct 6.** This is where it slips. At 32 px, two serif letters inside a two-tone ring on a navy disc
are an initials avatar, and initials avatars are the one thing every tool shares (Slack, Google, Linear's
team icons). The twelve-tile grid in particular reads as a Slack sidebar. The arcs are doing the brand
work and the letters are undoing it.

**The one fix.** Make the emblem a crest for 48 px and up (project page, Team panel header, the editor
preview) and keep the centre dot at 32 px and below (rail, avatars, pills, toasts), so what identifies a
team in the shell is its two arc colours, not its initials. The size rule already exists at 24; move it
to 32 and the open question about single letters at 32 disappears with it.

## loading-screens · 8.75 · keep

**What it is.** Four waits, four loaders, one sentence each: app launch (arcs close, "Opening the
circle."), session joining (three dots converge in a live shell, "Joining Bo, Cy and Dee in Billing page ·
Checkout." with the folded count), project opening (weave under the title while the direction is already
readable), long operation (shimmer only where the summary will land). A loader spec, a copy table with the
8-second and 30-second lines, and the same four waits on the phone.

**On-brief 9.** Every loader is a picture of becoming one and each is tied to a meaning; no generic
spinner anywhere. Counts instead of bars. The arcs are pinned to chocolate and apricot in both themes,
which this page got right before tokens did. One gradient per screen is honoured (the launch is plain navy
with a soft glow; the splash lives in mark-motion).

**Craft 9.** The four desktop screens are finished product screens: rail live while joining, direction
card readable while rows ride in, finished steps checked while one runs, composer visible but muted with
"You can type once the history is in." Dark mode is correct everywhere, including the orbit's third dot
switched to ink so it stays visible. The page draws the canvas wash as a blurred disc instead of the
tokens' radial gradient, which is a sensible performance note for the app.

**Truth 9.** This is the most product-true board on the panel. Reconnecting, failed-to-join with one
chocolate action, the three-way unite with its release-gate summary: all states the product actually has,
with Payments content throughout.

**Distinct 8.** Arcs-close, weave and shimmer are the system's own. The orbit-converge at its 18 px inline
size is the one form that drifts toward the ChatGPT/iMessage "thinking" dots.

**The one fix.** Reserve orbit-converge for the 54 px page centre on a first join, and give the 18 px
inline and toast cases (reconnecting, chat opening) the mark's halo pulse instead, so no Henosis wait is
ever three small dots in a row.

## illustration · 8 · keep

**What it is.** Twelve spot illustrations built from one grammar (the two arcs translated, rotated, dashed
or shortened; rings of the same family; ripples concentric to the centre), each with a product sentence
and a home page; the spots in the product (empty Billing page, approvals, memory, branches, mobile inbox);
a marketing composition; sizes, grounds and the one allowed motion.

**On-brief 8.** "The ring is the illustration" is the right call for this brand: no characters, no
isometric desks, four inks. The dot-as-promise rule (solid = here, dashed = expected, absent = not about
presence) is good system thinking. On the dark canvas the person's arc is lifted to `#B27A66`, a fifth
colour in all but name; the notes flag it.

**Craft 8.** The grid of twelve is clean and the spots are legible at 96 and 48; Open, Whole, Gate, Plan
and Inbox are the strongest. Crew (two interlocked rings) and Unite (branch leaving and returning) are too
close to each other at 24, and Memory (ring in a ring) is the weakest drawing. The light shot is at half
scale; the dark shot is a 1440×900 crop of the twelve, which is the right pair for review.

**Truth 9.** Every spot is tied to a real empty state and uses the product's sentence as its only caption:
"No sessions on Billing page yet", "The gate waits for two ratings", "Nothing has needed you yet". The
product mocks (Billing page empty state with the "Invoice PDF with tax lines" planning row, the mobile
inbox) are finished screens.

**Distinct 7.** Two things pull it toward other people's work: `#B27A66` is terracotta, and terracotta on
cream with a serif is claude.ai's exact register; and the marketing hero (eight small rings on an orbit
around one large ring) is the generic "ecosystem" composition. Crew's interlocked rings also carry
Mastercard/Meta baggage at small sizes.

**The one fix.** Drop the fifth colour: on the dark canvas use apricot-deep and cream exactly as on the
navy ground (accepting that the person's arc and the dot share a hue there), so the person's arc never
drifts to terracotta.

---

## Carry forward

Patterns the system should adopt from this panel, in priority order.

1. **One mark file.** Create `design/mark.svg` from the brand board's `<symbol>` cuts (`#mark`,
   `#mark-bare`, `#mark-small`, `#mark-tiny`, `#mark-mono`) driven by `--mark-disc / --mark-arc-a /
   --mark-arc-b / --mark-dot`. Every page `<use>`s it; nobody redraws arcs.
2. **Arc roles are brand constants.** Person = chocolate, right, 12→6 clockwise. Agent = apricot, left.
   Centre = the lightest colour present. In tokens, `--mark-arc-a: #56352D` (not `var(--accent)`), so
   dark mode never makes both arcs one colour. The word is "centre", never "bead".
3. **Colour by ground, never by theme** (brand board's table): on navy chocolate + apricot; on cream
   chocolate + navy, apricot centre; on apricot chocolate + navy, cream centre; on chocolate apricot +
   navy. On any non-palette ground, keep the disc.
4. **One size ladder.** Default from 32 px; small cut 20–31; tiny (no disc) below 20; no swing below 24;
   emblem only at 48 and up. App-icons' 24 threshold and illustration's row drawing fold into this.
5. **Joining is the tokens' animation.** `arc-a` / `arc-b` / `dot-in`, 1.8 s, 15 % hold, centre only after
   the ring is one; `.once` for first loads and joins; loops only while genuinely waiting. Fix the tokens'
   invalid `(data-motion="calm")` media query to the `[data-motion="calm"]` selector.
6. **Four loaders, each with a meaning.** Arcs-close = the app joins you; orbit-converge = you join people
   (page centre only); weave = rows arrive; shimmer = words arrive. Copy names who and what; counts, not
   bars; after 8 s a cause, after 30 s one chocolate action. Loading is never a blank page.
7. **The ring is the illustration.** Spots are the arcs moved, dashed or shortened plus concentric rings
   and ripples; four inks; the dot is a promise; no disc or blob behind a spot on cream; the empty state's
   sentence is the only caption.
8. **Team look: three dials, curated pairs, live checks.** Accent and highlight from curated palettes
   with 3:1 on the disc, 4.5:1 as text on cream and 3:1 between the two arcs; the emblem is a crest at
   48+, the centre dot below. Team accents change glows and selection, never the brand mark's arcs.
9. **The hand on the gradient and in dark is apricot.** Chocolate buttons vanish on navy→chocolate; the
   brand board's hero and the tokens' dark `--accent` already agree. State it once in tokens.
10. **Distinctiveness guard.** Cream + chocolate + Instrument Serif alone sits next to claude.ai; the navy
    frame, the apricot pulse and the two-colour ring are the differentiators. Keep navy dominant on every
    brand surface and never lift chocolate toward terracotta.
11. **Token collisions surfaced by the wave** (fix in tokens.css, not per page): `.avatar.agent` vs the
    rail `.agent` card; `.rail .section` vs page `.section`; `--canvas-wash` radial gradient dithers and
    costs paint, consider the blurred-disc wash from loading-screens; the mark's dark disc `#0F131B` drops
    chocolate-on-disc to 1.7:1, consider keeping `#2A3244`.
