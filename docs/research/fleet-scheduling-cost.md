# Fleet scheduling and cost control for Fold

*Research memo, 2 October 2026. Topic: scheduling and cost control for fleets of coding agents on one repo. Vendor documentation for Cursor, Devin, Warp and LiteLLM was egress-blocked; claims from those sources rest on search snippets and are marked UNVERIFIED.*

## Why it matters for Fold

Fold's fleet layer (`docs/13_fleet_collaboration.md`) already answers *who may touch what*: claims, lead directives, contentions. It does not yet answer *who may run, how much, and when*. A project with twelve engineers each holding two long-running sessions is twenty-four model loops drawing on one org API budget, one CI fleet and one merge queue. Every shipped product meters this with a counter and a cutoff. Fold's thesis is that the session is a shared, replayable object; the budget and the scheduler should be the same kind of object: events on the project ledger, attributed to an engineer, visible in the fleet brief, and enforced at the same guard that refuses a held path. A kill switch that is a project directive, and a budget exhaustion that the agent reads as a tool result, are the natural extension of what is already built.

## Prior art

1. **Claude Code cost management** (code.claude.com/docs/en/costs, accessed 2026-10-02, fetched). Average enterprise cost is "around $13 per developer per active day and $150-250 per developer per month". Caps exist at organisation, group and member level; the Console offers workspace spend limits and workspace rate limits "to cap Claude Code's share and protect other production workloads". A per-session `--max-budget-usd` flag exists, and a managed `modelPricing` table lets reported figures match contracted rates. Agent teams "use approximately 7x more tokens than standard sessions" and the guidance is "shut down teammates when their work is done". Per-user attribution is via the Analytics API, OpenTelemetry or a gateway.
2. **Devin organisation ACU limits** (docs.devin.ai/admin/billing/org-acu-limits, accessed 2026-10-02, UNVERIFIED, snippet only). Enterprise admins set ACU limits per organisation "per product category" and per user via tiers with permanent or temporary overrides. "New work is blocked ... until the limit is adjusted or usage resets in the next monthly window." Org and user limits are independent; "a request is blocked if either has been reached".
3. **Warp Oz hosting** (docs.warp.dev/platform/warp-hosting, accessed 2026-10-02, UNVERIFIED, snippet only). "Concurrency of Warp-hosted agents is limited on a per-team basis. If an agent is started while at your concurrency limit, it is automatically queued and will start as soon as another agent completes." Plan tiers include 20 (Build, Max) or 80 (Business) cloud agents.
4. **Cursor parallel agents and Projects** (futurumgroup.com/insights/cursor-3-2-reframes-the-ide-as-an-agent-execution-runtime, businesstechnavigator.com, accessed 2026-10-02, UNVERIFIED). Up to eight agents in parallel on git worktrees since February 2026; 3.2 added `/multitask` subagents and worktrees in the Agents window. Cost control is a credit pool plus "Auto mode selects the most cost-efficient model". No scheduler is described beyond the coordinator agent; "running five subagents in parallel uses roughly five times the tokens".
5. **LiteLLM budgets and rate limits** (docs.litellm.ai/docs/proxy/users, accessed 2026-10-02, UNVERIFIED, snippet only). Budgets at proxy, org, team, team-member, user and key level with reset durations; "after the key crosses its max_budget, requests fail"; budget and rate-limit tiers assignable to keys.
6. **Worktrees for parallel agents** (augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution, accessed 2026-10-02, UNVERIFIED). "One task, one branch, one worktree, one agent"; worktrees share one object store, so commits are visible across them without pushing, and `.git/index.lock` contention disappears. "Conflicts move to merge time."
7. **The merge queue is the new bottleneck** (tianpan.co/blog/2026/07/02/the-merge-queue-is-the-new-bottleneck; tenki.cloud/blog/hidden-ci-tax-ai-coding-agents, accessed 2026-10-02, UNVERIFIED). High-AI-adoption teams "merge nearly twice as many pull requests" with flat delivery metrics because "the constraint moved downstream" to CI and the serialised path to main; one report of Actions bills up 280% six months after Copilot adoption.

## What to borrow

- **Two independent ceilings** (Devin): a project ceiling and a per-engineer ceiling, either of which blocks. Fold should add a third, the session, matching `--max-budget-usd`.
- **Queue, do not refuse** (Warp): when a project is at its concurrency cap, a new session or turn waits and the wait is visible. Agents tolerate latency; they do not tolerate opaque failure.
- **Contracted-rate reporting** (Claude Code `modelPricing`): the number the lead sees must be the number finance pays.
- **Soft thresholds before hard stops** (LiteLLM alerting, Claude Code "progress against spend limits"): a 75 % and 90 % warning that the model itself reads changes behaviour before the cutoff.
- **Worktree per session as the physical layer** under claims as the semantic layer. Claims stop overlap; worktrees stop lock contention and stale views.
- **CI as a scarce resource** (merge-queue literature): treat CI slots like paths, claimable and contended.

## What is unsolved

- **Fairness across engineers** when budgets are shared. Every vendor caps; none schedules. A lead with a Friday deadline and an intern exploring both draw from one pool and nobody shipped a priority order that is explainable after the fact.
- **Cost attribution across forks and handoffs.** When Bo forks Ana's session and Cy accepts the handoff, who paid? Vendors attribute to the key; Fold can attribute to the directive that caused the spend, but no prior art defines this.
- **Replay-pure scheduling.** Wall-clock queues break determinism. Fold's claim TTLs are in turns for this reason; admission must be too.
- **Semantic CI contention**: two sessions re-running the same test suite on near-identical trees waste the same minutes; dedup by tree hash is not shipped anywhere we found.
- **Kill-switch semantics for long-running agents**: pause versus freeze versus revoke, and what the agent is told. Vendors stop the process; none hands the agent a reason it can act on.

## Concrete recommendations for Fold

1. **Budgets as ledger events.** In `packages/fleet/src/events.ts` extend `ProjectPolicy` with `budget: { window: "month"|"week", projectMicros, perEngineerMicros, perSessionMicros, softPct: [75, 90], pricing: Record<modelId, rates> }` and add event bodies `budget.set`, `budget.threshold`, `budget.exhausted`, `budget.raised`. A raise is a lead or admin action and goes through the approval path in `packages/kernel/src/approvals.ts` as a reversible, single-approver call, so it is bound to a hash and attributed.
2. **Usage on the status report.** Add `usage: { input, output, cacheRead, cacheWrite, modelId, costMicros }` to `SessionStatusReport`. `packages/runner/src/claude.ts` reads the API `usage` block per call; `packages/runner/src/runner.ts` sums it per turn and reports at the existing turn boundary. The fold in `packages/fleet/src/state.ts` keeps running totals per session, engineer and project; cost uses the project's contracted rates, mirroring `modelPricing`.
3. **Deterministic admission in `packages/fleet/src/schedule.ts` (new).** `ProjectPolicy.maxActiveSessions` and `maxTurnsPerEpoch` cap the project. A session that wants a model turn appends `turn.requested`; the fold grants `turn.admitted` in ledger order using deficit round-robin keyed by engineer, with a priority boost when the session is targeted by an active lead `steer` and a penalty when it is over its soft threshold. Queued sessions see "waiting: 2 ahead, Ana's session finishing" in their status, and the agent reads it as a tool result. No wall clock, so `fold verify` still replays.
4. **Worktree per session and CI as a claim.** `packages/kernel/src/workspace.ts` gains a `worktree` backend: `git worktree add` on a shared object store, one per session, removed on close. Add `{ type: "ci", name }` to `Resource` in `events.ts` with a project-level slot count; `fleet.claim` on `ci` is how a session runs the suite, and `packages/fleet/src/claims.ts` dedups by tree hash: a second request for an identical tree attaches to the in-flight run rather than consuming a slot.
5. **Three kill switches, one mechanism.** Add directive kinds `pause` (session owner), `freeze` (project lead, rank above owner, propagated through `packages/fleet/src/propagate.ts`) and `halt` (org admin, served from `packages/server/src/projectHost.ts` and `orgs.ts`). All three stop model calls and non-read-only tools at the guard, record a `blocked` tool result with the reason, and leave the session resumable. `budget.exhausted` emits a `freeze` with reason `budget`. CLI: `fold freeze <project>`, `fold halt --org`.
6. **Brief and surface.** `packages/fleet/src/brief.ts` adds three lines per project: spend against budget by engineer and session, queue depth and who is waiting, CI slots in use. In the web client the only chrome is a quiet notice in the conversation column ("Project at 90 % of October budget" or "Frozen by Ana, lead: hotfix in progress") styled like the existing contention notice, and a one-line budget figure in the sidebar project row; no dashboard.

## Sources

- https://code.claude.com/docs/en/costs (fetched 2026-10-02)
- https://docs.devin.ai/admin/billing/org-acu-limits (2026-10-02, UNVERIFIED)
- https://docs.warp.dev/platform/warp-hosting (2026-10-02, UNVERIFIED)
- https://futurumgroup.com/insights/cursor-3-2-reframes-the-ide-as-an-agent-execution-runtime/ (2026-10-02, UNVERIFIED)
- https://businesstechnavigator.com/blog/cursor-cloud-agents-multitask-parallel-worktrees-8-agents-2026 (2026-10-02, UNVERIFIED)
- https://docs.litellm.ai/docs/proxy/users (2026-10-02, UNVERIFIED)
- https://augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution (2026-10-02, UNVERIFIED)
- https://tianpan.co/blog/2026/07/02/the-merge-queue-is-the-new-bottleneck (2026-10-02, UNVERIFIED)
- https://tenki.cloud/blog/hidden-ci-tax-ai-coding-agents (2026-10-02, UNVERIFIED)
