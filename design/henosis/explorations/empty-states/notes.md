# Empty states · notes

## The idea
Every page a new person opens before anything has happened shows the mark with its two arcs apart and a dashed ghost where the centre dot will be: the circle is not closed because nothing has joined yet. Under it, one serif sentence in the product's voice ("No sessions on Billing page yet."), one line that says what fills the page and who puts it there (the agent plans first, the Payments team rates it), one chocolate action and at most one quiet one, and a dashed ghost row of what the first real thing will look like (the first session title, #billing with its members, a release gate at 0 of 2 ratings, the meter at 0 of 120k). When the first thing lands the arcs swing in and the dot appears, the same join motion as a member arriving, and the empty state crossfades into the first row.

## What to keep
- The open mark as the one signal for "nothing yet": arcs translated apart, ghost centre dashed in apricot; three stages (open, arriving, closed) that reuse the brand's arcs-close motion rather than inventing an illustration per page.
- Two sizes only: page size (56px mark, sentence, line, action, ghost) and row size (22px mark, one line, a ghost button) for sections inside a page that has other things (recent handoffs, team chat, contentions).
- The ghost row: dashed, ink-3, real names and real policy numbers, never clickable. It teaches the shape of the page before it has rows.
- The memory empty state is the first entry's form, with the scope chip and "as Dee"; the usage empty state is the meter at zero with a budget edge and ghost bars by project, person and agent.
- One primary per state; the navy→chocolate gradient only on the real New session button; the rail carries its own small dashed empty ("No agents running… appears here").
- "Nothing matches" and "Nothing here at this scope" are not empty states: closed mark, no ghost.
- Dark mode works straight from the tokens; the windows drop the canvas wash so the pages inside stay flat and quiet.

## Open questions
- The chocolate arc on the navy disc is faint at 22px in dark mode; should the row-size mark use the cream variant (chocolate and navy arcs, no disc) on light and an apricot-only outline in dark?
- The app's `EmptyState` is a one-line row everywhere today. Which pages earn the page-size treatment: only Sessions, Groups, Approvals, Memory and Usage, or also Inbox and the project page tabs?
- Should the ghost row be derived from real data (the project's actual name, the actual policy numbers) or be fixed copy? Derived is more honest but needs the policy to be loaded before the empty state renders.
- "Start #billing with Ana, Cy and Bo's agent" is a suggested group computed from who is on the project; is that too forward for a first visit, or exactly the invitation?
- The shipped light screenshot is the whole board at half scale to stay under the size budget; the dark and mobile shots are viewport-sized. Is a 1440×900 light crop of one screen more useful to reviewers?
