# Fleet collaboration: many engineers, many agents, one project

*Design note for the fleet layer in `packages/fleet`, built 2 October 2026. Prior art from the
research memo summarised at the end; sources in `10_sources.md`.*

## The problem

One session is one agent with many humans around it. A team does not run one agent. Each
engineer starts their own sessions, often on the same repository, the same services and the
same tickets, and today those sessions know nothing of each other. Every shipped product
answers this with isolation (a worktree, a VM, a fork per task) and a merge at the end. That
hides collisions until they are expensive, gives a lead no lever over the fleet while it
runs, and gives a manager usage counters instead of a picture of what is contended.

## The model

A **project** is a hash-chained ledger shared by every session started inside it, with the
same replay and audit properties as a session log. Four things live on it:

1. **Status reports.** Every session reports at turn boundaries: status, goal, turn, summary,
   the paths it touched, pending approvals. The fleet brief and the other agents' context
   come from these; nothing is polled.
2. **Claims.** A session holds exclusive or shared leases on *resources*: path prefixes,
   services, tickets. Paths overlap by containment; services and tickets by name. The
   verdict on a claim is deterministic (first active holder wins) and is itself an event,
   so every replica agrees. By default a session auto-claims a path on its first write, so
   engineers get protection without ceremony; explicit claims come from the `fleet.claim`
   tool or a human on the fleet board. Claims expire by holder inactivity (turns, not wall
   clock, so replay stays pure) and are released when a session closes.
3. **Project directives.** A lead's steer or constraint enters every targeted session as a
   project-origin directive with a rank above owner. The session's existing arbitration
   does the rest: a lead's steer shadows the owner's in the same scope (visibly), project
   constraints stack with session constraints, forks inherit them, withdrawals restore the
   owner's intent. Nothing new was added to the arbitration rules; the lattice gained a level.
4. **Fleet contentions.** Three kinds: a denied claim (both sessions' owners and the lead
   see it; the lead resolves and the loser's overlapping claims are released), two sessions
   writing the same unclaimed path, and a merge that leaves conflicts on a path another
   session holds. Contentions are mirrored into each session involved so the agent's
   context says so and the session view shows it.

The guard is the enforcement point: a write to a path another session holds fails as a tool
result the model can read ("held by Ana's session; claim it or work elsewhere"), the session
records a blocked write, and the ledger records a violation. The runner does not stop; the
agent routes around, exactly as it does with a denied approval.

Identity is a `users.json` with org, team and project memberships. Session roles derive from
them: the session's starter and any lead or admin are owners, members are contributors,
everyone else observes. This replaces first-in-owns the moment identity is configured.

### Crews and team chat

Claims keep agents apart; crews bring them together on purpose. A crew is a name for one
task several sessions work on ("Invoice rollout"). The owner of a session or a lead puts it
in a crew with a `session.crewed` ledger event, and takes it out with `crew: null`. Nothing
about authority changes: a crewmate's owner still cannot steer your session. What changes is
what each agent is told. The fleet context an agent reads at every turn gains a "YOUR CREW"
section listing its crewmates' goals, status and last summary before the usual "OTHER AGENTS"
section, so a crewed agent plans around its mates rather than merely avoiding them. The
fleet brief tags crewed sessions, the agents rail and the project page group them under the
crew name, and the Team panel of a session shows its crewmates as cards.

People talk to each other beside the agent, not through it. A note in a session
(`note.posted`) or on a project (`project.note.posted`) is a short message between humans,
kept in the log with its author and sequence so it replays and appears in the brief, and
never rendered into the model's request. The composer keeps the two apart with an Agent /
Team toggle; a team message is drawn as "Bo · to the team" in the stream. The sessions
listing (`GET /api/projects/:id/sessions`) carries, per session, the people present with
their role, whether they are online and who is driving, which is what the rail turns into
Solo or Team and "with Bo, Dee".

## What is new relative to prior art

Lease tools for coding agents exist (`dibs`, agent-fridge, agentroom and siblings): TTL globs,
hook enforcement, denial payloads. They are single-machine or single-orchestrator, their
principal is the requesting agent, and a denial goes only to that agent. Cursor Projects,
Devin's managed Devins, Warp Oz, the Codex app and Replit Agent 4 coordinate by isolation and
a manager merge. CodeCRDT shows structural conflict is cheap and semantic conflict is the
residual cost. Loop-Back Authority studies hierarchy inside one team of agents. Linear's
"human owns, agent contributes" is the cleanest ownership model shipped.

The fleet layer combines, for the first time as far as we found: claims whose principal is a
human engineer and whose holder is a session, with denials routed to both owners and the
lead; a directive hierarchy (project over session) as first-class events with precedence;
services and tickets in the same lease model as paths; and a management brief materialised
from the claim and contention log rather than from usage counters.

## What is deliberately simple in phase 1

Semantic overlap (same symbol, same test) is detected only through path overlap; a
semantic layer is planned. Claim TTLs are in turns. Partial admission of a claim (grant the
non-overlapping subset) is not implemented. Slack is write-mostly and coalesces per thread
because `chat.postMessage` is limited to about one message per second per channel.

## Tests

`packages/fleet/test`: overlap matrix; conflict ids independent of order; first-wins and the
lead's resolution releasing the loser; TTL expiry and close; lead steer outranking owner and
restoration on withdrawal; constraints reaching forks; detection of unclaimed overlap and
merge conflicts on held paths; the brief; identity derivation; deterministic fold.
`packages/server/test/project.test.ts`: two engineers' sessions collide on one path, the
second is refused and the ledger records it, a lead constraint reaches both, the project
reloads from disk, and roles derive from `users.json` over the websocket.

## Slack

`packages/slack` maps channels to the hierarchy: a channel per team, a channel per project,
and a management channel. Every session is a thread in its project channel, opened when the
session registers ("Ana's agent started 'Invoice PDF'. Reply in this thread to steer it").
Turn summaries, directives and handoffs are coalesced into one reply per thread every 1.5 s so
a fleet stays under Slack's per-channel posting limit. Approvals are Block Kit buttons in the
thread; irreversible ones are broadcast to the channel; a click votes as the mapped Fold
user with the role identity gives them, and the message is updated with the outcome. Fleet
contentions and team-memory conflicts go to the management channel with "X wins" and "X is
right" buttons that resolve on click, and to the owners' threads. Replies in a thread become
directives (`[scope] text`, `/constrain`, `/pause`, `/resume`, `/cancel`). Slash commands:
`/fold brief <project>`, `/fold sessions <project>`, `/fold memory <org>`. The adapter
runs against an interface with an in-memory fake, so the whole flow is tested offline
(`packages/slack/test/adapter.test.ts`); `fold slack --config slack.json` runs it on Bolt in
socket mode, which needs no public URL.
