# Open questions

Honest list of what we do not know yet, with how we intend to find out.

## Product

1. **Do teams want to steer together, or only watch and approve?** The demand signals are
   about shared visibility; concurrent steering may be rare. If so, contention handling
   matters less and briefs, approvals and replay matter more. Measure the directive mix in
   pilots.
2. **Is scope declaration too much to ask?** Picking `api` or `tests` before typing is
   friction. Default scope `goal` works, but then every disagreement is a goal contention and
   blocks. Try scope inference early.
3. **How long is "long"?** If most runs are under an hour, handoff is rare and the product is
   a live viewer with approvals. If overnight runs are common, handoff and the brief carry
   the product.
4. **Who pays: the engineering org or the platform or compliance org?** The audit story may
   sell before the collaboration story in regulated industries.

## Technical

5. **Arbitration policy granularity.** Should policy be per scope (block on `goal`,
   latest-wins on `style`)? The kernel supports a single policy today.
6. **Merging context, not just directives and files.** A journaled summariser is the plan;
   whether merged sessions stay coherent for the model is untested.
7. **Approval validity across forks and replays.** Does an approval on `main` at seq 40 hold
   on a branch forked at seq 30 that reaches the same action hash? Currently no (each branch
   has its own approval events); the right answer may depend on the risk class.
8. **Replay under a new model.** Replay never calls the model, so old logs stay valid; but
   *continuing* an old session with a new model changes behaviour. Version the runner and
   label turns with the model used (done) and decide how to surface drift.
9. **Scale of the log.** A week-long session with thousands of tool calls is megabytes of
   JSON per fold. Snapshots every k events and a JSONL tail are planned; the browser may need
   a lazy fold.
10. **Harness fidelity.** Adapters for Claude Agent SDK and LangGraph must map every tool call
    and approval to events; where a harness hides a step, the log has a hole. Decide what
    the minimum faithful mapping is before promising replay for third-party runs.

## Business

11. **Neutrality versus distribution.** The cross-vendor layer is the moat and also the
    thing first parties will not promote. Which harness vendor benefits enough to co-sell?
12. **Pricing unit.** Per seat punishes "anyone can drop in"; per session-hour punishes long
    runs, which are the point. A per-session base plus per-approver seats is the current
    guess.
