# Search · notes

## The idea
One query across everything the team keeps, on a page rather than in the palette: the query bar carries the scope (in Payments) and the live filters as removable chips, a row of kinds under it carries the counts (All 38 · Sessions 6 · Messages 14 · Memory 9 · People 3 · Agents 6), and "All" shows every kind as a short group with its own count, a quiet "why" (title, goal or intent · human 6, agent 5, team 3 · facts, decisions, conventions) and a "Show all" link. A refine column on the right answers the next question a person has after the first results — who said it (people and agents together, with a small apricot bar per count), where (Billing page, Checkout, #billing, Platform), when, and which kinds of message — and ends with "Keep this search", which saves the query to the rail and tells you when something new matches. Matches are drawn as weight and ink, never a yellow background, so they sit inside serif names, mono memory keys and sans snippets without breaking the three-font system.

## What to keep
- The query bar as the one glowing surface (`--team-glow` on the bar), 20px query, scope chip in apricot wash with the pulse dot, a round clear button; the rail's search item lit with the same apricot wash so the page and the rail agree about what you are searching.
- Filters as chips with a grey key word (`when`, `in`) and a bold value, each with its own ×, plus a dashed "Add a filter"; the syntax hint on the right in JetBrains Mono (`from:bo` `in:#billing` `before:friday`) teaches the typed form without a help page.
- Kind tabs with mono counts in a pill; the active tab's pill turns apricot and the underline is `--apricot-deep` (plain apricot in dark). "38 results in 0.08 s · newest first" at the right end of the tab row.
- One `.hit` row for every kind: a 30px lead (icon, person avatar or agent avatar with the mark), a title line (serif name + grey "in Session" / "to Team in #billing"), a two-line snippet, and an attribution line; status, time and pills on the right. The highlighted row is the apricot wash plus hairline ring, with ↵ open appearing only there, same as the palette.
- Sessions carry who drives and with whom (avatar stack with the driver ring), plan ratings and tokens of budget; memory rows carry the key in mono, the kind as a pill (decision, convention, fact) and the full attribution ("added by Ana · session billing-42 · commit 9f3c1a"); a cross-author conflict gets the danger pill.
- People and agents sit two-up to save height, each with a count sentence ("11 mentions in 4 sessions · drives one now") and the rail's status dot; Cy appears "through Cy's agent only", so a person who never typed is still findable.
- Dark lifts the greens and ambers two steps (`--ok`, `--warn`, the dots) so the Running/Awaiting/United marks keep contrast on `#232B3B`.
- Mobile: rail and refine column go, the filters row gets a "Filters · 2" button, kind tabs scroll sideways, the right column of each hit folds away and the title line wraps.

## Open questions
- The app today searches sessions in the sidebar and memory after two characters; messages, people and agents are new. Should message search cover tool steps (12 here, off by default) and agent output, or only what people and agents said in the stream and in team chat?
- "All" shows three or four of each kind. Is that the right cut, or should All rank across kinds by recency with a kind pill per row and let the tabs do the grouping?
- "Said by" mixes people and agents in one list. Should an agent's words count under its engineer (the memory ledger attributes them that way) with a second line "through Cy's agent", or stay separate as here?
- "Keep this search" promises a notification; is a saved search a rail item, an inbox rule, or both? And does it belong to the person or to the Payments team?
- The scope chip reads "in Payments"; on the manager overview a lead would want "in everything I lead". Is scope a chip the person can retarget, or inherited from where ⌘K was pressed?
- Opening a message hit should land in the stream at that message with the match lit; the replay scrubber could do the same for past sessions. Does a memory hit open the entry inline (full content, conflicts, retract) or the session that wrote it, as the app does now?
