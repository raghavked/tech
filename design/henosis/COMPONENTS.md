# Henosis · component inventory (v5 → React)

The component set the design wave settled, written for the engineer who ports it into
`apps/web/src/ui.tsx` (primitives) and `apps/web/src/views/*` (compositions). Every entry gives: the
exploration that defines it (slug · panel score · verdict), the judge's one fix that must land with it,
the React signature (props, states), and the HTML/CSS skeleton to port. The CSS lives in
`design/henosis/tokens.v5.css` unless the entry says "page CSS to lift", in which case the block is
written out here because the winning board kept it in its own `<style>`.

Companion files: `SYSTEM.md` (the rules and tokens), `SCREENS.md` (the screens these compose into),
`tokens.v5.css` (the stylesheet), `explorations/<slug>/{index.html,notes.md}` (the source).

Conventions used below:

- **Props** are TypeScript-ish. `status` is the kernel's word (`running · awaiting_approval · blocked ·
  paused · idle · closed · offline`) and is mapped to a class by `STATUS` in ui.tsx.
- **States** are the classes the markup toggles; each one is a line in the judged board, not an invention.
- **Named things are serif** (`.serif`): people, agents, crews, groups, sessions, projects, "Goal",
  "to the team". Counts, keys, commands, spend, times: mono. The row itself: sans.
- The cast is one cast: Ana Moreau (owner, drives *Billing page* with Bo), Bo Lindqvist (*Checkout*,
  with Ana), Cy Okafor (*Invoice PDF*), Dee (*Tax lines*, the newcomer). Crew *Invoice rollout*.
- "the hand" = `--accent` (chocolate; `#7A4B3E` at night; apricot on the gradient). "the pulse" =
  apricot. The hand is a verb: only primary actions, the send, the driving flag, `.kbd.live`.

Contents: 0 File map · 1 Primitives · 2 The rail · 3 The session · 4 Overlays and navigation ·
5 Pages · 6 Groups and chats · 7 Onboarding and bad moments · 8 Frames (desktop, mobile) ·
9 Off-platform · 10 Page CSS to lift into tokens · 11 Port order and the ui.tsx diff.

---

## 0 · File map

| file | holds | from |
|---|---|---|
| `design/mark.svg` | the five `<symbol>` cuts (`#mark #mark-small #mark-tiny #mark-bare #mark-mono`) | brand-board (does not exist yet; create it first, every board cites it) |
| `apps/web/src/tokens.css` | `tokens.v5.css` dropped in (every selector and alias the app reads still resolves, SYSTEM.md §19) | all panels |
| `apps/web/src/ui.tsx` | `Mark Icon ICONS Avatar Stack Dot Status Pill Count Chip Kbd ModeChip Btn Switch Seg Loader Toasts TypedToast Stars StarTiles TokenMeter AgentCard TeamPill Attribution StatTile Quorum JoinLine Wash` | §1–§3 |
| `apps/web/src/views/SessionView.tsx` | `Topbar Stream Message StepLine Notice ApprovalNotice Composer Drawer TeamPanel Details` | §3 |
| `apps/web/src/stream/PlanCard.tsx` | `PlanCard PlanStep Raters Totals` | §3.9 |
| `apps/web/src/views/ReplayScrubber.tsx` | `ReplayScrubber EdgeOfThePast` | §3.12 |
| `apps/web/src/palette.tsx` | `CommandPalette PaletteRow` | §4.1 |
| `apps/web/src/search.tsx` | `SearchPage QueryBar KindTabs Hit Refine` | §4.3 |
| `apps/web/src/notify.ts` + `toast.ts` | typed toasts, the tail, the OS banner grammar | §4.4 |
| `apps/web/src/viz.tsx` | `StatTile Bars Area` rebuilt on the chart contract | §5.4 |
| `apps/web/src/views/{Approvals,Memory,Project,Team,Inbox}.tsx` | the page compositions | §5 |
| `apps/web/src/views/ChatView.tsx` | `GroupRow MemberStack AgentReply MentionList NewGroupSheet MembersDrawer` | §6 |
| `apps/web/src/views/{FirstRun,TeamLook,Settings}.tsx` | onboarding, the look editor | §7, §5.10 |
| `apps/desktop/*` | window chrome, tray, notifications | §8.1 |

---

## 1 · Primitives (`ui.tsx`)

### 1.1 `Mark` · brand-board (8.5 keep) · mark-motion (8.5 keep)

The one mark: two arcs, a person's and an agent's, closing into one ring around one centre.
Fix carried: ship `design/mark.svg` from the brand board's `<symbol>` cuts; pin `--mark-arc-a: #56352D`
(never `var(--accent)`, which made both arcs apricot at night); start the swing at ±60° so the first
300 ms at 48 px reads as two arcs resting, not a crescent. The word is "centre", never "bead".

```ts
type MarkCut = "auto" | "default" | "small" | "tiny" | "bare" | "mono";
type MarkState = "closed" | "apart" | "ghost" | "faint" | "one-arc" | "ring5";   // onboarding's set
type MarkCentre = "dot" | "emblem" | "none";                                      // team-look-editor
function Mark(p: {
  size?: number;                 // 22 default; cut="auto" picks default ≥32, small 20–31, tiny <20
  cut?: MarkCut;
  state?: MarkState;             // apart = ±60° at .5 (server gone, step marks); ghost = dashed centre
  joining?: boolean;             // loop: arc-a/arc-b/dot-in 1.8 s, 15 % hold
  once?: boolean;                // with joining: a join line, a first load (iteration-count 1)
  settle?: boolean;              // 0.8 s arrive, the rail brand on load
  live?: boolean;                // the centre pulses (reconnecting toasts, inline waits)
  ground?: "navy" | "cream" | "apricot" | "choc" | "paper";   // bare cuts only: colour by ground
  centre?: MarkCentre; emblem?: string;   // emblem allowed at 48 px and up only (team-emblems' fix)
  className?: string; title?: string;     // title → <title>, else aria-hidden
}): JSX.Element
```

States: `closed` (rest; also what Calm and reduced motion show), `.joining`, `.joining.once`,
`.settle`, `.live`, `.apart`, `.ghost`, `.small`/`.tiny` (no swing below 24 px: a 200 ms fade).

Skeleton (`<use>` of the symbol; colour reaches it only through the custom properties, the
print-export fix):

```html
<svg class="mark" width="32" height="32" aria-hidden="true"><use href="/design/mark.svg#mark"/></svg>
<svg class="mark on-cream" width="18" height="18"><use href="/design/mark.svg#mark-tiny"/></svg>
<svg class="mark joining once" width="30" height="30"><use href="#mark"/></svg>
```

The symbols (96 grid; copy verbatim into `design/mark.svg`, from brand-board):

```html
<symbol id="mark" viewBox="0 0 96 96"><!-- disc r46 · arcs r28 stroke 10 · centre r7 -->
  <circle class="disc" cx="48" cy="48" r="46" style="fill:var(--mark-disc,#2A3244)"/>
  <path class="arc a" d="M48 20 A28 28 0 0 1 48 76" style="stroke:var(--disc-arc-a,#56352D)" stroke-width="10" fill="none" stroke-linecap="round"/>
  <path class="arc b" d="M48 76 A28 28 0 0 1 48 20" style="stroke:var(--disc-arc-b,#E2C4A6)" stroke-width="10" fill="none" stroke-linecap="round"/>
  <circle class="dot" cx="48" cy="48" r="7" style="fill:var(--disc-dot,#E2C4A6)"/>
</symbol>
<symbol id="mark-small" viewBox="0 0 96 96"><!-- 20–31 px: disc r48, arcs r29 stroke 13, centre r8.5 --></symbol>
<symbol id="mark-tiny"  viewBox="0 0 96 96"><!-- <20 px: no disc, arcs r32 stroke 16, centre r10 --></symbol>
<symbol id="mark-bare"  viewBox="0 0 96 96"><!-- a coloured ground is the disc: arcs r30 stroke 12, centre r8 --></symbol>
<symbol id="mark-mono"  viewBox="0 0 96 96"><!-- currentColor; agent's arc at .55 or dotted via --mark-dash --></symbol>
```

CSS: `tokens.v5.css` "THE MARK" block (`.mark`, `.on-navy .on-cream .on-apricot .on-choc .on-paper`,
`.mark-ink`, `.mark.ghost`, `.mark.apart`, the `.rail .mark .arc.a` 62 % lift) and the motion block
(`arc-a arc-b dot-in`, `*-once`, `.mark.tiny.joining` fade). The `Mark` in ui.tsx today draws the arcs
inline with `style="ring|bead|dot"`; replace `style` with `centre` and keep `--team-mark-ring/-bead` only
as aliases. `ring5` (the tour's five-segment ring, `ring-draw`) is a variant of the same symbol.

### 1.2 `Icon`, `ICONS` · icon-set (7.8 keep)

Unchanged component; the manifest lands as path strings. Contract: viewBox 16, paths inside 1.5–14.5,
stroke 1.5 at every size, round caps and joins, `fill none`, dots as stroked circles so every icon is
one path. Fix carried: a 14 px floor for `crew` and `group`; below it use `person`/`agent` plus a count.
New keys: `agent crew group baton join unite plan gate tokens budget savings contention claim session
overview brief replay needsyou settings`. Colour rule: an icon is the colour of its text; apricot only
on the active rail item; `ok/warn/danger` only on verbs (approve, contention, reject), never on nouns.

### 1.3 `Avatar`, `Stack` · avatar-system (7.3 revise) · groups-list (8.3 keep)

One element, two shapes: a person is a circle, an agent is the rounded square with the tight
bottom-left corner on the brand gradient. State is a dot, a ring or a fade, never a tint change.
Fix carried: from 40 px inset the true `Mark` inside the gradient square (never a cream arc); below 40
keep only the apricot centre. Agent tiles in a stack get a 2 px canvas seam and the dot on the outer
corner (groups-list' fix).

```ts
function Avatar(p: {
  id: string; name: string;                 // initials(name): two caps (AN, BO, CY, DE; CO for Checkout)
  kind?: "person" | "agent";
  size?: "xs" | "sm" | "md" | "lg" | "xl";  // 18 · 22 · 28 · 40 · 56
  presence?: "online" | "away" | null;      // person: .pr dot (hollow ring when away) + .off fade at 45 %
  status?: string | null;                   // agent: .pr running|awaiting|blocked|paused (an agent is never away)
  driver?: boolean;                         // 2 px apricot-deep ring: the baton (people only)
  joined?: boolean;                         // one ripple (useJustJoined)
  missing?: boolean;                        // dashed empty avatar: the voice not yet heard
  photo?: string; title?: string;
}): JSX.Element
function Stack(p: { children; max?: 3 | 4; seam?: boolean /* people | agents hairline */ }): JSX.Element
```

Order in a stack: driver → people → agents, four then "+n" (three in the rail foot). `--avatar-edge`
is set by the ground (`.rail`, `.card`, `.notice`, `.plan`, `.composer`, `.msg.team .text`).

```html
<span class="avatar driver" title="Ana, owner, driving">AN<i class="pr running"></i></span>
<span class="avatar agent lg" title="Ana's agent · Billing page"><svg class="mark"><use href="#mark-bare"/></svg><i class="pr awaiting"></i></span>
<span class="avatar missing" aria-label="one more voice"></span>
<span class="stack"><span class="avatar driver">AN</span><span class="avatar">BO</span><i class="seam"></i><span class="avatar agent sm"></span></span>
```

CSS: "AVATARS: TWO SHAPES, ONE ELEMENT" in tokens.v5.css. The old `Avatar` prop `agent: boolean` maps
to `kind="agent"`; the `"A"` glyph is gone.

### 1.4 `Dot`, `Status` · badges-status (7.5 keep) · agent-card (7.5 revise)

The dot carries the colour, the word stays ink. One drawing at four sizes (6/8/10/12): filled
(running, the only one that moves), filled + halo (awaiting), filled red (blocked), slate (paused),
apricot (done), hollow ring (idle), hollow faint at 62 % (closed), dashed (offline). Fix carried: the
status pill's word is ink in both themes; a coloured word takes an `-ink` token.

```ts
function Dot(p: { status: string; size?: "xs" | "md" | "lg" | "xl"; label?: string /* sr-only */ }): JSX.Element
function Status(p: { status: string; children?: ReactNode /* "· turn 7" */; size?: "xs" | "lg" }): JSX.Element
```

`STATUS` in ui.tsx grows `idle`, `closed`, `offline` as their own classes (today all three fold to
`idle`). Markup: `<span class="dot running"><span class="sr-only">running</span></span>` ·
`<span class="status running">Running · turn 7</span>`. CSS: "STATUS: THE DOT CARRIES THE COLOUR".

### 1.5 `Pill`, `TeamPill`, `Count`, `Chip` · badges-status · rail · session-view

Five things may be a badge: the status word, the pending count, Solo/Team, Planning, the crew name.

```ts
type PillKind = "team" | "solo" | "planning" | "status" | "risk" | "irreversible" | "gate" | "plain";
function Pill(p: { kind: PillKind; status?: string; risk?: "read"|"write"|"exec"|"external"|"irreversible";
                   size?: "sm" | "md" | "lg"; children }): JSX.Element
function TeamPill(p: { row: AgentRow; withNames?: boolean /* "Team · with Bo" in the title row */ }): JSX.Element
function Count(p: { n: number; size?: "xs"|"sm"|"md"|"lg"; pop?: boolean; at?: boolean /* the "@" for a mention */ }): JSX.Element | null
function Chip(p: { on?: boolean; mono?: boolean; onRemove?: () => void; children }): JSX.Element
```

Rules: `Count` renders nothing at zero, caps at `99+`, pops on change, and is the **only solid apricot
in the frame** (approvals, handoffs, unread; never tokens, steps or people). The Team pill crossfades
its word (`.pill .w`, `word-in`) when the answer changes. `Pill kind="gate"` is plain navy with apricot
text (an apricot edge in dark); it never takes the gradient (mobile-approvals' fix). `Chip on` is the
selection grammar: `--select-wash` + inset `--select-line`.

```html
<span class="pill team"><span class="w">Team</span> · with Bo</span>
<span class="pill status awaiting">Awaiting approval</span>      <!-- ink word, amber dot -->
<span class="pill risk irreversible">irreversible</span>
<span class="count pop">3</span> <span class="count at">@</span>
<span class="chip on mono">scope <b>tests</b> <button aria-label="remove">×</button></span>
```

CSS: "PILLS, CHIPS, COUNTS". The app's `.pill.badge` is now the same thing as `.count`.

### 1.6 `Kbd`, `ModeChip` · keyboard-first (8.3 keep) · shortcuts (8.5 keep)

Keys live on the thing they act on: 20 px mono caps on `--surface` with a hairline and a 1 px drop,
inside the button at the right (`.btn .kbd`), on `--rail-2` in the rail, hidden on touch. Fix carried:
an irreversible action from another session takes two presses (first lights the card and prints
"`a` again approves · `esc` leaves it").

```ts
function Kbd(p: { k: string /* "a" "↵" "esc" "⌘" */; live?: boolean; pressed?: boolean }): JSX.Element
function ModeChip(p: { mode: "keys" | "typing" }): JSX.Element   // "Keys live" / "Typing": the one mode indicator
```

```html
<button class="btn sm">Hand off <kbd>h</kbd></button>
<span class="keys"><kbd class="live">↵</kbd> sends 4 and approves</span>
<span class="mode">Keys live</span>
```

CSS: `kbd, .kbd`, `.kbd.live`, `.kbd.pressed`, `.rail .kbd`, `.mode` in tokens.v5.css.

### 1.7 `Btn`, `Send`, `Switch`, `Input`, `Seg` · micro-interactions (8.0 keep) · accessibility (7.8 keep)

```ts
function Btn(p: { variant?: "default"|"primary"|"brand"|"ghost"|"danger"; size?: "sm"|"md"|"wide"; icon?: boolean;
                  on?: boolean /* apricot-soft: an open panel */; kbd?: string; children; ...button }): JSX.Element
function Send(p: { named: string /* "Send to the agent" | "Send to the team" */; pressed?: boolean; disabled?: boolean }): JSX.Element
function Switch(p: { checked; onChange; label }): JSX.Element     // apricot-deep when on: the hand is a verb
function Seg<T>(p: { value: T; options: {v: T; label; dot?: string; count?: number}[]; onChange; label }): JSX.Element
```

Rules: the primary is the hand; Reject/Deny/Remove are `.btn.danger` (ghost, danger ink, never a filled
red); `.btn.brand` exists once per screen (the rail's New session). Press is a sink, release is the
meaning (`.send.pressed` plays `pressed`). Focus is a 2 px `--focus-ring` with a 6 px `--focus-halo`
(chocolate by day, cream by night, never the pulse). CSS: "CONTROLS", `.seg`, `:focus-visible`.

### 1.8 `Loader` · loading-screens (8.75 keep) · motion-spec (8.3 keep)

Four loaders, each with a meaning, plus the halo. Fix carried: `orbit` only at the 54 px page centre
on a first join; inline and toast waits take the mark's halo pulse so no Henosis wait is three small
dots in a row.

```ts
type LoaderKind = "join" | "orbit" | "halo" | "weave" | "shimmer";
function Loader(p: { kind: LoaderKind; label?: ReactNode /* names who and what, never "loading" */;
                     count?: string /* "1,204 of 2,310 events folded" */; rows?: number; title?: boolean;
                     after8s?: string /* a cause */; after30s?: { label: string; onClick } /* one chocolate action */ }): JSX.Element
```

| kind | meaning | where | still frame (Calm) |
|---|---|---|---|
| `join` (the mark, arcs-close) | the app joins you | launch 120, splash 160, a join line 48, rail brand 28 | the closed ring |
| `orbit` (three dots converge) | you join people | the page centre on a first join, 54 px, nowhere smaller | dots stacked as one |
| `halo` (18 px apricot dot) | a small wait | inline, a toast, reconnecting, a chat opening | the dot |
| `weave` (two strands) | rows arrive | under a title, 3–4 px | a plain strand |
| `shimmer` | words arrive | only the lines where the summary will land | flat lines |

```html
<span class="loader join" role="status" aria-label="Opening the circle."><svg class="mark joining"/><span class="lbl">Opening the circle.</span></span>
<span class="loader orbit" role="status" aria-label="Joining Bo, Cy and Dee"><i></i><i></i><i></i></span>
<span class="loader halo" aria-hidden="true"></span> Reconnecting · <span class="serif">Bo</span> still has the baton.
<div class="loader weave"><i></i><i></i></div>
<div class="loader shimmer"><i class="title"></i><i></i><i></i></div>
```

CSS: "LOADERS: ONE PER MEANING" and the guarded animations (`orbit-1/2/3`, `halo`, `weave-slide/over/under`,
`shimmer`). Loading is never a blank page: the rail is live while a session joins, finished steps stay
checked while one runs.

### 1.9 `Toasts`, `TypedToast`, `ToastTail` · notifications (7.5 revise)

A notification is one sentence at three distances (toast, OS banner, inbox row). The app's text-only
`toast("Link copied")` stays (bottom-centre, 3 s). The typed toast is a 340 px card bottom-right above
the composer: a crease by kind, a 28 px icon/avatar/mark, the serif who, the sentence, a second line
(where · what it means for you), at most two buttons plus Open, `×`. Decisions stay and carry `y`/`n`;
news drains over 8 s along an apricot `.life` line (pauses on hover). Three show; the rest fold into a
navy tail. Fix carried: `.acts` is one line (`white-space: nowrap`; Open becomes an icon when tight).

```ts
type ToastKind = "approval" | "handoff" | "mention" | "joined" | "done" | "blocked" | "contention" | "gate";
interface TypedToast { id; kind: ToastKind; ref: string /* same ref updates in place */; who: string; text: ReactNode;
  where?: string; forYou?: string /* "You can approve, Ana" */; quote?: string; actions?: {label; onClick; primary?}[];
  sticky: boolean /* decisions never time out */; keys?: ["y","n"]; rating?: boolean /* under a ratings rule Approve opens the notice */ }
function Toasts(): JSX.Element            // role="status" aria-live="polite"; MAX_SHOWN 3 + <ToastTail n/>
```

```html
<div class="toasts" role="status" aria-live="polite">
  <div class="toast k-joined"><div class="ico"><svg class="mark joining once"/></div>
    <div class="body"><div class="l1"><span class="who">Dee</span> joins the circle.</div><div class="l2"><span>Payments team</span><span class="sep"></span><span>invited by Ana</span></div></div>
    <button class="x" aria-label="Dismiss">×</button><i class="life"></i></div>
  <div class="toast k-approval" role="alert"> … <div class="acts"><button class="btn primary sm">Approve · 4</button><button class="btn sm">Deny</button><button class="btn ghost sm icon" aria-label="Open">↗</button></div><div class="keys"><kbd>y</kbd><kbd>n</kbd></div></div>
  <button class="tail">2 more wait in the inbox · Open <kbd>g</kbd><kbd>i</kbd></button>
</div>
```

CSS: `.toasts .toast .toast::before (.gate .contention .danger) .acts .life` in tokens.v5.css; the
kind creases, `.ico`, `.l1/.l2`, `.quote`, `.x`, `.keys`, `.tail` are page CSS to lift (§10.4).

### 1.10 `Overlay`, `Sheet`, `Scrim`, `Menu`, `HoverCard`

One lit surface over a scrimmed page (navigation panel: `#242C3C` with a 1 px top highlight and a 6 %
hairline instead of a shadow halo at night; scrim navy 46 % / black 55 %, no blur). On the phone every
overlay becomes a bottom sheet: `--surface`, 26 px corners, a 40×5 handle, 16 px gutters, half/full
detents, a 50 px full-width primary beside a quiet pill, one line of fine print (mobile panel, one sheet
for rail, approvals and manager).

```ts
function Overlay(p: { open; onClose; label; width?: number; children }): JSX.Element     // desktop: centred; phone: Sheet
function Sheet(p: { open; onClose; detent?: "half" | "full"; head?: ReactNode; children; primary?: ReactNode; quiet?: ReactNode; fine?: string }): JSX.Element
function HoverCard(p: { anchor; restMs?: 400; placement: "beside-stream"; children }): JSX.Element   // desktop-compact's fix: never over the live message
```

CSS: `.overlay .palette .sheet .menu`, `.sheet .handle`, `.scrim`, `.dimmed .lit` in tokens.v5.css.

### 1.11 `Attribution`, `Lede`, `StatTile`, `Divider`, `Wash` (the joining wash)

- `Attribution({ by, session, commit, scope })` → "added by *Bo* · session invoice-pdf-3 · commit 0c8d44 ·
  Billing page", name serif, session/commit mono, scope last so it wraps (memory-browser 9.0; reuse under
  memory entries, approvals, plans, gates). `.attribution`.
- `Lede({ title, sentence, range })` → serif h1, one sentence in the manager's voice (hot thing `<b>`,
  counts `font-weight:500`, token figures mono, one link), the range control top right driving every
  number (manager-overview 8.3, usage-charts, project-page, memory-browser, approvals-queue).
- `StatTile({ label, value, unit, detail, meter? })` → label · mono value (`--t-figure`; serif loses to
  the type rule) · small unit · a detail line that splits the number; the only colour is a budget meter
  past 80 %; deltas are ink with a sign. `.stat .stat-label .stat-value .stat-detail`.
- `Divider({ kind: "plain"|"join"|"new"|"danger"|"day", children })` → `.divider`, `.divider.join`
  ("*Cy joins the circle* · 09:14", with the mark at 14 px when a join), `.divider.new` ("New since you
  looked away · 2", the only warm rule in a stream), `.divider.danger` ("United proration into main ·
  2 conflicts").
- `Wash({ mark?, children })` → `.wash`: an apricot-soft block with the mark and a serif sentence for any
  joining fact ("Joined the circle the same morning as Ana"); the dark variant keeps the pulse.

---

## 2 · The rail (`views/Home.tsx` → `Rail.tsx`)

The frame is drawn once (navigation panel carry-forward 11): every page uses this rail, never a local
redraw (search, project-page and agent-profile re-ordered it and must not).

### 2.1 `Rail` · rail (7.5 keep) · pages panel carry-forward 9

Order: brand row (mark 24, "Henosis" 24 serif) · `.new` New session on the one gradient (the `N` cap in
the tooltip, not through a ring: the fix) · Search (⌘K) · Inbox and Approvals with `Count`s · **AGENTS**
with crews first then solos, every card titled by its session · the project section (Overview, Usage,
Inbox, Approvals, Groups, Memory with its conflict count) · Chats with unread · the **me row** last.
Fix carried: the darker night rail (`--rail #10141C`, `--rail-2 #1A2030`) so Dress Blues stays the
frame; the account menu's theme segment reads the live theme.

```ts
function Rail(p: { me: Me; projects: ProjectRef[]; rows: AgentRow[]; counts: { inbox; approvals; unread };
                   active: string | null; collapsed?: boolean; onToggle }): JSX.Element
function RailItem(p: { href; icon; active?; count?: number; hint?: string; dot?: string; children }): JSX.Element
function CrewHeader(p: { name: string; people: string /* "Ana and Bo" */; solo?: boolean }): JSX.Element   // 9 px hollow apricot ring (dashed for solos)
function MeRow(p: { me; driving?: string; onMenu }): JSX.Element     // serif name, "owner · driving *Invoice PDF*", the three dots
```

One row, four states: rest `--rail-muted`; hover `--rail-2` with the icon warmed to apricot; active
`--rail-active` + inset `--select-line`; keyboard focus = the ring.

```html
<nav class="rail" aria-label="Agents and projects">
  <div class="brand"><svg class="mark"><use href="#mark-small"/></svg><span class="wordmark">Henosis</span></div>
  <button class="new" title="New session · N"><svg class="ic"/>New session</button>
  <a class="item" href="/search"><svg class="ic"/>Search or jump to <kbd>⌘K</kbd></a>
  <a class="item" href="/inbox"><svg class="ic"/>Inbox <span class="count">3</span></a>
  <div class="rail-section">Agents <span class="n">4 live</span></div>
  <div class="crew"><span class="serif">Invoice rollout</span> · Ana and Bo</div>
  <!-- AgentCard × n -->
  <div class="rail-section">Payments</div> … 
  <div class="me"><span class="avatar driver">AN</span><span class="meta"><span class="serif">Ana</span><span class="role">owner · driving <i class="serif i">Invoice PDF</i></span></span><button class="gear" aria-label="Account">⋯</button></div>
</nav>
```

CSS: "SHELL" (`.sidebar, .rail` share every rule; `.rail-section` is the rail's kicker so `.section`
on a page no longer collides), `.crew`, breakpoints at the foot (1180 folds, 480 sheet).

### 2.2 `AgentCard` · agent-card (7.5 revise) · navigation panel carry-forward 7

The agent card is one component, drawn from one definition for the rail, the palette, search, the
project page and the collapsed rail's hover card. Fix carried: the six dot drawings and the status hexes
are tokens (no page re-declares them). Head: 8 px dot · serif session name 15.5 · an amber mono badge or
the Solo/Team pill. `.doing`: italic serif lead in apricot (*working on*, *waiting on*, *blocked on*,
*paused on*, *last*) + plain tail, clamped at two lines; dot, word and lead always agree. Foot: stack
capped at three with the driver ringed · "with Bo" · mono spend with a 2 px hairline that warms past
80 % and goes red past 100 %.

```ts
function AgentCard(p: { row: AgentRow; href; active: boolean; nameOf; index?: number /* --i stagger */;
                        compact?: boolean /* 76 px, one doing line: the phone drawer */ }): JSX.Element
// states: .active (wash + inset line + 3 px apricot gutter bar) · .enter (card-in) · dot: running awaiting_approval blocked paused idle closed offline
```

```html
<a class="agent enter active" href="/s/billing-42" style="--i:0">
  <span class="head"><span class="dot running"></span><span class="t">Billing page</span><span class="pill team"><span class="w">Team</span></span></span>
  <span class="doing"><i>working on</i> proration.ts · step 3 of 4</span>
  <span class="foot"><span class="stack"><span class="avatar driver">AN</span><span class="avatar">BO</span></span><span class="with">with Bo</span>
    <span class="tokens warn" style="--spent:84%">12.4k<i></i></span></span>
</a>
```

CSS: "THE AGENT CARD (rail)": the rule is `.agent:not(.avatar):not(.msg)` so it never reaches an agent
avatar or an agent message (brand carry-forward 11). `doingOf()` and `teamOf()` stay as they are.

### 2.3 `CollapsedRail` + `RailHoverCard` · desktop-compact (8.3 keep)

At 72 px: the same order as avatars with the status dot at the corner and the active one ringed; the
project initial in serif apricot; counts as corner discs. The hover card opens in `--rail-2` with the
serif session name, the Team pill, the italic doing, the rating count and mono spend, **after a 400 ms
rest and beside the stream, never over the live message** (the fix). CSS to lift: §10.6.

### 2.4 `MobileRailSheet` · mobile-rail (8.8 keep)

A 332 px navy sheet over the session with a "who · where" line (Ana · Payments, the project switcher),
44 px rows, 76 px agent cards, the me row pinned, the account menu rising on `--rail-2`. Fix carried:
an `--edge` hairline in dark so the frame has an edge over the scrimmed page; the crew's claims folded
by default in the Team sheet. CSS: the 480 breakpoint block (`.rail { transform… } .rail.open`).

---

## 3 · The session (`views/SessionView.tsx`, `stream/PlanCard.tsx`)

### 3.1 `Topbar` (the title row) · session-view (8.3 keep) · token-meter (8.3 keep)

Serif title · `Status` with turn · `TeamPill` "Team · with Bo" · `TokenMeter` chip · presence `Stack`
with the driver ringed · Share · Team and Details buttons lit `.btn.on` when open. Compact (desktop-compact):
title truncates first; status, pill and chip stay; Team/Details become 34 px icon buttons.

```ts
function Topbar(p: { title; status; turn; team: AgentRow; usage; budget; people; panel: "team"|"details"|null; onPanel; compact?: boolean }): JSX.Element
```

### 3.2 `TokenMeter` · token-meter (8.3 keep)

The chip: `12.4k tokens` + faint percent over a 3 px `.hair` with the 80 % tick; states `.none`
(empty, before the first turn) · plain (no budget) · `.live` (the hairline weaves while a turn spends)
· `.warn` (≥80 %) · `.over` (>100 %, the percent carries the overflow). Fix carried: a pulsing apricot
dot replaces the turning ring (it read as a reload control); "saved ~4.4k" is dropped until the spec
records a price. The popover keeps a fixed shape so the eye lands in the same place every session:
head (serif session · "turn 7 · live") · stacked bar (input navy, output chocolate, cache apricot, cache
write hatched) · four rows in a fixed order including zeros · rule · budget row + bar · one line of
consequence · foot ("click pins it · Usage in Details"). Budget counts input + output only; cache never
moves the bar.

```ts
function TokenMeter(p: { usage: Usage; budget?: number | null; live?: boolean; open?: boolean /* the drawer's Usage */; session?: string; turn?: number }): JSX.Element
// states: .none · (plain) · .live · .warn · .over · .pinned (click) · .open
```

```html
<span class="meter live warn">
  <button class="chip tchip" aria-expanded="false" aria-label="Tokens: 12,400 used, 84% of the budget"><i class="dot running xs"></i>12.4k tokens <span class="pct">84%</span></button>
  <span class="hair live warn"><i style="--spent:84%"></i></span>
  <div class="pop" role="dialog" aria-label="Token breakdown">
    <div class="head"><span class="serif">Billing page</span><span class="turn">turn 7 · live</span></div>
    <div class="stacked"><i class="in" style="width:55.6%"></i><i class="out" style="width:14.2%"></i><i class="cache" style="width:23.1%"></i><i class="write" style="width:7.1%"></i></div>
    <div class="kv"><span class="sw in"></span><span>Input</span><span class="v">9,870</span></div> … (Output · Cache read · Cache write, zeros included)
    <div class="rule"></div>
    <div class="bud"><div class="row"><span>Budget</span><span class="v">12,400 of 20,000 · 62%</span></div><div class="budget"><i style="width:62%"></i></div><div class="left">About <b>7.6k left</b> · cache read is not counted</div></div>
    <div class="foot"><kbd>click</kbd> pins it <a href="#details">Usage in Details</a></div>
  </div>
</span>
```

CSS: `.hair`, `.budget`, `.meter .bar` in tokens.v5.css; the `.pop` anatomy is page CSS to lift (§10.3).
Per-turn echoes: the agent message foot ("this turn 2.1k · 1.5k in · 0.4k out"), `PlanStep.used`, the
rail card's 2 px hair, the drawer's Usage block (per-turn stacked bars on one scale), the phone's bottom
sheet = the Usage block unchanged.

### 3.3 `Message` · session-view (8.3 keep) · chat-view (7.8 revise)

The three message shapes, locked by the session panel. Your own messages sit left with everyone's;
"you" is a meta word, the warmer wash is the only sign (chat-view's right-aligned "you" loses).

```ts
type MessageShape = "human" | "agent" | "team";
function Message(p: { shape: MessageShape; who: string; avatar: AvatarProps; mine?: boolean;
  when?: string /* people carry a time */; turn?: { n: number; step?: [number, number] } /* the agent carries "turn N · step k of m" */;
  goal?: boolean; scope?: string /* mono chip */; to?: "the team"; origin?: { group: string } /* "# billing · steered from the group" */;
  children; steps?: StepLineProps[]; enter?: boolean }): JSX.Element
```

| shape | drawing |
|---|---|
| `human` | `--surface` bubble, hairline, `--shadow-soft`, `align-self: flex-start` always; `.goal` label in italic serif `--accent-ink`; mono `.scope` chip in the meta; `.mine` only a slightly warmer wash |
| `agent` | no bubble; prose at `--t-body` with `--measure 600`; the step grid under it; a navy `.out` output block, the deepest surface in both themes |
| `team` | on `--team-wash` with "to the team" in italic serif; never reaches the agent; at night a 9 % wash with the `--live-line` hairline |

One right-hand meta rule: `.when` (people), `.turn` (the agent), "turn N · time · you are here" (replay).

```html
<div class="msg human"><div class="meta"><span class="avatar driver">AN</span><span class="who">Ana</span><span class="scope mono">goal</span><time class="when">09:15</time></div>
  <div class="text"><span class="goal">Goal</span> Add proration to the Billing page …</div></div>
<div class="msg agent"><div class="meta"><span class="who"><span class="avatar agent sm"></span>Ana's agent</span><span class="turn">turn 7 · step 3 of 4</span></div>
  <div class="text"><p>…</p></div><div class="steps">…</div></div>
<div class="msg team"><div class="meta"><span class="avatar">BO</span><span class="who">Bo</span><span class="to">to the team</span><time class="when">09:33</time></div><div class="text">…</div></div>
```

CSS: "CONVERSATION" in tokens.v5.css (`.msg.human .text::after { content: none }`: the bead is retired).

### 3.4 `StepLine`, `OutputBlock` · session-view · micro-interactions

Grid `18px 1fr auto`: a 14 px icon (check in `--ok` when done), the mono line with the path in 500
weight, the mono result at the right ("212 lines", "+64 −0", "exit 0 · 1.8s"). `.live` on `--apricot-soft`
with the `--live-line` bar and a pulsing dot; `.fail` in danger ink; `.held` with a lock and "held at the
release gate" (release-gate); hover shows the row actions at 60 % under Calm. `.open` expands the navy
`.out` block (`--out-bg`, `--t-mono`, `white-space: pre`).

```ts
function StepLine(p: { kind: "read"|"write"|"run"|"wait"; line: ReactNode; result?: string; state: "done"|"live"|"fail"|"held"|"pending"; out?: string; open?: boolean }): JSX.Element
```

### 3.5 `JoinLine` · welcome-agent (7.5 revise) · members-drawer (7.5 revise) · mark-motion

A 30 px `Mark joining once`, a serif sentence with the name in chocolate, the time in mono; the same line
for a person, an agent or a session ("*Cy joins the circle* · 09:14", "**Checkout**, Ana's agent, joins
the circle"). The toast repeats the sentence on navy. Leaving is a quiet `Divider` with no motion. The
newcomer's `Avatar joined` ripples at +1.3 s (`useJustJoined`).

```ts
function JoinLine(p: { who: ReactNode; what?: "joins the circle" | "starts"; when: string; agentOf?: string }): JSX.Element
```

```html
<div class="divider join"><svg class="mark joining once" width="30"/><span><b class="serif">Cy</b> joins the circle</span> · <span class="mono">09:14</span></div>
```

### 3.6 `Notice` · session-view · approval-notice (unjudged, adopted) · pages panel

One card with a 4 px stripe by kind; the stripe says the kind before the words do.

```ts
type NoticeKind = "plan" | "gate" | "exec" | "external" | "contention" | "handoff" | "denied" | "conflict" | "quiet";
function Notice(p: { kind: NoticeKind; label?: string /* kicker: "RELEASE GATE" */; origin?: { session?: string; group?: string };
                     edited?: string /* "(edited) · granted 14:32" */; enter?: boolean; children; actions?: ReactNode }): JSX.Element
```

| kind | stripe |
|---|---|
| `plan` (default) | `--apricot` |
| `gate` | `--gate-stripe` (the gate's only gradient) |
| `exec` / `external` | apricot / apricot-deep (approval-notice) |
| `contention`, `handoff` | `--warn` (settled; manager-overview's red loses to project-page's amber) |
| `denied`, `conflict` | `--danger` (red only for a human no or branches that disagree) |
| `quiet` | `--surface-3` (superseded, resolved, folded) |

`.edited` is the state for a notice whose buttons went when the decision landed (surfaces panel: one
message, edited in place). `.origin` is the 22 px apricot-soft tag when the thing reached you from
elsewhere ("# billing · steered from the group", "Waiting in Checkout"). CSS: "NOTICES".

### 3.7 `ApprovalNotice` (the approval under a gate) · session-view · release-gate (unjudged) · approvals-queue

Anatomy: kicker · the ask in a serif sentence with the `.command` in mono and the `irreversible` pill ·
the rule in one sentence ("needs two contributors at 4+") · `.origin` if from another session ·
`VoteRow`s · `Quorum` · your `Stars` with a note field · `.actions`: "Approve with 4" primary, Deny ghost
in danger ink, a hint ("Your rating counts once; Bo's is already in"). Fix carried (session-view): the
notice names its plan step ("step 4 of 4 · *Migrate stored invoices*") and the plan's pending row points
at the gate, so the thing that needs you is one object. Reader-dependent buttons (approval-notice): a
contributor on a driver-only call gets "Nudge Bo" / "Take the baton", never a greyed Approve; a replay
keeps the words and loses the buttons.

```ts
function ApprovalNotice(p: { approval: Approval; rule: string /* describeRule */; votes: Vote[]; me: Me; step?: { k; m; title };
                             origin?: { session: string }; onVote(rating: number | null, note?: string); onDeny; replay?: boolean }): JSX.Element
function VoteRow(p: { who; role; note?; rating?: number | null; kind: "rated" | "deny" | "voice" | "waiting" | "me" }): JSX.Element
function Quorum(p: { have: number; need: number; threshold: number; avg?: number; low?: boolean; consequence?: string }): JSX.Element
```

```html
<section class="notice gate" aria-label="Approval">
  <span class="kind">Release gate · step 4 of 4 · <i class="serif i">Migrate stored invoices</i></span>
  <div class="ask">The agent wants to run <span class="command">pnpm db:migrate add-proration-column</span> <span class="pill risk irreversible">irreversible</span>; needs two contributors at 4+.</div>
  <div class="votes"><div class="vote"><span class="who">Bo</span><span class="role">contributor</span><span class="q">“column is nullable, fine to go”</span><span class="st mono">★★★★ 4</span></div>
                     <div class="vote waiting me"><i class="ring"></i><span class="who">Ana</span><span class="q">you</span><span class="st">rating now</span></div></div>
  <div class="quorum"><i class="on"></i><i class="next"></i><span class="n">1 of 2 at 4+ · avg 4.0</span><span class="grant">your 4 grants it</span></div>
  <!-- <Stars value={4} word="Good" tick /> + note -->
  <div class="actions"><button class="btn primary sm">Approve with 4</button><button class="btn ghost sm danger">Deny</button><span class="note">Approve without a pick sends 4 · a 3 is a voice, not a vote</span></div>
</section>
```

CSS: `.notice .kind .command .origin .actions .note .edited`, `.quorum` in tokens.v5.css; `.votes .vote`
is page CSS to lift (§10.2).

### 3.8 `Stars`, `StarTiles` · rating-control (unjudged, adopted) · accessibility · approvals-queue · mobile panel

Five SVG stars in one radiogroup with roving tabindex (Unicode ★ is retired from manager-overview and
agent-profile); 1.5 px outlined when empty, `--star-pre` on preview, `--star-on` when picked; the
`.tick` after the third star marks the gate threshold under a ratings rule; the serif `.word` beside it
says what the pick does (Not yet · Risky · Fine · Good · Ship it) and doubles as the accessible name
("4 of 5, Good"). Keys: arrows preview, 1–5 jump, Enter picks, 0 clears. `DEFAULT_RATING = 4`; the button
carries the number ("Approve with 4"); no surface pre-selects a number with a primary colour.

```ts
function Stars(p: { value: number | null; onChange; size?: "sm" | "md" | "lg"; tick?: boolean /* under a ratings rule */;
                    word?: boolean; readonly?: boolean /* submitted: stars locked + drawn check */; label?: string }): JSX.Element
function StarTiles(p: { value; onChange }): JSX.Element   // phone: five-up 48–50 px, 12 px corners; off .55 surface-2, .upto apricot-soft, .pick solid apricot + chocolate star + glow; words in the labels
```

```html
<fieldset class="stars" role="radiogroup" aria-label="Your rating">
  <button class="star on" role="radio" aria-label="1 of 5, Not yet"><svg><path d="…"/></svg></button> … <span class="tick" aria-hidden="true"></span> <button class="star pre" …>…</button>
  <span class="word high">Good</span>
</fieldset>
<div class="star-tiles" role="radiogroup"><button class="star-tile upto" aria-label="1, risky">★</button>…<button class="star-tile pick" aria-checked="true" aria-label="4, good">★</button><button class="star-tile">★</button></div>
```

CSS: `.stars .star .tick .word (.low .mid .high) .sm .lg`, `.star-tiles .star-tile (.upto .pick)`.

### 3.9 `PlanCard`, `PlanStep`, `Raters`, `Totals` · plan-card (unjudged, adopted) · session-view

A ledger that lives in one shape through four moments: proposed (apricot stripe, "Waiting for ratings"),
approved/running (green), done, revision asked (surface-3, dimmed, "Replaced by a newer plan"). Head:
serif title 20 · status word with the dot · the rule in mono. Step row grid `22px 1fr auto auto auto`:
number ring (hairline pending · apricot ring + halo running · green check done · dashed chocolate at
the gate) · title + detail · risk pill · `.used` (ink; "so far" in accent-ink while running; `--warn-ink`
over, never red; `--ok-ink` under) · `.est` faint mono with a tilde. Totals: `.budget` with the actual fill,
the estimate tick, the 80 % tick, "14.1k of 40k"; "Soft budget · nothing stops at 100 %" once in the foot.
Rating row: your `Stars` and a note; "1 of 2 ratings · 4.0 average · waiting · needs 2 at 3+" in mono;
`.raters` chips with serif name + mini stars + quoted note, `.rater.missing` dashed; "approved by the
team's ratings" in `--ok-ink`, "approved by *Ana*" serif when an owner overrides. Decisions: Approve now
(primary) only while proposed; Ask to revise and Reject (ghost, danger ink) stay while approved; one line
under them says what each does to the agent. The irreversible step's detail says "waits at the release
gate" so plan and gate point at each other.

```ts
function PlanCard(p: { plan: PlanRecord; moment: "proposed"|"running"|"done"|"superseded"; ratings: PlanRating[]; rule: string; budget;
                       me; onRate; onApprove; onRevise; onReject; gateFor?: (stepIdx) => Approval | null }): JSX.Element
function PlanStep(p: { n; title; detail; risk; state: "pending"|"running"|"done"|"gate"; used?: number; est: number; over?: boolean }): JSX.Element
```

CSS: "PLAN CARD AND RATINGS" (`.plan (.approved .running .done .superseded) .pstep (.done .running .gate)
.used (.sofar .over .under) .est .foot .by .raters .rater.missing`, `.pill.risk.*`). The app's
`.plansteps` list becomes `.steps > .pstep`.

### 3.10 `Composer` · composer (unjudged, adopted) · session-view · keyboard-first · error-states

One field with two listeners: the Agent | Team `Seg` decides who hears you; a mono `.chip` always states
how the next send lands ("steer · goal", "constrain · tax-lines"); the popover only edits what the chip
says. `.to-team`: apricot wash on the field, the Team segment filled, an italic serif "to the team" with
the people's avatars, the hint "Kept in the log. Never sent to the agent." Interrupt is the composer's
only amber. Offline: the field never locks; the send becomes a clock; the copy is "Not sent · kept here
until you are back" with one Resend (error-states' fix: the product does not yet hold and replay). A
plan waiting: a card-line above the field with the Planning pill, Bo's stars, "yours is missing", "Rate
the plan". The hint line names the platform's keys ("⌘ ↵ send · ⇧ ↵ new line · ? shortcuts · as Ana,
owner, driving"); on the phone it goes. `.readonly` (replay): dashed border, "Nothing is sent while you
look back", one chocolate "Return to now". Groups have no Team | Agent toggle (new-group's fix).

```ts
function Composer(p: { to: "agent" | "team"; onTo; mode: "steer" | "constrain"; scope: string; interrupt?: boolean;
                       offline?: { held: Draft[] }; planWaiting?: PlanRecord; presence?: { who; doing: "directive" | "team" }[];
                       readonly?: { onReturn }; me: Me; onSend }): JSX.Element
// states: :focus-within (glow) · .to-team · .interrupt · .offline · .readonly · .typing (ModeChip)
```

```html
<div class="composer-wrap">
  <div class="composer to-team">
    <textarea aria-label="Write to the team" placeholder="Steer, constrain, or ask…"></textarea>
    <div class="bar">
      <fieldset class="seg" aria-label="Send to"><button>Agent</button><button class="on">Team</button></fieldset>
      <span class="chip mono">steer · <b>goal</b></span>
      <span class="to serif i">to the team <span class="stack">…</span></span>
      <div class="right"><button class="btn ghost icon sm" aria-label="Attach"/><button class="send" aria-label="Send to the team">↑</button></div>
    </div>
  </div>
  <p class="hint">⌘ ↵ send · ⇧ ↵ new line · <kbd>?</kbd> shortcuts · as <span class="serif">Ana</span>, owner, driving</p>
</div>
```

CSS: "COMPOSER" (`.composer .to-team .readonly .bar .hint`, `.seg`, `.mode`).

### 3.11 `Drawer` with `TeamPanel` and `Details` · team-panel (8.8 keep)

One 340 px drawer, two faces (Team | Details) on a `Seg` in the drawer head with the live dot and the
count; section headers (`h3`) carry their summary in `.sum` ("2 here · 1 away", "proration · 1 conflict",
"25 % · about 37.6k left"); Memory and Catch-up collapsed by default; the chat input pinned with "Kept in
the session log. Never sent to the agent." Fix carried: the Details face fits 900 px: the Branches file
list folded by default, Usage moves above Branches when the budget is past the 80 % tick, each branch
row has one labelled action plus a `…` menu. Every child of `.drawer .group` is `flex: none`
(welcome-agent's collapsed brief). The phone's Team sheet is the same panel state at two detents.

```ts
function Drawer(p: { face: "team" | "details"; onFace; live: boolean; count: number; onClose; children }): JSX.Element
function TeamPanel(p: { people: Person[]; me; driver; crew?: { name; mates: AgentRow[]; claims: Claim[] }; chat: TeamLine[]; offer?: Handoff; onHandoff; onAccept; onSend }): JSX.Element
function PersonRow(p: { person; you?; role; driving?; writing?: boolean; away?: string; canChangeRole?: boolean; onHandOff? }): JSX.Element
function CrewmateTile(p: { row: AgentRow }): JSX.Element       // a navy rail card inside the cream drawer
function Details(p: { intent: IntentKeys; branches: Branch[]; workspace; usage; memory; brief; catchUp; overBudget?: boolean }): JSX.Element
function UsageSection(p: { usage; budget; turns: TurnUsage[]; onEditBudget? }): JSX.Element   // the big mono number, the four-way split, per-turn stacked bars on one scale
```

```html
<aside class="drawer" aria-label="Team">
  <div class="drawer-head"><fieldset class="seg"><button class="on"><i class="dot running xs"></i>Team <span class="n">3</span></button><button>Details</button></fieldset><button class="btn ghost icon sm" aria-label="Close">×</button></div>
  <div class="group"><h3>In this session <span class="sum">2 here · 1 away</span></h3>
    <div class="person"><span class="avatar driver">AN</span><span class="who"><span class="name">Ana<span class="you">you</span></span><span class="role">owner · <span class="driving">driving</span></span></span><button class="btn ghost sm">Hand off</button></div>
    <div class="person off"><span class="avatar">CY</span><span class="who"><span class="name">Cy</span><span class="role">observer · away 12 min</span></span></div></div>
  <div class="group"><h3>Crew <span class="sum">1 other agent</span></h3><div class="tile"><!-- AgentCard markup --></div><div class="claims mono">apps/web/src/billing/** <span>this agent</span></div></div>
  <div class="group chat"><h3>Chat <span class="sum">3 today</span></h3> … <div class="divider join">Cy joins</div>
    <div class="input-row"><input class="input" placeholder="Say it to the team"/><button class="send"/></div><p class="fine">Kept in the session log. Never sent to the agent.</p></div>
</aside>
```

CSS: "SURFACES, LISTS, DRAWER" (`.drawer h3 .sum .group .tile`, `.person .name .you .role .driving .off`,
`.chat .line`). `.drawer-head` is page CSS to lift (§10.5).

### 3.12 `ReplayScrubber`, `EdgeOfThePast` · replay-scrubber (8.3 revise)

A row under the topbar: one dot per turn on a hairline (seen filled ink, ahead faint), the viewed dot
ringed in apricot, now pulsing with "NOW" **in ink with an apricot dot beside it**, the release gate as
a hollow diamond, plan steps as spans above the track reusing the plan card's step states. Fix carried:
the hovered turn's preview lives in the left label ("Turn 8 · 09:44 · *Bo steers*", snapping back), no
tip under the track; a 36 px resting form (dots only) that grows to the 64 px track when pinned or
viewing. The stream folds to the turn, ends at a dashed "The session goes on · 6 more turns to now"
divider with future chips, and the composer goes `.readonly` with one chocolate "Return to now".

```ts
function ReplayScrubber(p: { turns: Turn[]; steps: StepSpan[]; viewing: number | null; now: number; pinned: boolean; onView; onReturn; onPin }): JSX.Element
// states: .rest (36 px) · .on (64 px) · tick: .seen .at .hover .gate .now
function EdgeOfThePast(p: { more: number; next: { turn; what }[]; onReturn }): JSX.Element
```

CSS to lift: §10.7 (`.scrubber .viewing .track .line .dots .tick .steps .pstep .times`).

### 3.13 `LaneCard` (what reaches you from elsewhere) · keyboard-first (8.3 keep)

A 364 px right lane (collapsing to a chip row under 1280: "1 waiting in Checkout · 1 mention") for a
gate waiting in another session and an @mention: navy titlebar with the session name in serif apricot,
the irreversible pill, the mono command, the gate line with Dee's stars, Approve in the hand with its key
inside the button. Two presses for the irreversible `a` (first lights the card, `.kbd.live`, "`a` again
approves · `esc` leaves it"). `g` jumps to a mention, `r` replies.

```ts
function LaneCard(p: { kind: "gate" | "mention"; session; armed?: boolean; children; keys: { k; label; live? }[] }): JSX.Element
```

---

## 4 · Overlays and navigation

### 4.1 `CommandPalette`, `PaletteRow` · command-palette (7.3 keep)

⌘K lifts one lit surface over the page behind the scrim; a scope chip names the session; five groups in
fixed order (Actions · Switch session · Go to · People and agents · Team memory) with a count beside the
title and a quiet right-aligned "why". Matches are weight and ink (`--match` 600, 400 inside serif
names; `--rest` ink-2), never a background. The highlighted row carries the wash + hairline, the icon
turns to the hand, `↵` appears only there (the grey hint word hides). A release-gate action is a `.two`
row with the rating step inline ("Rate it first ★★★★☆ Enter alone sends 4 · Bo already rated 4").
Footer: "↑↓ move · ↵ run · ⇥ next group · esc close" with the mark and "11 of 38 across Payments". Fix
carried: `Ap<b>pro</b>ve` (the markup ate a `p`: read the top row of every shot). Phone: a bottom sheet.

```ts
function CommandPalette(p: { open; query; scope?: { session: string }; groups: PaletteGroup[]; cursor; onRun; onClose }): JSX.Element
function PaletteRow(p: { icon | avatar; label: ReactNode /* with <b class="m"> on matched letters */; name?: string; sub?: string; code?: string;
                         right?: { hint?: string; status?: string; pill?: ReactNode }; on: boolean; two?: { stars; text } }): JSX.Element
```

```html
<div class="scrim"></div>
<div class="palette" role="dialog" aria-label="Commands">
  <div class="q"><svg class="ic"/><input class="field" value="pro"/><span class="scope"><span class="serif">Invoice PDF: tax lines</span></span><kbd>esc</kbd></div>
  <div class="list">
    <div class="section">Actions <span class="n">3</span><span class="why">on this session</span></div>
    <div class="row two on" role="option" aria-selected="true"><svg class="ic"/><span class="lab">Ap<b>pro</b>ve <code>push origin main</code> <span class="sub">Cy's agent · Checkout</span></span>
      <span class="right"><span class="pill risk irreversible">irreversible</span><span class="enter"><kbd>↵</kbd></span></span>
      <span class="more">Rate it first <span class="stars sm">…</span> Enter alone sends 4<span class="long"> · Bo already rated 4</span></span></div>
    <div class="row"><span class="avatar agent sm"/><span class="lab"><b>Pro</b>ration credits on plan change <span class="sub">Bo's agent · Billing page</span></span><span class="right"><span class="status running">Running</span></span></div>
  </div>
  <div class="foot"><span class="k"><kbd>↑</kbd><kbd>↓</kbd> move</span><span class="k"><kbd>↵</kbd> run</span><span class="k tab"><kbd>⇥</kbd> next group</span><span class="k"><kbd>esc</kbd> close</span><span class="brandline"><svg class="mark"/>11 of 38 across Payments</span></div>
</div>
```

CSS to lift: §10.1.

### 4.2 `ShortcutSheet` · shortcuts (8.5 keep)

`?` lifts a register, not a cheat card: each session key says what it would do right now ("`a` approves
`git push … :main` and sends four stars, which grants the gate with Bo's 4"); the keys that would act on
something waiting are `.live` (apricot wash + hairline, the cap filled with the hand); a key with nothing
to do steps back. Two columns at 880 (this session + composer | anywhere + queue + palette), one hairline
between, 26 px caps, the ⌘/Ctrl segment in the footer. Fix carried: the footer legend is an
apricot-washed key-cap swatch (not a checkbox), and the `?` key on the "This sheet" row gets a
"you-pressed-this" treatment (`.kbd.pressed`) distinct from the live wash. Needs a `context` prop.

```ts
function ShortcutSheet(p: { open; context: { session?: string; driving; waiting?: Approval; offered?: Handoff; neighbours: [prev, next] }; mod: "⌘" | "Ctrl" }): JSX.Element
```

### 4.3 `SearchPage` (`QueryBar`, `KindTabs`, `Hit`, `Refine`) · search (7.8 keep)

One query across everything the team keeps, on a page: the query bar is the one glowing surface with the
scope chip and the live filter chips (grey key word, bold value, `×`) and the mono syntax hint
(`from:bo in:#billing before:friday`); kind tabs with mono counts that add up (6+14+9+4+6 = 39), the
active tab's pill apricot with an apricot-deep underline; one `.hit` row for every kind (30 px lead ·
serif title line · two-line snippet · attribution · status/time/pills right); the cursor row = the
selection grammar with `↵ open` only there; the refine column (said by, where, when, kinds) folds to a
counted "Filters · 2" button on the phone. Fix carried: this page uses the rail from §2 (no local
redraw). Open: whether "All" is a group cut or a ranked list with kind pills.

```ts
function SearchPage(p: { query; scope; filters: Filter[]; kinds: { kind; n }[]; active: Kind | "all"; hits: Hit[]; cursor; refine: Refine }): JSX.Element
function Hit(p: { kind: "session"|"message"|"memory"|"person"|"agent"; lead: ReactNode; title: ReactNode; where?: string; snippet; attribution?; right?: ReactNode; cursor?: boolean }): JSX.Element
```

### 4.4 `Banner` (OS) and `InboxRow` · notifications · desktop-tray (7.0 revise) · inbox (unjudged, adopted)

One notification grammar for toast, banner and inbox row: title = who · verb · what; body = where, then
what it means for you; two buttons at most; a `tag` so a repeat replaces. The OS keeps its own colours
(buttons native, never a hardcoded chocolate fill). A banner decision under a ratings rule opens the
notice, never approves blind. The badge counts decisions only (approvals + handoffs); mentions never
badge. `InboxRow`: a stripe by kind, the serif sentence, the rule or quote, the meta line, and at the
right exactly what you can press now (stars + Approve, Accept, Pick 1/Pick 2, Retry step, an inline
reply); pressing it is the whole act (Joining… → the green outcome word with the drawn check → read).

---

## 5 · Pages (`views/*`)

### 5.1 `QueueRow` (the row that waits) · approvals-queue (8.3 keep) · project-page (8.0 keep)

Grid `18px 34px minmax(0,1fr)` (gutter · agent avatar · body): one serif sentence ("*Bo's agent* in
*Checkout* wants to deploy `checkout-proration` to production."), the project · risk pills · votes · mono
age on the second line, the `Quorum` on gate rows (gradient hairline on the left, the plain `gate` pill),
and `.ctl`: the compact `Stars` with the tick and the serif word, "Approve with 4", Deny, the `.hint`
("`a` sends 4"). Five states in one list: cursor with preview · exec with no votes · your vote in (stars
locked, drawn check, "Change to deny") · driver-only ("waits for the driver · *Cy* · away until 13:00",
**Nudge Cy** the only action; "Decide as owner" only when the gate policy returns an owner-override rule
for that risk class, and then the button says what it does: the fix) · a gate at avg 3.0 (amber segment).
A decided row folds into Done with the result coloured. The action column carries the one verb the row
waits for (Rate, Pick, Approve with 4, Replay); destructive verbs live in the overflow.

```ts
function QueueRow(p: { row: QueueRow; me; cursor: boolean; state: "needs-you"|"exec"|"voted"|"driver-only"|"low"|"done"; override?: OwnerOverride | null; onRate; onApprove; onDeny; onNudge }): JSX.Element
```

### 5.2 `KeyboardCursor` (one state) · memory-browser (9.0 keep) · approvals-queue

Shared by the approvals queue and the memory browser: `.cursor` = `--select-wash` (55 % on dark so
`--ink-3` metadata stays legible) + inset 1.5 px `--select-line` + a 3 px apricot-deep gutter stripe; the
row's `.hint` in `--ink-2`; keys never while you type; pointer hover is `--surface-2` so both can show.
CSS: `.selected, .cursor`, `.rowitem.cursor` in tokens.v5.css.

```ts
function useCursor<T>(items: T[], opts: { keys: Record<string, (item: T) => void>; disabledWhileTyping: true }): { index; set }
```

### 5.3 `MemoryEntryRow`, `ConflictCard` · memory-browser (9.0 keep)

Entry row: kind disc (check = decision, lines = rule, i = fact, summary = `--rail` disc with an apricot
edge — the fix collapses the three gradients to one) · mono key · the sentence · `Attribution` · kind word
and age right. States: retracted (key and sentence struck, Ana's reason), superseded (dimmed), stale
agent-written ("Still true / Retract"), proposed by the curator ("Retract / Keep", the curator never
retracts), cursor. Conflict card: two sides with the quote in serif, session · commit · scope under each,
"Keep this" (the hand) under each with "read by 3 sessions", the foot "Both can be wrong · Write the
rule yourself"; `.open` (amber) → `.resolved` (green, folded to two lines, the loser struck, the reason
in italic serif).

```ts
function MemoryEntryRow(p: { entry: EntryRecord; state?: "retracted"|"superseded"|"stale"|"proposed"; cursor?: boolean; onKeep; onRetract; onStillTrue }): JSX.Element
function ConflictCard(p: { key; sides: [Side, Side]; state: "open"|"resolved"; blocks?: string; onKeep(side) }): JSX.Element
```

### 5.4 `Chart` (`Bars`, `Area`) · usage-charts (7.8 keep) · manager-overview (8.3 keep) · data-viz-style (6.8 revise)

One chart component. In/out stacked bars with navy and chocolate stepped at the family's saturation
(S≈26–31, near `#45527A` / `#8A4A3C` on cream; cobalt `#3B66A8` is retired), a 2 px surface gap, columns
capped at 24 px with the rounded top on the output segment only; the hand only for a lone series (the
area chart); `--bar-agent` for the agent series; texture as the second discriminator before any new hue;
a reading sentence and a table under every chart; the hover readout **replaces the row's value column**
("58k" → "58,412 · 27%") so it never covers a neighbour; axis ticks and values mono; labels in text
tokens; deltas ink with the sign, coloured only against a budget; an apricot tip for a session running
now. Phone: label 92 / track 14 / mono value, a 7-day column chart with its own viewBox.

```ts
function Bars(p: { rows: { label: ReactNode; href?; input: number; output: number; live?: boolean; avatar? }[]; stacked?: boolean; reading: string; table?: boolean; onHover }): JSX.Element
function Area(p: { series: Point[]; budget?: number; projection?: Point[]; band?: number; reading: string }): JSX.Element
```

### 5.5 `NeedsYouCard` · manager-overview · email-digest (8.25 keep) · mobile-manager (8.3 keep)

A 4 px stripe by kind (apricot plan, `--gate-stripe` gate, red contention), uppercase kind label with the
age in mono, a serif line naming the thing in italic, the rule in one sentence, who, vote dots with a
dashed `Avatar missing` for the missing voice, one button. Used in the overview, the inbox, the digest,
the Slack brief, the PR ladder.

```ts
function NeedsYouCard(p: { kind: "plan"|"gate"|"contention"|"handoff"; age; sentence: ReactNode; rule: string; who: Person[]; votes?: { have; need }; action: { label; onClick } }): JSX.Element
```

### 5.6 `DirectionChip`, `BoardRow`, `CrewBoardHeader` · project-page (8.0 keep)

Direction chips: italic serif mode tag (apricot wash for constrain, plain for steer), author avatar and
age, an apricot ring + Withdraw on your own. Board rows: `dot · what · meter · status · action` for
running, awaiting, held (tinted for a contention), idle, closed; the action column = the one verb the row
waits for (Rate, Pick for the lead, Replay; nothing on running rows); "Leave crew" in the overflow,
"Team up" on the crew header (the fix). Crew header as the rail draws it + the crew's claims in mono.
The crew is renamed so it does not collide with the sibling project ("Proration" under Billing page);
the topbar's New session is dropped so the rail's gradient button is the only one.

### 5.7 `RosterCard`, `AgentProfileHeader` · manager-overview · agent-profile (7.8 revise)

People and agents in one roster grid (a person with a green ring when online and the week's tokens; an
agent with its status and crew). The profile header states the name rule once: the serif name is
"*Ana's agent*", the session it is on ("Proration for mid-cycle upgrades") is the rail card's title; one
Message / Open session pair in the header only; the page sits in the shell (§2 rail, dark status triplet
from tokens).

### 5.8 `RangeControl`, `ScopeSeg` · manager-overview · memory-browser

Today / 7 days / 30 days (overview, usage); Org 118 / Team 41 / Project 17 (memory). A `Seg` whose
counts are mono; on the phone a 44 px pill on `--rail-2` in the top block.

### 5.9 `ChecksTable`, `FixLine`, `SaveBar`, `PresetTile` · team-look-editor (7.0 revise) · team-emblems (7.25 revise)

The checks table is the system's contrast control: rows = what must stay readable, columns = the
canvases (cream, dark), each cell a mono ratio + fine/low word + a 4 px bar with the minimum tick;
**every ratio computed by the product's `contrast()`** (the board hand-typed 4.2 : 1 where the real value
was 2.6 : 1: the fix); the fix line names the nearest passing hex with a one-tap Use; warn, never block;
the save bar counts and names the changes and says who gets them and when. Changed rows: apricot wash +
CHANGED tag. Preset tiles are the look in miniature. The preview is a slice of the shell painted only
through `--p-*` (and its `.prail .new` needs the `.rail .new` reset). Three dials (accent, highlight,
surface) from curated pairs; the emblem is a crest at 48 px and up only; teams recolour glows and
selection, never the brand mark's arcs.

```ts
function ChecksTable(p: { checks: Check[] /* from checksOf(draft) with the dark column */; onUse(hex) }): JSX.Element
function SaveBar(p: { changes: Change[]; low: Check[]; audience: string; onSave; onReset }): JSX.Element
```

---

## 6 · Groups and chats (`views/ChatView.tsx`)

### 6.1 `GroupRow`, `MemberStack` · groups-list (8.3 keep)

One row shape: 44 px emblem (team: navy `#`; project: apricot-wash `#`; person: avatar; agent: squircle
with a live dot) · serif name + purpose + scope tag · the attributed last line (serif name, "*Cy's agent*"
in italic chocolate, `code` for branches) · time (`--accent` when unread) · the people | agents stack
with the hairline seam · a chocolate `Count` for unread, an apricot `Count at` for a mention, bell-off
for quiet. Read rows lose the card, the shadow and the emblem colour. Three scopes as sections (Team,
Projects, Direct). Fix carried: the New group panel is closed on this page (the sheet belongs to
new-group); agent tiles get the 2 px seam and the dot on the outer corner.

### 6.2 `AgentReply` · chat-view (7.8 revise) · mention-flow (8.5 keep)

Plain prose behind a 2 px navy→chocolate rule, a 26 px agent avatar with the live dot, serif name, owner
in faint sans, dot-separated meta ("replied · in reply to Ana · turn 12"), the mono turn, an outlined
"Open session" chip; a question back to the people in italic serif; a plan chip that links to the
session's plan card. The chat never shows tool steps. Typing: "*Billing page* · Ana's agent ── answering
Dee · turn 13" with the weave.

```ts
function AgentReply(p: { agent: AgentRow; owner: string; replyTo?: string; turn: number; when; ask?: string; plan?: PlanChip; children }): JSX.Element
```

### 6.3 `MentionMark`, `MentionList` · chat-view · mention-flow

Three marks: a person on apricot-soft with chocolate text (7 px radius); `.you` on solid apricot; `.agent`
on navy (`#3A4458` at night) in serif with the agent's corner. The @ completion: header "People and
agents in #billing" with the typed query echoed in mono, matched letters chocolate, person rows with
role, agent rows "Ana's agent · Billing page · running", the owner under the agent as "not a match,
listed for the owner", the selected row on apricot-soft with `↵`, footer "Mentioning an agent steers its
session; its next words come back here." In the session the steer wears the `.origin` tag and a mono
scope line ending "answers in #billing".

```html
<mark class="mention agent">@Billing page</mark> <mark class="mention you">@Ana</mark>
<div class="mention-list" role="listbox"><div class="head">People and agents in #billing <span class="q">@<b>B</b></span></div>
  <button class="on" role="option"><span class="avatar agent sm"/><span class="name"><span class="n serif"><b>B</b>illing page</span><span class="sub">Ana's agent · running</span></span><span class="kind">agent <kbd>↵</kbd></span></button>
  <div class="foot">Mentioning an agent steers its session; its next words come back here.</div></div>
```

CSS: `mark.mention (.you .agent)` in tokens.v5.css; `.mention-list` to lift (§10.8).

### 6.4 `PickRow`, `ScopeCard`, `NewGroupSheet` · new-group (8.8 keep)

Two halves: the form left, "How it will open" right (a live miniature of the group page with the
`JoinLine` playing arcs-close, the roster, the empty hint, the composer with **the chat composer's own
hint, no Team | Agent segment**: the fix). `#` as a serif prefix in the name field with a "free" check.
Scope as three radio cards each stating its rule; the chosen card apricot-washed with a chocolate radio.
One `PickRow` shape for people and agents: avatar · serif name · owner/role line (agent: "*Ana's agent* ·
status dot + word") · check; "you · owner" greyed and unpickable; a picked row on surface-2 with an
apricot ring on the avatar and a chocolate check; a just-picked avatar ripples; a warn-soft note under
the lists says what a non-running pick means. Footer: roster · "3 people and 2 agents in the circle" ·
Cancel · "Create #proration".

```ts
function PickRow(p: { who: Person | AgentRow; on: boolean; you?: boolean; just?: boolean; onToggle }): JSX.Element
function ScopeCard(p: { value; label; rule: string; on; onPick }): JSX.Element
```

### 6.5 `MembersDrawer` (`RoleChip`, `RemoveConfirm`, `ChangesLedger`) · members-drawer (7.5 revise)

One add field offers people and live agents together (agent rows with status, owner, crew, what it is
on, spend; an ended session greyed "not live · can't join"); results **inline, pushing the list down**
(the fix), one screenshot per state. Role chips: Creator on solid apricot, Host on wash, Member plain; a
menu only where you may change it (Creator disabled with the reason). Leave on your own row; Remove
reveals an inline confirm that says what stays and offers "Also remove *Billing page*, her agent"; the
one solid button is "Remove Ana" (danger), Keep is ghost. The Changes ledger: the mark for joins, a
minus ring for leaves, "Never sent to the agents." A join fires the `JoinLine` and a toast with Undo.

---

## 7 · Onboarding and bad moments

### 7.1 `StepMark`, `DoneStepFold`, `AlreadyWaitsCard` · first-run-desktop (7.5 keep)

The four stages of the mark as step markers (`Mark state`: faint ring → one arc → two arcs apart → the
closed ring with its centre); a done step folds to one serif line keeping its facts in mono
(`henosis.payments.internal · Payments team · 4 projects`). "Three things already wait for you, Dee." as
a `Wash` card with rows of avatar + mono tool name, wherever a first click needs somewhere to go (end of
first run, tray sub-lines, the empty inbox). Fix carried: the tray tile shows the apricot pending dot on
the tray glyph, large; the Dock badge red is `--badge`, never a literal.

### 7.2 `ArrivalCard`, `BriefDrawer` ("What it was told") · welcome-agent (7.5 revise)

The `JoinLine` is the hero; under it the arrival card: facts (Status · Mentioned by · Gate · Budget as
four surface-2 tiles), "Who it joined" with roles ("holds the gate" in chocolate), the hearing rule in
one line (the same sentence new-group and members-drawer use), actions "Say hello" (primary, prefills
`@Checkout`) · Open session · "What it was told" (link). The drawer: a navy serif brief paragraph
(`flex: none`: the fix), then ledger sections (the circle, the crew, manners, in your context, not told)
with a mono "As the model reads it" fold and its token cost. Reuse for the handoff brief and the human
onboarding page. Stripes and border-images never take the gradient.

### 7.3 `LookHereLayer`, `CoachMark`, `RingProgress` · tour (7.0 revise)

Navy dim `.52` (near-black `.62` at night) plus a 3 px apricot + 10 px soft halo on one target
(`.dimmed`, `.lit`, `--dim`, `--halo`), usable by the tour, the first approval and the palette's "show
me". The coach mark: serif headline in the product's voice ("Plans come first."), the tip on apricot
wash, Back · Next (the hand) · Skip, `→ ← esc` in mono caps, the five-segment ring (`Mark state="ring5"`,
chocolate = now, apricot = done, ghost centre until "Close the ring" pops the dot). Fix carried: an
arriving approval **ends** the tour (dim lifts, the approval card takes the halo, reopenable from
Settings), never a live control under an `aria-hidden` layer. Phone: the mark is a bottom sheet.

### 7.4 `ConnectionLine`, `BadMomentCard`, `ServerDown` · error-states (7.0 keep)

The bad-moment sentence: what happened with a time, what still works, what Henosis is doing, one
chocolate action. `ConnectionLine`: "Reconnecting · attempt 3 · again in 4s · the stream is as of 14:02 ·
**Try now**" (grey; the `halo` loader). Presence dims to 45 % with "as of 14:02"; stale things carry the
stamp. Amber for what waits, red only for a human no or branches that disagree, the card stays the quiet
surface. `ServerDown`: the apart mark with the ghost centre, the host name, "What it last saw", Retry.
Plan rejected: struck steps stay visible, the note in italic serif, "Steer towards a new plan". Denied:
both votes stay so the gate's arithmetic shows.

---

## 8 · Frames

### 8.1 Desktop · desktop-window (7.8 keep) · desktop-tray (7.0 revise) · desktop-compact (8.3 keep)

Default window 1280×840 with the navy rail from the top edge; macOS hiddenInset lights in the rail, the
brand row dropped 32 px, the title row as the drag region (`-webkit-app-region: no-drag` on its buttons);
Windows a 36 px `--rail` titlebar with the mark and "Henosis" only, 46×36 caption buttons, the rail brand
row hidden. The OS keeps its own colours: Henosis owns the tray icon (`#mark-mono` template / linen),
the attention dot, the badge count and the strings. Tray menu rows: serif who · verb · muted what · age,
five per section then "and N more…", Quick open (last five sessions and rooms by name), Pause with a
moon, Open (⌥⇧H / Ctrl+Shift+H), Quit; every row a `henosis://p/<project>/s/<session>` route. Breakpoints
written once: 1180 rail folds to 72 · 960 compact · 720 drawer overlays · 480 phone; 40 px hysteresis;
`[` `]` pin the choice.

### 8.2 Mobile · mobile-rail (8.8) · mobile-approvals (8.8) · mobile-session (8.5) · mobile-manager (8.3) · widgets (7.5 revise)

`MobileTopBlock`: 48 px status bar + 44 px bar on `--rail`; menu button left (no badge); serif title
19–22 with a 12 px `--rail-muted` subtitle whose status word is `#9BC88F`; a 40 px right control on
`--rail-active`; an optional strip (Team button "Team · with Bo" with the stack, mono tokens with the
3 px hairline, crew in serif apricot, and a "1 waits for you" apricot chip when the pending gate has
scrolled away: mobile-session's fix; the mark somewhere on the screen). `TabBar`: Sessions · Chats ·
Approvals · Me is the phone's frame; the needs-you count on Approvals, mentions on Chats. `Sheet` (§1.10)
for the rail, the gate and the rating; the rating sheet is the approvals sheet (`--surface`, 26 px,
`StarTiles`, "Approve with 4", Deny quiet, Later as the close). `GateRowMobile`: the serif sentence with
the mono call, the stripe as the only gradient, the plain `gate` pill, the quorum meter with the
consequence phrase in chocolate `nowrap`; filters Needs you / Gates / Others / All with Others the
complement of Gates. The sentence as a titlebar: 23 px serif on navy, counts white, the needs clause
apricot with a pulsing dot, green when nothing needs you, folds to the subtitle on scroll. Widgets: who's
agent · session in serif, "wants to" + mono call, Gate + segments, "Approve · N" chocolate with a quiet
round Deny, figures mono, the mark is `#mark-small` under 24 px.

```ts
function MobileTopBlock(p: { title; subtitle: { status; rest }; left: "menu" | "back"; right: ReactNode; strip?: ReactNode; sentence?: ReactNode }): JSX.Element
function TabBar(p: { active: "sessions"|"chats"|"approvals"|"me"; needsYou: number; mentions: number }): JSX.Element
```

---

## 9 · Off-platform (surfaces panel)

Every surface opens with `copy.team.summary` (names bold/serif, numbers mono, "n things need you" in the
hand); the five-part anatomy (emblem · product name · sentence · context line · actions, the link last);
one message edited in place (a Slack root and a PR comment are the session's address; buttons go when
the decision lands; the `Notice.edited` state mirrors it in-app); `NeedsYouCard` and `VoteRow` reused;
estimate → actual as one idiom (`est 44k → 61k, +38%` amber, `19k, under` green); mocks render what the
host renders (Slack, GitHub and email in the host's type; stars as ★★★★☆ glyphs where the host cannot
draw ours). `DEFAULT_RATING = 4` is the product's; the Slack adapter must send it (today 5).

---

## 10 · Page CSS to lift into tokens.v5.css

The winners kept these in their own `<style>`; they are written here on the tokens so the port does not
re-derive them. Each block uses only tokens that exist in `tokens.v5.css`.

### 10.1 The palette (command-palette; shortcuts and search share `.row`, `.kbd`, the footer)

```css
.palette { position: fixed; z-index: 21; top: 72px; left: 50%; transform: translateX(-50%); width: min(680px, calc(100% - 32px)); max-height: calc(100vh - 110px); display: flex; flex-direction: column; border-radius: 20px; overflow: hidden; }
.palette .q { display: flex; align-items: center; gap: 12px; padding: 16px 18px 15px 20px; border-bottom: 1px solid var(--line); }
.palette .q .field { flex: 1; min-width: 0; border: 0; background: none; font: 17px/1.3 var(--font); color: var(--ink); outline: 0; }
.palette .q .scope { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px 0 8px; border-radius: var(--radius-full); background: var(--apricot-soft); font: 500 12.5px var(--font); white-space: nowrap; }
.palette .q .scope::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--apricot-deep); }
.palette .list { overflow: auto; padding: 8px 10px 10px; }
.palette .section { display: flex; align-items: baseline; gap: 8px; padding: 12px 12px 5px; font: var(--t-kicker); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.palette .section .n { font: 11px var(--mono); letter-spacing: 0; } .palette .section .why { margin-left: auto; letter-spacing: 0; text-transform: none; font-weight: 400; font-size: 12px; }
.palette .row { display: grid; grid-template-columns: 24px 1fr auto; gap: 12px; align-items: center; min-height: 42px; padding: 7px 12px; border-radius: 12px; font-size: 14.5px; color: var(--ink); }
.palette .row .lab { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink-2); }   /* --rest */
.palette .row .lab b { font-weight: 500; color: var(--ink); }                                                              /* --match: weight and ink, never a background */
.palette .row .lab .name { font-family: var(--serif); font-size: 16.5px; color: var(--ink); } .palette .row .lab .name b { font-weight: 400; }
.palette .row .lab .sub { font-size: 13px; color: var(--ink-3); margin-left: 6px; } .palette .row .lab .sub::before { content: "·"; margin-right: 8px; }
.palette .row .right { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ink-3); white-space: nowrap; }
.palette .row .enter { display: none; } .palette .row.on { background: var(--select-wash); box-shadow: inset 0 0 0 1px var(--select-line); }
.palette .row.on .ic { color: var(--accent); } .palette .row.on .enter { display: inline-flex; } .palette .row.on .hint { display: none; }
.palette .row.two { grid-template-rows: auto auto; } .palette .row.two .ic { grid-row: 1 / 3; }
.palette .row.two .more { grid-column: 2 / 4; margin: -2px 0 2px; font-size: 13px; color: var(--ink-2); display: flex; align-items: center; gap: 8px; white-space: nowrap; overflow: hidden; }
.palette .foot { display: flex; align-items: center; gap: 18px; padding: 10px 18px 11px; border-top: 1px solid var(--line); font-size: 12.5px; color: var(--ink-2); background: color-mix(in srgb, var(--overlay) 70%, var(--surface-2)); }
.palette .foot .k { display: inline-flex; align-items: center; gap: 7px; } .palette .foot .brandline { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; color: var(--ink-3); }
@media (max-width: 600px) { .palette { top: auto; bottom: 0; left: 0; right: 0; transform: none; width: 100%; max-height: 86vh; border-radius: var(--radius-sheet) var(--radius-sheet) 0 0; } .palette .q .scope, .palette .row .sub, .palette .foot .k.tab { display: none; } }
```

### 10.2 Votes as rows (release-gate, mobile-approvals, surfaces panel)

```css
.votes { display: flex; flex-direction: column; border-top: 1px solid var(--line); }
.vote { display: flex; align-items: center; gap: 8px; min-height: 36px; font-size: 13px; color: var(--ink-2); border-bottom: 1px solid var(--line); min-width: 0; }
.vote .who { font-family: var(--serif); font-size: 15.5px; color: var(--ink); flex: none; } .vote .role { font-size: 12px; color: var(--ink-3); }
.vote .q { font-family: var(--serif); font-style: italic; color: var(--ink-3); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.vote .st { font-family: var(--mono); font-size: 12px; color: var(--star-on); letter-spacing: 2px; flex: none; } .vote .st b { font-weight: 400; color: var(--ink-2); letter-spacing: 0; margin-left: 4px; }
.vote.deny { background: var(--danger-soft); } .vote.deny .st { color: var(--danger-ink); letter-spacing: 0; }
.vote.voice { opacity: .7; }                                               /* "a voice, not a vote" */
.vote.waiting { color: var(--ink-3); } .vote.waiting .ring { width: 8px; height: 8px; border-radius: 50%; border: 1.5px dashed var(--ink-3); flex: none; }
.vote.me .ring { border-style: solid; border-color: var(--apricot-deep); background: var(--apricot-soft); }
.quorum .grant { margin-left: auto; font: 500 12.5px var(--font); color: var(--accent-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

### 10.3 The token breakdown popover (token-meter)

```css
.meter { position: relative; display: inline-flex; flex-direction: column; gap: 4px; min-width: 92px; }
.meter .tchip { font: var(--t-mono-sm); color: var(--ink-2); display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 2px; background: none; border: 0; cursor: pointer; }
.meter .tchip .pct { color: var(--ink-3); } .meter.warn .tchip .pct { color: var(--warn-ink); } .meter.over .tchip .pct { color: var(--danger-ink); }
.meter.none .tchip { color: var(--ink-3); } .meter.none .hair { display: none; }
.meter .pop { display: none; position: absolute; top: calc(100% + 8px); left: 0; width: 264px; z-index: 12; padding: 12px 14px; border-radius: var(--radius); background: var(--overlay); border: 1px solid var(--overlay-edge); box-shadow: var(--shadow-pop), var(--edge); font-size: 12.5px; color: var(--ink-2); display: none; flex-direction: column; gap: 6px; }
.meter:hover .pop, .meter:focus-within .pop, .meter.pinned .pop, .meter.open .pop { display: flex; }
.meter .pop .head { display: flex; align-items: baseline; gap: 8px; color: var(--ink); } .meter .pop .head .serif { font-size: 15px; } .meter .pop .head .turn { margin-left: auto; font: var(--t-mono-sm); color: var(--ink-3); }
.meter .pop .stacked { display: flex; height: 8px; border-radius: 4px; overflow: hidden; gap: 2px; background: var(--surface-3); }
.meter .pop .stacked .in, .meter .pop .sw.in { background: var(--rail); } .meter .pop .stacked .out, .meter .pop .sw.out { background: var(--accent); }
.meter .pop .stacked .cache, .meter .pop .sw.cache { background: var(--apricot); }
.meter .pop .stacked .write, .meter .pop .sw.write { background: repeating-linear-gradient(45deg, var(--apricot-deep) 0 2px, transparent 2px 4px); }
.meter .pop .kv { display: grid; grid-template-columns: 10px 1fr auto; gap: 8px; align-items: center; } .meter .pop .kv .sw { width: 10px; height: 10px; border-radius: 3px; } .meter .pop .kv .v { font: var(--t-mono-sm); color: var(--ink); }
.meter .pop .rule { height: 1px; background: var(--line); margin: 2px 0; }
.meter .pop .bud .row { display: flex; justify-content: space-between; } .meter .pop .bud .left { color: var(--ink-3); } .meter .pop .bud .left b { color: var(--ink); font-weight: 500; }
.meter .pop .foot { display: flex; justify-content: space-between; align-items: center; color: var(--ink-3); font-size: 12px; padding-top: 4px; }
```

### 10.4 The typed toast's kinds (notifications)

```css
.toast { width: 340px; display: grid; grid-template-columns: 28px 1fr auto; gap: 12px; align-items: start; font-size: 13.5px; line-height: 1.45; }
.toast.k-approval::before, .toast.k-blocked::before { background: var(--warn); } .toast.k-blocked::before { background: var(--danger); }
.toast.k-handoff::before { background: var(--apricot-deep); } .toast.k-done::before { background: var(--ok); } .toast.k-mention::before, .toast.k-joined::before { background: var(--apricot); }
.toast .ico { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--rail-2); color: var(--rail-muted); }
.toast .ico .mark { width: 28px; height: 28px; } .toast .ico .avatar { border: 0; }
.toast .body { min-width: 0; display: flex; flex-direction: column; gap: 3px; } .toast .l1 .who { font-family: var(--serif); font-size: 16px; } .toast .l1 code { font: var(--t-mono-sm); white-space: nowrap; }
.toast .l2 { font-size: 12.5px; color: var(--rail-muted); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; } .toast .l2 .sep::before { content: "·"; } .toast .l2 .you { font-family: var(--serif); font-style: italic; color: var(--apricot); }
.toast .quote { font-size: 13px; color: var(--rail-muted); border-left: 2px solid var(--apricot); padding-left: 8px; }
.toast .acts { display: flex; gap: 6px; margin-top: 7px; white-space: nowrap; }                        /* one line: Open becomes an icon when tight */
.toast .acts .btn.sm { min-height: 28px; padding: 0 11px; font-size: 12.5px; }
.toast .x { width: 24px; height: 24px; border: 0; border-radius: 50%; background: transparent; color: var(--rail-muted); display: grid; place-items: center; cursor: pointer; }
.toast .keys { position: absolute; right: 12px; bottom: 12px; display: flex; gap: 4px; }
.toast.paused .life { background: var(--apricot-deep); }
.toasts .tail { align-self: flex-end; background: var(--rail); color: var(--rail-fg); border: 0; border-radius: var(--radius); padding: 8px 12px; font: var(--t-caption); box-shadow: var(--shadow-soft); }
.toasts .toast:nth-last-child(2) { opacity: .94; } .toasts .toast:nth-last-child(3) { opacity: .86; }
```

### 10.5 The drawer head (team-panel, mobile-rail's sheet head)

```css
.drawer-head { display: flex; align-items: center; gap: 10px; margin: -4px 0 2px; }
.drawer-head .seg .n { font: var(--t-mono-sm); color: var(--ink-3); margin-left: 4px; }
.drawer .claims { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; font: var(--t-mono-sm); color: var(--ink); } .drawer .claims span { color: var(--ink-3); font-family: var(--font); } .drawer .claims .held { color: var(--warn-ink); }
.drawer .input-row { position: sticky; bottom: 0; display: flex; gap: 8px; align-items: center; padding-top: 8px; background: var(--surface); } .drawer .input-row .input { flex: 1; } .drawer .fine { font-size: 12px; color: var(--ink-3); }
.drawer .branch { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; }   /* one labelled action + a … menu */
```

### 10.6 The collapsed rail's hover card (desktop-compact)

```css
.rail.collapsed { width: var(--rail-collapsed); align-items: center; padding: 14px 8px; }
.rail.collapsed .sq { width: 44px; height: 44px; border-radius: var(--radius); display: grid; place-items: center; position: relative; color: var(--rail-muted); }
.rail.collapsed .sq.active { background: var(--rail-active); box-shadow: inset 0 0 0 1px var(--select-line); } .rail.collapsed .sq .count { position: absolute; top: 2px; right: 2px; }
.rail.collapsed .sq .avatar { --avatar-edge: var(--rail); } .rail.collapsed .sq.active .avatar { box-shadow: 0 0 0 2px var(--apricot); }
.rail.collapsed .initial { font-family: var(--serif); font-size: 18px; color: var(--apricot); }
.hcard { position: fixed; z-index: 15; width: 272px; padding: 12px 14px; border-radius: var(--radius); background: var(--rail-2); color: var(--rail-fg); box-shadow: var(--shadow-pop), var(--edge); display: flex; flex-direction: column; gap: 6px; }
.hcard .t { font-family: var(--serif); font-size: 15px; display: flex; align-items: center; gap: 8px; } .hcard .doing { font-size: 13px; color: var(--rail-muted); } .hcard .doing i { font-family: var(--serif); font-style: italic; color: var(--apricot); }
.hcard .foot { display: flex; gap: 10px; font-size: 12px; color: var(--rail-muted); } .hcard .foot .tokens { margin-left: auto; font-family: var(--mono); }
/* opens after a 400 ms rest; placed beside the stream and never over the live message (JS computes the slot) */
```

### 10.7 The replay scrubber (replay-scrubber, with the judge's fix)

```css
.scrubber { position: relative; z-index: 2; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--canvas) 86%, transparent); backdrop-filter: blur(8px); padding: 8px 20px 10px; }
.scrubber .inner { width: min(calc(var(--col) + 120px), 100%); margin: 0 auto; display: grid; grid-template-columns: auto 1fr auto; gap: 22px; align-items: center; }
.scrubber .viewing { display: grid; grid-template-columns: auto 1fr; column-gap: 8px; font-size: 13px; color: var(--ink-2); white-space: nowrap; line-height: 1.35; }
.scrubber .viewing b { font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; } .scrubber .viewing .at { color: var(--ink-3); font-size: 12.5px; } .scrubber .viewing .at i { font-family: var(--serif); font-style: italic; color: var(--ink-2); font-size: 14px; }
.scrubber .viewing.preview { color: var(--ink-3); }                                  /* the hovered turn shows here, then snaps back */
.track { position: relative; height: 36px; cursor: pointer; user-select: none; touch-action: none; padding: 0 6px; transition: height var(--t) var(--ease-move); }
.scrubber.on .track, .scrubber.pinned .track { height: 64px; }
.track .line { position: absolute; left: 6px; right: 6px; top: calc(50% + 6px); height: 2px; border-radius: 2px; background: var(--line); } .scrubber.on .track .line { top: 37px; }
.track .line i { position: absolute; left: 0; top: 0; height: 100%; width: var(--seen, 40%); border-radius: 2px; background: var(--ink-3); opacity: .55; }
.track .dots { position: absolute; left: 6px; right: 6px; top: calc(50% - 1px); height: 16px; display: flex; justify-content: space-between; align-items: center; } .scrubber.on .track .dots { top: 30px; }
.track .tick { width: 8px; height: 8px; border-radius: 50%; background: var(--surface-3); border: 1.5px solid var(--line); box-sizing: border-box; }
.track .tick.seen { background: var(--ink-3); border-color: var(--ink-3); } .track .tick.at { width: 14px; height: 14px; background: var(--surface); border: 2px solid var(--apricot-deep); box-shadow: 0 0 0 3px var(--apricot-soft); }
.track .tick.gate { width: 10px; height: 10px; border-radius: 2px; transform: rotate(45deg); background: transparent; border: 1.5px solid var(--accent); }
.track .tick.now { background: var(--apricot); border-color: var(--apricot); }
.track .steps { position: absolute; left: 6px; right: 6px; top: 6px; height: 18px; display: none; } .scrubber.on .track .steps { display: block; }
.track .pstep { position: absolute; top: 0; height: 18px; display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--ink-3); white-space: nowrap; overflow: hidden; }
.track .pstep::before { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; border-radius: 2px; background: var(--surface-3); }
.track .pstep .n { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid var(--line); display: grid; place-items: center; font: 600 9px var(--mono); color: var(--ink-2); background: var(--surface); }
.track .pstep.done::before { background: var(--ok); opacity: .55; } .track .pstep.done .n { background: var(--ok); border-color: var(--ok); color: #fff; }
.track .pstep.live::before { background: var(--apricot-deep); } .track .pstep.live .n { border-color: var(--apricot-deep); box-shadow: 0 0 0 2px var(--apricot-soft); } .track .pstep.live { color: var(--ink); }
.track .times { position: absolute; left: 6px; right: 6px; bottom: 0; font: var(--t-mono-sm); color: var(--ink-3); } .track .times span { position: absolute; transform: translateX(-50%); }
.track .times .now { color: var(--ink); } .track .times .now::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--apricot); margin-right: 4px; }   /* NOW in ink with an apricot dot */
.edge { display: flex; flex-direction: column; gap: 8px; align-items: center; color: var(--ink-3); font-size: 13px; } .edge .divider::before, .edge .divider::after { background: none; border-top: 1px dashed var(--line); height: 0; }
.edge .next { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; } .edge .next .chip { opacity: .7; }
```

### 10.8 The @ completion and the pick row (chat-view, new-group)

```css
.mention-list { position: absolute; bottom: calc(100% + 4px); width: 360px; padding: 6px; display: flex; flex-direction: column; gap: 2px; }   /* .overlay */
.mention-list .head { display: flex; align-items: center; gap: 8px; padding: 4px 10px 2px; font: var(--t-kicker); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.mention-list .head .q { margin-left: auto; font: var(--t-mono-sm); letter-spacing: 0; text-transform: none; color: var(--ink-2); } .mention-list .head .q b { color: var(--accent-ink); font-weight: 600; }
.mention-list button { display: grid; grid-template-columns: 26px 1fr auto; align-items: center; gap: 10px; width: 100%; padding: 6px 10px; border: 0; border-radius: 10px; background: transparent; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.mention-list button:hover { background: var(--surface-2); } .mention-list button.on { background: var(--select-wash); box-shadow: inset 0 0 0 1px var(--select-line); }
.mention-list .name { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; } .mention-list .name .n { font-size: 14px; } .mention-list .name .n.serif { font-size: 16px; } .mention-list .name .n b { font-weight: 600; color: var(--accent-ink); } .mention-list .name .sub { font-size: 12px; color: var(--ink-3); }
.mention-list .kind { font-size: 11.5px; color: var(--ink-3); display: inline-flex; align-items: center; gap: 5px; } .mention-list .kind kbd { display: none; } .mention-list button.on .kind kbd { display: inline-flex; }
.mention-list .foot { padding: 6px 10px 4px; font-size: 12px; color: var(--ink-3); border-top: 1px solid var(--line); margin-top: 4px; }
.pick { display: grid; grid-template-columns: 32px 1fr 24px; gap: 10px; align-items: center; padding: 8px 10px; border-radius: var(--radius); cursor: pointer; }
.pick:hover { background: var(--surface-2); } .pick.on { background: var(--surface-2); } .pick.on .avatar { box-shadow: 0 0 0 2px var(--apricot-deep); }
.pick .meta { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; } .pick .nm { font-family: var(--serif); font-size: 16px; } .pick .s { font-size: 12.5px; color: var(--ink-2); } .pick .s i { font-family: var(--serif); font-style: italic; color: var(--accent-ink); }
.pick .cb { width: 22px; height: 22px; border-radius: 6px; border: 1.5px solid var(--line); display: grid; place-items: center; color: transparent; } .pick.on .cb { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
.pick.you { opacity: .6; cursor: default; } .pick.you .cb { background: var(--surface-3); border-color: transparent; color: var(--ink-3); }
.pick.just .avatar::after { content: ""; position: absolute; inset: -2px; border-radius: inherit; animation: ripple .9s var(--ease-leave) both; }
```

### 10.9 The phone's top block, tab bar and gate row (mobile panel)

```css
.top { flex: none; background: var(--rail); color: var(--rail-fg); padding: 0 12px 12px; position: relative; z-index: 2; }
.top .sys { height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 0; font: 600 14px var(--font); }
.top .bar { display: flex; align-items: center; gap: 8px; height: 44px; }
.top .bar .ib { width: 40px; height: 40px; border-radius: var(--radius); border: 0; background: transparent; color: var(--rail-fg); display: grid; place-items: center; flex: none; }
.top .bar .title { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.15; } .top .bar .title .t { font-family: var(--serif); font-size: 19px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.top .bar .title .s { font-size: 12px; color: var(--rail-muted); white-space: nowrap; overflow: hidden; } .top .bar .title .s b { font-weight: 500; color: var(--ok); }
.top .bar .ctl { height: 40px; padding: 0 10px; border-radius: var(--radius); background: var(--rail-active); box-shadow: inset 0 0 0 1px var(--rail-line); display: inline-flex; align-items: center; gap: 6px; color: var(--rail-fg); border: 0; }
.top .strip { display: flex; align-items: center; gap: 10px; margin-top: 8px; font-size: 12.5px; color: var(--rail-muted); } .top .strip .tok { display: inline-flex; flex-direction: column; gap: 3px; font: var(--t-mono-sm); } .top .strip .tok .hair { width: 64px; }
.top .strip .waits { margin-left: auto; height: 24px; padding: 0 9px; border-radius: var(--radius-full); background: var(--apricot); color: #56352D; font: 600 12px var(--font); }   /* "1 waits for you" */
.top .sentence { font: 400 23px/1.22 var(--serif); padding: 4px 4px 2px; } .top .sentence b { color: var(--apricot); font-weight: 400; } .top .sentence.quiet b { color: var(--ok); }
.tabbar { flex: none; display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--line); background: var(--canvas); padding: 6px 0 calc(6px + env(safe-area-inset-bottom)); }
.tabbar a { display: flex; flex-direction: column; align-items: center; gap: 2px; font: var(--t-micro); color: var(--ink-3); position: relative; } .tabbar a.on { color: var(--ink); } .tabbar a .count { position: absolute; top: -4px; right: calc(50% - 20px); }
.grow { position: relative; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 13px 14px 13px 18px; box-shadow: var(--shadow-soft), var(--edge); display: flex; flex-direction: column; gap: 9px; overflow: hidden; }
.grow::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--surface-3); } .grow.gate::before { background: var(--gate-stripe); }
.grow.open { box-shadow: var(--shadow-pop), 0 0 0 2px var(--apricot); z-index: 4; }
.grow .say { font-size: 14.5px; line-height: 1.45; } .grow .say .serif { font-size: 17px; } .grow .say code { font: var(--t-mono-sm); background: var(--surface-2); padding: 1px 6px; border-radius: 6px; white-space: nowrap; }
.grow .act { display: grid; grid-template-columns: 1fr auto; gap: 8px; } .grow .act .btn { min-height: 44px; }
.thumb .seg { width: 100%; display: grid; grid-template-columns: repeat(4, 1fr); } .thumb .seg button .n { min-width: 18px; height: 18px; border-radius: 9px; background: var(--surface-3); font: 600 11px/18px var(--font); padding: 0 5px; } .thumb .seg button.on .n { background: var(--apricot); color: #56352D; }
```

### 10.10 The lane card (keyboard-first)

```css
.lane { width: var(--lane-w); flex: none; padding: 16px; display: flex; flex-direction: column; gap: 12px; border-left: 1px solid var(--line); }
.lanecard { border-radius: var(--radius-lg); overflow: hidden; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-soft), var(--edge); }
.lanecard .tb { background: var(--rail); color: var(--rail-fg); padding: 10px 14px; display: flex; align-items: center; gap: 8px; font-size: 13px; } .lanecard .tb .serif { color: var(--apricot); font-size: 15px; }
.lanecard .body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; font-size: 14px; }
.lanecard.armed { box-shadow: 0 0 0 2px var(--apricot), var(--shadow-soft); } .lanecard .arm { font-size: 12.5px; color: var(--ink-2); }   /* "a again approves · esc leaves it" */
@media (max-width: 1280px) { .lane { width: auto; border: 0; padding: 8px var(--gutter) 0; flex-direction: row; } .lanecard { display: none; } .lane .chips { display: flex; gap: 8px; } }
```

---

## 11 · Port order and the ui.tsx diff

Land in this order; each step is independently shippable and the earlier ones are what the later
ones draw.

1. **Tokens**: `tokens.v5.css` → `apps/web/src/tokens.css`; `design/mark.svg` from §1.1. Nothing
   visual changes until the components adopt the new classes, except the deliberate day-one list in
   SYSTEM.md §19 (dark hand `#7A4B3E`, one dark status triplet, `.pill.badge` = the count, the
   contention stripe amber, the focus ring, 780/296/340, the bead retired).
2. **Primitives** (`ui.tsx`): `Mark` (symbols, `cut`, `state`, `centre`), `Avatar` (`kind`, `size`,
   `presence`/`status`, `missing`; the true mark inset from `lg`), `Dot`/`Status` (idle, closed, offline
   as their own classes), `Pill`/`Count`/`Chip`, `Kbd`/`ModeChip`, `Loader` (`halo`; `orbit` page
   centre only), `Stars` (SVG, radiogroup, `.tick`, `.word`) + `StarTiles`, `TokenMeter` (pulsing dot,
   fixed popover shape, no "saved"), `AgentCard` (one definition), `Attribution`, `StatTile`, `Quorum`,
   `JoinLine`, `Wash`, typed `Toasts` + tail.
3. **The rail** (`Rail`, `CollapsedRail` + `HoverCard`, `MobileRailSheet`): every page uses it.
4. **The session** (`Topbar`, `Message`, `StepLine`, `Notice`, `ApprovalNotice` tied to its plan step,
   `PlanCard`, `Composer`, `Drawer` with both faces, `ReplayScrubber`, `LaneCard`).
5. **Overlays** (`CommandPalette`, `ShortcutSheet` with `context`, `SearchPage`, OS banners).
6. **Pages** (`QueueRow` + `useCursor`, `MemoryEntryRow`/`ConflictCard`, `Bars`/`Area` on the chart
   contract, `NeedsYouCard`, `DirectionChip`/`BoardRow`, `RosterCard`, `ChecksTable`/`SaveBar`).
7. **Chats** (`GroupRow`, `AgentReply`, `MentionMark`/`MentionList`, `PickRow`/`ScopeCard`,
   `MembersDrawer`), **onboarding** (`StepMark`, `ArrivalCard`, `BriefDrawer`, `LookHereLayer`,
   `CoachMark`, `ConnectionLine`), **frames** (desktop chrome, `MobileTopBlock`, `TabBar`, `Sheet`).

The ui.tsx diff in one list: `Mark.style` → `centre` (+ `cut`, `state`, `once`, `live`, `ground`);
`Avatar.agent` → `kind` (+ `size`, `presence`, `status`, `missing`; initials are two caps, "A" is gone);
`STATUS` gains `idle`/`closed`/`offline`; `Loader` gains `halo`, `count`, `after8s`, `after30s`;
`Stars` becomes a roving-tabindex radiogroup with `tick`, `word`, `readonly`, sizes; `TokenMeter` gains
`live`, `session`, `turn` and the fixed popover; `AgentCard` renders `.dot <status>` from the six
drawings and a `--spent` hairline; `TeamPill` gains `withNames`; new exports `Dot Pill Count Chip Kbd
ModeChip Btn Send Switch Seg StarTiles TypedToast Quorum JoinLine Wash Attribution StatTile Overlay
Sheet HoverCard`; `ICONS` takes icon-set's manifest. In the kernel-facing code: `DEFAULT_RATING = 4`
everywhere (the Slack adapter sends 5 today); the gate policy returns an owner-override rule per risk
class or the queue never promises one.
