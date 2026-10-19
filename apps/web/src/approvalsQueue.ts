/**
 * The approvals queue, pure: which sessions have something to approve, what each pending
 * approval needs, which row state it is in, how the filters cut the list, and how the
 * keyboard cursor moves. The view in views/Approvals.tsx joins the sessions over the
 * websocket and renders what these functions compute.
 */
import {
  type ApprovalRecord,
  canOverride,
  describeRule,
  isRatingsRule,
  minimumRank,
  type OwnerOverride,
  ownerOverride,
  rankOf,
  requiredVotes,
  ruleFor,
  type SessionState,
} from "@henosis/kernel";
import type { RiskClass } from "@henosis/protocol";
import type { SessionRow } from "./api.js";
import { describeCall } from "./calls.js";
import { average, copy, numberWords } from "./copy.js";
import { isTyping } from "./shortcuts.js";

/** The rating a plain Approve carries under a release gate when the person picked none: one value for the app and Slack. */
export { DEFAULT_RATING } from "@henosis/protocol";
export { isTyping };

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

export type RowState = "needs-you" | "exec" | "voted" | "driver-only" | "low" | "done";

export interface Vote {
  who: string;
  vote: "approve" | "deny";
  rating: number | null;
  note: string;
  override: boolean;
}

export interface QueueRow {
  /** `${projectId}/${sessionId}/${approvalId}` */
  key: string;
  projectId: string;
  projectName: string;
  sessionId: string;
  sessionTitle: string;
  approvalId: string;
  /** "Ana's agent": named after its owner, whose initials the avatar wears. */
  agentName: string;
  ownerName: string | null;
  /** The verb phrase of the sentence ("run `pnpm test`"); `code` is the part set in mono. */
  action: string;
  code: string | null;
  risk: RiskClass;
  irreversible: boolean;
  status: ApprovalRecord["status"];
  votes: Vote[];
  approvedBy: string[];
  deniedBy: string[];
  /** "one driver or above", "1 more driver or above", "nothing" */
  needs: string;
  myVote: "approve" | "deny" | null;
  myRating: number | null;
  /** My rank in the session against the rule's floor: below it the row waits for someone else. */
  myRank: number;
  minRank: number;
  canDecide: boolean;
  /** The role word the rule waits for ("driver") and who holds it, for "waits for the driver · Cy". */
  waitsFor: { role: string; who: string | null };
  /** Decision 3: present only when the policy returns an override for this risk class and I may use it. */
  override: OwnerOverride | null;
  /** A release gate: Approve carries a rating; `quorum` is the meter's state. */
  ratings: boolean;
  quorum: { count: number; min: number; average: number; bar: number; low: boolean } | null;
  /** The mono age: the turn the call was made on; the kernel keeps a logical clock. */
  turn: number;
  requestedSeq: number;
}

/** The action split into its words and its mono part: "run `pnpm test`" → ["run ", code, ""]. */
export function askParts(ask: string): { text: string; code?: string }[] {
  const out: { text: string; code?: string }[] = [];
  const re = /`([^`]+)`/g;
  let last = 0;
  for (const m of ask.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: ask.slice(last, at) });
    out.push({ text: m[1] ?? "", code: m[1] ?? "" });
    last = at + m[0].length;
  }
  if (last < ask.length) out.push({ text: ask.slice(last) });
  return out;
}

/** What an approval still needs, counting only votes the rule can see. */
export function needsOf(s: SessionState, a: ApprovalRecord): string {
  const rule = ruleFor(s.policy.approvals, a.call.risk);
  if (rule === "none") return "nothing";
  const gate = ratingProgress(s, a);
  if (gate && isRatingsRule(rule)) {
    if (gate.count === 0) return `needs ${gate.min} at ${average(gate.bar)}+`;
    if (gate.count < gate.min) {
      const left = gate.min - gate.count;
      return `needs ${left === 1 ? "one" : left} more at ${average(gate.bar)}+`;
    }
    return `needs an average of ${average(gate.bar)}+`;
  }
  const min = minimumRank(rule);
  const have = Object.entries(a.votes).filter(
    ([id, v]) => v === "approve" && rankOf(s, id) >= min,
  ).length;
  const want = requiredVotes(rule);
  const of = typeof rule === "string" ? rule : "ratings" in rule ? rule.ratings.of : rule.of;
  if (have === 0) return typeof rule === "string" ? `needs a ${of}` : `needs ${describeRule(rule)}`;
  const left = Math.max(1, want - have);
  return `needs ${left === 1 ? "one" : left} more ${of}${left === 1 ? "" : "s"}`;
}

export function rowsOf(
  s: SessionState,
  meta: { projectId: string; projectName: string; fallbackTitle: string },
  meId: string,
): QueueRow[] {
  const name = (id: string) => (id === meId ? "you" : (s.participants[id]?.actor.name ?? id));
  const owner = s.ownerId ? s.participants[s.ownerId] : undefined;
  const agent = Object.values(s.participants).find((p) => p.actor.kind === "agent");
  const agentName = owner
    ? `${owner.actor.id === meId ? "Your" : `${owner.actor.name}'s`} agent`
    : (agent?.actor.name ?? "The agent");
  const sessionTitle = s.title || meta.fallbackTitle || s.sessionId;
  const myRank = rankOf(s, meId);
  const driverName = s.driver ? name(s.driver) : null;
  return Object.values(s.approvals).map((a) => {
    const rule = ruleFor(s.policy.approvals, a.call.risk);
    const minRank = minimumRank(rule);
    const gate = ratingProgress(s, a);
    const words = describeCall(a.call);
    const code = words.ask.match(/`([^`]+)`/)?.[1] ?? null;
    const votes: Vote[] = Object.entries(a.ballots).map(([id, b]) => ({
      who: name(id),
      vote: b.vote,
      rating: b.rating,
      note: b.note,
      override: Boolean(b.override),
    }));
    const of = typeof rule === "string" ? rule : "ratings" in rule ? rule.ratings.of : rule.of;
    const mine = a.ballots[meId];
    const pending = a.status === "pending";
    const canDecide = pending && myRank >= minRank && rule !== "none";
    const ov =
      pending && canOverride(myRank) ? ownerOverride(s.policy.approvals, a.call.risk) : null;
    return {
      key: `${meta.projectId}/${s.sessionId}/${a.id}`,
      projectId: meta.projectId,
      projectName: meta.projectName,
      sessionId: s.sessionId,
      sessionTitle,
      approvalId: a.id,
      agentName,
      ownerName: owner ? owner.actor.name : null,
      action: words.ask,
      code,
      risk: a.call.risk,
      irreversible: a.call.risk === "irreversible",
      status: a.status,
      votes,
      approvedBy: votes.filter((v) => v.vote === "approve").map((v) => v.who),
      deniedBy: votes.filter((v) => v.vote === "deny").map((v) => v.who),
      needs: pending ? needsOf(s, a) : "nothing",
      myVote: mine?.vote ?? a.votes[meId] ?? null,
      myRating: mine?.rating ?? null,
      myRank,
      minRank,
      canDecide,
      waitsFor: {
        role: rule === "none" ? "nobody" : of,
        who:
          of === "driver"
            ? driverName
            : of === "owner"
              ? owner
                ? name(owner.actor.id)
                : null
              : null,
      },
      override: ov && mine?.vote !== "approve" ? ov : null,
      ratings: gate !== null,
      quorum: gate ? { ...gate, low: gate.count > 0 && gate.average < gate.bar } : null,
      turn: a.turn,
      requestedSeq: a.requestedSeq,
    };
  });
}

/** The one state a row is in, for the five drawn states of the list. */
export function rowState(r: QueueRow): RowState {
  if (r.status !== "pending") return "done";
  if (r.myVote) return "voted";
  if (!r.canDecide) return "driver-only";
  if (r.quorum?.low) return "low";
  if (!r.ratings && r.votes.length === 0) return "exec";
  return "needs-you";
}

export type QueueFilter = "needs-you" | "gates" | "others" | "all";

/** Needs you: pending rows my vote can still move; Gates: ratings rules; Others: the rest. */
export function filterRows(rows: QueueRow[], filter: QueueFilter): QueueRow[] {
  switch (filter) {
    case "needs-you":
      return rows.filter((r) => !r.myVote && (r.canDecide || r.override !== null));
    case "gates":
      return rows.filter((r) => r.ratings);
    case "others":
      return rows.filter((r) => !r.ratings);
    default:
      return rows;
  }
}

export function countsOf(rows: QueueRow[]): Record<QueueFilter, number> {
  return {
    "needs-you": filterRows(rows, "needs-you").length,
    gates: filterRows(rows, "gates").length,
    others: filterRows(rows, "others").length,
    all: rows.length,
  };
}

const numberWord = numberWords;

/** The lede: "Five approvals waiting in four sessions across two projects. Two are release gates; one waits for Cy." */
export function ledeOf(pending: QueueRow[]): { sentence: string; emphasis: string; rest: string } {
  const n = pending.length;
  if (n === 0) return { sentence: copy.queue.nothing, emphasis: "", rest: "" };
  const sessions = new Set(pending.map((r) => `${r.projectId}/${r.sessionId}`)).size;
  const projects = new Set(pending.map((r) => r.projectId)).size;
  const sentence = `${numberWord(n, true)} approval${n === 1 ? "" : "s"} waiting in ${numberWord(sessions)} session${sessions === 1 ? "" : "s"} across ${numberWord(projects)} project${projects === 1 ? "" : "s"}.`;
  const gates = pending.filter((r) => r.ratings).length;
  const others = pending.filter((r) => rowState(r) === "driver-only");
  const emphasis = gates
    ? `${numberWord(gates, true)} ${gates === 1 ? "is a release gate" : "are release gates"}${others.length ? ";" : "."}`
    : "";
  const waits = others[0];
  const rest = waits
    ? `${gates ? numberWord(others.length) : numberWord(others.length, true)} wait${others.length === 1 ? "s" : ""} for ${waits.waitsFor.who ?? `the ${waits.waitsFor.role}`}.`
    : "";
  return { sentence, emphasis, rest };
}

/** The aside's At a glance: what needs you, where your vote is in, what is someone else's call. */
export function glanceOf(pending: QueueRow[]): { needYou: number; voteIn: number; theirs: number } {
  return {
    needYou: filterRows(pending, "needs-you").length,
    voteIn: pending.filter((r) => r.myVote !== null).length,
    theirs: pending.filter((r) => !r.myVote && !r.canDecide && r.override === null).length,
  };
}

/** The serif word beside the compact stars: a 3 is a voice, not a vote. */
export function ratingWord(n: number | null): { word: string; tone: "low" | "mid" | "high" | "" } {
  if (n === null) return { word: copy.queue.rate, tone: "" };
  if (n <= 2) return { word: n === 1 ? "Not this" : "Weak", tone: "low" };
  if (n === 3) return { word: "A voice", tone: "mid" };
  return { word: n === 4 ? "Good" : "Strong", tone: "high" };
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
