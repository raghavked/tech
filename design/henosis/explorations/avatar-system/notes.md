# Avatar system · notes

## The idea
One element, two shapes: a person is a circle (two initials as the name is written on one of four palette washes, or a photo), an agent is the rounded square with one tight bottom-left corner, the brand gradient and the mark's centre inside, and both take exactly the same sizes, presence dot, driver ring, away fade and stack rules, so a person and her agent sit in a stack as two members of one circle and never as a user and a tool. Size is a single variable (16 to 120) from which the initials, the dot and the baton scale, and the 2px cut-out edge takes the colour of the ground it sits on (canvas, card, rail, team message), so stacks cut cleanly everywhere. The board sets the anatomy, the eight sizes with where each lives, eight states, the stack order (baton first, people, then agents, four then "+n"), the element inside the rail, the stream and the Team panel, six don'ts, and the props and CSS that would replace `.avatar` in tokens.css.

## What to keep
- Shape says the kind of member; nothing else does. Tints are identity and never change with state; a state is a dot, a ring or a fade.
- Initials from 40 up set in Instrument Serif: a name is a name. Below 24 the agent keeps only the apricot centre at double size.
- Rings mean the baton (deep apricot, 2px at a 2px gap; the baton disc from 40 up); presence is the dot, bottom-right, cut out with the ground. A green ring for "online" is a don't.
- Away is a fade (15% saturation, 60% opacity, photo to grey) plus a hollow dot; an agent is never away, it is paused with a slate dot at full colour.
- Agents never take the driver ring; they say what they are doing with running / waits at the gate / blocked / paused.
- `--edge` set once by the ground (`.rail`, `.card`, `.msg.team`); solid palette tints on the rail with dark ink instead of mixes.
- The presence dot class is `.pr`, not `.dot`, so it never collides with the mark's dot or the rail card's status dot.
- Stack order: driver, people, agents; overlap 28% of the size; four shown then "+n" in mono on surface-2.

## Open questions
- The mark's person arc is chocolate, but chocolate on the navy→chocolate gradient vanishes below 40px, so the agent avatar draws it in cream. Is that an acceptable departure from "both arcs keep their colour", or should the agent fill be flat navy so the chocolate arc can stay?
- The named-agent variant (owner's italic initial, centre tucked top-right) solves two agents side by side; is it worth a second agent face, or should crews always carry a caption?
- Tints are hashed from the id; should a person be allowed to pick theirs in Settings, and should an agent carry its owner's tint somewhere (a hairline, the dot) so the pair reads across a roster?
- Dee is "in the session, not in the room": does an away member count toward the stack's four, or go to "+n" first?
- The ripple on join is one-shot; should an agent connecting also play the arcs-close motion at 56 and up (profile, join the circle), or is the ripple enough?
- Photos: do agents ever get one (a team emblem), or is the rounded square with the centre always their face?
