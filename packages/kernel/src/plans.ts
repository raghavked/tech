/**
 * Plan first. Before it acts, the agent proposes a plan: steps with token estimates and a
 * risk class each. The people in the session rate it 1..5; the fold approves it when the
 * policy's bar is met, an owner or the driver can decide it outright, and while it waits
 * every tool call above `read` is refused. The plan is the budget: each step records the
 * tokens it actually took, so the estimate and the spend sit side by side.
 */
import type { PlanStatus, RiskClass, SessionPolicy, ToolCall, Usage } from "@henosis/protocol";
import type { SessionState } from "./state.js";

export interface PlanStepRecord {
  id: string;
  title: string;
  detail: string;
  estTokens: number;
  risk: RiskClass;
  status: "pending" | "running" | "done";
  /** Tokens the session spent between this step starting and completing. */
  actualTokens: number;
  /** The session's token total when the step started; the completion computes actuals from it. */
  startedTokens: number;
  startedTurn: number | null;
  note: string;
}

export interface PlanRating {
  rating: number;
  note: string;
  seq: number;
}

export interface PlanRecord {
  id: string;
  turn: number;
  goal: string;
  steps: PlanStepRecord[];
  estTokens: number;
  rationale: string;
  /** One rating per human, the latest wins. */
  ratings: Record<string, PlanRating>;
  status: PlanStatus;
  /** "policy" when the ratings met the bar; otherwise the deciding actor; null while proposed. */
  decidedBy: string | null;
  note: string;
  proposedSeq: number;
  /** A later proposal replaced this one; it is kept for the record. */
  supersededBy: string | null;
}

/** The tool result the model reads when it acts before the plan is approved. */
export const PLAN_NOT_APPROVED = "the plan is not approved yet; wait or revise";

export function totalTokens(u: Usage): number {
  return u.input + u.output + u.cacheRead + u.cacheWrite;
}

/** How many people rated the plan and what they averaged (0 when nobody has). */
export function ratingSummary(plan: Pick<PlanRecord, "ratings">): {
  count: number;
  average: number;
} {
  const values = Object.values(plan.ratings).map((r) => r.rating);
  if (values.length === 0) return { count: 0, average: 0 };
  const sum = values.reduce((n, v) => n + v, 0);
  return { count: values.length, average: Math.round((sum / values.length) * 100) / 100 };
}

/** True when enough people rated the plan highly enough for the policy. */
export function planApprovalMet(
  policy: SessionPolicy["planApproval"],
  plan: Pick<PlanRecord, "ratings">,
): boolean {
  const { count, average } = ratingSummary(plan);
  return count >= policy.min && average >= policy.average;
}

export function planActualTokens(plan: Pick<PlanRecord, "steps">): number {
  return plan.steps.reduce((n, s) => n + s.actualTokens, 0);
}

/** The plan the session is on, whatever its status; null before the first proposal. */
export function activePlan(state: SessionState): PlanRecord | null {
  return state.activePlanId ? (state.plans[state.activePlanId] ?? null) : null;
}

/** The active plan when it was proposed for the goal the session has now; a changed goal needs a new plan. */
export function planForGoal(state: SessionState): PlanRecord | null {
  const plan = activePlan(state);
  const goal = state.intent.goal?.text ?? null;
  return plan && goal !== null && plan.goal === goal ? plan : null;
}

/** True while a plan-first session has a proposed plan the team has not yet rated through. */
export function planWaiting(state: SessionState): boolean {
  return state.policy.planFirst && planForGoal(state)?.status === "proposed";
}

/** True when a plan-first session has no plan for its goal, or was asked to revise or start over. */
export function planNeeded(state: SessionState): boolean {
  if (!state.policy.planFirst || !state.intent.goal) return false;
  const plan = planForGoal(state);
  return !plan || plan.status === "revise" || plan.status === "rejected";
}

/**
 * The plan-first gate. When the policy asks for a plan, any tool call that could change
 * something is refused until the active plan for the current goal is approved. Reads pass.
 */
export function gateForCall(
  state: SessionState,
  call: ToolCall,
): { ok: true } | { ok: false; reason: string } {
  if (!state.policy.planFirst || call.risk === "read") return { ok: true };
  const plan = planForGoal(state);
  if (plan?.status === "approved") return { ok: true };
  return { ok: false, reason: PLAN_NOT_APPROVED };
}
