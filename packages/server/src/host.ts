/**
 * SessionHost: the single authoritative actor for one session. All clients' commands pass
 * through here, every event is persisted and fanned out, and one runner per branch drives
 * the agent. This is the shape a Durable Object or a single-partition actor would have.
 */
import { join } from "node:path";
import { handoffBrief, KernelError, Session } from "@fold/kernel";
import type {
  Actor,
  ClientMessage,
  PresenceEntry,
  Role,
  ServerMessage,
  SessionEvent,
  SessionPolicy,
} from "@fold/protocol";
import { MAIN_BRANCH, type ROLE_RANK } from "@fold/protocol";
import {
  type MemoryAccess,
  type Model,
  Runner,
  type ToolRegistry,
  type WorkspaceGuard,
} from "@fold/runner";
import { FileBlobStore, readLog, sessionDir, writeLog } from "./storage.js";

export interface ClientLink {
  actor: Actor;
  branch: string;
  status: string;
  send(msg: ServerMessage): void;
}

export interface HostOptions {
  root: string;
  sessionId: string;
  model: Model;
  tools: ToolRegistry;
  agent?: Actor;
  create?: { title: string; policy: SessionPolicy; projectId?: string; ownerId?: string | null };
  log?: (line: string) => void;
  /** Fleet hook supplied by a ProjectHost. */
  guard?: WorkspaceGuard | undefined;
  /** Organisation memory hook supplied by a ProjectHost. */
  memory?: MemoryAccess | undefined;
  /** Role to give a joining human, by actor id; falls back to first-in-owns. */
  roleFor?: ((actorId: string) => Role | null) | undefined;
}

const AGENT: Actor = { id: "agent", kind: "agent", name: "Agent" };

export class SessionHost {
  readonly session: Session;
  readonly sessionId: string;
  private readonly dir: string;
  private readonly clients = new Set<ClientLink>();
  private readonly runners = new Map<string, Runner>();
  private readonly agent: Actor;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(private readonly opts: HostOptions) {
    this.sessionId = opts.sessionId;
    this.dir = sessionDir(opts.root, opts.sessionId);
    this.agent = opts.agent ?? AGENT;
    const store = new FileBlobStore(join(this.dir, "blobs"));
    const existing = readLog(this.dir);
    if (existing) {
      this.session = Session.fromSerialized(existing, store);
    } else if (opts.create) {
      this.session = Session.create(opts.sessionId, opts.create.title, opts.create.policy, {
        store,
        projectId: opts.create.projectId ?? "default",
        ownerId: opts.create.ownerId ?? null,
      });
    } else {
      throw new KernelError("not_found", `no session ${opts.sessionId}`);
    }
    this.session.onEvent((e) => this.onEvent(e));
    this.flush();
    // Every participant who was present when the process died is now offline.
    for (const branch of this.session.branches()) {
      for (const p of Object.values(this.session.state(branch).participants)) {
        if (p.present && p.actor.kind === "human") this.session.leave(branch, p.actor.id);
      }
    }
    // Resume any branch whose turn was cut short.
    for (const branch of this.session.branches()) {
      if (this.session.state(branch).currentTurn) void this.runner(branch).drive();
    }
  }

  private onEvent(e: SessionEvent): void {
    for (const c of this.clients) if (c.branch === e.branch) c.send({ type: "event", event: e });
    this.scheduleFlush();
    if (
      e.kind === "participant.joined" ||
      e.kind === "participant.left" ||
      e.kind === "role.changed" ||
      e.kind === "handoff.accepted"
    ) {
      this.broadcastPresence();
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 20);
  }

  flush(): void {
    writeLog(this.dir, this.session.log.serialize());
  }

  close(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    for (const r of this.runners.values()) r.stop();
    this.flush();
  }

  /** Drive the agent on a branch until it has nothing to do (used by the project host and tests). */
  drive(branch: string = MAIN_BRANCH): Promise<void> {
    return this.runner(branch).drive();
  }

  private runner(branch: string): Runner {
    let r = this.runners.get(branch);
    if (!r) {
      const runnerOpts = {
        ...(this.opts.log ? { log: this.opts.log } : {}),
        guard: this.opts.guard,
        memory: this.opts.memory,
      };
      r = new Runner(
        this.session,
        branch,
        this.agent,
        this.opts.model,
        this.opts.tools,
        runnerOpts,
      );
      this.runners.set(branch, r);
    }
    return r;
  }

  presence(): PresenceEntry[] {
    const seen = new Map<string, PresenceEntry>();
    for (const c of this.clients) {
      const p = this.session.state(c.branch).participants[c.actor.id];
      seen.set(c.actor.id, {
        actor: c.actor,
        role: p?.role ?? "observer",
        branch: c.branch,
        status: c.status,
        online: true,
      });
    }
    for (const branch of this.session.branches()) {
      for (const p of Object.values(this.session.state(branch).participants)) {
        if (p.actor.kind !== "human" || seen.has(p.actor.id)) continue;
        seen.set(p.actor.id, { actor: p.actor, role: p.role, branch, status: "", online: false });
      }
    }
    return [...seen.values()].sort((a, b) => a.actor.id.localeCompare(b.actor.id));
  }

  private broadcastPresence(): void {
    const entries = this.presence();
    for (const c of this.clients) c.send({ type: "presence", entries });
  }

  /** Attach a client. The first human to join a fresh session becomes its owner. */
  join(link: ClientLink): void {
    this.joinWithRole(link, null);
  }

  /**
   * Attach a client with a role derived from identity; null falls back to first-in-owns.
   * `sinceSeq` (reconnect-resume) trims the snapshot to the events after that seq.
   */
  joinWithRole(link: ClientLink, derived: Role | null, sinceSeq?: number): void {
    const branch = this.session.log.hasBranch(link.branch) ? link.branch : MAIN_BRANCH;
    link.branch = branch;
    const st = this.session.state(branch);
    const hasOwner = Object.values(st.participants).some((p) => p.role === "owner");
    const existing = st.participants[link.actor.id];
    const fromOpts = this.opts.roleFor?.(link.actor.id) ?? null;
    const role =
      derived ?? fromOpts ?? (existing ? existing.role : hasOwner ? "contributor" : "owner");
    this.session.join(branch, link.actor, role);
    this.clients.add(link);
    link.send({ type: "joined", sessionId: this.sessionId, branch });
    link.send({ type: "snapshot", branch, events: this.eventsSince(branch, sinceSeq) });
    this.broadcastPresence();
  }

  /**
   * The events of a branch after `sinceSeq`, or the whole branch when `sinceSeq` is absent or
   * not a seq the branch holds (the client is ahead of a restored log, or on another branch).
   * Events on a branch have contiguous seqs from 0, so the slice is by index.
   */
  eventsSince(branch: string, sinceSeq?: number): SessionEvent[] {
    const all = this.session.events(branch);
    if (sinceSeq === undefined) return all;
    const at = all[sinceSeq];
    if (!at || at.seq !== sinceSeq) return all;
    return all.slice(sinceSeq + 1);
  }

  leave(link: ClientLink): void {
    if (!this.clients.delete(link)) return;
    const stillHere = [...this.clients].some(
      (c) => c.actor.id === link.actor.id && c.branch === link.branch,
    );
    if (!stillHere && this.session.state(link.branch).participants[link.actor.id]?.present) {
      this.session.leave(link.branch, link.actor.id);
    }
    this.broadcastPresence();
  }

  handle(link: ClientLink, msg: ClientMessage): void {
    const s = this.session;
    const b = link.branch;
    const me = link.actor.id;
    try {
      switch (msg.type) {
        case "join":
          throw new KernelError("invalid", "already joined");
        case "directive":
          s.directive(b, me, msg.input);
          break;
        case "withdraw":
          s.withdraw(b, me, msg.directiveId);
          break;
        case "resolve":
          s.resolve(b, me, msg.contentionId, msg.winner, msg.replacement);
          break;
        case "vote":
          s.vote(b, me, msg.approvalId, msg.vote);
          break;
        case "handoff.request":
          s.requestHandoff(b, me, msg.to);
          break;
        case "handoff.accept":
          s.acceptHandoff(b, me, msg.handoffId);
          break;
        case "handoff.decline":
          s.declineHandoff(b, me, msg.handoffId);
          break;
        case "role":
          s.setRole(b, me, msg.actorId, msg.role);
          break;
        case "checkpoint":
          s.checkpoint(b, me, msg.label);
          break;
        case "fork":
          s.fork(b, me, msg.branch, msg.fromCheckpoint);
          break;
        case "merge":
          s.merge(b, me, msg.source);
          break;
        case "switch": {
          if (!s.log.hasBranch(msg.branch))
            throw new KernelError("unknown_branch", `unknown branch ${msg.branch}`);
          const was = link.branch;
          this.clients.delete(link);
          this.leave({ ...link, branch: was });
          link.branch = msg.branch;
          const st = s.state(msg.branch);
          const role =
            st.participants[me]?.role ?? s.state(was).participants[me]?.role ?? "contributor";
          s.join(msg.branch, link.actor, role);
          this.clients.add(link);
          link.send({ type: "joined", sessionId: this.sessionId, branch: msg.branch });
          link.send({ type: "snapshot", branch: msg.branch, events: s.events(msg.branch) });
          this.broadcastPresence();
          break;
        }
        case "note":
          s.note(b, me, msg.text);
          break;
        case "presence":
          link.status = msg.status;
          this.broadcastPresence();
          return;
        case "brief":
          link.send({
            type: "brief",
            markdown: handoffBrief(s.state(b), { forActor: me, events: s.events(b) }),
          });
          return;
        case "leave":
          this.leave(link);
          return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      link.send({ type: "error", message });
      return;
    }
    void this.runner(b).drive();
  }

  /** Grant a role directly (used by the CLI demo and tests). */
  grant(branch: string, by: string, actorId: string, role: keyof typeof ROLE_RANK): void {
    this.session.setRole(branch, by, actorId, role);
  }
}
