# Inbox · needs you first · notes

## The idea
The inbox is a list of sentences in the product's voice, ordered by whether something has stopped until you act: "Needs you" first (release gates, the baton, a contention, a blocked agent, a plain approval, a plan waiting for a rating), then "Mentions" (someone said your name), then "Done" folded quiet at the bottom. Every item is one row shape: a stripe on the left that says the kind, a serif title that is the sentence, a plain body with the rule or the quote, a meta line with the session, the people and the time, and on the right exactly what you can press now (stars beside Approve so the approve carries the rating, Accept for the baton, Pick 1 / Pick 2 in miniature for a contention, Retry step for a block, an inline reply box for a mention). Pressing it is the whole act: the row shows "Joining…" with the orbit loader, then the outcome word in green ("Approved · ★ 4 · the gate opened") and the row goes read, so you never have to open the session to answer it.

## What to keep
- Order by consequence, not by time: Needs you, Mentions, Done. Inside a group, newest first. The filter chips are kinds with counts and a colour dot that matches the row stripe.
- The stripe as the kind: brand gradient for a release gate (apricot in dark, where navy on navy vanishes), chocolate for a plain approval, apricot for the baton, amber for a contention, red for blocked, green for done, navy for a mention.
- Read states: unread has the apricot dot before the title and a white card with a soft shadow; read drops the dot, the shadow and the title weight, and the stripe fades to half. "Done" rows are the same row at a smaller size with the body hidden.
- Actions inline and complete: stars + Approve + Deny on a gate (Approve without a pick sends 4, as the spec says), Approve plan + Revise with stars for a plan, Accept + Not now for the baton, Retry step + Open for a block, two miniature directions with Pick for a contention, a reply box "as Bo in #billing" under a mention.
- The three outcome states on the board: Joining… (orbit loader), the green outcome word with the check drawing itself, and the refusal in red with the reason ("Ana took the offer back") and Open left behind.
- The lead sentence under the title ("Six things need you. Two wait on a rating, and Ana is holding the baton out.") replaces a count; the topbar keeps the count badge.
- The aside: "Where things stand" (waiting on you / on others / moving), "Waiting on others" with a face and a wait time, the keys, and the quiet toggle that lets mentions through.
- In dark, `--ok`, `--warn`, `--danger` lift (page-level overrides) so the tags and the outcome words read on the dark surfaces, same as the contention exploration; worth folding into tokens.css.
- Mobile: rail and aside fold away, chips scroll sideways, the H1 goes (the topbar carries the title), actions drop under the text and wrap, the avatar stack hides along with its separator.

## Open questions
- Should "Needs you" be split by project (as the app groups today) or kept flat with the session name in the meta line, as drawn? Flat reads faster with six items; by project may be needed at twenty.
- Picking a direction from the inbox is one tap on a sentence that was cut to one line; is that enough context, or should Pick only live in the session and the inbox offer Open?
- The reply box under a mention sends into the group as a plain message; should it also mark the mention read, and should an agent's answer to that reply come back here as a new row or into the same one?
- Unread / All: does "All" show rows acted on by others ("Cy approved Checkout's deploy") so the inbox doubles as a ledger, or does that belong only in Done and the replay?
- Quiet until 13:00 lets mentions through; should a release gate break quiet too, since it stops a deploy?
