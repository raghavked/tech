# Error states · notes

## The idea
Every bad moment is told in four short parts, the way a colleague would tell it: what happened with a time on it ("the stream is as of 14:02"), what still works (the stream stays readable, your draft is held, the log lives on the server), what Henosis is doing about it ("again in 4s", "the agent read the denial and is working around it"), and one chocolate action (Retry, Steer, Resolve). Colour carries weight, not alarm: grey for the network, amber for things that wait, red only when a person said no or two branches disagree, and the card around the red stays the stream's own quiet surface. The mark loses its centre only when the server itself is gone (arcs 28° apart, the dot a dashed ghost, the same drawing onboarding uses before you arrive); a dropped socket keeps the full ring, because the circle is still there, we just cannot see it.

## What to keep
- The one grey connection line under the top row, with three parts: state, next attempt, Try now. Backoff is 0.5s → 15s in the app, so the line can name the next attempt honestly.
- Held, not sent: the composer keeps the draft, the send button goes grey, an amber chip says "Held until the socket is back"; the Details drawer lists what is held and promises "sent in order, nothing twice".
- Presence dims to 45% with "as of 14:02" while we cannot see who is here; the agent's half-written message stays at 50%.
- Server down takes the page: rail cards at half with "Last seen 14:02", the apart mark with the ghost centre, the host name, and a "What it last saw" box so a person can decide whether to wait or walk over to whoever runs the server. Retry is the one primary; the CLI line sits underneath.
- Plan rejected: steps after the rejection are struck, not hidden; the rejecting person's note is a serif italic quote; the "so what" line is the spec's words (stops until someone steers); the primary is "Steer towards a new plan".
- Approval denied: both votes stay on the card so the gate's arithmetic is visible ("one voice does not carry a gate"); the next line goes green once the agent has moved on; the only action is the calm one, ask again after the review.
- Unite conflicts: the divider uses the stream's own words ("United proration into main · 2 conflicts"), each path names who touched it on both sides with person and agent avatars, the clean files are listed at 72% so the count adds up, claims are kept until the driver resolves.
- The rail says each state in one line with a tag (Offline, Reconnecting, Plan rejected, Denied, 2 conflicts); server down has no rail line, the whole rail is the state.
- The Details drawer's new sections: Connection, Held for you, Waits on a person.
- Dark: the apricot primary reads on navy, red and amber tags soften to their -soft washes, the ghost centre still shows on the darker disc.

## Open questions
- `ReconnectLine` today shows only "Reconnecting…"; the attempt count and the next delay live in `Reconnector` but are not in the snapshot. Worth surfacing, or is the countdown noise?
- Held directives: the app drops what you type while the socket is down. Holding and replaying in order is new behaviour; should a held directive expire if the stream moved past its "safe point" while we were away?
- "What it last saw" on the server-down page needs a cached fold in the browser; is that acceptable (data left on a shared machine) or should the state say only the time?
- Should a rejected plan's struck steps collapse after a revised plan arrives, or stay as history in the stream?
- Unite conflicts name both sides from the fold; the names are right but "moved the subtotal block" is a model-written summary, which phase 0 does not have. Fall back to "changed 14 lines"?
- The rail's "Denied" tag is amber because the agent is working around it; is red right when the agent stops instead (an external action it cannot avoid)?
