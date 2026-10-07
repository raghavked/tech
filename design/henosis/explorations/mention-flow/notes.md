# The mention flow · notes

## The idea
One sentence travels three places and keeps its attribution at each: Bo's `@Checkout` in #billing is an agent mention (navy, serif, the agent's corner) that resolves by session id; in Cy's session it is an ordinary steer from Bo wearing a `#billing` origin tag and a scope line that says "answers in #billing"; back in the group the agent's next words are plain prose behind the navy→chocolate rule with "Cy's agent · replied · in reply to Bo · turn 13 · Open session". The storyboard shows the three screens from three people's chairs (Bo's, Cy's, Dee's), then the ledger that the replay sees and the four edge states the chat must say plainly (paused, plan waits, contention, not in the session). The chat never shows deeds; "Open session" is the only bridge to them.

## What to keep
- The flow strip: three nodes (group → session → group) with "Guaranteed:" lines; the session node carries the gradient edge, the group nodes the apricot one.
- The @ list: "People and agents in #billing" with the typed query echoed in mono, the matched letters in chocolate, the owner listed under the agent "not a match, listed for the owner", and the footer "Mentioning an agent steers its session; its next words come back here."
- The "Reached" line under Bo's message: tiny agent tile, "Reached Checkout · Cy's agent · steer in turn 13 · Open session"; it stays until the reply posts and becomes the paused/plan-waits line in the edge states.
- The origin tag in the session: a 22px apricot-soft pill with the hash in apricot-deep, "steered from the group" in faint sans, the bubble's edge in apricot-deep, and the mono scope line ending with "answers in #billing".
- The dashed "Its next words answer Bo in #billing as well as here" chip under the live turn, so Cy knows the reply leaves the room.
- The inbox toast on Cy's screen uses the same words as the inbox entry: "Bo mentioned Checkout in #billing · Steer in turn 13 · Open #billing".
- The ledger block in navy mono: chat.message → directive.submitted (origin chat, rank contributor) → turn.started (applied at the safe point) → chat.message (replyTo, turn).
- Edge cards with the status dot in the header and a one-line "what the chat says" strip in the surface-2/warn/danger wash.
- Mobile: frames stack, the titlebar drops the location, the ledger drops the event-name column, the toast spans the frame, the session stream leaves room under the toast.

## Open questions
- Rank: a mention from a group steers at contributor rank today; should the group's own roles (lead of Payments) lift it, or should a mention from someone who is not in the session always sit below the people who are?
- Should the agent's reply in the chat quote Bo's sentence (like a reply to a person does), or is "in reply to Bo" enough when the message is three lines above?
- When the agent asks a question back ("Who decides…"), the answer is typed as a new mention; should the reply carry a "Answer Checkout" affordance that prefills `@Checkout` and keeps the thread?
- The "Reached" line and the typing line ("Checkout ── answering Bo · turn 13") both sit under Bo's message; do they merge into one live line, or does the typing line belong at the bottom of the stream where a human's typing would be?
- If Bo opens the session from the chat he is an observer; should the session offer "Join as contributor" to the people in the group the owner belongs to, or keep the group as the only way in for them?
