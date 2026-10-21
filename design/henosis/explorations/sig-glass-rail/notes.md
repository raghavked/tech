# sig-glass-rail · The glass rail

The agents rail as layered navy glass: a facade of windows. The roster is a stack of translucent panes
on a lacquered Dress Blues ground; every agent card is a window in that glass, with a 1 px light caught
on its top edge and 1 px of shade beneath it, so the glass has thickness. Where an agent is working the
window is **lit from inside**: apricot pools under its top edge, the edge itself warms, and the light
falls on the sill below. The light then **climbs the stack**: the window's edge (apricot 62 %), the pane
that holds it (24 %), and the crease between rail and page (the system's one apricot hairline) is the
last edge it reaches. Nothing else on the rail is apricot. From across the room you can see which desks
have the lights on.

Files: `index.html` (self-contained: tokens inlined, light and dark via `prefers-color-scheme` and
`[data-theme]`, every animation inside the one guard with `[data-motion="calm"]` and
`prefers-reduced-motion`, Fraunces and Inter asked first with Instrument and system fallbacks, no
external assets, no fonts fetched), `light.png`, `dark.png` (1440×900), `phone.png` (390×844, the rail
as the 332 px sheet).

## What it is

| Layer (bottom → top) | What | Value |
|---|---|---|
| Lacquer | the rail ground: Dress Blues with a 170° sheen | `linear-gradient(170deg, white 5 %, transparent 42 %)` on `--rail` |
| Lamp | the room's one apricot light, top-left; the same lamp night-mode puts on the page | `radial-gradient(560px 440px at 0 0, apricot 15 %, transparent 62 %)` |
| Grain | a 240 px `feTurbulence` tile as a data URI at soft-light, rendered once | opacity .34 light / .30 dark (`--grain-alpha`, one per theme) |
| Pane | cream at 5 %, a 1 px rim at 8 %, 1 px of light on the top edge at 16 %, 1 px of shade under it at 14 %, a foot shadow at 34 %, a 1 px drop on the ground | `.pane`, radius 18; only the waits pane is frosted (`backdrop-filter: blur(10px)`), because only it sits over the lamp |
| Window | a pane on a pane, 4 px in, concentric at 18 − 4 = 14, with the agent's tight bottom-left corner | `.agent.pane`, `border-radius: 14px 14px 14px 5px`, tint 4.5 % over the pane |
| Lit | a running window: apricot pooled under its top edge, the edge warmed to 62 %, light cast on the sill below | `.agent.running::before`, `glass-breathe` 1.8 s, staggered by `--i` so two windows never breathe in phase |
| Light climbs | the pane that holds a lit window catches 24 % on its own edge | `.roster:has(.agent.running) { --pane-edge: var(--pulse-far) }` |
| Where you are | the system's wash, hairline ring and 3 px bar, on the glass | `.agent.active` |

The rail keeps SYSTEM §6's order and content exactly: brand row, New session on the one gradient (with
the same lit edge as the glass, so it is the brightest pane of the stack), Search, the **waits pane**
(Inbox and Approvals with solid apricot counts), AGENTS with the project as a pane and crews first in
serif, the project's own rows inside the pane, Chats with unread, and the me row as the bottom pane. The
dot, the status word and the italic lead still agree; spend is a mono number over a 2 px hairline that
warms past 80 %. The card foot uses the system's `.sm 22` single-initial avatars in driver → people
order with the driver ringed in apricot-deep (the judges' fix from the first round; the two-letter
discs are gone).

The page carries a small inspector in the topbar (Dee's agent joins, Calm, Dark; keys `j` `c` `d`) and
a drawer that is the element's own anatomy (the seven layers, the climb, a 2× crop, the cost). Neither
is part of the design; the app ships the rail alone.

## Why it is ours

- **The light means one thing, and it is where the work is.** SYSTEM principle 2: an apricot glow means
  *alive*. A glass rail with a lamp is of its time (the first round's judges, rightly); a facade where
  the only light is apricot, it comes from inside the window of the agent that is working, and it climbs
  the glass to the crease, is a sentence only this product can say: *the room is lit where somebody is
  working*. presence-and-agents: "put the agent in the room", not in a panel; Devin's sidebar reads
  Working / Ready / Blocked at a glance; Tuple rings whoever holds the keyboard. ai-interfaces-avoid: the
  agent is "a colleague with a shape, a place and a record", and no sparkle or badge says so; here the
  place is a window and the record is the doing-line under it.
- **Navy dominant, apricot rationed.** three-colour-brands §6 asks for one lacquered card per screen
  with `inset 0 1px 0 rgba(255,255,255,.08)`, and §5 for apricot "as light", never a fill; VELA's
  "never used as a fill, always as an accent that catches the light" is the whole brief for the pulse.
  The apricot budget on the rail is the lamp, the lit windows, their climb and the crease; counts and the
  active wash keep their system meanings (principle 2's three readings) and nothing else warms.
- **Depth from light and tone, not drop shadows** (premium-product-ui: Raycast's chrome is "a 1px
  border at 5–6 % white plus a top inner sheen", Linear's lifted panels carry "a half-pixel inset white
  highlight", the Interface Playbook's concentric corners, outer = inner + gap). Every pane is a rim and
  four inset hairlines; the only outer shadow is the 1 px the pane casts, plus the light a lit window
  casts on the sill. The 1 px of shade under the lit edge is what turns a tinted rectangle into glass
  with thickness: at 2× the crop shows two device rows, light over shade, on every pane.
- **The agent's shape, at card scale.** SYSTEM §4 gives the agent `--radius-agent: 9px 9px 9px 3px`,
  the tight bottom-left corner that the avatar and the mention already carry. The window takes the same
  corner at 14 → 5, so a card in the rail is recognisably *an agent's* before a word is read, and the
  rail's silhouette is nobody else's. (Atlassian reserves the hexagon for agents so circles stay human;
  ai-interfaces-avoid. Our reserved shape is this corner.)
- **Grain, tiled, never filtered** (generative-visuals §3, cost rules; Gustavo Fior's measurement): the
  tile is decoded once as an image, nothing runs `feTurbulence` at paint time. Raised to 34 % from the
  first round's invisible 26 %; the navy stays navy.
- **Rest is the end state** (MOTION §1, §3, §11; motion-choreography: reduced motion means "replace, not
  remove"). A lit window's rest frame is the lit window; Calm and reduce simply hold it. Only `opacity`
  moves on the glass (the pool and the cast share one pseudo-element, so they breathe together on the
  compositor); the breath is on the 1.8 s clock with `--ease-move`, well away from the 0.2 Hz band
  Apple's criteria warn about, and stops under the guard like every other loop.
- **Type and numerals.** Names in Fraunces with `"SOFT" 50, "WONK" 0` (editorial-type §1,
  premium-product-ui §9), what is read in Inter, spend and counts in tabular mono (editorial-type §6,
  data-craft's estimate tick as the 2 px hairline), section labels as tracked mono eyebrows.
- **Not Claude, ChatGPT or Linear.** Claude's rail is flat oat on ivory with no light source; ChatGPT's
  is a grey list; Linear's is near-black with an indigo glow, a dot grid and a travelling `glow-line`.
  A warm lamp on navy lacquer, cream glass with a bevelled edge, serif names, the agent's corner and an
  apricot light that comes from inside the work belong to the product whose frame is Dress Blues and
  whose pulse is Apricot Illusion (SYSTEM principle 10). No purple, no sparkle, no light travelling along
  an edge (ai-interfaces-avoid §6; generative-visuals' Linear `glow-line` is refused on purpose).
- **Dark is re-weighed, not inverted** (SYSTEM §16). The rail drops to `#10141C`, the tints to 4 %, the
  edge light to 11 %, the shade to 22 %, the foot to 50 %, the lamp to 11 %; the crease becomes apricot
  at 55 %. The mark's disc stays `#2A3244`. The glass reads at night because the foot and the shade do
  the work the edge light did by day, and a lit window reads *more* at night, as a window should.

## The technique

```css
.pane {
  --pane-tint: var(--glass); --pane-edge: var(--glass-edge);
  background: var(--pane-tint);
  border: 1px solid var(--glass-rim); border-radius: 18px;
  box-shadow: inset 0 1px 0 var(--pane-edge),    /* the light on the top edge            */
              inset 0 2px 0 var(--glass-shade),  /* 1 px of shade under it: thickness    */
              inset 0 -1px 0 var(--glass-foot),  /* the shadow under the foot            */
              0 1px 0 var(--glass-drop);         /* the 1 px it casts                    */
}
.pane.frost { backdrop-filter: blur(var(--glass-blur)) saturate(1.15); }   /* the waits pane only */
.pane .pane { --pane-tint: var(--glass-2); border-radius: 14px; }           /* concentric: 18 − 4  */
.agent.pane { --pane-edge: var(--glass-edge); border-radius: 14px 14px 14px 5px; }  /* the agent's corner */
.agent.running { --pane-edge: var(--pulse-edge); }                          /* the edge warms     */
.agent.running::before { content: ""; position: absolute; inset: 0; border-radius: inherit; z-index: 0;
  background: radial-gradient(190px 46px at 18% -14%, var(--pulse), transparent 72%);  /* lit inside */
  box-shadow: 0 10px 26px -10px var(--pulse-cast); }                                    /* the sill  */
.roster:has(.agent.running) { --pane-edge: var(--pulse-far); }              /* the light climbs   */
@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) .agent.running::before {
  animation: glass-breathe 1.8s var(--ease-move) infinite; animation-delay: calc(var(--i, 0) * -450ms); } }
```

- Everything is 1 px and axis-aligned: rims are borders, edge lights and shades are inset shadows with
  no blur, so at 1× and 2× they land on device pixels (the 2× crop in the drawer and the 2× rail crops
  taken for this note show one crisp row each, light over shade). No `0.5px` hairlines.
- The lamp is one radial gradient on the rail's background; the sheen is one linear. The grain is a
  `::before` at `z-index: -1` inside the rail's own stacking context (`isolation: isolate`), so the waits
  pane's `backdrop-filter` samples lacquer + lamp + grain and nothing above.
- The lit window is one pseudo-element, so a card gains no DOM; it carries both the pool (background) and
  the cast (outer shadow) and only its `opacity` is animated. It sits at `z-index: 0` under the card's
  children (`.agent.pane > * { position: relative; z-index: 1 }`), never over the text; the cast falls
  under the next card's 4.5 % tint, which is where light on a sill should go.
- Active, hover and running compose: `--pane-tint` and `--pane-edge` are the only two knobs a state
  turns, so the active card keeps its glass while taking the system's wash, ring and bar, and a card can
  be active and lit at once (the first card in the shots is).
- The climb is one `:has()` rule on the roster. Because `--pane-edge` inherits, `.agent.pane` resets it
  to the plain edge and `.agent.running` sets the warm one after, so a lit window's siblings stay plain.
- The card rule is `.agent:not(.avatar):not(.msg)` exactly as SYSTEM §6 requires, so the stream's agent
  reply and the agent avatar are never caught by it.
- Fifteen glass values are custom properties (`--lamp`, `--lacquer`, `--grain-alpha`, `--glass`,
  `--glass-2`, `--glass-rim`, `--glass-edge`, `--glass-shade`, `--glass-foot`, `--glass-drop`,
  `--glass-blur`, `--pulse`, `--pulse-edge`, `--pulse-cast`, `--pulse-far`), light in `:root`, dark in
  both dark blocks byte-identical. A team look that retints `--team-highlight` should retint the four
  `--pulse*` values the same way the glow is retinted. `--on-ok` (white by day, `--rail` at night) is the
  numeral on a green disc, the first round's dark-contrast fix.

## The cost

- **Backdrop blur: one layer**, the waits pane (about 272 × 62 px). The roster pane is no longer frosted
  (the judges' fix): it sits on opaque lacquer, so the blur sampled nothing a tint cannot give and cost a
  full-height compositor layer that scrolled. `--glass-blur: 0` removes the last layer and the pane still
  reads as glass from tint, rim, edge, shade and foot.
- **Per-pixel filters at runtime: none.** The grain tile is decoded once per page as an image.
- **Animated properties:** `opacity` on the lit window's pseudo-element (compositor; pool and cast
  together), `box-shadow` on the running dot (paint, 8 px), `transform`/`opacity` on card-in, the ripple
  and the toast. At most three lit windows breathe at once in this roster and the stagger keeps them out
  of phase.
- **DOM:** zero extra nodes per card; two extra elements in the rail (`::before` grain, the toasts region
  the app already has).
- **Paint:** the edge lights and shades are inset shadows with zero blur radius, which Chromium paints
  as fills; the cast is one blurred outer shadow per lit window, painted once and then composited while
  it breathes. Measured headless in Chromium at 1440×900: 10 animations at rest with motion on, 0 under
  `prefers-reduced-motion: reduce`, 0 under `data-motion="calm"`; no horizontal overflow at 1440 or
  390. Frame time on a 2020 laptop and Safari's `-webkit-backdrop-filter` are still to check; the first
  round measured the two-layer version at 16.4 ms/frame and this one has one layer fewer.

## How it ports into `apps/web`

The rail's markup does not change; the glass is CSS plus two wrapper classes and one class on the card.

1. **`apps/web/src/tokens.css`**: add the fifteen `--glass-*`, `--lamp`, `--lacquer`, `--grain-alpha`,
   `--pulse*` properties and `--on-ok` to `:root` and to both dark blocks (values in `index.html`'s three
   blocks), and the `glass-breathe` keyframes beside `dot-live`. Inside the existing
   `@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }` block add the
   one rule for `.agent.running::before`. If night-mode's lamp lands in the same patch, it is this
   `--lamp` and this `--grain-alpha`: one light and one grain per theme, as the judges asked.
2. **`apps/web/src/styles.css`**, the block headed *"tokens.css draws the ground (.sidebar, .rail share
   every rule)"* at `.sidebar` (≈ line 6355): replace the `.sidebar` background with the lacquer + lamp
   stack, add `isolation: isolate` and the `.sidebar::before` grain (`.sidebar` already has
   `position: relative`). Add the `.pane`, `.pane.frost`, `.pane .pane` rules, the `.roster:has(.agent.running)`
   climb, and at `.sidebar .agent` (≈ line 6595) the `.agent.pane` overrides (the agent's corner, the
   `--pane-tint` hover, the active composition, the `::before` lit window). The avatar rules already give
   the foot `.sm` single initials with `--avatar-edge` on the rail; keep them.
3. **`apps/web/src/Rail.tsx`**: in `Rail`, wrap the two `RailItem`s for Inbox and Approvals (the
   `className="inbox"` pair just above `.lists`) in `<nav className="pane frost waits">`, and each project
   block in `projectBlocks` in `<section className="pane roster">` with the project's
   Overview/Usage/Groups/Memory rows inside that section. In `AgentCard`, add `pane` to the class list and
   `running` when `status === "running"`:
   ``className={`agent pane enter${status === "running" ? " running" : ""}${active ? " active" : ""}${compact ? " compact" : ""}`}``;
   the existing `--i` index is what the breathe stagger reads, and `Stack`/`Avatar size="xs"` becomes
   `size="sm"` with the driver first. The me row's wrapper (`.me-wrap`) takes `pane` as well.
   `AgentSquare` (the 72 px rail) is unchanged: the collapsed rail keeps the lacquer and lamp but has no
   panes, so the fold still feels like the same object with its glass removed.
4. **Phone**: `styles.css`'s drawer rules at `max-width: 640px` keep working; the sheet's `--edge`
   hairline and the 26 px radius are the ones `phone.png` shows. The `.whowhere` line already exists in
   the app's drawer.
5. **`theme.ts` · `applyTeamTheme`**: set the four `--pulse*` values from `--team-glow` so a team's
   colour recolours the lit windows the way it recolours the focus halo.

Accessibility (SYSTEM §18, MOTION §11): the dot keeps its hidden "running"; each card carries one
composed `aria-label` naming the driver; counts stay navy on apricot (7.7 : 1); `--rail-muted` on the lightest pane
is 4.7 : 1 by day (4.5 : 1 where the lamp still reaches) and 5.1 : 1 at night (the pane and the window add 9.5 % cream to the ground, computed, not eyeballed; the first round's 12 % was what pushed muted text under 4.5). The lit window's pool is flattened to a 46 px ellipse above the card's top edge, so it
reaches the title row at ≤ 12 % (the serif title stays at 6.5 : 1) and is gone before the doing line; the active wash is the system's own `--rail-active` pair, unchanged by the glass; the done-step
numeral is `--on-ok` on the green disc in both themes. Nothing flashes: the slowest loop on the rail is
the 1.8 s breath, the fastest the 1.8 s dot.

## Open

- **The agent's corner on the card** is the one move here that touches shape, not only light. It is
  SYSTEM §4's own radius at card scale and reads as a tab rather than a glitch at 1× and 2× in both
  themes, but it is a one-line fallback (`border-radius: 14px`) if the founder prefers every rail item
  to share the plain 14.
- Whether the **climb should reach the brand row**: the mark's disc could take `--pulse-far` on its edge
  when anything on the rail is live, so the fold at 72 px (no panes) still shows that something works.
  Not done; the collapsed rail's corner dots already say it.
- The **cast on the sill** is one blurred outer shadow per lit window; with twelve lit windows that is
  twelve blurred shadows breathing by opacity. Cheap on the compositor, but measure the paint on first
  layout before shipping to a long roster; `--pulse-cast: transparent` removes it and the pool alone
  still reads.
- The **grain** at 34 % reads on a close look at 1× and clearly at 2×; it should be the same tile and the
  same alpha paper-and-lacquer uses on cream, with one `--grain-alpha` per theme.
- The hover card beside the **collapsed rail** (`.hcard`) is `--rail-2` with the system's shadow. It
  could be a window too (lit when its agent runs); not done here because it floats over cream, where the
  glass has no lacquer to sit on.
