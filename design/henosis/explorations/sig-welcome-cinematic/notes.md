# sig-welcome-cinematic · The welcome brief

The first ninety seconds for a new team member, as one scene with one camera instead of a carousel of
slides. Dee opens the invite and the product speaks in its own voice, on navy lacquer, in six beats:
her arc waits alone; her agent's arc swings in and the ring closes around a ghost centre; the camera
pulls back and the ring turns out to be one of the team's sessions, in a sky of rings with the people and
agents on them; her agent speaks in the ledger column with the byline everyone gets; the first session
is one sheet of paper on the lacquer; and the lacquer becomes the rail as the page slides in and the
stream says *Dee joins the circle.* Nothing is a modal and nothing has a Next button: a hairline at the
foot carries the ninety seconds with six ticks, Esc skips to the session, and the brief ends in the
product, not on a slide.

Files: `index.html` (self-contained: tokens inlined, light and dark via `prefers-color-scheme` and
`[data-theme]`, every animation under the one guard with `[data-motion="calm"]` and
`prefers-reduced-motion`, Fraunces / Inter asked first with Instrument and system fallbacks, no external
assets, nothing fetched), `light.png`, `dark.png` (1440×900, beat 3), `phone.png` (390×844, beat 3),
and the other beats at desktop width: `frame-1.png`, `frame-2.png`, `frame-4.png`, `frame-5.png`,
`frame-6.png`, plus `phone-6.png` (the phone's beat 6, dark). Open `index.html#f=N` to park on a beat,
`#f=1&play=1` to run it, `#calm=1` to open it under Calm.

## What it is

| Beat | Clock | What moves | Copy | Calm shows |
|---|---|---|---|---|
| 1 · The arc | 0:00–0:06 | nothing: Dee's arc alone, held at +60° like the mark's hold (MOTION §4.1); a dotted guide where the ring will be; the playhead starts | "Dee, this is Payments." Three people and three agents are in; you are the fourth person; this ends in your first session | the same still |
| 2 · The ring | 0:06–0:18 | the agent's arc appears at −60° and both arcs swing in once (`arc-a-once` / `arc-b-once`, 800 ms, `--ease-arrive`); a dashed ghost centre lands at 800 ms | "Your agent is already here." Made with you this morning; read fourteen memory entries; the centre lands when you enter | the closed ring with its ghost centre |
| 3 · The sky | 0:18–0:40 | the camera pulls back (900 ms, `--ease-mark`); the other rings draw in (`stroke-dashoffset` 1 → 0, 450 ms, 120 ms stagger); their centres pop (`dot-once`); names and points fade in after their arcs; the baton halos and running dots breathe | "Who is in, and where." A reading of four lines: Ana, Bo, Cy with the baton in their sessions; *Tax lines* is yours and your agent's, it waits for you | the finished sky, no halos |
| 4 · Your agent | 0:40–1:02 | the sky dims to 26 % except Tax lines; the agent's half of that ring breathes with an apricot aura (the kinetic mark's *thinking*); the agent's lines rise in 120 ms apart | Dee's agent, in the ledger column with its square in the gutter: plan first, two ratings, Bo and Cy hold the gate, it hears what mentions it, it claimed `invoice/tax.ts` and drafted a three-step plan; byline "read 14 memory entries · 1 plan drafted · 0 tokens spent on you yet" | the dimmed sky, the words in place |
| 5 · The session | 1:02–1:20 | the camera leans in to 1.45× on Tax lines; the other rings fall to 14 % and lose their names; one cream card rises in the column | "Tax lines: proration on the invoice PDF" · who sits with you · Manners as three drawn ticks · Budget 40k today, 4.2k planned · **Enter the circle** (chocolate on cream) with "The stream will say *Dee joins the circle.*" · "Not yet? Open the demo session · the brief stays in Inbox." | the card, the hand |
| 6 · You join | 1:20–1:30 | the sky fades; the page slides in from the right over 800 ms on the mark's curve and leaves the lacquer as the 296 px rail; the rail's cards rise 36 ms apart; the join line's 40 px mark settles once; Dee's avatar ripples as the centre lands; the score folds to its hairline | the rail (Invoice rollout · Cy and Dee; Tax lines active "just joined · plan ready · 0"), the topbar "Tax lines · Team", the join line "**Dee** joins the circle. From the welcome brief · 2 here · Dee has the baton", Ana's team message, the agent's "Ready when you are" with its plan chip, the composer as a bottom rule: "Say something · reaches Dee's agent at its next step" | the page in place, the join line's closed ring |

The score at the foot is one hairline with six ticks (serif name over mono time), an apricot playhead
and the elapsed share filled; each tick is a button. Keys: `1`–`6` jump, `←` `→` step, `Space` plays or
pauses, `Esc` skips to the session. "Skip to the session" sits top right until beat 6. A polite live
region speaks each beat's first sentence once.

The topbar (beat picker, Play, 6×, Calm, Dark) and the storyboard strip beneath the stage are the
exploration's own; the product ships the stage alone.

## Why it is ours

- **It is the mark, played once, with the room as its reason.** Beat 1 is the hold; beat 2 is the
  founder's gesture, two arcs swinging in from ±60° and closing (BRIEF; MOTION §4.1–4.2, the `once`
  run); the centre is a dashed ghost because a ghost centre means *not yet in the circle* and the dot
  pops only on a join (SYSTEM §5; MOTION §8). The join happens in beat 6, in the stream, where
  `welcome-agent`, `onboarding` and MOTION §7.3 say it belongs: the brief never plays it twice.
- **The ring you just watched close is a session in the sky.** The camera pulls back and the closed ring
  is Tax lines, drawn exactly as `sig-presence-constellation` draws every open session: hairline arcs, the
  person's share in lifted chocolate on the right, the agent's in apricot on the left, a point for a
  person and the rounded square with the tight corner for an agent (SYSTEM §12), the baton holder with
  the driver ring and the breathing halo, the crew thread as a dotted bow (generative-visuals §6 "the seam
  is stitched, not walled"). Brand and data are one drawing; the newcomer learns the mark by watching it
  become the roster. presence-and-agents §4 ("nobody is in a separate list") and premium-product-ui §2
  (the two-arc ring as the "who is here" indicator) asked for this.
- **The agent introduces itself as a colleague, in the column everyone writes in.** Beat 4 is
  ai-interfaces-avoid §1's ledger column (author mark in the gutter, no bubble) and presence-and-agents
  §10's same byline ("read 14 memory entries · 1 plan drafted"); it speaks the house manners in the
  product's voice (BRIEF: "The plan waits for two ratings"), names the people who hold its gate, and says
  the hearing rule `welcome-agent` settled ("I answer as your agent, never as you"). No sparkle, no
  "AI-powered", no robot: the square with the status dot is the only sign of what it is
  (ai-interfaces-avoid §6).
- **One glossy object, one sheet of paper, one gradient.** The stage is three-colour-brands §7's navy
  lacquer with the paper-grain tile (generative-visuals §3, rendered once at 240 px, 7 %). The session
  card in beat 5 is the one cream object on it, so the hand can be chocolate (SYSTEM §1.4: a filled
  chocolate thing always means "press me"), and on the navy the only hand would have been the
  highlight (SYSTEM §15). The rail's New session is the one gradient on the screen (SYSTEM §1.7) and it
  appears only when the rail does.
- **"We fly instead of teleport"** (Family, in motion-choreography): the camera is one `<g>` with one
  transform; the lacquer does not cut to the app, it *becomes* the rail as the page slides in; the ring
  does not get replaced by a roster, it is zoomed out of. Each beat is a different height of text in the
  same column so progression is unmistakable (Family's trays, premium-product-ui §3).
- **Editorial type doing three jobs.** Fraunces at 44/48 for the one sentence per beat, SOFT 50 and no
  wonk (editorial-type §1's masthead on the axis), Inter for everything read, mono for the clock, the
  tokens and `invoice/tax.ts` (editorial-type §6–7; SYSTEM §3). Names are serif wherever they occur, in
  the sentence, on the sky, in the rail.
- **Rest is the end state** (MOTION §1.2, §3, §11). Every beat is a finished still; the screenshots are
  rest frames; a deep link opens parked at rest. Under Calm the camera cuts, the arcs sit closed, the
  centres are present, the page is in place, and the clock still advances the beats on a timer so the
  brief still takes its ninety seconds and still ends in the session.
- **Not Claude's, not ChatGPT's, not Linear's.** No centred input, no suggestion chips, no "what can I
  help with", no purple, no glow-on-black, no confetti; a navy lacquer with cream paper on it and a sky
  drawn in the brand's two arc colours. The nearest thing elsewhere is a product tour with dots and
  Next; this has a clock, a camera and a voice (three-colour-brands "take the discipline, not the hue";
  ai-interfaces-avoid "the artifact becomes the interface").

## The technique

- **One scene, one camera.** The sky is an inline SVG sized to the stage (`viewBox` = stage pixels,
  re-laid on resize). Every ring lives inside `<g class="cam">`; a beat's camera is one CSS `transform`
  (`translate(ax − s·cx, ay − s·cy) scale(s)`) that puts Dee's ring at the anchor: 2.2–2.4× for beats 1
  and 2, 1× for 3 and 4, 1.45× for 5. The transform transitions on `--t-cam` (900 ms, `--ease-mark`);
  strokes scale with the camera, so the hero ring's 4.4 stroke reads as ~10 px, the sky's 2 as 2.
- **Beats are a number.** `data-frame="1…6"` on the stage; every state is CSS keyed on it
  (`.scene[data-frame="3"] …`). JS does three things: lays out the sky, sets the frame, runs the clock.
  The storyboard thumbnails are the same markup and the same selectors inside a `.scene` of their own,
  parked at their beat, so the strip can never drift from the stage.
- **Drawing on a ring is one number.** Arcs carry `pathLength="1"` with `stroke-dasharray: 1 1.1`;
  the undrawn state is `stroke-dashoffset: 1.03`, not 1, because a zero-length dash with round caps
  still paints its cap as a dot (the first shot had a stray apricot point for exactly this). Stagger is
  `transition-delay: calc(var(--i) · var(--t-stagger))` so Calm, which zeroes the clock, also zeroes the
  stagger. Names, points and centres wait `--t-draw` after their arc.
- **Rotation about a ring's centre** uses `transform-box: view-box` with an inline `transform-origin`
  at the ring's centre, so the arcs swing on the mark's own pivot at any camera scale. Only
  `transform`, `opacity`, `stroke-dashoffset` and `stroke-width` animate; nothing changes layout.
- **The guard.** All keyframe rules sit in `@media (prefers-reduced-motion: no-preference) {
  :root:not([data-motion="calm"]) … }`; transitions read the clocks (`--t`, `--t-slow`, `--t-draw`,
  `--t-cam`, `--t-stagger`, `--t-paper`) and both Calm and reduce set them to 0. Rest states are
  written once outside the guard. `play()` reads `motionNow()` and, under Calm, advances beats on a
  plain timer instead of the `requestAnimationFrame` clock (MOTION §3: never wait on `animationend`).
- **First paint is never a swing** (MOTION §4.4). `html.boot` zeroes the clocks for two frames and
  `[data-parked]` holds the once-runs until the first interaction, so `#f=3` opens as the finished sky
  and the screenshots are rest states.
- **The handoff into the app** is a layer: the page (`.paper`) slides in from `translateX(104%)` and
  stops at `left: var(--rail-w)`, leaving the stage's own navy as the rail; the rail's content and the
  stream's lines rise with staggered delays after `--t-paper`. On the phone `--rail-w` is 0 and the
  topbar is the navy sentence-titlebar (SYSTEM §17).
- **Phone.** The words take the top 46 % and the sky the bottom; the agents' and people's names come off
  the sky (the sentence names them), the crew name too; the score shows only the current tick's label.

## The cost

Measured headless (Chromium, 1440×900).

| Situation | DOM / bytes | animations | notes |
|---|---|---|---|
| The sky | 58 SVG nodes, 5.0 KB markup, laid out once per size | | a resize re-lays and re-parks; the thumbnails add 5 × 58 nodes once |
| Beat 3 at rest | | 7 running (3 baton halos, 3 status dots, 1 join-line hold) | compositor transform/opacity loops at 0.55 Hz; no per-frame JS |
| Beat 3 after a jump | | 10, 8 running | the once-runs (`dot-once` × 3) end and leave the rest state |
| Beat 4 | | 9 running | the aura and arc breath join; the dimmed rings still breathe |
| Beat 6 settled | | 7, 4 running | the rail's running dots; the mark, ripple and paper slide are over |
| Calm, any beat | | 0 | verified `document.getAnimations().length === 0`; arcs `transform: none`, ghost at .85, paper at `none` |
| Playing | | | one `requestAnimationFrame` loop moves the playhead (two style writes per frame); the beats change at most six times; 6× rehearsal reaches beat 6 in 13.7 s |

`stroke-dashoffset` and `stroke-width` transitions paint on the main thread; at these sizes (four rings,
2 px strokes) it is a handful of pixels. The grain is a tile, not a filter. `mix-blend-mode: screen` on
the single aura creates one stacking context. Fonts are not fetched; the page costs what a static page
with one SVG costs.

## How it ports into `apps/web`

The brief sits between the invite and the first session: `views/Home.tsx` renders `FirstRun` on `#/`,
whose step 3 ("A session") is where Dee enters today. The brief replaces that step for a member who
has just accepted an invite and has not yet opened a session, and hands off to `SessionView` with the
join line's second line reading "From the welcome brief".

1. **`apps/web/src/brief.ts`** (new): the layout and markup from `index.html`'s `<script>` as pure
   functions. `layoutBrief(sessions, people, me, width, height) → { rings, cams }` (positions as
   fractions of a sky box, the camera transforms per beat) and `renderSky(layout) → string`. Input is
   what `views/Team.tsx` already builds for the constellation (`SessionRow` with `people[].driving`,
   `crew`, `live`), plus `me` (the newcomer's id). Share the arc and point drawing with
   `sig-presence-constellation`'s `constellation.ts` when that lands: one ring drawer, two callers.
2. **`apps/web/src/views/WelcomeBrief.tsx`** (new): the stage. `<section class="brief" data-frame>` with
   the inline sky, the six `.beat` blocks, the `.app` layer (rail content from `Rail.tsx`'s card
   markup, the paper with a static stream preview), the score and the skip. State: `frame`, `clock`,
   `playing`. It reads `useMotion()` from `theme.ts`: under `"calm"` it advances beats with
   `setTimeout`, never waits on an animation, and marks the stage parked on a cold open. Keys go
   through `useShortcuts.tsx` so they never fire inside a field. "Enter the circle" calls
   `createSession` from `projectClient.ts` with `policyOf(true, budget)` from `FirstRun.tsx` and
   `navigate(paths.session(projectId, id))`; "Open the demo session" is `openDemoSession` from
   `empty.tsx`; "the brief stays in Inbox" is a row in `inbox.ts` that reopens it at `#/welcome`.
3. **`apps/web/src/router.ts`**: a `welcome` route (`#/welcome/:projectId`); `Home.tsx` sends a
   member whose `me.joinedAt` is within the invite window and who has no session there instead of
   `FirstRun`. `FirstRun` stays for the terminal-first path and for returning people.
4. **`apps/web/src/copy.ts`**: `copy.brief` with the six beats' sentences, the reading lines
   ("has the baton in", "is yours and your agent's. It waits for you."), the agent's introduction as a
   template over the real memory count, claimed path and plan estimate, the card's rows, "Enter the
   circle", "The stream will say", and `copy.join.from("the welcome brief")` for the join line's second
   line in `stream/Message`.
5. **`apps/web/src/ui.tsx`**: `Mark` already has `settle`; the join line in beat 6 uses it as the stream
   does. Add nothing to `Mark`; the hero ring is the sky's `me` ring at camera scale, not a `Mark`.
6. **`apps/web/src/tokens.css`**: the clocks `--t-draw 450ms`, `--t-cam 900ms`, `--t-stagger 120ms`,
   `--t-paper 800ms` beside `--t-slow`, zeroed in the Calm and reduce rules; the keyframes
   `ghost-in`, `breath-aura`, `breath-arc`, `halo-breathe` (the others exist); the `--sky-*` and
   `--stage-*` properties in the light block and both dark blocks (`--stage` stays `#2A3244` in dark,
   like the mark's disc). `--sky-person-lift` is the rail's 62 % lift of the person's arc (SYSTEM §5).
7. **`apps/web/src/styles.css`**: the rules under "the stage", "the sky", "per-beat rest states", "the
   column of words", "beat 6" and "the score" from `index.html`, with the guard block's animation rules
   inside the existing `prefers-reduced-motion: no-preference` + `:root:not([data-motion="calm"])`
   block and the rest states outside it.
8. **Server**: the agent's introduction needs what `welcome-agent` asked for, a `session.briefed`
   event (or the turn-0 brief) carrying memory count, claimed paths and the drafted plan's steps and
   estimate; until it exists the beat reads from the plan card the agent has already posted.

Accessibility (SYSTEM §18, MOTION §11): the stage is a labelled region with a polite live line that
speaks one sentence per beat; every tick, the skip and the hand are buttons with names; the sky is
`aria-hidden` and its facts are in the reading; status is a word beside every dot; nothing flashes
(the halos are 0.55 Hz, the breath 0.55 Hz); the focus ring is `--focus-ring`, never the pulse; under
Calm the brief still runs its ninety seconds and still ends in the session.

## Open

- **Chocolate on the lacquer at hero size.** The person's arc in beats 1–2 is pure chocolate on Dress
  Blues (the mark on its disc, 1.7 : 1), which is the brand's own contrast but reads quiet on a large
  empty stage. The rail's 62 % lift is used for the hairline rings; whether the hero arc should take a
  lighter lift too, or the stage should carry a faint apricot wash behind the ring, is the founder's
  call. Show both at 2.3× before shipping.
- **Ninety seconds is a promise.** The beats are 6 / 12 / 22 / 22 / 18 / 10. Beat 4 is the longest
  read; if the agent's introduction grows (more memory, more claims), the clock should stretch rather
  than the text shrink, and the first line should say the new length.
- **A team without a sky.** A newcomer to a team with no open sessions sees beats 1 and 2 and then an
  empty sky. Beat 3 should then read "Nobody is in yet; you are first" and show the one ring, and beat
  5's "who sits with you" goes away (the `onboarding` exploration's same question).
- **The agent that has not read anything.** The byline assumes the agent read memory and drafted a
  plan before Dee arrived (the server would need to run it at invite time). Without that, beat 4 is its
  manners alone and the plan chip in beat 6 disappears.
- **Replay.** The brief should be replayable from Inbox and from the help menu; the exploration's
  `#f=N` deep links are the prototype of that. Whether a lead can edit the sentences (Team look editor)
  or only the project's name and the manners is open.
- **The handoff into a live stream.** Beat 6 shows a static preview; in the app the paper should be the
  real `SessionView` mounting under the slide, which means the slide is a route transition. If that
  proves heavy, the fallback is beat 6 as drawn here followed by a plain `navigate`, with the join line
  playing once more in the real stream (MOTION §7.3 forbids playing it twice; the preview would then
  show the closed ring and let the real one settle).
