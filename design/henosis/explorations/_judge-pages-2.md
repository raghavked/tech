# Judge panel · pages · 2

Theme: **pages** (team-look-editor).
Judged against BRIEF.md and tokens.css v5. The three folder PNGs were opened and read at 2× crops
(editor column, preview column, rail, phone); because the folder shots stop at 900 px and the fixed
save bar hides the last two check rows and the fix line, the page was also rendered full-height at
1440 in light and dark and at 390 (those renders carry fallback fonts, so type was judged from the
folder shots only). Every ratio the checks table prints was recomputed with the same WCAG 2 formula
`TeamLook.tsx` uses. Scores are 1–10 for on-brief (vibrant, unity, palette roles), craft (alignment,
type, states), truth to the product, and distinctiveness from claude.ai, ChatGPT and Linear.
The exploration was not edited.

| Exploration | On-brief | Craft | Truth | Distinct | Overall | Verdict |
|---|---|---|---|---|---|---|
| team-look-editor | 8 | 6 | 7 | 7 | 7.0 | revise |

---

## team-look-editor · 7.0 · revise

**What it is.** Settings › Team look at 1440: the editor on the left (Colours card with three preset
tiles that are the palette in miniature, four hex rows with swatches, a contrast table with a cream
column and a dark column and a fix line naming the nearest passing hex; a second card for Mark,
motion, emblem) and, sticky on the right, a live slice of Bo's session painted with Ana's draft (a
terracotta accent, a warmer highlight, the "Pa" emblem at the centre of the ring), a "where the four
colours go" key, a "who sees it" card, and a fixed save bar that counts the changes, repeats the low
checks and ends in "Save to Payments". Phone goes preview first, then the editor in one column.

- **On-brief 8.** The roles are kept: navy rail as the frame, cream page with the wash, the hand only
  on Save and the preview's Approve (and the hand is the *team's* hand, terracotta, which is the right
  reading of `--team-accent`), apricot for everything that is live or changed (the CHANGED wash, the
  Team pill, the focus glow, the inbox counts, the emblem chip), the gradient once on New session. The
  mark is the two-arc ring with the emblem replacing the centre dot and the arcs and disc never offered
  as options, exactly as the brief and the team-emblems board ask. Serif on every name (Payments in
  the lede, Fondant / Apricot / Blues, Bo's agent, Invoice PDF, Pa), sans for what is read, mono for
  the hexes and ratios. Voice is right: "A preset starts over", "the accent will be hard to read for
  some of the team", "only the paint changes". Dark is correct from tokens with sensible page-level
  additions (fields on `#1E2534`, the wash at 12%). Deductions: the preview's New session button, the
  one hero gradient inside the preview, is broken (below), so the most vibrant moment on the page
  reads as a browser default; and the page quietly adds a fourth dark status triplet
  (`#8FC386 / #E2B06A / #EA9384`) to the three panel system-2 already counted.
- **Craft 6.** The layout is strong: swatches and 96 px hex fields on one right edge, 112 px check
  columns with the minimum tick drawn on each bar, the preset tiles equal, the sticky preview column
  landing its whole slice in the first 900 px, the save bar's text / ghost / primary order, and the
  phone's 84 px check columns still fitting "4.4 : 1 LOW". Two defects cost it three points. First,
  **the "two arcs apart" row is wrong**: it prints 4.2 : 1 fine in both columns, but `#A8623F` against
  `#E4B98C` is **2.6 : 1**, under the 3 : 1 the row itself states. That is the one check that keeps a
  crest a crest (team-emblems: "one colour for both arcs turns it back into a badge"), and on a page
  whose whole argument is "the checks are honest" it is the row that lies; with it true, the draft has
  three low checks, not two, and the save bar's sentence is also wrong. Second, **the preview's
  "+ New session" button is unstyled**: it carries class `new` inside `.prail`, so tokens' `.rail .new`
  (border 0, white text, 14 px radius, sans) never reaches it; in all three folder shots it renders
  with a bevelled default border and dark ink on the gradient. Smaller: "Text on the hand" is 4.45 : 1,
  which `toFixed(1)` prints as 4.5 while `>= 4.5` says low, so the product would show "4.5 : 1 low";
  the dark column measures the link on the bare canvas (8.8) while the link actually sits on the
  apricot-washed team message, where it is 3.8 : 1; in dark the Surface swatch (`#2A3244` on
  `#1E2534`) is an empty circle; the three preset tiles have no hover/pressed difference beyond a
  shadow, and none is `aria-checked="true"` while the Custom pill explains why only in prose.
- **Truth 7.** Built on `TeamLook.tsx` as it is: the same draft (accent, highlight, surface, glow,
  mark, motion, emblem), three presets made only of the palette, `#RRGGBB` fields, contrast checks
  against the canvas and the rail, lead/manager only, `PUT /api/teams/:id/theme`, reset to an empty
  theme. The departures are real proposals and each is named in the notes: ring / bead / dot renamed
  to centre dot / emblem / dot only, the emblem moved to the centre, a third motion level, a dark
  column, a fix line, a save bar instead of inline Save / Reset, preview beside the fields instead of
  above. Honest about `--p-hand` being a decision the page makes and the app does not. The invented
  fifth check with a wrong value is the dent: a product screen cannot carry a number its own
  `checksOf` would never produce.
- **Distinct 7.** Theme editors with a live card are a known shape (Slack's, Linear's workspace
  theme, GitHub's), and the label-left / control-right row list is Linear's grammar. Ours: the
  preview is a real slice of the shell with real people and a real plan, not a palette card; the
  checks are a two-canvas table with a minimum tick and a one-tap "Use #9C5B45"; the save bar says
  who gets the look and on which load; the mark is a crest you can only dress, never redraw. Nothing
  of claude.ai or ChatGPT in it.
- **The fix that matters.** Make every ratio on the page computed, never typed: feed the six hexes
  through the same `contrast()` as `TeamLook.tsx`, derive the fine / low word, the bar width and the
  save bar's count from the result, and let the lowest row drive the fix line (today the fix only
  knows about the accent on cream; with the arcs at 2.6 : 1 it must also say "or a lighter highlight"
  or offer a pair). Then the arcs row reads 2.6 : 1 low, the save bar says three checks are low, and
  the page can be trusted. While there, give the preview button its own `.look .prail .new` reset
  (border 0, `color: #F6F0E7`, radius, sans) so the one gradient on the page looks like the one in
  the rail beside it.

---

## Carry forward

- **The checks table as the system's contrast control.** Rows = what must stay readable, columns =
  the canvases it is read on (cream, dark), each cell a mono ratio + a word + a 4 px bar with the
  minimum tick at the threshold, fine in `--ok`, low in `--danger`. Reuse it for any colour a lead or
  a member can set (team look, avatar colour, chart series).
- **A fix line that names the nearest passing value with a one-tap Use.** Warn, show the hex, let
  the lead decide; never block the save, but say in the save bar who will struggle.
- **Every number on a page is computed from the same rule the product runs.** The settings board
  derives its policy sentence from `describeRule`; the team look must derive its ratios from
  `contrast()`. Hand-typed numbers in explorations are how a wrong verdict ships.
- **The hand rule for custom looks.** `--team-hand` = the accent on cream, the highlight on the dark
  canvas, with `--team-hand-fg` flipping to the surface colour; the preview, the primary button and
  the checks all read the same variable. Add the dark column to `checksOf`.
- **The preview is a slice of the shell, not a swatch card.** A rail with the brand, New session, one
  Team card and one Solo card; a canvas with a title, a Team pill, a team message with a link, Approve /
  Revise, a focused field. Painted only through `--p-*` variables so one asset serves the editor.
- **The mark as one `<symbol>` set driven by `--md / --ma / --mb / --mc`**, with the three centres
  (dot, emblem, dot only) as variants, so the rail, the segment, the emblem row and the save bar all
  change from one place.
- **Changed-row grammar.** Apricot wash + a small CHANGED tag after the title + a save bar that counts
  and names the changes and says who gets them and when ("on their next load"). Same grammar as the
  settings board; adopt it everywhere a form saves.
- **Preset tiles that are the look in miniature** (rail strip with the highlight crease, a cream
  page, one button in the accent with a glow) beat a text segment for anything that is a colour.
- **Land the dark status triplet now.** This is the fourth board to invent its own dark
  `--ok / --warn / --danger`; put one set in tokens.css before the next wave inherits a fifth.
