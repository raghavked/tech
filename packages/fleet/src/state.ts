/** Project state: the fold of the project ledger. Pure and total, like the session reducer. */

import type { DirectiveInput, Usage } from "@henosis/protocol";
import { addUsage, MAIN_BRANCH, ZERO_USAGE } from "@henosis/protocol";
import type { ClaimRecord } from "./claims.js";
import type {
  FleetContentionKind,
  ProjectEvent,
  ProjectPolicy,
  ProjectRole,
  SessionStatusReport,
} from "./events.js";

export interface ProjectMember {
  userId: string;
  name: string;
  role: ProjectRole;
  present: boolean;
}

/** One read of a brief, as `session.briefed` records it. */
export interface BriefRead {
  reader: string;
  kind: "fleet" | "handoff";
  /** The ledger seq of the read. */
  seq: number;
  /** The session seq the brief described. */
  atSeq: number;
  brief: string;
}

export interface SessionSummary {
  sessionId: string;
  ownerId: string;
  title: string;
  open: boolean;
  registeredSeq: number;
  report: SessionStatusReport | null;
  /** Named task this session works on with other sessions, or null when solo. */
  crew: string | null;
  /** Briefs read in this session, oldest first: the agent's standing brief, then people's reads. */
  briefs: BriefRead[];
}

export interface ProjectDirective {
  id: string;
  author: string;
  input: DirectiveInput;
  targets: "all" | string[];
  seq: number;
  status: "active" | "withdrawn";
}

export interface FleetContention {
  id: string;
  kind: FleetContentionKind;
  sessionIds: string[];
  resource: string;
  detail: string;
  openedSeq: number;
  resolved: boolean;
  winnerSessionId: string | null;
  note: string;
}

export interface ProjectState {
  projectId: string;
  orgId: string;
  teamId: string;
  name: string;
  policy: ProjectPolicy;
  head: string | null;
  seq: number;
  members: Record<string, ProjectMember>;
  sessions: Record<string, SessionSummary>;
  claims: Record<string, ClaimRecord>;
  directives: Record<string, ProjectDirective>;
  contentions: Record<string, FleetContention>;
  violations: { sessionId: string; path: string; holderClaimId: string; seq: number }[];
  notes: { actor: string; text: string; seq: number }[];
}

export function initialProjectState(): ProjectState {
  return {
    projectId: "",
    orgId: "",
    teamId: "",
    name: "",
    policy: { autoClaimOnWrite: true, claimTtlTurns: 0 },
    head: null,
    seq: -1,
    members: {},
    sessions: {},
    claims: {},
    directives: {},
    contentions: {},
    violations: [],
    notes: [],
  };
}

export function reduceProject(prev: ProjectState, e: ProjectEvent): ProjectState {
  const s: ProjectState = structuredClone(prev);
  s.head = e.id;
  s.seq = e.seq;
  switch (e.kind) {
    case "project.created":
      s.projectId = e.payload.projectId;
      s.orgId = e.payload.orgId;
      s.teamId = e.payload.teamId;
      s.name = e.payload.name;
      s.policy = e.payload.policy;
      break;
    case "project.member.joined":
      s.members[e.payload.userId] = {
        userId: e.payload.userId,
        name: e.payload.name,
        role: e.payload.role,
        present: true,
      };
      break;
    case "project.member.left": {
      const m = s.members[e.payload.userId];
      if (m) m.present = false;
      break;
    }
    case "project.role.changed": {
      const m = s.members[e.payload.userId];
      if (m) m.role = e.payload.role;
      break;
    }
    case "project.policy.changed": {
      const p = e.payload.policy;
      if (p.autoClaimOnWrite !== undefined) s.policy.autoClaimOnWrite = p.autoClaimOnWrite;
      if (p.claimTtlTurns !== undefined) s.policy.claimTtlTurns = p.claimTtlTurns;
      if (p.tokenBudget !== undefined) s.policy.tokenBudget = p.tokenBudget;
      break;
    }
    case "session.registered":
      s.sessions[e.payload.sessionId] = {
        sessionId: e.payload.sessionId,
        ownerId: e.payload.ownerId,
        title: e.payload.title,
        open: true,
        registeredSeq: e.seq,
        report: null,
        crew: null,
        briefs: [],
      };
      break;
    case "session.crewed": {
      const ss = s.sessions[e.payload.sessionId];
      if (ss) ss.crew = e.payload.crew;
      break;
    }
    case "session.briefed": {
      const ss = s.sessions[e.payload.sessionId];
      if (ss) {
        if (!ss.briefs) ss.briefs = [];
        ss.briefs.push({
          reader: e.payload.reader,
          kind: e.payload.kind,
          seq: e.seq,
          atSeq: e.payload.atSeq,
          brief: e.payload.brief,
        });
      }
      break;
    }
    case "session.status.reported": {
      const ss = s.sessions[e.payload.sessionId];
      if (ss) ss.report = e.payload;
      for (const c of Object.values(s.claims)) {
        if (c.sessionId === e.payload.sessionId && c.status === "active")
          c.lastTouchedTurn = e.payload.turn;
      }
      break;
    }
    case "session.closed": {
      const ss = s.sessions[e.payload.sessionId];
      if (ss) ss.open = false;
      for (const c of Object.values(s.claims))
        if (c.sessionId === e.payload.sessionId && c.status === "active") c.status = "released";
      break;
    }
    case "claim.requested": {
      const owner = s.sessions[e.payload.sessionId]?.ownerId ?? e.actor;
      const turn = s.sessions[e.payload.sessionId]?.report?.turn ?? 0;
      s.claims[e.payload.claimId] = {
        id: e.payload.claimId,
        sessionId: e.payload.sessionId,
        ownerId: owner,
        resource: e.payload.resource,
        mode: e.payload.mode,
        reason: e.payload.reason,
        requestedSeq: e.seq,
        status: "pending",
        lastTouchedTurn: turn,
      };
      break;
    }
    case "claim.granted": {
      const c = s.claims[e.payload.claimId];
      if (c && c.status === "pending") c.status = "active";
      break;
    }
    case "claim.denied": {
      const c = s.claims[e.payload.claimId];
      if (c && c.status === "pending") c.status = "denied";
      break;
    }
    case "claim.released": {
      const c = s.claims[e.payload.claimId];
      if (c && c.status === "active") c.status = "released";
      break;
    }
    case "claim.expired": {
      const c = s.claims[e.payload.claimId];
      if (c && c.status === "active") c.status = "expired";
      break;
    }
    case "claim.violation":
      s.violations.push({ ...e.payload, seq: e.seq });
      break;
    case "project.directive.submitted":
      s.directives[e.payload.directiveId] = {
        id: e.payload.directiveId,
        author: e.actor,
        input: e.payload.input,
        targets: e.payload.targets,
        seq: e.seq,
        status: "active",
      };
      break;
    case "project.directive.withdrawn": {
      const d = s.directives[e.payload.directiveId];
      if (d) d.status = "withdrawn";
      break;
    }
    case "fleet.contention.opened":
      s.contentions[e.payload.contentionId] = {
        id: e.payload.contentionId,
        kind: e.payload.kind,
        sessionIds: e.payload.sessionIds,
        resource: e.payload.resource,
        detail: e.payload.detail,
        openedSeq: e.seq,
        resolved: false,
        winnerSessionId: null,
        note: "",
      };
      break;
    case "fleet.contention.resolved": {
      const c = s.contentions[e.payload.contentionId];
      if (c) {
        c.resolved = true;
        c.winnerSessionId = e.payload.winnerSessionId;
        c.note = e.payload.note;
      }
      break;
    }
    case "project.note.posted":
      s.notes.push({ actor: e.actor, text: e.payload.text, seq: e.seq });
      break;
  }
  return s;
}

export function foldProject(events: readonly ProjectEvent[], from?: ProjectState): ProjectState {
  let s = from ?? initialProjectState();
  for (const e of events) s = reduceProject(s, e);
  return s;
}

/** Open sessions grouped by crew name; solo sessions are not listed. */
export function crews(s: ProjectState): Record<string, SessionSummary[]> {
  const out: Record<string, SessionSummary[]> = {};
  for (const ss of Object.values(s.sessions)) {
    if (!ss.open || !ss.crew) continue;
    const list = out[ss.crew] ?? [];
    list.push(ss);
    out[ss.crew] = list;
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.registeredSeq - b.registeredSeq);
  return out;
}

/** Tokens a session has reported so far; zero until its first report, or for an old ledger. */
export function usageOf(s: SessionSummary): Usage {
  return s.report?.usage ?? { ...ZERO_USAGE };
}

/** Tokens reported by every open session in the project. */
export function projectUsage(s: ProjectState): Usage {
  let total: Usage = { ...ZERO_USAGE };
  for (const ss of Object.values(s.sessions)) if (ss.open) total = addUsage(total, usageOf(ss));
  return total;
}

/** Where a project's budget comes from: a number a lead set, or the sum of its sessions' budgets. */
export type BudgetSource = "project" | "sessions" | null;

export interface ProjectBudget {
  /** Input + output tokens the project may spend before the meter turns red; null when nobody set one. */
  budget: number | null;
  source: BudgetSource;
  /** Open sessions with a budget of their own, and those without. */
  sessionsWithBudget: number;
  sessionsWithout: number;
}

/**
 * The project budget (Decision 8): the ledger policy's `tokenBudget` when a lead set one, else
 * the sum of the open sessions' budgets, else null. `budgets` lets a caller that knows the
 * session policies (the usage API reads the logs) override what the status reports carried.
 */
export function projectBudget(
  s: ProjectState,
  budgets?: ReadonlyMap<string, number | null>,
): ProjectBudget {
  let sum = 0;
  let withBudget = 0;
  let without = 0;
  for (const ss of Object.values(s.sessions)) {
    if (!ss.open) continue;
    const b = budgets?.has(ss.sessionId) ? budgets.get(ss.sessionId) : ss.report?.budget;
    if (typeof b === "number" && b > 0) {
      sum += b;
      withBudget += 1;
    } else without += 1;
  }
  const set = s.policy.tokenBudget;
  if (typeof set === "number" && set > 0)
    return {
      budget: set,
      source: "project",
      sessionsWithBudget: withBudget,
      sessionsWithout: without,
    };
  if (withBudget > 0)
    return {
      budget: sum,
      source: "sessions",
      sessionsWithBudget: withBudget,
      sessionsWithout: without,
    };
  return { budget: null, source: null, sessionsWithBudget: 0, sessionsWithout: without };
}

export function activeClaims(s: ProjectState): ClaimRecord[] {
  return Object.values(s.claims).filter((c) => c.status === "active");
}

export function directiveAppliesTo(d: ProjectDirective, sessionId: string): boolean {
  return d.status === "active" && (d.targets === "all" || d.targets.includes(sessionId));
}

export { MAIN_BRANCH };
