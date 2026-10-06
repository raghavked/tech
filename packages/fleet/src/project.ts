/**
 * Project: the command layer over the ledger. Authority lives here: leads and admins issue
 * project directives and resolve fleet contentions; a session's owner claims on its behalf.
 */
import { KernelError, shortId } from "@henosis/kernel";
import type { DirectiveInput } from "@henosis/protocol";
import { DirectiveInput as DirectiveInputSchema, MAIN_BRANCH } from "@henosis/protocol";
import {
  type ClaimRecord,
  claimConflictId,
  conflictingClaims,
  holderOf,
  resourcesOverlap,
} from "./claims.js";
import {
  type ClaimMode,
  type FleetContentionKind,
  PROJECT_RANK,
  type ProjectEvent,
  type ProjectEventBody,
  type ProjectPolicy,
  type ProjectRole,
  type Resource,
  Resource as ResourceSchema,
  resourceKey,
  type SessionStatusReport,
} from "./events.js";
import { ProjectLedger, type SerializedLedger } from "./ledger.js";
import { activeClaims, foldProject, type ProjectState, reduceProject } from "./state.js";

export type ProjectListener = (event: ProjectEvent, state: ProjectState) => void;

export interface ClaimVerdict {
  claimId: string;
  granted: boolean;
  holders: ClaimRecord[];
  contentionId: string | null;
}

export class Project {
  readonly ledger: ProjectLedger;
  private current: ProjectState;
  private readonly listeners = new Set<ProjectListener>();

  constructor(ledger: ProjectLedger = new ProjectLedger()) {
    this.ledger = ledger;
    this.current = foldProject(ledger.eventsOf(MAIN_BRANCH));
  }

  static create(
    projectId: string,
    orgId: string,
    teamId: string,
    name: string,
    policy: ProjectPolicy,
  ): Project {
    const p = new Project();
    p.emit("system", {
      kind: "project.created",
      payload: { projectId, orgId, teamId, name, policy },
    });
    return p;
  }

  static fromSerialized(data: SerializedLedger): Project {
    return new Project(ProjectLedger.fromSerialized(data));
  }

  state(): ProjectState {
    return this.current;
  }

  events(): ProjectEvent[] {
    return this.ledger.eventsOf(MAIN_BRANCH);
  }

  onEvent(fn: ProjectListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  rankOf(userId: string): number {
    const m = this.current.members[userId];
    return m ? PROJECT_RANK[m.role] : 0;
  }

  // ---- membership --------------------------------------------------------------------

  join(userId: string, name: string, role: ProjectRole): ProjectEvent {
    return this.emit(userId, { kind: "project.member.joined", payload: { userId, name, role } });
  }

  leave(userId: string): ProjectEvent {
    return this.emit(userId, { kind: "project.member.left", payload: { userId } });
  }

  setRole(by: string, userId: string, role: ProjectRole): ProjectEvent {
    if (this.rankOf(by) < PROJECT_RANK.admin)
      throw new KernelError("unauthorized", "only an admin changes project roles");
    if (!this.current.members[userId])
      throw new KernelError("not_found", `unknown member ${userId}`);
    return this.emit(by, { kind: "project.role.changed", payload: { userId, role } });
  }

  // ---- sessions ----------------------------------------------------------------------

  registerSession(sessionId: string, ownerId: string, title: string): ProjectEvent {
    if (this.current.sessions[sessionId])
      throw new KernelError("conflict", `session ${sessionId} already registered`);
    return this.emit(ownerId, {
      kind: "session.registered",
      payload: { sessionId, ownerId, title },
    });
  }

  reportStatus(report: SessionStatusReport): ProjectEvent {
    this.requireSession(report.sessionId);
    return this.emit(`session:${report.sessionId}`, {
      kind: "session.status.reported",
      payload: report,
    });
  }

  /** Put a session in a crew (a named shared task) or take it out. Its owner or a lead may. */
  crew(by: string, sessionId: string, crew: string | null): ProjectEvent {
    const ss = this.requireSession(sessionId);
    if (ss.ownerId !== by && this.rankOf(by) < PROJECT_RANK.lead)
      throw new KernelError("unauthorized", "only the session's owner or a lead changes its crew");
    const name = crew?.trim() || null;
    if (ss.crew === name) throw new KernelError("conflict", "already in that crew");
    return this.emit(by, { kind: "session.crewed", payload: { sessionId, crew: name } });
  }

  closeSession(sessionId: string): ProjectEvent {
    this.requireSession(sessionId);
    return this.emit(`session:${sessionId}`, { kind: "session.closed", payload: { sessionId } });
  }

  // ---- claims ------------------------------------------------------------------------

  /**
   * Request a claim. The verdict is deterministic: first active holder wins; a denial opens a
   * fleet contention between the two sessions so both owners and the lead see it.
   */
  claim(sessionId: string, rawResource: Resource, mode: ClaimMode, reason: string): ClaimVerdict {
    const ss = this.requireSession(sessionId);
    const resource = ResourceSchema.parse(rawResource);
    const claimId = shortId("clm", sessionId, resourceKey(resource), this.current.seq + 1);
    this.emit(`session:${sessionId}`, {
      kind: "claim.requested",
      payload: { claimId, sessionId, resource, mode, reason },
    });
    const holders = conflictingClaims({ sessionId, resource, mode }, activeClaims(this.current));
    if (holders.length === 0) {
      this.emit("system", { kind: "claim.granted", payload: { claimId } });
      return { claimId, granted: true, holders: [], contentionId: null };
    }
    this.emit("system", {
      kind: "claim.denied",
      payload: { claimId, holderClaimIds: holders.map((h) => h.id) },
    });
    const sessionIds = [sessionId, ...holders.map((h) => h.sessionId)];
    const contentionId = this.openContention(
      "claim",
      sessionIds,
      resourceKey(resource),
      `${ss.ownerId}'s session wants ${resourceKey(resource)} held by ${holders.map((h) => `${h.ownerId}'s session (${h.reason})`).join(", ")}`,
    );
    return { claimId, granted: false, holders, contentionId };
  }

  release(sessionId: string, claimId: string): ProjectEvent {
    const c = this.current.claims[claimId];
    if (c?.status !== "active") throw new KernelError("not_found", `no active claim ${claimId}`);
    if (c.sessionId !== sessionId)
      throw new KernelError("unauthorized", "only the holding session releases a claim");
    return this.emit(`session:${sessionId}`, { kind: "claim.released", payload: { claimId } });
  }

  /** Expire claims whose holder has been idle for longer than the policy allows. */
  expireStale(): ProjectEvent[] {
    const ttl = this.current.policy.claimTtlTurns;
    if (!ttl) return [];
    const out: ProjectEvent[] = [];
    for (const c of activeClaims(this.current)) {
      const turn = this.current.sessions[c.sessionId]?.report?.turn ?? c.lastTouchedTurn;
      if (turn - c.lastTouchedTurn >= ttl)
        out.push(this.emit("system", { kind: "claim.expired", payload: { claimId: c.id } }));
    }
    return out;
  }

  /** Is `sessionId` allowed to write `path`? Returns the blocking claim if not. */
  checkWrite(sessionId: string, path: string): { ok: true } | { ok: false; holder: ClaimRecord } {
    const holder = holderOf(path, sessionId, activeClaims(this.current));
    return holder ? { ok: false, holder } : { ok: true };
  }

  recordViolation(sessionId: string, path: string, holderClaimId: string): ProjectEvent {
    return this.emit(`session:${sessionId}`, {
      kind: "claim.violation",
      payload: { sessionId, path, holderClaimId },
    });
  }

  // ---- directives and contentions ----------------------------------------------------

  directive(
    by: string,
    raw: Partial<DirectiveInput> & { text: string },
    targets: "all" | string[] = "all",
  ): ProjectEvent {
    if (this.rankOf(by) < PROJECT_RANK.lead)
      throw new KernelError("unauthorized", "project directives require a lead or an admin");
    const input = DirectiveInputSchema.parse(raw);
    const directiveId = shortId("pdir", this.current.projectId, this.current.seq + 1, by, input);
    return this.emit(by, {
      kind: "project.directive.submitted",
      payload: { directiveId, input, targets },
    });
  }

  withdrawDirective(by: string, directiveId: string): ProjectEvent {
    const d = this.current.directives[directiveId];
    if (!d) throw new KernelError("not_found", `unknown directive ${directiveId}`);
    if (d.author !== by && this.rankOf(by) < PROJECT_RANK.admin)
      throw new KernelError("unauthorized", "only the author or an admin withdraws");
    return this.emit(by, { kind: "project.directive.withdrawn", payload: { directiveId } });
  }

  openContention(
    kind: FleetContentionKind,
    sessionIds: string[],
    resource: string,
    detail: string,
  ): string {
    const contentionId =
      kind === "claim"
        ? claimConflictId(parseKey(resource), sessionIds)
        : shortId("fct", kind, resource, [...sessionIds].sort());
    const existing = this.current.contentions[contentionId];
    if (existing && !existing.resolved) return contentionId;
    this.emit("system", {
      kind: "fleet.contention.opened",
      payload: { contentionId, kind, sessionIds: [...sessionIds].sort(), resource, detail },
    });
    return contentionId;
  }

  /** A lead resolves; a winner's claim is honoured by releasing the others' overlapping claims. */
  resolveContention(
    by: string,
    contentionId: string,
    winnerSessionId: string | null,
    note = "",
  ): ProjectEvent {
    const c = this.current.contentions[contentionId];
    if (!c || c.resolved) throw new KernelError("not_found", `no open contention ${contentionId}`);
    if (this.rankOf(by) < PROJECT_RANK.lead)
      throw new KernelError(
        "unauthorized",
        "resolving a fleet contention requires a lead or an admin",
      );
    if (winnerSessionId && !c.sessionIds.includes(winnerSessionId))
      throw new KernelError("invalid", "winner is not part of the contention");
    if (winnerSessionId && c.kind === "claim") {
      const resource = parseKey(c.resource);
      for (const cl of activeClaims(this.current)) {
        if (
          cl.sessionId !== winnerSessionId &&
          c.sessionIds.includes(cl.sessionId) &&
          resourcesOverlap(cl.resource, resource)
        ) {
          this.emit(by, { kind: "claim.released", payload: { claimId: cl.id } });
        }
      }
    }
    return this.emit(by, {
      kind: "fleet.contention.resolved",
      payload: { contentionId, winnerSessionId, note },
    });
  }

  note(by: string, text: string): ProjectEvent {
    return this.emit(by, { kind: "project.note.posted", payload: { text } });
  }

  // ---- internals ---------------------------------------------------------------------

  private requireSession(sessionId: string) {
    const ss = this.current.sessions[sessionId];
    if (!ss)
      throw new KernelError("not_found", `session ${sessionId} is not registered in this project`);
    return ss;
  }

  private emit(actor: string, body: ProjectEventBody): ProjectEvent {
    const event = this.ledger.append(MAIN_BRANCH, actor, body);
    this.current = reduceProject(this.current, event);
    for (const fn of this.listeners) fn(event, this.current);
    return event;
  }
}

function parseKey(key: string): Resource {
  const [type, ...rest] = key.split(":");
  const value = rest.join(":");
  if (type === "service") return { type: "service", name: value };
  if (type === "ticket") return { type: "ticket", key: value };
  return { type: "path", pattern: value };
}
