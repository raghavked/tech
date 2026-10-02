# Model context rendering: intent, fleet context and team memory in the request

Topic: model-context-rendering. Date: 2026-10-02. Status: research memo, Phase 0.

## Why it matters for Fold

Fold's model request is assembled in `packages/runner/src/runner.ts` (`buildRequest`) and serialised in `packages/runner/src/claude.ts`. Today the shape is: a five-line static `SYSTEM` block with one cache breakpoint; then a single opening user message that concatenates the title, `renderIntent(intent)`, the fleet guard context, the 24 kB team-memory context, new directives, the last ten turn summaries and the workspace listing; then the in-turn transcript. Three things are wrong with this for a session that runs for days with many humans steering it.

1. Cost and latency. Everything that changes per epoch (new directives, memory, fleet claims, file list) sits in the first user message, in front of the transcript. Any change invalidates the cache for the whole transcript. Manus reports a 100:1 input-to-output ratio for agents and a 10x price gap between cached and uncached tokens; the Claude API prices cache reads at 0.1x (0.025x on Fable 5.1) and writes at 1.25x, with the prefix hashed in the order tools, system, messages. Fold's current ordering gives almost no hits once a session is steered.
2. Obedience. The kernel refuses to pick between contending humans and renders `UNDER DISCUSSION (do not act on these scopes until resolved)`. That line is Fold's whole safety story for contentions, and it currently lands in the middle of a growing user message, exactly where positional-bias research says instructions are missed.
3. Determinism. Replay and `fold verify` depend on recorded model outputs; a renderer that changes bytes without changing meaning (object key order, timestamps) breaks caching and makes evaluation noisy.

## Prior art

1. Claude API prompt caching reference, platform.claude.com/docs/en/build-with-claude/prompt-caching (accessed 2026-10-02). Cache order is tools, then system, then messages; at most four breakpoints; 20-block lookback; 512-token minimum on current models; 5 minute or 1 hour TTL; cache writes happen only at the breakpoint, so a breakpoint on a block that changes every request never reads. Changing tool definitions is a complete miss. Guidance for multi-turn: breakpoint on system, on tools, and on history up to the previous turn, never on the latest user message.
2. Anthropic, "Effective context engineering for AI agents", anthropic.com/engineering/effective-context-engineering-for-ai-agents (accessed 2026-10-02). Right "altitude" for system prompts; sectioned prompts with headers or XML tags; the "minimal set of information that fully outlines expected behaviour"; compaction that keeps decisions and open issues and clears tool results; just-in-time retrieval by lightweight identifiers rather than preloading; structured notes outside the window.
3. Manus, "Context Engineering for AI Agents: Lessons from Building Manus", manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus (accessed 2026-10-02 via search snippets; domain blocked, UNVERIFIED for exact wording). KV-cache hit rate as the single most important production metric; stable prefix (no timestamps at the top); append-only context; deterministic serialisation; mask tools instead of removing them; "recitation" of a todo file at the end of context to steer attention; keep errors in context.
4. IHEval, "Evaluating Language Models on Following the Instruction Hierarchy", arxiv.org/abs/2502.08745, NAACL 2025 (accessed 2026-10-02 via snippets; arXiv blocked). 3,538 examples, nine tasks; models cope when system and user instructions align and drop sharply when they conflict, tending to follow the lower-priority, more recent instruction.
5. SysBench, "Can LLMs Follow System Messages?", arxiv.org/abs/2408.10943, ICLR 2025 (accessed 2026-10-02 via snippets). Names three failure modes that map directly onto Fold: constraint violation, instruction misjudgement, and multi-turn instability, where adherence to the system message decays as the dialogue grows.
6. "Lost in the Middle" line of work and 2025 follow-ups (ACL Findings 2025, aclanthology.org/2025.findings-acl.316; accessed 2026-10-02). U-shaped positional bias survives instruction tuning; attention weights are its micro-level signature.
7. "The Compliance Gap: Why AI Systems Promise to Follow Process Instructions but Don't", arxiv.org/abs/2605.01771 (accessed 2026-10-02 via snippets, UNVERIFIED). Under default framing six models comply 0% with process instructions they verbally accept; removing the tool that affords the shortcut raises compliance to 75%; the gap is undetectable from text alone, so it must be measured from behaviour.

## What to borrow

- Treat the request as a cache-ordered pipeline: static system and tools first, slowly changing session context next, transcript, then the volatile tail. Measure `cache_read_input_tokens` per call as a first-class metric.
- Deterministic, append-only rendering. Every renderer (`renderIntent`, `renderFleetContext`, `contextFor`) already sorts keys; keep that property and test it.
- Put the thing that must be obeyed in two places: once in the stable prefix (for priority) and once as a short recitation at the very end of the request (for recency). Manus does this with todo.md; Fold's equivalent is the contended-scope list and standing constraints.
- Do not rely on text for refusals the kernel can enforce. The Compliance Gap result says affordance beats phrasing: the fleet guard already turns a write to a held path into a refused tool result, which is the right pattern. Extend it to contended scopes.
- Byte budgets with a stable fill order (conflicts first, narrowest scope first) are the right primitive; team memory already does this at 24 kB.

## What is unsolved

- No public benchmark measures what Fold needs: a model that honours a scope restriction added mid-session by a second human while continuing work elsewhere. IHEval and SysBench test system-versus-user conflicts, not peer-versus-peer contentions expressed through a rendered intent.
- Mid-conversation system messages are not a stable API surface: Claude Code moved harness reminders out of the mid-conversation system role in 2026 (UNVERIFIED, from release notes in search results), and the Claude Messages API has one system field. The practical channel is a tagged user block, which lowers its priority.
- Prompt caching and intent updates are in tension: the more faithfully the prefix tracks the intent, the more often it misses. The 20-block lookback gives some slack, but the cutover point needs measurement.
- Compaction of a shared session is political, not just technical: whose directive survives summarisation is an arbitration question, which is why the kernel brief is computed, not generated.

## Concrete recommendations for Fold

1. Split the request into four layers with explicit breakpoints (`packages/runner/src/claude.ts`): (a) `SYSTEM` plus the role contract, breakpoint, 1 h TTL; (b) tools, sorted by name, breakpoint; (c) a "session context" user block holding `renderIntent`, fleet context and memory, tagged `<session_context epoch=N>`, breakpoint; (d) transcript with a breakpoint on the previous turn's last block. Never put a timestamp in (a) to (c). Expect a cache miss when the intent changes, which is rare relative to tool round-trips.
2. Make the intent an epoch-stamped, append-only sequence (`packages/runner/src/runner.ts`, `buildRequest`): keep the rendered intent of epoch N in the transcript as a user block and append a short `<intent_delta>` block on change, instead of rewriting the opening message. Preserves the cache for the prefix and gives the model the history of who changed what.
3. Add a recitation tail (`packages/runner/src/claude.ts`): after the last tool result, append a block of at most 300 bytes: `Contended scopes (do not act): ...` and `Constraints: ...`, regenerated each call. This is the last thing before generation, where recency bias helps rather than hurts.
4. Rephrase `renderIntent` for obedience (`packages/kernel/src/intent.ts`): name the scope, the humans, and the allowed alternative, in the imperative, for example `billing/ is under discussion between Ana and Bo. Do not read, write or plan work under billing/. Continue on other scopes or ask.` Scope-plus-alternative phrasing is what the fleet guard already uses and what the compliance literature suggests works better than bare prohibitions.
5. Enforce contended scopes as tool refusals (`packages/runner/src/tools.ts`, `WorkspaceGuard`): a write or exec whose path falls in a contended scope returns `is_error: true` with the same wording as the intent, journaled as an event. Text instructs, the guard enforces, and both are visible in the log.
6. Budget and journal every rendered block (`packages/runner/src/model.ts`, new `ContextRender` event in `packages/protocol`): byte caps per block (intent 4 kB, fleet 4 kB, memory 24 kB, history 2 kB), the fill order, bytes dropped, and the `usage` cache counters from the response. Replay already records model output; recording the rendered input makes cache hit rate and budget overruns queryable with `fold report`.
7. Build an obedience eval (`packages/runner/test/obedience.test.ts`): scripted scenarios where a second human contends a scope mid-turn, asserting from the log, not the text, that no tool call touches the scope before resolution, and that work continues elsewhere. Run it against the scripted model in CI and against Claude nightly, reporting cache hit rate and violation rate per scenario.

## Sources

- https://platform.claude.com/docs/en/build-with-claude/prompt-caching (accessed 2026-10-02)
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents (accessed 2026-10-02)
- https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus (accessed 2026-10-02, snippets only)
- https://arxiv.org/abs/2502.08745 IHEval (accessed 2026-10-02, snippets only)
- https://arxiv.org/abs/2408.10943 SysBench (accessed 2026-10-02, snippets only)
- https://aclanthology.org/2025.findings-acl.316 position bias in long-context models (accessed 2026-10-02, snippets only)
- https://arxiv.org/abs/2605.01771 The Compliance Gap (accessed 2026-10-02, snippets only)
