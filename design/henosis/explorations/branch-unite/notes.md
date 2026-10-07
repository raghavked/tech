# Branch compare and unite · notes

## The idea
The compare page is two sides and the mark between them: `main · here` on the left, `try/monthly` on the right, and the Henosis ring in the gutter drawn apart (two arcs, no centre) until the unite closes it and the dot pops. Between the sides sit the facts a driver needs before folding: files that differ with a dot per origin (both sides in warn, the fork in apricot, here in navy), +/− counts that read as what `main` adds, and each side's last three turns with tool-call counts and what the agent is waiting for. The unite lives where the composer would be, as a sticky bar that says what the fold will do before you do it (six files, two changed on both sides, Bo's `tax` directive meets Ana's and becomes a contention); after the fold the same page shows the ring closed, a "United try/monthly into main · 5 clean · 1 conflict" line, the folded files with clean/conflict states, the contention for the driver, and the conflicted file open with `main` and `try/monthly` hunks tinted and attributed to the agent and turn that wrote them.

## What to keep
- The mark as the unite indicator: arcs apart before, ring closed with the centre dot after. It is the brief's "something joins" motion applied to branches, and it needs no extra icon.
- The sticky unite bar in the composer's place, with the consequence sentence (files, both-sides count, the directive that will become a contention) and "You are driving / Folding needs the driver or an owner" next to the brand button.
- Origin dots on file rows (both sides = warn with halo; fork = apricot; here = navy) and the short notes `both sides`, `try/monthly only`, `main only`; the list footer that totals the diff and says what a unite does with overlapping hunks.
- Side cards with a 4px edge in the side's colour, status, driver with the presence stack, token count in mono, and a one-line "Forked by Bo at checkpoint 5 · 2 h ago · why" in italic.
- The conflict block: navy file body, markers as full-width bands (`<<<<<<< main` with "here · Ana's agent, turn 7", `>>>>>>> try/monthly` with "Bo's agent, turn 12"), ours/theirs tinted, and a resolve strip with Keep main / Keep try/monthly swatch buttons and "Ask the agent to rewrite it" as the primary.
- The contention notice beside the folded files: both directives on the same scope chip, "They may be the same rule said twice", and "Keep both as one rule" as the primary.
- Mobile: sides stack with the small ring on the hairline between them, file rows drop the directory and put the note under the path, the unite bar goes full width with the driving note under the button.

## Open questions
- After the fold the real view still lists the old compare; here it switches to "Files folded" with clean/conflict states. Is that a new server shape (merge result per file) or do we derive it from the merge event plus `openConflicts`?
- The agent on `main` is shown blocked until the conflict is one version. Is that the kernel's behaviour, or does it keep running around the markers? The copy must match.
- Rank: the unite needs the driver or an owner. Should a contributor see the brand button disabled with the hint, or a quieter "Ask Ana to unite" that posts to the team?
- The right card's "with try/monthly" select doubles the branch name on the card; when there are three branches a segmented picker in the topbar crumb may be better.
- The dark shot here is the after-moment (1440×1250) and the light shot the before-moment; both moments should be checked in both themes once the page is in the app.
- Should uniting also offer "and close try/monthly" so the rail stops listing a branch that now lives on main?
