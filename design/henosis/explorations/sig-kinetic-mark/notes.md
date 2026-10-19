# sig-kinetic-mark · The kinetic mark

The two arcs as the room's status. One markup, six states: **idle, joining, settled, thinking, blocked,
handing the baton**. The mark stops being a logo that sometimes animates and becomes the thing a person
reads to know who is here, who is working, where their own hand is missing and who is driving.

Files: `index.html` (self-contained; light and dark via `prefers-color-scheme` and `[data-theme]`; every
animation under the one guard, `prefers-reduced-motion: no-preference` + `:root:not([data-motion="calm"])`;
Fraunces / Inter with Instrument Serif / Sans and the system faces as fallbacks, which is what the
screenshots show; no external assets), `light.png`, `dark.png`, `phone.png`, and the three 16 px tab
states `favicon-rest.svg`, `favicon-working.svg`, `favicon-needs-you.svg`.

## What it is

| State | Trigger | What moves | Time · curve | Calm shows |
|---|---|---|---|---|
| Idle | nothing | nothing | 0 | the closed ring, centre present |
| Joining | a session connecting, the app opening, a reconnect | the tokens' run: arcs hold at ±60° for 270 ms, swing in, overshoot −4° / +2°, land; the centre lands at 60 % | 1.8 s loop · `--ease-mark` | the closed ring |
| Settled | a join lands (a person, an agent, a session) | arcs close once (800), the centre lands (550–1000), one apricot **notice** ripples out from the centre (900–1800) | 1.8 s once · arrive, arrive, leave | the closed ring; the join line carries the news |
| Thinking | a turn runs (agent) or someone types (person) | only the **working half** breathes: that arc 72→100 %, a wide apricot aura under it to 20 %, the centre's halo 1→2.3×; the other half is still | 1.8 s loop · ease-in-out, move | the closed ring; the status word says it |
| Blocked | an approval, a gate, a contention | the **person's arc retracts to 70 %** from the top seam; a dotted stitch shows the missing share; nothing pulses | 320 ms leave → 450 ms arrive when you act | the open seam with its stitch |
| Baton | the driver changes | the **centre crosses to the receiver's side** (5 units toward whoever drives) and the receiver's arc takes the weight (stroke 10→12.6→10) | 500 ms · `--ease-mark` | the centre on the holder's side, instantly |

The page: a navy lacquer hero with the mark live at 270 px, its sentence, and **the score**: the current
state's two seconds as notation (one row per moving part, holds as outlines, waits as dotted lines, a
playhead that runs in step with the mark); the six-state picker is the mark itself at 26 px in each state
(keys 1–6); the six at 96 px with product copy and the Calm frame; the spec table; the 16 px row (a light
and a dark tab strip at 1×, the true raster at 4×); four homes (rail 24/20, stream 40, session header 32
with the handoff pill at 18, toast 32); the rules.

## Why it is ours

- **The ring is the room.** Person = chocolate, right; agent = apricot, left; the centre is the shared
  work. Every state is a statement about those two halves: *thinking* wakes one half and leaves the other
  still ("same rhythm for thinking and typing, hue alone differs": motion-choreography §9, presence-and-
  agents' opening rule); *blocked* opens the seam on the side that must act, so a missing hand is literally
  a missing arc (the ring meter of ai-interfaces-avoid §5 and motion-choreography §6, "progress arc bound
  to real work"); *baton* is the centre sitting with whoever drives, which is motion-choreography §3's
  "one ring, one segment, passed between person and agent" without a new element.
- **Nothing travels around the ring.** The retired bead stays retired (MOTION §8). The baton crosses a
  diameter once in 500 ms; the only rotation anywhere is the joining swing the founder chose.
- **No spinner, no sparkle, no purple.** Claude's asterisk cycle, ChatGPT's dot, Linear's indigo glow have
  no equivalent here: our wait is a breathing half ring on navy, and the tab's three states differ in
  **shape**, the way Devin's tab dot differs in colour (presence-and-agents; ai-interfaces-avoid §6).
- **Rest is the end state.** All six land on `mark.svg`. Calm shows the closed ring, the open seam and the
  leaned centre; nothing is hidden until it plays (MOTION §1, §3, §11). The score's playhead rests at the
  end of the run under Calm, like everything else.
- **Status colour never touches the mark.** Blocked is a shape; the amber lives in the word beside it
  (SYSTEM principle 3).
- **Navy lacquer, paper grain, hairlines, a score instead of a diagram.** The hero is the one glossy
  object in a matte room (three-colour-brands §7); the canvas carries a 240 px grain tile at 6 % soft-light,
  never a live filter (generative-visuals §3); the six are separated by hairlines, not boxes
  (premium-product-ui §1); the score is hairline tally bars with direct labels and no legend (data-craft
  §4, §8). Type is Fraunces for names and Inter for what is read (editorial-type §1, three-colour-brands
  §10); the sentence above the score is the session masthead on the optical axis (editorial-type §1).

## The technique

- Both arcs are drawn **6 → 12** (`M48 76 A28 28 0 0 0 48 20` for the person, sweep 1 for the agent)
  with `pathLength="100"`, so they end at the top seam and `stroke-dasharray: var(--a-drawn) 100` trims the
  drawn share from the seam. Same pixels as `design/mark.svg`; only the path direction changed.
  `--a-drawn: 70` is blocked; the same variable can drive the plan card's ring meter.
- Four extra children inside the mark: `.trace` (a dotted hairline on the person's radius, visible only
  where the arc is missing), `.glow.a` / `.glow.b` (18-wide apricot strokes under each arc, the aura),
  `.halo` (an r7 circle behind the centre: breathes while working, ripples once on a join). The aura and
  halo use `mix-blend-mode: screen` on navy so the light warms the disc instead of greying it; on cream they
  take apricot-deep and blend normally.
- State is **data attributes on the SVG**: `data-state`, `data-who` (`agent` | `person`), `data-baton`
  (`person` | `agent` | `none`). The baton is the CSS `translate` property on `.dot` and `.halo`
  (independent of the `transform` the keyframes animate), transitioned over 500 ms on the mark's curve,
  plus a `.take-a` / `.take-b` class for the receiver's 500 ms stroke-width pulse.
- Keyframes added to the tokens' vocabulary: `notice`, `breath-arc`, `breath-glow`, `take`; `mark-halo` is
  MOTION §5.5's. The blocked retract and redraw are transitions on `stroke-dasharray` with two clocks,
  `--t-retract` 320 ms (leave) and `--t-draw` 450 ms (arrive), zeroed under Calm with the system's clocks.
- Page CSS cannot reach inside a `<use>` shadow tree, so the page inlines the symbol into each mark once on
  load (three cuts: default r28/10, small r29/13, tiny r32/16); without script every `<use>` still draws
  the resting ring.
- Only `transform`, `translate`, `opacity`, `stroke-width` and `stroke-dasharray` animate. No filters, no
  layout, no colour change on an arc.
- The score is generated from the same table that drives the hero (`S` in the script): one source for the
  copy, the timing and the replay cadence.

## The cost

- Six extra SVG nodes per mark (trace, two glows, halo, disc). At 20 px in a rail of forty cards that is
  ~240 nodes; the rail's small cut can omit `.trace` and the glows (they do not read below 32 px) and keep
  `.halo` for thinking.
- Thinking loops three animations per mark. Keep to one thinking mark per rail card and one per topbar.
- `stroke-width` and `stroke-dasharray` animate on the main thread (paint, not compositor). At these
  sizes it is a few pixels; smooth in Chromium, still to check in Safari. `mix-blend-mode` on the aura
  creates a stacking context per mark; drop it under 32 px where the aura is omitted anyway.
- The favicon's two working frames swap a data URI every 900 ms: cheap, but it stops when the tab is
  hidden and under Calm (the page does both).
- The lean puts the centre 1.7 px off at 32 and 1 px at 20: readable in the session header and the
  handoff pill, meaningless at the tab, so the brand row, the tab and paper never carry `data-baton`.

## Port into apps/web

| Touch | What |
|---|---|
| `apps/web/src/ui.tsx` · `Mark` | Reverse the person's path to `M48 76 A28 28 0 0 0 48 20`, add `pathLength="100"` to both arcs, add the `.trace`, `.glow.a`, `.glow.b` and `.halo` children; new props `state: "idle" \| "joining" \| "settled" \| "thinking" \| "blocked"`, `who?: "agent" \| "person"`, `baton?: "person" \| "agent" \| "none"`, rendered as `data-*` on the `<svg>`. Keep `joining` / `settle` as aliases of `state`. On a `baton` change set `take-a` / `take-b` for 520 ms (skip the wait when `useMotion() === "calm"`). |
| `apps/web/src/tokens.css` · MOTION | Add `notice`, `breath-arc`, `breath-glow`, `take` and the `[data-state]` rules from this page inside the existing `prefers-reduced-motion: no-preference` + `:root:not([data-motion="calm"])` block; add `--t-retract: 320ms`, `--t-draw: 450ms`, `--t-baton: 500ms` to the clocks and zero them in the Calm / reduce rules; the rest states (`.mark[data-state="blocked"] { --a-drawn: 70 }`, the `[data-baton]` translate) go outside the guard. |
| `apps/web/src/Rail.tsx` · agent cards | `<Mark size={20} cut="small" state={status === "running" ? "thinking" : status === "awaiting_approval" \|\| status === "blocked" ? "blocked" : "idle"} />` beside the status word; the brand mark at 24 keeps `settle` on a cold open. |
| `apps/web/src/views/SessionView.tsx` · header and join line | The 40 px join line plays `settled`; the session header's 32 px mark carries `baton` from the driver in `presence.ts` and `thinking` while a turn runs; the contention / handoff notice calls `baton` on confirm. |
| `apps/web/src/theme.ts` (or a new `favicon.ts`) | `setFavicon(state)` builds the tiny cut as a data URI (the `tiny` function on this page) and swaps `link[rel=icon]`; three states only: rest, working, needs you. Ship the three files here to `apps/web/public/` and point `index.html` at `favicon-rest.svg`; `notify.ts` keeps `/favicon.svg` for notifications. |
| `design/mark.svg` | Add `pathLength="100"` and the reversed person path so the file and the component stay one geometry; the brand board's cuts are unchanged in pixels. |

## Open questions

- The lean. 5 units toward the holder reads as intent at 96 and above and as a hair at 32; show the
  founder the session header at 32 beside a centred mark before it ships. If it reads as a flaw, the
  fallback is the receiver's `take` pulse alone, with the holder named in the word beside the mark.
- Blocked retracts the person's arc. A block on the world (server gone, a contention the agent cannot
  resolve) keeps the dashed ghost centre of MOTION §7.4; this page uses the seam only for "needs a hand".
- The favicon lifts the person's arc 62 % toward apricot (what the rail does at 22 px). The shipped
  `favicon.svg` uses pure chocolate, which is 1.4 : 1 on the disc at 16 px. Pick one.
- `stroke-dasharray` transitions, `stroke-width` keyframes and `mix-blend-mode` inside SVG need a Safari
  check; the fallback is an instant jump, which is the Calm frame.
- The settled notice ripples from the mark itself; MOTION §7.2 ripples the newcomer's avatar at the same
  moment. On the join line both play; one of them should give way when they sit within 60 px of each other.
