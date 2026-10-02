# Onboarding and empty states for Fold

Research memo, 2026-10-02. Topic: first-run, joining a team, first session, and the empty project, as done by claude.ai, ChatGPT, Linear, Notion and Slack, and what Fold should take from them. All vendor pages were blocked by the egress proxy; prior-art claims come from search snippets and are marked UNVERIFIED where the primary page was not read.

## Why it matters for Fold

Fold's whole pitch is that a session is a shared object: one agent, many humans. The empty states are where that claim is either made or lost, because every empty screen in Fold is a question about people, not about content. A project with no sessions is "nobody has started an agent here yet". A session with no events is "no one has given the agent a goal". A teammate opening a running session for the first time is not an empty state at all, but it is the same moment: they do not yet know what belongs on this screen or what they are allowed to do. The handoff brief, which the kernel already computes from the log (`docs/05_kernel_design.md`), is Fold's native answer to the late joiner, and no competitor has one.

Today the repo has the minimum. `apps/web/src/views/Home.tsx` opens on an identity form with the hint "unknown to the server; first in owns a session". `apps/web/src/views/Project.tsx:82` renders `No sessions yet.` in muted text. `SessionView.tsx` has no empty-stream state at all. The register the brand doc asks for (quiet sidebar, 760 px column, one accent) is also the register in which claude.ai and ChatGPT do their empty states, so the shape is settled; what is missing is the copy, the three or four distinct moments, and the rule for what a screen says when it is empty because of other people.

## Prior art

1. **NN/g, "Empty States in Application Design: 3 Guidelines"** (https://www.nngroup.com/videos/empty-states-in-application-design-guidelines/, accessed 2026-10-02, page blocked, UNVERIFIED). The snippet-level summary: an empty state should communicate system status ("nothing is here yet, and that is fine"), teach what belongs here, and give a direct path to the next action; in-context guidance at the moment the screen is reached beats an up-front tutorial that is forgotten.

2. **Linear onboarding teardown** (https://www.candu.ai/blog/linear-onboarding-teardown, accessed 2026-10-02, blocked, UNVERIFIED; corroborated by https://www.saasui.design/pattern/onboarding/linear and https://uxdesign.cc/the-onboarding-linear-built-without-any-ab-testing-b035572ced72, both blocked). Reported flow: welcome, theme, team name, import (GitHub, Jira, or later), invites or skip, notifications, then the cursor is already in "Create your first issue". About a minute, no tour, no tooltips; calm copy on each step. Invite copy as reported: "Linear is meant to be used with your team. Invite some co-workers to test it out with them." Domain auto-join is called out as the single highest-leverage team-expansion decision.

3. **Notion's lightweight onboarding** (https://goodux.appcues.com/blog/notions-lightweight-onboarding, accessed 2026-10-02, blocked, UNVERIFIED). Reported sequence: create workspace, invite team, create first page, pick a template. The Getting Started page is a learn-by-doing document; signup copy is "succinct, colloquial, and reassuring", optional fields labelled as optional, a plain progress indicator. The useful observation: Notion knows a blank page is unnerving, so the first page is pre-filled and editable rather than empty.

4. **Claude mobile app critique, Pratt IXD** (https://ixd.prattsi.org/2026/02/design-critique-claude-mobile-app/, accessed 2026-10-02, blocked, UNVERIFIED). The home screen is a centred greeting, "How can I help you this evening", adapting to time of day, with the composer directly beneath; the mark animates while thinking. The empty screen is a greeting plus a composer and nothing else. ChatGPT's equivalent (observed from product use, no citable page) is the same shape: a centred line, a composer, a few optional starter chips.

5. **Slack onboarding teardown** (https://userguiding.com/blog/slack-user-onboarding-teardown, accessed 2026-10-02, blocked, UNVERIFIED). Slack fills empty channels with tips, channel suggestions and shortcuts, keeps the important material for a proper onboarding flow, and uses admin-set default channels so a new member lands inside live conversations rather than in a blank workspace. Slack's own tip page (https://slack.com/slack-tips/welcome-new-employees-to-your-team) recommends a welcome channel with pinned context.

6. **Figma multiplayer** (https://madebyevan.com/figma/multiplayer-editing-in-figma/, accessed 2026-10-02, not fetched). Relevant only as the negative result: presence (named cursors, avatars top-right) is well covered, but no public source documents a "late joiner" catch-up pattern. That gap is Fold's to fill.

## What to borrow

- **One line and a composer.** claude.ai and ChatGPT prove that an empty conversation needs a greeting, a composer, and at most three quiet suggestions. No illustration, no card grid. This is already the brand rule in `docs/12_brand.md`.
- **Pre-filled, not blank.** Notion's first page and Linear's pre-placed cursor both replace "do something" with "edit this". Fold's analogue is a draft goal in the composer and a sample directive, not a tutorial.
- **Team is the default, and skipping is honest.** Linear says plainly that the product is meant for a team and offers "later". Fold's one-agent-many-humans thesis demands the same sentence on the first screen, with the same escape.
- **Land inside live work.** Slack's default channels mean a joiner's first screen is never empty. For Fold, a new member of a project should land on the live agents list, or on the one running session, not on the identity form.
- **Teach by status, in context.** NN/g's three jobs (status, what belongs here, next action) map cleanly onto Fold's status words (running, awaiting approval, blocked, paused, idle), which can carry the empty-state copy without new vocabulary.

## What is unsolved

- **The late joiner.** Nobody has shipped "you arrived at minute 40 of a 3-hour agent run; here is what you need". Fold's handoff brief is the right primitive, but it is currently shown only to an incoming driver (`SessionView.tsx` handoff flow). Whether an observer wants the same brief, a shorter one, or a "since you were last here" delta is untested.
- **Empty because of others.** "No sessions yet" in a project with six members is a social fact. Should the copy name who could start one, or stay neutral? Linear and Notion never face this because their empty states are single-player.
- **Authority on first contact.** An observer who opens a session cannot steer; the composer must say why without scolding. No prior art, since chat products have one user who can always type.
- **Fleet empty states for a lead.** An empty fleet brief ("no contentions, no denied claims") is good news and should read as such, but a dashboard that says "nothing" risks looking broken. The register forbids tiles, so this is a single sentence problem.

## Concrete recommendations for Fold

1. **Three greeting states for the session column, in `apps/web/src/views/SessionView.tsx`** (new `EmptyStream` component next to `Stream`). (a) No events, I am owner or driver: serif title "What is this session for?", one line of sans "Give the agent a goal. Anyone on the project can watch, steer and approve from here.", composer focused with the project's name pre-typed as a draft. (b) No events, I am observer or contributor: same title, line reads "Ana owns this session and has not set a goal yet. You can watch; ask Ana for the driver seat to steer." with a single ghost button "Ask to drive" wired to `handoff.request`. (c) Events exist and I have never been present: render the computed brief inline as a quiet notice above the stream, "You are joining at step 212. Situation, open items, what changed." with "Dismiss" and "Take the driver seat". Reuse `snap.brief`; do not compute a new one.

2. **Project with no sessions, `apps/web/src/views/Project.tsx:82`.** Replace `No sessions yet.` with a short block: "No agents on this project yet." then one sans line that names the next action by role. Lead or admin: "Set direction above, or start the first session." Member: "Start a session; the lead's direction applies to it automatically." One primary button "New session", which opens the existing `?new=1` path, and one ghost "Invite teammates". Keep it inside the 760 px column; no illustration.

3. **First-run identity screen, `apps/web/src/views/Home.tsx` (`IdentityForm`).** Lead with the thesis, not the fields. Serif heading "Bring your team into the fold." and one line "One agent, many people. Sign in so your directives and approvals carry your name." Rename "User id" hint from "as in users.json" to "Your handle on this server", keep "Token (optional)" but move its explanation into a muted line beneath. The "first in owns a session" sentence belongs after sign-in, in the project empty state, not here.

4. **Joining a team, `apps/web/src/views/Team.tsx` and `packages/server/src/orgs.ts`.** When a user's identity is resolved and they belong to exactly one project with running sessions, route them to that project (Slack default-channel behaviour) rather than to the project list. On the team page with no projects: "No projects yet. A project groups the sessions your engineers run on one codebase." with "New project". Add a `landing` field to the `me` response in `orgs.ts` so the client does not guess.

5. **Copy module and tests, `apps/web/src/copy.ts` (new) plus `apps/web/test/`.** Centralise all empty-state strings keyed by `{surface, role, hasEvents, hasMembers}` so the mobile shell in `apps/mobile` reuses them verbatim. Rule set, enforced by a vitest snapshot: one serif line, at most one sans line, at most two buttons, status word only from the five in the brand doc, never the word "empty", "oops" or an exclamation mark.

6. **Empty fleet brief, `packages/fleet` and the Slack adapter in `packages/slack`.** When the brief has no contentions, denied claims or merge conflicts, emit the sentence "Quiet: 4 agents running, nothing contended, no approvals waiting." in both the web project page and `/fold brief`, so an empty brief reads as a good report rather than a missing one. Add the case to the fleet brief property tests.

7. **Desktop first launch, `apps/desktop/src-tauri`.** The Tauri shell should open directly on the web client's identity screen with the server URL field pre-filled from `FOLD_SERVER` or the last value; a native "connect to server" dialog would be a second onboarding and must not exist.

## Sources

- https://www.nngroup.com/videos/empty-states-in-application-design-guidelines/ (blocked, snippet only)
- https://www.candu.ai/blog/linear-onboarding-teardown (blocked, snippet only)
- https://www.saasui.design/pattern/onboarding/linear (blocked)
- https://uxdesign.cc/the-onboarding-linear-built-without-any-ab-testing-b035572ced72 (blocked, member-only)
- https://goodux.appcues.com/blog/notions-lightweight-onboarding (blocked, snippet only)
- https://ixd.prattsi.org/2026/02/design-critique-claude-mobile-app/ (blocked, snippet only)
- https://userguiding.com/blog/slack-user-onboarding-teardown (blocked, snippet only)
- https://slack.com/slack-tips/welcome-new-employees-to-your-team (not fetched)
- https://madebyevan.com/figma/multiplayer-editing-in-figma/ (not fetched)
- Repo: `/home/user/tech/docs/12_brand.md`, `/home/user/tech/docs/13_fleet_collaboration.md`, `/home/user/tech/apps/web/src/views/{Home,Project,SessionView}.tsx`, `/home/user/tech/design/tokens.css`
