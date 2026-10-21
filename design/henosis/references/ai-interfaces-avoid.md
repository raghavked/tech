# AI interfaces to avoid: the 2026 sameness, and ten elements for Henosis

Claude, ChatGPT, Gemini, Perplexity and Copilot have converged on one screen; the best designers of the last three years have argued their way out of it. What to avoid, what the original work does, ten buildable elements. Sources read October 2026.

## What the best work does

**It names the template and refuses it.** Sidebar left, centred input at the bottom, alternating messages, suggestion chips. Hoang Nguyen counts twelve near-identical platforms, "design abdication" (https://uxdesign.cc/are-we-designing-ai-products-all-wrong-d54d1005c92f). Roger Wong, quoting Adi Leviim: chat "fell out of what large language models could do on day one", and the 2024 wave of Canvas and Artifacts is the industry "discovering, retrofit by retrofit, that a text box alone cannot hold a meaningful creative surface" (https://rogerwong.me/2026/04/chat-box-wrong-ui-paradigm). The empty state is the sharpest case: centred field, placeholder, chips, "the absence of design"; in the author's A/B tests the most AI-looking variant retained worst (https://www.designersforest.com/the-death-of-the-empty-state-in-ai-products/).

**It gives the blank field affordances.** Amelia Wattenberger's 2023 essay anchors everything after it: a text input "looks the same as a Google search box, a login form, and a credit card field", so every user carries the burden of learning what works; her answer is context baked into controls (sliders for audience and depth, a tutor suggesting in the margin) rather than prose the user invents (https://wattenberger.com/thoughts/boo-chatbots). Kosta Canatselis restates it for 2026: chat stays for the open-ended 9pm question; specific actions get their own button or artifact (https://world.hey.com/kostac/stop-putting-a-chat-box-on-everything-501a16e5). Leviim's brief: date pickers, sliders and file uploads are all intent surfaces, "none of them is chat".

**It puts the work, not the transcript, in the centre.** Allen Pike's tour runs from co-authorship through inline feedback to generated UI, chat demoted to "a debug interface, a fallback mode" (https://allenpike.com/2025/post-chat-llm-ui/). Burke Holland's canvases in the Copilot app make the same move from the vendor side: the agent builds a small tool, and later interactions are free (https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/). Maggie Appleton's daemons are the gentlest version: named characters in the margin who highlight a sentence and fade if ignored (https://maggieappleton.com/lm-sketchbook).

**It drops the sparkle and the purple.** NN/g found not one participant read the sparkles icon as AI; it was guessed as deals, favourites, effects, a plus sign (https://www.nngroup.com/articles/ai-sparkles-icon-problem/). Josh Clark: sparkles now mean "this feature is weird and probably broken", and the right symbol is none, the way spell-check gets no badge (https://bigmedium.com/ideas/your-sparkles-are-fizzling.html). Purple gradients and starbursts are "doomed to look outdated soon" (https://uxdesign.cc/the-way-we-design-ai-looks-like-nostalgia-already-aa5dfc01d4c7). Jim Nielsen adds the second-order clichés: shimmering "thinking" text, tiny icons, "beige/cream colors, orange accents, and serif typefaces" (https://blog.jim-nielsen.com/2026/ai-aesthetic/). Henosis lives in that warm camp; its distinctness must come from structure, not palette.

**It treats the agent as a colleague with a shape, a place and a record.** Atlassian's AMP reserves the hexagon for agents so circles stay human, and makes identity and attribution the first pillar: "who's who, who's doing what, and when they did it" (https://atlassian.design/amp). The CHI 2026 study *multi* found teams absorbed agents into existing authorship norms when agent replies arrived as ordinary comments (https://dl.acm.org/doi/full/10.1145/3772318.3790648). Mo Cherif's primitives are presence, intent, scope, ownership, provenance, recovery (https://theagenticpractice.com/blog/ai-interface-is-multiplayer-work). The Human+ guide wants a staged pending state with per-hunk accept and reject, and human and agent edits as "the same kind of event, distinguishable only by actor" (https://ui.particle.academy/docs/designing-human-plus). Ai2's Ream puts engagement traces in the file tree (https://arxiv.org/html/2610.09497); Macro labels the agent's cursor with its name (https://codepointer.dev/p/the-design-of-human-ai-collaboration).

The pattern: no bubble soup, no centred oracle, no magic badge; one shared stream, the artifact in the middle, agent work legible in a person's grammar.

## Ten elements for Henosis

Person = Chocolate Fondant, agent = Apricot Illusion, both on cream; Dress Blues is the frame. Participants differ by hue and a disclosed name, never by a separate panel or a sparkle.

1. **Ledger column, not bubbles.** One flush-left column, `display: grid; grid-template-columns: 56px minmax(0, 68ch)`, author mark in the gutter, no background behind words. Screen: Session, Groups. Unity: people and agents write into the same text; who spoke is marginalia, not a balloon.

2. **Composer as a bottom rule.** Full-width `textarea` with `field-sizing: content` and `border-top: 1px solid rgb(86 53 45 / .12)`, aligned to the ledger's text edge, never a centred pill. Screen: Session, Mobile. Unity: one line addresses a person, an agent, or the room.

3. **Verb shelf, not "ask anything".** Empty state is four verbs (`Plan`, `Review`, `Release`, `Ask`) in a `grid-auto-flow: column` row above one worked example from a real past session, limits printed beneath in `--ink-muted`. Screen: Onboarding, new Session. Unity: the room shows what the team can do together, edges included.

4. **Recipient chips.** A `To:` row of `inline-flex` chips (Fraunces 14 name, 6px dot in chocolate for a person, apricot for an agent) that `@` populates; `aria-live="polite"` announces the audience. Screen: Session composer, Groups. Unity: the Agent/Team toggle dissolves into visible recipients.

5. **Ring meter.** The mark as the only progress indicator: two SVG `<path pathLength="100">` arcs with `stroke-dashoffset` driven by `--human-done` and `--agent-done`; the centre dot appears at 100/100. Screen: Plan card, Release gate. Unity: progress is the two arcs closing into one ring.

6. **No badge, no sparkle.** Agent actions carry a verb in Inter 500 and the agent's name in Fraunces; icons are 1.5px-stroke glyphs; a stylelint rule rejects `sparkle`, `wand`, `magic` and any hue between 265 and 300 degrees. Screen: every screen. Unity: agent work is a feature of the team, not a trick to be labelled.

7. **Tool steps as a commit log.** Each tool call is one 12px monospace line, `font-variant-numeric: tabular-nums`, left tick, expanded with `<details>` and `interpolate-size: allow-keywords`. Screen: Session, Details. Unity: an agent's work reads like a colleague's commit history; a person's edits share the log.

8. **Staged edit, per hunk.** A proposed change renders in place as a `<del>`/`<ins>` pair with a 9% apricot wash, accept and reject at the hunk, `Esc` to discard; a person's suggestion uses identical markup in chocolate. Screen: Details, Plan card, Memory. Unity: nothing lands without a hand, and both hands look alike.

9. **Margin notes, not a second chat.** Agent commentary is a sidenote anchored to its passage with CSS anchor positioning (`anchor-name: --p12; position-anchor: --p12; inset-inline-start: anchor(right)`), hairline connector, reply and resolve inline. Screen: Details, Project page. Unity: agents review in the margin like any reviewer; no parallel conversation to reconcile.

10. **Artifact-first split.** Desktop `grid-template-columns: minmax(360px, 2fr) 1px 3fr`: ledger left, artifact (plan, diff, doc, board) right, draggable hairline between; `@container (inline-size < 900px)` stacks the artifact above. Screen: Desktop, Project page. Unity: the work is the interface; the conversation beside it is everyone's.
