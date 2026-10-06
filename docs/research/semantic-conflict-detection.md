# Semantic conflict detection for the fleet guard

*Research memo, 2 October 2026. Topic: detecting conflicts between two agents' sessions beyond path overlap (same symbol, same test, same migration) with tree-sitter, LSP and import graphs; what CodeCRDT found; cost and false-positive tradeoffs. Several primary sources sat behind the egress proxy; where a figure comes from a search snippet rather than the paper it is marked UNVERIFIED.*

## Why it matters for Henosis

The fleet layer (`packages/fleet`) refuses a write to a path another session holds, and `docs/13_fleet_collaboration.md` says plainly that semantic overlap is "detected only through path overlap; a semantic layer is planned". Path overlap is the wrong granularity in both directions. Too coarse: two engineers' agents editing different functions in `billing/invoice.ts` are blocked from each other for no reason, and auto-claim-on-first-write makes the first writer own the whole file. Too fine: Ana's agent renames `computeTax` while Bo's agent adds a new call to it in another file, both writes pass the guard, the merge is textually clean, and the build breaks after fold. The same holds for two sessions each adding a migration with the next sequence number, or two sessions editing the same test case from different files' fixtures.

Henosis's position is unusual and favourable. Every session reports touched paths at turn boundaries, claims are deterministic events on a hash-chained ledger, and contentions are already a first-class notice in the conversation column. A semantic guard does not need a new product surface; it needs a finer resource type, a cheap and deterministic extractor, and a policy for when a hit is a refusal, a warning or a contention for the lead.

## Prior art

1. **CodeCRDT** (Erkens et al., arXiv 2510.18893, accessed 2026-10-02 via search snippets; arxiv.org blocked, UNVERIFIED in detail). Agents coordinate by observing a shared CRDT document rather than by messages. 600 trials, Claude Sonnet 4.5. Convergence is 100% with zero merge failures, but a preliminary inspection finds 5–10% of runs need post-generation reconciliation for *semantic* conflicts: duplicate declarations and type mismatches. Parallel is 11–52% faster per character on 5 of 6 tasks but produces 82–189% more code and scores 7.7% lower on quality. Lesson: structural merge is a solved cost; the residual is semantic, and it is a single-digit-percent tail, which is the right target for a guard that must stay quiet.

2. **Mergiraf and LastMerge** (Carvalho et al., arXiv 2507.19687; LWN 1042355; accessed 2026-10-02, snippets only). Language-agnostic structured merge over tree-sitter CSTs with a thin per-language configuration (33 languages for Mergiraf). Mergiraf has 42% fewer false negatives than Spork; LastMerge reports 15% fewer false positives than jDime; generic tools differ from Java-specific ones by about 10%, mostly on implementation detail, at comparable runtime. Lesson: tree-sitter plus a small per-language table (what counts as a declaration, which parents are commutative) is enough to reach language-specific accuracy, and it runs at merge speed.

3. **Lightweight semantic conflict detection with static analysis** (Galileu and Borba, 2024; "Comparing static analyses", ASE 2025/2026; accessed 2026-10-02, snippets only, UNVERIFIED). Interprocedural def-use data flow, confluence analysis and overriding-assignment analysis on 99 units (33 with interference): F1 0.50, accuracy 0.60, 26.2% false positives, 13.1% false negatives. Combining analyses across 32 GitHub projects improves on each alone. Lesson: dataflow-level interference detection is real but noisy; a quarter of alerts would be wrong, which is unacceptable for a refusal and tolerable only for a soft warning.

4. **The effect of pointer analysis on semantic conflict detection** (Borba group, 2025; cin.ufpe.br blocked, snippets only, UNVERIFIED). Adding pointer analysis cuts timeouts and false positives significantly but drops recall and F1 prohibitively. Lesson: precision in this space is bought with recall; a fleet guard should pick the point on the curve explicitly per conflict class rather than chasing one global analysis.

5. **Wit, symbol-level locks for agents** (github.com/amaar-mc/wit README, fetched 2026-10-02). Tree-sitter WASM grammars, no native build, give byte ranges per function, class, type and export; a symbol is `src/auth.ts:validateToken`. Three checks at intent time: intent overlap, lock intersection, and dependency chain (intent targets a caller of a locked symbol). Locks are warnings; the only hard enforcement is a pre-commit hook on agreed function signatures. TypeScript/JavaScript and Python only; single machine. Lesson: the symbol resource and the "caller of a held symbol" check are implementable in a few hundred lines; Wit stops at warnings because it has no arbitration or ownership model, which Henosis has.

6. **AgenticFlict** (arXiv 2604.03551; related 2607.04697; accessed 2026-10-02, snippets only, UNVERIFIED). 142K agent PRs from 59K repositories; 27.67% conflict textually when merged against concurrent work; a conflicting PR touches 4.36 files on average with 11 conflict regions; rates range from 15% (Copilot) to 32% (Codex). Lesson: agents collide far more often than humans do on the same repos, which is the demand signal for claims at all, and the numbers are textual, so the semantic residual on top of them is unmeasured.

7. **Palantír workspace awareness** (Sarma, Redmiles, van der Hoek, UCI-ISR-07-2, accessed 2026-10-02, snippet). Two lab experiments: surfacing concurrent changes leads to earlier detection and resolution of more conflicts at reasonable overhead. Lesson: awareness alone, before any blocking, pays; Henosis's fleet context string is the modern form of it.

## What to borrow

- **Symbol as a resource**, alongside path, service and ticket, with Wit's identity scheme (`path:qualifiedName`) and tree-sitter WASM extraction with no native dependency, so the Tauri shell and the web client can both run it.
- **Mergiraf's per-language table** rather than a full language front-end: declaration node types, commutative parents (import lists, class members), signature extraction. Five languages cover the fleet's early users; add others as data.
- **Three-tier severity** from the static-analysis literature: declaration-level overlap (same symbol, same migration number, same test name) is near-precise and can refuse; caller-of-held-symbol and import-graph reachability is medium precision and should warn in the agent's tool result; dataflow interference is low precision and belongs only in the merge report, never in the guard.
- **CodeCRDT's classes**: duplicate declarations and type mismatches are what a parallel fleet actually produces. Both are detectable at write time by comparing the symbol sets of the two sessions' pending workspaces.

## What is unsolved

- No published measurement of semantic conflict rates between *long-running* agents under claims; CodeCRDT's 5–10% is on short generation tasks with a shared document.
- Cross-language edges (an SQL migration and the ORM model that reads it; a test fixture and the code it exercises) have no general extractor. Migrations need a repo-specific rule (sequence numbers, schema names).
- LSP gives the most accurate symbol and reference data but requires a running server per language per workspace, is not deterministic across versions, and cannot be replayed. Henosis's log must record the extractor's verdict as an event, never recompute it on replay.
- Partial admission (grant the non-overlapping symbols of a file claim) is listed as not implemented and is what a symbol resource mostly exists to enable.
- False-positive budget: nobody has published a tolerable alert rate for agents; for humans the Borba numbers say 26% wrong alerts loses trust. Agents route around a refusal, so a false refusal costs a turn, not a developer's patience, but it also silently corrupts the fleet brief.

## Concrete recommendations for Henosis

1. **Add `symbol` to `Resource` in `packages/fleet/src/events.ts`** with fields `path`, `name`, `kind` (function, class, type, export, test, migration). Extend `resourcesOverlap` in `packages/fleet/src/claims.ts`: a symbol overlaps its containing path claim, and two symbols overlap on equal `(path, name)`; migrations overlap on equal sequence number regardless of path. Keep the verdict order-independent.
2. **New package `packages/semantics`** wrapping `web-tree-sitter` with WASM grammars for TypeScript, JavaScript, Python, Go and SQL, exposing `extractSymbols(path, text): Symbol[]` and `symbolDiff(before, after)`. Pure, synchronous, no I/O. The language table lives in `packages/semantics/src/languages.ts`, Mergiraf style.
3. **Guard at write time in `packages/runner/src/tools.ts` `guardWrite`**: before calling `checkWrite(path)`, compute `symbolDiff` of the proposed content against the workspace blob (`packages/kernel/src/workspace.ts`) and call `checkWriteSymbols(path, changed)`. Refuse only tier 1 (another session holds the exact symbol, or declares the same new symbol or migration number). Return the holder's name in the tool result exactly as the path refusal does.
4. **Warn, don't refuse, on reachability**: in `packages/fleet/src/state.ts` keep a per-project import graph built from the symbol extractor's import nodes; when a session changes the signature of a symbol that another session's touched paths import, append a `fleet.warning` to the tool result and record a `contention` of new kind `"symbol-reachability"` in `packages/fleet/src/contention.ts`. Both owners and the lead see it as the existing quiet notice.
5. **Record the extractor verdict as an event** (`SymbolsObserved {sessionId, path, symbols hash}`) in the ledger so `henosis verify` replays from recorded symbols, not from re-parsing with a possibly different grammar version. Pin grammar WASM hashes in `packages/semantics/package.json`.
6. **Auto-claim at symbol granularity**: change the first-write auto-claim in `packages/fleet/src/project.ts` from the file to the changed symbols, falling back to the path for files the extractor cannot parse. This is the partial-admission feature by another name.
7. **Measure before tightening**: add `scripts/conflict-replay.ts` that runs the extractor over `store-demo` and e2e logs and reports tier-1 refusals, tier-2 warnings and what the merge in `packages/kernel/src/merge.ts` later actually conflicted on. Promote a tier from warn to refuse only when replayed precision exceeds 0.9.
8. **Surface in the client** as the existing contention notice line, one sentence: "Ana's session holds `computeTax`; you changed its signature." No new panel; link to the fleet board where the lead resolves.

## Sources

- CodeCRDT: https://arxiv.org/abs/2510.18893 (accessed 2026-10-02, snippets; UNVERIFIED)
- LastMerge / Mergiraf comparison: https://arxiv.org/abs/2507.19687 (accessed 2026-10-02, snippets)
- Mergiraf on LWN: https://lwn.net/Articles/1042355 (accessed 2026-10-02, blocked; snippet)
- Galileu and Borba, Lightweight semantic conflict detection: https://pauloborba.cin.ufpe.br/publication/2024lightweight_semantic_conflict_detection_with_static_analysis/ (accessed 2026-10-02, blocked; UNVERIFIED)
- Comparing static analyses for semantic conflict detection: https://www.cin.ufpe.br/~mbo2/publications/ase2025/ (accessed 2026-10-02, blocked; UNVERIFIED)
- Pointer analysis and semantic conflict detection: https://www.cin.ufpe.br/~mbo2/publications/article2025/ (accessed 2026-10-02, blocked; UNVERIFIED)
- Wit symbol locks: https://raw.githubusercontent.com/amaar-mc/wit/main/README.md (fetched 2026-10-02)
- AgenticFlict: https://arxiv.org/abs/2604.03551 (accessed 2026-10-02, snippets; UNVERIFIED)
- Palantír: https://isr.uci.edu/sites/isr.uci.edu/files/techreports/UCI-ISR-07-2.pdf (accessed 2026-10-02, snippet)
