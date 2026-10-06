/**
 * Approval gating for risky tool calls. Only humans vote. A deny by any eligible voter denies.
 */
import type { ApprovalPolicy, ApprovalRule, RiskClass, Role, ToolCall } from "@henosis/protocol";
import { ROLE_RANK } from "@henosis/protocol";

export type Vote = "approve" | "deny";
export interface VoteRecord {
  vote: Vote;
  rating: number | null;
  note: string;
}

export interface ApprovalRecord {
  id: string;
  call: ToolCall;
  votes: Record<string, Vote>;
  /** The same votes with their ratings and notes; `votes` stays for older readers. */
  ballots: Record<string, VoteRecord>;
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
  if ("ratings" in rule) return ROLE_RANK[rule.ratings.of];
  return ROLE_RANK[rule.of];
}

export function requiredVotes(rule: ApprovalRule): number {
  if (rule === "none") return 0;
  if (typeof rule === "string") return 1;
  if ("ratings" in rule) return rule.ratings.min;
  return rule.quorum;
}

/** True for a release gate: approvals must carry ratings and their average must clear a bar. */
export function isRatingsRule(
  rule: ApprovalRule,
): rule is { ratings: { min: number; average: number; of: Role } } {
  return typeof rule === "object" && "ratings" in rule;
}

/**
 * Evaluate votes against a rule. `rankOf` gives the effective rank of a voter; voters below the
 * minimum rank are ignored entirely.
 */
export function evaluate(
  rule: ApprovalRule,
  votes: Record<string, Vote | VoteRecord>,
  rankOf: (actorId: string) => number,
): "pending" | "granted" | "denied" {
  if (rule === "none") return "granted";
  const min = minimumRank(rule);
  const eligible = Object.entries(votes)
    .filter(([actor]) => rankOf(actor) >= min)
    .map(
      ([actor, v]) =>
        [actor, typeof v === "string" ? { vote: v, rating: null, note: "" } : v] as const,
    );
  if (eligible.some(([, v]) => v.vote === "deny")) return "denied";
  const approvals = eligible.filter(([, v]) => v.vote === "approve");
  if (isRatingsRule(rule)) {
    // Only rated approvals count toward a release gate; an unrated approve is a voice, not a vote.
    const rated = approvals.filter(([, v]) => v.rating !== null);
    if (rated.length < rule.ratings.min) return "pending";
    const avg = rated.reduce((n, [, v]) => n + (v.rating ?? 0), 0) / rated.length;
    return avg >= rule.ratings.average ? "granted" : "pending";
  }
  return approvals.length >= requiredVotes(rule) ? "granted" : "pending";
}

export function describeRule(rule: ApprovalRule): string {
  if (rule === "none") return "no approval needed";
  if (typeof rule === "string") return `one ${rule} or above`;
  if (isRatingsRule(rule))
    return `${rule.ratings.min} ${rule.ratings.of}s or above rating it ${rule.ratings.average}+ of 5 on average`;
  return `${rule.quorum} distinct ${rule.of}s or above`;
}
