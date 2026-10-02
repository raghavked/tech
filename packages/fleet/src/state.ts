/** Project state: the fold of the project ledger. Pure and total, like the session reducer. */

import type { DirectiveInput } from "@atelier/protocol";
import { MAIN_BRANCH } from "@atelier/protocol";
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

export interface SessionSummary {
  sessionId: string;
  ownerId: string;
  title: string;
  open: boolean;
  registeredSeq: number;
  report: SessionStatusReport | null;
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
    case "session.registered":
      s.sessions[e.payload.sessionId] = {
        sessionId: e.payload.sessionId,
        ownerId: e.payload.ownerId,
        title: e.payload.title,
        open: true,
        registeredSeq: e.seq,
        report: null,
      };
      break;
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

export function activeClaims(s: ProjectState): ClaimRecord[] {
  return Object.values(s.claims).filter((c) => c.status === "active");
}

export function directiveAppliesTo(d: ProjectDirective, sessionId: string): boolean {
  return d.status === "active" && (d.targets === "all" || d.targets.includes(sessionId));
}

export { MAIN_BRANCH };
