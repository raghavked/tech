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
  Default: exec needs a contributor, external the driver, irreversible two drivers.
- Contention policy: `block` (default), `latest-wins`, `driver-wins`.
- Turn budget.

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
