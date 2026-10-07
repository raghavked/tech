# Henosis motion system

Motion means joining or living. Nothing in Henosis moves for decoration: an animation plays because
something joined the circle (a member, an agent, a session connecting) or because something is alive
(a running agent, tokens being spent, rows arriving). This document settles the wave's motion into one
vocabulary. It is written from the judged winners: `motion-spec` (8.3, the clocks, curves, index and
join timeline), `mark-motion` (8.5, the arcs and the centre), `loading-screens` (8.75, the four waits),
`micro-interactions` (8.0, hover / press / focus / toggle / select / drag) and `accessibility` (7.8,
rest states and announcements), with the side rules that other panels settled (`notifications`,
`badges-status`, `keyboard-first`, `token-meter`, `replay-scrubber`, `tour`, `onboarding`,
`welcome-agent`, `members-drawer`, `new-group`, `desktop-compact`, `mobile-approvals`).

Where the wave disagreed, this file decides; the decision is marked **settled** and the losing value is
named so nobody re-litigates it from a board. Section 12 is the diffable patch for `tokens.css` v6.

---

## 1. Principles

1. **Motion means joining or living.** The arcs move only when a member, an agent or a session connects.
   Never on hover, never as decoration, never as a spinner. (`mark-motion`, `motion-spec`)
2. **Rest is the end state.** Every keyframe set ends at the element's natural styles, so with motion off
   the element simply sits where it ends. No animation ever hides a thing until it plays. (`motion-spec`)
3. **Opacity, transform, stroke.** Nothing animates layout. Colour crosses only on the Team pill, the
   composer's Team tint and a team's accent on route change. (`motion-spec`)
4. **One loader per meaning, one moving mark per screen.** If the loader is already playing, a join line
   shows the closed ring and lets its avatar ripple instead. (`mark-motion`, `loading-screens`)
5. **Loading is never blank.** Show what is already in; copy names who and what; counts, not bars; after
   8 s a cause, after 30 s one chocolate action. (`loading-screens`)
6. **Calm keeps the state.** Calm mode and `prefers-reduced-motion` are one guard. They keep colour, state,
   the focus ring, the drawn check and the loader's finished frame; only the change is instant.
   (`motion-spec`, `micro-interactions`, `accessibility`)
7. **The hand is a verb, the pulse is alive.** Chocolate moves only on a primary action (the drawn check,
   the pressed send). Everything that breathes, glows or ripples is apricot. Status green pulses only for
   Running. (`micro-interactions`, `badges-status`)
8. **The frame is drawn once, and so is the motion.** Keyframes live in `design/henosis/tokens.css` under
   the names the app already uses; explorations and `apps/web/src/tokens.css` animate with the same names.

---

## 2. Clocks and curves

Three clocks and three curves cover the app; the mark keeps its own curve. (`motion-spec`,
`micro-interactions`; the app's `--t-fast / --t / --t-slow` and `--ease-arrive / --ease-leave /
--ease-move` already exist in `apps/web/src/tokens.css`.)

| Token | Value | Used for |
|---|---|---|
| `--t-fast` | 120 ms | hover, focus, rail item background |
| `--t` | 200 ms | press, toggles, segments, hover cards |
| `--t-slow` | 320 ms | anything arriving or settling: cards, badges, toasts, pills, sheets |
| (fixed) | 450 ms | the drawn check, the send ring |
| (fixed) | 500 ms | team colours crossfade, hero fade |
| (fixed) | 800 ms · 1 s | the mark settling once; its centre |
| (fixed) | 900 ms | the joined avatar's ripple |
| loops | 1.4 – 1.8 s | weave 1.4 · orbit, shimmer 1.5 · mark, status pulse 1.8 |

| Token | Curve | Used for |
|---|---|---|
| `--ease-arrive` | `cubic-bezier(.2,.7,.2,1)` | things entering: cards, toasts, badges, the settled mark |
| `--ease-leave` | `cubic-bezier(.4,0,1,1)` | things dissipating: the ripple, the send ring, toast out |
| `--ease-move` | `cubic-bezier(.4,0,.2,1)` | colour, shadow, opacity, the check, every loop |
| `--ease-mark` | `cubic-bezier(.3,.9,.3,1)` | the arcs, and anything that travels: a thumb, a handle, a lifted card |

**Settled.** `motion-spec` put press on 120 and hover on 200; `micro-interactions` (and the system-2
carry-forward) put hover and focus on 120, press and toggle on 200. The second wins: a hover must answer
before a press does. **Settled.** `micro-interactions` asked for "plain ease" on colour and the mark's curve
on movement; `motion-spec` and the app use `--ease-move` for colour. `--ease-move` is the plain ease (it is
within a hair of `ease`); `--ease-mark` is added as a token so thumbs, handles and lifts can use the mark's
curve by name. Overshoot is never a spring: the badge pop keeps its 1.15× inside the keyframes and stays on
`--ease-arrive`; the arcs' −4° / +2° are keyed by hand so the mark lands identically on every device.

```css
:root {
  --t-fast: 120ms; --t: 200ms; --t-slow: 320ms;
  --ease-arrive: cubic-bezier(.2,.7,.2,1);
  --ease-leave:  cubic-bezier(.4,0,1,1);
  --ease-move:   cubic-bezier(.4,0,.2,1);
  --ease-mark:   cubic-bezier(.3,.9,.3,1);
}
```

---

## 3. One guard

Calm is the system's `prefers-reduced-motion` or the team's Motion setting (`theme.ts` sets
`data-motion="calm"` on `<html>`; `useMotion()` returns `"full" | "calm"`). Every animation sits under one
positive guard, so the rest state needs no second rule. (`motion-spec`; the app already does this.)

**Settled.** The design `tokens.css` v5 blanket rule (`* { animation: none !important }` under reduce and
calm) is replaced by the positive guard. The blanket rule is what left the approval check undrawn
(`accessibility`, fail 1 of 1): a guard that only ever *adds* animation cannot hide a rest state. The
exploration-era `(data-motion="calm")` media query is gone from v5 on disk; what remains is the selector
below. Transitions read the clock tokens, and the guard zeroes the clocks, so hover, focus and toggles
become instant under Calm without touching each rule.

```css
/* tokens.css v6 · the one guard */
@media (prefers-reduced-motion: no-preference) {
  :root:not([data-motion="calm"]) { --motion: 1; }
  :root:not([data-motion="calm"]) .mark.joining .arc.a { animation: arc-a 1.8s var(--ease-mark) infinite; }
  /* … every animation rule lives inside this block … */
}
/* calm or reduced: clocks to zero, every end state kept */
:root[data-motion="calm"] { --t-fast: 0ms; --t: 0ms; --t-slow: 0ms; }
@media (prefers-reduced-motion: reduce) { :root { --t-fast: 0ms; --t: 0ms; --t-slow: 0ms; } }
/* rest states that are not the element's natural style */
:root[data-motion="calm"] .draw, :root[data-motion="calm"] .ic.draw path { stroke-dashoffset: 0; }
@media (prefers-reduced-motion: reduce) { .draw, .ic.draw path { stroke-dashoffset: 0; } }
```

Two motion levels only: Full and Calm. `team-look-editor` proposed a third, "Quiet" (loaders only, no
side motion); not adopted. A loader without its side motion is a spinner with extra steps, and the brief
says Calm turns all of it off. Revisit only if a team asks.

Components that *time logic* to an animation (removing `.joined` after the ripple, holding a toast,
leaving the loading screen after the settle) read `useMotion()` and skip the wait under Calm. Never wait
on `animationend` without checking it: under Calm the event never fires.

---

## 4. The mark in motion

The arcs are the person's (chocolate, right, 12 → 6) and the agent's (apricot, left). They swing in from
apart and close into one ring; only when the ring is one does the centre appear. The animation is the
tokens' own: `arc-a`, `arc-b`, `dot-in`; 1.8 s; the mark's curve. (`mark-motion`, `brand-board`)

### 4.1 The run, in ms and %

| Phase | Time | Keyframe | What moves |
|---|---|---|---|
| Hold | 0 – 270 ms | 0 – 15 % | arc a at +60°, arc b at −60°; opacity .35 → .5 |
| Swing | 270 – 1 260 | 15 – 70 % | a: 60° → −4°, b: −60° → 4°; opacity .5 → 1 |
| Settle | 1 260 – 1 530 | 70 – 85 % | a: −4° → 2°, b: 4° → −2° |
| Rest | 1 530 – 1 800 | 85 – 100 % | both → 0° |
| Centre in | 1 080 – 1 440 | 60 – 80 % | dot scale 0 → 1.25, `ease` |
| Centre settles | 1 440 – 1 800 | 80 – 100 % | dot scale 1.25 → 1 |

**Settled (the judge's one fix for `mark-motion`).** The arcs start at ±60°, not ±70°, and at opacity .35
rising to .5 across the hold. At ±70° the two half rings overlapped for 140° at the bottom and read as a
muddy crescent at 48 px for the first 300 ms; at ±60° with the lower start opacity the first frame reads
as two arcs resting. The hold itself stays: it is the 15 % that lets the eye find two arcs before they
move, and without it the run reads as a spinner. The app's 12 / 68 / 84 % stops move to 15 / 70 / 85 %,
which is what the storyboard and timeline were computed from.

### 4.2 Loop and once

Two timings, one landing. The loop (`.mark.joining`) runs while something is genuinely loading. The once
run (`.mark.settle`) plays on a join: arcs over 800 ms on `--ease-arrive`, the centre over 1 s. Both land
on exactly `mark.svg`, and nothing on the mark moves again.

```css
@keyframes arc-a { 0% { transform: rotate(60deg); opacity: .35 } 15% { transform: rotate(60deg); opacity: .5 }
                   70% { transform: rotate(-4deg); opacity: 1 } 85% { transform: rotate(2deg) } 100% { transform: rotate(0) } }
@keyframes arc-b { 0% { transform: rotate(-60deg); opacity: .35 } 15% { transform: rotate(-60deg); opacity: .5 }
                   70% { transform: rotate(4deg); opacity: 1 } 85% { transform: rotate(-2deg) } 100% { transform: rotate(0) } }
@keyframes dot-in { 0%, 60% { transform: scale(0) } 80% { transform: scale(1.25) } 100% { transform: scale(1) } }
@keyframes arc-a-once { 0% { transform: rotate(60deg); opacity: .5 } 70% { transform: rotate(-4deg); opacity: 1 } 100% { transform: rotate(0) } }
@keyframes arc-b-once { 0% { transform: rotate(-60deg); opacity: .5 } 70% { transform: rotate(4deg); opacity: 1 } 100% { transform: rotate(0) } }
@keyframes dot-once   { 0%, 55% { transform: scale(0) } 80% { transform: scale(1.25) } 100% { transform: scale(1) } }

.mark .arc, .mark .dot { transform-origin: 48px 48px; transform-box: view-box; }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) {
  & .mark.joining .arc.a { animation: arc-a 1.8s var(--ease-mark) infinite; }
  & .mark.joining .arc.b { animation: arc-b 1.8s var(--ease-mark) infinite; }
  & .mark.joining .dot   { animation: dot-in 1.8s ease infinite; }
  & .mark.settle .arc.a  { animation: arc-a-once .8s var(--ease-arrive) both; }
  & .mark.settle .arc.b  { animation: arc-b-once .8s var(--ease-arrive) both; }
  & .mark.settle .dot    { animation: dot-once 1s var(--ease-arrive) both; }
} }
```

### 4.3 Drawing it so it moves

`print-export` found that page CSS cannot reach inside a `<use>` shadow tree: a `<use href="mark.svg#mark">`
cannot be animated by a `.mark.joining .arc` rule, and its colours only arrive through custom properties.
Two forms, therefore:

- **Resting marks** (rail brand after load, avatars, pills, tray, paper): `<use>` the symbol from
  `design/mark.svg`, coloured only through `--mark-disc / --mark-arc-a / --mark-arc-b / --mark-dot` on
  the `<use>`.
- **Moving marks** (loaders, the join line, the splash, the rail brand on a cold open, toasts): the symbol
  is inlined by the `Mark` component so the `.arc` and `.dot` rules apply. Same path data, same classes.

A single-file alternative worth one afternoon: `mark.svg` carries its own `<style>` with the keyframes
always declared, driven by inherited custom properties (`animation-duration: var(--mark-run, 0s);
animation-iteration-count: var(--mark-iter, 1); animation-fill-mode: both`). A 0 s duration with
`fill-mode: both` sits on the last keyframe, which is the closed ring, so an unset `--mark-run` *is* the
rest state and Calm never sets it. Verify in Safari before adopting; until then, inline.

### 4.4 Sizes and homes

| Size | Cut | Where | Plays |
|---|---|---|---|
| 160 / 120 | default, disc deepened to `#1C2230` | splash (desktop / mobile), on the one gradient | once, then loops only if sign-in is slow |
| 96 – 112 | default | loading screen, plain navy | loops |
| 54 | default | page-centre loader on a first join | (orbit, not the mark: see 5.2) |
| 40 | default | join line in the session stream | once |
| 30 – 32 | small cut | join line in a group chat, toasts | once |
| 24 | small cut | rail brand on a cold open | once; never on navigation |
| 20 and below | tiny cut, no disc | favicon, tray, 18 px widget head, inline waits | **no swing**: the closed mark fades in over `--t` (200 ms); waiting is the halo pulse (5.5) |

**Settled.** `mark-motion` drew the stream's join line at 48 px and `motion-spec` at 40 px; 40 px, because
it sits in a line with 34 px avatars. `welcome-agent` and `members-drawer` use 30 px in group chats, which
is the small cut and stays. Below 24 px the arcs are two or three pixels and a swing is a blur; `widgets`
adopts the disc variant under 24 with no swing.

**Exit from a loading loop:** finish the current loop's settle (at most 1 s), then the stream rises in.
Cutting mid-swing is the only way to make the mark look broken. (`mark-motion`)

**The rail brand on a cold open:** the 24 px small cut closes once in the brand row while the rail is
still empty; New session and the agent cards rise in (`card-in`, 36 ms stagger) as the centre lands, from
1.0 s; the page skeleton shimmers until the first session is folded. Only on a cold open and on a
reconnect after the rail was greyed. (`mark-motion`)

**The splash:** the mark at 160 px plays once; the wordmark rises (`card-in`, 500 ms) as the centre
appears, the italic tagline 200 ms after. Hand-off: centre in → wordmark → loading screen on plain navy.
The gradient here is the one gradient on the screen.

---

## 5. Loaders

One loader per wait, each a picture of something becoming one. A screen never shows two. Calm and
reduced motion freeze each at its finished frame and the copy carries the wait. (`loading-screens`,
`motion-spec`)

| Loader | Meaning | Where | Sizes | Loop | Calm frame |
|---|---|---|---|---|---|
| Arcs close | the app joins you | app launch, splash, a session connecting | 160 / 96 / 40 / 32 / 24 | 1.8 s · `--ease-mark` | closed ring with its centre |
| Orbit converge | you join people | the page centre while a session's history folds, first join only | 54 | 1.5 s · `--ease-move` | one apricot dot + "Joining…" |
| Weave | rows arrive | under a project title, the unite notice, the token chip's hairline | full width · 3 px; 42 px inline | 1.4 s slide · 0.7 s cross | one plain strand, full width |
| Shimmer | words arrive | inside the notice where a brief, gate summary or memory text will land; never a page | 12 px lines at 92 / 74 / 58 % | 1.5 s · `--ease-move` | flat `--surface-3` lines |
| Halo pulse | still with you | inline and toast waits at 18 – 32 px: reconnecting, a chat opening, "spending now" | 18 / 24 / 32 | 1.8 s · `--ease-move` | closed mark, no ring |

### 5.1 Arcs close

Trigger: the app opening ("Opening the circle."), a session connecting, the splash. Keyframes and timing
in section 4. Copy under it is one serif sentence; after 8 s a second line in `--ink-2` ("Still opening.
0.9.2"); after 30 s one chocolate action.

### 5.2 Orbit converge

Three dots in the three colours (apricot, chocolate, ink) orbit, meet at the centre at 60 %, part again.

**Settled (the judge's one fix for `loading-screens`).** Orbit converge plays only at the 54 px page
centre on a first join ("Joining Bo, Cy and Dee in Billing page · Checkout." with the folded count beneath).
The 18 px inline and toast uses (reconnecting, a chat opening) take the halo pulse instead, so no Henosis
wait is ever three small dots in a row, the ChatGPT / iMessage shape. This also answers `mark-motion`'s
open question: reconnecting does not loop the full swing; the swing is reserved for first loads and joins.

In dark the chocolate dot becomes `--apricot-deep` and the third dot is `--ink`, so all three stay visible
on the dark canvas. (`loading-screens`, `motion-spec`)

```css
@keyframes orbit-1 { 0% { transform: rotate(0deg)   translateX(11px) } 60% { transform: rotate(300deg) translateX(0) } 100% { transform: rotate(360deg) translateX(11px) } }
@keyframes orbit-2 { 0% { transform: rotate(120deg) translateX(11px) } 60% { transform: rotate(420deg) translateX(0) } 100% { transform: rotate(480deg) translateX(11px) } }
@keyframes orbit-3 { 0% { transform: rotate(240deg) translateX(11px) } 60% { transform: rotate(540deg) translateX(0) } 100% { transform: rotate(600deg) translateX(11px) } }
.loader.orbit { position: relative; width: 54px; height: 54px; }
.loader.orbit i { position: absolute; left: 22px; top: 22px; width: 10px; height: 10px; border-radius: 50%; }
.loader.orbit i:nth-child(1) { background: var(--apricot); }
.loader.orbit i:nth-child(2) { background: #56352D; }        /* brand constant, not --accent */
.loader.orbit i:nth-child(3) { background: var(--ink); }
:root[data-theme="dark"] .loader.orbit i:nth-child(2) { background: var(--apricot-deep); }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) {
  & .loader.orbit i:nth-child(1) { animation: orbit-1 1.5s var(--ease-move) -1.1s infinite; }
  & .loader.orbit i:nth-child(2) { animation: orbit-2 1.5s var(--ease-move) -1.1s infinite; }
  & .loader.orbit i:nth-child(3) { animation: orbit-3 1.5s var(--ease-move) -1.1s infinite; }
} }
/* rest: the three sit stacked at the centre; the Loader shows one dot and its label */
```

### 5.3 Weave

Two strands cross over and under as they travel. Trigger: a project opening ("Opening Payments. 3 of 5
sessions in" while the direction card is already readable and rows ride in), uniting a branch, and the
3 px hairline under the token chip while a turn is spending (`token-meter`: the hairline weave is the
only "spending now" motion; the chip's turning ring is gone, see 6.2).

**Settled.** The design tokens' `weave` (a gradient background sliding at 1.2 s) is retired for the app's
two-strand `weave-slide / weave-over / weave-under` (1.4 s slide, 0.7 s cross, second strand −0.7 s). The
strands are `--apricot-deep` and `--ink-2`: the hand does not run along a loader.

```css
@keyframes weave-slide { 0% { left: -34% } 100% { left: 100% } }
@keyframes weave-over  { 0%, 100% { top: 0 }   50% { top: 2px } }
@keyframes weave-under { 0%, 100% { top: 2px } 50% { top: 0 } }
.loader.weave { position: relative; display: block; width: 100%; height: 4px; overflow: hidden; border-radius: 2px; background: color-mix(in srgb, var(--apricot) 22%, transparent); }
.loader.weave i { position: absolute; width: 34%; height: 2px; border-radius: 1px; left: 0; top: 1px; }
.loader.weave i:nth-child(1) { background: var(--apricot-deep); }
.loader.weave i:nth-child(2) { background: var(--ink-2); left: 33%; }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) {
  & .loader.weave i:nth-child(1) { animation: weave-slide 1.4s linear infinite, weave-over .7s ease-in-out infinite; }
  & .loader.weave i:nth-child(2) { animation: weave-slide 1.4s linear -.7s infinite, weave-under .7s ease-in-out infinite; }
} }
/* rest: strand 1 at full width, strand 2 hidden */
:root[data-motion="calm"] .loader.weave i:nth-child(1) { width: 100%; }
:root[data-motion="calm"] .loader.weave i:nth-child(2) { display: none; }
@media (prefers-reduced-motion: reduce) { .loader.weave i:nth-child(1) { width: 100%; } .loader.weave i:nth-child(2) { display: none; } }
```

### 5.4 Shimmer

A soft apricot light passes over placeholder lines, only where the words will land: the brief, the gate
summary, a memory entry. Never a whole page. Trigger: text pending. 1.5 s, background-position
100 % → −20 %, `--ease-move`. Calm: flat `--surface-3` lines.

```css
@keyframes shimmer { 0% { background-position: 100% 0 } 100% { background-position: -20% 0 } }
.loader.shimmer i { display: block; height: 12px; border-radius: 6px;
  background: linear-gradient(90deg, var(--surface-3) 30%, var(--apricot-soft) 50%, var(--surface-3) 70%);
  background-size: 250% 100%; background-position: 100% 0; }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) .loader.shimmer i { animation: shimmer 1.5s var(--ease-move) infinite; } }
```

### 5.5 Halo pulse

The closed mark at 18 – 32 px breathes one apricot ring from its centre: the dot's own `dot-live` in the
pulse colour. Trigger: an inline or toast wait ("Reconnecting · Bo still has the baton.", a chat opening),
and "spending now" in the token chip. New in v6, from `loading-screens`' fix. Calm: the closed mark, no ring.

```css
@keyframes mark-halo { 0% { box-shadow: 0 0 0 0 var(--apricot-soft) } 70% { box-shadow: 0 0 0 6px transparent } 100% { box-shadow: 0 0 0 0 transparent } }
.mark.waiting { border-radius: 50%; }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) .mark.waiting { animation: mark-halo 1.8s var(--ease-move) infinite; } }
```

### 5.6 Copy for the waits

One sentence, present tense, names in serif, numbers in mono. The second line is only ever a count or,
after 8 s, a cause. After 30 s one chocolate action. (`loading-screens`)

| Wait | Line | After 8 s | After 30 s |
|---|---|---|---|
| App launch | Opening the circle. | Still opening. `0.9.2` | — |
| Connecting | Connecting to *Payments*. | The server is slow to answer. | Try again |
| Joining | Joining *Bo*, *Cy* and *Dee* in *Billing page · Checkout*. `1,204 of 2,310` | A long session; the count keeps moving. | Open the replay |
| Reconnecting | Reconnecting · *Bo* still has the baton. | Offline. Open the last brief? | Open the last brief |
| Project opening | Opening *Payments*. `3 of 5` sessions in | Two sessions are not answering. | — |
| Long operation | *Bo's agent* is uniting pdf-layout into main. About a minute. | Longer than expected · Watch tests | Watch tests |
| Failed | Could not join *Billing page · Checkout*. | — | Try again · Open the replay |

---

## 6. Side motion

Small things that happen once when something joins or changes, and the two things that breathe. Each
row: trigger · duration · easing · Calm. Keyframe names are the app's. (`motion-spec` index, amended)

### 6.1 Card rise · `card-in` · something arrives

An agent card entering the rail, a message, notice or plan card entering the stream, a drawer section
unfolding. 6 px up, from transparent. **320 ms · `--ease-arrive` · once.** Stagger `min(i, 8) × 36 ms` for a
list. Trigger: `.enter` on the first render of a row. **Settled:** the component drops `.enter` after the
first paint (`animationend`, or at once under Calm) so re-renders never replay the rise. Calm: in place,
fully opaque.

```css
@keyframes card-in { 0% { opacity: 0; transform: translateY(6px) } 100% { opacity: 1; transform: none } }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) {
  & .agent.enter, & .msg.enter, & .notice.enter, & .plan.enter { animation: card-in var(--t-slow) var(--ease-arrive) both; animation-delay: calc(min(var(--i, 0), 8) * 36ms); }
} }
```

### 6.2 Status pulse · `dot-live` · something lives

The dot of a running session breathes a soft ring outward: 0 → 5 px by 70 %, gone by 100 %. **1.8 s ·
`--ease-move` · loop.** Only Running moves; awaiting, blocked, paused and idle never pulse
(`badges-status`). The same keyframes in apricot carry the three "now" dots the wave added: the token
chip's spending dot (`token-meter`: a pulsing apricot dot replaces the turning ring, which read as a reload
control), the replay scrubber's NOW dot (`replay-scrubber`), and the "Keys live" chip (`keyboard-first`).
Calm: a solid dot. The dot carries hidden text ("running") so the state is never colour alone.

```css
@keyframes dot-live { 0% { box-shadow: 0 0 0 0 var(--dot-halo) } 70% { box-shadow: 0 0 0 5px transparent } 100% { box-shadow: 0 0 0 0 transparent } }
.status.running::before, .agent .head .dot.running { --dot-halo: var(--ok-soft); }
.dot.now, .chip.live .dot, .kbd-mode .dot { --dot-halo: var(--apricot-soft); background: var(--apricot-deep); }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) {
  & .status.running::before, & .agent .head .dot.running, & .dot.now, & .chip.live .dot { animation: dot-live 1.8s var(--ease-move) infinite; }
} }
```

### 6.3 Badge pop · `pop` · a count changes

The needs-you, inbox and approvals counts, the "+1" on a stack, the tab-bar count on the phone, the
"1 waits for you" chip when a gate scrolls out of view (`mobile-session`). Scale .4 → 1.15 at 60 % → 1.
**320 ms · `--ease-arrive` · once.** Trigger: the count mounts or its number changes; absent at zero; 99+
cap (`badges-status`). Stars on press take the same `pop` (micro-interactions' 1.12 at 360 ms folds into
it). Calm: the new number, no scale.

```css
@keyframes pop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.15); opacity: 1 } 100% { transform: none; opacity: 1 } }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) {
  & .pill.badge, & .count.changed, & .stars .on.picked { animation: pop var(--t-slow) var(--ease-arrive) both; }
} }
```

### 6.4 Avatar ripple · `ripple` · someone joins

The newcomer's avatar enters the presence stack as the mark's centre lands; one apricot ring grows 14 px
and fades. **900 ms · `--ease-leave` · once**, starting at +900 ms in the join timeline (section 7).
Trigger: `.avatar.joined`, set by the component for one second on a presence join (`ui.tsx` already keeps
`justJoined` for this). Also on a just-picked member in `new-group` and the just-added row in
`members-drawer`. Calm: the avatar appears in the stack; the toast carries the news.

```css
@keyframes ripple { 0% { box-shadow: 0 0 0 0 var(--apricot); opacity: 1 } 100% { box-shadow: 0 0 0 14px var(--apricot); opacity: 0 } }
.avatar { position: relative; }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) .avatar.joined::after {
  content: ""; position: absolute; inset: -2px; border-radius: inherit; pointer-events: none;
  animation: ripple .9s var(--ease-leave) both; } }
```

### 6.5 Check draw · `draw` · an approval is granted

The release gate reaches two ratings at 4+; the plan is approved; a rating lands. The check draws itself
from the stroke. **450 ms · `--ease-move` · once, 50 ms after the notice settles.** The dasharray equals the
path length (20 on the 16-grid icon; 40 on the 24 px Approve check). The check is the hand's colour on a
green disc: the only chocolate that moves. Calm and reduce: `stroke-dashoffset: 0`, the check is present
and whole. This is `accessibility`'s P0 fix and the reason section 3 has rest-state rules.

```css
@keyframes draw { to { stroke-dashoffset: 0 } }
.ic.draw path { stroke-dasharray: 20; stroke-dashoffset: 20; }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) .ic.draw path { animation: draw .45s var(--ease-move) .05s forwards; } }
:root[data-motion="calm"] .ic.draw path { stroke-dashoffset: 0; }
@media (prefers-reduced-motion: reduce) { .ic.draw path { stroke-dashoffset: 0; } }
```

### 6.6 Team pill crossfade · `word-in` + transition · a session becomes Team

Solo turns Team when Cy joins Bo on Checkout: the background crosses to apricot (`--t-slow`, `--ease-move`)
while the word rises 3 px in (`word-in`, `--t-slow`, `--ease-arrive`). Only on the first join; later joins
pop the avatar and ripple it. The composer's Agent ↔ Team segment uses the same pair: the thumb slides on
`--ease-mark` over `--t` while the placeholder and border crossfade, so a team message is apricot before
it is sent (`micro-interactions`). **Settled:** 320 ms, not `badges-status`' 240. Calm: instant swap.

```css
@keyframes word-in { 0% { opacity: 0; transform: translateY(3px) } 100% { opacity: 1; transform: none } }
.pill { transition: background var(--t-slow) var(--ease-move), color var(--t-slow) var(--ease-move), border-color var(--t-slow) var(--ease-move); }
.seg .thumb { transition: transform var(--t) var(--ease-mark); }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) .pill .w { animation: word-in var(--t-slow) var(--ease-arrive) both; } }
```

### 6.7 Toast rise · `toast-up` · something happened

Bottom-right, above the composer (bottom 112 px, right 24 px), newest at the bottom so it rises in;
14 px up from transparent. **320 ms in · `--ease-arrive`; 200 ms out · `--ease-leave`.** Trigger: unite,
export, copy, invite sent, a join in another session, a mention, a decision arriving.
(`notifications`, `motion-spec`)

- Decisions (approval, handoff, blocked) never time out; they carry `y` / `n`.
- News (mention, joined, done) drains over 8 s along a 2 px apricot life line at the bottom: a `width`
  transition, 8 s linear, `--apricot-deep` and paused on hover. On touch there is no pause, so news holds
  10 s.
- Three show; the rest fold into a navy tail that counts what waits in the inbox. The tail's count pops.
- The joined toast is the only toast with motion of its own: the 32 px mark settles once inside it.
- Calm: the toast appears and disappears; the drain line is gone; a toast holds at least 8 s and gains a
  Dismiss (`accessibility`). Under reduce, toasts never time out faster than 8 s.

```css
@keyframes toast-up { 0% { opacity: 0; transform: translateY(14px) } 100% { opacity: 1; transform: none } }
.toast .life { height: 2px; background: var(--apricot); width: 100%; transition: width 8s linear; }
.toast.news.draining .life { width: 0; }
.toast.news:hover .life { transition: none; background: var(--apricot-deep); }  /* paused: JS re-arms the clock */
:root[data-motion="calm"] .toast .life { display: none; }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) {
  & .toast { animation: toast-up var(--t-slow) var(--ease-arrive) both; }
  & .toast.leaving { animation: toast-up var(--t) var(--ease-leave) reverse both; }
} }
```

### 6.8 Send pressed · `pressed` · a directive leaves

On release the send button sinks to .92 (`--t`), then an apricot ring leaves it (0 → 10 px) as the message
takes its place in the stream with `card-in`. **450 ms · `--ease-leave` · once.** Trigger: `.send.pressed`
for one send, set by the component. Calm: nothing; the message appears.

```css
@keyframes pressed { 0% { box-shadow: 0 0 0 0 var(--apricot-soft) } 100% { box-shadow: 0 0 0 10px transparent } }
.send:active { transform: scale(.92); }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) .send.pressed { animation: pressed .45s var(--ease-leave) both; } }
```

### 6.9 Hero fade · `fade-in` · the overview opens

The one gradient on the manager overview or a project hero fades in; nothing else on that page animates
on load. **500 ms · `--ease-arrive` · once.** Calm: present.

### 6.10 Team colours · registered properties · entering a team

The route enters Payments and `--team-accent`, `--team-highlight`, `--team-surface`, `--team-glow` cross
over **500 ms · `--ease-move`**, one transition on `:root`. Calm: instant. Open: every element reading the
team properties repaints for 500 ms; measure on the fleet board before keeping it on the manager pages.

### 6.11 Budget fill · transition `width` · tokens are spent

The meter's width eases to the new figure as a step records its tokens. **300 ms · `ease`.** The live
gradient does not scroll (**settled:** the v5 `--gradient-live` 200 % background-size is dropped); the only
"spending now" motion is the hairline weave and the chip's pulsing dot (6.2). Colour arrives only when the
budget turns: amber from 80 %, red past 100 % (`token-meter`). Calm: jumps to the new width.

### 6.12 Ring draw · `ring-draw` · the invite is accepted

Kept, with one home. **Settled** (`motion-spec`'s open question): `ring-draw` (dashoffset 176 → 0,
**900 ms · `--ease-arrive`**) draws the five-segment progress ring in the corner of a tour coach mark and
the onboarding steps as each closes (`tour`, `onboarding`); the ghost centre stays dashed until the last
step, when `dot-once` pops it and the toast says "Dee is in the circle." Calm: full ring, dot present.

---

## 7. Joined the circle

The join is a line in the stream, not a modal. Everything is timed from the join event in the fold; the
same line serves a person, an agent or a session, in the stream, in a group chat and in a toast.
(`motion-spec` timeline, `mark-motion` homes, `welcome-agent`, `members-drawer`, `new-group`)

### 7.1 Anatomy

A 40 px mark (30 in a group chat, 32 in a toast) · a serif sentence with the name in chocolate · a second
line in `--ink-3` with how and how many · the presence stack on the right with the newcomer last.

> **Ana joins the circle.** From the invite link · 4 here · Bo has the baton
> **Dee's agent joins the circle.** Crew Invoice rollout · Team with Dee · shares this plan's context
> **Checkout, Ana's agent, joins the circle.** (in #billing, with the arrival card beneath)
> *Cy left the circle · 09:47* (a quiet divider, no motion: the ring does not open again)

### 7.2 Timeline · "Ana joins the circle." · 1.9 s

| From | To | What | Keyframes |
|---|---|---|---|
| 0 | 320 ms | the join line rises | `card-in` · `--ease-arrive` |
| 0 | 800 ms | the arcs settle, once | `arc-a-once` / `arc-b-once` · `--ease-arrive` |
| 550 | 1 000 ms | the centre lands (held to 55 %, 1.25× at 80 %) | `dot-once` · `--ease-arrive` |
| 900 | 1 800 ms | Ana's avatar ripples into the stack | `ripple` · `--ease-leave` |
| 1 000 | 1 320 ms | "4 here" pops; the needs-you count if it changed | `pop` · `--ease-arrive` |
| 1 000 | loop | her agent's status dot starts to breathe | `dot-live` |
| 1 100 | 1 420 ms | the Team pill crosses (first join only) | `word-in` + transition |

Nothing overlaps the mark's swing except its own line. The avatar ripples as the dot lands, never before:
the centre is the work they now share, and the ripple is the circle noticing. If a loader is already
playing on the screen (one moving mark per screen), the join line shows the closed ring and only the avatar
ripples.

### 7.3 The same moment elsewhere

- **Toast in another session** (`notifications`, `mark-motion`): `toast-up` at 0; the 32 px mark settles
  inside it on the same clock; "Ana joins the circle · Billing page · Checkout · as observer · View".
  It never becomes a native banner; the Team panel ripples instead.
- **Group chat** (`welcome-agent`, `members-drawer`, `new-group`): the 30 px mark, the sentence with the
  agent's name in chocolate, mono time; the just-joined row on apricot wash with the avatar ripple; the
  toast "Tax lines joins the circle. Undo". The Changes ledger carries the mark for joins and a minus
  ring for leaves.
- **Rail** (`welcome-agent`): the new agent's card rises in on `--rail-active` with "Ana · just joined · 0".
- **Onboarding** (`onboarding`, `tour`): the big mark's dashed ghost centre becomes the apricot dot the
  moment the session opens (`dot-once`), and the same join line plays in the stream. The arrival belongs
  to the stream; the onboarding page does not play it twice.
- **Mobile** (`mobile-rail`): the same line at 30 px in the Team sheet.

### 7.4 Leaving

A quiet divider, no motion. The ring does not open again. Presence dims to 45 % with "as of HH:MM" when
the server is gone (`error-states`); the mark loses its centre to a dashed ghost only when the circle
cannot be seen.

---

## 8. The centre (formerly "the bead")

The word is **centre**. "Bead" belongs to the older ring-and-bead mark the founder retired; `app-icons`
used it 31 times and the brand panel asked for it gone. The v5 token names `--mark-ring` and `--mark-bead`
are deleted in v6; the app's mark options `ring / bead / dot` are renamed **centre dot / emblem / dot
only** (`team-look-editor`). Nothing in Henosis travels around the ring: the old travelling-bead
animation is not a Henosis motion and must not come back as a loader.

What the centre does:

- **It appears only after the ring is one.** `dot-in` holds at scale 0 until 60 % (the arcs are within 4°
  by then), pops to 1.25× at 80 % and settles at 100 %. A ring with no centre is a loader; a centre with
  no ring is a bullet. (`mark-motion`)
- **It is the lightest colour present**: apricot on navy, cream and chocolate; the agent's arc shares its
  hue on the dark canvas rather than drifting to terracotta (`illustration`'s fix).
- **It pops once at a join and never again.** Resting marks are the closed ring with the centre present,
  the end frame, never a frame from the middle.
- **Waiting is the halo pulse** (5.5): the centre breathes an apricot ring at 18 – 32 px for reconnecting
  and inline waits. The ring never reopens to say "waiting".
- **A dashed ghost centre** means not yet in the circle, or the circle cannot be seen (`onboarding`,
  `tour`, `error-states`); it is drawn as a symbol variant, not animated, except for the one `dot-once`
  when it becomes real.
- **The emblem is a crest at 48 px and up; below that the centre is the dot** (`team-emblems`' fix), so a
  team in the shell is identified by its two arc colours, and the team's accents recolour glows and
  selection, never the brand mark's arcs.
- **The pending count sits off the disc** (`badges-status`): the disc already owns an apricot dot, so the
  tray's solid-apricot count sits beside it, and pops on change.

---

## 9. Transitions · hover, press, focus, toggle, select, drag

From `micro-interactions` (the index) with `motion-spec`'s table. None longer than 320 ms; none on
layout; every one reads the clock tokens, so Calm zeroes them.

| Verb | Control | Property | Clock · curve | Calm |
|---|---|---|---|---|
| hover | button | `box-shadow` soft; primary → `--accent-hover` | 120 · move | instant |
| hover | rail item, agent card | `background` → `--rail-2`; chevron opacity | 120 · move | instant |
| hover | tool line | row `--surface-2`; actions opacity + 4 px slide | 120 · move | actions always at 60 % |
| hover | link, name peek | underline `scaleX` from the left; peek card opacity + 4 px | 120 · 200 · move | underline on; peek instant |
| hover | plan estimate, meter tip | estimate crossfades to actual; tip opacity + 3 px | 120 · move | both values shown |
| hover | collapsed-rail card (`desktop-compact`) | rises 4 px beside the stream, never over the live message | **400 ms rest**, then 200 · arrive | instant after the rest |
| press | button, chip | `translateY(1px) scale(.99)` (chip `.97`), shadow off | 200 · move | no sink |
| press | send | `scale(.92)`, then the ring (6.8) and the message rise | 200 · 450 | message in place |
| press | Approve | the check draws (6.5) | 450 · move | check whole |
| press | star | fill, then `pop` | 120 · 320 | fill only |
| press | long press (touch) | conic ring 0 → 100 % | 400 linear, off the clocks: a platform expectation | ring hidden |
| focus | field, button, star, switch, chip | 2 px `--accent` outline, offset 2; `--team-glow` halo outside it; `--ink` ring in dark | outline instant; halo 120 · move | instant |
| focus | composer | `focus-within`: `--shadow-pop` + the halo | 120 · move | instant |
| focus | list row (`j` / `k`) | inset 1 px apricot-deep ring, 55 % wash, 3 px gutter stripe, keys appear | 120 · move | instant |
| toggle | segment, switch | thumb `translateX` on the mark's curve; the governed thing crossfades | 200 · mark | thumb jumps |
| toggle | checkbox | box fills apricot-deep; check draws 20 units | 200 · 450 | check whole |
| toggle | disclosure | chevron `rotate(90deg)`; body `card-in` | 200 · 320 | no rise |
| toggle | theme | tokens swap | 0 | same |
| select | chip, row, option, replay moment | 30 % apricot wash; inset 1 px hairline or 3 px edge | 120 · move | instant |
| select | multi-select bar | navy bar rises 8 px | 320 · arrive | in place |
| select | text | `::selection` apricot | 0 | same |
| drag | scrubber, slider, divider | handle ×1.25 + halo; the value follows with no easing | 0 held · 120 release | no scale |
| drag | reorder | lift ×1.02 + `--shadow-pop` + halo; dashed apricot slot; neighbours slide | 200 lift · 320 settle · mark | no lift, slot stays |
| drag | drop a file | dashed line apricot-deep + wash; chip pops | 120 · 320 | chip whole |

**Settled.** Focus is a ring, not a glow: the 35 % apricot glow measured ≈1.2 : 1 on cream
(`accessibility`); the ring is 2 px `--accent` with `outline-offset: 2px` and the apricot halo kept outside
it, and in dark a 2 px `--ink` (cream) ring so focus never borrows the pulse colour that selection owns. The
team-look editor recolours the halo, never the ring. **Settled.** Switches, checkboxes and diagrams fill
with `--apricot-deep`, not `--accent`: the hand stays a verb. **Settled.** Hover is `--surface-2` and
keyboard selection is apricot, so both can show at once and never fight.

```css
:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; border-radius: 6px; box-shadow: 0 0 0 5px var(--focus-halo); transition: box-shadow var(--t-fast) var(--ease-move); }
:root { --focus-ring: var(--accent); --focus-halo: var(--team-glow-soft, var(--apricot-soft)); }
:root[data-theme="dark"] { --focus-ring: var(--ink); }
.btn { transition: background var(--t-fast) var(--ease-move), box-shadow var(--t-fast) var(--ease-move), transform var(--t) var(--ease-move); }
.btn:active { transform: translateY(1px) scale(.99); }
.seg .thumb, .switch .thumb { transition: transform var(--t) var(--ease-mark); }
.lifted { transform: scale(1.02); box-shadow: var(--shadow-pop), var(--team-glow); transition: transform var(--t) var(--ease-mark), box-shadow var(--t) var(--ease-move); }
.lifted.settling { transition-duration: var(--t-slow); }
```

---

## 10. Layers, sheets and the look-here dim

- **The look-here layer** (`tour`, first approval, the palette's "show me"): a navy dim at 52 % (near-black
  62 % in dark) fades in over `--t-slow`; one target lit with a 3 px apricot ring plus a 10 px soft halo; the
  coach mark rises with `card-in`; the stream scrolls the target into view *before* the mark rises. An
  arriving approval ends the tour (ring closes, dim lifts over `--t`, the approval card takes the halo; the
  tour reopens from Settings). The dim is `aria-hidden` and focus-trapped; nothing under it is live.
- **Overlays** (`command-palette`, `search`, `shortcuts`): surface rises 6 px with `card-in`; scrim fades
  over `--t`; no blur. Rows highlight instantly; `↵` only on the highlighted row.
- **Bottom sheets** on the phone (`mobile-approvals`, `mobile-rail`): rise from the bottom edge over
  `--t-slow` on `--ease-arrive`; scrim `rgba(42,50,68,.46)` (black 58 % in dark) fades over `--t`; while the
  finger drags, the sheet follows with no easing; on release it settles to the nearer detent over
  `--t-slow` on `--ease-mark`. The rail drawer slides 332 px the same way.
- **Breakpoints** (`desktop-compact`): the rail folds to 72 at 1180 and the drawer overlays at 720 with a
  `--t` width transition and 40 px hysteresis; `[` `]` pin the choice so the frame does not breathe while
  a window is resized.

---

## 11. Accessibility

What is left on screen when the motion is gone, and what a screen reader hears when it plays.
(`accessibility`, `motion-spec`)

**Rest states.** Each animation needs a rest state that still carries the meaning.

| Motion | Rest state |
|---|---|
| Arcs close | the closed ring, centre present |
| Orbit converge | one apricot dot and the word "Joining…" (the Loader's `role="status"` label) |
| Weave | one plain strand beside "Opening Payments · 3 of 5" / "Reconnecting…" |
| Shimmer | flat `--surface-3` lines |
| Halo pulse | the closed mark; the toast's sentence carries the wait |
| Status pulse | a solid dot with its hidden "running" text |
| Check draw | the check, whole: `stroke-dashoffset: 0` under both guards |
| Card rise, badge pop | in place, the new number |
| Avatar ripple | the avatar in the stack; the toast carries the news |
| Toast rise | appears in place; holds at least 8 s; gains Dismiss |
| Team pill, team colours | instant swap |

**Rules.**

1. One switch. `prefers-reduced-motion` and `data-motion="calm"` share the guard in section 3;
   `motionNow()` in `theme.ts` reads both; `useMotion()` is what components time against.
2. State in words beside every colour. Hidden text inside the status dot ("running"); one sentence on the
   presence stack ("Bo, Ana and Dee are here. Bo is driving."); `role="meter"` with `aria-valuetext` on
   budgets; the send button named after the toggle; stars as one `radiogroup` with roving tabindex.
3. The mark is decoration except in the brand. `aria-hidden` on every copy but the rail's "Henosis"; the
   loader's name is its label ("Joining…"), never a description of the arcs.
4. Joins, approvals and gates announce once through the existing polite toasts region
   (`ui.tsx` `.toasts[role=status][aria-live=polite]`), in the product voice: "Ana joins the circle.",
   "Release gate: Bo's agent asks to run stripe prorations apply. Needs two ratings at 4 or above."
   Never re-announce on re-render.
5. Nothing flashes. The fastest loop is the weave's 0.7 s cross (1.4 Hz); the pulses are 1.8 s. No
   animation exceeds 3 Hz, and none covers more than a 54 px loader or a 14 px ripple.
6. Approvals never live only in a toast; a decision toast never times out; under reduced motion a news
   toast holds 8 s and shows Dismiss.
7. The focus ring is feedback, not motion: it appears without its ease and is never hidden by Calm.
8. Irreversible actions from another session take two presses (`keyboard-first`): the first lights the
   card (apricot ring, `.kbd.live`), the second sends; no animation is the confirmation.
9. Touch has no hover: the press is the hover, and the long-press ring (400 ms) is the only motion with a
   clock of its own.

---

## 12. The v6 patch · `design/henosis/tokens.css`

Diffable. Removes the v5 drift (`pulse`, `orbit` / `converge`, the gradient `weave`, `rise`, the blanket
`animation: none`) and lands the app's vocabulary plus the three additions this document makes
(`--ease-mark`, `mark-halo`, the ±60° start).

```css
/* clocks and curves */
--t-fast: 120ms; --t: 200ms; --t-slow: 320ms;
--ease-arrive: cubic-bezier(.2,.7,.2,1); --ease-leave: cubic-bezier(.4,0,1,1);
--ease-move: cubic-bezier(.4,0,.2,1); --ease-mark: cubic-bezier(.3,.9,.3,1);
/* the mark: brand constants, never --accent; v5 --mark-ring / --mark-bead deleted */
--mark-disc: var(--rail); --mark-arc-a: #56352D; --mark-arc-b: #E2C4A6; --mark-dot: #E2C4A6;
/* focus: a ring with a halo, never the pulse */
--focus-ring: var(--accent); --focus-halo: var(--apricot-soft);   /* dark: --focus-ring: var(--ink) */
/* --gradient-live: deleted; the budget meter does not scroll */

/* keyframes: one vocabulary, the app's names */
@keyframes arc-a, arc-b, dot-in, arc-a-once, arc-b-once, dot-once      /* section 4, ±60° start */
@keyframes ring-draw                                                    /* 176 → 0, tour and onboarding */
@keyframes orbit-1, orbit-2, orbit-3                                    /* 54 px page centre only */
@keyframes weave-slide, weave-over, weave-under                         /* replaces weave */
@keyframes shimmer                                                      /* 100% → -20% */
@keyframes mark-halo                                                    /* new: inline and toast waits */
@keyframes dot-live                                                     /* replaces pulse */
@keyframes card-in                                                      /* replaces rise */
@keyframes pop, ripple, draw, toast-up, pressed, word-in, fade-in

/* the guard */
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) { … every animation … } }
:root[data-motion="calm"] { --t-fast: 0ms; --t: 0ms; --t-slow: 0ms; }
@media (prefers-reduced-motion: reduce) { :root { --t-fast: 0ms; --t: 0ms; --t-slow: 0ms; } }
:root[data-motion="calm"] .ic.draw path, :root[data-motion="calm"] .draw { stroke-dashoffset: 0; }
@media (prefers-reduced-motion: reduce) { .ic.draw path, .draw { stroke-dashoffset: 0; } }
/* removed: @media (prefers-reduced-motion: reduce) { * { animation: none !important } }
   removed: :root[data-motion="calm"] * { animation: none !important } */
```

Open, to verify before v6 ships:

- The `mark.svg`-internal animation driven by `--mark-run` (4.3): confirm the 0 s rest state in Safari.
- The team-colour crossfade's 500 ms repaint on the fleet board (6.10).
- Whether `apps/web/src/tokens.css` moves its hold from 12 / 68 / 84 % to 15 / 70 / 85 % and its start to
  ±60° in the same commit as the design tokens, so `mark-motion`'s storyboard stays true.
