# Product specification

## One sentence

Henosis is the shared, living session for a team's long-running agents: anyone on the team
drops in, sees exactly what the agent is doing and why, steers it with attributed
directives, approves what needs approving, forks to try something, and hands the wheel to
the next person with a brief the system wrote.

## Who it is for, in order

1. **Engineering teams running agents for hours or days** (migrations, large refactors,
   incident remediation, CI babysitting). Today the run belongs to whoever started it.
2. **Platform teams** who want one audit, approval and handoff layer across every harness
   their engineers use (Claude Code, Codex, Cursor, in-house).
3. **Non-engineering teams** where several people already crowd one problem: a deal desk,
   a support escalation, a contract negotiation, a model build, a campaign. Same kernel,
   different tools and templates.

## The primitives, as a user sees them

| Primitive | What the user does | What the system guarantees |
|---|---|---|
| **Join** | Open the session link | Full history folded locally; presence shows who is here and who is driving |
| **Watch** | Read the stream | Every model message, tool call and result, attributed and ordered |
| **Steer** | Type a directive; pick a scope (goal, api, tests...) | Arbitrated against everyone else's; applied at the next safe point, or now with *interrupt* |
| **Constrain** | Add a standing rule | Accumulates; never conflicts; always in the model's context |
| **Pause / resume / cancel** | One click | Agent stops at the next safe point; who may resume is a role matter |
| **Contention** | Two peers steer the same scope at once | Both see it; the agent works around it; the driver resolves it |
| **Approve** | Vote on a risky tool call | Policy per risk class; quorum for irreversible actions; the agent waits |
| **Fork** | Branch at a checkpoint | Cheap; isolated workspace and directives; own agent runner |
| **Merge** | Bring a branch back | Three-way workspace merge; conflicts flagged; contested directives become contentions |
| **Hand off** | Offer the driver seat | Recipient accepts; receives a computed brief: situation, open items, what changed since they were last here |
| **Replay** | Open any past session | Deterministic; verifiable; no model calls |

## Fleet and memory primitives

| Primitive | What the user does | What the system guarantees |
|---|---|---|
| **Agents rail** | Open the app | Every live agent in the sidebar as a card: status, what it is on, Solo or Team, who is in it and who with; crews grouped by name |
| **Crew** | An owner or lead names the task two agents share ("Invoice rollout") | Crewmates appear in each other's model context and brief; the rail and the project page group them; `null` makes a session solo again |
| **Team chat** | Say something to the people in a session, or to everyone on a project | Kept in the session log or the project ledger as a note, attributed and replayable; never sent to the agent; the composer's Agent / Team toggle keeps the two apart |
| **Fleet board** | Open a project | Every engineer's session as a row under its crew: status, goal, claims, blockers; Team up and Leave crew inline; one page, live |
| **Claim** | Agent or human claims a path, service or ticket | Deterministic verdict; a denied claim is a contention for both owners and the lead |
| **Lead directive** | A lead steers or constrains the project | Enters every session above owner rank; visible as `[project]` in every intent |
| **Fleet contention** | Two sessions collide | Both owners and the lead see it; the lead resolves; the loser's claims release |
| **Fleet brief** | A manager opens the team view | Computed from the ledger: sessions, open items, direction, claims |
| **Remember** | An agent or human records a fact | Attributed to the engineer, session and commit; scoped; conflicts surfaced by name |
| **Curator** | Runs on a schedule | Compacts with attribution, flags stale agent-written entries, lists conflicts |

## Plan first and release gates

Everything is planned out first and then implemented, with approval ratings before the code
is pushed, from the people who consume it.

| Primitive | What the user does | What the system guarantees |
|---|---|---|
| **Plan** | Set a goal in a plan-first session | The agent proposes steps (title, detail, token estimate, risk) before any work; the plan is a card in the stream; the session shows *Planning* and the composer says the plan waits |
| **Rate** | Pick one to five stars on the plan, with a note | One rating per person, contributor or above; the kernel approves the plan when the policy's count and average are met (default: one rating at 3+), derived in the fold, so every replica agrees |
| **Decide** | An owner or the driver clicks Approve now, Ask to revise or Reject | Overrides the ratings; a revision brings a new plan that supersedes the old one; a rejection stops the agent until someone steers again |
| **Gate** | Nothing | While the plan waits, every tool call above `read` is refused with a result the model reads: "the plan is not approved yet; wait or revise" |
| **Steps** | Watch the rows | The agent marks the step it is on; each step records the tokens it took beside its estimate; the plan is done when every step is; the totals sit against the session's token budget |
| **Release gate** | Rate an approval under a ratings rule | A rule `{ ratings: { min, average, of } }` grants only when enough people at that role approve with a high enough average (default for `irreversible`: two contributors at 4+); an unrated approve is a voice, not a vote; the notice, the queue, the inbox and the palette all take the rating; Approve without a pick sends 4 |

The new-session forms (home and project page) carry *Plan first* (on by default) and an
optional *Token budget*. Budgets are soft: the agent is told what it has spent, the card shows
it, nothing is cut off.

## Surfaces

- **Web client** (`apps/web`): the agents rail, the event stream with team messages, the
  Team panel (people, crew, chat), the Details drawer (intent, roles, branches, workspace,
  brief), contention and approval notices. One page; folds the same events as the server.
- **CLI** (`henosis join`): the same session from a terminal, for people who live there.
- **Server** (`henosis serve`): hosts sessions, persists logs, runs the agent.
- **Slack** (`packages/slack`): channels per team, project and management; a thread per
  session; approvals as buttons; contentions and memory conflicts with resolve buttons.
- **Desktop and mobile shells** (`apps/desktop`, `apps/mobile`): the same web client with a
  tray and native push, opened by deep links from notifications.
- **Phase 1 surfaces:** GitHub PR adapter (a PR is a session), VS Code and Zed panels, and a
  harness SDK so Claude Agent SDK, LangGraph and OpenAI Agents runs can be hosted as Henosis
  sessions.

## Roles

Observer (watch, ask for a brief), contributor (steer, constrain, pause, fork, vote where the
policy allows), driver (one person; resume, cancel, resolve, merge, hand off), owner (grant
roles, everything a driver can). The first human into a new session owns it.

## Policies a session is created with

- Approval rules per risk class (`read`, `write`, `exec`, `external`, `irreversible`).
  Default: exec needs a contributor, external the driver, irreversible a release gate of two
  contributors rating it 4+ on average.
- Contention policy: `block` (default), `latest-wins`, `driver-wins`.
- Turn budget.
- Plan first (`planFirst`, with `planApproval { min, average }`) and a soft token budget.
- Token budget (soft): input plus output tokens the branch may spend before the meter turns.

### Token usage

Every model call records what it cost (input, output, cache read, cache write) in the log,
so a session's spend is a fold like everything else and replays to the same number. The
session's top row carries a quiet chip, "12.4k tokens", that opens on hover to the breakdown;
when the policy sets a budget a hairline bar sits under it, amber past 80% and red past 100%.
The Details drawer has a Usage section with the budget left and the last turns one by one;
the agents rail and the project page show each agent's spend at the end of its line; the
handoff brief, the fleet brief and `henosis report` all say what was spent. Leads read totals
by session, engineer, project and turn from `GET /api/usage`. Nothing stops an agent at the
budget: it is a number people watch, not a gate (a gate is on the roadmap with plan-first).

## Non-goals for phase 0

Model-written merge summaries, semantic scope inference, multi-agent sessions (several
agents in one session), billing, hosted multi-tenant deployment. Each is on the roadmap.

## Success criteria for the pilot (phase 1)

- Three design-partner teams run at least one session per week that lasts over four hours
  with three or more humans present at some point.
- Median time for a newcomer to make a correct steering decision after joining a running
  session under ten minutes, using only the brief and the stream.
- Zero irreversible actions executed without the configured quorum.
- Every session replays bit-for-bit in CI.
