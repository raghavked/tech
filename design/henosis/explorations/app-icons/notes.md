# App icons — notes

## The idea
One master artwork (the two arcs and the centre bead from `design/mark.svg`, on its 96-unit grid) is cut
for every door the product has: macOS squircle, Windows disc-on-alpha, iOS full-bleed with light/dark/tinted
appearances, Android adaptive layers plus a monochrome layer, SVG and ico favicons, a macOS template tray and
a colour tray for Windows and Linux, and the Slack square. Each platform supplies the shell and the mark goes
bare on it, never a disc inside a shell; the ring's scale (72 % of the shell, 54 dp inside Android's 66 dp
safe zone) is set once by the Android safe zone and reused everywhere. The bead is a state rather than
decoration: every shipped app icon carries it, and only the tray drops it, for idle and offline, so the ring
closing on the menubar means the same thing it means in the app: someone joined.

## Keep
- The two cuts: default (arcs r 28, stroke 10, bead r 7) from 32 px up, small (r 27, stroke 13, bead r 9,
  seams opened 1 u) at 24 px and below, so apricot and chocolate stay two colours at 16 px.
- Four grounds with one rule each: navy for stores and docks, deep navy (`--mark-disc` in dark) for dark
  appearances, cream only on documents (invoice PDF header, share cards) with the person's arc turned navy,
  monochrome for the tray and Android themed icons.
- The four tray states (idle = empty ring, live = bead, needs-you = bead + coral pip composited by the shell,
  offline = ring at 55 %) and the tray menu that names what is live: Ana's agent on Billing page, Bo with the
  baton on Checkout, the invoice PDF release gate held by Dee.
- The export manifest as the contract for `scripts/icons.mjs`: one SVG, resvg at 1× and 2×, cut swap at 24,
  bead dropped only for tray frames.
- The six don'ts, especially "disc inside a shell" and "one-colour ring" (the retired ring-and-bead).

## Open questions
- Android themed icons: the monochrome layer shows the bead, so a live/idle distinction is impossible there.
  Fine for a launcher icon, but should the Android notification small icon (also mono) use the empty ring?
- The seam opening in the small cut is 1 u by eye; it wants a check on a real 16 px Windows taskbar at 100 %
  scaling and on a 1× macOS menubar, where the template is rendered black on light grey.
- iOS tinted appearance: Apple wants greyscale with the shell lighter than the glyph; the light-grey squircle
  with a white mark reads as a target at 60 pt. A darker grey shell with a white mark may hold the ring better.
- Does the Team look editor's custom accent reach the icon set? This board assumes no: the stores and the
  tray always show brand colours, and a team accent changes only the in-app mark.
- The Slack avatar at 36 px uses the default cut; Slack's 20 px sidebar entry would benefit from the small cut,
  but Slack accepts a single 512 file, so the sidebar is whatever Slack makes of it.
- Size: index.html is 53 KB; to keep the folder under 300 KB the light shot is the full board at 640 px wide
  (24 colours), the dark shot is viewport-only at 1440×900, and the mobile shot is viewport-only. The full
  1440 px board was reviewed at full resolution before quantising.
