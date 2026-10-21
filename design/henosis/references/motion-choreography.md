# Motion choreography for Henosis

Henosis is one session where a team's people and agents work together. The mark is two arcs closing into a ring; the motion should rehearse that: two kinds of participant entering, waiting, handing off and finishing under one physics. Sources read October 2026.

## What the best work does

**Ease-out in, under 300ms, never ease-in.** Emil Kowalski's rules are the baseline: ease-out for entrances and exits because they start fast; ease-in-out for things already on screen; `ease` only for hovers. Built-in curves are too weak, so he ships `cubic-bezier(0.23, 1, 0.32, 1)` for UI and the iOS sheet curve `cubic-bezier(0.32, 0.72, 0, 1)` for drawers. Durations: 100 to 160ms for press feedback, 125 to 200ms tooltips, 150 to 250ms menus, 200 to 500ms modals and drawers; bigger elements go slower, "the same way a truck takes longer to stop than a bicycle" (https://emilkowal.ski/ui/great-animations, https://emilkowal.ski/ui/7-practical-animation-tips, https://github.com/emilkowalski/skills/blob/main/skills/review-animations/STANDARDS.md). A faster spinner makes the same load feel shorter.

**Springs for anything a hand might interrupt.** Motion.dev splits physics springs (`stiffness`, `damping`, `mass`, inheriting the velocity of a gesture in flight) from duration springs (`duration` plus `bounce`, exportable as CSS); `visualDuration` fixes when motion visually arrives so the settle can be timed against tweens (https://motion.dev/docs/react-transitions, https://motion.dev/docs/spring). Material 3 Expressive then separates spatial springs for position and size (default damping 0.8, stiffness 380, allowed to overshoot) from effects springs for colour and opacity (damping 1.0, stiffness 1600), because alpha must never bounce past 100% (https://m3.material.io/blog/m3-expressive-motion-theming, https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md). In plain CSS, Jhey Tompkins shows a spring or bounce written as `linear()` stops, with the caveat that CSS still needs an explicit duration and bounces must never be applied to opacity (https://www.smashingmagazine.com/2023/09/path-css-easing-linear-function/, https://developer.chrome.com/docs/css-ui/css-linear-easing-function).

**Choreography: nearest the trigger first, then stagger.** Rauno Freiberg deconstructs the iOS search gesture into four states: whatever is nearest the finger responds first, the keyboard is delayed so it does not compete, and the order reverses when the overlay opens from a button. Siblings stagger like a flock, never in lockstep (https://rauno.me/craft/depth). His guidelines add proportion: dialogs scale from about 0.8, not 0; buttons press to about 0.96; interactions stay under 200ms; nothing transitions on a theme switch (https://interfaces.rauno.me/). Frequency kills novelty: context menus and command palettes used hundreds of times a day should not animate in; macOS only fades them out, with a blink on the chosen item (https://rauno.me/craft/interaction-design).

**Continuity over spectacle.** Benji Taylor on Family: "we fly instead of teleport"; tab switches slide in the direction tapped; Continue morphs into Confirm; a chevron becomes an X on the next screen; successive trays differ in height so progression is legible (https://benji.org/family-values). The recorded shots show a spinner leaving the confirm sheet and travelling into the pending transaction card, so waiting moves with the task instead of blocking it (https://60fps.design/shots/family-contextual-spinner-move-to-sheet-morph-interaction).

**Loaders that carry state.** Rive's loader is three timelines (idle, loading, done) on a state machine driven by `isLoading` and `loadingPercent`, so it shows real progress and designers can redraw it without engineering changes (https://rive.app/blog/interactive-loaders, https://rive.app/blog/state-machines-make-iteration-a-breeze-for-designers-and-developers). Duolingo's Lily blends eight head and eight body idles into 64 variations so a listening character never visibly loops (https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life). dotLottie packs state machines and themes into one file and freezes rendering offscreen (https://lottiefiles.com/dotlottie, https://docs.lottiefiles.com/en/runtimes/distributions/js/v0.x/advanced/performance).

**Calm under reduced motion means replace, not remove.** Apple's criteria: motion that carries meaning (a status change, a hierarchy transition) stays as a dissolve, highlight fade or colour shift; parallax, animated blur, spinning, scaling and auto-advancing content stop; sustained oscillation near 0.2 Hz is the frequency to avoid (https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/, https://developer.apple.com/videos/play/wwdc2023/10078/). Val Head's technique keeps duration, easing and stagger and swaps the animated property from transform to opacity (https://www.smashingmagazine.com/2020/09/design-reduced-motion-sensitivities/). Oriana Garcia's triage: colour and opacity changes need no adjustment; anything covering a third of the screen, looping, parallax or morphing is removed (https://www.smashingmagazine.com/2023/11/creating-accessible-ui-animations/). MDN is blunt that the value is `reduce`, not none (https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Using_for_accessibility).

## Tokens

```css
:root {
  --ease-out:   cubic-bezier(0.23, 1, 0.32, 1);       /* enter, exit            */
  --ease-move:  cubic-bezier(0.77, 0, 0.175, 1);      /* already on screen      */
  --ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);       /* trays                  */
  --spring:     linear(0, 0.33 8%, 0.71 16%, 0.97 25%, 1.06 34%, 1.03 46%, 0.99 60%, 1); /* coarse; regenerate with a linear() generator */
  --t-fast: 160ms; --t-ui: 220ms; --t-sheet: 480ms;
  --travel: 8px;
}
@media (prefers-reduced-motion: reduce) {
  :root { --travel: 0px; --spring: var(--ease-out); }
}
```

People are Dress Blues, agents Apricot Illusion, both on cream with Chocolate ink. Nothing else about their motion differs.

## Ten elements for Henosis

1. **Two arcs, one ring.** SVG: two `<path pathLength="1">` arcs, `stroke-dashoffset` from 1 to 0 on `--spring`, each from an opposite end. Screen: session open and reconnect. The left arc draws for the first person, the right for the first agent; the ring closes only when both are present.

2. **Trigger-first reveal.** CSS: `transform-origin` set from the trigger's coordinates via `--ox`/`--oy`, `scale(0.8)` to 1 with fade on `--ease-out` at `--t-ui`. Screen: thread. An agent's result grows from the agent's avatar exactly as a colleague's attachment grows from theirs.

3. **Flock stagger for the roster.** CSS: `animation-delay: calc(var(--i) * 35ms)`, `translateY(var(--travel))` and opacity on `--ease-out`. Screen: participants rail. People and agents arrive in one list, one cadence; there is no separate bots section.

4. **Travelling spinner.** JS FLIP on a single element: the composer's spinner animates to the task card with `translate` on `--spring`; no second spinner is ever created. Screen: composer to task panel. Waiting moves with the work, whoever started it.

5. **Shared-letter button morph.** Per-glyph spans with FLIP; letters common to `Send` and `Approve` hold position while the rest fade on `--t-fast`. Screen: composer. One control whether the message goes to a person or instructs an agent.

6. **Honest progress arc.** SVG arc with `stroke-dashoffset: calc(1 - var(--progress))` on `--ease-move`, where progress is steps done over steps planned; at 1 it becomes the ring of element 1. Screen: agent task panel. It is the same arc a person's checklist draws.

7. **Silent command palette.** No entrance animation; exit fades over 120ms; the chosen row blinks Apricot once. Screen: command palette and context menus. Used hundreds of times a day, and the same path routes instructions to agents.

8. **Permission tray stack.** Bottom sheet on `--ease-sheet` at `--t-sheet`, each successive tray a different height, canvas behind scaled to 0.97 and dimmed on an effects curve. Screen: approvals. An agent asking for access uses the tray a colleague uses to ask a question.

9. **Breathing indicator at 0.6 Hz.** `background-position` sweep of an Apricot-on-Chocolate gradient, 1.6s period, direction per author; a static dotted underline under reduced motion. Screen: thread. Thinking and typing share one rhythm; hue alone says who.

10. **Dissolve fallback.** Every spatial animation declares an opacity sibling; `--travel: 0` collapses slides, `--spring` falls back to `--ease-out`, and the reduced-motion query pauses the indicators. Screen: global. Calm is the default for every participant, and the ring still closes, by opacity instead of travel.
