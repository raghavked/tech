# Team look editor · notes

## The idea
A lead dresses the team in four colours, a mark style, a motion level and an emblem, and the look never leaves the screen: the editor sits on the left, Bo's session painted with the draft sits sticky on the right, so every change is seen before it is saved. The draft shown is Ana's: Fondant with a terracotta accent she typed, a warmer highlight and the "Pa" emblem; two contrast checks are low and the page says so in the table, in the fix line with the nearest passing accent, and in the save bar, without blocking the save. The three presets are the palette in miniature inside the Colours card (a rail strip, a cream page, one button), and on the dark canvas the highlight becomes the hand, just as apricot does in the tokens, so the checks table has a cream column and a dark column rather than one number that could never pass both.

## Keep
- Editor left, live preview right and sticky; the preview is a real slice of the shell (rail with brand, New session, two agent cards; canvas with title, Team pill, a team message, Approve/Revise, a focused field) painted only through `--p-accent / --p-highlight / --p-surface / --p-glow`.
- The hand rule: `--p-hand` is the accent on cream and the highlight on the dark canvas, with `--p-hand-fg` flipping to the surface colour. The preview, the save button and the checks all follow it.
- Contrast as a small table with a minimum tick on each bar: five checks (hand as text on the canvas, text on the hand, rail text on the surface, highlight on the surface, the two arcs apart), two columns (cream, dark), fine in green and low in red, and a fix line that names the nearest passing hex with a one-tap "Use" button.
- Changed rows washed apricot with a CHANGED tag, and a save bar that counts the changes, names them, repeats the low checks and says who gets the look (Ana, Bo, Cy, Dee and the two agents, on their next load).
- Mark styles are only what sits at the centre of the two arcs (centre dot, emblem, dot only for the small cut); the arcs and the disc are never options. Motion has three levels (Full, Quiet, Calm) with the reduced-motion override spelled out.
- The mark is one `<symbol>` set driven by inherited `--md/--ma/--mb/--mc` variables, so one asset serves the rail, the segment, the emblem row, the preview and the save bar.
- Mobile: preview first, then the editor in one column, three preset tiles across, the checks table at 84 px columns, and a compact save bar with the text on its own line.

## Open questions
- Should a low check block Save, or only warn as here? The app today only refuses a bad hex; a warn-and-save keeps leads in charge but ships an unreadable link colour to the whole team.
- The app's mark options are still named ring / bead / dot from the older mark. Rename them to centre dot / emblem / dot only, and move the emblem from "beside the wordmark" to the centre of the ring (as the team-emblems board proposes), or keep both placements?
- The dark-canvas rule (highlight is the hand) is a design decision this page makes; `TeamLook.tsx` paints `--accent` literally in both themes. Confirm and add the dark column to `checksOf`.
- Motion has two levels in the app (full, calm); "Quiet" (loaders only, no side motion) is new. Worth a third value, or is calm enough?
- Glow has no contrast check because it is a halo, not text; should the editor at least warn when the glow equals the canvas?
- The preview's Cream / Dark segment follows the page theme here; in the product it should switch the preview independently so a lead on a light screen can see the dark result.
