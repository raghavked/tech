/**
 * ProjectHost: the authoritative actor for one project. It owns the ledger, every session
 * host in the project, the guard each runner uses, and the fan-out of project events to
 * subscribers. Sessions report status at turn boundaries; the host detects fleet contentions
 * after every change and mirrors them into the sessions involved.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  activePathsOf,
  type ClaimMode,
  type DetectedContention,
  detectFleetContentions,
  type FleetContention,
  fleetBrief,
  Project,
  type ProjectEvent,
  type ProjectPolicy,
  type ProjectState,
  propagateDirective,
  type Resource,
  renderFleetContext,
  type SerializedLedger,
  syncDirectives,
  withdrawPropagated,
} from "@atelier/fleet";
import type { SessionState } from "@atelier/kernel";
import type { MemoryStore } from "@atelier/memory";
import { type Actor, MAIN_BRANCH, type SessionEvent, type SessionPolicy } from "@atelier/protocol";
import type { MemoryAccess, Model, ToolRegistry, WorkspaceGuard } from "@atelier/runner";
import { SessionHost } from "./host.js";
import { atomicWrite, listSessions, readLog, sessionDir } from "./storage.js";

export interface ProjectSubscriber {
  userId: string | null;
  send(
    msg:
      | { type: "project.snapshot"; projectId: string; events: ProjectEvent[] }
      | { type: "project.event"; event: ProjectEvent }
      | { type: "fleet.brief"; markdown: string }
      | { type: "error"; message: string },
  ): void;
}

export interface ProjectHostOptions {
  root: string;
  projectId: string;
  orgId: string;
  teamId: string;
  name: string;
  model: Model;
  tools: ToolRegistry;
  policy?: ProjectPolicy;
  sessionPolicy: SessionPolicy;
  log?: (line: string) => void;
  /** The organisation's shared memory (one store per org, shared across its projects). */
  memory?: MemoryStore | undefined;
}

export class ProjectHost {
  readonly project: Project;
  readonly projectId: string;
  readonly hosts = new Map<string, SessionHost>();
  private readonly subscribers = new Set<ProjectSubscriber>();
  private readonly attachListeners: ((sessionId: string, host: SessionHost) => void)[] = [];
  private readonly dir: string;
  private flushTimer: NodeJS.Timeout | null = null;
  private detecting = false;

  constructor(private readonly opts: ProjectHostOptions) {
    this.projectId = opts.projectId;
    this.dir = join(opts.root, "projects", opts.projectId);
    mkdirSync(this.dir, { recursive: true });
    const path = join(this.dir, "ledger.json");
    this.project = existsSync(path)
      ? Project.fromSerialized(JSON.parse(readFileSync(path, "utf8")) as SerializedLedger)
      : Project.create(
          opts.projectId,
          opts.orgId,
          opts.teamId,
          opts.name,
          opts.policy ?? { autoClaimOnWrite: true, claimTtlTurns: 0 },
        );
    this.project.onEvent((e) => this.onProjectEvent(e));
    this.flush();
    // Reopen every session registered in this project that still has a log on disk.
    for (const id of listSessions(opts.root)) {
      const log = readLog(sessionDir(opts.root, id));
      const created = log?.events[MAIN_BRANCH]?.[0];
      if (created?.kind === "session.created" && created.payload.projectId === opts.projectId)
        this.session(id);
    }
  }

  state(): ProjectState {
    return this.project.state();
  }

  sessionStates(): Record<string, SessionState> {
    const out: Record<string, SessionState> = {};
    for (const [id, h] of this.hosts) out[id] = h.session.state();
    return out;
  }

  /** Get or create a session host in this project. */
  session(sessionId: string, create?: { title: string; ownerId: string | null }): SessionHost {
    let h = this.hosts.get(sessionId);
    if (h) return h;
    const base = {
      root: this.opts.root,
      sessionId,
      model: this.opts.model,
      tools: this.opts.tools,
      guard: this.guardFor(sessionId),
      memory: this.memoryFor(sessionId),
    };
    const withLog = this.opts.log ? { ...base, log: this.opts.log } : base;
    try {
      h = new SessionHost(withLog);
    } catch (err) {
      if (!create) throw err;
      h = new SessionHost({
        ...withLog,
        create: {
          title: create.title,
          policy: this.opts.sessionPolicy,
          projectId: this.projectId,
          ownerId: create.ownerId,
        },
      });
    }
    this.hosts.set(sessionId, h);
    const st = h.session.state();
    if (!this.project.state().sessions[sessionId]) {
      this.project.registerSession(sessionId, st.ownerId ?? create?.ownerId ?? "unknown", st.title);
    }
    syncDirectives(this.project.state(), sessionId, h.session);
    h.session.onEvent((e) => this.onSessionEvent(sessionId, e));
    for (const fn of this.attachListeners) fn(sessionId, h);
    return h;
  }

  closeSession(sessionId: string): void {
    const h = this.hosts.get(sessionId);
    if (!h) return;
    h.close();
    this.hosts.delete(sessionId);
    if (this.project.state().sessions[sessionId]?.open) this.project.closeSession(sessionId);
  }

  /** Called for every session host this project creates or reopens, including on construction. */
  onSessionAttached(fn: (sessionId: string, host: SessionHost) => void): void {
    this.attachListeners.push(fn);
    for (const [id, h] of this.hosts) fn(id, h);
  }

  subscribe(sub: ProjectSubscriber): void {
    this.subscribers.add(sub);
    sub.send({
      type: "project.snapshot",
      projectId: this.projectId,
      events: this.project.events(),
    });
  }

  unsubscribe(sub: ProjectSubscriber): void {
    this.subscribers.delete(sub);
  }

  brief(sinceSeq?: number): string {
    const opts =
      sinceSeq === undefined
        ? { sessions: this.sessionStates() }
        : { sessions: this.sessionStates(), sinceSeq };
    return fleetBrief(this.project.state(), opts);
  }

  /** A human claims on behalf of a session they own (or a lead on behalf of anyone). */
  claimFor(userId: string, sessionId: string, resource: Resource, mode: ClaimMode, reason: string) {
    const ss = this.project.state().sessions[sessionId];
    if (!ss) throw new Error(`unknown session ${sessionId}`);
    if (ss.ownerId !== userId && this.project.rankOf(userId) < 2)
      throw new Error("only the session owner or a lead claims for a session");
    return this.project.claim(sessionId, resource, mode, reason);
  }

  releaseFor(userId: string, sessionId: string, claimId: string) {
    const ss = this.project.state().sessions[sessionId];
    if (!ss) throw new Error(`unknown session ${sessionId}`);
    if (ss.ownerId !== userId && this.project.rankOf(userId) < 2)
      throw new Error("only the session owner or a lead releases for a session");
    return this.project.release(sessionId, claimId);
  }

  close(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    for (const h of this.hosts.values()) h.close();
    this.flush();
  }

  flush(): void {
    atomicWrite(join(this.dir, "ledger.json"), JSON.stringify(this.project.ledger.serialize()));
  }

  // ---- internals ---------------------------------------------------------------------

  private guardFor(sessionId: string): WorkspaceGuard {
    const project = this.project;
    const host = this;
    return {
      checkWrite(path) {
        const v = project.checkWrite(sessionId, path);
        if (v.ok) {
          if (project.state().policy.autoClaimOnWrite && project.state().sessions[sessionId]) {
            const held = Object.values(project.state().claims).some(
              (c) =>
                c.status === "active" &&
                c.sessionId === sessionId &&
                c.resource.type === "path" &&
                (c.resource.pattern === path ||
                  path.startsWith(
                    c.resource.pattern.endsWith("/")
                      ? c.resource.pattern
                      : `${c.resource.pattern}/`,
                  )),
            );
            if (!held)
              project.claim(
                sessionId,
                { type: "path", pattern: path },
                "exclusive",
                "auto-claim on write",
              );
          }
          return { ok: true };
        }
        project.recordViolation(sessionId, path, v.holder.id);
        return {
          ok: false,
          holderSessionId: v.holder.sessionId,
          holderOwner: project.state().members[v.holder.ownerId]?.name ?? v.holder.ownerId,
          claimId: v.holder.id,
        };
      },
      claim(resource, mode, reason) {
        const v = project.claim(sessionId, resource, mode, reason);
        const detail = v.granted
          ? `${reason || "no reason given"}`
          : `held by ${v.holders.map((h) => `${project.state().members[h.ownerId]?.name ?? h.ownerId}'s session (${h.reason || "no reason"})`).join(", ")}; contention ${v.contentionId} opened for the lead`;
        return { granted: v.granted, claimId: v.claimId, detail };
      },
      release(claimId) {
        project.release(sessionId, claimId);
        return `released ${claimId}`;
      },
      context() {
        return renderFleetContext(project.state(), sessionId);
      },
      reportStatus() {
        const h = host.hosts.get(sessionId);
        if (!h || !project.state().sessions[sessionId]) return;
        const st = h.session.state();
        const last = st.turns[st.turns.length - 1];
        project.reportStatus({
          sessionId,
          status: st.status,
          goal: st.intent.goal?.text ?? null,
          turn: st.turn,
          summary: last?.summary ?? "",
          activePaths: activePathsOf(st),
          pendingApprovals: Object.values(st.approvals).filter((a) => a.status === "pending")
            .length,
        });
        project.expireStale();
      },
    };
  }

  /** Attributed, scoped access to the org memory for one session. */
  private memoryFor(sessionId: string): MemoryAccess | undefined {
    const store = this.opts.memory;
    if (!store) return undefined;
    const scope = { orgId: this.opts.orgId, teamId: this.opts.teamId, projectId: this.projectId };
    const attribution = () => {
      const owner =
        this.project.state().sessions[sessionId]?.ownerId ??
        this.hosts.get(sessionId)?.session.state().ownerId ??
        "unknown";
      const name = this.project.state().members[owner]?.name;
      return { userId: owner, ...(name ? { userName: name } : {}), agentId: "agent", sessionId };
    };
    return {
      remember: (input) => {
        const r = store.remember({
          scope: input.path ? { ...scope, path: input.path } : scope,
          kind: input.kind ?? "fact",
          key: input.key ?? null,
          content: input.content,
          tags: input.tags ?? [],
          evidence: input.evidence ?? [],
          attribution: attribution(),
        });
        return r.conflictId
          ? `remembered ${r.entry.id}; it conflicts with another engineer's entry on [${r.entry.key}] (conflict ${r.conflictId}); a lead will resolve`
          : `remembered ${r.entry.id}${r.superseded.length ? ` (supersedes ${r.superseded.join(", ")})` : ""} as ${attribution().userName ?? attribution().userId}`;
      },
      recall: (query) => {
        const hits = store.recall(scope, query);
        if (!hits.length) return `nothing in team memory matches "${query}"`;
        return hits
          .map(
            (e) =>
              `- ${e.key ? `[${e.key}] ` : ""}${e.content.split("\n")[0]} (${e.attribution.userName ?? e.attribution.userId}${e.attribution.sessionId ? `, session ${e.attribution.sessionId}` : ""}${e.attribution.commitSha ? `, commit ${e.attribution.commitSha.slice(0, 7)}` : ""})`,
          )
          .join("\n");
      },
      context: () => store.contextFor(scope, sessionId),
    };
  }

  private onProjectEvent(e: ProjectEvent): void {
    for (const s of this.subscribers) s.send({ type: "project.event", event: e });
    this.scheduleFlush();
    const st = this.project.state();
    if (e.kind === "project.directive.submitted") {
      const d = st.directives[e.payload.directiveId];
      if (d) for (const [id, h] of this.hosts) propagateDirective(st, d, id, h.session);
    }
    if (e.kind === "project.directive.withdrawn") {
      const d = st.directives[e.payload.directiveId];
      if (d) for (const h of this.hosts.values()) withdrawPropagated(d, h.session);
    }
    if (e.kind === "fleet.contention.opened" || e.kind === "fleet.contention.resolved") {
      const c = st.contentions[e.payload.contentionId];
      if (c) this.mirror(c);
    }
    if (e.kind === "session.status.reported" || e.kind === "claim.granted") this.detect();
  }

  private onSessionEvent(sessionId: string, e: SessionEvent): void {
    if (e.kind === "branch.merged" && e.payload.conflicts.length) this.detect();
    if (e.kind === "participant.joined" && e.payload.actor.kind === "human") {
      const st = this.project.state();
      if (!st.members[e.payload.actor.id])
        this.project.join(e.payload.actor.id, e.payload.actor.name, "member");
    }
    void sessionId;
  }

  private detect(): void {
    if (this.detecting) return;
    this.detecting = true;
    try {
      const found: DetectedContention[] = detectFleetContentions(
        this.project.state(),
        this.sessionStates(),
      );
      for (const f of found)
        this.project.openContention(f.kind, f.sessionIds, f.resource, f.detail);
    } finally {
      this.detecting = false;
    }
  }

  private mirror(c: FleetContention): void {
    for (const id of c.sessionIds) {
      const h = this.hosts.get(id);
      if (!h) continue;
      for (const branch of h.session.branches()) {
        const existing = h.session.state(branch).fleetContentions[c.id];
        if (existing && existing.resolved === c.resolved) continue;
        h.session.mirrorContention(branch, c.id, c.kind, c.sessionIds, c.resource, c.resolved);
      }
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 20);
  }
}

export type { Actor };
