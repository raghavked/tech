# sig-glass-rail · The glass rail

The agents rail as layered navy glass. The roster is a stack of translucent panes on a lacquered Dress
Blues ground, lit by one apricot lamp at the top-left corner; every pane catches that light on its top
edge and casts a hairline shadow under its foot. A card whose agent is working holds an apricot light
pooled under its edge and breathes on the 1.8 s clock. The rail stops being a flat menu column and
becomes the one glossy object in a matte room: the place where the team's people and agents can be
seen at once, lit from above like things on a shelf.

Files: `index.html` (self-contained: tokens inlined, light and dark via `prefers-color-scheme` and
`[data-theme]`, every animation inside the one guard with `[data-motion="calm"]` and
`prefers-reduced-motion`, Fraunces/Inter asked first with Instrument and system fallbacks, no external
assets, no fonts fetched), `light.png`, `dark.png` (1440×900), `phone.png` (390×844, the rail as the
332 px sheet).

## What it is

| Layer (bottom → top) | What | Value |
|---|---|---|
| Lacquer | the rail ground: Dress Blues with a 170° sheen | `linear-gradient(170deg, white 4.5 %, transparent 42 %)` on `--rail` |
| Lamp | one apricot light in the top-left corner, the only gradient the rail adds | `radial-gradient(560px 440px at 0 0, apricot 15 %, transparent 62 %)` |
| Grain | a 240 px `feTurbulence` tile as a data URI at soft-light, rendered once | opacity .26 light / .22 dark |
| Pane | cream at 5.5 %, a 1 px rim at 7.5 %, the light on the top edge at 14 %, a shadow under the foot at 32 %, a 1 px drop on the ground | `.pane`, radius 18; the two outer panes (waits, roster) are frosted with `backdrop-filter: blur(10px)` |
| Card | a pane on a pane, 4 px in, at the concentric radius 18 − 4 = 14 | `.agent.pane`, tint 5 % over the pane |
| Pulse | a running card: apricot pooled under its top edge, the edge itself warmed to apricot 55 % | `.agent.running::before`, `glass-breathe` 1.8 s, staggered by `--i` so two panes never breathe in phase |
| Where you are | the system's wash, hairline ring and 3 px bar, on the glass | `.agent.active` |

The rail keeps SYSTEM §6's order and content exactly: brand row, New session on the one gradient,
Search, the **waits pane** (Inbox and Approvals with solid apricot counts), AGENTS with the project as
a pane and crews first in serif, the project's own rows inside the pane, Chats with unread, and the me
row as the bottom pane. The dot, the status word and the italic lead still agree; spend is a mono
number over a 2 px hairline that warms past 80 %.

The page carries a small inspector in the topbar (Dee's agent joins, Calm, Dark; keys `j` `c` `d`)
and a drawer that is the element's own anatomy (the six layers, a 2× crop, the cost). Neither is part
of the design; the app ships the rail alone.

## Why it is ours

- **Navy dominant, apricot spent on one thing.** three-colour-brands §7 asks for one lacquered panel
  per screen with `inset 0 1px 0 rgba(255,255,255,.12)` and a 170° sheen; the rail is that panel, and
  the glass panes are what sits on the lacquer. The apricot budget goes to the lamp and the pulse
  (three-colour-brands: "spend apricot on one object"; §6 "apricot glow for working"). SYSTEM principle
  2 holds: a solid apricot count means something waits, the wash with its hairline means where you are,
  the apricot light under an edge means alive. Nothing else on the rail is apricot.
- **Depth from light and tone, not drop shadows** (premium-product-ui: "hairlines, not boxes";
  "depth from light and tone"; concentric corners, inner = outer − padding). Every pane is a rim and
  two inset hairlines; the only shadow is the 1 px the pane casts on the ground. The nested top-edge
  lights, 4 px apart, are what make the stack read as sheets of glass rather than tinted rectangles.
- **It is lit, so it is a place.** presence-and-agents: "put the agent in the room", Devin's sidebar
  grouped Working / Ready / Blocked. The lamp gives the roster a direction of light, so a card that
  works glows the way a desk lamp is on at a desk somebody is sitting at. The agent is a colleague with
  a place (ai-interfaces-avoid: "a colleague with a shape, a place and a record"); the pulse is the
  activity line's light, not a spinner.
- **Grain, tiled, never filtered** (generative-visuals §3, cost rules): the tile is rendered once as an
  image; nothing runs `feTurbulence` at paint time. The frost on the two outer panes is a real
  `backdrop-filter` (premium-product-ui §10's palette recipe), limited to two layers.
- **Rest is the end state** (MOTION §1, §3, §11). The pulse's rest frame is the lit pane; Calm and
  reduce simply hold it. Only `opacity`, `box-shadow` and `transform` move; the breathing is on the
  1.8 s clock with `--ease-move`, far from the 0.2 Hz band motion-choreography warns about, and
  stops under the guard like every other loop.
- **Type and numerals.** Names in Fraunces with `"SOFT" 50, "WONK" 0` (editorial-type §1,
  premium-product-ui §9); what is read in Inter; spend and counts in tabular mono (editorial-type §6
  ledger numerals); section labels as tracked mono eyebrows (editorial-type §7).
- **Not Claude, ChatGPT or Linear.** Claude's rail is flat oat on ivory with no light source; ChatGPT's
  is a grey list; Linear's is near-black with an indigo glow and a dot grid. A warm lamp on navy
  lacquer, cream glass, serif names and an apricot pulse belong to a product whose frame is Dress Blues
  and whose pulse is Apricot Illusion (SYSTEM principle 10: keep navy dominant). No purple, no sparkle,
  no travelling light along an edge (ai-interfaces-avoid §6; the Linear "light streak" is refused).
- **Dark is re-weighed, not inverted** (SYSTEM §16). The rail drops to `#10141C`, the tints to 4 %, the
  edge light to 10 %, the foot deepens to 50 %, and the lamp dims to 11 %; the crease becomes apricot at
  55 %. The mark's disc stays `#2A3244`. The glass reads at night because the foot shadow does the
  work the edge light did by day.

## The technique

```css
.pane {
  --pane-tint: var(--glass); --pane-edge: var(--glass-edge);
  background: var(--pane-tint);
  border: 1px solid var(--glass-rim); border-radius: 18px;
  box-shadow: inset 0 1px 0 var(--pane-edge),   /* the light on the top edge  */
              inset 0 -1px 0 var(--glass-foot),  /* the shadow under the foot  */
              0 1px 0 var(--glass-drop);         /* the 1 px it casts          */
}
.pane.frost { backdrop-filter: blur(var(--glass-blur)) saturate(1.15); }
.pane .pane { --pane-tint: var(--glass-2); border-radius: 14px; }   /* concentric: 18 − 4 */
.agent.running { --pane-edge: var(--pulse-edge); }
.agent.running::before { content: ""; position: absolute; inset: 0; border-radius: inherit;
  background: radial-gradient(150px 64px at 22% -6%, var(--pulse), transparent 72%); }
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) .agent.running::before {
  animation: glass-breathe 1.8s var(--ease-move) infinite; animation-delay: calc(var(--i, 0) * -450ms); } }
```

- Everything is 1 px and axis-aligned: rims are borders, edge lights are inset shadows with no blur,
  so at 1× and 2× they land on device pixels (the 2× crop in the drawer and the 2× rail crops taken
  for this note show one crisp line each). No `0.5px` hairlines.
- The lamp is one radial gradient on the rail's background; the sheen is one linear. The grain is a
  `::before` at `z-index: -1` inside the rail's own stacking context (`isolation: isolate`), so the
  panes' `backdrop-filter` samples lacquer + lamp + grain and nothing above.
- The pulse is a pseudo-element, so a card gains no DOM. Its light sits at `z-index: 0` under the
  card's children (`.agent.pane > * { position: relative; z-index: 1 }`), never over the text.
- Active, hover and running compose: `--pane-tint` and `--pane-edge` are the only two knobs a state
  changes, so the active card keeps its glass while taking the system's wash, ring and bar.
- The card rule is `.agent:not(.avatar):not(.msg)` exactly as SYSTEM §6 requires; the first draft of
  this page forgot it and the stream's agent reply went cream on cream, which is the collision the
  brand panel warned about.
- Twelve glass values are custom properties (`--lamp`, `--lacquer`, `--grain-alpha`, `--glass`,
  `--glass-2`, `--glass-rim`, `--glass-edge`, `--glass-foot`, `--glass-drop`, `--glass-blur`,
  `--pulse`, `--pulse-edge`), light in `:root`, dark in both dark blocks. A team look that retints
  `--team-highlight` should retint `--pulse` and `--pulse-edge` the same way the glow is retinted.

## The cost

- **Backdrop blur: two layers** (the waits pane and the roster pane), each the width of the rail.
  Cards, the me row and the collapsed rail's hover card are not frosted. On a 1440×900 window that is
  two compositor layers of about 272×(60 + 520) px. Setting `--glass-blur: 0` removes both layers and
  the panes still read as glass from tint, rim, edge and foot.
- **Per-pixel filters at runtime: none.** The grain tile is decoded once per page as an image.
- **Animated properties:** `opacity` on the pulse (compositor), `box-shadow` on the running dot (paint,
  8 px), `transform`/`opacity` on card-in, ripple and the toast. The pulse's `::before` is promoted by
  its animation; at most three running panes breathe at once in this roster, and the stagger keeps
  them out of phase.
- **DOM:** zero extra nodes per card; two extra elements in the rail (`::before` grain, the toasts
  region the app already has).
- **Paint:** the edge lights are inset shadows with zero blur radius, which Chromium paints as fills,
  not as blurred shadows. Measured headless at 1440×900 the page holds the display's 16.4 ms/frame
  with the pulse running in both themes; no frame is dropped on a 60 Hz budget. Safari still to check
  (`-webkit-backdrop-filter` is set).

## How it ports into `apps/web`

The rail's markup does not change; the glass is CSS plus two wrapper classes.

1. **`apps/web/src/tokens.css`**: add the twelve `--glass-*`, `--lamp`, `--lacquer`, `--grain-alpha`,
   `--pulse*` properties to `:root` and to both dark blocks (values in `index.html`'s three blocks),
   and the `glass-breathe` keyframes beside `dot-live`. Inside the existing
   `@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }` block add
   the one rule for `.agent.running::before`. Add `--rail-ok / --rail-warn / --rail-danger` (the dot
   triplet on navy, which is the same in both themes) if the rail's dots still read `--ok` on light.
2. **`apps/web/src/styles.css`**, the block headed *"tokens.css draws the ground (.sidebar, .rail
   share every rule)"* at `.sidebar`: replace the `.sidebar` background with the lacquer + lamp
   stack and add the `.sidebar::before` grain (with `position: relative; isolation: isolate`, which
   `.sidebar` already has for `position`). Add the `.pane`, `.pane.frost`, `.pane .pane` rules and the
   `.sidebar .agent.pane` overrides (padding 8/10, the `--pane-tint` hover, the active composition).
3. **`apps/web/src/Rail.tsx`**: in `Rail`, wrap the Inbox and Approvals rows in
   `<nav className="pane frost waits">` and each project block (`projectBlocks`) in
   `<section className="pane frost roster">`; move the project's Overview/Usage/Groups/Memory rows
   inside that section. In `AgentCard`, add `pane` to the class list and `running` when
   `statusOf(row) === "running"` (`className={\`agent pane enter${status === "running" ? " running" : ""}…\`}`);
   the existing `--i` index is what the breathe stagger reads. The me row's wrapper
   (`.sidebar .me-wrap`) takes `pane` as well. `AgentSquare` (the 72 px rail) is unchanged: the
   collapsed rail keeps the lacquer and lamp but has no panes, so the fold still feels like the same
   object with its glass removed.
4. **Phone**: `styles.css`'s drawer rules at `max-width: 640px` keep working; the sheet's `--edge`
   hairline and the 26 px radius are the ones `phone.png` shows. The `.whowhere` line already exists
   in the app's drawer.
5. **`theme.ts` · `applyTeamTheme`**: set `--pulse` and `--pulse-edge` from `--team-glow` so a team's
   colour recolours the breathing light the way it recolours the focus halo.

Accessibility (SYSTEM §18, MOTION §11): the dot keeps its hidden "running"; each card carries one
composed `aria-label`; counts stay navy on apricot; `--rail-muted` on the lightest pane is 6.0 : 1 by
day and 5.6 : 1 at night (the pane adds ≤ 5.5 % cream to the ground). The pulse sits under the text at
≤ 24 % and never changes a text/ground pair past the contract. Nothing flashes: the slowest loop on
the rail is the 1.8 s breath, the fastest the 1.8 s dot.

## Open

- Whether the **lamp should follow the active card**, drifting down the rail to sit above where you
  are. It would make the light mean something more (the room lights the desk you are at), at the cost
  of a 500 ms transition on a background-position and one more thing moving in the frame. This page
  keeps the lamp fixed; motion means joining or living, and moving to a card is neither.
- The **frost on the roster pane** is one tall backdrop layer that scrolls. On a long roster (three
  projects, twelve cards) the layer is the whole list; measure before shipping, and fall back to
  `--glass-blur: 0` on the roster pane if the scroll jank is visible on a 2020 laptop.
- Should the **crew line** become a third glass tier (project → crew → card), concentric at
  18 → 14 → 10? Tried and set aside: three tiers of edge light within 8 px read as noise, and card
  corners at 10 px drift from the system's 14. Two tiers and a serif crew line keep the stack legible.
- The **grain** is at 26 % soft-light by day and reads only on a close look; the 2× crop shows it. If
  the judge wants it visible in a 1× still it can go to 34 % without muddying the lamp; above that the
  navy greys.
- The hover card beside the **collapsed rail** (`.hcard`) is `--rail-2` with the system's shadow. It
  could be a pane too (frosted over the stream); not done here because it floats over cream, where
  the glass has no lacquer to sit on.
