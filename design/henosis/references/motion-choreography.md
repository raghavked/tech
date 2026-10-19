# Motion choreography for Henosis

Henosis is one session where a team's people and agents work together. If a person and an agent arrive, hand off, wait and finish with the same physics, unity stops being a slogan. What the best product motion does today, with sources, then ten elements we can build.

## What the best work does

**Springs, chosen for interruptibility rather than bounce.** Motion.dev documents two spring families: physics springs (`stiffness`, `damping`, `mass`) that inherit the velocity of a gesture already in flight, and duration springs (`duration` + `bounce`) that can be exported as pure CSS `linear()` curves (https://motion.dev/docs/react-transitions). Material 3 Expressive explains why springs beat tweens: when an animation is retargeted mid-flight, a spring carries its current velocity into the new destination instead of restarting (https://m3.material.io/blog/m3-expressive-motion-theming). Josh Comeau: most spring use is not bouncy; high-friction springs still feel alive (https://www.joshwcomeau.com/animation/a-friendly-introduction-to-spring-physics/).

**Split spatial from effects.** Material's physics system keeps two token families: spatial springs for position, size and shape (expressive default: damping 0.8, stiffness 380, allowed to overshoot) and effects springs for colour and opacity (critically damped, damping 1.0, stiffness 1600) because alpha must never bounce past 100% (https://m3.material.io/styles/motion/overview/specs, https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md). Their web table gives usable curves: spatial `cubic-bezier(0.38, 1.21, 0.22, 1)` at 500ms; effects `cubic-bezier(0.34, 0.80, 0.34, 1)` at 200ms.

**Easing and origin decide the feel.** Emil Kowalski's rules: default to ease-out for things entering, ease-in-out for things already on screen that move, never the built-in curves for anything beyond a hover, and set `transform-origin` to where the trigger is so a popover grows from its button (https://emilkowal.ski/ui/good-vs-great-animations). His Vaul drawer borrows the iOS sheet curve, `transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)`, damps drag past the top edge, and uses flick velocity to dismiss (https://emilkowal.ski/ui/building-a-drawer-component). For tabs he uses `clip-path: inset()` so the highlight and the text colour travel as one surface (https://emilkowal.ski/ui/the-magic-of-clip-path).

**Choreograph continuity, not spectacle.** Benji Taylor's Family essay is the clearest statement: "we fly instead of teleport"; each successive tray differs in height so progression is unmistakable; `Continue` morphs into `Confirm` by keeping the shared letters; a component already on screen never duplicates itself, it travels (https://benji.org/family-values). Rauno Freiberg adds that great interactions are modelled on real-world properties, chiefly interruptibility, and gestures keep the momentum they were thrown with (https://rauno.me/craft/interaction-design).

**Loaders should carry meaning.** Rive's state machines bind animation states to boolean, number and trigger inputs, so a progress ring can show the real 73% and switch to success on a trigger (https://rive.app/docs/editor/state-machine/state-machine). The rule from the comparisons is "Lottie for motion that plays, Rive for motion that responds" (https://www.shaheermalik.com/compare/rive-vs-lottie). Jhey Tompkins' CSS loader builds its geometry from `--index` and `--count` and spins with `steps(var(--count))`, a loader whose shape is data (https://web.dev/articles/speedy-css-tip-animated-loader). Family moves the spinner into the bottom navigation on confirm so waiting travels with the task instead of blocking it (https://60fps.design/apps/family).

**Calm under reduced motion.** web.dev covers vestibular triggers and the `prefers-reduced-motion` query (https://web.dev/articles/prefers-reduced-motion). Apple's Reduced Motion criteria are more useful than "turn it off": keep animation that carries meaning, such as a status change or hierarchy transition, but replace movement with a dissolve, highlight fade or colour shift; stop ongoing or auto-advancing motion; avoid spinning, scaling and depth effects (https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/). Apple's vision scientists add one number: avoid sustained oscillation near 0.2 Hz, one cycle per five seconds (https://developer.apple.com/videos/play/wwdc2023/10078/). Jhey wraps every scroll-driven effect in `@media (prefers-reduced-motion: no-preference)` and `@supports` so the enhancement is opt-in by default (https://craftofui.substack.com/p/scrolling-a-page-out-of-the-playbook).

## Henosis motion tokens

```css
:root {
  --spatial: 500ms cubic-bezier(0.38, 1.21, 0.22, 1);   /* moves, grows, travels */
  --effects: 200ms cubic-bezier(0.34, 0.80, 0.34, 1);   /* colour, opacity, blur  */
  --sheet:   500ms cubic-bezier(0.32, 0.72, 0, 1);      /* trays and drawers      */
}
@media (prefers-reduced-motion: reduce) {
  :root { --spatial: var(--effects); --travel: 0px; }
}
```

People and agents share these tokens. Hue is the only difference: people in Dress Blues, agents in Apricot Illusion, both on cream, both outlined in Chocolate Fondant.

## Ten elements for Henosis

1. **The Closing Ring (session loader).** SVG: two arcs with `pathLength="1"` and `stroke-dashoffset` animated from 1 to 0 on `--spatial`, each arc starting from opposite sides. Screen: session open and reconnect. Unity: the brand mark is a person's arc and an agent's arc; the ring only closes when both are present.

2. **Same-spring cursors.** CSS: `translate` on each cursor with `transition: translate var(--spatial)` driven from a shared `--x/--y`, agent cursors Apricot, human cursors Dress Blues. Screen: shared canvas and document. Unity: identical physics for every participant; the colour tells you who, the motion says you are the same kind of thing.

3. **Turn baton.** CSS: avatar ring as `conic-gradient(var(--c) var(--turn), transparent 0)` with `@property --turn` animated on `--spatial` as the active speaker changes. Screen: thread header. Unity: one ring, one segment, passed between person and agent rather than two separate "typing" states.

4. **Shared-letter label morph.** CSS/JS: per-glyph spans with FLIP, letters common to `Ask` and `Approve` stay put while the rest fade on `--effects`, from Family's Continue to Confirm. Screen: composer button. Unity: one control, whether you are talking to a colleague or directing an agent.

5. **Origin-aware result cards.** CSS: `transform-origin` set from the avatar's coordinates via custom property, revealed with `clip-path: inset()` on `--spatial`. Screen: thread. Unity: an agent's output grows from the agent, exactly as a person's attachment grows from theirs.

6. **Progress arc bound to real work.** SVG: `stroke-dashoffset: calc(1 - var(--progress))` where `--progress` is steps done over steps planned, with a Rive-style success trigger at 1. Screen: agent task panel. Unity: everyone sees the same honest arc, and it becomes the Closing Ring at completion.

7. **Staggered roster arrival.** CSS: `animation-delay: calc(var(--i) * 40ms)` with ease-out slide of 8px and fade on `--effects`. Screen: participants sidebar. Unity: people and agents enter one list in one cadence; no separate bots section.

8. **Permission tray.** CSS: bottom sheet on `--sheet`, each successive tray a different height, background scaled 0.97 behind it. Screen: approvals and permissions. Unity: an agent asking for access uses the same tray a colleague uses to ask a question.

9. **Breathing work indicator.** CSS: `background-position` sweep of an Apricot gradient over Chocolate text at a 1.6s period (well away from 0.2 Hz), replaced by a static dotted underline under reduced motion. Screen: thread, while an agent works or a person types. Unity: same rhythm for thinking and typing, hue alone differs.

10. **Dissolve fallback layer.** CSS: every spatial animation declares an opacity sibling; `@media (prefers-reduced-motion: reduce)` zeroes `--travel` so entrances, trays and the ring resolve by fade and colour shift only. Screen: global. Unity: calm is the default for all participants, and the ring still closes, by opacity instead of travel.
