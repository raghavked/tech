/**
 * Websocket and HTTP front door. One process hosts many projects; each project is a
 * ProjectHost owning its sessions. Phase-0 auth: an optional shared token plus a users.json
 * that maps asserted user ids to memberships; without it, the first human in owns a session.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { join } from "node:path";
import { ProjectClientMessage, type ProjectEvent } from "@fold/fleet";
import { KernelError } from "@fold/kernel";
import { Curator, MemoryStore, type SerializedMemory } from "@fold/memory";
import {
  ClientMessage,
  DEFAULT_APPROVAL_POLICY,
  type ServerMessage,
  type SessionPolicy,
} from "@fold/protocol";
import type { Model, ToolRegistry } from "@fold/runner";
import { type WebSocket, WebSocketServer } from "ws";
import type { ClientLink, SessionHost } from "./host.js";
import { Notifier, type PushSubscription } from "./notify.js";
import { OrgRegistry } from "./orgs.js";
import { ProjectHost, type ProjectSubscriber } from "./projectHost.js";
import { atomicWrite, listSessions, readLog, sessionDir } from "./storage.js";

export interface ServerOptions {
  root: string;
  model: Model;
  tools: ToolRegistry;
  token?: string | undefined;
  defaultPolicy?: SessionPolicy;
  log?: (line: string) => void;
}

const DEFAULT_POLICY: SessionPolicy = {
  approvals: DEFAULT_APPROVAL_POLICY,
  contention: "block",
  maxTurns: 200,
};

type AnyClientMessage = ClientMessage | ProjectClientMessage;
const AnyClientMessageSchema = ClientMessage.or(ProjectClientMessage);

export class FoldServer {
  readonly projects = new Map<string, ProjectHost>();
  readonly orgs: OrgRegistry;
  readonly memories = new Map<string, MemoryStore>();
  readonly notifier: Notifier;
  private http: Server | null = null;
  private wss: WebSocketServer | null = null;

  constructor(private readonly opts: ServerOptions) {
    this.orgs = new OrgRegistry(opts.root);
    this.notifier = new Notifier(opts.root, null, opts.log ?? (() => {}));
  }

  /** Get or create the host for a project known to the org registry (or "default"). */
  project(projectId: string): ProjectHost {
    let p = this.projects.get(projectId);
    if (p) return p;
    const ref = this.orgs.project(projectId);
    if (!ref) throw new KernelError("not_found", `unknown project ${projectId}`);
    const base = {
      root: this.opts.root,
      projectId,
      orgId: ref.orgId,
      teamId: ref.teamId,
      name: ref.name,
      model: this.opts.model,
      tools: this.opts.tools,
      sessionPolicy: this.opts.defaultPolicy ?? DEFAULT_POLICY,
      memory: this.memory(ref.orgId),
    };
    p = new ProjectHost(this.opts.log ? { ...base, log: this.opts.log } : base);
    this.projects.set(projectId, p);
    const host = p;
    host.project.onEvent((e) => {
      const leads = Object.values(host.state().members)
        .filter((m) => m.role !== "member")
        .map((m) => m.userId);
      this.notifier.onProjectEvent(projectId, e, leads);
    });
    host.onSessionAttached((sessionId, sh) => {
      sh.session.onEvent((e) => {
        const st = sh.session.state(e.branch);
        const participants = Object.values(st.participants).map((pp) => ({
          id: pp.actor.id,
          name: pp.actor.name,
          role: pp.role,
          isDriver: st.driver === pp.actor.id,
          kind: pp.actor.kind,
        }));
        this.notifier.onSessionEvent(projectId, sessionId, e, participants);
      });
    });
    return p;
  }

  /** The organisation's memory store, persisted at store/memory/<org>.json and curated on a timer. */
  memory(orgId: string): MemoryStore {
    let m = this.memories.get(orgId);
    if (m) return m;
    const dir = join(this.opts.root, "memory");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${orgId}.json`);
    m = existsSync(path)
      ? MemoryStore.fromSerialized(JSON.parse(readFileSync(path, "utf8")) as SerializedMemory)
      : MemoryStore.create(orgId);
    let timer: NodeJS.Timeout | null = null;
    m.onEvent(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        atomicWrite(path, JSON.stringify(m?.ledger.serialize()));
      }, 20);
    });
    this.memories.set(orgId, m);
    return m;
  }

  /** Run the curator over every loaded org memory; returns the reports. */
  curate() {
    const out: Record<string, ReturnType<Curator["tick"]>> = {};
    for (const [org, m] of this.memories) out[org] = new Curator(m).tick();
    return out;
  }

  /** Find which project a stored session belongs to, defaulting to "default". */
  projectOfSession(sessionId: string): string {
    for (const [id, p] of this.projects) if (p.hosts.has(sessionId)) return id;
    const log = readLog(sessionDir(this.opts.root, sessionId));
    const created = log?.events.main?.[0];
    return created?.kind === "session.created" ? created.payload.projectId : "default";
  }

  host(
    sessionId: string,
    title?: string,
    projectId?: string,
    ownerId: string | null = null,
  ): SessionHost {
    const pid = projectId ?? this.projectOfSession(sessionId);
    return this.project(pid).session(sessionId, { title: title ?? sessionId, ownerId });
  }

  sessions(): string[] {
    const ids = new Set(listSessions(this.opts.root));
    for (const p of this.projects.values()) for (const id of p.hosts.keys()) ids.add(id);
    return [...ids].sort();
  }

  listen(port: number, hostname = "127.0.0.1"): Promise<number> {
    const http = createServer((req, res) => this.handleHttp(req, res));
    const wss = new WebSocketServer({ server: http, path: "/ws" });
    wss.on("connection", (ws) => this.connection(ws));
    this.http = http;
    this.wss = wss;
    return new Promise((resolve) => {
      http.listen(port, hostname, () => {
        const addr = http.address();
        resolve(typeof addr === "object" && addr ? addr.port : port);
      });
    });
  }

  async close(): Promise<void> {
    for (const p of this.projects.values()) p.close();
    for (const [org, m] of this.memories)
      atomicWrite(
        join(this.opts.root, "memory", `${org}.json`),
        JSON.stringify(m.ledger.serialize()),
      );
    this.wss?.close();
    await new Promise<void>((r) => (this.http ? this.http.close(() => r()) : r()));
  }

  // ---- HTTP: read-only API for the web app --------------------------------------------

  private handleHttp(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(req.url ?? "/", "http://localhost");
    const json = (code: number, body: unknown): boolean => {
      res.writeHead(code, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      });
      res.end(JSON.stringify(body));
      return true;
    };
    try {
      if (url.pathname === "/health")
        return json(200, {
          ok: true,
          sessions: this.sessions(),
          projects: [...this.projects.keys()],
        });
      if (url.pathname === "/api/me") {
        const userId = url.searchParams.get("user");
        const user = this.orgs.user(userId);
        return json(200, {
          user: user ? { id: user.id, name: user.name } : null,
          projects: this.orgs.projectsFor(userId),
        });
      }
      if (url.pathname === "/api/orgs") return json(200, this.orgs.orgs);
      if (url.pathname === "/api/notifications") {
        const user = url.searchParams.get("user") ?? "";
        if (req.method === "POST") {
          void readBody(req).then((body) => {
            const ids = (JSON.parse(body || "{}") as { read?: string[] }).read ?? [];
            this.notifier.markRead(user, ids);
            json(200, { ok: true });
          });
          return true;
        }
        return json(200, {
          notifications: this.notifier.list(user, url.searchParams.get("unread") === "1"),
        });
      }
      if (url.pathname === "/api/push/subscribe" && req.method === "POST") {
        void readBody(req).then((body) => {
          const sub = JSON.parse(body) as PushSubscription;
          if (!sub.userId || !sub.platform || !sub.token)
            return json(400, { error: "userId, platform and token are required" });
          this.notifier.subscribe(sub);
          return json(200, {
            ok: true,
            subscriptions: this.notifier.subscriptions(sub.userId).length,
          });
        });
        return true;
      }
      const mm = url.pathname.match(/^\/api\/memory\/([^/]+)(?:\/(curate|context))?$/);
      if (mm) {
        const store = this.memory(mm[1] as string);
        if (mm[2] === "curate") return json(200, new Curator(store).tick());
        if (mm[2] === "context") {
          const scope = {
            orgId: mm[1] as string,
            ...(url.searchParams.get("team")
              ? { teamId: url.searchParams.get("team") as string }
              : {}),
            ...(url.searchParams.get("project")
              ? { projectId: url.searchParams.get("project") as string }
              : {}),
          };
          return json(200, {
            context: store.contextFor(scope, url.searchParams.get("user") ?? "api"),
          });
        }
        const st = store.state();
        return json(200, {
          orgId: st.orgId,
          seq: st.seq,
          entries: Object.values(st.entries),
          conflicts: Object.values(st.conflicts),
          compactions: st.compactions,
        });
      }
      const m = url.pathname.match(/^\/api\/projects\/([^/]+)(?:\/(sessions|brief|state))?$/);
      if (m) {
        const p = this.project(m[1] as string);
        if (m[2] === "brief") return json(200, { markdown: p.brief() });
        if (m[2] === "sessions") {
          const st = p.state();
          return json(
            200,
            Object.values(st.sessions).map((s) => {
              const h = p.hosts.get(s.sessionId);
              const live = h?.session.state() ?? null;
              return {
                ...s,
                live: live?.status ?? null,
                people: (h?.presence() ?? []).map((e) => ({
                  id: e.actor.id,
                  name: e.actor.name,
                  role: e.role,
                  online: e.online,
                  driving: live?.driver === e.actor.id,
                })),
              };
            }),
          );
        }
        return json(200, p.state());
      }
      res.writeHead(404);
      res.end();
      return false;
    } catch (err) {
      return json(err instanceof KernelError && err.code === "not_found" ? 404 : 500, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ---- websocket -----------------------------------------------------------------------

  private connection(ws: WebSocket): void {
    let host: SessionHost | null = null;
    let link: ClientLink | null = null;
    let projectHost: ProjectHost | null = null;
    let subscriber: ProjectSubscriber | null = null;
    let userId: string | null = null;
    const send = (
      msg:
        | ServerMessage
        | { type: "project.snapshot"; projectId: string; events: ProjectEvent[] }
        | { type: "project.event"; event: ProjectEvent }
        | { type: "fleet.brief"; markdown: string },
    ) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    };
    ws.on("message", (raw) => {
      let msg: AnyClientMessage;
      try {
        msg = AnyClientMessageSchema.parse(JSON.parse(raw.toString()));
      } catch (err) {
        send({
          type: "error",
          message: `bad message: ${err instanceof Error ? err.message : String(err)}`,
        });
        return;
      }
      try {
        if (msg.type === "join") {
          if (this.opts.token && msg.token !== this.opts.token) {
            send({ type: "error", message: "unauthorized" });
            ws.close();
            return;
          }
          if (host && link) host.leave(link);
          userId = msg.userId ?? msg.actor.id;
          const pid = msg.projectId ?? this.projectOfSession(msg.sessionId);
          projectHost = this.project(pid);
          const ref = this.orgs.project(pid);
          const existing = projectHost.hosts.get(msg.sessionId);
          const ownerForNew = existing ? null : userId;
          host = projectHost.session(msg.sessionId, {
            title: msg.title ?? msg.sessionId,
            ownerId: ownerForNew,
          });
          const sessionOwner = host.session.state().ownerId;
          const derived = ref ? this.orgs.sessionRole(userId, ref, sessionOwner) : null;
          link = { actor: msg.actor, branch: msg.branch, status: "", send };
          host.joinWithRole(link, derived);
          return;
        }
        if (msg.type === "project.subscribe") {
          if (subscriber && projectHost) projectHost.unsubscribe(subscriber);
          projectHost = this.project(msg.projectId);
          userId = msg.userId ?? userId;
          subscriber = { userId, send };
          projectHost.subscribe(subscriber);
          return;
        }
        if (msg.type === "project.unsubscribe") {
          if (subscriber && projectHost) projectHost.unsubscribe(subscriber);
          subscriber = null;
          return;
        }
        if (isProjectMessage(msg)) {
          if (!projectHost) throw new KernelError("invalid", "subscribe to a project first");
          const me = userId ?? "anonymous";
          switch (msg.type) {
            case "claim":
              projectHost.claimFor(me, msg.sessionId, msg.resource, msg.mode, msg.reason);
              break;
            case "release":
              projectHost.releaseFor(me, msg.sessionId, msg.claimId);
              break;
            case "project.directive":
              projectHost.project.directive(me, msg.input, msg.targets);
              break;
            case "project.withdraw":
              projectHost.project.withdrawDirective(me, msg.directiveId);
              break;
            case "fleet.resolve":
              projectHost.project.resolveContention(
                me,
                msg.contentionId,
                msg.winnerSessionId,
                msg.note,
              );
              break;
            case "fleet.brief":
              send({ type: "fleet.brief", markdown: projectHost.brief() });
              break;
            case "project.note":
              projectHost.project.note(me, msg.text);
              break;
            case "project.crew":
              projectHost.project.crew(me, msg.sessionId, msg.crew);
              break;
            case "session.create":
              projectHost.session(msg.sessionId, { title: msg.title, ownerId: me });
              break;
          }
          return;
        }
        if (!host || !link) {
          send({ type: "error", message: "join first" });
          return;
        }
        host.handle(link, msg);
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      }
    });
    ws.on("close", () => {
      if (host && link) host.leave(link);
      if (subscriber && projectHost) projectHost.unsubscribe(subscriber);
    });
  }
}

function isProjectMessage(m: AnyClientMessage): m is ProjectClientMessage {
  return [
    "claim",
    "release",
    "project.directive",
    "project.withdraw",
    "fleet.resolve",
    "fleet.brief",
    "project.note",
    "project.crew",
    "session.create",
    "project.subscribe",
    "project.unsubscribe",
  ].includes(m.type);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
