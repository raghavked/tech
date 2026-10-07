# New group sheet · notes

## The idea
Starting a group is the same gesture as joining the circle, so the sheet is two halves: on the left you name it, say what it is for, pick a scope and pick members; on the right the group is already open, drawn live as you pick, with the joining line ("Bo starts #proration. Ana, Cy, Billing page and Checkout join the circle."), the member stack with a seam between people and agents, the empty-state hint and a composer that shows an @ completion over the people and agents you just chose. People and live agents are two short pick lists of one shape, and an agent row carries its owner in italic chocolate and its live status dot, so the picker answers "is it alive and will it answer" before you create anything. Scope is three cards, each stating its rule in one sentence, and the preview's facts restate the consequences in the product voice: who can find it, what a mention does, where the words are kept.

## What to keep
- The two halves: form left, "How it will open" right, on a surface-2 column with the apricot wash. The preview is a miniature of the real group page (topbar with `#name`, purpose and scope pill; joining line with the mark animating arcs-close; roster; empty hint; composer).
- `#` as a serif prefix inside the name field, the glow on focus, and a "free" check that tells you the name is not taken; the help line "People will say `#proration`".
- Scope as three radio cards (Whole organisation / Team Payments / Project Billing page), each with its one-sentence rule; the chosen card is apricot-washed with a chocolate radio.
- Members: one search bar with filter chips (On Payments / Live now / Everyone) above two pick lists (People, Live agents). "you · owner" is already in and unpickable; a picked row is surface-2 with an apricot ring on the avatar and a chocolate check; a just-picked avatar ripples.
- Agent rows: squircle gradient avatar, serif title, "Ana's agent" in italic chocolate, status dot and word (running, at the release gate, blocked, paused).
- A warn-soft note under the lists that says what a non-running pick means ("Checkout is at the release gate; a mention reaches it now, it answers once Ana or Cy opens the gate").
- Footer: the roster (people, seam, agents with status dots), "3 people and 2 agents in the circle", Cancel, and a primary that names the thing: "Create #proration".
- Three facts under the preview: who can find it, what @ does (reaches the session as a steer; replies come back as "Ana's agent", never as Ana), where it is kept.
- Dark: all from the tokens plus the lifted status colours used by the inbox and groups-list explorations.
- Mobile: the sheet is the whole screen, scope cards stack, the preview column folds into a "Preview" link in the sticky footer, buttons go full width at 44px.

## Open questions
- The app's sheet is a narrow modal with a native `<select>` for scope; the three cards cost more room but say the rule. Is the rule text accurate for teams (do all members of the scope see the group, or only members of the group)?
- Should picking a scope narrow the pick lists (Project Billing page hides Tax lines, which runs on Invoice PDF), or should out-of-scope picks be allowed with a note?
- "free" on the name: does the server check names on the fly, or only on create (today: create and wait for `group.created`)?
- Should a blocked or paused agent be pickable at all, or shown greyed with "will not answer until Cy unblocks it"? The note covers the gate case only.
- On mobile, "Preview" opens the right column as a second screen; is that worth building, or is the footer roster enough?
