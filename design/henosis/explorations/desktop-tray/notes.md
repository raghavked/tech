# Desktop tray · notes

## The idea
The tray answers three questions in one click: what awaits you, where were you, and how do you get back. The native menu lists the actual items under the counts the shell already keeps ("Pending approvals · 2", "Handoffs offered · 1", and "Mentions · 2" when there are any), then a Quick open submenu of the last five sessions and rooms by name, Pause notifications, Open and Quit; the native notification says one sentence in the same grammar as the toast and the inbox row (who · verb · what, then where and what it means for you) and carries the first two buttons of the notice. Every row and every banner is a `henosis://p/<project>/s/<session>` link that opens the window on the notice, and the badge counts decisions only (approvals plus handoffs), so a mention never makes the Dock red.

## What to keep
- The menu is native (Tauri `Menu`, `Submenu`, `IconMenuItem`), one line per item: serif who, verb, the what in muted, the age at the right. No second line, so the where lives in the banner, not the menu. Five per section, then "and 3 more… in the queue".
- Section headers are disabled items with the count at the right; Mentions only appears when there are some, and clears when the room is read.
- Quick open: five last sessions and rooms by name, then Inbox (with the unread count), Approvals queue, New session…. Opens leftward at the screen edge on both platforms.
- Pause notifications for an hour, until tomorrow, or until you say; the icon dims and shows a moon; approvals still badge.
- The badge counts approvals + handoffs; the tray dot means "something awaits you"; on Windows, where there is no Dock badge, the taskbar button carries the count.
- Banners: approval, handoff, blocked, contention and mention for anything not on screen; done and plan only when opted in. Decisions are alert-style on macOS and keep their buttons on Windows; news slides away. Sound once per decision and only after a minute away. Same `tag` replaces in place; approving in the window withdraws it.
- The avatar in a Windows toast is the one who asks (an agent's rounded square, a person's circle); on macOS the app icon stays, as the system draws it.
- Global shortcut ⌥⇧H / Ctrl+Shift+H brings Henosis forward; "Open Henosis" restores the last window and route.
- The grammar table at the foot of the board: title, body, buttons and tag per kind, the same words in the toast, the banner and the inbox.

## Open questions
- `main.rs` builds the menu from counts only and polls `/api/notifications?unread=1`; listing items needs the rows (id, kind, title, href, age) kept in `Shell.items`, which the poll already fetches, and mentions need the server to emit `kind: "mention"` rows for the signed-in user, which `notify.ts` does not do yet.
- "Approve · 4" from a banner needs a route for the action: macOS alert buttons and Windows toast buttons both reach the app through the notification plugin's action events, which the bridge does not expose yet (`notify` is fire-and-forget). Under a ratings rule the button should open the notice instead; the row needs a `ratings` flag.
- Quick open needs a "recent routes" list the client sends through `setRoute`; the shell keeps the last five per user. Rooms (#billing) need a `henosis://p/<project>/g/<group>` link, which the deep-link handler does not parse today.
- Native menus cannot show the serif face or the avatars exactly as drawn; Tauri icon items take a 16 px bitmap, so the avatar becomes a two-letter disc rendered by `make-icons.mjs`, and the who is the system font. The board shows the intent, not a promise of typography.
- Pause state should sync with the in-app calm mode or stay separate? The moon on the icon suggests one switch.
- Shot budget: the light shot is the full board at 24 colours; the dark shot is the 1440×900 top of the board (title band and the macOS desk), while the full dark board was checked during the work. The page drops the canvas wash and card shadows for the same reason.
