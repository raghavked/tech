# Keyboard shortcuts sheet · notes

## The idea
Pressing `?` (or ⌘/ while typing) lifts one sheet over the session you were in, and the sheet is a register rather than a cheat card: every session key says what it would do right now in this session ("a" approves `git push … :main` and sends four stars, which grants the gate with Bo's 4; "h" offers the baton to Dee and Bo; "j" goes to Tally), and the three keys that would act on something waiting are lit in the apricot wash with the key in the hand colour. The keys are exactly the ones the app answers to (shortcuts.ts for the session and anywhere, the composer's Enter and Shift+Enter, the ⌘K palette, the approvals queue's j/k/a/d/Enter/o) grouped by where they apply, so the sheet doubles as the one place a person learns that letters only work outside a text field. A key with nothing to do steps back ("k" when the current session is first in the rail) instead of disappearing, so the map stays stable and the eye learns positions.

## What to keep
- The subtitle names the session in Instrument Serif and says "you are driving": the sheet is about this place, not the product.
- Live rows: apricot wash `--live-bg` plus a hairline `--live-line`, the key cap filled with `--accent`; everything else stays quiet. The footer legend explains the wash in one line.
- The second line under each key ("now") carries the live state in the same vocabulary as the stream: the amber waiting dot, the `irreversible` pill in the danger wash, the four-of-five stars, mono for the git command and the branch, serif for Dee and Bo.
- Key caps: 26px, mono, a 1px line and a 1px drop so they read as keys in both themes; `esc`, `↵`, `⇧`, `⌘` as glyphs; "or" between alternatives in the queue row.
- Two columns at 880px: left is this session and the composer (what you do), right is anywhere, the queue and the palette (where you go). The right column has its own hairline, no cards inside cards.
- The ⌘/Ctrl segment in the footer: the app already picks the label from the platform (`modLabel`), the toggle makes that visible and testable.
- Dark: sheet surface `#242C3C` with the top highlight and 6% hairline, scrim near-black 52%; the live wash drops to 10% and the idle colour lifts so dimmed rows still read.
- Mobile: a bottom sheet with a handle; the queue and palette groups hide (no hardware keyboard there, but iPad keyboards exist, so the session and anywhere groups stay); the footer keeps the legend and the modifier switch.

## Open questions
- `?` already opens the sheet while not typing; should pressing a lit key while the sheet is open act and close it (so the sheet is also a confirm step for "a" on an irreversible push)?
- The "now" line needs session state in the sheet; today `ShortcutSheet` renders only `SHORTCUTS` with no session. Is a `context` prop (waiting approval, offered handoff, driver, rail neighbours) worth the plumbing, or should only the three action keys be live?
- "@ mentions a person or an agent" is composer behaviour, not a registered shortcut. Keep it here as the one typed symbol worth teaching, or leave it to the composer's placeholder?
- The queue's `o` and `Enter` both open a session; should the sheet print both, or only `Enter` and leave `o` as a vim nicety?
- Should the ⌘/Ctrl segment actually switch the printed labels (a preference), or only show which platform was detected?
- On a page that is not a session (overview, project, inbox) the left column is empty; does the sheet collapse to one column, or does it show the session group dimmed with "open a session to use these"?
