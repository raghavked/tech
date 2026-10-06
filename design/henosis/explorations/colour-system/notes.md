# Colour system — notes

## The idea
Three colours with jobs (frame, hand, pulse) on a cream page, and everything else derived from them by one
rule each: tints mix toward cream and shades toward the darkest canvas, so a navy tint is a warm grey and a
chocolate shade never goes cold; the status colours are the brand colours moved along one axis (warn is
apricot deepened, danger is chocolate pushed toward red, paused is navy lightened) with only running-green
borrowed, tuned to the family's saturation. The board renders every text/ground pair as itself with its
WCAG ratio, so the rules at the bottom (apricot is never text on cream, chocolate never sits on navy, warn
has an ink, ink-3 is metadata) are read off the table rather than asserted.

## Keep
- The four-job card as the one source: every hex on the page is computed from #2A3244, #56352D, #E2C4A6
  and #FBF7F1 (the generator is in the page's own numbers, not in a script).
- The ramp recipe: tints toward cream, shades toward #0B0E14; apricot's shades toward chocolate so that
  apricot 600 = apricot-deep and 700+ becomes the hand.
- The derived status set and the proposed tokens: `--ok-ink #3E6639`, `--warn-ink #7F5320`,
  `--danger-ink #8E3A30`, `--info-ink #4A5162` for text in pills and notices, and dark values for
  `--ok / --warn / --danger` (#9BC88F, #E2B06A, #E2847A: the rail dots already use them). Today the
  tokens keep the light status values in dark mode, where they fall to 2.2–3.3 : 1.
- The contrast table as a self-evidencing artefact (sample text in the real colour on the real ground,
  verdict chip with the ratio) and the "status is a word and a colour" rule.
- The dark-mode caveat: at night the hand and the pulse are both apricot; shape keeps them apart (hand is a
  filled pill/arc, pulse is a dot/ring/glow/wash), and `--team-highlight` never follows a team accent.

## Open questions
- Should the dark-mode hand be apricot 400 (#E7CEB5) on buttons only, so the pulse stays one notch deeper
  than the hand? The twin card shows the current mapping; the alternative is untested.
- `--warn #B9792E` is 3.4 : 1 on cream. Keep it as the dot/bar colour and add `--warn-ink`, or darken the
  base to ~#A56A22 so one token serves both? The board proposes the first.
- `--ink-3 #8E94A3` is 2.85 : 1 on cream. The app uses `.faint` for timestamps and token counts; is any
  `.faint` text a sentence someone must read? If so it needs `--ink-2`.
- `--info` equals `--ink-2`: deliberate, but a paused status dot then has the same colour as secondary
  text. Worth a check in the rail, where the paused dot sits beside `--rail-muted`.
- Size: index.html + notes.md are 78 KB. The three full-height shots are stored at 50–60 % scale and 48
  colours (about 200 KB each) because a 6000 px board cannot fit three legible full-page PNGs in 300 KB; the
  page itself is well under the limit. Reshoot at full scale with `full` when reviewing details.
- The contrast table scrolls horizontally on a phone (six grounds need 760 px); a phone-first version would
  split it into "on cream" and "on navy" tabs.
