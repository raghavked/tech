# Henosis

**One team, people and agents.** Henosis (ἕνωσις, union) is the shared, living session for
a team's long-running AI agents, where agents are members of the team.

<p><img src="design/logo.svg" alt="Henosis" height="56"></p>

Agents now run for hours, days and weeks. Work at that scale pulls in many people, but every
agent product today gives the run to one person and treats the agent as a tool that person
holds. Henosis makes the agent a member and the session the shared object: anyone on the team
drops in, watches, steers, approves, forks, unites and hands off; the kernel decides what
happens when two people steer at once; people and agents sit in the same groups and chats;
nothing is built before the team has rated the plan, and nothing ships before the people who
will live with it have rated the release. The selling moment is joining: a new engineer and a
new agent enter the same circle on the same day, with the same memory, the same manners and
the same manager's view.

Henosis runs the same way for a two-person startup and a company of thousands: one server
and a folder for the first team, an identity provider, a database and sharded session actors
for the large one, the same kernel and the same product in between. The editions and what
scales between them are in [`docs/18_editions.md`](docs/18_editions.md).

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
- **Council**: a team's own models deliberate on one task in a group: each answers alone, they
  discuss, a chair writes the plan with an owner per step, people rate it, the work is
  assigned to the members' agents and their reports and the dissent land in the same room.
  Every word and token in the group's replayable log; in Slack as a thread, in the CLI from
  the log. [`docs/19_council.md`](docs/19_council.md)

One web app is the product; the desktop and mobile shells wrap the same client, in the way
Claude on the web, Claude Desktop and Claude mobile are one product. Brand and mockups in
[`design/`](design/) and [`docs/12_brand.md`](docs/12_brand.md). Business docs start at the
[one-pager](docs/00_thesis_one_pager.md).

> Phase 0. Dev-server authentication only, scripted model by default. The one hosted
> deployment (landing page, app at `/app/`, server as a Vercel Function on Supabase) is
> described in `docs/20_hosting.md`; see `docs/07_security_and_compliance.md` before pointing
> it at anything real.

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

Environment the server reads:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | enables the Claude adapter (`--model claude`) |
| `HENOSIS_OFFLINE=1` | blocks the Claude adapter; tests and e2e set it |
| `HENOSIS_TOKEN` | dev mode: the shared token every `join` must carry (same as `--token`) |
| `HENOSIS_OIDC_ISSUER` | switches identity to single sign-on: the provider's issuer URL (Team edition) |
| `HENOSIS_OIDC_CLIENT_ID` | the public client the web app signs in as; required with the issuer |
| `HENOSIS_OIDC_AUDIENCE` | what ID tokens' `aud` must carry when it is not the client id (optional) |
| `HENOSIS_AUTH=supabase` | sign-in through Supabase Auth, with `SUPABASE_URL` and `SUPABASE_ANON_KEY` (optional `SUPABASE_JWT_SECRET`); `HENOSIS_AUTO_JOIN` (`org:team:project:role`) places a new sign-up (`docs/20_hosting.md`) |
| `HENOSIS_DATABASE_URL` | the postgres store's connection string (`--store postgres`, or `HENOSIS_STORE=postgres` in the hosted function) |
| `HENOSIS_APP_URL` | where the web app is served, for links in Slack messages |

In oidc mode the server verifies every ID token against the provider and maps the token's
groups to teams and projects through `sso` in `orgs.json`; `docs/07_security_and_compliance.md`,
"Identity", has the shape.

## Commands

| Command | Purpose |
|---|---|
| `henosis serve [--port] [--dir] [--model scripted\|claude] [--token] [--store file\|postgres]` | host sessions over websockets; `--store postgres` keeps the logs in the database `HENOSIS_DATABASE_URL` names |
| `henosis migrate --from <dir>\|postgres --to <dir>\|postgres` | copy every log and document between a store folder and Postgres, verifying the head hash of each |
| `henosis demo [--dir]` | the offline multiplayer scenario; writes log, brief, report, narrative |
| `henosis join <session> --as <name> [--url] [--token] [--branch]` | terminal participant |
| `henosis replay <log.json> [--branch]` | fold a log and print the brief |
| `henosis verify <log.json>` | hash chain and replay determinism for every branch |
| `henosis report <log.json> [--chat <chat.json>]` | markdown report of every branch; a chat log reports its groups and councils, and `--chat` gives a session report its Council section |
| `henosis council <org> [<id>] [--dir]` | a council's rounds, plan with dissent, work and conclusion from the org's chat log; no id lists them |
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
                    mentions, agent replies, read markers; the council's events, reducer and protocol
packages/server     websocket and HTTP server, project, session and chat hosts, notifications, persistence
packages/slack      Slack adapter on an interface with an in-memory fake; Bolt socket mode;
                    the council as a thread with rating buttons
packages/cli        the henosis binary
apps/web            the product: React client that folds the same events as the server (PWA);
                    agents rail, team panel, groups and chats, command palette (⌘K), inbox,
                    approvals queue, memory browser, replay scrubber, branch compare, settings,
                    share, export, offline queue and reconnect-resume
apps/desktop        Tauri 2 shell around the web client: tray, native notifications, deep
                    links (henosis://), auto-update (docs/16_desktop_release.md)
apps/mobile         Capacitor shell around the web client with native push
design/             brand tokens, logo, static mockups of every surface
site/               the public landing page: one self-contained index.html, served static
scripts/            e2e.sh and the scripted websocket clients it drives
docs/               thesis, market, landscape, product spec, architecture, kernel design,
                    roadmap, security, business model, threat model, sources, open questions,
                    brand, fleet, memory, copy, desktop release, performance, editions,
                    council; docs/research/
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
