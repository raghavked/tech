/**
 * Approval gating for risky tool calls. Only humans vote. A deny by any eligible voter denies.
 */
import type { ApprovalPolicy, ApprovalRule, RiskClass, ToolCall } from "@fold/protocol";
import { ROLE_RANK } from "@fold/protocol";

export type Vote = "approve" | "deny";

export interface ApprovalRecord {
  id: string;
  call: ToolCall;
  votes: Record<string, Vote>;
  status: "pending" | "granted" | "denied";
  requestedSeq: number;
  turn: number;
}

export function ruleFor(policy: ApprovalPolicy, risk: RiskClass): ApprovalRule {
  return policy[risk] ?? "owner";
}

export function requiresApproval(policy: ApprovalPolicy, risk: RiskClass): boolean {
  return ruleFor(policy, risk) !== "none";
}

export function minimumRank(rule: ApprovalRule): number {
  if (rule === "none") return -1;
  if (typeof rule === "string") return ROLE_RANK[rule];
  return ROLE_RANK[rule.of];
}

export function requiredVotes(rule: ApprovalRule): number {
  if (rule === "none") return 0;
  if (typeof rule === "string") return 1;
  return rule.quorum;
}

/**
 * Evaluate votes against a rule. `rankOf` gives the effective rank of a voter; voters below the
 * minimum rank are ignored entirely.
 */
export function evaluate(
  rule: ApprovalRule,
  votes: Record<string, Vote>,
  rankOf: (actorId: string) => number,
): "pending" | "granted" | "denied" {
  if (rule === "none") return "granted";
  const min = minimumRank(rule);
  const eligible = Object.entries(votes).filter(([actor]) => rankOf(actor) >= min);
  if (eligible.some(([, v]) => v === "deny")) return "denied";
  const approvals = eligible.filter(([, v]) => v === "approve").length;
  return approvals >= requiredVotes(rule) ? "granted" : "pending";
}

export function describeRule(rule: ApprovalRule): string {
  if (rule === "none") return "no approval needed";
  if (typeof rule === "string") return `one ${rule} or above`;
  return `${rule.quorum} distinct ${rule.of}s or above`;
}
