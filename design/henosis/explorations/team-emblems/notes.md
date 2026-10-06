# Team emblems — notes

## The idea
A team never gets its own logo; it gets the Henosis ring dressed in three things and nothing else: an
accent for the person's arc (which is also the team's hand: buttons, links, the driver halo), a highlight
for the agent's arc and the centre (also the Team pill, live glows and team messages), and a one- or
two-letter emblem in Instrument Serif that takes the place of the centre dot. The disc, the 10/96
stroke, the 12-and-6 join and the joining motion stay fixed, so twelve teams on one #billing channel
still read as one company, and the emblem names the team's agents everywhere (avatar, crew row, toast).
The board shows the anatomy, the twelve rings, the Payments team's ring in the shell, the Team look
editor that produces it, and the eight things the editor refuses.

## Keep
- Three dials only (`--team-accent`, `--team-highlight`, `--team-emblem`); a lead picks from twelve
  curated accents and twelve highlights, never a free hex. Every pair on the board clears 3 : 1 on the
  navy disc and 4.5 : 1 as text on cream, and the editor shows those three checks live.
- The grounds rule: on navy the emblem is set in the highlight; on cream the agent's arc turns navy and
  the emblem is set in the accent (a highlight on cream would be 1.5 : 1).
- The size rule: emblem down to 32 px, then the small cut returns the centre dot (24 and 16 px, tray
  and favicon), so the emblem never becomes an unreadable smudge.
- One shared `<defs>` ring (`#disc`, `#arcs`, `#arcs-small`) driven by `--a / --b` on each `<svg>`;
  the product should ship the mark the same way so the Team look editor changes one asset.
- The "Not a team ring" set, especially three letters, emblem-plus-dot, and one colour for both arcs:
  each turns a crest (a person's arc and an agent's arc) back into a badge.

## Open questions
- Curated palettes: twelve accents and twelve highlights are shown as pairs; should a lead be allowed
  to cross-pair (Checkout's moss with Billing's peach), and if so does the "two arcs apart" check
  (currently 3 : 1 between accent and highlight) stay the only guard?
- Single-letter emblems (Design "D", Mobile "M") read heavier than two letters at 32 px; decide whether
  single letters drop to 36 px or whether the editor nudges leads toward two.
- Collisions: Payments "Pa" and Platform "Pl" are distinct, but a company with Platform and Plans
  would need a tiebreak (the editor could refuse an emblem already in use in the workspace).
- Dark mode keeps the literal navy disc and the chocolate team accent on dark canvases (buttons stay
  chocolate rather than flipping to apricot as `--accent` does). Confirm that the team hand should
  override the tokens' dark-mode accent flip, or whether a team needs a second accent for dark.
- The mobile board (390 wide, two tiles across) was checked but its screenshot is not kept: the
  exploration's 300 KB budget only fits the light and dark board shots, stored at 45 % scale with a 40-colour palette (the full-size shots were inspected before being reduced).
