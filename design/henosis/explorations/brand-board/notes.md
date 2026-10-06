# Brand board — notes

## The idea
The board treats the mark as one sentence, "a ring open at the top, completed by the newcomer's bead", and
makes every rule a consequence of it: the gap stays at 12 o'clock, the bead is the only chocolate, the
clear-space unit is the bead itself. It gives the mark two cuts (default from 32 px up, a heavier small cut
at 24 px and below) so the opening and the bead survive at favicon and tray size, and three app-icon
grounds with a clear hierarchy: navy is the store icon, cream is for documents, apricot is only what a
lead may choose in the Team look editor. The colour section names each colour's job (frame, page, hand,
pulse) and shows the pairs that are allowed for text with their contrast ratios, so a designer can pick a
colour by naming the job.

## Keep
- The two cuts of the mark (`#mark`, `#mark-small`, plus `#mark-bare` for navy grounds and `#mark-mono`
  for tray and print) as `<symbol>`s driven by `--mark-disc / --mark-ring / --mark-bead`, so the Team look
  editor and dark mode change the mark without a second asset.
- Clear space measured in beads (1b around, 2b to the wordmark), and the "baseline at disc centre + 0.22"
  rule for the horizontal lockup.
- The eight misuse tiles; "don't close the ring" and "don't drop the bead" are the two that matter most,
  because both turn the mark into a spinner.
- The contrast-pair card: apricot on cream (1.5 : 1) is called out as never-for-text.
- The "one gradient per screen" reminder beside the dark-mode summary.

## Open questions
- Should the small cut be shipped as a separate SVG in `design/` (mark-16.svg) or generated from the one
  file with a stroke-width override? The board assumes a separate symbol.
- The Android adaptive icon needs a safe-zone check at 66 dp: the ring sits right at the edge of the
  circular mask with the bare cut; the disc-kept cut might be safer there.
- Is the apricot ground really reserved for the Team look editor, or should a lead be allowed to pick the
  team's accent for the dock icon too? The brief says teams set accent, mark and emblem, which could be
  read either way.
- The wordmark's floor (20 px) was chosen by eye; it wants a check with the real Instrument Serif hinting
  on Windows.
- Size: index.html + notes.md are 46 KB. The two full-height desktop PNGs are quantised to 40 colours
  (about 330 KB each) so the hero gradient and soft shadows band slightly in the shot, not on the page;
  if the folder must stay under 300 KB including shots, the desktop shots should be viewport-only.
