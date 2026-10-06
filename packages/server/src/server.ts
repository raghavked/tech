/**
 * Websocket and HTTP front door. One process hosts many projects; each project is a
 * ProjectHost owning its sessions. Phase-0 auth: an optional shared token plus a users.json
 * that maps asserted user ids to memberships; without it, the first human in owns a session.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { join } from "node:path";
import {
  CHAT_MESSAGE_TYPES,
  ChatClientMessage,
  type ChatDirectory,
  type ChatEvent,
  type ChatScope,
  type ChatServerMessage,
  memberName,
  memberOfMention,
  unreadIn,
} from "@henosis/chat";
import {
  deriveProjectRole,
  PROJECT_RANK,
  ProjectClientMessage,
  type ProjectEvent,
  TeamTheme,
} from "@henosis/fleet";
import { KernelError } from "@henosis/kernel";
import { Curator, MemoryStore, type SerializedMemory } from "@henosis/memory";
import {
  ClientMessage,
  DEFAULT_SESSION_POLICY,
  MAIN_BRANCH,
  type ServerMessage,
  type SessionEvent,
  type SessionPolicy,
} from "@henosis/protocol";
import type { Model, ToolRegistry } from "@henosis/runner";
import { type WebSocket, WebSocketServer } from "ws";
import { handleBranchApi } from "./branchApi.js";
import { ChatHost, type ChatSubscriber } from "./chatHost.js";
import { EXPORT_PATH, exportHeaders, exportSessionMarkdown } from "./export.js";
import type { ClientLink, SessionHost } from "./host.js";
import { memoryFeed, memoryQueryOf } from "./memoryQuery.js";
import { Notifier, type PushSubscription } from "./notify.js";
import { OrgRegistry } from "./orgs.js";
import { ProjectHost, type ProjectSubscriber } from "./projectHost.js";
import { atomicWrite, listSessions, readLog, sessionDir } from "./storage.js";
import { computeUsage, USAGE_PATH, usageQueryOf } from "./usageApi.js";

export interface ServerOptions {
  root: string;
  model: Model;
  tools: ToolRegistry;
  token?: string | undefined;
  defaultPolicy?: SessionPolicy;
  log?: (line: string) => void;
  /** Which adapters run beside this server; reported by GET /api/integrations. */
  integrations?: Partial<Integrations>;
}

/** settings-page hook point: adapters flip their flag here (the CLI's `slack` command does). */
export interface Integrations {
  slack: boolean;
}

const DEFAULT_POLICY: SessionPolicy = { ...DEFAULT_SESSION_POLICY };

type AnyClientMessage = ClientMessage | ProjectClientMessage | ChatClientMessage;
const AnyClientMessageSchema = ClientMessage.or(ProjectClientMessage).or(ChatClientMessage);

type OutgoingMessage =
  | ServerMessage
  | { type: "project.snapshot"; projectId: string; events: ProjectEvent[] }
  | { type: "project.event"; event: ProjectEvent }
  | { type: "fleet.brief"; markdown: string }
  | ChatServerMessage;

/** A mention of an agent that is waiting for the agent's next words. */
interface PendingReply {
  orgId: string;
  groupId: string;
  messageId: string;
  projectId: string;
  sessionId: string;
  /** The seq of the directive in the session; only later words answer it. */
  afterSeq: number;
}

export class HenosisServer {
  readonly projects = new Map<string, ProjectHost>();
  readonly orgs: OrgRegistry;
  readonly memories = new Map<string, MemoryStore>();
  /** One chat host per organisation, loaded on start and persisted on every event. */
  readonly chats = new Map<string, ChatHost>();
  readonly notifier: Notifier;
  /** Live adapter status; mutable so an adapter started after `listen` can report itself. */
  readonly integrations: Integrations;
  /** Display names learned from sessions and chat subscriptions for people users.json does not know. */
  private readonly names = new Map<string, string>();
  private readonly pendingReplies = new Map<string, PendingReply[]>();
  private http: Server | null = null;
  private wss: WebSocketServer | null = null;

  constructor(private readonly opts: ServerOptions) {
    this.orgs = new OrgRegistry(opts.root);
    this.notifier = new Notifier(opts.root, null, opts.log ?? (() => {}));
    this.integrations = { slack: false, ...opts.integrations };
    for (const o of this.orgs.orgs.orgs) this.chat(o.id);
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
        this.notifier.onSessionEvent(projectId, sessionId, e, participants, st.policy);
        if (e.kind === "participant.joined" && e.payload.actor.kind === "human")
          this.names.set(e.payload.actor.id, e.payload.actor.name);
        this.answerMentions(sessionId, e);
      });
    });
    return p;
  }

  // ---- groups and chats ------------------------------------------------------------------

  /** The organisation's chat host, persisted at store/chat/<org>.json. */
  chat(orgId: string): ChatHost {
    let c = this.chats.get(orgId);
    if (c) return c;
    if (!this.orgs.orgs.orgs.some((o) => o.id === orgId))
      throw new KernelError("not_found", `unknown organisation ${orgId}`);
    const base = { root: this.opts.root, orgId, directory: this.chatDirectory(orgId) };
    c = new ChatHost(this.opts.log ? { ...base, log: this.opts.log } : base);
    this.chats.set(orgId, c);
    const host = c;
    host.chat.onEvent((e) => this.onChatEvent(host, e));
    return c;
  }

  /** Who is in the organisation, which sessions it runs and who leads, as the chat needs them. */
  private chatDirectory(orgId: string): ChatDirectory {
    const org = () => this.orgs.orgs.orgs.find((o) => o.id === orgId);
    const projectIds = () => org()?.teams.flatMap((t) => t.projects.map((p) => p.id)) ?? [];
    const teamIds = () => org()?.teams.map((t) => t.id) ?? [];
    const inOrg = (userId: string) => {
      const u = this.orgs.user(userId);
      // Phase-0 identity: a person users.json does not know is in, as they are for projects
      // and sessions (first in owns); a known person is in only where their memberships say.
      if (!u) return true;
      return (
        u.orgs.some((o) => o.orgId === orgId) ||
        u.teams.some((t) => teamIds().includes(t.teamId)) ||
        u.projects.some((p) => projectIds().includes(p.projectId))
      );
    };
    return {
      person: (userId) => {
        if (!inOrg(userId)) return null;
        const u = this.orgs.user(userId);
        return { id: userId, name: u?.name ?? this.names.get(userId) ?? userId };
      },
      agent: (projectId, sessionId) => {
        if (!projectIds().includes(projectId)) return null;
        const ph = this.projects.get(projectId) ?? this.project(projectId);
        const ss = ph.state().sessions[sessionId];
        if (ss) return { projectId, sessionId, title: ss.title, ownerId: ss.ownerId };
        const sh = ph.hosts.get(sessionId);
        if (!sh) return null;
        const st = sh.session.state();
        return { projectId, sessionId, title: st.title, ownerId: st.ownerId };
      },
      isLead: (userId, scope) => this.isLead(userId, orgId, scope),
    };
  }

  /** A lead or admin for the scope: an org admin, a team lead or manager, a project lead or admin. */
  private isLead(userId: string, orgId: string, scope: ChatScope): boolean {
    const u = this.orgs.user(userId);
    if (!u) return false;
    if (u.orgs.some((o) => o.orgId === orgId && o.role === "admin")) return true;
    if (scope.projectId) {
      const ref = this.orgs.project(scope.projectId);
      const role = ref ? deriveProjectRole(u, ref) : null;
      if (role === "lead" || role === "admin") return true;
      if ((this.projects.get(scope.projectId)?.project.rankOf(userId) ?? 0) >= PROJECT_RANK.lead)
        return true;
    }
    if (scope.teamId && u.teams.some((t) => t.teamId === scope.teamId && t.role !== "member"))
      return true;
    return false;
  }

  /**
   * A message that mentions an agent member becomes a steer in that agent's session, in the
   * scope "chat", authored by the person who wrote it (joined as a contributor first when the
   * identity rules allow); a mention of a person lands in their inbox.
   */
  private onChatEvent(host: ChatHost, e: ChatEvent): void {
    if (e.kind !== "message.posted") return;
    const group = host.state().groups[e.payload.groupId];
    if (!group) return;
    const author = e.actor;
    const me = group.members.find((m) => m.kind === "human" && m.userId === author);
    const authorName = (me ? memberName(me) : null) ?? this.names.get(author) ?? author;
    for (const mention of e.payload.mentions) {
      const member = memberOfMention(group, mention);
      if (!member) continue;
      if (member.kind === "human") {
        if (member.userId === author) continue;
        this.notifier.notify(member.userId, {
          kind: "mention",
          title: `${authorName} mentioned you in #${group.name}`,
          body: e.payload.text.slice(0, 160),
          link: `henosis://c/${host.orgId}/${group.id}`,
          ref: e.payload.messageId,
        });
        continue;
      }
      try {
        const ph = this.project(member.projectId);
        const sh = ph.hosts.get(member.sessionId) ?? ph.session(member.sessionId);
        const st = sh.session.state();
        const ref = this.orgs.project(member.projectId);
        const joined = !st.participants[author];
        if (joined) {
          const derived = ref ? this.orgs.sessionRole(author, ref, st.ownerId) : null;
          if (derived === "observer") {
            this.opts.log?.(`chat: ${author} observes ${member.sessionId}; mention not relayed`);
            continue;
          }
          sh.session.join(
            MAIN_BRANCH,
            { id: author, kind: "human", name: authorName },
            derived ?? "contributor",
          );
        }
        const directive = sh.session.directive(MAIN_BRANCH, author, {
          text: `${authorName} in #${group.name}: ${e.payload.text}`,
          mode: "steer",
          scope: "chat",
        });
        if (joined) sh.session.leave(MAIN_BRANCH, author);
        const list = this.pendingReplies.get(member.sessionId) ?? [];
        list.push({
          orgId: host.orgId,
          groupId: group.id,
          messageId: e.payload.messageId,
          projectId: member.projectId,
          sessionId: member.sessionId,
          afterSeq: directive.seq,
        });
        this.pendingReplies.set(member.sessionId, list);
        void sh.drive();
      } catch (err) {
        this.opts.log?.(
          `chat: could not reach ${member.sessionId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /** The agent's next words after a mention (its model text, or the turn's summary) answer it in the group. */
  private answerMentions(sessionId: string, e: SessionEvent): void {
    const list = this.pendingReplies.get(sessionId);
    if (!list?.length || e.branch !== MAIN_BRANCH) return;
    let text: string | null = null;
    let turn = 0;
    if (e.kind === "agent.model.completed" && e.payload.text.trim()) {
      text = e.payload.text;
      turn = e.payload.turn;
    } else if (e.kind === "agent.turn.ended") {
      text = e.payload.summary.replace(/^(DONE|continuing):?\s*/i, "").trim() || e.payload.reason;
      turn = e.payload.turn;
    }
    if (text === null) return;
    const rest: PendingReply[] = [];
    for (const p of list) {
      if (e.seq <= p.afterSeq) {
        rest.push(p);
        continue;
      }
      try {
        this.chat(p.orgId).chat.agentReply(
          p.projectId,
          p.sessionId,
          p.groupId,
          p.messageId,
          text,
          turn,
        );
      } catch (err) {
        this.opts.log?.(
          `chat: reply from ${sessionId} dropped: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (rest.length) this.pendingReplies.set(sessionId, rest);
    else this.pendingReplies.delete(sessionId);
  }

  /** People and live agents a group can be made of, for the web app's pickers. */
  private chatDirectoryListing(orgId: string) {
    const org = this.orgs.orgs.orgs.find((o) => o.id === orgId);
    if (!org) throw new KernelError("not_found", `unknown organisation ${orgId}`);
    const dir = this.chatDirectory(orgId);
    const people = new Map<string, { id: string; name: string }>();
    for (const u of this.orgs.users.values()) {
      const p = dir.person(u.id);
      if (p) people.set(p.id, p);
    }
    for (const [id] of this.names) {
      const p = dir.person(id);
      if (p && !people.has(id)) people.set(id, p);
    }
    const agents: {
      projectId: string;
      projectName: string;
      sessionId: string;
      title: string;
      ownerId: string;
      live: string | null;
    }[] = [];
    for (const t of org.teams)
      for (const pr of t.projects) {
        const ph = this.project(pr.id);
        for (const m of Object.values(ph.state().members)) {
          const p = dir.person(m.userId);
          if (p && !people.has(p.id)) people.set(p.id, { id: p.id, name: m.name });
        }
        for (const s of Object.values(ph.state().sessions)) {
          if (!s.open) continue;
          agents.push({
            projectId: pr.id,
            projectName: pr.name,
            sessionId: s.sessionId,
            title: s.title,
            ownerId: s.ownerId,
            live: ph.hosts.get(s.sessionId)?.session.state().status ?? null,
          });
        }
      }
    return {
      people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name)),
      agents,
    };
  }

  /**
   * Hook point (e2e-expansion): a user whose users.json membership makes them a lead or admin
   * of a project is recorded in that project's ledger with the same role the first time they
   * join one of its sessions or subscribe to it, so the project directives and fleet
   * resolutions the web client offers them are accepted. Unknown users keep the member role
   * they get when they join a session; a ledger role is never lowered here.
   */
  private ensureLedgerRole(projectHost: ProjectHost, userId: string | null): void {
    const user = this.orgs.user(userId);
    const ref = this.orgs.project(projectHost.projectId);
    if (!user || !ref) return;
    const role = deriveProjectRole(user, ref);
    if (!role || role === "member") return;
    const current = projectHost.state().members[user.id];
    if (current && PROJECT_RANK[current.role] >= PROJECT_RANK[role]) return;
    projectHost.project.join(user.id, user.name, role);
  }

  /** Pending debounced memory writes by org; cleared on `close()`. */
  private readonly memoryTimers = new Map<string, NodeJS.Timeout>();
  private closed = false;

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
    m.onEvent(() => {
      // Debounced persist; `close()` clears it and writes the ledger itself, so nothing lands
      // after the store directory is gone.
      if (this.closed || this.memoryTimers.has(orgId)) return;
      this.memoryTimers.set(
        orgId,
        setTimeout(() => {
          this.memoryTimers.delete(orgId);
          atomicWrite(path, JSON.stringify(m?.ledger.serialize()));
        }, 20),
      );
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
    this.closed = true;
    for (const t of this.memoryTimers.values()) clearTimeout(t);
    this.memoryTimers.clear();
    for (const p of this.projects.values()) p.close();
    for (const c of this.chats.values()) c.close();
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
          // team-theme: the teams whose look this user may change (Settings, "Team look").
          styles: this.orgs.styledTeamsFor(userId),
        });
      }
      // team-theme: GET reads a team's look; PUT (a lead or manager of the team) sets or clears it.
      const tt = url.pathname.match(/^\/api\/teams\/([^/]+)\/theme$/);
      if (tt) {
        const teamId = decodeURIComponent(tt[1] as string);
        const found = this.orgs.team(teamId);
        if (!found) return json(404, { error: `unknown team ${teamId}` });
        if (req.method === "PUT") {
          if (this.opts.token && bearerOf(req, url) !== this.opts.token)
            return json(401, { error: "unauthorized" });
          const userId = url.searchParams.get("user");
          if (!this.orgs.canStyleTeam(userId, teamId))
            return json(403, { error: "only a lead or manager of the team can change its look" });
          void readBody(req).then((body) => {
            let parsed: unknown;
            try {
              parsed = JSON.parse(body || "{}");
            } catch {
              return json(400, { error: "bad json" });
            }
            const raw = (parsed as { theme?: unknown }).theme;
            if (raw === null) {
              this.orgs.setTeamTheme(teamId, null);
              return json(200, { teamId, name: found.team.name, theme: null });
            }
            const theme = TeamTheme.safeParse(raw ?? parsed);
            if (!theme.success)
              return json(400, {
                error: theme.error.issues
                  .map((i) => `${i.path.join(".")}: ${i.message}`)
                  .join("; "),
              });
            this.orgs.setTeamTheme(teamId, theme.data);
            return json(200, { teamId, name: found.team.name, theme: found.team.theme ?? null });
          });
          return true;
        }
        return json(200, { teamId, name: found.team.name, theme: found.team.theme ?? null });
      }
      if (url.pathname === "/api/orgs") return json(200, this.orgs.orgs);
      // token-usage: totals and breakdowns from the logs and ledgers on disk (usageApi.ts).
      if (url.pathname === USAGE_PATH)
        return json(
          200,
          computeUsage(
            { root: this.opts.root, projects: this.projects, orgs: this.orgs },
            usageQueryOf(url.searchParams),
          ),
        );
      if (url.pathname === "/api/integrations") return json(200, { ...this.integrations });
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
      // export-session hook: GET /api/sessions/:id/export.md renders the session as markdown.
      const ex = url.pathname.match(EXPORT_PATH);
      if (ex) {
        const sessionId = decodeURIComponent(ex[1] as string);
        const markdown = exportSessionMarkdown(
          { root: this.opts.root, projects: this.projects },
          sessionId,
        );
        res.writeHead(200, exportHeaders(sessionId, url.searchParams.get("download") === "1"));
        res.end(markdown);
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
        // memory-browser: optional ?level|team|project|status|q filters (memoryQuery.ts).
        return json(200, memoryFeed(store.state(), memoryQueryOf(url.searchParams)));
      }
      // Groups and chats: the folded state, a person's unread counts, and who can be a member.
      const cm = url.pathname.match(/^\/api\/chat\/([^/]+)(?:\/(unread|directory))?$/);
      if (cm) {
        const orgId = decodeURIComponent(cm[1] as string);
        const host = this.chat(orgId);
        if (cm[2] === "directory") return json(200, this.chatDirectoryListing(orgId));
        if (cm[2] === "unread") {
          const user = url.searchParams.get("user") ?? "";
          const st = host.state();
          const groups = Object.values(st.groups)
            .filter((g) => g.members.some((m) => m.kind === "human" && m.userId === user))
            .sort((a, b) => b.lastSeq - a.lastSeq)
            .map((g) => ({
              groupId: g.id,
              name: g.name,
              purpose: g.purpose,
              scope: g.scope,
              members: g.members.length,
              lastSeq: g.lastSeq,
              unread: unreadIn(st, user, g.id),
            }));
          return json(200, { total: groups.reduce((n, g) => n + g.unread, 0), groups });
        }
        return json(200, host.state());
      }
      // Branch compare and file read (branchApi.ts) sit under /api/projects/:p/sessions/:s/.
      if (handleBranchApi(url, (id) => this.project(id), json)) return true;
      const m = url.pathname.match(
        /^\/api\/projects\/([^/]+)(?:\/(sessions|brief|state|policy))?$/,
      );
      if (m) {
        const p = this.project(m[1] as string);
        if (m[2] === "brief") return json(200, { markdown: p.brief() });
        if (m[2] === "policy") return json(200, p.sessionPolicy());
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
    let chatHost: ChatHost | null = null;
    let chatSub: ChatSubscriber | null = null;
    let userId: string | null = null;
    const send = (msg: OutgoingMessage) => {
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
          this.ensureLedgerRole(projectHost, userId);
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
          host.joinWithRole(link, derived, msg.sinceSeq);
          return;
        }
        if (msg.type === "project.subscribe") {
          if (subscriber && projectHost) projectHost.unsubscribe(subscriber);
          projectHost = this.project(msg.projectId);
          userId = msg.userId ?? userId;
          this.ensureLedgerRole(projectHost, userId);
          subscriber = { userId, send };
          projectHost.subscribe(subscriber);
          return;
        }
        if (msg.type === "project.unsubscribe") {
          if (subscriber && projectHost) projectHost.unsubscribe(subscriber);
          subscriber = null;
          return;
        }
        if (msg.type === "chat.subscribe") {
          if (chatSub && chatHost) chatHost.unsubscribe(chatSub);
          userId = msg.userId;
          if (msg.name && !this.orgs.user(msg.userId)) this.names.set(msg.userId, msg.name);
          chatHost = this.chat(msg.orgId);
          chatSub = { userId, send };
          chatHost.subscribe(chatSub);
          return;
        }
        if (msg.type === "chat.unsubscribe") {
          if (chatSub && chatHost) chatHost.unsubscribe(chatSub);
          chatSub = null;
          return;
        }
        if (isChatMessage(msg)) {
          if (!chatHost) throw new KernelError("invalid", "subscribe to an organisation first");
          const me = userId ?? "anonymous";
          const chat = chatHost.chat;
          switch (msg.type) {
            case "chat.create":
              chat.createGroup(me, {
                name: msg.name,
                scope: msg.scope,
                purpose: msg.purpose,
                members: msg.members,
              });
              break;
            case "chat.add":
              chat.addMember(me, msg.groupId, msg.member);
              break;
            case "chat.remove":
              chat.removeMember(me, msg.groupId, msg.member);
              break;
            case "chat.rename":
              chat.rename(me, msg.groupId, msg.name, msg.purpose);
              break;
            case "chat.say":
              chat.post(me, msg.groupId, msg.text, msg.replyTo);
              break;
            case "chat.read":
              chat.read(me, msg.groupId);
              break;
          }
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
              projectHost.session(msg.sessionId, {
                title: msg.title,
                ownerId: me,
                policy: msg.policy,
              });
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
      if (chatSub && chatHost) chatHost.unsubscribe(chatSub);
    });
  }
}

function isChatMessage(m: AnyClientMessage): m is ChatClientMessage {
  return CHAT_MESSAGE_TYPES.has(m.type);
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

/** The shared token a write carries: `authorization: Bearer <token>` or `?token=`. */
function bearerOf(req: IncomingMessage, url: URL): string | null {
  const h = req.headers.authorization;
  if (typeof h === "string" && h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return url.searchParams.get("token");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
