# Chat view · notes

## The idea
A group is one circle of people and agents, so the header stack shows both kinds side by side (initials, then agent tiles with a live dot) and the Members drawer lists them under People and Agents with the same rows, plus "Add a person" and an agent picker that names its owner. In the stream a person speaks in a bubble (yours a shade warmer and on the right), while an agent's reply is plain prose behind a navy→chocolate rule with a meta line that says exactly where the words came from: "Billing page · Ana's agent · replied · in reply to Ana · turn 12 · Open session", and a plan chip when the reply carries a plan. Mentions are the bridge and look like what they mean: a person on apricot, you on solid apricot, an agent on navy with the agent's corner; the @ completion lists both kinds with their role line and ends with "Mentioning an agent steers its session; its next words come back here."

## What to keep
- Header: serif `#billing` with an apricot hash, purpose in sans beside it, the member stack split people | agents by a hairline, Members button in its pressed (apricot-soft) state when the drawer is open.
- Day dividers as small caps on a hairline ("Yesterday", "Today"); "New since you looked away · 2" as an apricot-deep rule with a pill, in chocolate, the only warm rule in the stream.
- Read markers as tiny avatar stacks right-aligned under the last message each person has read ("Ana and Cy read to here"), from the per-person reads the server already keeps; no ticks on every bubble.
- Agent reply: 26px agent avatar with the live dot, serif name, owner in faint sans, dot-separated meta, mono `turn 12`, and "Open session" as a small outlined chip that links to the session. A question the agent asks the people sits in italic serif.
- The plan chip inside an agent reply (name · steps · ~tokens · two stars · "waits for two ratings") links to the plan card in the session rather than repeating it here.
- A reply to a person carries a one-line quote with the serif name and an apricot-deep edge, no threads.
- The typing state: "Billing page · Ana's agent ── answering Dee · turn 13" with the weave loader; it tells who it answers and which turn is coming.
- The @ list: anchored at the caret, header "People and agents in #billing" with the typed query echoed, matched letters in chocolate, person rows with role, agent rows with "Ana's agent · Billing page · running", the selected row on apricot-soft with an ↵ key hint, and the footer that explains the steer.
- Mobile: rail and drawer fold away, the back chevron replaces the menu, the stack keeps you and the agents, the agent meta drops owner and "in reply to", the @ list spans the composer width.

## Open questions
- Read markers: one marker per person after their last-read message is quiet, but with ten members it becomes a row of stacks; collapse to "+6 read to here" after three?
- "New since you looked away" is computed from your own read seq; should opening the group clear it at once, or only when the composer is focused, so a glance from the inbox does not swallow it?
- The agent's question ("Who decides the proration basis?") is only typographic; should it become a tiny prompt with the people's names so one tap answers it?
- Should the plan chip show the second rating's star as a live slot (tap to rate from the chat), or stay a link to the session where ratings live today?
- On mobile the @ list covers the message being answered; should it push the stream up instead of floating?
