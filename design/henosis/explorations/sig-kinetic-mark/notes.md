# sig-kinetic-mark · The kinetic mark

The two arcs as the room's status. One markup, six states: **idle, joining, settled, thinking, blocked,
handing the baton**. The mark stops being a logo that sometimes animates and becomes the thing a person
reads to know who is here, who is working, where their own hand is missing and who is driving.

Files: `index.html` (self-contained, light/dark via `prefers-color-scheme` and `[data-theme]`, every
animation under the one guard with `[data-motion="calm"]` and `prefers-reduced-motion`, Fraunces/Inter
with Instrument and system fallbacks, no external assets), `light.png`, `dark.png`, `phone.png`,
`favicon-rest.svg`, `favicon-working.svg`, `favicon-needs-you.svg` (the three live tab states, 16 px).

## What it is

| State | Trigger | What moves | Time · curve | Calm shows |
|---|---|---|---|---|
| Idle | nothing | nothing | 0 | the closed ring, centre present |
| Joining | a session connecting, the app opening | arcs swing in from ±60°, centre lands at 60 % (the tokens' `arc-a / arc-b / dot-in`) | 1.8 s loop · `--ease-mark` | the closed ring |
| Settled | a join lands | arcs close once (800), centre lands (550–1000), one apricot **notice** ripples out (900–1800) | 1.8 s once · arrive, arrive, leave | the closed ring |
| Thinking | a turn runs (agent) or someone types (person) | only the **working half** breathes: that arc 72→100 %, a wide apricot aura under it to 16 %, the centre's halo 1→2.3× | 1.8 s loop · ease-in-out, move | the closed ring; the status word says it |
| Blocked | an approval, a gate, a contention | the **person's arc retracts to 70 %** from the top seam; a dotted stitch shows the missing share; nothing pulses | 320 ms leave → 450 ms arrive when you act | the open seam with its stitch |
| Baton | the driver changes | a **hairline half ring outside the arcs** passes under the seam to the receiver; the receiver's arc takes the weight (stroke 10→12.6→10) | 500 ms · `--ease-mark` | the hairline over the holder |

The page: a navy lacquer hero with the mark live at 272 px, a state machine whose nodes are the mark in
each state (click to hold a state; the page's own favicon follows), the six at 96 px with product copy,
two-track timelines on one 2 s rule, the spec table, the 16 px row at 1× (on a light and a dark tab
strip) and 4×, and three homes (rail 24/20, stream 40, toast 32).

## Why it is ours

- **The ring is the room.** Person = chocolate, right; agent = apricot, left; the centre is the shared
  work. Every state is a statement about those two halves: *thinking* wakes one half and leaves the
  other still ("hue alone differs", motion-choreography §9 and three-colour-brands §6); *blocked*
  opens the seam on the side that must act, so a missing hand is literally a missing arc
  (ai-interfaces-avoid §5 "ring meter", motion-choreography §6 "progress arc bound to real work");
  *baton* is one ring passed around the table (generative-visuals §7, motion-choreography §3).
- **No spinner, no sparkle, no purple.** Nothing orbits; the only travel is the baton's half turn, once,
  under the seam. The retired travelling bead stays retired (MOTION §8). Claude's asterisk cycle,
  ChatGPT's dot, Linear's indigo glow have no equivalent here: our wait is a breathing half ring on
  navy (presence-and-agents, ai-interfaces-avoid §6).
- **Rest is the end state.** All six land on `mark.svg`. Calm shows the closed ring, the open seam
  and the hairline; nothing is hidden until it plays (MOTION §1, §3, §11).
- **Status colour never touches the mark.** Blocked is a shape, not amber; the word beside it carries
  the colour (SYSTEM principle 3). At 16 px the three live favicons differ in **shape** (ring / swollen
  centre with halo / open seam), the way Devin's tab dot differs in colour (presence-and-agents).
- **Navy lacquer, paper grain, hairlines.** The hero is the one glossy object in a matte room
  (three-colour-brands §7); the canvas carries a 240 px grain tile at 7 % soft-light, never a live
  filter (generative-visuals §3); the six are separated by hairlines, not boxes (premium-product-ui §1);
  timelines are hairline tally bars with direct labels and no legend (data-craft §4, §8). Type is
  Fraunces for names and Inter for what is read (editorial-type §1, three-colour-brands §10), with
  Instrument Serif/Sans as the installed fallback, which is what the screenshots show.

## The technique

- Both arcs are drawn **6 → 12** (`M48 76 A28 28 0 0 0 48 20` for the person, sweep 1 for the agent)
  with `pathLength="100"`, so they end at the top seam and `stroke-dasharray: var(--a-drawn) 100`
  trims the drawn share from the seam. Same pixels as `design/mark.svg`; only the path direction
  changed. `--a-drawn: 70` is blocked; the same variable is the plan's ring meter.
- Four extra children inside the mark: `.trace` (a dotted hairline on the person's radius, visible only
  where the arc is missing), `.glow.a` / `.glow.b` (18-wide apricot strokes under each arc, the aura),
  `.halo` (an r7 circle behind the centre: breathes while working, ripples once on a join) and `.baton`
  (an r40 circle, `stroke-dasharray: 50 50`, rotated 0° or 180° by `data-baton`).
- State is **data attributes on the SVG**: `data-state`, `data-who` (`agent` | `person`), `data-baton`
  (`person` | `agent` | `none`). The handoff is a CSS transition on `transform` (500 ms, the mark's
  curve) plus a `.take-a / .take-b` class for the receiver's 500 ms stroke-width pulse.
- Keyframes added to the tokens' vocabulary: `notice`, `breath-arc`, `breath-glow`, `mark-halo`, `take`.
  The blocked retract and redraw are transitions on `stroke-dasharray` with two clocks, `--t-retract`
  320 ms (leave) and `--t-draw` 450 ms (arrive), both zeroed under Calm with the system's clocks.
- Page CSS cannot reach inside a `<use>` shadow tree, so the page inlines the symbol into each mark
  once on load; without script the `<use>` still draws the resting ring. The app's `Mark` already
  inlines.
- Only `transform`, `opacity`, `stroke-width` and `stroke-dasharray` animate. No filters, no layout.

## The cost

- Six to eight extra SVG nodes per mark (trace, two glows, halo, baton). At 20 px in a rail of forty
  cards that is ~320 nodes; the rail's small cut can omit `.trace`, `.glow.a` and `.baton` (they do not
  read below 32 px) and keep `.halo` for thinking.
- Thinking loops three animations per mark. Keep to one thinking mark per rail card and one per
  topbar; the system's "one moving mark per screen" applies to swings, not breaths, but a page should
  not breathe in more than a handful of places.
- `stroke-width` and `stroke-dasharray` animate on the main thread (they are paint, not compositor).
  At the sizes involved this is a few pixels; verified smooth in Chromium, still to check in Safari.
- The favicon's two working frames swap a data URI every 900 ms: cheap, but it must stop when the tab
  is hidden and under Calm (the page does both).

## Port into apps/web

| Touch | What |
|---|---|
| `apps/web/src/ui.tsx` · `Mark` | Reverse the person's path to `M48 76 A28 28 0 0 0 48 20`, add `pathLength="100"` to both arcs, add the `.trace`, `.glow.a`, `.glow.b`, `.halo` and `.baton` children; new props `state: "idle" \| "joining" \| "settled" \| "thinking" \| "blocked"`, `who?: "agent" \| "person"`, `baton?: "person" \| "agent" \| "none"`, rendered as `data-*` on the `<svg>`. Keep `joining` / `settle` as aliases of `state`. On a `baton` change set `take-a` / `take-b` for 520 ms (skip the wait under `useMotion() === "calm"`). |
| `apps/web/src/tokens.css` · MOTION | Add the five keyframes and the `[data-state]` / `[data-baton]` rules from this page inside the existing `prefers-reduced-motion: no-preference` + `:root:not([data-motion="calm"])` block; add `--t-retract: 320ms`, `--t-draw: 450ms`, `--t-baton: 500ms` to the clocks and zero them in the Calm/reduce rules; the rest states (`.mark[data-state="blocked"] { --a-drawn: 70 }`, baton rotation) go outside the guard. |
| `apps/web/src/Rail.tsx` · agent cards | `<Mark size={20} state={status === "running" ? "thinking" : status === "awaiting_approval" \|\| status === "blocked" ? "blocked" : "idle"} />` beside the status word; the brand mark at 24 keeps `settle` on a cold open. |
| `apps/web/src/views/SessionView.tsx` · header and join line | The 40 px join line plays `settled`; the session header's 32 px mark carries `baton` from the driver in presence (`presence.ts`). The contention/handoff notice calls `baton` on confirm. |
| `apps/web/src/theme.ts` (or a new `favicon.ts`) | `setFavicon(state)` builds the tiny cut as a data URI (the `tinySVG` function on this page) and swaps `link[rel=icon]`; three states only: rest, working, needs you. Ship the three files here to `apps/web/public/` and point `index.html` at `favicon-rest.svg`; `notify.ts` keeps `/favicon.svg` for notifications. |
| `design/mark.svg` | Add `pathLength="100"` and the reversed person path so the file and the component stay one geometry; the brand board's cuts are unchanged in pixels. |

## Open questions

- The baton hairline is the one thing that travels around the ring. It is half a turn, once, 500 ms,
  under the seam; still, it should be shown to the founder next to the retired bead so the difference
  is agreed, not assumed.
- Blocked retracts the person's arc. Should a block on the world (server gone, a contention the agent
  cannot resolve) retract the agent's arc instead, or stay with the ghost centre as MOTION §7.4 says?
  This page keeps the ghost for "cannot be seen" and uses the seam only for "needs a hand".
- The favicon lifts the person's arc 62 % toward apricot (what the rail does at 22 px). The shipped
  `favicon.svg` uses pure chocolate, which is 1.4 : 1 on the disc at 16 px. Pick one.
- `stroke-dasharray` transitions and `stroke-width` keyframes need a Safari check; the fallback is an
  instant jump, which is the Calm frame.
- The thinking aura at 16 % on navy reads warm in motion and slightly grey in a still; a still from the
  loop's 25 % point should be the one used in docs.
