# Icon set: rationale

**Decision.** Twenty-eight glyphs in one inline sprite, drawn on a 20-unit grid with a 1.5-unit stroke, round caps and joins, no fills, and a 2-unit safe inset. Every symbol inherits `currentColor`, so colour is set on the row (grey for event lines, ink for buttons, the accent only under the send arrow) and never on the icon. The vocabulary follows the product: nouns first (session is the brand mark's turned corner drawn as a line; agent is the avatar's square with one sharp corner), then the verbs people do to a session. Fork and fold are a mirrored pair, two new ends against one way back; branch is the noun with nodes; conflict is a diamond with a mark, not a warning triangle; claim is a planted flag. The chevron is one symbol turned by a class, the only rotation in the set.

**Rejected.** A 24px grid (reads heavy beside 15px text at 1.5 stroke). Filled or two-tone glyphs (a second colour on every row). State icons for running, paused and blocked (status stays a word with a dot). A hand for hand-off and a brain for memory (illustrative, not line grammar). Arrowheads on fork (it read as a pitchfork).

**Carry forward.** The sprite and `.ic` class as-is; 14 in event lines, 16 in rows and the sidebar, 20 in 34px icon buttons, 24 in empty states; aria-labels on every icon-only button; recents carry no icon.
