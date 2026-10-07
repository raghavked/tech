# Judge panel · system · 1

Theme: **system** (colour-system, icon-set, motion-spec, dark-mode, data-viz-style, avatar-system).
Judged against BRIEF.md and tokens.css v5, with every PNG opened and the boards read in both themes.
Scores are 1–10 for on-brief (vibrant, unity, palette roles), craft (alignment, type, states), truth to the
product, and distinctiveness from claude.ai, ChatGPT and Linear. Explorations were not edited.

| Exploration | On-brief | Craft | Truth | Distinct | Overall | Verdict |
|---|---|---|---|---|---|---|
| dark-mode | 9 | 9 | 9 | 7 | 8.5 | keep |
| colour-system | 9 | 8 | 8 | 8 | 8.3 | keep |
| motion-spec | 9 | 8 | 8 | 8 | 8.3 | keep |
| icon-set | 8 | 8 | 9 | 6 | 7.8 | keep |
| avatar-system | 7 | 8 | 8 | 7 | 7.3 | revise |
| data-viz-style | 6 | 8 | 8 | 5 | 6.8 | revise |

---

## dark-mode · 8.5 · keep

**What it is.** The four pages that matter (session, rail + drawer, project, manager overview) rendered twice
from one markup, pinned to the light and dark token sets, with numbered callouts naming the token that
changed, held, or should not have held; a mapping table, a control strip in both schemes, and a
seven-line proposal for the dark block.

- **On-brief 9.** The roles survive the night exactly as the brief wants: the frame stays the frame
  (rail two notches below the page), the hand swaps to apricot with navy ink, the pulse never moves.
  Cream ink (#F0EAE0) instead of white keeps Instrument Serif warm. The hero gradient and the gate stripe
  are correctly called out as losing their navy end.
- **Craft 9.** The pinned-pane technique (`.t-light` / `.t-dark` mirrors) is the cleanest way to show both
  schemes on one page and it is used without a script or a second stylesheet. Callouts are numbered,
  consistent, and every one names a token and a ratio. The "Every control, both ways" strip is the
  component inventory the system was missing.
- **Truth 9.** Real pages, real copy ("Payments is on four sessions. Two wait for you"), real token
  numbers (12.4k of 40k), and the findings are measured (ok 2.4, danger 2.3, info 1.9 : 1 on a dark card),
  not asserted. It found the same status bug the colour board found, independently.
- **Distinct 7.** A dark-mode audit looks like a dark-mode audit; what is distinctive is the content
  (apricot hand, cream ink, navy page), not the board.
- **The fix that matters.** The proposed dark values live only in the before/after strip. Make the
  proposal the default dark pane on the four page mirrors (status remap, `--gradient-brand` one notch up
  on both ends, `--seg-on`, `--bezel`, `--bar-agent`), and settle `--line` at .14 for dark, so the board
  shows the night the system will ship rather than the one it is correcting.

## colour-system · 8.3 · keep

**What it is.** Three colours with jobs plus cream, every other value derived by one rule each (tints toward
cream, shades toward #0B0E14, apricot shades toward chocolate), a derived status set with soft / ink /
dark pairs, a Billing page "in use" strip, a self-evidencing contrast table, the dark mapping, and six
rules that fall out of the table.

- **On-brief 9.** The four-job card is the brief's palette paragraph made operational. The derivations
  keep the family warm (a navy tint is a warm grey; danger is chocolate turned five degrees toward red),
  which is exactly the "vibrant, never garish" line. Rules like "apricot is never text on cream" and
  "chocolate never sits on navy" are read off the table.
- **Craft 8.** Ramps, swatches and the contrast table are aligned and legible at full scale; the
  verdict chips (AAA / AA / LARGE / NO) carry the ratio. Deductions: the table needs 760 px and scrolls on
  the phone (the mobile shot is a 7 500 px strip with a sideways table in it), and the status cards' "dark
  soft" swatches band in the quantised dark shot.
- **Truth 8.** The "Payments team on Thursday" strip uses the real rows (Invoice PDF layout, Proration,
  Tax lines for EU reverse charge, Checkout copy pass) with the real pills and budgets, and the "Needs you"
  column shows the plan, contention and gate notices as the app draws them.
- **Distinct 8.** Cream + navy + chocolate with apricot as the only glow is nobody else's board.
- **The fix that matters.** Close the `--warn` question instead of leaving it open: keep #B9792E as the dot
  and bar colour, add `--warn-ink #7F5320` for every word, and write `--ink-3` down as metadata-only with a
  12 px floor; then the six rules at the foot are complete and the dark-mode board can cite them.

## motion-spec · 8.3 · keep

**What it is.** Every animation as a live demo beside its spec: three clocks (120 / 200 / 320 ms), three
curves plus the mark's own, four loaders as pictures of becoming one, eleven side motions, hover / press /
focus transitions, a join timeline, a Calm toggle without script, and an index of every keyframe set.

- **On-brief 9.** The brief's motion paragraph is implemented loader for loader (arcs-close, orbit-converge,
  weave, shimmer) and side motion for side motion (cards rise, dots pulse, badges pop, avatar ripples,
  check draws, Team pill crossfades, toasts rise). "Rest is the end state" is the right principle and makes
  Calm and reduced motion one guard.
- **Craft 8.** Clean board, consistent spec blocks (keyframes · duration · easing · trigger · calm), good
  mobile stack. The join timeline is the one artefact that decides overlaps once. Minor: the duration
  meters are drawn in chocolate, which is the hand, not a meter colour; apricot-deep or `--surface-3`
  would be truer to the roles.
- **Truth 8.** Specs the app's keyframe names (`dot-live`, `card-in`, `weave-slide`) and the real
  Payments stream in Full and Calm side by side. It is honest that design tokens.css and the app's
  tokens.css have drifted.
- **Distinct 8.** A motion vocabulary built on "joining" is unlike the spring-everything of Linear or
  the fades of chat products.
- **The fix that matters.** The drift. Land one keyframe vocabulary in design/henosis/tokens.css that
  matches the app (`dot-live`, `orbit-1/2/3`, `weave-slide/over/under`, `card-in`, and the
  `prefers-reduced-motion: no-preference` + `:not([data-motion="calm"])` guard) so every other exploration
  animates with the names this sheet specs.

## icon-set · 7.8 · keep

**What it is.** Forty line icons on a 16 grid in the app's existing stroke (1.5, round caps and joins, nothing
filled), a table of path strings that drops into `ICONS`, with the grid, four keyshapes, both sizes, a size
ladder, a colour rule, the set in the real shell, six don'ts and the shipping manifest.

- **On-brief 8.** The member family (person without the dot, agent with the framed centre, crew, group on
  the same shoulders) says "agents are members" in the glyphs themselves; join is drawn as the two arcs and
  explicitly not the old ring-and-bead. The colour rule (an icon is the colour of its text, apricot only on
  the active rail item, status colours only on verbs) respects the palette roles.
- **Craft 8.** One stroke, one grid, every dot a stroked circle so every icon is one path. The in-app shell
  is a finished screen. Deduction: crew and group blur at 12 px (the notes admit it), and handoff / join
  both end in a ring and sit close in a menu.
- **Truth 9.** The manifest is literally the diff for `apps/web/src/ui.tsx`; nine strings are new, the rest
  follow the rule the component already draws.
- **Distinct 6.** A 1.5-stroke round-cap line set is the shared dialect of Linear, ChatGPT and most of
  the web; the member family and baton / gate / join are the parts that are ours.
- **The fix that matters.** Set a 14 px floor for crew and group and use person / agent plus a count below
  it, so the "one cut, no heavier small version" rule holds without a blurred glyph in the rail foot.

## avatar-system · 7.3 · revise

**What it is.** One element, two shapes: a person is a circle (initials in serif from 40 up, or a photo) on
one of four palette washes; an agent is the rounded square with one tight corner, the brand gradient and the
mark's centre inside. Shared sizes (16–80), presence dot, driver ring, away fade, stack order, `--edge` from
the ground, the element inside the rail / stream / Team panel, six don'ts and the CSS that replaces `.avatar`.

- **On-brief 7.** The grammar is right and it is the brief's thesis in a component: shape says the kind of
  member and nothing else does; rings mean the baton; state is a dot, ring or fade and never a tint change.
  The deduction is a brand constant: the agent face draws the person's arc in cream because chocolate
  vanishes on the gradient below 40 px. tokens.css says both arcs keep their colour in every theme.
- **Craft 8.** The size ladder is a single variable and reads cleanly at every step; the "edge follows the
  ground" strip proves the cut-out on canvas, card, rail and team wash; dark is correct from tokens alone.
  The mobile header stack is cramped (CY / DE overlap into the caption).
- **Truth 8.** The in-product panel shows the rail with Proration / Invoice PDF / Checkout, a stream with
  "Bo has the baton", and the Team panel with four people and two agents, all drawn by the element.
- **Distinct 7.** Circle-vs-square membership is used elsewhere (Slack squares everyone; Linear circles
  everyone), but tying the agent square to the mark's centre and the tight corner to the agent message
  bubble is specific to Henosis.
- **The fix that matters.** Stop redrawing the mark. From 40 px up, inset the true mark (chocolate and
  apricot arcs on a navy disc) inside the gradient square; below 40 keep only the apricot centre, as the
  board already does below 24. The departure then disappears instead of needing an exception in the rules.

## data-viz-style · 6.8 · revise

**What it is.** Four rules (one sentence then one axis; colour follows the entity; text wears text tokens;
nothing gated by colour or hover), a categorical band of four slots, mark specs as numbers, axis grammar,
tooltip grammar, stat tiles, sparklines, and the table and texture under every chart.

- **On-brief 6.** The rules and the restraint are on-brief; the band is not. Series 1 navy is #3B66A8
  (S≈50) and series 2 chocolate is #A85236 next to Dress Blues at S26 and Chocolate Fondant at S31: the
  chart stops being the family and becomes the blue / orange stacked column every dashboard already draws.
  The hero tile on the brand gradient and the apricot period wash are right. The stat-tile value in
  Instrument Serif contradicts the type rule (JetBrains Mono inside tool lines and numbers) and the notes
  know it.
- **Craft 8.** Thin marks, 2 px surface gaps, hairline grid, mono ticks, compact numbers, a tooltip that
  leads with the value, a table under every chart and a texture fallback: this is disciplined work, and the
  dark mode is restepped rather than flipped.
- **Truth 8.** Tokens by day with last week versus this week, "October against the budget", by-project
  bars for Billing page / Checkout / Invoice PDF / Tax lines / Proration, and the rail chip with a sparkline.
  No phone variants of the chart forms.
- **Distinct 5.** The chart band reads as the default of Recharts / ChatGPT's analysis cards; only the
  serif number and the cream ground say Henosis.
- **The fix that matters.** Step the band from the family, not past it: hold the saturation of Dress
  Blues and Chocolate Fondant (≈ S26–31) and change lightness only (something near #45527A and #8A4A3C on
  cream, lifted on the dark surface), re-run the six checks, and set the stat-tile value in JetBrains Mono
  with the serif reserved for the hero sentence. If the family cannot clear 3 : 1 at two steps, fold
  projects to three series and Other rather than importing a blue.

---

## Carry forward

Patterns the system should adopt from this panel:

1. **Four jobs, stated once.** Frame / page / hand / pulse as the only roles; every other value derived by
   rule (tints toward cream, shades toward #0B0E14, apricot shades toward chocolate). (colour-system)
2. **Status is a word and a colour, with an ink.** Add `--ok-ink`, `--warn-ink`, `--danger-ink`,
   `--info-ink` for text, and the dark triplet `#9BC88F / #E2B06A / #E2847A` (+ softs) to the dark block.
   Both the colour and dark boards found the same 2.2–3.3 : 1 bug. (colour-system, dark-mode)
3. **The dark block patch.** `--gradient-brand` one notch up on both ends, `--seg-on`, `--bezel`,
   `--bar-agent`, `--line` .14; cream ink not white; "shape keeps the hand and the pulse apart" at night,
   never an apricot text link beside an apricot pill. (dark-mode)
4. **Three clocks, three curves, one guard.** 120 / 200 / 320 ms; arrive / leave / move plus the mark's
   own curve; rest is the end state; `prefers-reduced-motion` and `data-motion="calm"` as a single
   selector; one loader per meaning; the join order fixed by the timeline. Reconcile
   design/henosis/tokens.css keyframe names with the app. (motion-spec)
5. **The stroke contract.** 16 grid, 1.5 stroke at every size, round caps and joins, dots as stroked
   circles, icon colour = text colour, status colours only on verbs; the member family drawn from the mark.
   (icon-set)
6. **Two shapes, one element.** Circle = person, rounded square with the tight bottom-left corner = agent;
   state is a dot (`.pr`), ring or fade, never a tint change; `--edge` set once by the ground; stack order
   driver → people → agents, four then "+n". Agent face uses the true mark, not a cream arc. (avatar-system)
7. **Chart grammar, family colours.** Sentence then axis, one direct label, legend for two or more
   series, table under every chart, texture as the hue fallback; the hand keeps the total, the pulse keeps
   the wash and the live dot; categorical steps stay at the family's saturation; numbers in mono.
   (data-viz-style)
8. **Board conventions.** Pinned `.t-light` / `.t-dark` panes for any both-themes proof; contrast shown as
   itself with the ratio beside it; notes.md that end in diffable token lines so a proposal can land in
   tokens.css without re-reading the board. (dark-mode, colour-system)
