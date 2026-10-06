# Brand board — notes

Redone on the chosen mark (design/mark.svg): two arcs, a person's and an agent's, that close into one ring
around one centre on a navy disc. The older ring-and-bead board is gone.

## The idea
The board treats the mark as one sentence, "two arcs of two colours close into one ring around one centre",
and makes every rule a consequence of it. The right arc is the person (chocolate, the hand), the left arc is
the agent (apricot, the pulse), the seams sit on the vertical axis, the centre is the lightest colour present.
It gives the mark four cuts from one drawing (default from 32 px; small cut with 13-unit arcs and the disc to
the edge for 20–31 px; tiny cut with no disc and 16-unit arcs below 20 px; a one-ink cut for tray and print
where the agent's arc is a 55 % tint so there are still two arcs) and four app-icon grounds, one per palette
colour, with the rule that the ground is the disc and the arcs recolour by ground, not by theme. Clear space
is measured in arc widths (s = 10/96). The colour section names each colour's job and shows eight contrast
pairs with ratios, one of them marked never. It ends with the "Join the circle" hero on the one gradient.

## Keep
- The four `<symbol>` cuts (`#mark`, `#mark-bare`, `#mark-small`, `#mark-tiny`, plus `#mark-mono`) driven by
  `--mark-disc / --mark-arc-a / --mark-arc-b / --mark-dot`, so the Team look editor and dark mode change the
  mark without a second asset. Ground classes (`.on-navy .on-cream .on-apricot .on-choc .on-page`) re-pin the
  arc colours per ground.
- The disc cuts resolve their arc colours at `:root` (`--disc-arc-*: var(--mark-arc-*)`), so a ground class
  can never recolour the arcs inside a disc: a disc is always "on navy". This caught a real bug in the first
  pass where a cream ground turned the agent's arc navy on a navy disc and the mark lost an arc.
- Colour-by-ground table: person's arc chocolate everywhere except on chocolate (apricot); agent's arc apricot
  on navy, navy everywhere else; centre apricot everywhere except on apricot (cream).
- The size thresholds: 32 default, 20–31 small cut, below 20 tiny cut, with the pixel maths on the board
  (default at 16 px: 1.7 px arcs and a 2 px navy halo; tiny at 16 px: 2.7 px arcs, 3.3 px centre).
- The eight misuse tiles; "not one colour for both arcs", "not without the centre" and "not swapped" are the
  three that matter most, because each turns the mark into something else (a spinner, a bullet, someone
  else's mark).
- The contrast card calls out apricot on cream (1.5 : 1) as never-for-text and chocolate on navy (1.2 : 1)
  as only-ever-the-arc-on-the-disc.
- Hero: gradient, apricot "hand" button, the people already here, the mark with its disc deepened to #1C2230.

## Open questions
- `tokens.css` points `--mark-arc-a` at `--accent`, which turns apricot in dark mode and gives both arcs one
  colour (the first misuse tile). This board pins the arcs at `:root`; the token should probably be a brand
  constant (`#56352D`) with the Team look editor allowed to override it deliberately.
- Chocolate on the navy disc is 1.2 : 1 and on the dark-mode disc (#0F131B) 1.7 : 1. The person's arc is the
  quiet arc by design, but it wants a check on cheap panels; keeping the disc at #2A3244 in dark mode
  (rather than #0F131B) would lift it slightly without changing the mark.
- Should the small and tiny cuts ship as separate SVGs in `design/` (mark-24.svg, mark-16.svg) or be
  generated with a stroke-width override? The board assumes separate symbols.
- Android adaptive icon: with the bare cut the ring (r 30 of 96) sits inside the 66 dp safe zone, but the
  round caps at the seams come closest to the mask at 12 and 6; worth a device check.
- The lockup rule "mark = 1em, centre on the x-height centre" was set by eye on Instrument Serif; it wants a
  check with the real font metrics (x-height ≈ 0.42 em was measured off the render).
- The shots are quantised to 96 colours (about 430 KB each); the hero gradient and the soft shadows band a
  little in the PNGs, not on the page.
