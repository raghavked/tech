# Inbox patterns for actionable items, applied to Henosis

*Research memo, 2 October 2026. Topic: notifications-inbox-patterns.*

## Why it matters for Henosis

Henosis already produces three kinds of item that wait on a specific human: an approval (one vote, or a quorum for irreversible calls), a contention (two peers or two sessions disagree; a driver or lead must pick), and a handoff (a named person must accept and read the brief). Today each lives inside the session it came from, as a quiet notice in the 760px column. That is right for the person already in the session. It is wrong for everyone else: the lead who is asked to resolve a claim between two sessions they are not watching, the driver who holds three sessions and is approving in one, the engineer being handed off to while they are on another project.

The server already keeps a per-user inbox (`packages/server/src/notify.ts`) with a `Notification` of kind `approval | handoff | contention | done | blocked`, a deep link and a single `read` flag, and the desktop tray shows a pending-approvals count (`apps/web/src/shell.ts`). What is missing is the triage model on top: what "done" means, whether an item can come back, how items group across projects, and whether the human can act without opening the session. The products below have each spent years on exactly that, and the differences between them are instructive.

## Prior art

1. **GitHub notifications inbox** (https://docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications-on-github/viewing-and-triaging-notifications/managing-notifications-from-your-inbox, accessed 2026-10-02; vendor page blocked by proxy, read via search snippets of the enterprise-server mirror, UNVERIFIED in detail). Three triage verbs: Done, Save, Unsubscribe. Done removes from the inbox but keeps the thread for five months under `is:done`; Unsubscribe silences the thread "until you are @mentioned ... or you're requested for review". Each item carries a *reason* (review requested, mention, assign, author) and the inbox can be grouped by date or by repository; custom filters are saved queries.
2. **Octobox** (https://github.com/octobox/octobox README, accessed 2026-10-02, verified). Built because GitHub's items "are marked as read and disappear from the list as soon as you load the page". Adds an archived state and the key rule: "if new activity happens on the thread/issue/pr ... the relevant item will be unarchived and moved back into your inbox". Filters by repository, organisation, type, state, CI status and reason; `y`/`e` archive, `m` mute, `d` mark read here and on GitHub.
3. **Linear Inbox and Triage** (https://linear.app/docs/inbox and https://linear.app/docs/snooze, accessed 2026-10-02; blocked by proxy, snippets only, UNVERIFIED in detail). One notification per issue, not per event; `U` read/unread, `H` snooze with presets ("For an hour", "Until tomorrow", "Until next week", "Next cycle"), and a snoozed item "will re-appear as a new notification and unread". Issue properties can be changed from the list without opening the issue. Triage is a separate queue for items that arrived from outside the team and need a decision before entering the workflow.
4. **Linear Priority inbox** (https://linear.app/changelog/2026-09-03-priority-inbox, accessed 2026-10-02; snippets only, UNVERIFIED). A Priority tab "separates what needs your attention from what can wait, so something like a review blocking a release never gets buried"; Linear picks the default sources and the user can override with a filter.
5. **Superhuman** (https://blog.superhuman.com/inbox-zero-in-7-steps/, accessed 2026-10-02; blocked by proxy, snippets only, UNVERIFIED). Split inbox: 3-7 automatic streams so the user batches one kind at a time. Triage question is "is this message for today, for another day, or is it done?", which maps to reply, snooze, archive. Keyboard first; "Get Me To Zero" clears older items in bulk.
6. **Slack Later** (https://slack.com/help/articles/360042650274, accessed 2026-10-02; snippets only, UNVERIFIED). Saved items became "Later" with three tabs: In progress, Archived, Completed; reminders are ordinary items in In progress with a changeable due time.
7. **LangChain Agent Inbox** (https://github.com/langchain-ai/agent-inbox, accessed 2026-10-02; verified via docs mirror snippets). A review queue for agent interrupts rather than a chat: each interrupt carries an `action_request` (action, args) and a config of `allow_accept`, `allow_edit`, `allow_respond`, `allow_ignore`, so the UI knows which verbs to render per item.

## What to borrow

- **Per-thread items, not per-event items** (Linear, GitHub). One approval is one item however many votes arrive; a contention stays one item as it gains participants. Henosis's log is per-event, so the inbox must fold events by `approvalId`, `contentionId`, `handoffId`.
- **Done is reversible by new activity** (Octobox). A denied claim you marked done should come back when the lead's resolution changes it, and a quorum approval should come back when a vote is withdrawn. This is cheap in Henosis because every change is an event with the same id.
- **Reason on every item** (GitHub). Why am I seeing this: "you are the only driver", "quorum needs one more owner", "handoff to you", "you lead this project". Reason is what lets Unsubscribe mean something.
- **Snooze returns as new and unread** (Linear). Snooze is a reminder, not a dismissal. Presets should be work-shaped: "after this turn", "when the session pauses", "tomorrow".
- **A Priority split with a stated rule** (Linear 2026, Superhuman). Henosis's rule is already deterministic: items blocking an agent now (approval pending, contention on goal) outrank items that merely inform (done, blocked write that the agent routed around).
- **Capability per item** (LangChain). Approvals accept/deny; contentions pick an option or write a steer; handoffs accept/decline; informational items only open. Render only the verbs the kernel will accept from this user at this rank.
- **Group by project** (GitHub by repository). Henosis's unit is the project; inside a project, sessions; the lead's fleet contentions sit at project level, above any session.

## What is unsolved

- **Quorum visibility.** No inbox above has a vote that needs two distinct humans. Showing "1 of 2 approved, Ana approved" in the list is new, and a Done by a non-voter must not count as a vote.
- **Stale action.** Approvals are bound to the hash of the exact call. An inbox item can be acted on minutes after the agent moved on; the kernel will reject it, and the inbox must show that the moment has passed rather than a generic error.
- **Snooze on an item that blocks a running agent.** Linear's snooze hides work that waits for you. In Henosis the agent is waiting; snoozing an approval should hand the item to another eligible voter or say plainly that the session stays paused.
- **Unsubscribe from a session you own.** Owners cannot opt out of quorum duty without transferring the seat; the inbox needs to say so instead of offering the verb.
- **Minimalism.** The register is claude.ai: one column, no badges shouting. An inbox is inherently a list with chrome. The design question is how little chrome it can carry.

## Concrete recommendations for Henosis

1. **Promote the server inbox to a triaged item store.** In `packages/server/src/notify.ts` replace `read: boolean` with `state: "open" | "done" | "snoozed"`, `snoozedUntil`, `reason`, `threadKey` (`approval:<id>`, `contention:<id>`, `handoff:<id>`), and `allowed: ("approve"|"deny"|"pick"|"steer"|"accept"|"decline")[]` computed from the user's rank and the policy. Mirror the shape in `apps/web/src/api.ts` `Notification`.
2. **Henosis events into threads and reopen on activity.** In the same file, upsert by `threadKey`: a new vote, resolution or decline on a done or snoozed item sets `state: "open"` again and bumps `at`. Add a resolved kernel event (`approval.voted` reaching quorum, `contention.resolved`, `handoff.accepted/declined`) that marks the item done for every recipient. Tests beside the existing notify tests.
3. **Add an Inbox view at `/inbox`, grouped by project, split in two.** New `apps/web/src/views/Inbox.tsx`, routed in `router.ts`, linked as the first sidebar item in `Home.tsx` with a single hairline count in `--fg-3`, no colour. Section "Needs you" (open approvals, contentions, handoffs to you, ordered by what blocks a running agent) above "Later" (done writes, blocked notes, snoozed items with their return time). Project headers are plain 13.5px rows; sessions nest under them as the existing `.sidebar .item.sub` style does.
4. **Act inline with the existing notice component.** Reuse `ApprovalNotice` from `apps/web/src/views/SessionView.tsx` (extract it and the contention notice to `apps/web/src/ui.tsx`) so an inbox row expands into the same two-button notice the session shows. Votes go through the same `client.send({ type: "vote" })` path, so hash binding and quorum rules stay in the kernel. On rejection, render "That moment passed; the agent moved on" in the row and mark it done.
5. **Keyboard triage with Linear/Superhuman verbs.** `j`/`k` move, `e` done, `h` snooze (presets: after this turn, when the session pauses, tomorrow 9:00, custom), `y` approve, `n` deny, `o` open the session at the notice, `u` unread. Register in `apps/web/src/ui.tsx` next to the existing shortcuts; the desktop shell inherits them. Snoozing an approval that would leave no eligible voter shows one line "The session stays paused until someone approves" before confirming.
6. **Reason and lead items.** Compute `reason` in `packages/fleet/src/propagate.ts` when mirroring fleet contentions ("you lead billing") and in the kernel approval path ("quorum needs one more owner"). Show it as the muted second line of the row. Offer Unsubscribe only where the reason is a mention or a crew membership, never where it is a rank the user holds.
7. **Tray and push follow the split.** `apps/web/src/shell.ts` `reportPendingApprovals` becomes `reportNeedsYou(count)` counting the Needs-you section only, and `notifyIfHidden` in `apps/web/src/notify.ts` fires only for items entering that section, tagged by `threadKey` so repeats replace rather than stack.

## Sources

- https://docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications-on-github/viewing-and-triaging-notifications/managing-notifications-from-your-inbox (accessed 2026-10-02, snippets only)
- https://github.com/octobox/octobox (accessed 2026-10-02)
- https://linear.app/docs/inbox (accessed 2026-10-02, snippets only)
- https://linear.app/docs/snooze (accessed 2026-10-02, snippets only)
- https://linear.app/changelog/2026-09-03-priority-inbox (accessed 2026-10-02, snippets only)
- https://blog.superhuman.com/inbox-zero-in-7-steps/ (accessed 2026-10-02, snippets only)
- https://slack.com/help/articles/360042650274 (accessed 2026-10-02, snippets only)
- https://github.com/langchain-ai/agent-inbox (accessed 2026-10-02, via docs mirror)
- Repo: `packages/server/src/notify.ts`, `apps/web/src/api.ts`, `apps/web/src/shell.ts`, `apps/web/src/notify.ts`, `apps/web/src/views/SessionView.tsx`, `docs/05_kernel_design.md`, `docs/13_fleet_collaboration.md`
