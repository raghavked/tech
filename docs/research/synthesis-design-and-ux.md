# Synthesis: design and UX decisions for Henosis (desktop-first, web second, mobile on the go)

Lead-architect synthesis, 2026-10-02, from eight research memos (cited by slug), `docs/04_technical_architecture.md` and `docs/06_roadmap.md`.

## The frame

The web client is the product; the Tauri shell adds a tray, native push and deep links. Every memo found good bones (landmarks, focus ring, reduced-motion rule, a reducer the browser runs itself) and no second layer: one key handler, no live region, no palette, no inbox, no empty-state copy, no scrubber, free-text presence. The decisions below add that layer without a second visualisation, source of truth or onboarding. Desktop and web share one client and one keymap; "desktop" is a context flag. Mobile inherits tokens and copy and hides what assumes a keyboard.

## Decisions

**D1. One keymap with when-contexts; desktop is a context flag.**
Decision: `apps/web/src/keys.ts`, one document listener with `{key, when, run}` rules resolved last-added-first; contexts `composerFocus`, `listMode`, `pendingApproval`, `offeredHandoff`, `isDriver`, `isDesktop`; single letters only in list mode (Esc leaves the composer), modifier chords everywhere; `isComposing` suppresses Enter. The Tauri shell sets `isDesktop`, unlocking keys browsers reserve (Cmd+1..9, Cmd+W) and mirroring them as native menu accelerators in `apps/desktop/src-tauri/src/main.rs`. Evidence: `keyboard-first-ux` (VS Code when-clauses, code-server's PWA split); `notifications-inbox-patterns`. Phase: now. Risk: browser reservation is unqueryable and Alt chords die in the macOS composer; never bind the reserved set, and ship `Cmd+/` as the sheet of what works here.

**D2. A command palette that is the only shortcut tutorial.**
Decision: `Cmd+K` in `apps/web/src/ui.tsx`, key shown on each row, free-text parsing of the CLI vocabulary (`constrain …`, `hand off to Bo`, `fork`), recents first, apricot only on the selected row. After a mouse action with a key, one status-line hint ("Forked. Next time ⌘⇧F"), once per action via `recents.ts`. Evidence: `keyboard-first-ux` (Superhuman, Linear). Phase: now. Risk: a parsed row must preview the directive and still require Enter.

**D3. Approval keys bind to the hash, never to "newest".**
Decision: `Cmd+Shift+A` moves focus to the oldest pending `ApprovalNotice` (`tabIndex=-1`) and never steals focus on arrival; the notice shows the short call hash and the vote carries it; the `irreversible` class requires `Shift+Enter` and shows "needs N of M · Dee is looking". Evidence: `keyboard-first-ux`; `accessibility-streaming-chat`; `presence-collab-ux` (`deciding`). Phase: now. Risk: two-step is slower than Linear's ideal; accepted, since a mis-approval is a correctness bug.

**D4. Two announcement channels, zero `aria-live` on message bodies.**
Decision: mount one `role=status` and one `role=alert` element at first paint (`apps/web/src/announce.ts`); wire the classifier already in `SessionView.tsx` (`blocksOf`, `notifyIfHidden`): polite for model output and failed steps, assertive only for what blocks the kernel on me. `aria-busy` on the agent block during a turn; tool steps named with result and risk; `pre` output focusable. Evidence: `accessibility-streaming-chat` (WCAG 4.1.3, Soueidan, incumbents needing a third-party extension). Phase: now, before the Claude adapter streams deltas. Risk: no screen reader has a stream primitive; debounce 1.5 s, assert the region in `apps/web/test/smoke.spec.ts`, test on VoiceOver, NVDA, JAWS.

**D5. Fix colour-alone meaning in the warm palette.**
Decision: Apricot on paper is 1.56:1, so every apricot cue (driver ring, contention border, selected row) gets a 1 px `--fg-2` stroke or a text label; raise `--fg-3` to about `#7C8290` and move 12 px timestamps to 13 px; `--warn`/`--ok` stay dots, never the only text colour for a status. Lands in `design/tokens.css` and `apps/web/src/tokens.css`. Evidence: `accessibility-streaming-chat` (measured ratios). Phase: now. Risk: the single-accent rule in `docs/12_brand.md` gains a stroke; the `design/*.html` mocks must be re-exported.

**D6. One type scale; agent prose at 16/1.65 in a 680 px measure.**
Decision: tokens `--t-xs 12 / --t-sm 13 / --t-ui 14 / --t-body 16 / --t-title 34`; delete 11.5 and 15.5; `.msg .text { max-width: 680px }` inside the 760 px column; markdown headings change weight, not size; mono normalised with `font-size-adjust`, ligatures off, tabular numerals; `pre.code` and `pre.log` as two components; a metric-matched fallback so streaming never reflows. Evidence: `typography-reading-agent-text` (Butterick's 45-90 character measure, OpenAI's short ladder, JetBrains Mono x-height). Phase: now. Risk: Instrument Sans's x-height ratio is unmeasured and dark-mode weight 450 is a guess.

**D7. Empty states are about people; the late joiner gets the brief.**
Decision: `apps/web/src/copy.ts` keyed by `{surface, role, hasEvents, hasMembers}` with a vitest rule (one serif line, one sans line, two buttons, never "empty"); `EmptyStream` in `SessionView.tsx` with owner, observer and late-joiner variants, the third reusing `snap.brief` inline; `Project.tsx:82` and `Home.tsx` lead with the thesis; `orgs.ts` gains `landing` so a member with one live project lands inside it; the Tauri shell opens on the identity screen with `HENOSIS_SERVER` prefilled, no native connect dialog. Evidence: `onboarding-empty-states` (Linear, Notion, Slack default channels); `session-replay-time-travel-ux` (the brief's "since seq N" is a seek target). Phase: now. Risk: "empty because of others" can read as blame; name the role, not the person.

**D8. The inbox is a triaged thread store with per-item verbs.**
Decision: in `packages/server/src/notify.ts`, replace `read` with `state: open | done | snoozed`, add `threadKey`, `reason`, `allowed[]`; upsert by thread and reopen on activity; `apps/web/src/views/Inbox.tsx` grouped by project, "Needs you" over "Later", acting inline through the extracted `ApprovalNotice` and the same `vote` path so hash binding stays in the kernel; tray count becomes `reportNeedsYou`. Evidence: `notifications-inbox-patterns` (Octobox reopen, Linear snooze, LangChain per-item capability). Phase: next quarter. Risk: snoozing an approval leaves an agent paused; say so and offer another voter. A stale vote renders "that moment passed", not an error.

**D9. Typed presence, one quiet line, no cursors.**
Decision: `PresenceEntry.activity: watching | reading | composing | deciding | away` plus `composing` target, `readingSeq`, `approvalId` in `packages/protocol`; debounce 250 ms, composing TTL 20 s, away after 5 min in `packages/server/src/host.ts`; one `--fg-3` line above the composer ("Bo is writing a directive"); avatar row adds away opacity and a stale note; desktop focus/blur feeds the away timer; mobile never sends `composing`. Evidence: `presence-collab-ux` (passive awareness, typing-indicator TTLs, Figma cursor fatigue). Phase: next quarter. Risk: scope words can leak intent; "Dee is looking" is a hypothesis, not a vote.

**D10. A hairline scrubber; "fork here" is the only edit verb.**
Decision: `seekSeq` on `ClientSnapshot` and `HenosisClient.seek(seq)` folding a prefix from a 256-event snapshot cache, server untouched; a 2 px track atop the column with ticks only for named moments and the viewer's `lastSeenSeq`; clicking a timestamp seeks; the composer becomes "Viewing seq 412 · Fork from here · Back to now"; epochs render as bands so concurrent directives never imply order; `[`/`]` and `Esc Esc` on desktop. Evidence: `session-replay-time-travel-ux` (Replay.io jump-to, LangGraph fork-on-restore, Claude Code `/rewind`); `04_technical_architecture.md` (`fold` is deterministic). Phase: next quarter. Risk: detaching from live autoscroll mid-run; workspace-at-seq exists only at checkpoints.

**D11. Receiver synthesis as a journaled gate; briefs measured extrinsically.**
Decision: split `packages/kernel/src/brief.ts` into `briefModel` (severity band first, contingencies added) plus a renderer; events `brief.rendered`, `brief.viewed`, `handoff.synthesized`; `acceptHandoff` requires synthesis under policy; the client keeps Accept disabled until the restatement, with open items as checkboxes, is sent; `metrics.ts` computes time-to-first-correct-decision, reversal rate and synthesis coverage from events; an offline model-as-receiver benchmark in `packages/runner` runs before any human A/B. Evidence: `handoff-brief-evaluation` (I-PASS bundle, SBAR's weak evidence, extrinsic metrics, LLM fluency bias). Phase: now for the gate (roadmap phase 1 promises it), later for the refined variant. Risk: no ground truth for "correct decision"; a team of ten cannot power a naive A/B.

**D12. Mobile inherits, never leads.**
Decision: `apps/mobile` uses the same tokens, `copy.ts` strings and `EmptyStream`; hides the palette and list mode, collapses the scrubber to one row of ticks; code blocks wrap; presence is `reading` while backgrounded. No mobile-only feature until partners ask. Evidence: every memo's closing note. Phase: later. Risk: approving from a phone on a flaky socket is the one on-the-go act that matters, and stale presence does not cover it.

## What we still do not know

1. Which key combinations each browser and OS actually deliver to the page.
2. How VoiceOver, NVDA and JAWS handle a debounced status region through a 20-minute turn.
3. Instrument Sans's real x-height ratio, and whether weight 450 is right on navy.
4. Whether a late joiner wants the full brief, a shorter one, or a "since you left" delta.
5. What "empty because of others" should say in a project with six members and no sessions.
6. Whether snoozing an approval should reassign the vote or leave the agent paused.
7. Whether "Ana is reading turn 12" is visible to everyone, the driver, or nobody.
8. The cost of `fold` on drag for 50k-event logs even with a prefix cache.
9. What a wrong first decision after a handoff is, so the metric has ground truth.
10. Whether design partners value replay and audit over live steering, which would reorder D8 to D10.
