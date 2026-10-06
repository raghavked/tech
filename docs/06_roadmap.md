# Roadmap

## Phase 0: the kernel (this repository)

Done. Deterministic, branchable, hash-chained session log; intent arbitration with an
order-independence property test; role lattice with a transferable driver token; approval
policies with quorum; fork and three-way merge with directive carry-over; computed handoff
brief; crash-resumable runner; websocket server with persistence; web and CLI clients; an
offline demo and an end-to-end test that runs in CI with no network and no model API.

## Phase 0.5: fleet, memory, Slack, shells (this repository, second pass)

Done. Project ledger with claims, lead directives, cross-session contentions and a fleet
brief; organisation memory with attribution, conflicts, compaction and a curator; Slack
adapter with channels per team, project and management; identity from `users.json`;
notifications with deep links; the Henosis brand, mockups of every surface, the rebuilt web
app with fleet board and management views, and the desktop and mobile shells.

## Phase 0.75: Henosis (this repository, third pass)

In progress. The rebrand to Henosis and the unity thesis: agents as members. Token usage on
every model call, summed per turn, session, project, person and day; plan-first sessions
with ratings and the release gate held by the consumers of the code; groups and chats with
people and agents as members and @mentions that reach the agent's session; a vibrant,
expressive theme on the palette with loading and side motion; team customisation (accent,
mark, motion, emblem) set by leads; the manager's view with token charts, plan compliance
and gates; desktop first, mobile second.

## Phase 1: design partners (months 1 to 4)

Goal: three engineering teams using Henosis weekly on real multi-hour agent runs.

- **Harness adapters.** Host a Claude Agent SDK run as a Henosis session (the adapter maps
  its hooks to turn, tool and approval events). Then LangGraph and the OpenAI Agents SDK.
  The kernel does not change; the runner grows a `HarnessRunner`.
- **Identity.** OIDC login, server-issued actor ids, per-event signatures. Per-participant
  tool credentials through a server-side broker so an action runs with the authority of
  those who approved it.
- **Sandboxing.** Per-session container for tools; network off by default.
- **Slack adapter in production.** Install the Bolt app with three design partners; add
  per-channel digests and a daily management summary.
- **Receiver synthesis on handoff.** The incoming driver restates the plan; the restatement
  is journaled before authority moves.
- **Log compaction and reconnect.** JSONL per branch, periodic snapshots, resume-from-seq
  for clients, Merkle inclusion proofs so an observer can verify its prefix.
- **Context merge.** When a branch merges, a journaled summariser call folds its decisions
  into the target's context.

## Phase 2: platform (months 5 to 9)

- Hosted multi-tenant service on an actor-per-session substrate (Durable Objects or
  equivalent), with the kernel unchanged.
- Policy packs per industry: risk classes and approval rules for deploys, payments, legal
  filings, outbound customer communication.
- Scope inference: a classifier proposes a scope for each directive; the author confirms.
- Session templates for sales, support, legal, finance and marketing, each with its tool
  set and brief format.
- Analytics: time-to-first-steer for newcomers, contention rate, approval latency, handoff
  count, replay coverage.

## Phase 3: standard (months 10 to 18)

- Publish the session protocol and the log format; reference adapters maintained with
  harness vendors.
- Audit exports mapped to EU AI Act Articles 12 and 14 and to SOC 2 evidence requests.
- Multi-agent sessions: several agents, one intent lattice, with agents as ranked
  participants.

## Milestones that would change the plan

- A first-party harness ships native multi-human sessions with fork and quorum: compete on
  neutrality and audit, or partner as their cross-vendor layer.
- Slack Code becomes the default surface: ship the Slack adapter first and make the kernel
  the state behind the channel.
- Design partners value replay and audit over live collaboration: lead with the compliance
  product and keep live steering as the on-ramp.
