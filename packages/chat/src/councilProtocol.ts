/**
 * The council protocol: given a council's state, what happens next. Pure, so the host that
 * runs the rounds and the tests that check them share one brain. The only thing the chat log
 * does not know is the vote, which is the chair's plan ratings in its session; the host
 * passes it in.
 *
 * The walk: the round plan expands (a "discussion" entry stands for `discussionRounds`
 * rounds). Each deliberation round starts, then every member owes an answer; synthesis
 * starts, then the chair owes the plan; the vote starts, then the people decide. A revised
 * vote reopens synthesis with the next index. After the rounds, every step is assigned and
 * every owner reports; the council concludes when every step is done. The budget stops it
 * at any point.
 */
import { usageTotal } from "@henosis/protocol";
import type { Council, CouncilInstruction, CouncilRoundRecord, CouncilSaid } from "./council.js";
import {
  type CouncilMember,
  type CouncilOutcome,
  type CouncilRound,
  type CouncilStep,
  sameCouncilMember,
} from "./events.js";

export interface CouncilRoundRef {
  round: CouncilRound;
  index: number;
}

/** What the people said about the plan, as the chair's session knows it. */
export type CouncilVote = "pending" | "approved" | "revise" | "rejected";

export type CouncilNext =
  /** The council is over; nothing runs. */
  | { kind: "concluded"; outcome: CouncilOutcome }
  /** The host must conclude it: the budget is spent or the plan was rejected. */
  | { kind: "stop"; reason: "budget" | "rejected"; outcome: CouncilOutcome }
  /** Record `council.round.started` for this round. */
  | { kind: "start-round"; round: CouncilRound; index: number }
  /** A deliberation round is running; these members have not answered yet. */
  | { kind: "await-answers"; round: CouncilRound; index: number; owed: CouncilMember[] }
  /** The synthesis round is open: the chair's model writes the plan. */
  | { kind: "synthesise"; index: number }
  /** The plan is proposed; the people rate it. */
  | { kind: "await-vote"; planId: string }
  /** The vote asked for a revision: open the next synthesis round. */
  | { kind: "revise"; planId: string; index: number }
  /** The plan is approved; these steps have no session yet. */
  | { kind: "assign"; steps: CouncilStep[] }
  /** Every step is assigned; these have not reported done. */
  | { kind: "await-reports"; stepIds: string[]; blocked: string[] }
  /** Every step reported done (or there was no plan to work): conclude. */
  | { kind: "conclude"; outcome: "done" };

/** The rounds the plan stands for, in order: "discussion" repeats `discussionRounds` times. */
export function roundSequence(
  c: Pick<Council, "roundPlan" | "discussionRounds">,
): CouncilRoundRef[] {
  const out: CouncilRoundRef[] = [];
  const seen = new Set<CouncilRound>();
  for (const round of c.roundPlan) {
    if (seen.has(round)) continue;
    seen.add(round);
    const n = round === "discussion" ? c.discussionRounds : 1;
    for (let index = 0; index < n; index++) out.push({ round, index });
  }
  return out;
}

export function roundRecord(c: Council, ref: CouncilRoundRef): CouncilRoundRecord | undefined {
  return c.rounds.find((r) => r.round === ref.round && r.index === ref.index);
}

/** The latest record of a round kind (synthesis and vote can repeat after a revision). */
function latestRound(c: Council, round: CouncilRound): CouncilRoundRecord | undefined {
  let best: CouncilRoundRecord | undefined;
  for (const r of c.rounds) if (r.round === round && (!best || r.index > best.index)) best = r;
  return best;
}

/** Who answers in a deliberation round: every member model (the chair too when it is one). */
export function answerers(c: Pick<Council, "members">): CouncilMember[] {
  return c.members;
}

/** The members that have not spoken in this round yet. */
export function owedIn(c: Council, ref: CouncilRoundRef): CouncilMember[] {
  const r = roundRecord(c, ref);
  if (!r) return answerers(c);
  return answerers(c).filter((m) => !r.said.some((s) => sameCouncilMember(s.member, m)));
}

/** Everything said in the rounds before this one, oldest first: what a discussion reads. */
export function answersBefore(c: Council, ref: CouncilRoundRef): CouncilSaid[] {
  const r = roundRecord(c, ref);
  const cut = r ? r.startedSeq : Number.POSITIVE_INFINITY;
  const out: CouncilSaid[] = [];
  for (const round of c.rounds) for (const s of round.said) if (s.seq < cut) out.push(s);
  return out.sort((a, b) => a.seq - b.seq);
}

/** Everything every model said in every round, oldest first: what the chair synthesises. */
export function allAnswers(c: Council): CouncilSaid[] {
  const out: CouncilSaid[] = [];
  for (const round of c.rounds) out.push(...round.said);
  return out.sort((a, b) => a.seq - b.seq);
}

/** What a member last said, in any round. */
export function lastSaidBy(c: Council, member: CouncilMember): CouncilSaid | null {
  let best: CouncilSaid | null = null;
  for (const s of allAnswers(c)) if (sameCouncilMember(s.member, member)) best = s;
  return best;
}

/**
 * Instructions a person gave this member that the member has not cited yet: those recorded
 * after the member's last word in the council.
 */
export function pendingInstructions(c: Council, member: CouncilMember): CouncilInstruction[] {
  const last = lastSaidBy(c, member);
  const since = last ? last.seq : -1;
  return c.instructions.filter((i) => sameCouncilMember(i.member, member) && i.seq > since);
}

/** Is the budget spent? False when the council has none. */
export function budgetSpent(c: Pick<Council, "budget" | "usage">): boolean {
  return c.budget !== null && usageTotal(c.usage) >= c.budget;
}

/** What the council does next. */
export function councilNext(c: Council, vote: CouncilVote = "pending"): CouncilNext {
  if (c.status === "concluded") return { kind: "concluded", outcome: c.outcome ?? "abandoned" };
  if (budgetSpent(c)) return { kind: "stop", reason: "budget", outcome: "abandoned" };

  for (const ref of roundSequence(c)) {
    switch (ref.round) {
      case "individual":
      case "discussion": {
        const r = roundRecord(c, ref);
        if (!r) return { kind: "start-round", round: ref.round, index: ref.index };
        const owed = owedIn(c, ref);
        if (owed.length) return { kind: "await-answers", round: ref.round, index: ref.index, owed };
        break;
      }
      case "synthesis": {
        const r = latestRound(c, "synthesis");
        if (!r) return { kind: "start-round", round: "synthesis", index: 0 };
        if (!c.synthesis || c.synthesis.seq < r.startedSeq)
          return { kind: "synthesise", index: r.index };
        break;
      }
      case "vote": {
        if (!c.synthesis) break; // nothing to rate: a plan without a synthesis round
        const r = latestRound(c, "vote");
        if (!r || r.startedSeq < c.synthesis.seq)
          return { kind: "start-round", round: "vote", index: r ? r.index + 1 : 0 };
        if (vote === "pending") return { kind: "await-vote", planId: c.synthesis.planId };
        if (vote === "rejected") return { kind: "stop", reason: "rejected", outcome: "abandoned" };
        if (vote === "revise") {
          const s = latestRound(c, "synthesis");
          return { kind: "revise", planId: c.synthesis.planId, index: s ? s.index + 1 : 0 };
        }
        break;
      }
    }
  }

  if (!c.synthesis) return { kind: "conclude", outcome: "done" };
  const unassigned = c.synthesis.steps.filter((s) => !c.assignments[s.id]);
  if (unassigned.length) return { kind: "assign", steps: unassigned };
  const owed = c.synthesis.steps.filter((s) => c.reports[s.id]?.status !== "done");
  if (owed.length)
    return {
      kind: "await-reports",
      stepIds: owed.map((s) => s.id),
      blocked: owed.filter((s) => c.reports[s.id]?.status === "blocked").map((s) => s.id),
    };
  return { kind: "conclude", outcome: "done" };
}

/** True when the chair's model may write (or rewrite) the plan now. */
export function synthesisMayRun(c: Council, vote: CouncilVote = "pending"): boolean {
  return councilNext(c, vote).kind === "synthesise";
}

/** The round the council is in now, or null before the first and after the last. */
export function currentRound(c: Council): CouncilRoundRef | null {
  const r = c.rounds[c.rounds.length - 1];
  return r ? { round: r.round, index: r.index } : null;
}

/**
 * A short label for the rail: "discussion 1 of 1", "synthesis", "vote", "working 2 of 3",
 * "concluded: done".
 */
export function councilLabel(c: Council): string {
  if (c.status === "concluded") return `concluded: ${c.outcome ?? "abandoned"}`;
  if (c.status === "working") {
    const done = c.synthesis
      ? c.synthesis.steps.filter((s) => c.reports[s.id]?.status === "done").length
      : 0;
    return `working ${done} of ${c.synthesis?.steps.length ?? 0}`;
  }
  const cur = currentRound(c);
  if (!cur) return "convened";
  if (cur.round === "discussion") return `discussion ${cur.index + 1} of ${c.discussionRounds}`;
  return cur.round;
}
