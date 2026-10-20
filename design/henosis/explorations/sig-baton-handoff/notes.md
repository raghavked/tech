# sig-baton-handoff · The baton

The driver's ring is the baton. Henosis already draws the driver as a 2 px apricot-deep ring around an
avatar (SYSTEM §12: "a ring (`.driver`, 2 px apricot-deep: the baton)"); this element makes that sentence
literal. When Ana hands off, the ring opens into an arc, lifts off her avatar, rolls along the hairline
the people stand on across the top of the composer, sags the lane under its weight, and arrives at Bo with
a 6.9 % overshoot that settles. There it waits open, in the mark's apart pose, breathing the halo pulse,
beside the two things Bo can press. Accept closes the arc into the ring around him and his avatar pops.
Decline raises a red stop at his edge; the baton bumps against it, squashes, and rolls home to Ana on a
heavier spring with no overshoot, closing around her again while the sentence says *Bo declined the baton
· Ana still drives*.

Files: `index.html` (self-contained: tokens inlined from `tokens.v5.css`, light and dark via
`prefers-color-scheme` and `[data-theme]`, every transition and animation inside the one guard with
`prefers-reduced-motion` and `[data-motion="calm"]`, Fraunces and Inter asked for first with the
Instrument and system faces as fallbacks, no external asset, no font fetched, no script loaded),
`light.png`, `dark.png` (1440 × 900, the baton offered to Bo), `phone.png` (390 × 844). The screenshots
show the fallback faces (Instrument Serif, Instrument Sans, JetBrains Mono); Fraunces and Inter are not on
this machine and the page fetches nothing. `?at=rest|offered|accepted|declined` opens a frame,
`?play` runs offer → accept, `?calm` sets Calm; keys 1 – 5 drive the demo while no field has focus.

## What it is

| Part | What | Where |
|---|---|---|
| The lane | one hairline (`--line`) across the top of the composer, inside its surface; the people stand on it at 108 px intervals with serif names beneath ("Bo · you"), the agent's tile at its right end with the running dot. The lane never moves; it is the composer's first row and the composer is where the hand acts | the composer |
| The baton | a 44 px SVG `<circle r=18 pathLength=1>`, stroke 2, `--apricot-deep` (plain apricot at night): at rest, exactly the driver ring outside the avatar's 2 px edge. The lane's avatars never carry their own `.driver` box-shadow; the ring is one object and it travels (Family's rule in motion-choreography: "a component already on screen never duplicates itself, it travels") | the lane |
| Lift | `stroke-dasharray` 1 0 → .34 .66, stroke 3.4, the carrier rises 5 px and takes a drop-shadow; 250 ms on the lift spring | leaving the driver |
| Roll | the carrier's `translate` and the baton's `rotate` ride the same spring (`linear()`), so the overshoot rolls back as it should: angle = distance ÷ 18 px; 108 px is 344°. A `sag` keyframe takes the carrier −5 → +3 → 0 px while a 76 px dip (a surface-coloured stroke erasing the track, a quadratic redrawing it 10 px lower) travels under the baton: the lane gives under the weight | between two seats |
| Offered | the arc at .42 .58, 2 px up, with the halo breathing 2 → 13 px on the status pulse's 1.8 s (MOTION §5.5: waiting is the halo pulse; the ring never re-opens to say "waiting"); the sentence names who and a mono clock counts the wait; Accept is the one chocolate button, Decline a ghost in `--danger-ink` | at the person offered |
| Accepted | `stroke-dasharray` → 1 0 on the close spring (380 ms, 0.9 % over), the avatar pops 1.08 and ripples once (`pop`, `ripple`), the driver ring in the topbar stack and the rail card moves with it, "Bo has the baton" rises as a divider | the new driver |
| Declined | a 2 × 24 px `--danger` stop scales up at the avatar's leading edge (200 ms, `--ease-arrive`); the baton bumps (`scale .78 1.14`, 160 ms); then the carrier takes the return spring home (640 ms, ζ .93, no overshoot) with its dip, and closes around the driver. Red appears only for a human no (SYSTEM §2.7); "declined the baton" is `--danger-ink`, the rest ink | the lane |
| Recall | "Take it back" for the offerer: the same return without the stop | the lane |
| Policy refusal | a contributor who tries to hand off gets the kernel's rule in the hint, "Only Ana or an owner can hand off. The baton stays where it is." The baton does not lift: a refusal by rule has no motion, a refusal by a person has the stop | the hint |
| Calm | no transitions: the ring appears at the new driver and the sentence carries the news; Offered still shows the open arc and the two buttons; the halo is still | everywhere |
| Phone | the lane at the thumb across the composer with 30 px avatars, the stack in the navy top block mirroring the driver ring, the clock hidden, Accept and Decline on the sentence row | 390 |

## The springs

Four damped springs, each sampled once into a CSS `linear()` easing (36 stops, cut where the response
stays within 0.4 % of the target), so every device lands on the same frame. `x(t) = 1 − e^(−ζω₀t)·(cos ω_d t +
(ζω₀ / ω_d)·sin ω_d t)`, from rest. The generator is twelve lines of JS (in the comment above the tokens).

| spring | m · k · c | ζ | ω₀ | overshoot | run | drives |
|---|---|---|---|---|---|---|
| travel | 1.4 · 170 · 20 | .65 | 11.0 rad/s | 6.9 % | 830 ms | the carrier's `translate` and the baton's `rotate` |
| return | 1.4 · 140 · 26 | .93 | 10.0 | none | 640 ms | the same two properties on the way home |
| close | 1 · 420 · 34 | .83 | 20.5 | 0.9 % | 380 ms | `stroke-dasharray` as the ring closes |
| lift | 1 · 600 · 44 | .90 | 24.5 | none | 250 ms | the carrier's 5 px rise and the ring's opening |

Plus two keyed clocks: the stop at 200 ms on `--ease-arrive` and the bump at 160 ms; and the waiting halo at
1.8 s, the status pulse's clock. The colour and opacity side never springs (Material's spatial/effects
split, motion-choreography): the dip and the shadow fade on `--t`, `--ease-move`.

## Why it is ours

- **It is the mark's grammar on a person.** The brand is two arcs that close into one ring around one
  centre (BRIEF). The baton is a ring that opens into an arc to leave someone and closes into a ring to
  arrive at someone: the apart pose means "not yet in the circle" (SYSTEM §5's states, `.mark.apart`) and
  the closed ring means "it is yours". The halo while it waits is MOTION §5.5's own wait; the ripple and pop
  on Accept are the join timeline's (MOTION §7). Nothing travels *around* the ring (MOTION §8 bans the old
  travelling bead); the ring itself travels, along a line, between people.
- **The ring that the system already calls the baton.** SYSTEM §12 names the 2 px apricot-deep driver ring
  "the baton" and the presence stack, the rail card and the drawer all draw it. This element does not add a
  stick, a flag or a crown; it makes the ring the thing that is handed, and every other copy of the ring
  follows it (the topbar stack and the rail card recolour on Accept). motion-choreography §3 proposed a
  "turn baton" as a conic ring passed between person and agent; this is that idea with the brand's own
  ring and a journey instead of a crossfade.
- **Weight is honest about what a handoff is.** Driving a session is responsibility; the baton is heavy.
  The sag, the dip in the lane, the 6.9 % overshoot and the slow settle say "something with mass changed
  hands" (motion-choreography: springs chosen for how they settle, Comeau's high-friction springs; Material's
  spatial spring allowed to overshoot, effects springs never). The return after a refusal is heavier and
  does not bounce: it comes home tired.
- **Refusal has a shape, and it is a human no.** The stop is the only red on the lane, and only a person
  raises it (SYSTEM §2.7: red only for a human no or a conflict). The kernel's two refusals are two
  drawings: a decline bumps the baton back; a policy refusal has no motion at all, just the rule in the hint
  (MOTION principle 1: motion means joining or living; a rule is neither).
- **The composer is where the hand acts.** The lane lives on the composer, not in a notice or a modal: the
  people you can hand to are the people who can hear what you type, and the Accept button sits in the same
  surface as the send button (ai-interfaces-avoid §2 and §3, the composer as the ledger's bottom rule with
  visible recipients; presence-and-agents §7, the steer line: "you never stop a colleague, you tell them").
  The agent at the lane's end is the thing being driven, in the room, not in a sidebar (presence-and-agents:
  "do not build an agent panel, put the agent in the room").
- **Hairline, not box; one accent spent on one object** (premium-product-ui §1, three-colour-brands:
  "spend apricot on one object"). The lane is a hairline, the avatars sit on it without a card, and the only
  apricot on the composer is the baton and its halo. Named things are serif, the clock and the spring table
  are mono, the sentence is sans (SYSTEM principle 6; editorial-type §7).
- **Deterministic springs** (MOTION §2: "overshoot is never a spring … so the mark lands identically on
  every device"). The physics is the memo's, the delivery is MOTION's: a spring sampled into `linear()` is a
  keyed curve, and Calm and reduce get the end frame for free because the guard owns every transition.
- **Not the others.** No bubble, no sparkle, no purple, no thinking dots. Nothing here is a chat shape; the
  lane reads as a tightrope, the baton as a ring with mass, and the colours are the three plus cream.

## The technique

- `translate`, `rotate` and `scale` as individual CSS properties on three nested elements (carrier → lift →
  baton), each with its own easing: the carrier travels, the lift sags, the baton rolls and bumps. Nothing
  animates layout; the lane is `position: absolute` inside the composer's first row.
- Seat positions are measured once (`getBoundingClientRect` on each `.seat .avatar`) and written to `--bx`
  on the carrier, so any layout (desktop spacing, phone spacing, a fifth person) works without CSS math.
  The stop's `--sx` is the target seat's centre minus 22.
- The rolling angle accumulates in JS (`rot += dx / 18 rad`) so a return rolls backwards and the arc's
  open side is wherever the roll leaves it; the opening frame fixes it at −150° for the still.
- The lane dip is two SVG paths in a 76 × 14 box riding the carrier: a 3 px surface-coloured straight
  stroke erases the track, a 1 px quadratic redraws it 10 px lower. Opacity only; it fades on `--t`.
- The seven frames in the spec column are drawn by one 30-line function from the same geometry, so the
  specimen and the live element cannot drift.
- Timing logic waits on the clock tokens through `wait(ms)` which returns 0 under Calm or reduce (MOTION §3:
  never wait on `animationend` without checking `useMotion()`).

## The cost

- Paint: one 44 px SVG, one 76 px SVG and one 2 px bar move; transforms and opacity only; a `drop-shadow`
  filter on the baton while it is up (a 44 px raster, ~0.2 ms a frame). No layout, no blur over the canvas.
- CSS: ~70 lines for the lane and baton plus four `linear()` strings (~1.2 KB). JS: ~120 lines of state
  machine. The spec column and the frame drawer are exploration-only.
- `linear()` easing needs Chrome 113, Safari 17.2, Firefox 112; below that the browser falls back to the
  default `ease` and the baton still arrives, just without the overshoot. No polyfill needed.
- The halo animates `stroke-width` on an SVG circle (cheap, no filter). The ring closes by
  `stroke-dasharray` on `pathLength=1`, which is interpolable in every current engine.
- Accessibility: the lane is a `role="group"` named "The baton", the sentence is mirrored into a polite
  live region, state is in words beside every colour (the stop has the word "declined", the halo has
  "offers you"), keys never fire inside a field, and Decline keeps its ghost shape so the primary stays the
  hand.

## How it ports into apps/web

- **`apps/web/src/stream/Composer.tsx`** gains a `<BatonLane>` as the composer's first child (above
  `.field`), fed `s.participants`, `presence`, `s.driver`, the pending `Handoff` addressed to or from `me`
  (`Object.values(s.handoffs).find(h => h.status === "pending" && (h.to === me.id || h.from === me.id))`)
  and `client`. Its sentence row replaces today's handoff `.notice` at the bottom of `stream/Message.tsx`
  (lines 171–197, `showHandoff && handoffs.map(...)`): Accept and Decline send the same `handoff.accept` /
  `handoff.decline` messages; "Hand off to …" sends `handoff.request`. The notice can stay for one release
  behind `showHandoff` so the inbox and the phone keep an obvious card, then go.
- **`apps/web/src/ui.tsx`**: a `Baton` component (the carrier, lift and SVG) next to `Avatar`, and
  `Avatar` learns `ringless` so the lane's avatars drop their own `.driver` shadow while the topbar stack
  and the drawer keep it.
- **`apps/web/src/tokens.css`**: add the four `--spring-*` curves and `--d-*` clocks under the clocks
  (line 173, beside `--t-fast / --t / --t-slow`), and the `sag`, `baton-halo`, `bump` keyframes beside
  `pop` and `ripple`; every rule lives inside the existing guard block at line 719. `--baton:
  var(--apricot-deep)` and `--stop: var(--danger)` are aliases, not new colours.
- **`apps/web/src/styles.css`**: `.lane`, `.seat`, `.carrier`, `.lift`, `.baton`, `.dip`, `.stop`,
  `.laneline` next to `.composer-wrap` (line 1328). `.notice.handoff::before` (line 1117, `--warn`) is
  then only read by the inbox card.
- **State machine** in `BatonLane`: derive `state` from the kernel, not from clicks. `pending` handoff
  → `offered`; a transition from `pending` to `accepted` → play `close` then rest; `pending` →
  `declined` → play `blocked`, `return`, `close`; a new `pending` → `lift`, `travel`. The component keeps the
  last seen `handoffId` + `status` in a ref and reads `useMotion()` to skip the waits under Calm. Replay
  (`?at` here) is the scrubber's `past`: the lane renders the state at that event with no travel.
- **copy.ts**: `stream.offersYou`, `accept`, `decline`, `hasTheBaton`, `declined`, `offered` already exist;
  add `baton.youHave` ("You have the baton · steering {agent}."), `baton.offeredTo` ("You offered the baton
  to {who}."), `baton.recall` ("Take it back"), `baton.stillDrives` ("{who} still drives."),
  `baton.onlyDriver` ("Only {who} or an owner can hand off.").
- **Kernel** (open): `recall` has no event today; the offerer can only wait. Either add
  `handoff.withdrawn` to `packages/protocol` and `session.ts` or render "Take it back" only when the
  kernel grows it. Also open: whether a pending offer expires, and whether the stop should stay as a
  "declined · 16:42" mark in the Team panel's baton history.

## Open questions

- Should the agent ever be a seat the baton can reach (an "autopilot" handoff), or is driving always a
  person? The lane leaves the agent at the end with no ring on purpose.
- With six or more people the lane needs a stack and an "others" seat; the baton would travel to the
  stack's edge. Not drawn.
- The phone hides the clock; should the wait show as "32 s" in the inbox instead?
- The dip is drawn under the baton only; a longer lane could let the whole hairline sag with a
  `d` transition. Chromium interpolates `d`, Safari does not yet.
