# mark-motion · The mark in motion

## The idea
The ring is the team and the gap at the top is the seat kept for whoever comes next; when a person, an agent or a reconnecting session joins, the bead fades in at the far side of the ring, runs round it, overshoots the gap by a hair and settles, and a thin apricot halo breathes once. One set of CSS keyframes (`bead-travel`, `bead-trail`, `bead-settle`, `bead-halo`) drives every size from 16 px to 256 px; the loop version (3.2 s, with a hold and a fade-out) is the loading screen and the reconnecting toast, the once version (1.4 s, `fill: both`) is the joined-the-circle line in the stream and the splash. The page shows it live, as an eight-frame storyboard with a timeline, as a keyframe and easing spec, and in its three homes with Payments-team content (Bo, Cy, Dee already in the Billing page · Checkout session, Ana and Dee's agent joining, the proration plan on the invoice PDF).

## Keep
- The trail is the bead's own chocolate at 55 %, and its length follows speed: longest on the left side, gone by the time the bead reaches the gap. It makes the motion legible at 48 px and disappears politely.
- The hand-keyed overshoot (+9° then −3°) rather than a spring: the mark must land identically everywhere, including in a screenshot.
- The halo only after the settle; nothing else moves on the mark once the circle is complete.
- A join is a line in the stream, not a modal: 48 px mark once, the newcomer's avatar ripples into the stack as the bead settles (+0.9 s), copy says who, how, how many are here. Agent joins reuse the card with the name in the hand colour and the crew.
- Leaving is a quiet divider with no motion: the ring does not open again.
- Calm mode and `prefers-reduced-motion` give the completed mark with no trail or halo, same markup.
- The bead is fixed to Chocolate in both themes (`--mark-bead: #56352D` on the page). In dark mode `--accent` turns apricot and the token default makes the bead vanish on the ring.
- The loading screen is plain navy with the weave bar as the real progress and the list of what is already folded bottom-left; the splash is the only screen with the brand gradient.

## Open questions
- `tokens.css`: `.avatar.agent` collides with the rail's `.agent` card class (padding, flex column) and breaks every agent avatar; this page overrides it locally, the token should rename one of them.
- `tokens.css` `--mark-bead` defaults to `var(--accent)`, which is apricot in dark. Should the token be a brand constant, or should team customisation be allowed to recolour the bead (and then what keeps it visible on the ring)?
- Should a session reconnecting use the travelling bead at all, or only the halo, so the loop is reserved for first loads?
- Below 24 px the spec says fade-in at the gap only. The favicon could also show a tiny dot in the gap while an approval waits; is that too much for a tab?
- Exit from the loading screen: finish the current loop's settle (up to 1 s of waiting) or cut straight to the stream?
- The storyboard frames are generated from a small script in the designer's scratchpad; if the angles change the frames and the keyframes must change together. Worth a single source of truth in the design folder.
