# Judge panel · navigation · 1

Six explorations on the theme **navigation**: rail, agent-card, command-palette, search, shortcuts, notifications.
Judged against BRIEF.md and tokens.css (v5). Each exploration's index.html, notes.md and three PNGs were read
and looked at; the two boards that were shot downscaled (agent-card light and mobile, notifications dark) were
cropped and enlarged to native size before scoring. Scores are 1–10 on on-brief (vibrant, unity, palette roles),
craft (alignment, type, states), truth to the product, and distinctiveness from claude.ai, ChatGPT and Linear.
No exploration was edited.

| Exploration | On-brief | Craft | Truth | Distinct | Score | Verdict |
|---|---|---|---|---|---|---|
| rail | 8 | 7 | 8 | 7 | 7.5 | keep |
| agent-card | 8 | 6 | 8 | 8 | 7.5 | revise |
| command-palette | 8 | 6 | 8 | 7 | 7.3 | keep |
| search | 8 | 8 | 7 | 8 | 7.8 | keep |
| shortcuts | 8 | 8 | 9 | 9 | 8.5 | keep |
| notifications | 8 | 6 | 8 | 8 | 7.5 | revise |

The panel's reading in one line: the five chrome explorations have independently converged on the same
selection language (apricot wash plus hairline ring, ↵ only on the highlighted row, serif for names, mono
for keys), on the same dark corrections (a darker rail, a lit surface with a top highlight, lifted status
greens and ambers), and on the same "register" idea (an overlay says what a key would do right now). That
convergence is the system; the fixes below are mostly about the frame drifting between pages and about
screenshots that were not taken at the brief's size.

---

## rail · 7.5 · keep

**Idea.** The rail as the team's roster: the things that wait for you pinned under the one gradient, then
every live agent as its person's card under the project, crews in serif, then memory and chats. Apricot is
held to one meaning in the rail: a solid count means something waits for you, a wash means where you are, and
only the running dot moves. The 72px collapsed rail keeps the same order as avatars with corner dots.

**On-brief 8.** Navy frame, cream page, one gradient (New session), chocolate numerals on apricot counts,
serif crew and project names. The role discipline for apricot is the clearest in the set and should be the
rule for the whole system. Two blemishes: the decorative apricot ring on New session runs straight through
the `N` key cap (see the 2× crop; the notes already flag it), and in dark the rail (#161B26 from tokens) is
barely separable from the canvas (#1C2230), so the frame loses the job the brief gives it. The palette,
search and shortcuts pages each quietly fixed this with `--rail: #10141C`; the rail page, the one that owns
the rail, did not.

**Craft 7.** The "one row, four states" board is exact and the counts board (0 never shown, 99+ cap, mono
numerals) is the kind of thing an engineer can build from. The agent cards in the expanded rail sit well at
296px; the collapsed rail's navy tooltip is a nice touch. Defects: the account menu's Theme segment lights
"Light" in the dark screenshot, so the one control that proves the page knows its theme is wrong; the
collapsed rail shows AN twice (Billing page and the you row) with no way to tell them apart; the mobile
sheet's `×` is top-right while the brand sits below it, which reads as two headers.

**Truth 8.** Matches the app's rail (Inbox, Approvals, agents by project, Memory with conflicts, chats with
unread) and names the keys the app has (N, ⌘K, `[` `]`). Recents are missing and the notes know it.

**Distinct 7.** A navy roster with serif crew names and person-cards for agents is not Linear's grey
sidebar or claude.ai's chat list; the collapsed rail with status-dotted avatars is its own. The pinned
Inbox/Approvals pair is generic.

**One fix.** Make the rail own its dark: adopt the darker rail (`--rail #10141C`, `--rail-2 #1A2030`) that
three other explorations re-derived, so Dress Blues stays the frame in both themes, and let the account
menu's theme segment read the live theme. Secondary: drop the ring on New session or move `N` into the tooltip.

---

## agent-card · 7.5 · revise

**Idea.** Three lines on the navy rail; only the head and the lead word change between six states (running,
awaiting approval, blocked, paused, idle, closed), so the rail stays still while agents move. Dot, status
word and italic serif lead always agree. The foot answers "is anyone else here" (pill), "who" (up to three
ringed avatars) and "at what cost" (mono spend with a 2px budget hairline).

**On-brief 8.** The card is the brief's "agents are members" made literal: a person-card with a serif name,
an italic serif "working on", the driver ringed in apricot, Team in apricot so it reads across the room.
The six dot drawings, especially the hollow ring for idle and the faint ring at 62% for closed, say "nothing
owed" without spending a colour. Pending badge in mono on amber is right; the 3px apricot bar in the gutter
for the open session is right.

**Craft 6.** The dark screenshot (1440×900) is beautiful and tight. The light and mobile screenshots are not
screenshots of a screen: they are whole-board captures downscaled to 604×1961 and 273×590, at which size
the 11.5px mono and 13px sans are unreadable, so "screenshots taken and looked at" cannot have happened at
the brief's size. Enlarged, the board is good (the states grid, the budget row, the rest/hover/active/focus/
pressed row and the spec card are all well set), with small issues: the hover peek row's three icons sit
inside the card's padding at a different rhythm to the foot; the pressed state's scale(.985) is drawn as a
different card width, which looks like a bug rather than a press. Status hexes (#E2B06A, #E2847A, #9BC88F,
#AEB4C2) are hard-coded here and again in rail and notifications.

**Truth 8.** States are the kernel's states; nothing is only on hover (the Details drawer and the mobile
long-press carry the same verbs); truncation order under pressure is specified. The crew header's own token
total is an open question the project page will force.

**Distinct 8.** Linear shows issues, ChatGPT and claude.ai show conversations; this shows a colleague with a
status, a task, company and a budget. The italic serif lead word is the signature.

**One fix.** Reshoot at the brief's size: cut the board into 1440×900 sections (anatomy and six states;
solo/team and tokens; states and mobile) at 1:1, and shoot the mobile at 390×844. While there, promote the
six dot drawings and the four status hexes to tokens so rail, palette and search stop re-declaring them.

---

## command-palette · 7.3 · keep

**Idea.** ⌘K lifts one lit surface over the page behind a navy scrim; a scope chip names the session the
Actions belong to; five groups in fixed order answer the five mid-session questions. Matches are drawn as
weight and ink, never a background. The highlighted row says what Enter will do, and a release-gate approval
shows its rating step inline ("Rate it first · Enter alone sends 4 · Bo already rated 4").

**On-brief 8.** The palette is the one lit surface; selection is the pulse (apricot wash, hairline ring, row
icon turning to the hand colour, ↵ only on the highlighted row); names in serif, keys in mono, rows in sans.
Dark is the lead theme and it earns it: surface #242C3C with a 1px top highlight and a 6% hairline instead
of a shadow halo, scrim near-black 50%, no blur. Two gradients on screen (New session and the agent avatars)
is a technicality the brief should settle for the whole system.

**Craft 6.** The top two rows, the first thing the eye lands on, read **"Aprove push origin main"** and
**"Aprovals queue"**. The markup is `>A<b class="m">pro</b>ve`: the highlight ate a `p`. The screenshot was
not read. Everything else is clean: group counts beside titles with a quiet right-aligned "why", the
irreversible pill in the danger wash, the footer legend, the mobile bottom sheet that drops subtitles and
keeps the stars. No `:hover` or `:focus-visible` rules exist on rows; the highlighted state is a forced class,
which is fine for a board but means keyboard focus and mouse hover were never drawn apart.

**Truth 8.** Four of five groups are the app's (palette.tsx); the fifth is proposed and the notes say so.
The inline rating mirrors the two-step approval the app runs. Tab as "next group" is invented and flagged.

**Distinct 7.** ⌘K palettes are Linear's and Raycast's genre; the scope chip, the inline rating step, the
serif names and the per-group "why" are what make this one Henosis. The empty state (nothing typed) is
not shown and is where palettes usually look alike.

**One fix.** Fix the spelling of the two action rows (`Ap<b>pro</b>ve`, `Ap<b>pro</b>vals`) and reshoot; it
is a one-line change and it is the first line of the page.

---

## search · 7.8 · keep

**Idea.** One query across everything the team keeps, on a page rather than in the palette: scope and live
filters as chips on the query bar, kind tabs with counts that add up, "All" as short groups with a "why"
line and "Show all", and a refine column (said by, where, when) that answers the next question.

**On-brief 8.** The query bar is the one glowing surface and the rail's search item is lit with the same
wash so the page and rail agree. Apricot on the active tab's count and the `--apricot-deep` underline;
matches as weight and ink inside serif names, mono memory keys and sans snippets; "Running / Awaiting
approval / United" with the rail's dots. The "said by" bars are a small decorative apricot that competes a
little with the selection wash, but they carry counts so they are allowed.

**Craft 8.** Dense and aligned: the counts reconcile (6+14+9+4+6=39, "Last 30 days" = 39), the sort
control looks changeable, the syntax hint teaches the typed form in mono. The hit row is one anatomy for
every kind. Dark lifts status colours and keeps contrast. Mobile folds the refine column into "Filters · 2"
and scrolls the tabs. The one thing that jars: the rail drawn on this page is not the rail exploration's
rail. It has hairlines between agent cards, caps project headers ("BILLING PAGE", "CHECKOUT") where the rail
has serif ones, a "Payments" pill on the you row where the rail has a role line, and "An" avatars where the
rail has "AN". Explorations are drifting on the frame.

**Truth 7.** The app searches sessions and memory today; messages, people and agents are new, and "Keep this
search" promises a notification path that does not exist. The notes are honest about all of it.

**Distinct 8.** The refine column with people and agents in one list, the "why" line per group, a memory hit
with full attribution and a conflict pill: not Linear's filter bar, not a chat app's search.

**One fix.** Use the rail exploration's rail (card anatomy, serif project names, no hairlines, the you row
with role) so the frame is the same on every page. The product question to settle next is whether "All"
is a group cut or a ranked list with kind pills.

---

## shortcuts · 8.5 · keep

**Idea.** `?` lifts a sheet that is a register, not a cheat card: each session key says what it would do
right now ("a" approves `git push … :main` and sends four stars, granting the gate with Bo's 4; "h" offers
the baton to Dee and Bo). The keys that would act on something waiting are lit; a key with nothing to do
steps back instead of disappearing.

**On-brief 8.** Apricot wash and hairline for "would act now", the key cap filled with the hand colour,
the session named in serif, "you are driving" in the subtitle. Dark sheet shares the palette's surface
and hairline. One lit thing per row, nothing garish.

**Craft 8.** Two columns on a 880px sheet with one hairline between them and no cards inside cards; key
caps at 26px mono with a 1px line and 1px drop read as keys in both themes; the "now" line uses the
stream's own vocabulary (amber dot, irreversible pill, stars, mono command, serif names). The mobile sheet
keeps the session and composer groups and the modifier switch. Small things: the footer's "Would act now"
legend is drawn as a checkbox, so it reads as a control that does nothing; the `?` key on the "This sheet"
row carries the apricot ring, which is the same signal as "would act now" but means "you pressed this".

**Truth 9.** Every key is one the app answers to (shortcuts.ts, composer, palette, approvals queue), grouped
by where it applies, with the one invented item (`@`) called out. The notes name the `context` prop the
component would need.

**Distinct 9.** Linear's and claude.ai's shortcut sheets are static grids. A sheet that says what each key
does in this session, with the irreversible push and the rating visible before the key is pressed, is
original and is exactly the product's manners.

**One fix.** Turn the "Would act now" legend into a swatch (a small apricot-washed key cap) rather than a
checkbox, and give the `?` key a different "you are here" treatment than the live wash, so the sheet has
one meaning per mark.

---

## notifications · 7.5 · revise

**Idea.** One sentence at three distances: a toast in the corner while you are in the window, a native
banner when the window is behind, a row in the inbox always, with the same words in all three. Decisions
stay and carry `y`/`n`; news drains over 8 s along an apricot life line. Three toasts show; the rest fold
into a navy tail that counts what waits in the inbox.

**On-brief 8.** A crease by kind on the left, the serif who, the sans sentence, mono for the call, the
apricot drain, the navy tail: the toast is unmistakably this system. "Dee joins the circle." with the mark
closing its arcs is the brief's motion rule used exactly once. The 1440×900 light screen is a finished
session with the stack rising above the composer, not over it.

**Craft 6.** The light screen is strong; the dark board is not at the brief's size: it was shot at 80%
scale (1152×2805) with 32 colours, and inside it the corner-stack demos are scaled again to 74%, where the
ghost action wraps and lands on the title line ("Open #billing" over "Cy mentioned you in #billing", "Unite
into main" over "Bo's agent finished Billing page."). The `.acts` row can wrap under the toast's own grid,
which will also happen at a narrow 340px with longer labels. On the light screen, the navy tail sits across
the held tool step so "held" peeks out from under it. The status colours are overridden in-page again.

**Truth 8.** Honest about toast.ts (text-only, bottom-centre, MAX_SHOWN 3) and keeps the plain toast beside
the typed one; a complete kind → toast/banner/inbox/badge/sound/keys table; the `y`/`n` collision with the
approval notice is named. OS variants for macOS, Windows and mobile push.

**Distinct 8.** The sentence identical at three distances, the crease, the life line and the tail are not
Linear's toasts nor a chat app's banners. The mobile deck with the pending approval as a strip above the
composer is the right mobile answer.

**One fix.** Keep the actions row on one line (`white-space: nowrap`; Open becomes an icon when tight) and
reshoot the dark board at 1:1 in sections instead of one scaled capture, so the stack demos are judged on
what the toast actually does.

---

## Carry forward · patterns the system should adopt

1. **Apricot has one meaning in chrome.** Solid apricot count = something waits for you. Apricot wash +
   hairline ring = where you are or what Enter will do (rail active row, palette row, search hit, shortcuts
   live row, toast on hover). Promote to tokens: `--select-wash` (apricot 11–18%) and `--select-line`
   (apricot-deep ~50% light, apricot ~38% dark). Nothing else in the chrome is apricot.
2. **Dark frame and lit surface, from three explorations.** `--rail #10141C`, `--rail-2 #1A2030`,
   `--rail-line` 8%; overlay surface `#242C3C` with `inset 0 1px 0 rgba(255,255,255,.07)` and a 6%
   hairline instead of a shadow halo; scrim navy 42% on cream, near-black 50–52% on dark, no blur. Tokens v6.
3. **Dark status lift.** `--ok #8FC386`, `--warn #E2B06A`, `--danger #EA9384` with 16–18% softs, and the
   rail dot set (running #9BC88F, awaiting #E2B06A, blocked #E2847A, paused #AEB4C2). Every exploration
   re-declares these; tokens v6 should carry them so pages stop hard-coding hex.
4. **Matches are weight and ink, never a background.** `--match` (ink, 600; 400 inside serif names) and
   `--rest` (ink-2), shared by palette and search.
5. **Three fonts carry three kinds of thing in a row.** Serif for anything with a name (people, agents,
   crews, projects, sessions), mono for keys, counts, commands and spend, sans for the row itself. Icons
   do not have to do all the work.
6. **One key-cap and one legend.** 22–26px mono cap, 1px line, 1px drop, glyphs for esc ↵ ⇧ ⌘; ↵ appears
   only on the highlighted row and the grey hint word hides; footer legend "↑↓ move · ↵ run · esc close"
   (plus ⇥ where groups exist) shared by palette, search and shortcuts; keeps move/run/close on phone.
7. **The agent card is one component.** Head (8px dot, serif name, amber mono badge or Solo/Team pill),
   italic serif lead + plain tail clamped at two lines, foot (stack capped at three with the driver ringed
   in apricot-deep, "with …", mono spend with a 2px budget hairline that warms past 80% and goes coral past
   100%). Six dot states including hollow ring (idle) and faint ring at 62% (closed). Rail, palette, search
   and the project page draw it from one definition.
8. **Overlays are registers.** A palette row, a shortcut row and a decision toast each say what Enter, the
   letter or `y` would do right now, and a release-gate approval shows its rating step before the commit
   ("Enter alone sends 4 · Bo already rated 4"). Nothing is only on hover.
9. **A notification is one sentence at three distances.** Same words in toast, banner and inbox row; a crease
   by kind; decisions stay and carry `y`/`n`, news drains along an apricot line; beyond three, a navy tail
   counts what waits instead of a fourth toast.
10. **Mobile rule.** Every overlay becomes a bottom sheet with a handle and safe-area padding; the rail
    becomes a sheet with a "who · where" line; refine columns fold into a counted "Filters" button.
11. **The frame is drawn once.** Pages must use the rail exploration's rail (card anatomy, serif project
    names, no hairlines between cards, the you row with role), not a local redraw.
12. **Process.** Shots are 1440×900 at 1:1 (or 390×844); a board is cut into screens, never scaled down to
    fit a byte budget. Read the top row of every screenshot before filing it ("Aprove").
