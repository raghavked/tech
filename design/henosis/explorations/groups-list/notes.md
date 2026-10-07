# Groups and chats list · notes

## The idea
The chats page is a list of circles, not channels: every row shows who is in it, people and agents together, as one avatar stack with a thin seam between the kinds and a status dot on each agent, so you can see at a glance where the agents are and what state they are in before you open anything. Rows are grouped by the scope the app already has (Team, Projects, Direct), each row is one shape (emblem, serif name with purpose and scope tag, the last line attributed to the person or to "Cy's agent", time, stack, unread count), and the unread count is chocolate for plain unread and apricot with an @ when your name was said. The New group sheet lives open beside the list as a panel, with the scope as chips and the members as two short pick lists (People, Agents, with the agent's owner and live status), so starting a group is the same gesture as reading the list.

## What to keep
- Three scopes as sections, in this order: Team (everyone is in these), Projects (Billing page, Checkout, Invoice PDF), Direct (one person or one agent and you). The section subtitle carries the rule.
- One row shape with a 44px emblem: brand gradient `#` for a team group, apricot-wash `#` for a project group, a round avatar for a person, the agent squircle with a live dot for an agent. Read rows lose the white card, the shadow and the emblem colour.
- The last line is attributed: a serif name for a person, "Cy's agent" in italic chocolate for an agent, `code` for branch and tool names, and your own mention highlighted in apricot. An agent still answering shows the weave loader and "Bo's agent is answering Cy…" in the time slot as "now".
- The member stack: people first, a seam, then agents with a status dot (green running, amber at the gate, red blocked), so the row answers "is the agent here and is it alive" without opening it.
- Two badges: chocolate count for unread, apricot `@1` for a mention of you; a quiet group shows the bell-off glyph instead.
- Lead sentence in the product voice replaces a count ("Cy's agent answered in #billing, and Ana said your name in #invoice-rollout."); the topbar keeps the count.
- Filters are chips with counts (All, Unread, Mentions, With agents) and a Latest / A–Z segment.
- The New group sheet: `#` prefixed name with the glow on focus, purpose, scope chips (Whole organisation / Team Payments / Project Billing page), People and Agents pick lists with "you · owner" already in and unpickable, and a footer stack that counts "4 in the circle".
- Dark: the team emblem keeps its gradient, status colours lift (same page-level override as the inbox exploration).
- Mobile: rail and sheet fold away, purpose, scope tag and the member stack hide, the time and badge stay on the right, the + in the topbar is New group.

## Open questions
- The app today lists groups flat by last message; is the Team / Projects / Direct split worth it at four groups, or only once a team has fifteen?
- Direct chats with an agent: the spec has agents in groups, not in one-to-one chats. Is a direct chat with "Billing page" a real thing (a group of two) or should Direct hold people only?
- Should the member stack cap at four faces plus "+3", or always show every agent (since agents are the point) and cap people only?
- Does the New group sheet belong beside the list on desktop (drawn) or as the modal the app has now, given that the list is the only context the sheet needs?
- An agent "answering" in a group: is that state known to the list (a live event) or only to the open group?
