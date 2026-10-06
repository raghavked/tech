# Session view, dark · notes

## The idea
Dark mode keeps every role the palette has in light and re-weighs it instead of inverting it: the rail stays the frame and becomes the darkest thing on screen, the canvas sits one step above it and cards one step above that, so the three-level depth of navy / cream / white survives as near-black / navy / lifted navy. Depth comes from a one-pixel top highlight and hairlines rather than drop shadows (which vanish on dark), and apricot stays the pulse but as a hairline and a 9–16% wash, never a 30% block, so the live step, the team message and the Team pill glow instead of shouting. Dress Blues, the frame colour in light, returns as the mark's disc and inside the lifted navy→chocolate gradient, so the brand's three colours are all still present on a dark screen.

## What to keep
- The depth order: rail `#10141C` < canvas `#1A202C` < surface `#242C3C` < surface-2/3, with the tool output block (`#0E1218`) as the single surface darker than the canvas: the terminal is the deepest thing in the room.
- `--edge` (inset 1px top highlight at 5.5% white) on every raised surface (cards, buttons, raters, search, the active agent card) in place of shadow; shadows are kept only at 28–50% black under cards and the composer so they lift off the canvas without a halo.
- The status triad lifted two steps for dark (`--ok #8FC386`, `--warn #E2B06A`, `--danger #EA9384`) with 16% soft backgrounds, so "Running", "Approved", "by the team's ratings" and the `irreversible` chip all keep contrast on navy.
- The pulse as a hairline: the live step gets a 3px apricot-35% left bar on a 9% wash; the team message a 22% apricot hairline on a 9% wash; the Team pill becomes apricot text on an 18% apricot wash. The solid apricot is kept only for the inbox and approvals counts and the primary button.
- The release gate's stripe in dark runs apricot→chocolate top-to-bottom (the light gradient navy→chocolate is invisible on navy), and `--gradient-brand` lifts to `#3A4661 → #7A4B3E` for the new-session button and the agent avatar.
- The mark on the near-black rail: disc in Dress Blues `#2A3244`, arcs in apricot and apricot (via `--accent`), the centre dot apricot.
- Every dark value is a named knob at the top of the page style (`--edge`, `--out-bg`, `--team-wash`, `--live-line`, `--pill-team-bg`, `--stars-on`, `--gate-stripe`, `--code-bg`, `--note-bg`); the same markup produces both shots, so this is ready to fold into tokens.css as the dark half.

## Open questions
- In dark the tokens make apricot the hand (the primary button, links, the goal label) and chocolate disappears from the actions; is "Approve with 4" in apricot the right weight next to the apricot pulses, or should the primary be a lifted chocolate (`#7A4B3E`) so hand and pulse stay distinct in dark as they are in light?
- The tool output block in light is navy on cream; in dark it is near-black on navy. Should it carry a faint apricot top edge so a long output still reads as "the agent's terminal" rather than a hole in the page?
- The rail's active agent card uses a 12% apricot wash plus a 35% inset ring; on OLED screens the ring is the only thing that reads from across the room. Is the wash worth keeping, or should the active state be ring-only in dark?
- The quantized dark gradients (the new-session button, the gate stripe) are fine in the screenshot, but the real app should test the lifted brand gradient against the Team look editor's custom accents.
- Calm mode: with pulses off, the live step's hairline is the only "now" signal in dark; should calm mode keep the dot static rather than remove it?
