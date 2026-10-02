# Design explorations

Thirty explorations of the Fold register (one accent, rows not cards, status as words), judged in five rounds (`_judge-*.md`). No rejects. Score is the judge's mean of 10.

## Index

|Exploration|One line|Verdict|
|---|---|---|
|[approval-notice](approval-notice/index.html)|A box only while it is a question|keep 9.2|
|[contention-notice](contention-notice/index.html)|Verbatim rows, symmetric Picks, no primary|keep 8.6|
|[handoff-flow](handoff-flow/index.html)|Offer, I-PASS brief, divider as authority change|keep 8.6|
|[session-view-variants](session-view-variants/index.html)|C: time and turn in a quiet gutter|keep C 8.4|
|[composer-variants](composer-variants/index.html)|One sheet, six states|keep, revise 8.2|
|[presence-driver](presence-driver/index.html)|One ring means "holds the seat"|revise 7.4|
|[replay-scrubber](replay-scrubber/index.html)|Dot per turn; the log folds back|revise 7.4|
|[command-palette](command-palette/index.html)|One field, one list; any text is a steer|keep 8.8|
|[sidebar-variants](sidebar-variants/index.html)|A: projects with nested sessions; C as collapse|keep A, C 8.4|
|[sessions-list-states](sessions-list-states/index.html)|Dot left, one mark right, unread is weight|keep, fix mark 8.4|
|[search](search/index.html)|A page with headings and counts|keep, revise 8.2|
|[keyboard-shortcuts](keyboard-shortcuts/index.html)|One live sheet, four groups|keep, revise 8.0|
|[details-drawer](details-drawer/index.html)|Five plain lists; phone sheet identical|revise 7.6|
|[empty-states](empty-states/index.html)|The empty page is the full page|keep 8.8|
|[approvals-queue-desktop](approvals-queue-desktop/index.html)|Stream rows under a project header|keep 8.8|
|[team-page](team-page/index.html)|A sentence instead of stats; four lists|keep 8.6|
|[memory-browser](memory-browser/index.html)|Conflict first; attributed ledger rows|keep 8.6|
|[share-invite](share-invite/index.html)|Popover, not modal; "opens as observer"|keep, revise 8.6|
|[project-page](project-page/index.html)|Direction field, session rows, memory|keep 8.4|
|[home-onboarding](home-onboarding/index.html)|Three screens with nothing new|keep, revise 8.4|
|[branch-fold-flow](branch-fold-flow/index.html)|Branch as an action on a turn|keep, revise 8.2|
|[notifications-inbox](notifications-inbox/index.html)|Four-part row; "needs you" the only count|revise 7.8|
|[settings-page](settings-page/index.html)|Native controls in rows|revise 7.6|
|[marketing-landing](marketing-landing/index.html)|The register over a page|keep 8.8|
|[desktop-window-chrome](desktop-window-chrome/index.html)|No titlebar; crease to the edge|keep, revise 8.4|
|[desktop-tray-notifications](desktop-tray-notifications/index.html)|OS notifications and tray only|keep, revise 8.4|
|[microcopy-guide](microcopy-guide/index.html)|Ten rules; source of truth for copy|keep 9.0|
|[dark-mode-audit](dark-mode-audit/index.html)|27 pairs measured; four values move|keep 8.6|
|[icon-set](icon-set/index.html)|28 line glyphs, no state icons|keep, revise 8.4|
|[motion-spec](motion-spec/index.html)|Three durations, three easings|keep, revise 8.2|

## Decisions for the product

Build into `apps/web` and `apps/desktop` now.

**Conversation**

- A notice is bordered only while someone must answer; settled, it is a grey line. Approvals take the grey hairline, contentions and memory conflicts the apricot one. Irreversible differs by words and a verb-named button, never colour.
- The accent sits on the one thing this person must press; the send arrow drops to ink while a notice, palette or sheet is open.
- Session column is variant C: 760px, tool calls one per line, time and turn in a gutter hidden under 1200px.
- Composer: one sheet, mode and scope as chips, dashed hairline while waiting; interrupt keeps the hairline grey.
- Handoff: I-PASS brief as five rows, restatement required before Accept, the change drawn as a divider with the ring moving.
- Presence: 16/24px avatars, one ring, dashed while offered; the top bar is a sentence, no eye count.
- Replay: adopt the mechanics; the strip appears on demand and folds away.

**Navigation**

- Sidebar A with C's rail as collapse; inline the mark with `fill: var(--fg)`.
- Rows: dot left, one mark right, unread is weight 500, never a count; trailing words only needs you, 1 of 2, blocked, offered, folding, folded.
- The two-pixel apricot bar is the only selection mark anywhere.
- ⌘K acts and jumps (verbs first, typed text offered as a steer, footer "see all in Search"); Search is a page with headings and counts.
- Keyboard sheet: borderless keycaps; rows stay but say why they are off.
- Drawer: five lists, one-line rows, at most one action per list.

**Pages**

- Serif title, one sentence instead of stats, rows with a second line in the agent's grammar, status word and dot on the right.
- Empty list: one sentence, one action, filled only when no composer is on screen.
- One composer per page; project direction is a hairline field with a quiet Set.
- Non-focused actions are text; outlined buttons only on the cursor row; filled only on this person's action.
- Filters are words with the active one in ink, never segmented controls.
- Settings: checked states in ink, accent on focus only; notification channels as words.

**Desktop**

- Undecorated window; sidebar holds the traffic lights; title row is the drag region; rows share 52/40/48px so the crease reaches the edge.
- OS notifications and tray only. Title is the ask with its object; Review and Deny for irreversible, Approve and Deny for reversible, none on handoffs; Dismiss is not Deny. One "needs you" number across tray, badge and sidebar.
- The landing frame is a reduced render of the product shell.

**System**

- `microcopy-guide` is the source of truth; `copy.ts` implements it: five status words, "Approve · Deny", "needs two drivers", "Ana approved · 1 of 2".
- `tokens.css` v5: light `--fg-2` #616676, `--fg-3` #6E727C, `--warn` #AD6F2A; dark `--fg-3` #9298A6; tertiary text on the canvas only; a `prefers-contrast: more` block.
- Icon sprite as drawn, no state icons, no glyphs inside Approve and Deny; redraw team and agent at 16px.
- Motion: 120/200/320ms, arrive/leave/move, one idle dot, opacity and transform only, `fill: backwards`, staggers capped at eight.

## Open design questions

- Contention hairline on linen: darker, or 1.5px in light only?
- The app icon's Dress Blues sheet vanishes on dark grounds; test at 32px.
- Memory attribution column: fixed width, hash on hover?
- Which of the project page's three right-side actions goes?
- Does the thinking dot replace the running pulse during a turn?
- Does any page justify the approvals queue's third sidebar order?
