# Welcome an agent · notes

## The idea
When Ana adds her new agent to Payments and to #billing, the group sees one joining line with the mark playing arcs-close ("Checkout, Ana's agent, joins the circle.") and, under it, an arrival card that answers what a teammate asks of a newcomer: who it is, what it is on, what state it is in, who may mention it, who holds its gate, what it may spend, and the one rule of hearing (mentions only, answers as Ana's agent, never as Ana), with the people and crewmates it joined listed beside it the way the members drawer lists them. The same moment has a second face: the drawer "What Checkout was told" shows the welcome brief the system wrote from the ledger at turn 0, in the product's own voice first (one serif paragraph) and then as the agent reads it (the circle and roles, the crew and its claims, the manners, the memory in context, and what it was not told), so a person can see that the agent entered with the same knowledge a new engineer gets from the onboarding page. Ana's welcome mention and the agent's first reply (it read the memory, claimed its path, and its plan waits for two ratings) prove the rules in the stream before anyone has to trust the card.

## What to keep
- The joining line as the only hero: the mark animating arcs-close at 30px, the sentence in serif with the agent's name in chocolate, the time in mono grey; the rail card rises in on apricot wash with "Ana · just joined · 0".
- The arrival card split in two: the facts on the left (Status, Mentioned by, Gate, Budget as four surface-2 tiles, the budget meter at 0), "Who it joined" on the right with roles ("holds the gate" in chocolate for Bo and Cy), a seam, the crewmates with their live dots, and the foot that says who added it, where, when, and that the log keeps the join.
- The hearing rule as one line with the ear icon: "It hears only what mentions it; a mention steers its session, and its next words come back here as Ana's agent, never as Ana." It is the same sentence the new-group sheet and the members drawer use.
- Actions: "Say hello" as the primary (it drops an @Checkout into the composer), "Open session", and "What it was told" as a chocolate link that opens the drawer.
- The drawer: a navy brief card (serif paragraph, "written by the system from the ledger · kept in the log · replayable"), then sections The circle, Your crew, Manners, In your context with the three memory entries attributed by name and commit, a greyed "Not told" line, and a details fold "As the model reads it" with the raw mono block and its token cost. The foot says Ana wrote none of it and can add a line in Details · Brief.
- The owner's toast top right: "Checkout is in. Bo and Cy hold its gate." with the mark; it does not cover the card.
- Ana's welcome with the agent mention on navy and the agent's reply with the plan chip "waits for 2 ratings"; the composer already holds @Checkout.
- Dark: the lifted status colours used by the chat explorations, the brief card on a deeper navy with the mark disc lifted so the arcs read, the agent mention on #3A4458.
- Mobile: the joining line and the card alone (facts three across, budget full width, "What it was told" as a full-width row); the rail, drawer, toast and composer go away so the moment fills the screen.

## Open questions
- Crews are per project in the spec; here Checkout (project Checkout) is in "Invoice rollout" with Billing page and Invoice PDF. Should a crew be allowed to span a team's projects, or should the card say "Solo · Ana can name a crew"?
- The welcome brief is drawn as a system-written turn-0 note like the handoff brief. Today an agent is told about a group only when it is mentioned ("Ana in #billing: …"). Is a standing brief at join worth a server event (`session.briefed`), and does the agent get it again when its membership changes?
- "Mentioned by" lists the group's people; with a whole-organisation scope the list is everyone. Should the tile say "anyone in #billing" past four names?
- "Bo and Cy have seen it join" assumes read markers on join events; the group log keeps reads for messages only today.
- Should "Say hello" send a fixed welcome, or only prefill the mention as drawn? A fixed one would reach the agent as a steer and cost a turn.
- Should the "Not told" line be shown to every member, or only to the owner and leads, since it names what the agent cannot see?
