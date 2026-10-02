# Judging: desktop explorations

Reviewed as a set: `desktop-window-chrome`, `desktop-tray-notifications`, `marketing-landing`. Each
judged on its `index.html`, its `rationale.md`, and the light and dark captures in `shots100/<slug>/`,
with the captures cropped to native resolution for the craft pass. Scale 1–10 per criterion; overall
is the mean.

**Theme.** All three agree on one idea: the desktop app paints nothing of its own. The window is the
web client with one row and one crease added, the OS draws the frame, the notifications and the tray,
and the landing page is the same session frame at reduced scale with the kernel's own sentences as
copy. That is the right reading of the register: claude.ai and ChatGPT desktop are the web app in a
window, and the one thing Fold adds, the apricot crease running unbroken to the top edge, is the brand
doing its job without a second colour. The set disagrees with itself in two places the product must
settle: how many filled controls a window may show (the chrome frame fills Approve and the send
arrow; the landing frame fills neither), and what the sidebar calls its lists ("Search sessions" and a
projects tree in the chrome, "Search" and "Agents" on the landing). It also leans on one assumption
worth testing before build: that a Dress Blues app icon still reads on a dark notification.

## Scores

| Exploration | Register | Primary action | Restraint | Both themes | Craft | Overall | Verdict |
|---|---|---|---|---|---|---|---|
| marketing-landing | 9 | 9 | 9 | 9 | 8 | **8.8** | keep |
| desktop-window-chrome | 9 | 8 | 8 | 9 | 8 | **8.4** | keep, one revision |
| desktop-tray-notifications | 9 | 9 | 9 | 7 | 8 | **8.4** | keep, revise icon and menu fonts |

No rejects.

## marketing-landing — keep (8.8)

The page is the product's register stretched over a sheet and it holds. One serif sentence at 48px
with the second clause in italic, one grey line, one filled button ("Start a session") and one quiet
arrow link; below it a real session drawn in CSS rather than a grey box, with Ana driving (apricot
ring), Bo correcting a test, and an approval that names the quorum. The three sections are rows with
a hairline above: prose on the left, the product's own grammar on the right (dot-and-word events, the
lead's direction as one serif line, a contention and a memory conflict as the only boxed things, each
on the apricot hairline). Pricing is three rows and a hairline button, so the filled button exists
once on the page. The frame's send arrow is deliberately drawn quiet and its Approve is a hairline
pill, which is the right call: the page keeps one accent. Both captures are the same object; the mark
with the sheet in the text colour and the crease in the ground survives the dark flip where a
hardcoded navy sheet would not. Craft is a point short for two reasons: the frame's sidebar labels
("Search", "Agents", bare status dots without owners) are not the sidebar the chrome exploration
draws, so the marketing frame should be regenerated from the product's sidebar rather than a
simplified one; and the right-hand pillar columns rely on a fixed 34px top padding to align with the
serif h2, which will drift the moment a heading wraps to a third line. Adopt the page as drawn and
make its frame a literal reduced render of the product shell.

## desktop-window-chrome — keep, one revision (8.4)

The decision is right and the rationale is tight: no titlebar of our own on either platform, the
sidebar runs up into the title region and holds the traffic lights at (14, 20), the main column's
first row is the drag region, and the two rows share a height (52px macOS, 40px Windows, 48px web)
so the crease runs from the window's top edge. The rejected native titlebar is shown honestly and
loses on its own evidence: two bars, the title twice, the crease stopped short. Section D is the part
most explorations skip and here it is complete: fullscreen collapses to 40px and the wordmark slides
left, the collapsed sidebar keeps the lights and starts the row at 84px, inactive dims only title and
controls, Windows maximised loses its radius and swaps the glyph, close-hover takes the system red.
Section E reads as a build spec. Dark is designed, not inverted, and the only non-palette colours on
the screen are the OS's own lights. The one revision: frame A fills both Approve in the notice and
the send arrow in the accent, which breaks the rule the brand doc and the earlier judgments both
state, one filled control per screen. The landing page draws the same notice with a hairline Approve
and is correct; the chrome should match it, or drop the send arrow to ink while a notice is open.
Craft notes: the frames are a fixed 1360px so the sheet overflows below that width (acceptable for a
desktop exploration, but the collapsed-sidebar row should be shown at a narrow window too), and the
exploration page's theme toggle overlaps frame A in the capture.

## desktop-tray-notifications — keep, revise icon and menu fonts (8.4)

The strongest copy rules in the set. Every notification is one shape: the ask as the title with the
object in it ("Approve delete legacy_invoices?"), a body naming who and where plus the one fact that
changes the answer, at most two actions that name the act. Irreversible calls get Review and Deny and
never Approve from a banner; reversible ones get Approve and Deny; handoffs get no buttons because
driving is taken in the session with the brief in view. Dismiss is not Deny. The tray is four plain
rows and the menu bar carries the same single number as the sidebar: things that need this person.
The anatomy table at the bottom is the kernel's contract and should be lifted into it as written.
Two things cost it points. Both themes: the app icon is the mark on a hardcoded Dress Blues sheet, and
on the dark banner (#1F2430 ground) the sheet all but disappears, leaving an apricot triangle floating
beside the title; the Windows taskbar icon has the same problem. A real app icon cannot read the
theme, so the icon itself needs a stronger linen crease and a lighter edge, and the exploration should
show the icon at 32px on both grounds before the asset is cut. Craft: the tray menus set approvals in
JetBrains Mono and session names in Instrument Serif, while the rationale claims nothing custom is
painted. macOS can carry attributed titles in an NSMenu; a Win32 tray menu cannot without owner-draw,
which is the custom painting the exploration rejects. Either accept plain system text in the menu
(the right answer, in this register) or say that the Windows menu is owner-drawn. The macOS banner
also shows its two buttons inline on hover where the system would show them under an Options
disclosure; fine as a spec, but the build should expect the system's behaviour.
