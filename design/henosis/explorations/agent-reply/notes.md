# Agent reply · notes

## The idea
An agent's turn is words first and deeds under them, in one voice: a short sans sentence that says what it is about to do, then a mono ledger of steps inset beneath it, then more words when something changed its mind, so the turn reads like a colleague narrating as they work rather than a log with captions. Every step has one shape (icon · verb and path in mono · result on the right · chevron) and only its colour changes with its state: ok green on the icon, warm apricot wash with a two-strand weave for the step that is running now, warn amber for a step the team manners held (a claim, a gate) and the only red in the stream for a step that failed, which opens itself so the failing line is on screen without a click. A finished turn folds its deeds into one line with an icon trail and a cost, so the stream stays short while the live turn stays loud.

## What to keep
- Words, deeds, words: prose and step ledgers interleave inside one turn, and the prose after a failure says what went wrong and what the agent will do about it ("it is mine", "fixing the insert, not the test").
- The step row: `icon · Verb path · result · chevron` in one grid; the verb is the tense of the state (Read/Wrote/Ran for done, Running for live, Write for held, Then: write for queued).
- The live step: apricot wash, the weave as two strands (apricot and chocolate) crossing under the row, the result column counting ("3 of 4 · 1.8s"), and the output block still being written with a blinking apricot caret.
- The failed step: danger wash on the row, a 3px danger strand inside the navy output block, ok lines stay green so the eye finds the one ✗, and a footer with "41 lines · Show the whole log · Copy".
- The held step: lock icon, warn colour, the claimant's name in serif italic, "handoff offered" as the result; warn not red, because nothing broke.
- The queued step: faint, clock icon, "Then: write … · step 4 of 4", "after the tests" in serif italic on the right.
- The folded turn: icon trail of the steps, a sans summary with counts, mono cost on the right, chevron to unfold.
- The composer hint during a live step: "The agent is running tests · what you send now reaches it when the step ends".
- Mobile: results stay beside the line but wrap, output blocks wrap, the topbar keeps only the title and status.

## Open questions
- Should a failed step collapse itself once the agent's next attempt passes, leaving only the fold's red bead in the trail? Today it stays open, which is honest but long.
- The fold line uses sans for the summary and mono for the cost; the steps inside use mono for the whole line. Is the switch at the fold boundary right, or should the fold stay mono too?
- The output block caps at 20 lines in the app; the "Show the whole log" link needs a destination (a drawer, or the Details usage tab).
- When the live step takes more than a few seconds, should the elapsed counter move into the weave itself, or stay in the result column?
- Should the agent's prose stream with a caret too, or is one live cursor per turn (the step's) enough?
