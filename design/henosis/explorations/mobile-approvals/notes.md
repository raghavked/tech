# Mobile approvals · notes

## The idea
On a phone the approvals queue is one stack of cards under the navy top block, each saying the same sentence as the desktop queue ("Bo's agent in Checkout proration wants to deploy checkout-proration to production") with its risk pill, age and, for a release gate, a two-segment quorum meter and one consequence phrase in chocolate ("your 4 grants it", "waits for Ana or Bo"). Everything that decides lives in the bottom half: the filter bar (Needs you / Gates / Others / All, with counts) sits at the thumb above the home bar, every row carries a 44px full-width Approve and a quiet Deny so exec approvals are one tap, and opening a gate row lifts a sheet over the dimmed queue that holds the ledger (Ana's rated voice, you "rating now", Dee as a voice not a vote), five 50px star tiles, the note, the tally and "Approve with 4". The opened row keeps an apricot ring above the scrim so the sheet is visibly about that row; `#closed` shows the queue alone with the gate's decision inline.

## What to keep
- Top block = status bar + title "Approvals" with "2 need you" in apricot (the only live colour in the frame), rail button with the needs-you badge, the mark at the right.
- The sentence per row: agent and session in Instrument Serif, the call in a mono chip; gate rows get the navy→chocolate hairline and the gradient "Release gate" pill (apricot edge in dark).
- The quorum meter on the row: segments (filled apricot, the next one outlined), "1 of 2 · avg 4.0" in mono, then the consequence phrase in chocolate, nowrap with ellipsis so it never breaks onto a second line at 390px.
- Row states in one list: a gate that needs me (sheet), an exec with inline Approve/Deny, a gate where my vote is in (green check, locked stars, "Change to deny"), and a driver-only external call ("Bo has the baton; this one is his call" with "Nudge Bo").
- The sheet: handle, "The release gate." in serif, the held call in a navy mono bar with a lock and "held", the rule in plain words, the voices ledger (serif names, italic quote, stars on the right, dashed rings for people still to act), star tiles with the pick lit apricot and the glow, "Good · 4 of 5" in italic serif, the tally line "Your 4 grants it", 50px "Approve with 4" and the hint "Approve without a pick sends 4 · a 3 is a voice, not a vote".
- Filter bar as a segmented control with count pills at the thumb; the active count in apricot.
- Dark overrides for status colours and the scrim, as the other queue pages do; tokens v6 should carry them.

## Open questions
- The sheet rises on tapping the row; should tapping Approve with 4 on the row itself skip the sheet (one tap, the default rating) or always open it so the voices are seen before the vote on an irreversible call?
- Swipe to decide (right = approve with the default, left = deny) is the native idiom; is it safe on an irreversible gate, or only on exec rows?
- The filter bar's counts: Needs you counts rows I can still vote on; should a gate where my vote is in and the quorum is not met stay under Needs you with a "nudge" affordance, or move to Others?
- Is the sheet half-height enough on 844px for a gate with three voices and a deny, or should it grow to full height and scroll inside?
- Push deep links land on the queue with the sheet already open for the approval in the notification; should the back gesture close the sheet or leave the queue?
- "Nudge Bo" is not in the app today; the kernel has no nudge event. Worth adding or should it just open the session's team chat with @Bo prefilled?
