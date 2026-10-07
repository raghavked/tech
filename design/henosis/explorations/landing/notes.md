# Landing · one team, people and agents · notes

## The idea
The hero puts the claim in six words ("Agents are members, not tools.") beside a navy stage where the mark closes once on load, with two faint trail positions behind it so the still reads as motion, and under it the product's own stream for the joining moment: "Dee joins the circle", "Dee's agent joins the circle on Invoice PDF: tax lines and proration", "The plan waits for two ratings", with Ana, Bo and Cy already in and Bo holding the baton. The three features are the three manners a member gets, each shown as the real artefact rather than an illustration: the plan card with estimates, took, two ratings and a budget bar; the release gate with Ana and Cy voting 4+ while Bo's unrated approve is a voice, not a vote, then "United pdf-layout into main"; the manager's sentence with tokens by agent and person and a needs-you list. The joining section is one navy band with Dee and Dee's agent side by side, the same four rows (groups, plan first, release gate, manager's view) with the closed ring between them reading "the same circle", and the page's one apricot action.

## What to keep
- The headline pair: a serif claim with the italic in chocolate, and the lede written as the brief's own sentence (same groups and chats, same plan-first manners, same gate, same manager's view).
- The stage: a navy field, not a product screenshot, so the mark is the hero; the "a person / an agent" legend names the two arcs; the join feed uses the stream's real rows, roles and the Team pill.
- One gradient per screen: the hero button carries it, the joining band is flat navy and its action is apricot.
- Features shown as the real components (plan card, gate notice, manager sentence) with Payments content, so the marketing page and the app agree.
- The two member cards with identical row structure; the only differences are in the words (rates / proposes, holds the gate / pushes only when).
- Dark: the stage and the joining band go to a deeper navy than the canvas so they still read as frames; the join CTA stays apricot (a navy gradient would vanish).
- Mobile: the stage follows the copy, legends drop, the feed loses its clock column, the member cards stack with the ring between them, actions go full width.
- The marks are an SVG symbol styled with inline `var()` so they survive `<use>`; the hero copy is inline so it can animate.

## Open questions
- The hero mark closes once at load (0.55s) rather than looping; should it replay on scroll into view or when hovering the stage?
- "Free for teams of five" and "Pilot teams: Payments, Platform, Deal desk" are placeholders; pricing and logos are not decided.
- The harness strip names Claude Code, Codex, Cursor and the SDKs from the spec's phase 1; is that list a promise the page can make today?
- "Watch a session" should open a replay (deterministic, no model calls); should the landing embed a scrubber or link to the demo session?
- The Dee's agent card says "Claude Code, hosted by Henosis"; the product hosts several harnesses, so the line may want to be generic.
