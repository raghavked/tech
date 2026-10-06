# Evaluating handoff briefs: I-PASS, SBAR, receiver synthesis, and how Henosis should measure its own

Date: 2026-10-02. Research note for the Henosis kernel and client teams. Egress blocked NEJM, BMJ, PMC, AHRQ PSNet, arXiv, Springer and PagerDuty; figures below come from secondary snippets and are marked UNVERIFIED where the primary text was not read.

## Why it matters for Henosis

The handoff is the moment Henosis's whole thesis is tested. A driver leaves, a new one accepts, and `packages/kernel/src/brief.ts` computes a catch-up document from the log: situation, open items, recent turns, decisions and files since the recipient's `lastSeenSeq`, workspace. `docs/05_kernel_design.md` already claims I-PASS lineage and promises receiver synthesis in phase 1. What the repo does not yet have is any way to know whether the brief works. There is no event that records that a brief was shown, no record of what the receiver understood, and no metric that distinguishes a good handoff from a bad one. Without that, the obvious next step (an LLM-refined brief) cannot be judged against the deterministic one, and the deterministic brief cannot be tuned.

## Prior art

1. **Starmer et al., "Changes in Medical Errors after Implementation of a Handoff Program", NEJM 2014;371:1803-1812.** Nine pediatric residency programmes, 10,740 admissions, pre/post design. Medical errors fell from 24.5 to 18.8 per 100 admissions (23% relative), preventable adverse events from 4.7 to 3.3 (30%). The bundle was not just the I-PASS mnemonic (Illness severity, Patient summary, Action list, Situation awareness and contingency, Synthesis by receiver) but training, a restructured written tool, faculty observation and sustainability work. https://www.nejm.org/doi/full/10.1056/NEJMsa1405556 (primary blocked; figures via Intermountain Health release, https://news.intermountainhealth.org/multicenter-patient-safety-study-reduces-medical-error-injuries-by-30/, accessed 2026-10-02).
2. **Müller et al., "Impact of the communication and patient hand-off tool SBAR on patient safety: a systematic review", BMJ Open 2018;8:e022202.** Literature to January 2017; 26 distinct patient outcomes measured across included studies, 8 significantly improved, 11 reported improved without statistics, 6 unchanged. Verdict: moderate evidence, strongest for structuring telephone communication, with a general lack of high-quality trials. https://bmjopen.bmj.com/content/8/8/e022202 (blocked; via AHRQ PSNet snippet, accessed 2026-10-02). Author list UNVERIFIED.
3. **I-PASS synthesis-by-receiver literature (PMC9923540; BMJ Quality & Safety 2021;30:769).** The second S is defined as closed-loop communication: a brief read-back by the receiver, then questions and discussion, modelled on aviation, military and nuclear read-back practice. https://pmc.ncbi.nlm.nih.gov/articles/PMC9923540 and https://qualitysafety.bmj.com/content/30/10/769 (both blocked; titles UNVERIFIED, accessed 2026-10-02).
4. **Dorr, Monz, President, Schwartz, Zajic, "A methodology for extrinsic evaluation of text summarization: does ROUGE correlate?", ACL Workshop 2005.** The canonical task-based evaluation: readers perform a relevance-judgement task from summaries versus full documents; the metrics are decision accuracy and time to decision, and intrinsic scores (ROUGE) correlate poorly with them. This is the lineage of "time to first correct decision". https://aclanthology.org/W05-0901/ (not fetched; details from memory, UNVERIFIED, accessed 2026-10-02).
5. **Pu, Gao, Wan, "Summarization is (Almost) Dead", arXiv:2309.09558 (2023).** Human raters preferred LLM summaries to human-written and fine-tuned ones, and LLM summaries showed fewer extrinsic hallucinations, but factual errors were still present and hard to spot in fluent text. Relevant because an LLM-refined brief will read better than the computed one whether or not it is more correct, so preference is the wrong primary metric. https://arxiv.org/abs/2309.09558 (blocked; from memory, UNVERIFIED, accessed 2026-10-02).
6. **PagerDuty Incident Response, "Being On-Call" and incident-commander handoff.** Operational practice: an IC who hands off must state current status, what has been tried, open actions and who owns them, and the incoming IC acknowledges in the channel before taking the role. https://response.pagerduty.com/oncall/being_oncall/ (blocked; UNVERIFIED, accessed 2026-10-02).

## What to borrow

- **The bundle, not the mnemonic.** The 23% result came from structure plus training plus observation plus a written tool. For Henosis: the brief, a synthesis step enforced by the kernel, and measurement that feeds back into the brief's content.
- **Severity first.** I-PASS leads with illness severity because it sets the receiver's attention. Henosis's brief currently opens with branch and seq. It should open with a computed status band: unstable (unresolved contention, pending irreversible approval, failing turns), watch, or stable.
- **Contingency as a section.** "If X happens, do Y" is the I-PASS element with no analogue in `brief.ts`. The log contains the material: constraints, shadowed suggestions, declined approvals, prior driver notes. Surface them as "if this, then".
- **Receiver synthesis as a gate, journaled.** Authority moves only after the receiver restates the plan; the restatement is an event.
- **Extrinsic metrics.** Measure decisions and time, not reader preference. Fluency will favour the LLM; correctness will not necessarily.
- **Evidence quality honesty.** SBAR's review found moderate evidence with weak designs. Henosis's handoffs are rare events; a naive A/B will be underpowered, so plan for crossover designs and offline replay from day one.

## What is unsolved

- **Ground truth for "correct decision".** Medicine has adverse events; Henosis has to define what a wrong first decision is. Candidates: a directive reversed within N turns, an approval later contested, a steer on a scope that was already under contention, a question the brief already answered.
- **Attribution.** A bad handoff and a bad receiver look alike. Within-engineer crossover and a simulated receiver separate them only partly.
- **Provenance in refined briefs.** An LLM-refined brief must remain replayable (journaled call, as with context merge) and auditable (every sentence tied to seqs).
- **Dwell and attention.** Presence is ephemeral and never logged by design; measuring whether the brief was read at all needs a telemetry event that carries no authority but is still part of the chain.
- **Sample size.** A team of ten may produce a few handoffs a day. Sequential or Bayesian analysis, plus an offline benchmark that runs on every log, are needed to learn anything in a quarter.

## Concrete recommendations for Henosis

1. **Structured brief model.** In `packages/kernel/src/brief.ts`, split `handoffBrief` into `briefModel(state, opts)` returning typed sections (severity band, situation, open items with ids and seqs, contingencies, recent turns, since-seq decisions and files, workspace) and a renderer to markdown. The ids are what synthesis and metrics key on. Add the severity band and the contingency section.
2. **Events.** In `packages/protocol/src/index.ts`, add `brief.rendered` {handoffId, variant: "computed" | "refined", briefHash, computedHash, sinceSeq, modelCallId?}, `brief.viewed` {handoffId, dwellMs} (no authority effect), and `handoff.synthesized` {handoffId, text, acknowledgedItemIds}. In `packages/kernel/src/session.ts`, make `acceptHandoff` require a prior `handoff.synthesized` when `policy.requireSynthesis` is set, mirroring how approvals bind to a call hash.
3. **Metrics as pure replay functions.** New `packages/kernel/src/metrics.ts`: `timeToFirstCorrectDecision`, `reversalRate`, `synthesisCoverage` (acknowledged ids over open-item ids in the brief), `openItemClosureLatency`, `clarificationCount` (team-chat notes from the new driver before the first directive). All derive from events, so `henosis report` in `packages/cli/src/report.ts` prints them for any log and they are testable in `packages/kernel/test/session.test.ts`.
4. **Variant assignment and refined brief.** In `packages/server/src/host.ts`, assign the variant deterministically from `hash(handoffId)` under an experiment config, and produce the refined brief through the same journaled summarizer path as context merge. Validate it before rendering: every bullet cites seqs that exist, no open item appears that is not in state, no open item in state is missing. Reject to computed on failure and log the rejection.
5. **Client synthesis step.** In the session client (prototyped in `design/web-session.html`, tokens from `design/tokens.css`), render the brief as a quiet notice above the composer and prefill the composer with "Restate the plan" plus the open items as checkboxes; the submit emits `handoff.synthesized`. The accept control stays disabled until it is sent. Same rendering for both variants so the receiver is blind.
6. **Offline receiver benchmark.** In `packages/runner`, add a harness that replays historic logs, cuts at checkpoints, renders both briefs, and asks a model-as-receiver a fixed question set whose answers are computable from state (what approval is pending, which scope is contended, which files changed since seq N, what is the goal). Score accuracy per variant on every log in CI before any human A/B, and use the human A/B, run as a within-engineer crossover with sequential stopping, to confirm.

## Sources

- https://www.nejm.org/doi/full/10.1056/NEJMsa1405556 (blocked; accessed 2026-10-02)
- https://news.intermountainhealth.org/multicenter-patient-safety-study-reduces-medical-error-injuries-by-30/ (snippet; accessed 2026-10-02)
- https://bmjopen.bmj.com/content/8/8/e022202 (blocked; accessed 2026-10-02)
- https://psnet.ahrq.gov/issue/impact-communication-and-patient-hand-tool-sbar-patient-safety-systematic-review (blocked; snippet; accessed 2026-10-02)
- https://pmc.ncbi.nlm.nih.gov/articles/PMC9923540 (blocked; snippet; accessed 2026-10-02)
- https://qualitysafety.bmj.com/content/30/10/769 (blocked; snippet; accessed 2026-10-02)
- https://aclanthology.org/W05-0901/ (not fetched; accessed 2026-10-02)
- https://arxiv.org/abs/2309.09558 (blocked; accessed 2026-10-02)
- https://response.pagerduty.com/oncall/being_oncall/ (blocked; accessed 2026-10-02)
