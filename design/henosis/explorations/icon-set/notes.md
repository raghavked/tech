# Icon set — notes

## The idea
Forty line icons on a 16 grid in the stroke the app's `Icon` component already draws (1.5 units, round caps, round
joins, nothing filled), so the set is a table of path strings that drops straight into `ICONS` in
`apps/web/src/ui.tsx`. The nouns the brief names and the app lacks (agent, crew, group, baton, join, unite, plan,
gate, tokens, budget, savings, contention, claim, session, overview, brief, replay, needs-you, settings) are drawn
from the mark: an agent's head is the mark's centre in a rounded frame, a person never carries the dot, join is the
two arcs with seams at 12 and 6 o'clock around a centre, and every dot in the set is a stroked circle so an icon is
always one path and one colour. The board sets the grid and four keyshapes, shows all forty at 32 and 16, a six-step
size ladder, where an icon may be which colour, the set in the real session shell (rail, stream, plan card, gate
notice, drawer, inbox, toolbar, mobile tabs, menu), six don'ts and the shipping manifest.

## Keep
- The stroke contract: viewBox 0 0 16 16, paths inside 1.5–14.5, stroke 1.5 at every size (no heavier small cut,
  unlike the mark), round caps and joins, `fill none`, `stroke currentColor`.
- Dots as stroked circles (r .75, the join centre r 1) so the whole set stays single-path and takes a status colour
  cleanly; the app's `Icon` component needs no change.
- The member family: person (no dot), agent (framed centre dot), crew (two agent heads on one body), group (trio),
  all on the same shoulders curve, so people and agents read as the same kind of thing.
- The three glyphs that carry the product's verbs: baton (relay rod with two grips), gate (arch with a crossbar),
  join (two arcs + centre). Join is explicitly not the retired ring-and-bead.
- The colour rule: an icon is the colour of its text; apricot only on the active rail item; ok/warn/danger only on
  approve, contention and reject, never on nouns.
- The size ladder floor at 12 and ceiling at 32.

## Open questions
- At 12 px crew and group blur into a single blob; the rail foot could use person/agent alone with a count, or
  the set could allow a 12-only simplification for those two (the brief's "no second cut" rule would then bend).
- `watch` (eye) doubles as "observer" and "watchers"; if presence gets its own glyph, the eye should stay with roles.
- `handoff` and `join` both end in a ring; at 14 px beside each other in a menu they may need more distance.
- The second batch is not drawn: share, export, pause/play/stop as a family, window, phone, sun/moon, link, clock,
  chevrons and the existing menu/close/plus/check. Share, export and moon are reused from the old strings in the
  context panel.
- Should the ICONS keys be renamed (`star` → `rating`, `pen` → `revise`) when the set lands, or kept for the
  existing call sites with aliases?
- Size: index.html is 61 KB; the light shot is the full board at 640 px wide (32 colours) and the dark shot is
  viewport-only at 1440×900 (32 colours) so the folder stays under 300 KB. The full 1440 px board was reviewed at
  full resolution in both themes before quantising.
