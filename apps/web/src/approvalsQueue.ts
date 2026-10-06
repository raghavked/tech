/**
 * The approvals queue, pure: which sessions have something to approve, what each pending
 * approval needs, and how the keyboard cursor moves. The view in views/Approvals.tsx joins
 * the sessions over the websocket and renders what these functions compute.
 */
import {
  type ApprovalRecord,
  describeRule,
  isRatingsRule,
  minimumRank,
  rankOf,
  requiredVotes,
  ruleFor,
  type SessionState,
} from "@henosis/kernel";
import type { RiskClass } from "@henosis/protocol";
import type { SessionRow } from "./api.js";
import { describeCall } from "./calls.js";
import { copy } from "./copy.js";

/** The rating a plain Approve carries under a release gate when the person picked none. */
export const DEFAULT_RATING = 4;

/**
 * A release gate's progress: rated approvals from eligible voters against the rule's minimum,
 * with their average; null when the rule is not a ratings rule.
 */
export function ratingProgress(
  s: SessionState,
  a: ApprovalRecord,
): { count: number; min: number; average: number; bar: number } | null {
  const rule = ruleFor(s.policy.approvals, a.call.risk);
  if (!isRatingsRule(rule)) return null;
  const min = minimumRank(rule);
  const rated = Object.entries(a.ballots)
    .filter(([id, b]) => b.vote === "approve" && b.rating !== null && rankOf(s, id) >= min)
    .map(([, b]) => b.rating ?? 0);
  const average = rated.length ? rated.reduce((n, v) => n + v, 0) / rated.length : 0;
  return { count: rated.length, min: rule.ratings.min, average, bar: rule.ratings.average };
}

/** Approvals a listed session is waiting on, from the live status first and the report after. */
export function pendingOf(row: Pick<SessionRow, "open" | "live" | "report">): number {
  if (!row.open) return 0;
  const reported = row.report?.pendingApprovals ?? 0;
  if (row.live === "awaiting_approval") return Math.max(1, reported);
  if (row.live) return 0;
  return reported;
}

export interface QueueRow {
  /** `${projectId}/${sessionId}/${approvalId}` */
  key: string;
  projectId: string;
  projectName: string;
  sessionId: string;
  sessionTitle: string;
  approvalId: string;
  agentName: string;
  action: string;
  risk: RiskClass;
  status: ApprovalRecord["status"];
  approvedBy: string[];
  deniedBy: string[];
  /** "one driver or above", "1 more driver or above", "nothing" */
  needs: string;
  myVote: "approve" | "deny" | null;
  /** A release gate: Approve carries a rating; `progress` is "1 of 2 raters · 3 average". */
  ratings: boolean;
  progress: string | null;
  myRating: number | null;
  requestedSeq: number;
}

/** What an approval still needs, counting only votes the rule can see. */
export function needsOf(s: SessionState, a: ApprovalRecord): string {
  const rule = ruleFor(s.policy.approvals, a.call.risk);
  if (rule === "none") return "nothing";
  const gate = ratingProgress(s, a);
  if (gate && isRatingsRule(rule)) {
    if (gate.count === 0) return describeRule(rule);
    if (gate.count < gate.min) {
      const left = gate.min - gate.count;
      return `${left} more rating${left === 1 ? "" : "s"} from ${rule.ratings.of}s or above`;
    }
    return `an average of ${gate.bar}+`;
  }
  const min = minimumRank(rule);
  const have = Object.entries(a.votes).filter(
    ([id, v]) => v === "approve" && rankOf(s, id) >= min,
  ).length;
  const want = requiredVotes(rule);
  if (have === 0) return describeRule(rule);
  const left = Math.max(1, want - have);
  const of = typeof rule === "string" ? rule : "ratings" in rule ? rule.ratings.of : rule.of;
  return `${left} more ${of}${left === 1 ? "" : "s"} or above`;
}

export function rowsOf(
  s: SessionState,
  meta: { projectId: string; projectName: string; fallbackTitle: string },
  meId: string,
): QueueRow[] {
  const name = (id: string) => (id === meId ? "you" : (s.participants[id]?.actor.name ?? id));
  const agent = Object.values(s.participants).find((p) => p.actor.kind === "agent");
  const sessionTitle = s.title || meta.fallbackTitle || s.sessionId;
  return Object.values(s.approvals).map((a) => {
    const votes = Object.entries(a.votes);
    const gate = ratingProgress(s, a);
    return {
      key: `${meta.projectId}/${s.sessionId}/${a.id}`,
      projectId: meta.projectId,
      projectName: meta.projectName,
      sessionId: s.sessionId,
      sessionTitle,
      approvalId: a.id,
      agentName: agent?.actor.name ?? "Agent",
      action: describeCall(a.call).ask,
      risk: a.call.risk,
      status: a.status,
      approvedBy: votes.filter(([, v]) => v === "approve").map(([id]) => name(id)),
      deniedBy: votes.filter(([, v]) => v === "deny").map(([id]) => name(id)),
      needs: a.status === "pending" ? needsOf(s, a) : "nothing",
      myVote: a.votes[meId] ?? null,
      ratings: gate !== null,
      progress: gate ? copy.approval.progress(gate.count, gate.min, gate.average) : null,
      myRating: a.ballots[meId]?.rating ?? null,
      requestedSeq: a.requestedSeq,
    };
  });
}

/** Oldest first, so the row that has waited longest is at the top. */
export function sortRows(rows: QueueRow[]): QueueRow[] {
  return [...rows].sort(
    (a, b) =>
      a.projectName.localeCompare(b.projectName) ||
      a.sessionTitle.localeCompare(b.sessionTitle) ||
      a.requestedSeq - b.requestedSeq,
  );
}

/** The next cursor key after a j/k press; stays put at either end, picks the first when lost. */
export function moveCursor(keys: string[], current: string | null, delta: 1 | -1): string | null {
  if (keys.length === 0) return null;
  const at = current ? keys.indexOf(current) : -1;
  if (at < 0) return keys[0] ?? null;
  const next = Math.min(keys.length - 1, Math.max(0, at + delta));
  return keys[next] ?? null;
}

/** Keys that the queue listens to, unless the person is typing somewhere. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
