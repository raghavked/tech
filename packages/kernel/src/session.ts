/**
 * Session: the command layer over the log. Every mutation validates authority against the
 * current state, appends an event, and refolds. This is the one path the server, the CLI,
 * the runner and the tests use, so authority rules live in exactly one place.
 */
import type {
  Actor,
  DirectiveInput,
  EventBody,
  Role,
  SessionEvent,
  SessionPolicy,
  ToolCall,
  ToolResult,
  Usage,
} from "@henosis/protocol";
import { DirectiveInput as DirectiveInputSchema, MAIN_BRANCH, ROLE_RANK } from "@henosis/protocol";
import { requiresApproval } from "./approvals.js";
import { shortId } from "./hash.js";
import { type SerializedLog, SessionLog } from "./log.js";
import { planMerge } from "./merge.js";
import { fold, rankOf, reduce, type SessionState } from "./state.js";
import { type BlobStore, MemoryBlobStore, treeHash } from "./workspace.js";

export class KernelError extends Error {
  constructor(
    public readonly code: "unauthorized" | "not_found" | "invalid" | "conflict" | "unknown_branch",
    message: string,
  ) {
    super(message);
  }
}

export type EventListener = (event: SessionEvent, state: SessionState) => void;

export interface SessionOptions {
  store?: BlobStore;
  log?: SessionLog;
}

export class Session {
  readonly log: SessionLog;
  readonly store: BlobStore;
  private readonly states = new Map<string, SessionState>();
  private readonly listeners = new Set<EventListener>();

  constructor(opts: SessionOptions = {}) {
    this.log = opts.log ?? new SessionLog();
    this.store = opts.store ?? new MemoryBlobStore();
    for (const b of this.log.branchNames()) this.states.set(b, fold(this.log.eventsOf(b)));
  }

  static create(
    sessionId: string,
    title: string,
    policy: SessionPolicy,
    opts: SessionOptions & { projectId?: string; ownerId?: string | null } = {},
  ): Session {
    const s = new Session(opts);
    s.emit(MAIN_BRANCH, "system", {
      kind: "session.created",
      payload: {
        sessionId,
        title,
        policy,
        projectId: opts.projectId ?? "default",
        ownerId: opts.ownerId ?? null,
      },
    });
    return s;
  }

  static fromSerialized(data: SerializedLog, store?: BlobStore): Session {
    const opts: SessionOptions = { log: SessionLog.fromSerialized(data) };
    if (store) opts.store = store;
    return new Session(opts);
  }

  onEvent(fn: EventListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  state(branch: string = MAIN_BRANCH): SessionState {
    const s = this.states.get(branch);
    if (!s) throw new KernelError("unknown_branch", `unknown branch ${branch}`);
    return s;
  }

  branches(): string[] {
    return this.log.branchNames();
  }

  events(branch: string = MAIN_BRANCH): SessionEvent[] {
    return this.log.eventsOf(branch);
  }

  // ---- participants -------------------------------------------------------------------

  join(branch: string, actor: Actor, role: Role): SessionEvent {
    return this.emit(branch, actor.id, { kind: "participant.joined", payload: { actor, role } });
  }

  leave(branch: string, actorId: string): SessionEvent {
    return this.emit(branch, actorId, { kind: "participant.left", payload: { actorId } });
  }

  setRole(branch: string, by: string, actorId: string, role: Role): SessionEvent {
    const s = this.state(branch);
    const myRank = rankOf(s, by);
    const grantRank = ROLE_RANK[role];
    if (
      myRank < ROLE_RANK.owner &&
      !(myRank >= ROLE_RANK.driver && grantRank <= ROLE_RANK.driver)
    ) {
      throw new KernelError("unauthorized", `${by} cannot grant role ${role}`);
    }
    if (!s.participants[actorId])
      throw new KernelError("not_found", `unknown participant ${actorId}`);
    return this.emit(branch, by, { kind: "role.changed", payload: { actorId, role, by } });
  }

  // ---- steering -----------------------------------------------------------------------

  directive(
    branch: string,
    actorId: string,
    raw: DirectiveInput | Partial<DirectiveInput>,
  ): SessionEvent {
    const s = this.state(branch);
    this.requireParticipant(s, actorId);
    const input = DirectiveInputSchema.parse(raw);
    const rank = rankOf(s, actorId);
    if (rank < ROLE_RANK.contributor) {
      throw new KernelError("unauthorized", `${actorId} is an observer and cannot steer`);
    }
    if ((input.mode === "resume" || input.mode === "cancel") && rank < ROLE_RANK.driver) {
      throw new KernelError("unauthorized", `${input.mode} requires the driver or an owner`);
    }
    const directiveId = shortId("dir", branch, s.seq + 1, actorId, input);
    return this.emit(branch, actorId, {
      kind: "directive.submitted",
      payload: { directiveId, input },
    });
  }

  withdraw(branch: string, actorId: string, directiveId: string): SessionEvent {
    const s = this.state(branch);
    const d = s.directives[directiveId];
    if (!d) throw new KernelError("not_found", `unknown directive ${directiveId}`);
    if (d.author !== actorId && rankOf(s, actorId) < ROLE_RANK.owner) {
      throw new KernelError("unauthorized", "only the author or an owner can withdraw");
    }
    return this.emit(branch, actorId, { kind: "directive.withdrawn", payload: { directiveId } });
  }

  resolve(
    branch: string,
    actorId: string,
    contentionId: string,
    winner: string | null,
    replacement?: DirectiveInput,
  ): SessionEvent {
    const s = this.state(branch);
    const c = s.contentions[contentionId];
    if (!c || c.resolved) throw new KernelError("not_found", `no open contention ${contentionId}`);
    if (rankOf(s, actorId) < ROLE_RANK.driver) {
      throw new KernelError(
        "unauthorized",
        "resolving a contention requires the driver or an owner",
      );
    }
    if (winner !== null && !c.directiveIds.includes(winner)) {
      throw new KernelError("invalid", "winner is not part of the contention");
    }
    let replacementDirectiveId: string | null = null;
    if (replacement) {
      const ev = this.directive(branch, actorId, { ...replacement, scope: c.scope, mode: "steer" });
      if (ev.kind === "directive.submitted") replacementDirectiveId = ev.payload.directiveId;
    }
    return this.emit(branch, actorId, {
      kind: "contention.resolved",
      payload: { contentionId, winner, replacementDirectiveId },
    });
  }

  // ---- approvals ----------------------------------------------------------------------

  vote(
    branch: string,
    actorId: string,
    approvalId: string,
    vote: "approve" | "deny",
    rating?: number,
    note = "",
  ): SessionEvent {
    const s = this.state(branch);
    const a = s.approvals[approvalId];
    if (!a) throw new KernelError("not_found", `unknown approval ${approvalId}`);
    if (a.status !== "pending") throw new KernelError("conflict", "approval already decided");
    const p = s.participants[actorId];
    if (p?.actor.kind !== "human") throw new KernelError("unauthorized", "only humans vote");
    return this.emit(branch, actorId, {
      kind: "approval.voted",
      payload:
        rating === undefined ? { approvalId, vote, note } : { approvalId, vote, rating, note },
    });
  }

  // ---- handoff ------------------------------------------------------------------------

  requestHandoff(branch: string, actorId: string, to: string): SessionEvent {
    const s = this.state(branch);
    if (actorId !== s.driver && rankOf(s, actorId) < ROLE_RANK.owner) {
      throw new KernelError("unauthorized", "only the driver or an owner can hand off");
    }
    if (!s.participants[to]) throw new KernelError("not_found", `unknown participant ${to}`);
    const handoffId = shortId("ho", branch, s.seq + 1, actorId, to);
    return this.emit(branch, actorId, { kind: "handoff.requested", payload: { handoffId, to } });
  }

  acceptHandoff(branch: string, actorId: string, handoffId: string): SessionEvent {
    const s = this.state(branch);
    const h = s.handoffs[handoffId];
    if (h?.status !== "pending") throw new KernelError("not_found", "no pending handoff");
    if (h.to !== actorId)
      throw new KernelError("unauthorized", "handoff is addressed to someone else");
    return this.emit(branch, actorId, { kind: "handoff.accepted", payload: { handoffId } });
  }

  declineHandoff(branch: string, actorId: string, handoffId: string): SessionEvent {
    const s = this.state(branch);
    const h = s.handoffs[handoffId];
    if (h?.status !== "pending") throw new KernelError("not_found", "no pending handoff");
    if (h.to !== actorId)
      throw new KernelError("unauthorized", "handoff is addressed to someone else");
    return this.emit(branch, actorId, { kind: "handoff.declined", payload: { handoffId } });
  }

  // ---- workspace, checkpoints, branches ----------------------------------------------

  writeFile(branch: string, actorId: string, path: string, content: string): SessionEvent {
    const hash = this.store.put(content);
    return this.emit(branch, actorId, {
      kind: "workspace.changed",
      payload: { changes: { [path]: hash } },
    });
  }

  deleteFile(branch: string, actorId: string, path: string): SessionEvent {
    return this.emit(branch, actorId, {
      kind: "workspace.changed",
      payload: { changes: { [path]: null } },
    });
  }

  readFile(branch: string, path: string): string | undefined {
    const hash = this.state(branch).workspace[path];
    return hash === undefined ? undefined : this.store.get(hash);
  }

  checkpoint(branch: string, actorId: string, label: string): SessionEvent {
    const s = this.state(branch);
    const tree = treeHash(s.workspace);
    const checkpointId = shortId("cp", branch, s.seq + 1, tree);
    return this.emit(branch, actorId, {
      kind: "checkpoint.created",
      payload: { checkpointId, tree, label },
    });
  }

  fork(fromBranch: string, actorId: string, name: string, fromCheckpoint?: string): SessionEvent {
    const s = this.state(fromBranch);
    if (rankOf(s, actorId) < ROLE_RANK.contributor) {
      throw new KernelError("unauthorized", "forking requires contributor or above");
    }
    if (!/^[a-z0-9][a-z0-9._/-]{0,63}$/.test(name)) {
      throw new KernelError("invalid", "branch names are lowercase, alphanumerics plus ._/-");
    }
    let cp = fromCheckpoint
      ? s.checkpoints.find((c) => c.id === fromCheckpoint)
      : s.checkpoints[s.checkpoints.length - 1];
    if (!cp || (!fromCheckpoint && cp.seq !== s.seq)) {
      // Implicit checkpoint at the head so forks always start from a recorded tree.
      const ev = this.checkpoint(fromBranch, actorId, `fork:${name}`);
      cp = this.state(fromBranch).checkpoints.find((c) => c.eventId === ev.id);
    }
    if (!cp) throw new KernelError("not_found", "no checkpoint to fork from");
    this.log.fork(fromBranch, cp.eventId, name);
    this.states.set(name, fold(this.log.eventsOf(name)));
    const body: EventBody = {
      kind: "branch.created",
      payload: { branch: name, fromCheckpoint: cp.id, fromBranch },
    };
    this.emit(fromBranch, actorId, body);
    const ev = this.emit(name, actorId, body);
    // Carry presence: the forker is present on the new branch with the same role.
    const me = s.participants[actorId];
    if (me)
      this.emit(name, actorId, {
        kind: "participant.joined",
        payload: { actor: me.actor, role: me.role },
      });
    return ev;
  }

  merge(targetBranch: string, actorId: string, source: string): SessionEvent {
    const s = this.state(targetBranch);
    if (rankOf(s, actorId) < ROLE_RANK.driver) {
      throw new KernelError("unauthorized", "merging requires the driver or an owner");
    }
    if (!this.log.hasBranch(source))
      throw new KernelError("unknown_branch", `unknown branch ${source}`);
    const plan = planMerge(this.log, source, targetBranch, this.store);
    for (const [, content] of Object.entries(plan.merge.blobs)) this.store.put(content);
    return this.emit(targetBranch, actorId, {
      kind: "branch.merged",
      payload: {
        source,
        base: plan.base,
        tree: plan.merge.tree,
        conflicts: plan.merge.conflicts,
        carried: plan.carried,
      },
    });
  }

  note(branch: string, actorId: string, text: string): SessionEvent {
    this.requireParticipant(this.state(branch), actorId);
    return this.emit(branch, actorId, { kind: "note.posted", payload: { text } });
  }

  // ---- runner-facing ------------------------------------------------------------------

  turnStarted(branch: string, agentId: string): SessionEvent {
    const s = this.state(branch);
    return this.emit(branch, agentId, {
      kind: "agent.turn.started",
      payload: { turn: s.turn + 1, epoch: s.epoch + 1 },
    });
  }

  /** `usage` is what the call cost; omitted when the model did not count (ids stay stable). */
  modelCompleted(
    branch: string,
    agentId: string,
    text: string,
    toolCalls: ToolCall[],
    model: string,
    usage?: Usage,
  ) {
    const s = this.state(branch);
    return this.emit(branch, agentId, {
      kind: "agent.model.completed",
      payload: usage
        ? { turn: s.turn, text, toolCalls, model, usage }
        : { turn: s.turn, text, toolCalls, model },
    });
  }

  toolRequested(branch: string, agentId: string, call: ToolCall): SessionEvent {
    const s = this.state(branch);
    return this.emit(branch, agentId, {
      kind: "agent.tool.requested",
      payload: { turn: s.turn, call },
    });
  }

  toolCompleted(branch: string, agentId: string, result: ToolResult): SessionEvent {
    const s = this.state(branch);
    return this.emit(branch, agentId, {
      kind: "agent.tool.completed",
      payload: { turn: s.turn, result },
    });
  }

  turnEnded(
    branch: string,
    agentId: string,
    reason: "done" | "interrupted" | "paused" | "cancelled" | "blocked" | "error",
    summary: string,
  ): SessionEvent {
    const s = this.state(branch);
    return this.emit(branch, agentId, {
      kind: "agent.turn.ended",
      payload: { turn: s.turn, reason, summary },
    });
  }

  /** Returns the approval id if the call needs approval, else null. */
  requestApproval(branch: string, agentId: string, call: ToolCall): string | null {
    const s = this.state(branch);
    if (!requiresApproval(s.policy.approvals, call.risk)) return null;
    const approvalId = shortId("apr", branch, s.seq + 1, call);
    this.emit(branch, agentId, { kind: "approval.requested", payload: { approvalId, call } });
    return approvalId;
  }

  // ---- fleet-facing (written by a project host, never by a participant) ---------------

  applyProjectDirective(
    branch: string,
    projectId: string,
    projectDirectiveId: string,
    author: string,
    input: DirectiveInput,
  ): SessionEvent {
    const directiveId = shortId(
      "dir",
      "project",
      projectDirectiveId,
      this.state(branch).sessionId,
      branch,
    );
    return this.emit(branch, "system", {
      kind: "project.directive.applied",
      payload: { directiveId, projectDirectiveId, projectId, author, input },
    });
  }

  withdrawProjectDirective(branch: string, directiveId: string): SessionEvent | null {
    if (!this.state(branch).directives[directiveId]) return null;
    return this.emit(branch, "system", {
      kind: "project.directive.withdrawn",
      payload: { directiveId },
    });
  }

  recordBlockedWrite(
    branch: string,
    agentId: string,
    path: string,
    holderSessionId: string,
    claimId: string,
  ) {
    return this.emit(branch, agentId, {
      kind: "workspace.blocked",
      payload: { path, holderSessionId, claimId },
    });
  }

  mirrorContention(
    branch: string,
    contentionId: string,
    kind: "claim" | "path-overlap" | "merge-conflict",
    sessionIds: string[],
    resource: string,
    resolved: boolean,
  ): SessionEvent {
    return this.emit(branch, "system", {
      kind: "fleet.contention.mirrored",
      payload: { contentionId, kind, sessionIds, resource, resolved },
    });
  }

  // ---- internals ----------------------------------------------------------------------

  private requireParticipant(s: SessionState, actorId: string): void {
    if (!s.participants[actorId]) {
      throw new KernelError("unauthorized", `${actorId} is not a participant on ${s.branch}`);
    }
  }

  private emit(branch: string, actor: string, body: EventBody): SessionEvent {
    const prev = this.states.get(branch) ?? fold(this.log.eventsOf(branch));
    const event = this.log.append(branch, actor, body);
    const next = reduce(prev, event);
    this.states.set(branch, next);
    for (const fn of this.listeners) fn(event, next);
    return event;
  }
}
