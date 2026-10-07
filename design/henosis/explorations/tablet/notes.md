# Tablet · notes

## The idea
A tablet is a desktop you hold: in landscape (1024 × 768) the window sits inside the desktop's compact range, so the same rules apply — the rail folds to 72, the column keeps its 780, Details and the Team panel ride over the right as a 320 sheet — with every target grown to 44 and hover replaced by a long-press peek. In portrait (768 × 1024) there is no room for a rail and a column, so the rail leaves the shell and comes back, unchanged, as a left sheet over a scrim from the Agents button or an edge swipe, while the column becomes the page at 728 with 20 gutters and nothing in the stream is restyled. Turning the tablet moves the rail, never the stream: the last read message stays anchored, an open Details sheet stays open in both orientations, and under 1100 wide the page itself is the tablet (`shot-light.png` is the landscape truth at 1024 × 768, `shot-dark.png` the portrait truth at 768 × 1024, `shot-board.png` the board at half size).

## What to keep
- One rule for both orientations: the 780 column is the fixed thing; the rail and the drawer give way. Landscape = the desktop compact layout with touch sizes; portrait = the compact layout with the rail removed.
- Touch sizes as a spec, not a vibe: rail squares 44, avatars 40, icon buttons 44, stars 32, note field and action buttons 40, 26 of clearance over the home indicator. The composer's segments grow to 36 high.
- Long-press as the one replacement for hover: the collapsed agent card (navy peek with the serif name, Team pill, italic "what it is on", ratings, spend, and "tap to open · release to dismiss"), the token chip's breakdown, and a presence avatar all use it.
- The Details sheet without a scrim, with a grab bar and a pin: the stream still scrolls under it; pinned, it docks and the column drops to 640, the one case where the column gives way.
- Portrait topbar: Agents button with the needs-you count in chocolate (so a folded rail never hides a release gate), two-line title (name; status + Team pill), token chip, presence, Team and Details as icons.
- The keyboard-aware composer: "⌘↩ sends" only with a hardware keyboard; the soft keyboard lifts the composer and the stream keeps the last message in view.
- Split view: at 1/2 of a landscape tablet (507) the phone layout takes over; at 2/3 (678) portrait rules. Breakpoints on the ruler: 480 phone · 768 portrait · 1024 landscape · 1180 rail unfolds · 1440 full.

## Open questions
- Should the Details sheet be pinnable at all in landscape, or is a 640 column too narrow for the plan card's token column and the gate's rating row? The compact exploration argued the column never gives way; the tablet wants a glance-at-usage habit back.
- Long-press peeks collide with the system's own long-press (text selection, context menus) on the stream; the rail and the chip are safe, the presence stack over the title may not be.
- In portrait the rail sheet hides the stream under a scrim. A 72 collapsed rail in portrait would leave a 696 column at 20 gutters — still readable. Is the sheet worth the extra tap for the full cards, or should portrait fold rather than hide?
- Rotation with a sheet open: keeping Details open is stated here, but an open rail sheet closing on rotation (because the rail returns as a column) may surprise; a short "the rail is back" crossfade could cover it.
- The app today narrows the sidebar to 220 between 641 and 1024 and the drawer to 280; this exploration replaces that band with fold-to-72 / rail-as-sheet. Which widths does the app's `styles.css` adopt, and does the mobile 640 breakpoint move to 507 for split view?
