# Approvals queue · notes

## The idea
The queue is one flat list of rows, oldest first, where every row says the same sentence ("Bo's agent in Checkout wants to deploy checkout-proration to production") and carries its decision on a second line: what it needs, the compact rating when a ratings rule applies, and Approve/Deny. Release gates are told apart at a glance by the brand hairline on the left, the navy→chocolate "Release gate" pill and a two-segment quorum meter with the mono count ("1 of 2 at 4+ · avg 4.0") so the rule is visible without a sentence. The keyboard cursor is a real state (apricot ring and wash, a small triangle in the gutter, the hint "a sends 4" on the row itself) and a decided row folds into the quiet Done list with a drawn check, the voters and the average, whether it was decided here, in the notice, the inbox or the palette.

## What to keep
- One sentence per row, agent name and session title in Instrument Serif, the action in plain sans with the command or branch in mono; the project, risk pill, votes and age on the second line.
- Release gate rows: the gradient hairline, the gate pill (apricot edge in dark so the gradient reads), the irreversible pill, and the quorum meter whose segments go apricot when a vote counts and amber when the average is under the bar ("a 3 is a voice, not a vote").
- The compact rating with the gate tick after the third star and the serif word (Good), preview lighter than the pick; "Approve with 4" on the button so the default is never a surprise.
- Real states in one list: cursor row with preview, exec row with no votes, a gate row where my vote is in (stars locked, drawn check, Approved disabled, "Change to deny" still live), a driver-only row with the owner override and "Nudge Cy", and a gate at avg 3.0.
- Done rows folded to one line each with the result coloured, the voters and quotes, and the fold-in animation for a row that just collapsed.
- Aside: At a glance (need you / your vote is in / Cy's call), the three open gates as meters, and the keys sheet; all three hide on mobile, where the buttons go full width and the stars grow to 34px hits.
- The topbar key hints and the list foot repeat the keys and say "never while you type".

## Open questions
- The owner override on a driver-only approval ("Approve as owner") is a design assumption; the kernel today sends the vote and the policy decides whether it counts. Should the queue show it, or only "waits for Cy"?
- Filters (Needs you, Release gates, Waiting on others, All) are not in the app; the app shows one list. Worth adding if the queue grows past a screen.
- "Change to deny" after an approve: the kernel accepts a changed vote, but does the row need a confirm when the gate would otherwise have granted on the next vote?
- Sort: oldest first keeps the cursor stable; should gates float to the top instead, since they stop a session longer?
- The Done list keeps only rows decided while the page was open (as the app does). A "Show the last hour" link may be enough for the rest.
- The dark status colours are overridden on this page like the inbox and rating-control pages; tokens v6 should carry them.
