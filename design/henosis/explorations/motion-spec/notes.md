# motion-spec · Motion spec sheet

## The idea
One sheet holds every animation in Henosis as a live demo beside its spec: the three clocks (120 / 200 / 320 ms) and the three curves (arrive, leave, move) plus the mark's own curve, the four loaders as pictures of something becoming one, eleven side motions for joining and living, the hover/press/focus transitions, and an index of every keyframe set with its trigger, duration, easing and what Calm shows instead. The join is laid out as a timeline ("Ana joins the circle." in Billing page · Checkout: line rises, arcs settle, dot lands, avatar ripples, badge pops, pulse starts) so the order and the overlaps are decided once. A Full / Calm toggle on the sheet (CSS `:has`, no script) shows the whole thing as a team with Calm on would see it, and the Calm section puts the same Payments stream side by side with motion on and off.

## Keep
- Rest is the end state: every keyframe set ends at the element's natural styles, so Calm and reduced motion are one guard (`@media (prefers-reduced-motion: no-preference) { :root:not([data-motion="calm"]) … }`) and need no script.
- Three durations, three curves. The mark keeps its own curve (.3,.9,.3,1) and hand-keyed overshoot (−4°, +2°); the badge pop overshoots in its keyframes (1.15× at 60 %) and stays on arrive.
- One loader per meaning: arcs close = the app joins you, orbit = you join people, weave = rows arrive, shimmer = words arrive. Calm frames are the finished frames: closed ring, dots stacked as one, a plain strand, flat lines.
- The join order: line 0–320 ms, arcs 0–800 ms, dot 550–1000 ms, ripple 900–1800 ms, badge and pulse from 1000 ms, Team pill only on the first join. Nothing overlaps the mark's swing except its own line. Leaving has no motion.
- Calm keeps colour and state (green dot, apricot pill, drawn check) and the focus ring; only the change is instant. Toasts keep their 4 s clock.
- Demo loops for once-animations run on a 2.6 s cycle with the real timing as the first part; negative delays put the still frame on the settled state so a screenshot reads correctly.
- The mark's arcs are fixed to Chocolate and Apricot on the navy disc; the orbit's chocolate dot turns apricot-deep in dark, its third dot is `--ink`.

## Open questions
- `design/henosis/tokens.css` and `apps/web/src/tokens.css` drift: the design file still has `pulse`, `orbit`/`converge`, `weave` as a background slide and `rise`; the app has `dot-live`, `orbit-1/2/3`, `weave-slide/over/under` and `card-in`. This sheet specs the app's values. The design tokens should be brought over so explorations and app agree (and the design file's `@media … (data-motion="calm")` guard is not a valid media query).
- The ring-draw keyframes (`ring-draw`, 176 units) exist in the app tokens but no rule plays them; the index lists them for onboarding. Keep or remove?
- `.send.pressed` and `.pill .w` need the component to add and remove the class; `useMotion()` is the hook for that. Should the stream's `.enter` be removed after the first paint so re-renders do not replay the rise?
- The team-colour crossfade transitions registered custom properties on `:root` (500 ms). Every element reading `--team-accent` repaints for 500 ms on a route change; worth measuring on the fleet board with many rows.
- Size budget: a 1440-wide full-page PNG of this board is 1 MB from Chromium. The folder keeps the viewport shots from the given script (quantised to 96 colours with a small pure-Python script, no external tools) and a half-scale (720 px) board as `shot-board.png` at 64 colours; the whole folder is under 300 KB. If reviewers want the full-resolution board, the budget should exclude screenshots.
- The Calm toggle uses `:has()`; fine for the sheet, but the app sets `data-motion` on `<html>` from the team look. The sheet does not show the Settings control itself (that is the Team look editor's exploration).
