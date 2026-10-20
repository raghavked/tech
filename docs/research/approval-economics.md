# Approval economics: ratings, votes, risk classes and enterprise change control

*Research memo, 20 October 2026. Established claims carry a date and a source; what is
ours is marked as inference. Repo files read: `docs/19_council.md`,
`docs/13_fleet_collaboration.md`, `docs/18_editions.md`, `packages/kernel/src/plans.ts`,
`packages/protocol/src/index.ts`.*

## The question

Henosis asks the people in a session to rate an agent's plan 1..5 and lets the policy
approve it when enough raters average high enough: `planApprovalMet` in `plans.ts` is
`count >= min && average >= average`, default `{min: 1, average: 3}`. Tool calls carry a
risk class (`read | write | exec | external | irreversible`); the irreversible class defaults
to a release gate of two contributors averaging 4 or more where any deny denies. The council
(`19_council.md`) reuses plan ratings as its vote. This memo tests that shape against what
is known about ratings versus votes, CI/CD release gates and SOC 2 and NIST change control,
then says what to change.

## Ratings versus votes

**Established.** Bargagliotti and Li (Decision Sciences, December 2013; working paper
August 2009) compared a binary approve/reject system with N-point scales. For one rater the
two agree only when N is odd and N-1 is not divisible by 4, so 3, 7 and 11 qualify and 5
does not; once ratings are aggregated the two systems can reach different decisions for any
N. A thresholded five-point average is not a vote in disguise; it can approve what a
majority would reject.

**Established (practitioner).** Husain's evals FAQ (24 July 2025) argues for binary
pass/fail over 1..5 Likert labels: the gap between adjacent points is subjective across
annotators, real differences need larger samples, and raters drift to the middle to avoid a
hard call. That is the "3" problem: an unsure rater clicks 3, and in Henosis 3 is the bar.

**Our inference.** Ratings are the right instrument for *confidence* and the wrong one for
*authorisation*. The release-gate rule already knows this: it composes a count, a floor on
the average, a role (`of`) and an unconditional deny. The plan rule has only the count and
the average, so one 5 and one 1 average 3 and pass. Approval should be a vote-like predicate
(nobody below a floor, nobody entitled to deny has denied, enough raters of the right role),
with the average kept as displayed confidence and a budget signal, not the thing that opens
the gate.

## Risk classes

**Established.** ITIL 4 change enablement (2019; summarised by itsm.tools, 2024)
distinguishes standard changes (pre-authorised, low-risk, templated), normal changes
(assessed and authorised per change by a named change authority) and emergency changes
(approval accelerated, never skipped, reviewed more rigorously afterwards). NIST SP 800-53
Rev. 5 (September 2020) CM-3 requires an organisation to define which changes are
configuration-controlled, approve or reject them with explicit consideration of the security
impact analysis, and retain the records; CM-4 is the impact analysis that feeds that
decision. Agent-platform guidance converges on the same ladder: reads and internal writes
auto-execute, destructive or outbound actions need synchronous approval, payments and
production changes need two independent reviewers (Gravitee, 2025; Truto, 2025). The AWS
Agentic AI Lens (AGENTSEC04-BP02, 2025) says reviewing every action produces rubber-stamp
approvals, and 2025 security write-ups treat approval fatigue as a vulnerability, not a UX
complaint (Ou; Pillar Security).

**Our inference.** The five classes map cleanly onto ITIL: `read` and `write` are standard
changes, `exec` and `external` are normal changes with a named approver, `irreversible` is
the change that needs a board, and the plan is the CM-4 impact analysis. What is missing is
the emergency path. An owner's `plan.decide` is a bypass, and auditors accept bypasses only
with a recorded reason and a retrospective review; the `note` on `plan.decide` is optional
today (`PlanCard.tsx` sends it empty).

## Release gates in CI/CD

**Established.** GitHub deployment environments (docs current as of 2026) let an admin name
up to six required reviewers of which any one suffices, optionally forbid self-review, set a
wait timer of 0 to 43,200 minutes, and restrict branches; a job that targets the environment
waits and cannot read its secrets until every rule passes, and an unapproved job fails after
30 days. Branch protection separately offers "dismiss stale approvals when the diff changes"
(GitHub records the diff at approval time) and "require approval of the most recent
reviewable push" by someone other than the pusher. Spinnaker's Manual Judgment stage pauses
a pipeline until a person answers (codelab; O'Reilly, 2019). DORA's 2019 report found that
formal approval by an external board or senior manager hurt delivery performance and did
not lower change failure rates; it recommends peer review during development plus
automation.

**Our inference.** Three gate properties recur across products and Henosis lacks all three.
Staleness: a rating is bound to a `planId`, which is right, but a revise cycle produces a
new plan and silently drops the ratings with no record that the raters were asked again.
Self-review: nothing stops the person who set the goal from being the single rater who
satisfies `min: 1`. Authority propagation: Spinnaker carries the approver's credentials into
later stages; the Enterprise credential broker (`18_editions.md`) is the same idea and the
approved plan is where the grant should attach.

## SOC 2 change management

**Established.** Trust Services Criterion CC8.1 (AICPA, 2017 criteria with points of focus
revised 2022) requires that the entity authorise, design, develop or acquire, configure,
document, test, approve and implement changes to infrastructure, data, software and
procedures; points of focus are guidance, not requirements. Auditor practice (KirkpatrickPrice,
2019; Sprinto, 2024) is to sample changes from the period and ask for evidence that each was
authorised, tested and approved before production, with the reason, authoriser and
implementer recorded, and emergency changes approved retrospectively.

**Our inference.** A SOC 2 sample of Henosis changes is a sample of plan and gate events.
The auditor's questions map one to one: who authorised (`plan.proposed` and the ratings),
was it tested (step `actualTokens` and tool results between start and done), who approved
before production (the irreversible gate's ballots), who bypassed and why (`decidedBy` with
`note`). The log answers all but the last, where the note is optional, and the segregation
question, where the rater may be the goal's author.

## Plan-first with rating thresholds as change control

Plan-first is the normal-change form: the plan is the request for change, the steps' risk
classes are the impact analysis, the ratings are the assessment, the policy is the change
authority, and the gate before the irreversible step is the deployment approval. What
enterprise change control adds, and the kernel does not yet express, is a per-class plan
rule (a plan containing an irreversible step needs the raters that step will need), a
recorded reason for every bypass, exclusion of the goal's author from the quorum, and
ratings that survive a revise only when re-affirmed. DORA's evidence says do not add a
board: keep the raters the peers in the session, keep the policy fast, make the record
complete.

## What this changes for Henosis

- `packages/protocol/src/index.ts` and `packages/kernel/src/plans.ts`: extend `planApproval`
  with `of: Role`, a `floor` below which a rating counts as a deny, and `excludeAuthor`;
  `planApprovalMet` then checks approving-rater count, average, floor and author exclusion,
  so one 5 and one 1 no longer pass and the session's default rater is not its driver.
- `packages/kernel/src/plans.ts` and `apps/web/src/stream/PlanCard.tsx`: require `note` on
  `plan.decide` when `decidedBy` is not `policy`, and fold it as a bypass with a reason; the
  Enterprise policy packs in `docs/18_editions.md` can then forbid bypass per risk class and
  the audit view can list bypasses for the SOC 2 sample.
- `PlanCard.tsx` and the Slack plan message (`packages/slack/src/templates.ts`): when a plan
  is superseded, carry the previous raters forward as "rated the earlier version" chips and
  ask them to re-rate, which is GitHub's stale-approval rule; show the author's rating as a
  chip that does not count.
- `docs/19_council.md`: derive the vote rule from the highest risk class among the
  synthesised steps rather than the session default, so a council whose plan includes an
  irreversible step convenes the release-gate quorum at vote time instead of stalling later;
  keep the dissent beside the ballots in `council.synthesised`.
- `docs/13_fleet_collaboration.md`, the glance and the inbox: keep ranking what-needs-you by
  risk class then age, auto-approve `write` inside an approved plan to cut per-call prompts
  (the fatigue defence the 2025 guidance recommends), and add an approve-to-deny ratio per
  person to the Team audit view (`18_editions.md`) so a rubber-stamping rater is visible.

## Sources

- Bargagliotti, A. E. and Li, L., "Decision Making Using Rating Systems: When Scale Meets
  Binary", Decision Sciences 44(6), Dec 2013. https://digitalcommons.lmu.edu/math_fac/130 ;
  working paper (Aug 2009) https://mpra.ub.uni-muenchen.de/16947/
- Husain, H., "Why do you recommend binary (pass/fail) evaluations instead of 1-5 ratings?",
  24 Jul 2025. https://hamel.dev/blog/posts/evals-faq/why-do-you-recommend-binary-passfail-evaluations-instead-of-1-5-ratings-likert-scales.html
- DORA, 2019 Accelerate State of DevOps Report. https://dora.dev/research/2019/dora-report/ ;
  "Streamlining change approval". https://dora.dev/capabilities/streamlining-change-approval/
- GitHub Docs, "Control deployments" (environments, required reviewers, wait timer).
  https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments ;
  "About protected branches". https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- Spinnaker, "Safe Deployments" codelab. https://spinnaker.io/docs/guides/tutorials/codelabs/safe-deployments/ ;
  Continuous Delivery with Spinnaker, ch. 4 (O'Reilly, 2019). https://oreilly.com/library/view/continuous-delivery-with/9781492035527/ch04.html
- NIST SP 800-53 Rev. 5, CM-3 and CM-4 (reference mirrors). https://csf.tools/reference/nist-sp-800-53/r4/cm/cm-3/ ;
  https://www.stigviewer.com/controls/nist-800-53/CM-4
- itsm.tools, "Change Enablement in ITIL 4" (2024). https://itsm.tools/change-enablement/
- AICPA TSC CC8.1: Cyberday summary https://www.cyberday.ai/requirement/soc-2-cc8-1-change-management-procedures ;
  KirkpatrickPrice, "Change Management Best Practices" https://kirkpatrickprice.com/video/soc-2-academy-change-management-best-practices/ ;
  Sprinto (2024) https://sprinto.com/blog/soc-2-change-management/ ;
  Hicomply https://hicomply.com/soc-2/soc-2-controls-change-management-cc8
- AWS Well-Architected, Agentic AI Lens, AGENTSEC04-BP02. https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentsec04-bp02.html
- Agent approval tiers and fatigue: Gravitee (2025) https://gravitee.io/corpus/gen-1371/outline-of-management/human-in-the-loop-approval-workflows-for-high-risk-ai-agent-actions-and-tool-calls.html ;
  Truto (2025) https://truto.one/blog/implementing-human-in-the-loop-approval-workflows-for-consequential-saas-api-actions/ ;
  Ou, C., "Human-in-the-loop agents" https://changkun.de/blog/ideas/human-in-the-loop-agents/ ;
  Pillar Security, "Human approval fatigue" https://www.pillar.security/sail/human-approval-fatigue-hitl-overload
