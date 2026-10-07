# First run on the desktop · notes

## The idea
The desktop first run is the web client's three steps with the two things only the shell needs to know pulled out in front: where the server is (step 2, the address of `henosis serve`, with the local one a click away) and where Henosis waits when the window is closed (step 4, the tray). The hero screen is the whole desktop at step 4: the tray menu is actually dropped open in the menu bar beside the window that explains it, the Dock carries the badge, and the window's page half shows the three tray states as tiles, three preferences, and a wash card that says what already waits for Dee (two approvals, one handoff) before the one gradient action, "Enter the circle". The navy side of the window folds the done steps to a serif line with their facts (version, server and projects, identity and keychain) under the four stages of the mark, and ends with who is already in and that Bo has the baton.

## What to keep
- The tray taught by showing it: the real menu open in the menu bar during the step, not a diagram. Rows exactly as the shell has them (Pending approvals · N, Handoffs offered · N, Open, Quit) with the next item named under each.
- The four stages of the mark as the step marks: faint ring, one arc, two arcs apart, the closed ring with its centre; done steps gain a green check, the current step sits on apricot wash inside the navy side.
- Done steps fold to one line that keeps the facts: `henosis.payments.internal · Payments team · 4 projects`, `Dee · dee · token kept in the keychain`.
- The tray icon as a monochrome template glyph (ring and centre, 18 px) whose only colour is the apricot dot when something waits; the Dock badge is the total of approvals and handoffs.
- "Three things already wait for you, Dee." on apricot wash, with agents' avatars and tool names in mono, so the first click after first run has somewhere to go; the caption says the stream will read *Dee joins the circle*.
- The server step's two outcomes: the green line with version, team and project names; the red line with the timeout and "Is the VPN on?" plus Retry; "Use the local server" as the quiet way out.
- Sign-in checks the user id against users.json as you type ("known"), the token is optional and goes to the keychain, and the role line says what a contributor can do and that Ana can raise you.
- Dark: the window's side goes to the deeper rail navy, the menu bar and Dock go translucent dark, the status greens lift, the tray menu stays a light-on-dark surface with the apricot hover row.

## Open questions
- The shell's tray rows carry only the count today; the sub-line that names the next item (tool, session) needs the inbox poll to return the first item's title. Worth adding to `/api/notifications`?
- Should the first run let the window close to the tray at the end ("Open at login" on, window closed), or always open the first approval? The screen offers both; the product should pick one default.
- The server field assumes one team per server; when `/api/me` returns several teams the folded line "Payments team · 4 projects" becomes a pick, as in the web client's step 2.
- Windows has no Dock badge, so the "Badge on the Dock" preference must hide there and the tray icon carries the count; the tiles need a Windows and Linux variant.
- A token is optional for a local server but the keychain tick reads as if it is always there; hide it when the token field is empty?
