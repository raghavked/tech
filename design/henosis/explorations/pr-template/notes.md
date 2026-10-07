# PR comment template · notes

## The idea
A pull request is a session, so Henosis posts exactly one comment on it and edits that comment in place as the session moves: the plan as a table of steps with estimate beside actual and the ratings under it with their notes, the release gate with the held call in mono, the risk word, the rule in plain words and every voice (rated, or "a voice, not a vote"), the tokens against the budget and against the plan's estimate, and the session link in the first line and again at the foot beside Replay and the audit record. It is plain Markdown only, tables, bold, code and links, with an HTML marker so the adapter finds its own comment, so it reads the same in GitHub, in e-mail and on a phone. The exploration shows the comment in its final state inside a neutral PR timeline, the Markdown template beside it with the placeholders in apricot, the four edits the comment goes through (plan waits, approved and in progress, held at the gate, granted and pushed) and the six rules the adapter keeps.

## What to keep
- One comment, edited, never appended: the `<!-- henosis:session=… -->` marker in the source and in the footer; "edited 14:33" in the comment head is the whole changelog.
- The first line as the session's identity: serif agent name, the Team pill with who it is with, the team, and "Open the session" as a link, before the goal sentence.
- The plan as a table: numbered circle, step, estimate and actual in right-aligned mono, a green check per done step; the ratings beneath as rows (serif name, role, italic note, stars and the number) and the verdict line with the rule and "decided in the fold".
- The gate line grammar from the release-gate exploration: call in mono, risk as a red pill, rule in words; voices as rows with Dee's observer approve dimmed as "a voice, not a vote"; the granted line carries the commit and the diff size.
- Tokens as two tiles: spent of budget with the four cost classes, and estimate vs actual with "saved 3.8k · 7%" in green and the one step that went over in amber.
- The footer: Session · Replay · Audit record, "Replays to the same hash" with the sha, and the marker at the right edge.
- The four-state ladder in the side column with the current state outlined in apricot, and the sentence each state says ("The plan waits for one rating.", "Waits on one more contributor at 3 or above.").
- Mobile: the comment goes full width, the avatar shrinks, the plan table scrolls sideways, voices stack with the stars first.

## Open questions
- The token bars: GitHub Markdown cannot draw a bar, so the real comment uses a glyph bar (▰▰▰▱▱) or drops it for the numbers; the mock draws the CSS bar to show intent. Which do we ship, and does the glyph bar read in e-mail clients?
- Should the comment also carry the plan's steps as GitHub task-list checkboxes (`- [x]`) so the PR's own progress counter picks them up, or does a second list of the same steps clutter it?
- Does the comment keep editing after the gate is granted (reviews, a second push, a unite into main), or does a unite get its own timeline event and the comment freezes at "granted and pushed"?
- Reactions on the comment: do 👍 on the Henosis comment count as anything in the session (a voice?), or are they ignored on purpose?
- A PR with several sessions (Ana's and Bo's agent both on `pdf-layout`): one comment per session, or one comment with a section per session?
