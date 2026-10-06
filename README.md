# Henosis

**The studio where your team and its agents work on one piece.**

<p><img src="design/logo.svg" alt="Henosis" height="56"></p>

Agents now run for hours, days and weeks. Work at that scale pulls in many people, but every
agent product today gives the run to one person: everyone else gets a read-only link, or a
Slack thread the model has to make sense of. Henosis makes the session itself the shared
object. Anyone on the team drops in, watches, steers, approves, forks, merges and hands off,
and the kernel decides what happens when two people steer at once.

Three layers, all event-sourced, all replayable:

- **Session**: one agent, many humans. Arbitrated steering, approvals with quorum, fork and
  merge, handoff with a computed brief. [`docs/05_kernel_design.md`](docs/05_kernel_design.md)
- **Fleet**: many engineers' agents in one project. Claims on shared ground, lead directives
  above owner rank, cross-session contentions, a fleet brief for managers, Slack channels per
  team, project and management. Crews: several agents named onto one task, briefed on each
  other. The agents rail shows every live agent, what it is on, Solo or Team and who with;
  team chat in a session or on a project never reaches the agent.
  [`docs/13_fleet_collaboration.md`](docs/13_fleet_collaboration.md)
- **Organisation memory**: what the fleet knows and who said so. Attributed, scoped, compacting,
  with explicit conflicts and a curator. [`docs/14_organisation_memory.md`](docs/14_organisation_memory.md)

One web app is the product; the desktop and mobile shells wrap the same client, in the way
Claude on the web, Claude Desktop and Claude mobile are one product. Brand and mockups in
[`design/`](design/) and [`docs/12_brand.md`](docs/12_brand.md). Business docs start at the
[one-pager](docs/00_thesis_one_pager.md).

> Phase 0. Dev-server authentication only, scripted model by default, nothing here is
> hosted. See `docs/07_security_and_compliance.md` before pointing it at anything real.

## What is new here

- **Session as a hash-chained, branchable log.** Model and tool outputs are recorded, so any
  session replays deterministically and resumes from a snapshot. `henosis verify` proves it.
- **Intent arbitration.** Concurrent directives from many humans compose into one intent by
  explicit rules (authority, recency, scope). Peers who disagree in the same epoch produce a
  *contention* the agent works around until a driver resolves it. Composition is independent
  of arrival order; a 300-trial property test says so.
- **Authority and approvals.** Observer < contributor < driver < owner, with the driver seat
  as a transferable token. Tool calls carry a risk class; irreversible ones need a quorum of
  distinct humans, and approvals are bound to the hash of the exact call.
- **Plan first, and release gates rated by the people who consume the code.** The agent
  proposes steps with token estimates before it may change anything; the team rates the plan
  one to five and the kernel approves it in the fold; each step records what it actually
  cost. A push or a deploy waits until enough raters approve it with a high enough average.
- **Fork and merge.** Branch at a checkpoint; merge with a three-way workspace merge and
  directive carry-over that turns conflicting steers into contentions instead of overrides.
- **Handoff with a computed brief.** The incoming driver gets situation, open items, what
  the agent did, and what changed since they were last present, generated from the log.
- **Crash-resumable runner.** A new runner finishes the tool calls a dead one left behind.
- **Fleet claims and lead directives.** A write to a path another engineer's session holds
  is refused as a tool result the agent can read; a lead's constraint reaches every session
  above owner rank; denied claims, unclaimed overlaps and merge conflicts on held paths
  become contentions both owners and the lead see.
- **Attributed team memory.** An agent's fact is Ana's fact: entry, session and commit are
  recorded; two engineers disagreeing on one key is a conflict readers see with both names;
  compaction keeps the names.

## Quickstart (five minutes, no network)

```bash
pnpm install
pnpm build
pnpm demo                                   # offline: four humans, one agent, then a two-agent fleet
cat store-demo/sessions/demo/narrative.md   # what happened and why
cat store-demo/sessions/demo/brief.md       # the handoff brief Bo received
cat store-demo/projects/billing/fleet-brief.md   # what the lead sees
node packages/cli/dist/main.js verify store-demo/sessions/demo/log.json
node packages/cli/dist/main.js fleet store-demo/projects/billing/ledger.json
```

Live, in two terminals plus a browser:

```bash
pnpm serve                                   # ws://127.0.0.1:7700/ws, scripted model
node packages/cli/dist/main.js join demo --as Ana      # first in: owner and driver
node packages/cli/dist/main.js join demo --as Bo       # contributor
pnpm --filter @henosis/web dev                # http://localhost:5173, join as a third person
```

In Ana's terminal type `Build a doubling helper and deploy it`; in Bo's type
`/constrain no external dependencies`. Watch the approval prompts, `/approve <id>`, then
`/handoff bo` and `/accept <id>` on the other side, and `/brief`.

With `ANTHROPIC_API_KEY` set, `pnpm serve -- --model claude` runs a real model through the
same kernel. `HENOSIS_OFFLINE=1` blocks it.

## Commands

| Command | Purpose |
|---|---|
| `henosis serve [--port] [--dir] [--model scripted\|claude] [--token]` | host sessions over websockets |
| `henosis demo [--dir]` | the offline multiplayer scenario; writes log, brief, report, narrative |
| `henosis join <session> --as <name> [--url] [--token] [--branch]` | terminal participant |
| `henosis replay <log.json> [--branch]` | fold a log and print the brief |
| `henosis verify <log.json>` | hash chain and replay determinism for every branch |
| `henosis report <log.json>` | markdown report of every branch |
| `henosis fleet <ledger.json>` | fleet brief from a project ledger |
| `henosis slack --config slack.json` | serve plus the Slack adapter in socket mode |

## Repository map

```
packages/protocol   zod schemas: actors, roles, directives, tool calls, events, wire messages
packages/kernel     pure core: hash, log, arbitration, approvals, reducer, merge, brief, replay, Session
packages/runner     agent loop, tool registry, scripted model, Claude adapter
packages/fleet      project ledger: claims, lead directives, contentions, fleet brief, identity
packages/memory     organisation memory: attributed entries, conflicts, compaction, curator
packages/chat       groups and chats: a chained log per org where people and agents are members,
                    mentions, agent replies, read markers
packages/server     websocket and HTTP server, project, session and chat hosts, notifications, persistence
packages/slack      Slack adapter on an interface with an in-memory fake; Bolt socket mode
packages/cli        the fold binary
apps/web            the product: React client that folds the same events as the server (PWA);
                    agents rail, team panel, groups and chats, command palette (⌘K), inbox,
                    approvals queue, memory browser, replay scrubber, branch compare, settings,
                    share, export, offline queue and reconnect-resume
apps/desktop        Tauri 2 shell around the web client: tray, native notifications, deep
                    links (henosis://), auto-update (docs/16_desktop_release.md)
apps/mobile         Capacitor shell around the web client with native push
design/             brand tokens, logo, static mockups of every surface
scripts/            e2e.sh and the scripted websocket clients it drives
docs/               thesis, market, landscape, product spec, architecture, kernel design,
                    roadmap, security, business model, threat model, sources, open questions,
                    brand, fleet, memory, copy, desktop release, performance; docs/research/
                    holds the deep-tech memos
```

## Development

```bash
pnpm check     # lint (biome), typecheck, unit and integration tests (vitest), build, e2e
pnpm test      # kernel semantics, runner, fleet, memory, server, Slack adapter
```

Tests and e2e run offline. CI runs the same pipeline on every push.

## Status and licence

Phase 0 complete; see `docs/06_roadmap.md`. Licence not yet chosen; all rights reserved until
the founder decides.
