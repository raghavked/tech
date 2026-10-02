# Memory compaction quality: metrics, provenance, when to fold, and an offline eval for Fold summaries

*Research memo, 2 October 2026. Topic: memory-compaction-quality.*

## Why it matters for Fold

Fold's organisation memory (`packages/memory`) already does the structural part right: level-0 entries are attributed to an engineer, session and commit; `MemoryStore.compact()` in `packages/memory/src/store.ts` folds a scope's active level-n entries into one level-(n+1) summary whose `derivedFrom` cites every folded id, whose tags carry `by:<author>`, whose trust is the maximum of the inputs, and which skips anything in an open conflict. The curator (`packages/memory/src/curator.ts`) triggers a fold when a scope@level holds more than `compactAfter` (12) entries and flags an agent-written entry as stale when it has gone unread for `staleAfter` (500) ledger events.

What is missing is any notion of *quality*. The trigger is a count, not a judgement. The default `bulletSummarizer` truncates each entry to its first line and 200 characters, so a fold is lossy by construction. An LLM summariser is pluggable and journaled, but nothing checks that its output is faithful to the inputs, that every claim traces to an id, that a superseded value did not leak back in, or that a retraction was honoured. Staleness is "unread", which conflates "never injected because the 24 kB budget ran out" with "injected and never useful"; a scope with many entries will mark its tail stale and propose retractions in a spiral. And because level-1 summaries are themselves folded into level 2, each pass summarises a summary, so loss compounds. Attribution survives compaction today; accuracy is unmeasured.

## Prior art

1. **LSM compaction policies (RocksDB, leveled vs tiered).** Tiered compaction never rewrites data within a level (low write amplification, high read amplification: overlapping runs, outdated values); leveled compaction keeps one sorted run per level (write amplification roughly T·(L−1), one file to check per level on read). RocksDB uses tiered at L0 and leveled below. The lesson for memory: the policy follows the workload, and each rewrite is a chance to lose or corrupt. https://www.techinterview.org/post/3233469062/lld-lsm-compaction/ and https://www.eecg.utoronto.ca/~stumm/Papers/Dong-CIDR-16.pdf (snippets, 2026-10-02).
2. **Anthropic auto dream / `/dream` for Claude Code and Managed Agents.** Secondary reports describe a scheduled between-sessions process that reads the memory store plus recent transcripts and rewrites memory: merge duplicates, resolve contradictions in favour of the most recent information, correct past errors, prune stale entries; a four-phase cycle; announced 6 May 2026 (UNVERIFIED: vendor domain and reporting sites blocked; https://www.implicator.ai/anthropic-adds-auto-dream-to-claude-code-fixing-memory-decay-between-sessions, https://claudefa.st/blog/guide/mechanics/auto-dream, snippets 2026-10-02). The official memory page (https://code.claude.com/docs/en/memory, fetched 2026-10-02) does not mention dreaming; it documents a 200-line/25 KB load limit on `MEMORY.md`, a nudge to "merge or drop stale entries" when near the limit, and `/doctor prompt-audit`, which looks for "references to files or commands that don't exist" and contradictions, with "nothing in your files changes until you ask Claude to apply them". Staleness there is thus (a) recency wins on contradiction, (b) broken references, (c) human-gated deletion.
3. **Letta sleep-time compute and sleeptime agents.** Packer, Wooders et al., April 2025: a second agent uses idle time to reorganise memory blocks; up to 5× less test-time compute on GSM-Symbolic/AIME at equal accuracy; the gain depends on how predictable the next query is from existing context. Sleeptime agents "consolidate fragmented memories into coherent entries", deduplicate, and "archive and prune outdated information"; staleness is an LLM judgement with no published metric (UNVERIFIED beyond snippets; arxiv.org, docs.letta.com and forum.letta.com blocked). https://arxiv.org/abs/2504.13171, https://forum.letta.com/t/sleeptime-agents-for-memory-consolidation-best-practices-guide/154 (2026-10-02).
4. **LongMemEval (Wu et al., ICLR 2025).** 500 questions over long chat histories testing five abilities: information extraction, multi-session reasoning, temporal reasoning, knowledge updates and abstention; commercial assistants drop about 30% accuracy; session decomposition, fact-augmented keys and time-aware query expansion help. The knowledge-update and abstention categories are exactly what a fold can break. https://arxiv.org/abs/2410.10813 (snippet, 2026-10-02).
5. **LoCoMo and the Mem0 memory-evaluation page.** LoCoMo: 1,540 questions (single-hop, multi-hop, open-domain, temporal) over ~300-turn, up-to-35-session conversations. Mem0 reports 92.5 on LoCoMo and 94.4 on LongMemEval at ~6,900 tokens/query and names "memory staleness" an open problem (vendor numbers, UNVERIFIED). https://docs.mem0.ai/core-concepts/memory-evaluation, https://mem0.ai/blog/ai-memory-benchmarks-in-2026 (2026-10-02).
6. **Summary faithfulness metrics: SummaC, QAGS, FactCC, FaithJudge.** NLI-based (SummaC), QA-based (QAGS) and LLM-judge (FaithJudge, Vectara) methods for unsupported claims; recent work reports automatic metrics below 70% balanced accuracy on hard cases and that LLM judges are "fooled by text fluency". https://arxiv.org/abs/2502.08514v2, https://arxiv.org/pdf/2402.17630 (snippets, 2026-10-02).

## What to borrow

- From LSM: treat refolding as write amplification. Fold level-0 originals into the next level directly instead of summarising summaries, and cap depth. Separate the *trigger* (size) from the *policy* (what a fold may lose).
- From auto dream and `/doctor prompt-audit`: broken evidence (a path or commit that no longer exists) is a stronger staleness signal than "unread"; deletions are proposed, never applied, without a human. Fold already has `proposedRetractions`; keep that gate.
- From Letta: do compaction off the critical path (Fold's curator already is) and only where the next reads are predictable, i.e. per scope with observed recall traffic.
- From LongMemEval: evaluate memory by probe questions in the categories that compaction endangers: knowledge update (new value after supersession), temporal (which came first), abstention (retracted content must not be answered).
- From the faithfulness literature: never trust a single LLM judge; combine deterministic checks (citation validity, leakage) with a judge, and keep human-labelled calibration sets.

## What is unsolved

No published system measures whether a consolidated memory is *faithful per claim to attributed sources*; auto dream and sleeptime agents rewrite in place and discard the trail Fold keeps. "Latest wins" on contradiction is the industry default and is wrong for a multi-author ledger. Staleness has no accepted metric anywhere; every vendor delegates it to a model. Benchmarks test retrieval over chat histories, not the quality of a summary standing in for deleted context under a byte budget.

## Concrete recommendations for Fold

1. **Structured, per-claim provenance.** Change `Summarizer` in `packages/memory/src/store.ts` to return `{ claims: { text: string; from: string[] }[] }`; render text from it; `compact()` rejects a summary (emits `memory.compaction.rejected`, falls back to `bulletSummarizer`) if any `from` id is outside `candidates`, if any claim is empty, or if a retracted/superseded entry's content appears verbatim. Add the event to `packages/memory/src/events.ts`.
2. **Fold from raw, cap depth.** In `compact()`, when `level ≥ 1`, collect the transitive level-0 `derivedFrom` set and summarise those originals, not the summaries. Add `maxLevel: 2` to the policy in `events.ts`; the curator stops folding beyond it and reports the scope as oversized instead.
3. **Make staleness mean something.** Extend `memory.read` payload with `via: "inject" | "recall"` and keep `injectedSeq` and `recalledSeq` per entry in `packages/memory/src/state.ts`. In `curator.ts`, stale = injected at least N times and never recalled or cited, or evidence broken (path missing in the project host's tree via `packages/fleet`, commit unknown). Entries never injected because of the budget are "cold", not stale, and are the first fold candidates.
4. **Deterministic quality gate on every LLM fold.** New `packages/memory/src/eval.ts`: key coverage (every keyed candidate's current value is answerable from the summary), citation validity, leakage of retracted or superseded values, compression ratio, and byte cost against the 24 kB injection budget. The curator runs it before accepting a summary; results go in the `memory.compacted` payload so the management view can show them.
5. **Offline eval suite.** `packages/memory/eval/fixtures/` with synthetic ledgers (keys, supersessions by the same author, cross-author conflicts, retractions, commit evidence) plus recorded real ledgers, and `packages/memory/test/summary-eval.test.ts` that compacts each and runs LongMemEval-style probes: knowledge update, temporal order, abstention, attribution precision/recall, with judge calls journaled so the suite replays offline in CI. Report a scorecard per summariser; `bulletSummarizer` is the floor any LLM summariser must beat.
6. **Surface the fold quietly.** In the session view (`packages/server` and the web client), a folded summary renders as one collapsed notice in the quiet style: "Folded 12 entries · Ana, Bo · 9 claims", expanding to claims with their cited entries and the eval scores; the management view lists rejected folds for the lead.

## Sources

- https://www.techinterview.org/post/3233469062/lld-lsm-compaction/ (2026-10-02)
- https://www.eecg.utoronto.ca/~stumm/Papers/Dong-CIDR-16.pdf (2026-10-02)
- https://code.claude.com/docs/en/memory (fetched 2026-10-02)
- https://www.implicator.ai/anthropic-adds-auto-dream-to-claude-code-fixing-memory-decay-between-sessions (snippet, UNVERIFIED, 2026-10-02)
- https://claudefa.st/blog/guide/mechanics/auto-dream (snippet, UNVERIFIED, 2026-10-02)
- https://arxiv.org/abs/2504.13171 (snippet, UNVERIFIED, 2026-10-02)
- https://forum.letta.com/t/sleeptime-agents-for-memory-consolidation-best-practices-guide/154 (snippet, UNVERIFIED, 2026-10-02)
- https://arxiv.org/abs/2410.10813 (snippet, 2026-10-02)
- https://docs.mem0.ai/core-concepts/memory-evaluation (snippet, 2026-10-02)
- https://mem0.ai/blog/ai-memory-benchmarks-in-2026 (snippet, vendor claims UNVERIFIED, 2026-10-02)
- https://arxiv.org/abs/2502.08514v2 (snippet, 2026-10-02)
- https://arxiv.org/pdf/2402.17630 (snippet, 2026-10-02)
