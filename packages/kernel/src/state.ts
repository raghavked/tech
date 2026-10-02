/**
 * The session state reducer. `reduce(state, event)` is pure and total: the server, the CLI and
 * the browser fold the same events into the same state. Replay from the log, or from a
 * serialized state plus a tail of events, yields identical results (see replay.ts).
 */
import type {
  Actor,
  Role,
  SessionEvent,
  SessionPolicy,
  ToolCall,
  ToolResult,
} from "@atelier/protocol";
import { DEFAULT_APPROVAL_POLICY, LEAD_RANK, MAIN_BRANCH, ROLE_RANK } from "@atelier/protocol";
import { type ApprovalRecord, evaluate, ruleFor } from "./approvals.js";
import {
  arbitrate,
  type Contention,
  type DirectiveRecord,
  effectiveRank,
  type Intent,
} from "./intent.js";
import { applyChanges, type Tree } from "./workspace.js";

export interface Participant {
  actor: Actor;
  role: Role;
  present: boolean;
  joinedSeq: number;
  lastSeenSeq: number;
}

export interface Handoff {
  id: string;
  from: string;
  to: string;
  status: "pending" | "accepted" | "declined";
  seq: number;
}

export interface TurnRecord {
  turn: number;
  epoch: number;
  startedSeq: number;
  endedSeq: number | null;
  reason: string | null;
  summary: string;
  modelText: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
}

export interface Checkpoint {
  id: string;
  eventId: string;
  tree: string;
  label: string;
  seq: number;
}

export interface MergeRecord {
  source: string;
  base: string;
  seq: number;
  conflicts: string[];
}

export type SessionStatus =
  | "idle"
  | "running"
  | "paused"
  | "awaiting_approval"
  | "blocked"
  | "cancelled";

export interface BlockedWrite {
  path: string;
  holderSessionId: string;
  claimId: string;
  seq: number;
}

export interface FleetContentionMirror {
  id: string;
  kind: "claim" | "path-overlap" | "merge-conflict";
  sessionIds: string[];
  resource: string;
  resolved: boolean;
  seq: number;
}

export interface SessionState {
  sessionId: string;
  title: string;
  projectId: string;
  ownerId: string | null;
  policy: SessionPolicy;
  branch: string;
  head: string | null;
  seq: number;
  participants: Record<string, Participant>;
  driver: string | null;
  directives: Record<string, DirectiveRecord>;
  contentions: Record<string, Contention>;
  intent: Intent;
  consumedInterrupts: string[];
  epoch: number;
  turn: number;
  currentTurn: TurnRecord | null;
  turns: TurnRecord[];
  approvals: Record<string, ApprovalRecord>;
  handoffs: Record<string, Handoff>;
  workspace: Tree;
  /** Paths left with conflict markers by a merge, cleared when rewritten. */
  openConflicts: string[];
  checkpoints: Checkpoint[];
  branches: Record<string, { from: string; fromCheckpoint: string; seq: number }>;
  merges: MergeRecord[];
  notes: { actor: string; text: string; seq: number }[];
  /** Writes refused because another session in the project holds a claim. */
  blockedWrites: BlockedWrite[];
  /** Fleet-level contentions this session is part of, mirrored from the project ledger. */
  fleetContentions: Record<string, FleetContentionMirror>;
  status: SessionStatus;
}

export function initialState(branch: string = MAIN_BRANCH): SessionState {
  return {
    sessionId: "",
    title: "",
    projectId: "default",
    ownerId: null,
    policy: { approvals: DEFAULT_APPROVAL_POLICY, contention: "block", maxTurns: 200 },
    branch,
    head: null,
    seq: -1,
    participants: {},
    driver: null,
    directives: {},
    contentions: {},
    intent: {
      goal: null,
      steers: {},
      constraints: [],
      control: "running",
      interrupt: false,
      contendedScopes: [],
    },
    consumedInterrupts: [],
    epoch: 0,
    turn: 0,
    currentTurn: null,
    turns: [],
    approvals: {},
    handoffs: {},
    workspace: {},
    openConflicts: [],
    checkpoints: [],
    branches: {},
    merges: [],
    notes: [],
    blockedWrites: [],
    fleetContentions: {},
    status: "idle",
  };
}

export function rankOf(state: SessionState, actorId: string): number {
  const p = state.participants[actorId];
  if (!p) return -1;
  return effectiveRank(p.role, state.driver === actorId);
}

export function isHuman(state: SessionState, actorId: string): boolean {
  return state.participants[actorId]?.actor.kind === "human";
}

/** Fold one event. Returns a new state; the input is not mutated. */
export function reduce(prev: SessionState, e: SessionEvent): SessionState {
  const s: SessionState = structuredClone(prev);
  s.head = e.id;
  s.seq = e.seq;
  s.branch = e.branch;
  const p = s.participants[e.actor];
  if (p) p.lastSeenSeq = e.seq;

  switch (e.kind) {
    case "session.created":
      s.sessionId = e.payload.sessionId;
      s.title = e.payload.title;
      s.policy = e.payload.policy;
      s.projectId = e.payload.projectId;
      s.ownerId = e.payload.ownerId;
      break;

    case "participant.joined": {
      const { actor, role } = e.payload;
      const existing = s.participants[actor.id];
      const storedRole: Role = role === "driver" ? "contributor" : role;
      s.participants[actor.id] = {
        actor,
        role:
          existing && ROLE_RANK[existing.role] > ROLE_RANK[storedRole] ? existing.role : storedRole,
        present: true,
        joinedSeq: existing?.joinedSeq ?? e.seq,
        lastSeenSeq: e.seq,
      };
      if (s.driver === null && actor.kind === "human" && (role === "driver" || role === "owner")) {
        s.driver = actor.id;
      }
      break;
    }

    case "participant.left": {
      const q = s.participants[e.payload.actorId];
      if (q) q.present = false;
      break;
    }

    case "role.changed": {
      const q = s.participants[e.payload.actorId];
      if (!q) break;
      if (e.payload.role === "driver") {
        s.driver = e.payload.actorId;
        if (ROLE_RANK[q.role] < ROLE_RANK.contributor) q.role = "contributor";
      } else {
        q.role = e.payload.role;
        if (e.payload.role === "observer" && s.driver === e.payload.actorId) s.driver = null;
      }
      recompute(s);
      break;
    }

    case "directive.submitted": {
      const { directiveId, input } = e.payload;
      const rank = rankOf(s, e.actor);
      s.directives[directiveId] = {
        id: directiveId,
        author: e.actor,
        input,
        rank,
        epoch: s.epoch,
        seq: e.seq,
        merged: false,
        origin: "session",
        status: "active",
        contentionId: null,
      };
      for (const id of input.supersedes) {
        const target = s.directives[id];
        if (target && (target.author === e.actor || rank > target.rank))
          target.status = "superseded";
      }
      recompute(s);
      break;
    }

    case "directive.withdrawn": {
      const d = s.directives[e.payload.directiveId];
      if (d) d.status = "withdrawn";
      recompute(s);
      break;
    }

    case "contention.resolved": {
      const c = s.contentions[e.payload.contentionId];
      if (!c) break;
      c.resolved = true;
      for (const id of c.directiveIds) {
        const d = s.directives[id];
        if (!d) continue;
        d.status = id === e.payload.winner ? "active" : "superseded";
      }
      recompute(s);
      break;
    }

    case "agent.turn.started": {
      s.epoch += 1;
      s.turn = e.payload.turn;
      for (const d of Object.values(s.directives)) {
        if (d.input.interrupt && d.status === "active" && !s.consumedInterrupts.includes(d.id)) {
          s.consumedInterrupts.push(d.id);
        }
      }
      s.currentTurn = {
        turn: e.payload.turn,
        epoch: s.epoch,
        startedSeq: e.seq,
        endedSeq: null,
        reason: null,
        summary: "",
        modelText: "",
        toolCalls: [],
        toolResults: [],
      };
      recompute(s);
      break;
    }

    case "agent.model.completed": {
      if (s.currentTurn) {
        s.currentTurn.modelText = e.payload.text;
        s.currentTurn.toolCalls.push(...e.payload.toolCalls);
      }
      break;
    }

    case "agent.tool.requested":
      break;

    case "agent.tool.completed": {
      s.currentTurn?.toolResults.push(e.payload.result);
      break;
    }

    case "agent.turn.ended": {
      if (s.currentTurn) {
        s.currentTurn.endedSeq = e.seq;
        s.currentTurn.reason = e.payload.reason;
        s.currentTurn.summary = e.payload.summary;
        s.turns.push(s.currentTurn);
        s.currentTurn = null;
      }
      break;
    }

    case "approval.requested": {
      s.approvals[e.payload.approvalId] = {
        id: e.payload.approvalId,
        call: e.payload.call,
        votes: {},
        status: "pending",
        requestedSeq: e.seq,
        turn: s.turn,
      };
      break;
    }

    case "approval.voted": {
      const a = s.approvals[e.payload.approvalId];
      if (a?.status !== "pending" || !isHuman(s, e.actor)) break;
      a.votes[e.actor] = e.payload.vote;
      a.status = evaluate(ruleFor(s.policy.approvals, a.call.risk), a.votes, (id) => rankOf(s, id));
      break;
    }

    case "handoff.requested": {
      s.handoffs[e.payload.handoffId] = {
        id: e.payload.handoffId,
        from: e.actor,
        to: e.payload.to,
        status: "pending",
        seq: e.seq,
      };
      break;
    }

    case "handoff.accepted": {
      const h = s.handoffs[e.payload.handoffId];
      if (h?.status !== "pending" || e.actor !== h.to) break;
      h.status = "accepted";
      s.driver = h.to;
      const q = s.participants[h.to];
      if (q && ROLE_RANK[q.role] < ROLE_RANK.contributor) q.role = "contributor";
      recompute(s);
      break;
    }

    case "handoff.declined": {
      const h = s.handoffs[e.payload.handoffId];
      if (h && h.status === "pending") h.status = "declined";
      break;
    }

    case "checkpoint.created": {
      s.checkpoints.push({
        id: e.payload.checkpointId,
        eventId: e.id,
        tree: e.payload.tree,
        label: e.payload.label,
        seq: e.seq,
      });
      break;
    }

    case "workspace.changed": {
      s.workspace = applyChanges(s.workspace, e.payload.changes);
      s.openConflicts = s.openConflicts.filter((path) => !(path in e.payload.changes));
      break;
    }

    case "branch.created": {
      s.branches[e.payload.branch] = {
        from: e.payload.fromBranch,
        fromCheckpoint: e.payload.fromCheckpoint,
        seq: e.seq,
      };
      break;
    }

    case "branch.merged": {
      s.workspace = applyChanges(s.workspace, e.payload.tree);
      s.openConflicts = [...new Set([...s.openConflicts, ...e.payload.conflicts])].sort();
      s.merges.push({
        source: e.payload.source,
        base: e.payload.base,
        seq: e.seq,
        conflicts: e.payload.conflicts,
      });
      for (const c of e.payload.carried) {
        s.directives[c.id] = {
          id: c.id,
          author: c.author,
          input: c.input,
          rank: c.rank,
          epoch: s.epoch,
          seq: e.seq,
          merged: true,
          origin: "session",
          status: "active",
          contentionId: null,
        };
      }
      recompute(s);
      break;
    }

    case "note.posted":
      s.notes.push({ actor: e.actor, text: e.payload.text, seq: e.seq });
      break;

    case "project.directive.applied": {
      s.directives[e.payload.directiveId] = {
        id: e.payload.directiveId,
        author: e.payload.author,
        input: e.payload.input,
        rank: LEAD_RANK,
        epoch: s.epoch,
        seq: e.seq,
        merged: false,
        origin: "project",
        status: "active",
        contentionId: null,
      };
      recompute(s);
      break;
    }

    case "project.directive.withdrawn": {
      const d = s.directives[e.payload.directiveId];
      if (d) d.status = "withdrawn";
      recompute(s);
      break;
    }

    case "workspace.blocked":
      s.blockedWrites.push({ ...e.payload, seq: e.seq });
      break;

    case "fleet.contention.mirrored":
      s.fleetContentions[e.payload.contentionId] = {
        id: e.payload.contentionId,
        kind: e.payload.kind,
        sessionIds: e.payload.sessionIds,
        resource: e.payload.resource,
        resolved: e.payload.resolved,
        seq: e.seq,
      };
      break;
  }

  s.status = deriveStatus(s);
  return s;
}

function recompute(s: SessionState): void {
  const result = arbitrate(Object.values(s.directives), Object.values(s.contentions), {
    rankOf: (id) => rankOf(s, id),
    driver: s.driver,
    policy: s.policy.contention,
    epoch: s.epoch,
    consumedInterrupts: new Set(s.consumedInterrupts),
  });
  for (const [id, status] of Object.entries(result.statuses)) {
    const d = s.directives[id];
    if (d && d.status !== "withdrawn" && d.status !== "superseded") d.status = status;
  }
  s.contentions = {};
  for (const c of result.contentions) {
    s.contentions[c.id] = c;
    for (const id of c.directiveIds) {
      const d = s.directives[id];
      if (d) d.contentionId = c.id;
    }
  }
  s.intent = result.intent;
}

function deriveStatus(s: SessionState): SessionStatus {
  if (s.intent.control === "cancelled") return "cancelled";
  if (Object.values(s.approvals).some((a) => a.status === "pending")) return "awaiting_approval";
  if (s.intent.control === "paused") return "paused";
  const goalContended = s.intent.contendedScopes.includes("goal");
  if (goalContended || s.openConflicts.length > 0) return "blocked";
  if (s.currentTurn) return "running";
  return "idle";
}

export function fold(events: readonly SessionEvent[], from?: SessionState): SessionState {
  let s = from ?? initialState(events[0]?.branch ?? MAIN_BRANCH);
  for (const e of events) s = reduce(s, e);
  return s;
}
