# Desktop window · notes

## The idea
The desktop shell adds no chrome of its own: the window is the web client with the platform's controls set into it, so the navy rail runs from the very top edge and the session's own title row is the drag region. On macOS the traffic lights sit hiddenInset inside the rail above the brand, and the menubar carries a template tray icon with a corner dot while something waits for you; on Windows 11 a 36px titlebar in Dress Blues carries the mark, the document name ("Billing page · Payments · with Bo") and the three caption buttons, so the rail still reads as one column. Everything outside the window speaks the shell's own strings: "Pending approvals · 2", "Handoffs offered · 1", "Open Henosis", "Quit Henosis", a Dock and taskbar badge that counts approvals plus handoffs and never unread chat, and a native notification that lands on the gate notice.

## What to keep
- The window is 1280×840 (the shell's default) on a 1440×900 display, 80px margins, 11px radius on macOS, 8px on Windows, one frame hairline plus one soft drop shadow; no second titlebar, no app name repeated inside the window on macOS.
- macOS: traffic lights at 12px, 8px apart, 4px below the window's top edge, in the rail; the brand row drops 32px to make room. The rail is 840px dense enough to keep the "me" row visible at the window's default height.
- Windows: a single 36px app titlebar in `--rail`, mark + "Henosis" aligned to the rail's column width, the session name after it in `--rail-fg` with a running dot, caption buttons 46×36 with 10px glyphs, close hover in Windows red. The rail brand row is hidden there because the titlebar already names the app.
- Tray: the ring drawn in the bar's own colour (template image), the attention dot in the corner, the menu in native style with the first item hovered. The Windows flyout rises above the tray corner; it may overlap the window's margin but not the composer.
- The composer hint names the platform's keys (⌘ ↵ / Ctrl ↵) and says what closing does ("the window closes into the tray" / "closing hides to the tray").
- Dark: the wallpaper turns navy→chocolate, the window chrome follows the tokens, the traffic lights keep their native colours, the taskbar and flyout go to Windows' dark greys.

## Open questions
- Should the Windows titlebar show the session name at all, or only "Henosis", leaving the name to the title row 36px below? Twice is honest to Windows conventions but reads as a repeat.
- macOS full-screen: the traffic lights vanish and the rail gets 32px back; does the brand row move up or keep its place so nothing jumps?
- Mica/vibrancy: the Windows titlebar could take a Mica tint instead of flat `--rail`; the rail would then differ from the titlebar by a few percent, which may be the better native signal.
- The badge counts approvals plus handoffs; a lead with many teams may want it per project. Is a count on the tray tooltip enough?
- Linux: no traffic lights, no caption-button convention; the Windows layout with GTK-style buttons is the likely answer but is undrawn here.
