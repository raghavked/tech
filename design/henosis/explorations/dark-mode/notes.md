# Dark mode audit — notes

## The idea
The four pages that matter (session, rail with the Details drawer, project, manager overview) are rendered
twice from the same markup, pinned to the light and the dark token sets of tokens.css v5, with numbered
callouts on each dark pane naming the token that changed, held, or should not have held. A mapping table at
the top states the rule for every token (the frame darkens two notches, the page is a lighter navy than the
frame, the hand swaps chocolate for apricot and the ink flips with it, the pulse never moves), and a
component strip plus a findings section turn the audit into a seven-line proposal for the dark block.

## Keep
- The pinned-pane technique: `.t-light` / `.t-dark` mirrors of the token sets so both schemes sit on one
  page while the board chrome follows the viewer's scheme. No scripts, no second stylesheet.
- The mapping as stated: `--canvas #1C2230` above `--rail #161B26`, `--surface` one notch up from the
  canvas, `--ink #F0EAE0` (cream, not white), `--accent` → apricot with `--accent-fg` → navy, shadows black
  and heavier, the pulse (apricot, glow, Team pill, stars, running bar) identical in both.
- The findings: status tokens are not remapped (ok 2.4, danger 2.3, info 1.9 : 1 on a dark card; the rail
  already carries the right night values #9BC88F / #E2B06A / #E2847A); `--gradient-brand` loses its navy
  end on the hero and the gate stripe; `.seg .on` inverts (lighter by day, darker by night); the phone
  bezel is hard-coded to the dark canvas; the orbit loader's navy dot vanishes.
- The proposal, seven lines in the dark block and three component rules: dark `--ok/--warn/--danger`
  (+ softs), `--info: var(--ink-2)`, `--gradient-brand: linear-gradient(135deg, #343E52, #6B4339)`,
  `--seg-on`, `--bezel`, `--bar-agent`. The before/after strip shows it with the same markup.
- "Shape keeps the hand and the pulse apart": at night both are apricot; buttons are filled pills, pulses are
  dots, rings and washes. Never an apricot text link beside an apricot pill.

## Open questions
- Should `--line` go to .14 in dark? Row dividers on the manager page nearly vanish at .12; the board's
  screen borders already use .14.
- `--gradient-brand` in dark: one notch up on both ends (proposed) keeps the family but makes the New
  session button in the rail slightly lighter than today; is a separate `--gradient-brand-on-rail` worth it?
- The agent series colour in charts (`--rail` by day) needs a name; `--bar-agent` is proposed as
  `--surface-3` with a hairline at night, but a tinted navy (#3A4660) may read better next to apricot.
- Hairline hero edge: should the dark hero also carry a 1px `--line` border, or is the lighter gradient enough?
- Mobile dark (OLED): `--canvas #1C2230` is not black; a "pure black" option in the Team look editor would
  break the apricot wash. Decide whether to offer it at all.
- The screenshots: a full board at 1440 × 8677 cannot fit under 300 KB; the PNGs are 64-colour undithered,
  which bands the hero gradient slightly. The HTML is the source of truth.
