# Approval economics: ratings, votes, risk classes and enterprise change control

*Research memo, 19 October 2026. What is established is cited with a date; what is ours
is marked as inference. Repo files referenced: `docs/19_council.md`,
`docs/13_fleet_collaboration.md`, `docs/18_editions.md`, `packages/kernel/src/plans.ts`,
`packages/protocol/src/index.ts`.*

## The question

Henosis asks people to rate an agent's plan 1..5 and lets a policy approve it when enough
raters average high enough (`planApprovalMet` in `plans.ts`: `count >= min && average >=
average`, default `{min: 1, average: 3}`). Tool calls are classed `read | write | exec |
external | irreversible`, and the irreversible class defaults to a release gate of two
contributors averaging 4 or more, where any deny still denies. The council (`19_council.md`)
reuses the same ratings as its vote. This memo asks whether that shape is defensible against
what is known about ratings versus votes, how CI/CD products gate releases, and what SOC 2
and NIST auditors expect from change control, and then what to change.

## Ratings versus votes

**Established.** Bargagliotti and Li (Decision Sciences, December 2013; working paper 2009)
compared binary approve/reject systems with N-point scales and showed the two agree for an
individual rater only when N is odd and N-1 is not divisible by 4 (so 3, 7 and 11 points
qualify; 5 does not), and that once ratings are aggregated the two systems can reach
different decisions for any N. A five-point scale with a threshold is therefore not a
vote in disguise; it is a different decision procedure that can approve what a majority
would reject and vice versa.

**Established (practitioner).** Husain's evals FAQ (2025) argues for binary pass/fail over
1..5 Likert labels because the gap between adjacent points is subjective across annotators
and people default to the middle to avoid a hard call. That is the "3" problem: a rater who
is unsure clicks 3, and in Henosis 3 is the default bar.

**Our inference.** Ratings are the better instrument for *confidence* and the worse one for
*authorisation*. The release-gate rule already knows this: it composes a count, a floor on
the average and an unconditional deny. The plan rule has the count and the average but no
deny and no per-rater floor (`of` is absent from `planApproval`), so one 5 and one 1 average
3 and pass at the default. Approval should be decided by a vote-like predicate (nobody
below a floor, nobody with the right to deny has denied), with the average kept as a
displayed confidence and a budget signal, not as the thing that opens the gate.

## Risk classes

**Established.** ITIL 4 "change enablement" distinguishes standard (pre-authorised,
low-risk, templated), normal (assessed and authorised per change) and emergency (approval
accelerated, not skipped, and documented after) changes (itsm.tools summary, 2024). NIST SP
800-53 CM-3 requires that an organisation determine which changes are configuration
controlled, review them "with explicit consideration for security impact analyses",
document the decision, and retain the records; CM-4 is the impact analysis that feeds
that decision (csf.tools reference, Rev. 4/5). Vendor designs for agent tool calls converge
on the same ladder: read-only auto-executes, scoped writes auto-execute for trusted
principals, destructive or external actions always need a human (Maxim, 2025; Gravitee,
2025). Several 2025 security write-ups name approval fatigue as a vulnerability rather than
a UX complaint: reviewers under load stop reading arguments, and "always allow" choices
accumulate into an unreviewed policy (changkun.de; Pillar Security; truefoundry).

**Our inference.** Henosis's five classes map cleanly: `read` and `write` are standard
changes, `exec` and `external` are normal changes with a named approver, `irreversible` is
the change that needs a board, and the plan is the impact analysis CM-4 asks for. What is
missing is the emergency path: an owner's `plan.decide` is the equivalent of a bypass, and
auditors accept bypasses only with a recorded reason and a retrospective review. The
`note` field exists; it is optional.

## Release gates in CI/CD

**Established.** GitHub deployment environments let an admin name required reviewers (up to
six users or teams, any one approval suffices), a wait timer, and branch restrictions; a job
that references the environment waits and cannot read its secrets until every rule passes,
an unapproved job fails after 30 days, and admins may bypass rules (GitHub docs, Enterprise
Server 3.8 and later, 2023-2025). Branch protection separately offers "dismiss stale
approvals when the diff changes", required code-owner review, and "the most recent push must
be approved by someone other than its author" (GitHub docs, current). Spinnaker's Manual
Judgment stage pauses a pipeline until a person answers, can branch on the answer
("continue" or "rollback"), and can propagate the approver's credentials to later stages
(spinnaker.io codelab; O'Reilly, 2019). DORA's 2019 report found heavyweight external
approval (a CAB or a senior sign-off) hurt speed and stability and was not associated with
lower change-failure rates, while a clearly understood change process helped; its
recommendation is peer review during development plus automation (dora.dev, 2019).

**Our inference.** Three gate properties recur across products and Henosis lacks all three.
First, staleness: GitHub ties an approval to a diff hash; a Henosis rating is tied to a
`planId`, which is right, but a rated plan whose steps are edited by a revise cycle gets a
new id and silently drops the ratings, with no record that the raters were asked again.
Second, self-review: nothing stops the driver who set the goal from being the single rater
who meets `min: 1`. Third, credentials: Spinnaker lets an approval carry the approver's
authority forward; the credential-broker design (`18_editions.md`, Enterprise) is the same
idea and the plan approval is where it should attach.

## SOC 2 change management

**Established.** Trust Services Criterion CC8.1 (AICPA, 2017 criteria, 2022 points of
focus) requires that the entity authorise, design, develop or acquire, configure, document,
test, approve and implement changes to infrastructure, data, software and procedures;
points of focus are guidance, not requirements, and the 2022 revision did not alter the
criteria (RSI Security and Linford summaries, 2023). Auditor practice, as described by
compliance vendors (Sprinto, Hicomply, 2024), is to sample changes in the period and ask for
evidence that each was reviewed, approved and tested before production, with emergency
changes documented and approved retrospectively.

**Our inference.** A SOC 2 sample of Henosis changes is a sample of plan and gate events.
The questions an auditor asks map one to one: who authorised (the `plan.proposed` and the
raters), was it tested (the step's `actualTokens` and the tool results between start and
done), who approved before production (the `irreversible` gate's ballots), who bypassed and
why (`decidedBy` with a `note`). The log answers all of them today except the last, where
the note is optional, and except the segregation question, where the rater may also be the
author of the goal.

## Plan-first with rating thresholds as change control

Plan-first is the normal-change form: the plan is the request for change, the steps' risk
classes are the impact analysis, the rating is the assessment, the policy is the change
authority, and the gate before the irreversible step is the deployment approval. What
enterprise change control adds, and the kernel does not yet express, is (a) a per-class
approval rule for plans rather than one threshold for all plans, so a plan that contains an
irreversible step needs the same raters the step will need, (b) a recorded reason for every
bypass, (c) a rule that the goal's author does not count toward the quorum, and (d) ratings
that survive a revise only when the raters re-affirm them. DORA's evidence says do not add
a board; keep the raters the peers in the session, make the policy fast, and make the record
complete.

## What this changes for Henosis

- `packages/protocol/src/index.ts`: extend `planApproval` with `of: Role`, a `floor`
  (no rating below it counts as approving) and `excludeAuthor: boolean`; `planApprovalMet`
  in `packages/kernel/src/plans.ts` then checks count of approving raters, average, floor and
  author exclusion, so one 5 and one 1 no longer pass.
- `packages/kernel/src/plans.ts`: make the `note` on `plan.decide` required when the
  deciding actor is not `policy`, and emit the decision as a bypass with a reason; the
  Enterprise policy packs in `docs/18_editions.md` can then forbid bypass per risk class.
- `apps/web/src/stream/PlanCard.tsx` and the Slack plan message: when a plan is superseded,
  carry the previous raters forward as "rated the earlier version" chips and ask them to
  re-rate, the stale-approval rule; show the author's rating as a chip that does not count.
- `docs/19_council.md`: the council vote should use a per-plan rule derived from the highest
  risk class among its steps, not the session default, so a council whose synthesis
  includes an `irreversible` step convenes the release-gate quorum at vote time rather than
  stalling at the step later; record the dissent beside the ballots in the same event.
- `docs/13_fleet_collaboration.md`, the glance and the inbox: rank what-needs-you by risk
  class and age (the glance already does) and cap per-call prompts by auto-approving
  `write` inside an approved plan, which is the fatigue defence the 2025 security
  write-ups recommend; add an approve-to-deny ratio per person to the audit view
  (`18_editions.md`, Team evidence) so a rubber-stamping rater is visible.

## Sources

- Bargagliotti, A. E. and Li, L., "Decision Making Using Rating Systems: When Scale Meets
  Binary", Decision Sciences 44(6), Dec 2013. https://digitalcommons.lmu.edu/math_fac/130 ;
  working paper (2009) https://mpra.ub.uni-muenchen.de/16947/
- Husain, H., "Why do you recommend binary (pass/fail) evaluations instead of 1-5 ratings?",
  2025. https://hamel.dev/blog/posts/evals-faq/why-do-you-recommend-binary-passfail-evaluations-instead-of-1-5-ratings-likert-scales.html
- DORA, "2019 Accelerate State of DevOps Report". https://dora.dev/publications/pdf/state-of-devops-2019.pdf ;
  capability page "Streamlining change approval". https://dora.dev/capabilities/streamlining-change-approval/
- GitHub Docs, "Using environments for deployment" (Enterprise Server 3.8).
  https://docs.github.com/en/enterprise-server@3.8/actions/deployment/targeting-different-environments/using-environments-for-deployment ;
  "Reviewing deployments". https://docs.github.com/en/enterprise-server@3.8/actions/managing-workflow-runs/reviewing-deployments ;
  "About protected branches". https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- Spinnaker, "Safe Deployments" codelab (Manual Judgment).
  https://spinnaker.io/docs/guides/tutorials/codelabs/safe-deployments/ ; Netflix, Continuous
  Delivery with Spinnaker, ch. 4 (O'Reilly, 2019). https://oreilly.com/library/view/continuous-delivery-with/9781492035527/ch04.html
- NIST SP 800-53 CM-3 Configuration Change Control (reference text).
  https://csf.tools/reference/nist-sp-800-53/r4/cm/cm-3/
- itsm.tools, "Change Enablement in ITIL 4" (2024). https://itsm.tools/change-enablement/
- AICPA TSC CC8.1 summaries: RSI Security, "What are the AICPA Trust Services Criteria?"
  https://blog.rsisecurity.com/what-are-the-aicpa-trust-services-criteria/ ; Linford & Co.
  https://linfordco.com/?p=3919 ; AICPA 2019 redline PDF
  https://www.aicpa.org/content/dam/aicpa/interestareas/frc/assuranceadvisoryservices/downloadabledocuments/trust-services-criteria-redline-2019.pdf
- SOC 2 change-management auditor practice: Sprinto (2024) https://sprinto.com/blog/soc-2-change-management/ ;
  Hicomply https://hicomply.com/soc-2/soc-2-controls-change-management-cc8
- Agent approval tiers and fatigue: Maxim, "Manual Approval vs Autonomous Tool Execution"
  (2025) https://getmaxim.ai/articles/manual-approval-vs-autonomous-tool-execution-designing-safe-ai-agent-loops/ ;
  Gravitee (2025) https://gravitee.io/corpus/gen-1371/outline-of-management/human-in-the-loop-approval-workflows-for-high-risk-ai-agent-actions-and-tool-calls.html ;
  Ou, C., "Human-in-the-loop agents" https://changkun.de/blog/ideas/human-in-the-loop-agents/ ;
  Pillar Security, "Human approval fatigue" https://www.pillar.security/sail/human-approval-fatigue-hitl-overload ;
  TrueFoundry, "MCP tool approval" https://www.truefoundry.com/blog/mcp-tool-approval-human-gate-call-path
