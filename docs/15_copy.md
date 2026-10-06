# Copy: the words in the interface

Every user-facing string of the web app lives in `apps/web/src/copy.ts`, grouped by surface
(shell, account, home, session, stream, steps, approval, composer, details, project, team,
notify) plus the five status words. Views import `copy` and carry no literal of their own.
Strings that take data are functions, so word order and plurals are decided once, next to
the sentence they belong to.

## Voice

Calm, specific, in Henosis's register (`12_brand.md`). The interface describes what happened
and who did it, and no more.

1. **Name the person and the act.** "Ana is driving." "Bo offers the baton to you." "Bo joined
   as contributor." Never "a user", never the passive voice when there is a name.
2. **Say the thing, not the technology.** "The agent wants to run `pnpm test`"; never
   "AI-powered", "intelligent", "smart", "magic", or an apology from the model.
3. **Status is one of five words**: running, awaiting approval, blocked, paused, idle. The
   same words in the sidebar dot, the top row, the fleet rows, the counts ("3 awaiting
   approval") and Slack. Capitalised only where it starts a line; never a pill.
4. **Short, declarative, present tense** for state ("Nobody else here yet. Share the link.")
   and past tense for the log ("United pdf-layout into main", "Wrote src/app.ts").
5. **Verbs on buttons**, one or two words: Approve, Deny, Accept, Decline, Pick, Withdraw,
   Hand off, Fork, Unite into main. No "Submit", no "OK", no "Yes".
6. **Henosis's own words** for its own ideas: the driver holds *the baton*, a person *drives* it,
   handing over *offers the baton*, a merge *unites* a branch, a steer and a constraint are
   *directions*, two of them at once is a *contention*.
7. **Quiet errors.** State what failed and where ("Could not load /api/me: 503"); no
   exclamation marks, no blame.
8. **Middle dots separate facts** on one line ("Ana · contributor · away"), never commas
   inside a label; sentences end with a full stop, labels and buttons do not.
9. **Count then noun**, pluralised by `plural()`: "1 approval waiting", "3 conflicts".
10. **No emoji, no exclamation marks, no ellipsis except for in-progress** ("Joining…",
    "Loading…").

## Adding a string

Add it to the right group in `copy.ts` (or a new group named after the surface), as a
function when it takes data, then use it from the view. Strings the Playwright smoke test
relies on (labels, placeholders, headings, the divider sentences) are the public contract of
the interface; change them in the test in the same commit.
