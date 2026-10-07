# Notifications · notes

## The idea
A notification is one sentence said at three distances: a toast in the bottom-right corner while you are in the window, a native banner when the window is behind, and a row in the inbox always, with the same words in all three ("Cy mentioned you in #billing", "Dee joins the circle.", "Bo offers you the baton."). The toast is a small card with a crease on the left that names the kind, the serif who, the one sentence, and a second line that says where and what it means for you ("You can approve, Ana"); decisions (approval, handoff, blocked) stay until answered and carry `y` / `n`, news (mention, joined, done) drains over 8 s along an apricot life line that pauses on hover. Three toasts show, newest nearest the corner and the rest fold into a navy tail that counts what waits in the inbox and opens it.

## What to keep
- The shape: 340 px, crease by kind (warn, apricot, apricot-deep, ok, danger), 28 px icon or avatar or the mark, serif who, Sans sentence, Mono for the call, at most two buttons plus Open, the × top right.
- Decisions never time out; news drains; the drain is a 2 px apricot line at the bottom, apricot-deep when paused, gone in calm mode.
- The stack above the composer, not over it: bottom 112 px, right 24 px, newest at the bottom so it rises in; older rows dim to .94 and .86; decisions outrank news in order and fold last.
- The navy tail "2 more wait in the inbox · Open g i" instead of a fourth toast.
- Joined carries the mark closing its arcs, the only toast with motion of its own; it never becomes a banner, the team panel ripples instead.
- Answering from the toast ("Approve · 4", "Take the baton", "Reply") closes it and leaves one line in the stream; dismissing leaves only the inbox row.
- Same ref twice updates the toast in place (and replaces the OS banner by `tag`).
- OS variants: alert style with the toast's first two buttons for decisions, banner for news; the tray and dock badge counts decisions only; sound once for decisions and only after a minute away.
- Mobile: banners from the top as a deck (the older one peeks behind), the pending approval as a full-width strip above the composer with 40 px buttons.
- The plain text toast ("Copied the share link") stays as it is in the app today: bottom-centre, 3 s, nothing to click.

## Open questions
- The app's toast store is text-only and bottom-centre (`toast.ts`, `MAX_SHOWN = 3`); this needs a typed toast (`kind`, `ref`, actions, `sticky`) fed by the inbox stream, and the plain one kept beside it. Does one stack hold both, or do plain toasts stay centred and typed ones go to the corner as drawn?
- `y` / `n` on the newest decision toast collide with the same keys proposed on the approval notice; one target must win, probably the notice when it is focused, otherwise the toast.
- Approve from a toast sends 4 unrated; under a ratings rule the toast should open the notice instead of voting. Needs the `ratings` flag from the Notification to choose.
- Hover-pause reads well on a mouse; on touch the drain has no pause, so news might need 10 s there.
- Dark: the status colours are overridden on this page (as on contention-handoff and approval-notice); tokens v6 should carry dark variants.
- The shot budget forced the dark board to 80% scale and 32 colours; the full-size dark board was checked during the work.
