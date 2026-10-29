# sig-baton-handoff · The baton (second pass)

The driver's ring is the baton. SYSTEM §12 already draws the driver as a 2 px apricot-deep ring around an
avatar and calls it "the baton"; this element makes the sentence literal. When Ana hands off, the ring
lifts off her avatar, opens into an arc, and rolls along a hairline lane that folds out of the composer,
one full turn per seat, the lane giving under its weight. It arrives beside Bo with a 7.0 % overshoot
that rolls back, and waits there open, breathing the halo, beside the two things Bo can press. **Take
the baton** rolls it the last of the turn onto him and closes it; a stitched thread from the agent
re-attaches to him; "Bo has the baton" rises in the stream. **Decline** raises a red stop at his edge;
the baton bumps it, squashes, and rolls home to Ana on a heavier spring with no overshoot, closing
around her again while the sentence says *Bo declined the baton · Ana still drives*. A refusal by rule
("Only Ana or an owner can hand off") has no motion at all; the hint carries the kernel's sentence.

This is the second pass at the element. The first (judge-signature-1, -2, -3: 8.25, 8.25, 8.25, "ship
after the lane learns to fold") asked for four things; all four are here: the lane folds to zero height
when no handoff is pending, so a Solo Tuesday pays nothing for it; the title row's meter and presence
stack own fixed flex slots, so the percentage never sits under an avatar; every avatar's initial takes
its colour from its fill (`--av-*-fg`), so dark never shows cream on a cream disc; and the agent is no
longer a tile at the far end with no ring: it sits at the lane's head, tethered to whoever drives by a
dotted thread, which is the answer to "is Checkout in the circle".

Files: `index.html` (self-contained: tokens inlined from `tokens.v5.css`, light and dark via
`prefers-color-scheme` and `[data-theme]`, every transition and animation inside the one guard with
`prefers-reduced-motion` and `[data-motion="calm"]`, Fraunces and Inter asked for first with the
Instrument and system faces as fallbacks, no external asset, no font fetched, no script loaded),
`light.png`, `dark.png` (1440 × 900, the baton offered to Bo, 32 s into the wait), `phone.png`
(390 × 844, the same frame), `declined.png` (the blocked state: the stop raised, the baton home).
The stills were shot with the fallback faces (Instrument Serif, Instrument Sans, JetBrains Mono);
Fraunces and Inter are not on this machine and the page fetches nothing. `?at=rest|offered|accepted|
declined|rule` opens a frame with no travel, `?play` runs the offer, `?calm` sets Calm; keys 1–5 drive
the demo while no field has focus; the spec pane (`data-inspector`, exploration only) has the same
buttons. Measured in Chromium: 0 console errors, 0 running animations under `reduce` and under Calm,
4 at full motion in the offered frame (the halo, the running dots), no horizontal scroll at 1440 or 390.

## What it is

| Part | What | Where |
|---|---|---|
| The fold | the composer's first row, `grid-template-rows: 0fr → 1fr` with opacity on `--t-slow` `--ease-mark`; zero height and no paint while nothing is pending. Folded, the composer's hint line carries the driver as an 18 px ringed avatar: "Ana is driving Checkout · Hand off to…" | the composer |
| The lane | one hairline (`--line`) inside the composer's surface. The agent's tile at the head (left) with its running dot; the people at a 120 px pitch from 104 px in, serif names beneath ("Bo · you"); nothing is a card | the fold |
| The thread | a stitched guide, `linear-gradient(90deg, var(--baton) 0 2px, transparent 2px) / 6px 1px`, from the agent's edge to the driver's edge, clipped with `clip-path: inset()`, so it re-attaches to the new driver on `--t-slow` | the lane |
| The baton | a 48 px SVG `<circle r="19.1" pathLength="1">`, stroke 2, `--apricot-deep` by day and apricot at night: at rest, exactly the driver ring outside the avatar's 2 px edge. The lane's avatars never carry their own `.driver` box-shadow; the ring is one object and it travels (motion-choreography §4: "no second spinner is ever created") | the lane |
| Lift | `stroke-dasharray` `1 0 → .62 .38`, stroke 2 → 2.6, the carrier rises 6 px and takes a drop-shadow; 220 ms on the lift spring. The dash offset is set while the ring is still closed (invisible then) so the gap will face the receiver when the roll ends | leaving the driver |
| Roll | the carrier's `translate` and the baton's `rotate` ride the same spring, so the overshoot rolls back as it should: angle = distance ÷ 19.1 px, **one seat is one turn** (120 px = 2π·19.1). The offer stops 36 px short of the receiver (252°); Take rolls the last 108°. A `sag` keyframe takes the carrier 0 → +2.5 → −1 → 0 px while a 96 px dip (a surface-coloured stroke erasing the track, a quadratic redrawing it 8 px lower) rides under the baton | between two seats |
| Offered | the open arc, 6 px up, gap toward the receiver, the halo breathing 2 → 16 px on 1.8 s (MOTION §5.5: waiting is the halo pulse; the ring never re-opens to say "waiting"); the sentence names who, a mono clock counts the wait; Take is the one chocolate button, Decline a ghost in `--danger-ink` | beside the person offered |
| Taken | translate, rotate, the 6 px drop and `stroke-dasharray → 1 0` all on the close spring (340 ms, 1.4 % over); the avatar pops 1.1 and ripples once; the thread re-clips; the topbar stack's ring moves; "Bo has the baton · 09:46" rises as a divider; after 2.4 s the lane folds | the new driver |
| Declined | a 2 × 24 px `--danger` stop scales up at the receiver's near edge (200 ms, `--ease-arrive`); the baton bumps (`scale .84 1.1`, −4 px, 160 ms, `--ease-leave`, origin at its leading edge); the carrier takes the return spring home (790 ms, ζ .969, no overshoot) with its dip, drops and closes. Red only for a human no (SYSTEM §2.7); "declined the baton" is `--danger-ink`, the rest ink. The stop stays until the lane folds (2.6 s) | the lane |
| Refused by rule | the kernel's `unauthorized` ("only the driver or an owner can hand off") becomes the hint: "Only Ana or an owner can hand off. The baton stays where it is." The lane does not unfold: a refusal by rule has no motion, a refusal by a person has the stop | the hint |
| Calm | no transitions: the ring appears around the new driver and the sentence carries the news; Offered still shows the open arc beside Bo and the two buttons; the halo is still | everywhere |
| Phone | the lane at the thumb across the composer with 30 px avatars at an 84 px pitch (267° a seat), Take and Decline full-width under the sentence, the clock hidden; the sentence is the navy titlebar at 23 px serif with the stack beneath it | 390 |

## The springs

Four damped springs, each sampled once into a CSS `linear()` easing (41 stops, the run cut where the
response stays within 0.4 % of the target, rounded up to 10 ms), so every device lands on the same frame.
From rest, `x(t) = 1 − e^(−ζω₀t)·(cos ω_d t + (ζω₀ / ω_d)·sin ω_d t)`, `ω₀ = √(k/m)`, `ζ = c / 2√(km)`,
`ω_d = ω₀√(1 − ζ²)`. The generator is twelve lines of JS at the bottom of the page; it also draws the four
plots in the spec pane, so the tokens and the pictures cannot drift.

| spring | m · k · c | ζ | ω₀ | overshoot | run | drives |
|---|---|---|---|---|---|---|
| travel | 1.2 · 180 · 19 | .646 | 12.25 rad/s | 7.0 % | 730 ms | the carrier's `translate` and the baton's `rotate` on the offer |
| return | 1.5 · 120 · 26 | .969 | 8.94 | none | 790 ms | the same two properties home after a decline: heavier, tired |
| close | 1 · 500 · 36 | .805 | 22.36 | 1.4 % | 340 ms | the last 36 px of the turn, the 6 px drop and `stroke-dasharray` as the ring closes |
| lift | 1 · 700 · 48 | .907 | 26.46 | 0.1 % | 220 ms | the 6 px rise and the ring opening |

Plus three keyed clocks: the stop at 200 ms on `--ease-arrive`, the bump at 160 ms on `--ease-leave`,
and the waiting halo at 1.8 s, the status pulse's clock. Colour and opacity never spring (Material 3's
spatial/effects split, motion-choreography): the dip and the shadow fade on `--t`, `--ease-move`.

```css
--d-travel: 730ms; --spring-travel: linear(0, 0.023, 0.082, 0.166, 0.265, 0.371, 0.477, 0.58, 0.674, 0.76, 0.834, 0.896, 0.948, 0.989, 1.02, 1.042, 1.057, 1.066, 1.07, 1.069, 1.066, 1.061, 1.054, 1.047, 1.04, 1.032, 1.025, 1.019, 1.014, 1.009, 1.005, 1.002, 0.999, 0.998, 0.996, 0.996, 0.995, 0.995, 0.995, 0.996, 1);
--d-return: 790ms; --spring-return: linear(0, 0.014, 0.05, 0.1, 0.16, 0.224, 0.291, 0.356, 0.42, 0.48, 0.537, 0.589, 0.638, 0.681, 0.721, 0.756, 0.787, 0.815, 0.84, 0.862, 0.881, 0.898, 0.912, 0.925, 0.936, 0.945, 0.954, 0.961, 0.967, 0.972, 0.976, 0.98, 0.983, 0.986, 0.988, 0.99, 0.992, 0.993, 0.994, 0.995, 1);
--d-close: 340ms;  --spring-close: linear(0, 0.016, 0.059, 0.119, 0.191, 0.269, 0.349, 0.429, 0.505, 0.576, 0.642, 0.701, 0.754, 0.801, 0.842, 0.876, 0.906, 0.93, 0.951, 0.967, 0.98, 0.991, 0.999, 1.004, 1.009, 1.011, 1.013, 1.014, 1.014, 1.014, 1.013, 1.012, 1.011, 1.01, 1.009, 1.008, 1.007, 1.006, 1.005, 1.004, 1);
--d-lift: 220ms;   --spring-lift: linear(0, 0.01, 0.036, 0.073, 0.12, 0.171, 0.227, 0.283, 0.34, 0.396, 0.45, 0.502, 0.551, 0.597, 0.64, 0.68, 0.716, 0.749, 0.779, 0.807, 0.831, 0.853, 0.873, 0.89, 0.906, 0.919, 0.931, 0.942, 0.951, 0.959, 0.965, 0.971, 0.976, 0.981, 0.984, 0.987, 0.99, 0.992, 0.994, 0.996, 1);
--d-stop: 200ms; --d-bump: 160ms;
```

## Why it is ours

- **It is the mark's grammar on a person.** The brand is two arcs that close into one ring around one
  centre (BRIEF). The baton is a ring that opens into an arc to leave someone and closes into a ring to
  arrive at someone: the open arc means "not yet in the circle" (SYSTEM §5's `.mark.apart`), the closed
  ring means "it is yours". The halo while it waits is MOTION §5.5's own wait; the pop and ripple on Take
  are the join timeline's (MOTION §7). Nothing travels *around* the ring (MOTION §8 bans the old
  travelling bead); the ring itself travels, along a line, between people.
- **The ring the system already calls the baton.** SYSTEM §12 names the 2 px apricot-deep driver ring
  "the baton"; the presence stack, the rail card and the drawer all draw it. This element adds no stick,
  flag or crown: it makes that ring the thing that is handed, and every other copy follows it (the topbar
  stack recolours on Take). motion-choreography's "Turning Ring Focus" (generative-visuals §7) wanted
  a ring passed around the table as colour circulating; this is the ring passed as an object, on a line.
- **One seat is one turn.** The pitch is the ring's circumference, so the geometry is a rule you can say:
  a handoff to the next person is one revolution; the offer is 70 % of it, the taking is the last 30 %.
  Overshoot is then a visible 25° over-roll that comes back. The rule is stated once in the tokens
  (`--pitch: 120px; --r: 19.1`) and the JS reads it; nothing is hand-placed.
- **Weight is honest about what a handoff is.** Driving a session is responsibility; the baton is heavy.
  The sag, the dip in the lane, the 7.0 % overshoot and the slow settle say "something with mass changed
  hands" (motion-choreography: springs chosen for how they settle; Material's spatial spring allowed to
  overshoot, effects springs never; Kowalski's "a truck takes longer to stop than a bicycle"). The return
  after a refusal is heavier and does not bounce: it comes home tired.
- **Refusal has a shape, and it is a human no.** The stop is the only red on the lane, and only a person
  raises it (SYSTEM §2.7: red only for a human no or a conflict). The kernel's two refusals are two
  drawings: a decline bumps the baton back; a rule refusal has no motion, just the rule in the hint
  (MOTION principle 1: motion means joining or living; a rule is neither).
- **The composer is where the hand acts, and only while a hand acts.** The lane lives on the composer,
  not in a notice or a modal: the people you can hand to are the people who can hear what you type, and
  Take sits in the surface the send button sits in (ai-interfaces-avoid §2, the composer as the ledger's
  bottom rule with visible recipients; presence-and-agents §7, the steer line: "you never stop a
  colleague, you tell them"). Folded, it is a sentence in the hint. The composer stays one field and one
  bar for every message that is not a handoff (the judges' cost: "the composer is now three rows").
- **The agent is in the room, at the head of the lane, on a thread.** presence-and-agents: "do not build
  an agent panel, put the agent in the room"; generative-visuals §6, stitched guides: "the seam is
  stitched, not walled". The dotted thread from Checkout to the driver is the only line on the lane that
  is apricot, and it says who is steering without a ring on the agent (SYSTEM §12: the ring is a person's
  state; the agent's liveness is its dot).
- **Hairline, not box; one accent spent on one object** (premium-product-ui §1, three-colour-brands:
  "spend apricot on one object"). The lane is a hairline, the avatars sit on it without a card, and the only
  apricot on the composer is the baton, its halo and its thread. Named things are serif, the clock and the
  spring table are mono, the sentence is sans (SYSTEM principle 6; editorial-type §7 for the tabular
  clock that never jiggles).
- **Deterministic springs** (MOTION §2: "overshoot is never a spring … so the mark lands identically on
  every device"). The physics is the memo's, the delivery is MOTION's: a spring sampled into `linear()` is a
  keyed curve, and Calm and reduce get the end frame for free because the guard owns every transition.
- **Not the others.** No bubble, no sparkle, no purple, no thinking dots (ai-interfaces-avoid). Nothing here
  is a chat shape; the lane reads as a tightrope, the baton as a ring with mass, and the colours are the
  three plus cream. Linear passes nothing between people; Claude and ChatGPT have no second person.

## The technique

- `translate`, `rotate` and `scale` as individual CSS properties on four nested elements (carrier → sag →
  lift → baton), each with its own easing: the carrier travels, the sag dips, the lift rises, the baton rolls
  and bumps. Nothing animates layout except the fold, which is `grid-template-rows` on a row that is
  otherwise idle, and runs once per handoff.
- The carrier owns `--d` and `--e` by `data-spring="travel|return|close|none"`; its children read them, so
  one attribute swaps the physics for everything that moves together.
- Seat positions are measured once (`getBoundingClientRect` on each `.seat .avatar`) and written to `--bx`
  on the carrier, so any layout (desktop pitch, phone pitch, a fifth person) works without CSS math; the
  stop's `--sx` is the receiver's near edge minus 7; the thread's `--tl` / `--tr` are the agent's and the
  driver's edges.
- The rolling angle accumulates in JS (`rot += dx · 180 / (π·r)`) so a return rolls backwards; the dash
  offset is chosen at lift (`d = (1 + a)/2 + R_end/360 − θ/360`) so the gap faces the receiver on arrival.
- The lane dip is two SVG paths in a 96 × 16 box riding the carrier: a 3 px surface-coloured straight
  stroke erases the track and the thread, a 1 px quadratic redraws the hairline 8 px lower. Opacity only.
- The stream pins to now with a `ResizeObserver` on the scroll pane, so the composer unfolding never hides
  the last message; a reader who scrolled back is left where they are.
- The six frames and the four plots in the spec pane are drawn by two small functions from the same
  geometry and the same generator, so the specimen and the live element cannot drift.
- Timing logic waits on the clock tokens through `wait(ms)`, which returns at once when `--motion` is not 1
  (MOTION §3: never wait on `animationend` without checking `useMotion()`); every sequence carries a run
  id so a key pressed mid-roll cancels cleanly.

## The cost

- Runtime: one compositor layer for the carrier (`will-change: translate`), the halo's `stroke-width`
  on a 48 px circle, and the drop-shadow filter on the baton only while it is up (~0.2 ms a frame on a
  48 px raster). The dip is two paths. No blur over the canvas, no per-frame script: the state machine
  sets properties and waits.
- CSS: ~90 lines for the fold, lane, thread and baton plus four `linear()` strings (~1.4 KB); the guard
  block adds twelve rules. JS: ~130 lines of state machine. The spec pane and its drawers are
  exploration-only.
- `linear()` easing needs Chrome 113, Safari 17.2, Firefox 112; below that the browser falls back to the
  default `ease` and the baton still arrives, just without the overshoot. No polyfill. `clip-path: inset()`
  and individual transform properties are in every current engine.
- Accessibility: the lane is `role="group"` named "The baton"; the sentence is a polite live region; state
  is in words beside every colour (the stop has "declined", the halo has "offers you", the thread has the
  hint's sentence); the presence stack's label names the driver; keys never fire inside a field; Decline
  keeps its ghost shape so the primary stays the hand; the focus ring is chocolate by day and cream by
  night (SYSTEM §2.8). Calm and reduce: 0 animations, every end state kept.

## How it ports into apps/web

- **`apps/web/src/stream/Composer.tsx`**: a `<BatonLane>` as the form's first child, above `.field`
  (line 136), fed `s.participants`, `presence`, `s.driver`, `agentName`, the pending `Handoff` addressed to
  or from `me` (`Object.values(s.handoffs).find(h => h.status === "pending" && (h.to === me.id || h.from
  === me.id))`) and `client`. The form takes `open` while that handoff exists (plus 2.4 s after it
  settles) so the fold plays; the hint line (`.composer-wrap .hint`, styles.css 1342) gains the folded
  sentence with the 18 px ringed avatar and "Hand off to…" for the driver or an owner.
- **`apps/web/src/stream/Message.tsx`** lines 187–211: the `showHandoff` `.notice.handoff` block goes;
  its Accept and Decline move into the lane's sentence row and send the same `handoff.accept` /
  `handoff.decline` messages (protocol `index.ts` 698–699). The notice can stay one release behind
  `showHandoff` for the inbox and the phone's approvals list, then go; `.notice.handoff::before`
  (styles.css 1127) is then read only by the inbox card.
- **`apps/web/src/ui.tsx`**: a `Baton` component (carrier, sag, lift, SVG) beside `Avatar` (line 700);
  `Avatar` learns `ringless` so the lane's seats drop their own `.driver` shadow while `Stack` (line 790)
  and the drawer keep it; `Avatar` also takes its initial colour from the fill (`--av-fg`), which closes
  the dark-avatar defect the panel found on three pages at once.
- **`apps/web/src/tokens.css`**: `--spring-travel / -return / -close / -lift` and `--d-*` under the clocks
  (line 174, beside `--t-fast / --t / --t-slow`); the `sag`, `baton-halo`, `bump` keyframes beside `pop`
  and `ripple`; every animation and transition rule inside the existing guard block (line 720), the
  zeroed clocks in the calm and reduce blocks. `--baton: var(--apricot-deep)` is an alias, not a colour.
- **`apps/web/src/styles.css`**: `.fold`, `.lane`, `.track`, `.thread`, `.seat`, `.stop`, `.carrier`,
  `.sag`, `.lift`, `.baton`, `.dip`, `.handline` next to `.composer-wrap` (line 1338); the topbar's
  `.tokens` and `.stack` get `flex: none` with a 12 px gap (the panel's cross-cutting fix, once).
- **State machine** in `BatonLane`: derive `state` from kernel events, never from clicks. A new `pending`
  handoff → `lift`, `travel`, `offered`; `pending → accepted` → `close`, then rest with the new driver;
  `pending → declined` → `stop`, `bump`, `return`, `close`. The component keeps the last seen
  `handoffId + status` in a ref and reads `useMotion()` (theme.ts 216) to skip the waits under Calm.
  Replay (`?at` here) is the scrubber's `past`: the lane renders the state at that event with no travel.
- **Kernel**: `requestHandoff` (session.ts 368) already throws `unauthorized` "only the driver or an
  owner can hand off"; the client maps that code to the hint's sentence (`copy.ts`, add
  `baton.onlyDriver`). Recall has no event today: the offerer can only wait. Either add
  `handoff.withdrawn` to `packages/protocol/src/index.ts` beside `handoff.declined` (546) and a
  `withdrawHandoff` to session.ts, or render "Take it back" only when the kernel grows it (judge-2's
  verdict: ship without it).
- **copy.ts**: `stream.baton`, `offersYou`, `accept`, `decline`, `hasTheBaton`, `declined` exist
  (473–484). Add `baton.youHave` ("You have the baton · steering {agent}."), `baton.handingOff`
  ("{who} is handing off…"), `baton.stillDrives` ("{who} still drives."), `baton.driving` ("{who} is
  driving {agent}."), `baton.handOffTo` ("Hand off to…"), `baton.onlyDriver` ("Only {who} or an owner can
  hand off. The baton stays where it is."), and rename the button to "Take the baton".

## Open questions

- Six or more people: the lane needs a stack past four seats and the baton would travel to the stack's
  edge; the thread would still reach the driver. Not drawn.
- Should the agent ever be a seat the baton can reach (an "autopilot" handoff)? The thread says no: the
  agent is what is driven, and the ring is a person's state.
- The clock is hidden on the phone; should the wait show as "32 s" in the inbox card instead?
- The dip is drawn under the baton only; a longer lane could let the whole hairline sag with a
  `d` transition. Chromium interpolates `d`, Safari does not yet.
- Fraunces or Instrument is still SYSTEM §3's call (judge-3); the lane's serif names are 13 px and
  would want `font-optical-sizing: auto` under Fraunces (editorial-type §1).
