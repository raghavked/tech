# Judge panel · system · 2

Theme: **system** (badges-status, micro-interactions, accessibility, keyboard-first, print-export).
Judged against BRIEF.md and tokens.css v5. Every folder PNG was opened; because four of the five boards
run 3 300–7 200 px tall and the folder shots stop at 900, each board was also rendered full-height in
light and dark and read section by section. Scores are 1–10 for on-brief (vibrant, unity, palette
roles), craft (alignment, type, states), truth to the product, and distinctiveness from claude.ai,
ChatGPT and Linear. Explorations were not edited.

| Exploration | On-brief | Craft | Truth | Distinct | Overall | Verdict |
|---|---|---|---|---|---|---|
| keyboard-first | 9 | 8 | 9 | 7 | 8.3 | keep |
| micro-interactions | 8 | 9 | 8 | 7 | 8.0 | keep |
| accessibility | 7 | 9 | 9 | 6 | 7.8 | keep |
| print-export | 8 | 6 | 9 | 8 | 7.8 | revise |
| badges-status | 8 | 8 | 8 | 6 | 7.5 | keep |

A note that runs through the panel: three of these boards each propose their own dark status set
(badges-status `#7FB376 / #D9A35A / #D9766A`, accessibility `#7DB577 / #D8A05A / #D77A6D`,
micro-interactions reuses the rail tints `#9BC88F / #E2B06A / #E2847A`), and panel 1 already asked for
the rail tints to be the dark block. Four candidates for one token is the clearest sign the system
needs to land the dark status triplet now, before the next wave inherits a fifth.

---

## keyboard-first · 8.3 · keep

**What it is.** The Billing page session at 1440 with nobody typing: `j` / `k` printed on the rail
neighbours, `h` `f` `i` inside the topbar buttons, `/` in the empty composer, a pulsing "Keys live" chip
as the single mode indicator, the focused plan card with `1`–`5` drawn under its stars and `↵` printed
as "sends 4 and approves", and a 364 px right lane holding the two things that reach you from elsewhere:
a release gate waiting in Checkout (`a` `d` `o`) and Cy's @mention (`g` `r`). Phone drops the caps and
moves the lane above the stream.

- **On-brief 9.** The roles are kept exactly: navy rail, cream page, the hand only on Approve / Approve
  now / Send, apricot for everything live (the mode chip, the focused plan ring, the pressed `4` cap,
  the Team pill, the live tool line), the gradient only on New session. The lane card's navy titlebar
  with the session name in serif apricot is the frame used well. Voice is right throughout ("waits for a
  rating", "Bo rated 4 · one more at 3+ approves", "owner or driver · overrides the ratings").
- **Craft 8.** A finished screen, not a board. Caps inside buttons at the right edge, 2 px in, read as one
  control; the cap system (20 px, mono, hairline, 1 px drop; `--rail-2` in the rail; `.live` in the hand;
  `.pressed` in apricot) survives dark from tokens alone. Deductions: the `waits for a rating` pill
  colours its word in `--warn` (3.4 : 1 on cream, and the badges board's own rule says words stay ink);
  the `?` shortcuts button is a bare cap in a ghost button with no label text; at 1280 the lane leaves
  the stream ~640 px wide and the board has no answer yet.
- **Truth 9.** Built on `shortcuts.ts` as it is (`/ a d h f i j k ?`) with the queue's `j k a d o ↵`;
  the gate rule "2 at 4+", Dee's four stars, 12.4k / 40k, `git push origin pay/checkout:main` marked
  irreversible, Ana's agent refusing a write because the plan is not approved. This is the product.
- **Distinct 7.** Keys printed on controls is Linear's and Superhuman's dialect; the "Keys live" /
  "Typing" chip as the one mode indicator, and approving a gate in another session from a lane card
  without leaving the page, are ours.
- **The fix that matters.** One keystroke must not push to main unseen. Make `a` on an off-page
  irreversible gate a two-step: the first `a` lights the card (apricot ring, `.kbd.live` on Approve) and
  prints "`a` again approves · `esc` leaves it"; the second `a` sends. Rating keys and `↵` on the focused
  plan can stay one-step because a plan is revisable. Then the lane can also collapse to a chip row under
  1280 ("1 waiting in Checkout · 1 mention") and the same two-step still works from the chip.

## micro-interactions · 8.0 · keep

**What it is.** Six verbs (hover, press, focus, toggle, select, drag) as live demos beside frozen states
and a three-line spec (prop · time · calm) on every card, set in the Payments session; a rules strip
(three clocks 120 / 200 / 320, two curves, colour is state, Calm keeps the state); and a 30-row index
listing every interaction's trigger, property, clock and Calm fallback.

- **On-brief 8.** Hover is surface and shadow, focus is the team glow, selection and live things are
  apricot with a hairline, the hand on the primary action and the drawn check, the Team toggle tints the
  composer before a message is sent: the palette roles made into behaviour. Two slips against its own
  "Colour is state" card: switches and checkboxes fill with the hand (`--accent`), and the curve diagram
  is drawn in chocolate; both should be apricot-deep or `--surface-3` so the hand stays a verb.
- **Craft 9.** The best-built board in the panel: every state frozen next to its live twin, `:has()` for
  toggles and chips with one small inline script for the rest, a coherent 7 200 px page in both themes,
  a mobile stack that holds. The long-press ring (400 ms linear) is honestly flagged as off-clock.
- **Truth 8.** Real composer, rail, tool lines with hover actions, plan steps with estimate → actual
  crossfade, replay scrubber with gate ticks, the approvals multi-select bar, the compare divider. It
  names `useMotion` and admits the reorder demo's `position: fixed` would break in a scrolling drawer.
- **Distinct 7.** Interaction catalogues look alike; the apricot selection grammar, the composer that
  turns apricot when the toggle says Team, the drawn check and the mark's own curve are what make it
  Henosis.
- **The fix that matters.** The board's "one ring for everything" is the apricot glow at 35 %, and the
  accessibility board measures that glow at ≈1.2 : 1 on cream. Rebuild the focus demos on the proposed
  ring (2 px `--accent` outline, offset 2, with `--team-glow` kept as the halo outside it) so the rule
  survives the check; then the index duplicate of the motion-spec rows can be cut to a pointer, as the
  notes already suggest.

## accessibility · 7.8 · keep

**What it is.** Four lenses (contrast, focus order, screen-reader names, reduced motion) over the session
view, approvals queue, rail and plan card; a pair-by-pair contrast table with the ratio drawn beside the
swatch; a before / after plan card; the proposed tab order drawn onto the session screen; a today /
proposed announcement table; the rest-state table for every motion; and ten fix cards with diffable code.

- **On-brief 7.** It proposes three departures and justifies each: ink-3 and warn one step toward the
  frame, outlined empty stars with a deeper apricot fill, and a chocolate focus ring with the apricot
  halo outside it. The departures keep the palette's temperature. The deduction is that the ring, as
  written, becomes apricot in dark (`--accent` flips), so at night focus borrows the pulse colour the
  rest of the system reserves for selection and live things; the board names this in its open questions
  but ships the collision.
- **Craft 9.** The ratios were re-computed and are correct (ink-3 on canvas 2.85, warn 3.37); the fix
  cards are the diff; the focus-order fragment is a real screen with red (goes away) and chocolate
  (keeps) badges. The tag colours are hard-coded darker inks, which is itself the evidence that the
  status-ink tokens from panel 1 are needed.
- **Truth 9.** Names `ui.tsx · Stars`, `SessionView`, `Approvals`, the Loader's existing
  `role="status"`, the toasts region, and the app's `--focus-ring` that the design tokens have not
  adopted. The "Today" announcements are claims from a static board, but they match the markup in
  tokens.css.
- **Distinct 6.** An audit reads as an audit; the plan card, the gate sentence and the "names a teammate
  would say" rule are the distinctive part.
- **The fix that matters.** Decide the dark ring so focus never borrows the pulse: chocolate in light,
  and in dark a 2 px ring in `--ink` (cream, 12 : 1 on the dark surface) with the apricot halo outside
  it; then land the whole `.after` set and the ring in tokens.css as one patch, with the dark status
  triplet matched to the rail tints rather than a third set.

## print-export · 7.8 · revise

**What it is.** Two A4 sheets: the session as a document (running head, facts strip, quoted human
message on cream, the plan card with ratings as mono glyphs, folded tool lines with a masked secret, the
release gate with votes and the grant) and the audit trail as a ledger (six counts, time / who / did /
evidence rows with the kernel's decisions in green, the gate row with an ink stripe, the export's own row
on cream, the verify line and signature); nine rules for paper; the Export sheet and a six-page map.

- **On-brief 8.** Paper as one theme (white, ink, cream for two grounds, one green, one amber, nothing
  apricot, no gradient, no shadow) is the right reading of a brief that never mentions paper. The rule
  "the cream variant by default: chocolate and navy arcs, apricot centre, cream disc; never the navy disc
  on white, it prints as a black coin" is the brief's own cream rule applied.
- **Craft 6.** Every mark on the board is the black coin the rule forbids. The mark is drawn once as a
  `<symbol>` and placed with `<use>`, and the page's `.paper .mark .arc.a { stroke … }` and
  `.mark-cream .disc { fill … }` cannot reach inside a `<use>` shadow tree, so the disc stays
  `--mark-disc`, the arcs (no stroke attribute) vanish and the dot falls back to black. Verified at 3×:
  the "colour" and "one ink" samples are identical navy discs with a black dot, and so are the running
  heads, the signature rows, the eyebrow and the dialog. Everything else on the sheets is excellent
  (serif names with the role as it was, mono ids a size smaller, the one-point rule above the facts,
  rows that never split, "omitted says so" in italic serif).
- **Truth 9.** `henosis replay ses_7f3a9c --verify`, "signed by henosis serve with key payments-01",
  `redact.env`, kernel rows "1 at 3+ · got 2, avg 4.5 · ✓ fold", Dee's "a voice not a vote", the export
  recorded as an act: this is the audit trail the product keeps.
- **Distinct 8.** A ledger with serif names, kernel rows in green and a verify line is nobody else's
  export; chat products export markdown, Linear has no audit sheet.
- **The fix that matters.** Draw the mark so it renders: either inline the SVG where it appears, or
  keep the `<symbol>` and move every colour onto custom properties that the `<use>` inherits
  (`--mark-disc`, `--mark-arc-a`, `--mark-arc-b`, `--mark-dot` set on `.paper .mark`, `.mark-cream`,
  `.mark-ink`, with the dotted agent arc as a `stroke-dasharray` variable). Re-shoot, and only then
  decide the open question about whether the dotted arc is the rule for every one-ink use.

## badges-status · 7.5 · keep

**What it is.** The five things that may be a badge: the status word (dot + word, four dot sizes, drawn
on cream and on navy), the pending count (mono on solid apricot, absent at zero, 99+), Solo / Team /
Planning pills in three sizes, the crew ring with a serif name, and a "Together" section placing them in
a rail, a top row, fleet rows, an inbox and a mobile row; eight rules at the foot.

- **On-brief 8.** "Solid apricot means one thing: a count of what waits for you" is the strongest
  single palette rule in the wave, and the count sitting off the mark's disc because the disc already
  owns an apricot dot shows the mark is understood. Team apricot-on-chocolate, Solo outline, Planning
  apricot-soft keep the pulse in its lane. The slip: the status pill (`.spill`) colours its word
  (`Running` in `--ok`, `Awaiting approval` in `--warn` at 3.4 : 1) while rule 2 on the same page says
  colour lives in the dot, never in the word; dark mode then switches the pill text back to ink, so the
  two themes follow different rules.
- **Craft 8.** One drawing scaled to four sizes, halo = dot × .38, every variant shown on both grounds;
  the Together section is a real rail and real rows. The 150 px pill column just fits "Awaiting
  approval"; the dark status lift is a third candidate set.
- **Truth 8.** The words are `copy.ts`'s; rail, fleet, inbox, mobile and tray placements match the app's
  list in the brief; "Planning" is new but it is the plan card's state surfaced, not an invention.
- **Distinct 6.** Filled / hollow / dashed / faint status drawings are Linear's issue-status vocabulary;
  the serif crew ring (the mark's ring with nothing in it yet), the apricot count and the Team pill are
  ours.
- **The fix that matters.** Make the status pill obey rule 2 in both themes: ink words on the tinted
  ground, the dot carrying the colour (as the rail and top row already do); if a coloured word is ever
  needed, it takes the `--ok-ink / --warn-ink / --danger-ink` tokens panel 1 asked for, never the dot
  colour. Then retire the board's dark lift in favour of the one triplet the system settles on.

---

## Carry forward

Patterns the system should adopt from this panel:

1. **Solid apricot is a count.** The pending count (mono, apricot-deep on cream, apricot on navy, navy
   ink) is the only solid apricot in the frame; absent at zero, 99+ cap, pops on change, off the mark's
   disc in the tray. Counts count only what you can act on. (badges-status)
2. **The dot carries the colour, the word stays ink.** Five status words, no synonyms; one dot drawing
   (filled, filled + halo, hollow, hollow-faint, dashed) at 6 / 8 / 10 / 12; only Running moves. Status
   pills follow the same rule in both themes. (badges-status, keyboard-first)
3. **One dark status triplet.** Settle `--ok / --warn / --danger` for dark as the rail tints
   `#9BC88F / #E2B06A / #E2847A` with `.18` softs, add the `-ink` text tokens in light
   (`#946021`-class for warn), and delete the per-board lifts. Three boards, three sets: this is the
   wave's most repeated bug. (badges-status, accessibility, micro-interactions)
4. **Focus is a ring with a halo, and never the pulse colour.** 2 px `--accent` outline, offset 2,
   `--team-glow` kept as the halo outside it; in dark, a cream `--ink` ring instead of apricot so focus
   and selection stay two things. The team-look editor recolours the halo, not the ring.
   (accessibility, micro-interactions)
5. **Three clocks, two curves, Calm keeps the end state.** 120 hover / focus, 200 press / toggle, 320
   arrive / settle; plain ease for colour and shadow, the mark's `.3,.9,.3,1` for anything that moves;
   every end state (glow, apricot row, slid thumb, drawn check) survives Calm and reduced motion, with
   `.draw { stroke-dashoffset: 0 }` under both. The hand is a verb: switches, checkboxes and diagrams
   use apricot-deep, not `--accent`. (micro-interactions, accessibility)
6. **Selection is apricot with a hairline.** Wash at 30 % plus inset 1 px apricot-deep (chip) or a 3 px
   edge (row, option); pointer hover is surface-2 so hover and keyboard selection can show at once.
   (micro-interactions)
7. **Keys live on the thing they act on.** 20 px mono caps with a hairline and a 1 px drop, inside the
   button at the right; `.kbd.live` in the hand for the one key that acts now, `.kbd.pressed` in apricot;
   one mode chip ("Keys live" / "Typing"); caps hidden on touch. Irreversible actions from another
   session take two presses. (keyboard-first)
8. **State in words beside every colour.** Hidden text in the status dot, a sentence on the Team pill
   and the presence stack, `role="meter"` on budgets, one composed label per rail card, the send button
   named after the toggle, stars as one radiogroup with roving tabindex, approvals and gates announced
   once through the polite toasts region. (accessibility)
9. **Paper is its own theme.** `--paper-*` tokens with `color-scheme: light`; the cream mark variant on
   paper and a dotted agent arc in one ink; serif names with the role at that moment, mono ids a size
   smaller; kernel rows in one green, masked secrets in one amber; nothing splits that belongs together;
   what is omitted says so in one italic line; the verify line and signature on both documents.
   (print-export)
10. **Draw the mark so it renders.** Where the mark is a `<symbol>`, colour it only through custom
    properties on the `<use>`; page CSS cannot reach inside. Every board re-checks its marks at 3× in
    both themes before shooting. (print-export)
