# Multi-agent coordination in production: what ships, what contends, what Henosis adds

Research memo, 2026-10-19. Slug: `multi-agent-coordination`. Verification note: the egress proxy served anthropic.com, code.claude.com and github.com but refused cognition.ai, cognition.com, docs.crewai.com, docs.langchain.com, docs.devin.ai, openai.github.io and arxiv.org. Claims from those sites come from search snippets and are marked UNVERIFIED where a quote or figure could not be read on the page.

## The question

For each system we ask who coordinates, how agents share or split context, and what happens when two want the same thing. The last is where production systems are thinnest and where Henosis's project ledger sits.

## What is established

**AutoGen** (Microsoft Research; paper posted August 2023, revised October 2023; best paper at ICLR 2024). The unit is the conversable agent, combining a model, tool execution and optional human input; a developer programs the conversation pattern between agents. Coordination is the conversation itself; there is no resource model.

**CrewAI** (README read 2026-10-19). Crews are "teams of AI agents with true autonomy and agency" collaborating through roles, `sequential` by default or `hierarchical`, "which automatically assigns a manager to the defined crew" for "delegation and validation of results". Flows are "production-ready, event-driven workflows" with "secure, consistent state management between tasks". Nothing in the README addresses concurrency between agents or contention on shared resources.

**LangGraph** (README read 2026-10-19; Command launch post via snippet). A "low-level orchestration framework for building stateful agents" built on durable execution ("persist through failures"), human-in-the-loop ("inspecting and modifying agent state at any point") and checkpoints. Multi-agent is a pattern on top: a node returns a `Command` that "combine[s] both control flow and state updates", including a jump into the parent graph for hierarchical handoffs. Supervisor, network and hierarchical shapes are all this. Contention is whatever the state schema allows.

**OpenAI Swarm and the Agents SDK** (README read 2026-10-19). Swarm is "experimental, educational", "stateless between calls", and has one coordination idea: "If a function returns an Agent, execution will be transferred to that Agent." It "is now replaced by the OpenAI Agents SDK", which keeps the handoff, adds input filters, and by default collapses prior history into one assistant message before the next agent runs (reference via snippets, UNVERIFIED). One agent is active at a time; parallelism is the caller's problem.

**Anthropic's research system** (engineering post, 13 June 2025, read 2026-10-19). An "orchestrator-worker pattern": a lead plans, spawns subagents that search in parallel in their own context windows, then synthesises. The post reports a lead with smaller subagents "outperformed single-agent ... by 90.2% on our internal research eval", that "multi-agent systems use about 15× more tokens than chats", that "most coding tasks involve fewer truly parallelizable tasks than research", and that agents "are not yet great at coordinating and delegating to other agents in real time". Subagents run in synchronous sets; asynchronous execution is named as future work.

**Claude Code's parallel surfaces** (docs read 2026-10-19). Five shapes: subagents (own context, return a summary), agent view, agent teams ("experimental and disabled by default"), dynamic workflows and cloud projects. Agent teams are the nearest thing to a fleet: a lead, teammates in their own context windows, a mailbox per agent as a JSON file, and a shared task list with dependencies where "task claiming uses file locking to prevent race conditions". File contention is handled by instruction: "Agent teams don't isolate teammates in worktrees, so partition the work so each teammate owns a different set of files"; "two teammates editing the same file leads to overwrites". Limits: one team per session, no nested teams, a fixed lead.

**Devin and Cognition** (snippets, 2026-10-19). "Don't Build Multi-Agents" (2025, date UNVERIFIED) argued that partitioned context yields misinterpreted subtasks and that parallel actions carry implicit decisions that conflict; its principles were to share full traces, not summaries, and to treat concurrent writers as the hazard. "Multi-Agents: What's Actually Working" (22 April 2026) keeps that verdict for parallel-writer swarms and describes narrow patterns where several agents contribute while writes stay single-threaded, including a reviewer that starts from a clean view of the diff. "Devin can now Manage Devins" (19 March 2026) adds a parent that scopes work, launches children each in its own isolated VM with compute limits, messages them, and "resolves conflicts, and compiles results". Conflict resolution is the parent's judgement at merge time, not a protocol.

**Where the field agrees, October 2026.** Parallelism pays for reading and is suspect for writing; Anthropic and Cognition say so independently. Isolation plus a merge is the universal answer to write conflict; no one leases paths between agents except as a task-list lock. No system makes an individual engineer the principal of one agent's claims.

## What is our inference

- The agent-teams lock is a lease on work items, not resources. It stops two agents claiming one task and says nothing about two tasks touching one file; partitioning is left to the prompt, presumably because worktrees would break the team's shared working tree.
- Handoff frameworks encode "one agent active at a time", so contention never arises inside them and reappears the moment two runs share a repository, out of scope. Their durability is per run, not per shared resource.
- Devin's parent resolving conflicts after the fact is the honest position given Cognition's writing: merge-time conflict is the residual cost of parallel writers, so keep writers single-threaded.
- The 15× token figure and "coding parallelises badly" together say a fleet on one repository is a cost problem before a correctness problem. A system that knows what is contended can refuse early and spend nothing on a write that will be discarded.

## What Henosis's project ledger and crews add

Henosis puts contention into the record rather than into the merge. The project ledger (`docs/13_fleet_collaboration.md`) holds status reports, claims (exclusive or shared leases on path prefixes, services and tickets, granted deterministically to the first active holder), project directives ranked above the owner, and contentions mirrored into every session involved; the guard turns a held path into a model-readable denial. Crews are the cooperative half: a crew gives each member its mates' goals and summaries every turn, so an agent plans around them. The council (`docs/19_council.md`) sits above: individual answers, discussion, a chair's synthesis that is a real plan (`packages/kernel/src/plans.ts`) rated by people, then assignments into crewed sessions that report back. Relative to the field: the principal of a claim is a person, denials reach both owners and the lead, directives have precedence as events, and everything replays. No surveyed system has all four.

## What this changes for Henosis

- **Name the nearest analogue in the fleet doc.** `docs/13_fleet_collaboration.md`, "What is new relative to prior art": the closest shipped system locks tasks, not resources, and asks users to partition files by prompt; auto-claim on first write is the mechanism it lacks.
- **Single-writer default for council assignments.** `docs/19_council.md`, "Assignment": when two steps' owners would touch overlapping paths, the host serialises them or claims on assignment, and `council.assigned` carries the claims it took, so a council does not become the parallel-writer swarm both Anthropic and Cognition warn against.
- **Charge contention to the plan.** `packages/kernel/src/plans.ts` keeps `estTokens` and `actualTokens` per step; add a blocked-write count per step so the plan card and the council's usage meter separate tokens spent on work from tokens spent on refusals.
- **Edition split for coordination.** `docs/18_editions.md`: Starter keeps claims and crews on one process; Team adds lead resolution of contentions in the audit view; Enterprise adds the fencing generation and hybrid tick from `claims-leases-theory.md`, since only a sharded cluster has the stale-holder problem single-box frameworks avoid.
- **A review round from a clean diff.** Cognition's working case is a reviewer with no writer context. Add a `review` round to `docs/19_council.md` ("Round"): a member with a reviewer persona and read-only tools, convened when a crewed step reports `done`, shown in the council view as a card beside the report.

## Sources

- Anthropic, "How we built our multi-agent research system", 13 June 2025: https://www.anthropic.com/engineering/multi-agent-research-system
- Claude Code docs: https://code.claude.com/docs/en/agents ; https://code.claude.com/docs/en/agent-teams ; https://code.claude.com/docs/en/worktrees
- Cognition, "Don't Build Multi-Agents" (2025): https://cognition.ai/blog/dont-build-multi-agents (blocked; via https://jxnl.co/writing/2025/09/11/why-cognition-does-not-use-multi-agent-systems/)
- Cognition, "Multi-Agents: What's Actually Working", 22 April 2026: https://cognition.com/blog/multi-agents-working (blocked; snippets)
- Cognition, "Devin can now Manage Devins", 19 March 2026: https://cognition.ai/blog/devin-can-now-manage-devins (blocked; snippets); Devin docs https://docs.devin.ai/work-with-devin/advanced-capabilities (blocked)
- Microsoft Research, AutoGen publication page: https://www.microsoft.com/en-us/research/publication/autogen-enabling-next-gen-llm-applications-via-multi-agent-conversation-framework ; arXiv 2308.08155 (blocked)
- CrewAI README: https://github.com/crewAIInc/crewAI ; docs https://docs.crewai.com/en/concepts/crews (blocked)
- LangGraph README: https://github.com/langchain-ai/langgraph ; "Command" post https://blog.langchain.com/command-a-new-tool-for-multi-agent-architectures-in-langgraph (blocked); https://docs.langchain.com/oss/python/multi-agent (blocked); https://reference.langchain.com/python/langgraph-supervisor
- OpenAI Swarm README: https://github.com/openai/swarm ; Agents SDK handoffs https://openai.github.io/openai-agents-python/ref/handoffs/ (blocked)
- Henosis: `docs/13_fleet_collaboration.md`, `docs/19_council.md`, `docs/18_editions.md`, `packages/kernel/src/plans.ts`, `docs/research/claims-leases-theory.md`
