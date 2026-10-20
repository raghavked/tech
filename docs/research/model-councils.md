# Multi-model deliberation: what the literature says, and what a council is for Henosis

Date: 2026-10-19. Research memo for the chat, runner and web teams. Primary pages on arxiv.org, proceedings.mlr.press, perplexity.ai and together.ai could not be fetched from this container; the facts below come from the abstracts and product pages as indexed by search on 2026-10-19. Repo files skimmed: `docs/19_council.md`, `docs/13_fleet_collaboration.md`, `docs/18_editions.md`, `packages/kernel/src/plans.ts`, `packages/chat/src/council.ts`, `packages/runner/src/council.ts`.

## The five ideas

**Self-consistency** (Wang et al., first posted March 2022, ICLR 2023). Sample several reasoning paths from one model and keep the answer most of them reach. Established: double-digit accuracy gains on arithmetic and commonsense benchmarks; cost is linear in samples, and five to ten capture most of the benefit. The cheapest form of "many voices": one model, no exchange of views, a vote at the end.

**LLM debate** (Du, Li, Torralba, Tenenbaum, Mordatch, posted May 2023, ICML 2024). Several instances of a model answer, then read each other's answers and revise over a few rounds until they converge. Established: better mathematical and strategic reasoning and fewer fabricated facts than a single answer; the abstract calls the method a "society of minds". A related line (Khan et al., ICML 2024) has two strong models argue opposing sides for a weaker judge, raising the judge's accuracy on a reading benchmark from 48% to 76%; that is adversarial debate, not consensus-seeking.

**Society of mind** is Minsky's 1986 book: intelligence as the product of many simple, individually mindless agents grouped into agencies. In the debate papers it is a name, not a mechanism. Our inference: its useful content for product design is that members are specialised and that who talks to whom matters, which is what the later cost studies find.

**Mixture-of-agents** (Wang, Wang, Athiwaratkun, Zhang, Zou, posted June 2024; Together's reference implementation, same month). Layers of models; every model in a layer reads every output of the previous layer; a final aggregator writes the answer. Established: a stack of open models beat the then-leading proprietary model on a preference benchmark (65.1% against 57.5% on AlpacaEval 2.0), and models answer better when shown other models' drafts, even weaker ones. Cost is models times layers, and the aggregator's input grows with every layer. The post is a vendor's and the judge is a preference model, so treat the number as directional.

**Model council** (Perplexity, announced 5 February 2026; help-centre page current as of 2026-10-19). One question goes to three frontier models from three vendors in parallel; a separate synthesiser tabulates where they converge, where they diverge and what only one surfaced, and writes a consensus answer that flags disagreement. The models do not see each other's answers. It is sold on the top subscription tiers with a monthly query cap; a July 2026 variant lets a user pick two to eight models. This is the product shape closest to Henosis's individual round plus synthesis, and the distance from it is the next section's point.

## What improves answers, and what adds cost

Established, from the two evaluation papers that tried to settle this:

- Smit et al. ("Should we be going MAD?", posted November 2023, ICML 2024) found that debate protocols did not reliably beat self-consistency or simple ensembling, that they are more sensitive to hyperparameters, and that they need more calls and therefore more tokens. Tuning how strongly agents are pushed to agree moved one protocol from worst to best (a 15% gain on a medical QA set), so the protocol's social parameters matter more than the number of rounds.
- Zhang et al. ("Stop Overvaluing Multi-Agent Debate", posted February 2025) ran five debate methods on nine benchmarks with four base models and found they frequently fail to beat chain-of-thought and self-consistency even with much more inference compute. Mixing different base models across the agents improved two protocols by 6.4% and 8.2% on average; heterogeneity is the one intervention that helped consistently.
- Liang et al. (posted May 2023, EMNLP 2024) documented the failure debate is meant to fix: once a single model is confident, further self-reflection rarely changes its answer even when wrong. Assigning opposing stances with a judge restored divergence.

Our inference from these together: the gains come from diversity (different models, stances and information) and from a competent synthesis step, not from rounds as such. A second discussion round costs as much as the first and buys little once positions are stated. Debate among identical models mostly re-samples one distribution, which self-consistency does cheaper. What a product can add that a benchmark cannot is new information entering mid-deliberation, which the papers never study because their agents share one context.

The cost is arithmetic. An individual round is N calls; each discussion round is N calls whose prompts carry N answers, so input tokens grow roughly as N squared per round; synthesis is one call carrying everything. Three models and one discussion round cost about seven calls and perhaps fifteen to twenty times the input tokens of a single answer. Latency is the slowest member per round, serialised across rounds.

## How Henosis differs

Perplexity's council and MoA answer one question with vendors' models and leave the answer in a chat box. Henosis's council (`docs/19_council.md`) differs in four ways the literature does not cover.

1. **Members are a team's agents with owners.** Each member model has a profile a person owns and a persona they wrote, so the diversity the cost studies reward is there by construction: members differ in provider, persona, tools and history. Our inference: owner-authored personas are a stronger source of divergent stances than the assigned roles of Liang et al., and cheaper than tuning agreement intensity, because the people already disagree.
2. **Instructions are private and new information enters mid-round.** A person can instruct one model privately (`council.instructed`, visible to that member's owner and the chair) and the model cites it in its next message. No paper studies deliberation with private information arriving between rounds, so nothing is established; our inference is that this is where a discussion round earns its cost.
3. **Synthesis becomes an approved plan.** The chair's output is a `plan.proposed` with steps, estimates, risk classes and an owner per step, rated by people under `planApprovalMet` in `packages/kernel/src/plans.ts`; the chair's model does not vote. Benchmarks score an answer; Henosis scores a plan by whether the team accepts it and then by `actualTokens` against `estTokens` per step, a measurable loop the papers lack.
4. **Dissent and spend are in the log.** `council.synthesised` carries dissent beside the plan; every `council.said` carries usage; the council replays. This is the record of who argued what that `docs/18_editions.md` promises auditors and that a consumer feature has no reason to keep.

## What this changes for Henosis

- **One discussion round by default; a second must earn its place.** `council.convened` already carries `discussionRounds: 1`; the convene sheet in `docs/19_council.md` (Rooms) should offer a second round only after the first, showing the projected cost from the usage sums the host keeps, since extra rounds add tokens faster than quality.
- **Heterogeneity as a warning.** When every selected member resolves to the same provider and model (`agent` in `users.json`, `agents.json` for shared agents), the convene sheet should say so and suggest self-consistency instead: one model asked three times costs less and does as well. The directory in `packages/server/src/orgs.ts` has what is needed to compute this.
- **Score the council by its plan.** Add to the usage API's `council` row the step-level `estTokens` versus `actualTokens` and the `ratingSummary` average from `packages/kernel/src/plans.ts`, so a manager's view compares councils to single-agent plans on the two numbers that matter: did the team approve it, and did it cost what it said.
- **Private instruction is the distinctive input.** `packages/runner/src/council.ts` already renders instructions into the member prompt with a citation; the council view should mark a discussion message that cites one as new information rather than a stance change, and the synthesis prompt should list which instructions changed the plan, the one thing a benchmark council cannot do.
- **Stances as an agreement dial.** `CouncilStance` ("agree", "differ", "add") in `packages/chat/src/council.ts` is the hook Smit et al. found decisive. Record the stance distribution per council in the conclusion summary and add a per-project policy knob beside `planApproval` in `packages/protocol/src/index.ts` for how strongly the discussion prompt asks for consensus; start neutral and tune from the logs.

## Sources

- Wang et al., "Self-Consistency Improves Chain of Thought Reasoning in Language Models", arXiv:2203.11171 (v1 2022-03-21, v4 2023-03-07), ICLR 2023. https://arxiv.org/abs/2203.11171
- Du, Li, Torralba, Tenenbaum, Mordatch, "Improving Factuality and Reasoning in Language Models through Multiagent Debate", arXiv:2305.14325 (2023-05-23), ICML 2024, PMLR 235:11733-11763. https://arxiv.org/abs/2305.14325 and https://proceedings.mlr.press/v235/du24e.html
- Liang et al., "Encouraging Divergent Thinking in Large Language Models through Multi-Agent Debate", arXiv:2305.19118 (2023-05-30), EMNLP 2024. https://aclanthology.org/2024.emnlp-main.992
- Smit et al., "Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs", arXiv:2311.17371 (2023-11-29), ICML 2024. https://proceedings.mlr.press/v235/smit24a.html
- Khan et al., "Debating with More Persuasive LLMs Leads to More Truthful Answers", arXiv:2402.06782 (2024-02), ICML 2024. https://proceedings.mlr.press/v235/khan24a.html
- Wang, Wang, Athiwaratkun, Zhang, Zou, "Mixture-of-Agents Enhances Large Language Model Capabilities", arXiv:2406.04692 (2024-06-07). https://arxiv.org/abs/2406.04692; reference implementation and benchmark post, Together AI, June 2024. https://together.ai/blog/together-moa and https://github.com/togethercomputer/moa
- Zhang et al., "Stop Overvaluing Multi-Agent Debate: We Must Rethink Evaluation and Embrace Model Heterogeneity", arXiv:2502.08788 (2025-02). https://arxiv.org/abs/2502.08788
- Minsky, *The Society of Mind*, Simon & Schuster, 1986. https://en.wikipedia.org/wiki/Society_of_Mind (publisher listing: https://www.simonandschuster.com/books/The-Society-of-Mind/Marvin-Minsky/9780671657130)
- Perplexity, "Introducing Model Council", 2026-02-05. https://www.perplexity.ai/hub/blog/introducing-model-council; help centre, "What is Model Council?", read via search index 2026-10-19. https://www.perplexity.ai/help-center/en/articles/13641704-what-is-model-council; "Model Council comes to Computer", 2026-07-28. https://www.perplexity.ai/hub/blog/model-council-comes-to-computer
