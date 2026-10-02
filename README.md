# Atelier

**The multiplayer kernel for long-running agent sessions.**

Agents now run for hours, days and weeks. Work at that scale pulls in many people, but every
agent product today gives the run to one person: everyone else gets a read-only link, or a
Slack thread the model has to make sense of. Atelier makes the session itself the shared
object. Anyone on the team drops in, watches, steers, approves, forks, merges and hands off,
and the kernel decides what happens when two people steer at once.

This repository is the phase-0 vertical slice: a deterministic session kernel, an agent
runner that survives crashes, a websocket server, a web client, a CLI, tests, and an
offline demo that exercises every primitive without a model API. Docs are in
[`docs/`](docs/), starting with the [one-pager](docs/00_thesis_one_pager.md) and the
[kernel design](docs/05_kernel_design.md).

> Phase 0. Dev-server authentication only, scripted model by default, nothing here is
> hosted. See `docs/07_security_and_compliance.md` before pointing it at anything real.

## What is new here

- **Session as a hash-chained, branchable log.** Model and tool outputs are recorded, so any
  session replays deterministically and resumes from a snapshot. `atelier verify` proves it.
- **Intent arbitration.** Concurrent directives from many humans compose into one intent by
  explicit rules (authority, recency, scope). Peers who disagree in the same epoch produce a
  *contention* the agent works around until a driver resolves it. Composition is independent
  of arrival order; a 300-trial property test says so.
- **Authority and approvals.** Observer < contributor < driver < owner, with the driver seat
  as a transferable token. Tool calls carry a risk class; irreversible ones need a quorum of
  distinct humans, and approvals are bound to the hash of the exact call.
- **Fork and merge.** Branch at a checkpoint; merge with a three-way workspace merge and
  directive carry-over that turns conflicting steers into contentions instead of overrides.
- **Handoff with a computed brief.** The incoming driver gets situation, open items, what
  the agent did, and what changed since they were last present, generated from the log.
- **Crash-resumable runner.** A new runner finishes the tool calls a dead one left behind.

## Quickstart (five minutes, no network)

```bash
pnpm install
pnpm build
pnpm demo                                   # offline: four humans, one agent, every primitive
cat store-demo/sessions/demo/narrative.md   # what happened and why
cat store-demo/sessions/demo/brief.md       # the handoff brief Bo received
node packages/cli/dist/main.js verify store-demo/sessions/demo/log.json
```

Live, in two terminals plus a browser:

```bash
pnpm serve                                   # ws://127.0.0.1:7700/ws, scripted model
node packages/cli/dist/main.js join demo --as Ana      # first in: owner and driver
node packages/cli/dist/main.js join demo --as Bo       # contributor
pnpm --filter @atelier/web dev                # http://localhost:5173, join as a third person
```

In Ana's terminal type `Build a doubling helper and deploy it`; in Bo's type
`/constrain no external dependencies`. Watch the approval prompts, `/approve <id>`, then
`/handoff bo` and `/accept <id>` on the other side, and `/brief`.

With `ANTHROPIC_API_KEY` set, `pnpm serve -- --model claude` runs a real model through the
same kernel. `ATELIER_OFFLINE=1` blocks it.

## Commands

| Command | Purpose |
|---|---|
| `atelier serve [--port] [--dir] [--model scripted\|claude] [--token]` | host sessions over websockets |
| `atelier demo [--dir]` | the offline multiplayer scenario; writes log, brief, report, narrative |
| `atelier join <session> --as <name> [--url] [--token] [--branch]` | terminal participant |
| `atelier replay <log.json> [--branch]` | fold a log and print the brief |
| `atelier verify <log.json>` | hash chain and replay determinism for every branch |
| `atelier report <log.json>` | markdown report of every branch |

## Repository map

```
packages/protocol   zod schemas: actors, roles, directives, tool calls, events, wire messages
packages/kernel     pure core: hash, log, arbitration, approvals, reducer, merge, brief, replay, Session
packages/runner     agent loop, tool registry, scripted model, Claude adapter
packages/server     websocket server, session host, disk persistence
packages/cli        the atelier binary
apps/web            React client that folds the same events as the server
scripts/            e2e.sh and the scripted websocket clients it drives
docs/               thesis, market, landscape, product spec, architecture, kernel design,
                    roadmap, security, business model, threat model, sources, open questions
```

## Development

```bash
pnpm check     # lint (biome), typecheck, unit and integration tests (vitest), build, e2e
pnpm test      # 39 tests: kernel semantics, runner behaviour, websocket server
```

Tests and e2e run offline. CI runs the same pipeline on every push.

## Status and licence

Phase 0 complete; see `docs/06_roadmap.md`. Licence not yet chosen; all rights reserved until
the founder decides.
