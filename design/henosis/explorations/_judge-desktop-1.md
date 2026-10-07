# Judge panel · desktop · 1

Theme: **desktop** (desktop-window, desktop-tray, desktop-compact).
Judged against BRIEF.md and tokens.css v5, with every PNG opened (light, dark, the Windows desk, the 960
truth shot) and each page's style and markup read. Scores are 1–10 for on-brief (vibrant, unity, palette
roles), craft (alignment, type, states), truth to the product and the platform, and distinctiveness from
claude.ai, ChatGPT and Linear. Explorations were not edited.

| Exploration | On-brief | Craft | Truth | Distinct | Overall | Verdict |
|---|---|---|---|---|---|---|
| desktop-compact | 9 | 8 | 8 | 8 | 8.3 | keep |
| desktop-window | 8 | 7 | 8 | 8 | 7.8 | keep |
| desktop-tray | 7 | 6 | 7 | 8 | 7.0 | revise |

Shared facts, checked once: all three use `../../tokens.css` plus a page style, no scripts, no "AI-powered",
and draw the two-arc mark (disc, arc a, arc b, centre dot), never the ring-and-bead. All three keep the
brief's shell: navy rail from the very top edge, cream canvas, chocolate for the hand, apricot for counts,
selection, the live step and the Team pill. The three pages disagree on the cast: the window and compact
rails give Billing page to Ana (with Bo), Checkout to Bo (with Ana), Invoice PDF to Cy and Tax lines to
Dee; the tray page's menu says Billing page is Bo's agent, Checkout is Cy's and Invoice PDF is Dee's. The
stream's agent is "Billing page" with a `Bp` avatar on the window page and "Ana's agent" with an `a` on the
compact page; the gate's second button is "Hold" on one and "Ask to revise" on the other. The macOS menubar
reads File · Edit · View · Session · Team on the window page and File · Edit · Session · Team · View on the
tray page. One shared slip of the shot pipeline: both the window and the tray shots are palette-reduced,
so the soft shadows the brief allows band into cream blobs (around Ana's bubble, the gate and the composer
in the window's light shot), speckle along the window's left edge and composer corners in the dark shot,
and stripe the wallpapers. The tray page went further and removed the canvas wash and the card shadows from
the page itself to fit the budget, which changes the design to suit the screenshot.

---

## desktop-compact · 8.3 · keep

**What it is.** The 960×760 window on the left, with Bo's hover card open on the collapsed rail; four
numbered pins and their rules on the right; a full/compact spec table; and a breakpoint ruler (480 phone,
720 drawer overlays, 960 this page, 1180 rail folds, 1440 full). Under 1000px the page becomes the window
itself, so `shot-960.png` is the real thing with no board around it.

- **On-brief 9.** One gradient (New), apricot only where something is live or chosen (the counts, the
  active avatar's ring, the live test row, Bo's team message, the open Team button's wash, the `P` of the
  project in serif apricot), chocolate only on "Approve with 4" and the send button. Dark is correct
  throughout: the accent flips to apricot, the pins invert to apricot on navy, the hover card's `rail-2`
  on `rail` still reads. The serif-for-names rule holds down to the 13.5px window title and the 15px
  session name in the hover card.
- **Craft 8.** The board is the best-argued of the three: the pins point at the exact spots, the spec
  table strikes through the full values, the ruler puts the breakpoints in one place. The collapsed rail
  keeps the full rail's order and its counts, the status dot sits at the avatar's corner with a `rail`
  border, the active avatar is ringed, "you" sits at the bottom with the expand button. The gate's
  one-row rating (stars, note, "1 of 2 contributors at 4+") fits 780 without crowding. Three slips. The
  hover card is the hero of the shot and it covers the first line of Bo's live team message, which the
  notes see but the design does not solve. The Details drawer's 10px peek sliver on the window's right
  edge reads as a rendering fault rather than an affordance, and the `seg-dots` at the gate's right (two
  dashes, one apricot) have no label anywhere. The board's stream is bottom-anchored, so the first visible
  line is a mid-sentence cut ("per tax, the prorated credit above the total.") that reads as a crop on a
  board, though it is honest in the 960 shot.
- **Truth 8.** The rule is argued against the code as it is (the sidebar narrows to 220 between 641 and
  1024 and leaves a 616 column at 960), and the better trade is stated with numbers. The rail, topbar,
  stream and composer carry the app's real parts. Two drifts from the sister pages: the agent is "Ana's
  agent" here and "Billing page" on the window page, and the push it asks for is `pdf-layout`, which the
  brief gives to the Invoice PDF session, from inside the Billing page session. The composer's third chip
  is `scope goal` here and `Plan first · 4 steps` on the window page.
- **Distinct 8.** Icon rails exist on Linear, Slack and ChatGPT's desktop app; what makes this one
  Henosis is that the icons are the agents themselves, with status at the corner, the active one ringed
  in apricot, the project as a serif initial, and the card that opens in navy with a serif name and the
  italic "what it is on". Nobody else folds a sidebar to a row of members.
- **The fix that matters.** Open the hover card beside the stream, not over it: a 400ms rest before it
  shows, and a placement that drops below the pointer when the row to its right is the live message, or
  a click-to-peek card on the collapsed rail. The rest of the page is ready to be the rule.

## desktop-window · 7.8 · keep

**What it is.** A 1440×900 macOS desktop with the 1280×840 window at 80px margins, traffic lights set
into the rail above the brand; the same window on a Windows 11 desk with a 36px Dress Blues titlebar
carrying the mark, "Billing page · Payments · with Bo" and the caption buttons; a strip with the macOS
tray menu, the Dock badge and a native notification; and a dark version in which the wallpaper turns
navy→chocolate.

- **On-brief 8.** Inside the window the roles are exact: one gradient (New session), apricot for the
  counts, the Team pill, the token budget's hairline and the live run row, chocolate for Approve and send,
  the navy rail from the top edge. The dark desk is the most vibrant image in the theme: the wallpaper's
  navy→chocolate wash behind the cream-on-navy window, with the traffic lights keeping their native
  colours. Two leaks of brand into chrome that is not ours: the macOS tray menu's hovered row is filled
  with `var(--accent)` (a native menu highlights in the system colour), and the Windows taskbar's active
  underline is `--apricot-deep` (Windows draws it in the user's accent). The sister tray page gets both
  right with system blue.
- **Craft 7.** The measurements are good and written down: 11px and 8px radii, one hairline plus one
  shadow, 46×36 caption buttons with 10px glyphs and the close hover in Windows red, the rail dense enough
  to keep the "me" row at 840. The brand row hides on Windows because the titlebar names the app, which
  is the right call. The composer hint names the platform's keys and says what closing does. Misses: the
  shots are palette-reduced and the shadows turn into blobs and specks, so the "soft shadows allowed"
  clause of the brief cannot be verified from them; the Windows flyout at `right:16px` overlaps the
  composer's right edge, which the notes promise it never does; the Windows desk is 924px tall, not the
  900 the page claims; the topbar is `-webkit-app-region: drag` with no `no-drag` on its buttons, so in a
  real shell Share, Team and Details would drag the window; the `Bp` agent avatar at 22px repeats the
  mixed-case glyph the chat panel already flagged. The strip's tray menu lists counts only ("Pending
  approvals · 2") and is superseded by the tray page's item menu.
- **Truth 8.** The platform conventions are observed, not approximated: hiddenInset lights in the rail,
  the session's own title row as the drag region, the Windows titlebar carrying the document name, the
  badge counting approvals plus handoffs and never chat, a notification tagged so a repeat replaces. The
  open question about the Windows titlebar saying the session name 36px above the title row is real; the
  answer is "Henosis" only, as the notes suspect. One product slip: the release gate in the Billing page
  stream is Checkout's (`run db:migrate` on `payments-prod`), with no origin line saying it came from
  another session; the brief's "gate held by the people who consume the code" explains why Ana holds it,
  but the notice must say so.
- **Distinct 8.** Linear's Mac app also sets the traffic lights into its sidebar, so the frame alone is
  not a signature; the navy column that runs from the very top edge with serif session names, the cream
  stream and the template mark with an attention dot in the menubar are. The Windows titlebar in Dress
  Blues with the mark and the running dot is a native-feeling thing no competitor draws.
- **The fix that matters.** Give the OS's chrome the OS's colours and let the tray page own the tray: the
  menu hover to system highlight, the taskbar underline to the Windows accent, and the strip's counts-only
  menu replaced by a pointer to desktop-tray. Then re-shoot at full colour so the shadows read as drawn.

## desktop-tray · 7.0 · revise

**What it is.** A tall board: a title band with the three questions the tray answers; the macOS corner
with the tray menu open (Pending approvals, Handoffs offered, Mentions with the actual items, Quick open
and Pause as submenus, Open and Quit), the Quick open submenu, and three banners; the Windows corner with
the same menu rising from the taskbar, two toasts and the taskbar badge; then the rules in three cards, the
five icon states (quiet, attention, linen, paused with a moon, Dock badge) and a notification grammar table
(kind, title, body, buttons, tag).

- **On-brief 7.** The brand is rightly reduced to what a tray can carry: the mark as a template icon, the
  attention dot, the badge, the strings, the serif who. The Windows icon in linen with an apricot dot and
  the paused moon are small and right. But the decision buttons on the macOS banners and the Windows
  toasts are hardcoded `#56352D` with `#FFF8F1` text, which does not flip in dark (on the dark banner the
  chocolate fill nearly disappears against `rgba(44,47,56)`), and is a fill macOS will not render on a
  notification button at all. The page also drops the canvas wash and card shadows "for the shot budget",
  so the rules section is flatter than the system it describes.
- **Craft 6.** The grammar table and the three rule cards are the most useful spec in the theme, and the
  menu rows (serif who, verb, muted what, age at the right, five per section, "and 3 more… in the queue",
  "Nothing awaits you, Ana.") are finished writing. The drawing is where it falls down. The caption says
  banners "stack under the menu bar" and toasts "come in at the bottom right", yet the banners are placed
  at `left:56px; top:322px` and the toasts at `left:56px; bottom:96px`, on the wrong side of both screens,
  because the open menu already occupies the right. The board therefore shows a frame that cannot happen.
  In the Windows menu two rows are highlighted at once ("Bo's agent" and "Quick open"); in the macOS menu
  the first item is highlighted while Quick open's submenu is open, which is the reverse of what a native
  menu does (the parent of an open submenu is the highlighted row). The dark shot is the top 900px only,
  so the Windows desk, the icon states and the rules were not looked at in dark. The light shot is 24
  colours and the wallpapers band into stripes.
- **Truth 7.** The product thinking is strong and candid: every row and banner is a `henosis://` route
  that scrolls to the notice, the badge counts decisions only, mentions never badge, sound once per
  decision and only after a minute away, same tag replaces, the session on screen never notifies, and the
  open questions name the exact bridge gaps (`Shell.items`, `kind: "mention"`, action events, recent
  routes, the `g/<group>` link). Two things need answering. The cast contradicts the sister pages (Billing
  page is Bo's agent here and Ana's in the rail; Checkout is Cy's here and Bo's there). "Approve · 4 on a
  banner votes the default rating without opening the window" lets an irreversible action be approved
  from a toast without seeing the notice; the brief's approvals carry a 1–5 rating that is a judgement,
  and the rules' own exception ("under a ratings rule it opens the notice instead") should be the rule.
- **Distinct 8.** No competitor's tray lists the approvals waiting for you by who · verb · what, offers a
  baton, or opens the last five sessions and rooms by name; Linear's and ChatGPT's trays are Open and
  Quit. The template mark with a corner dot, the paused moon, and the one-sentence grammar shared by
  toast, banner and inbox are Henosis.
- **The fix that matters.** Draw the notifications where the OS puts them, top-right under the menubar
  on macOS and bottom-right above the taskbar on Windows, and show two moments (the menu open, then the
  notifications arriving with the window behind) instead of one impossible frame; give the buttons the
  OS's own style, and re-shoot the whole board in dark.

---

## Carry forward

1. **The shell's default window**: 1280×840 on a 1440×900 display, the navy rail from the very top edge.
   macOS: hiddenInset traffic lights in the rail, the brand row dropped 32px, the session's title row as
   the drag region, no app name inside the window. Windows: a 36px `--rail` titlebar with the mark,
   "Henosis", the caption buttons (46×36, 10px glyphs, close hover in Windows red) and the rail brand row
   hidden; the titlebar says "Henosis" only, the session name lives in the title row.
2. **The OS keeps its own colours.** Henosis owns the tray icon (template on macOS, linen on Windows), the
   attention dot, the badge count and the strings. Menu highlights, taskbar underlines, notification
   buttons and the Dock badge use the system's own; nothing chocolate is drawn where the platform will
   not render it.
3. **The badge counts decisions only** (approvals + handoffs addressed to you); mentions sit in the menu
   and never badge. The tray menu lists items, not counts: serif who · verb · muted what · age, five per
   section, then "and N more… in the queue"; Quick open with the last five sessions and rooms by name
   plus Inbox, Approvals queue, New session; Pause notifications with a moon on the icon; Open Henosis
   (⌥⇧H / Ctrl+Shift+H) and Quit. Every row is a `henosis://p/<project>/s/<session>` route to the notice.
4. **One notification grammar** for toast, banner and inbox row: title (who · verb · what), body (where,
   then what it means for you), two buttons at most, a tag so a repeat replaces. A decision from a banner
   opens the notice when a rating is required; approving blind is not offered for irreversible actions.
5. **Breakpoints, written once**: 1180 the rail folds to 72, 960 compact, 720 the drawer overlays, 480
   phone sheet. The column's 780 and its 24 gutters are fixed; the rail (296 → 72) and the drawer (340
   beside → 300 over, with a scrim) give way. Add a 40px hysteresis so the rail does not flap while a
   window is resized, and let `[` `]` pin the choice.
6. **The collapsed rail**: the full rail's order (mark, gradient New, Search, Inbox and Approvals with
   apricot mono counts, project initial in serif apricot, one avatar per agent with the status dot at the
   corner and the active one ringed, Memory, Chats, you, expand). Its card opens after a rest, in `rail-2`,
   with the serif session name, the Team pill, the italic "what it is on", the rating count and the spend
   in mono, and never over the live message.
7. **The compact topbar drops words, not facts**: the title truncates first; status, the Team pill and the
   token chip stay; Team and Details become 34px icon buttons and the open one keeps the apricot wash.
8. **The composer hint names the platform's keys** (⌘ ↵ / Ctrl ↵, ⌘ K / Ctrl K) and says what closing does
   ("the window closes into the tray").
9. **One cast and one naming across the theme**: Billing page is Ana's (with Bo), Checkout is Bo's (with
   Ana), Invoice PDF is Cy's, Tax lines is Dee's; the stream names the agent one way (the tray and compact
   pages' "X's agent" is the majority); a gate from another session carries an origin line; the gate's
   second button is one verb; the composer's third chip is one control; the menubar order is one order.
10. **Shoot at full colour.** If a palette is forced by the shot budget, change the shot, not the page:
    never remove the wash or the shadows from the design to fit a PNG, and take the dark shot of the whole
    board, not its first 900px.
