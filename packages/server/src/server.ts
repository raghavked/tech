/**
 * Websocket and HTTP front door. One process hosts many projects; each project is a
 * ProjectHost owning its sessions. Phase-0 auth: an optional shared token plus a users.json
 * that maps asserted user ids to memberships; without it, the first human in owns a session.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
  CHAT_MESSAGE_TYPES,
  ChatClientMessage,
  type ChatDirectory,
  type ChatEvent,
  type ChatScope,
  type ChatServerMessage,
  councilLabel,
  councilsOf,
  type Group,
  memberName,
  memberOfMention,
  unreadIn,
} from "@henosis/chat";
import {
  type AgentProfile,
  deriveProjectRole,
  PROJECT_RANK,
  ProjectClientMessage,
  type ProjectEvent,
  TeamTheme,
} from "@henosis/fleet";
import { KernelError, type SerializedLog } from "@henosis/kernel";
import { Curator, MemoryStore, type SerializedMemory } from "@henosis/memory";
import {
  ClientMessage,
  DEFAULT_SESSION_POLICY,
  MAIN_BRANCH,
  type ServerMessage,
  type SessionEvent,
  type SessionPolicy,
  usageTotal,
} from "@henosis/protocol";
import { ClaudeModel, claudeAvailable, type Model, type ToolRegistry } from "@henosis/runner";
import { type RawData, type WebSocket, WebSocketServer } from "ws";
import { agentRow, handleAgentsApi } from "./agentsApi.js";
import { Auth, type AuthConfig, AuthError, type Principal } from "./auth.js";
import { handleBranchApi } from "./branchApi.js";
import { ChatHost, type ChatSubscriber } from "./chatHost.js";
import { CouncilHost } from "./councilHost.js";
import { EXPORT_PATH, exportHeaders, exportSessionMarkdown } from "./export.js";
import { computeGlance, GLANCE_PATH, type GlanceSource, UsageDays } from "./glance.js";
import type { ClientLink, SessionHost } from "./host.js";
import { memoryFeed, memoryQueryOf } from "./memoryQuery.js";
import { ModelFactory } from "./models.js";
import { Notifier, type PushSubscription } from "./notify.js";
import { OrgRegistry } from "./orgs.js";
import { ProjectHost, type ProjectSubscriber } from "./projectHost.js";
import { SAVED_SEARCH_PATH, SavedSearches, SEARCH_PATH, search, searchQueryOf } from "./search.js";
import { FileStore, type LiveStore, LogWriter } from "./store/index.js";
import { computeUsage, USAGE_PATH, usageQueryOf } from "./usageApi.js";

export interface ServerOptions {
  /** The store root: the file store's folder, and where blobs live in every edition. */
  root: string;
  /** The store every log and document is read from and flushed to; a `FileStore` on `root` when absent. */
  store?: LiveStore | undefined;
  model: Model;
  /**
   * The model a council member speaks through, from its profile (docs/19_council.md). By
   * default a `claude` profile gets the Claude model it names when a key is available, and
   * everything else speaks through `model`.
   */
  modelFor?: ((profile: AgentProfile) => Model) | undefined;
  tools: ToolRegistry;
  token?: string | undefined;
  /**
   * Identity (auth.ts): dev mode with `token` as the shared token when absent; oidc mode
   * verifies ID tokens from the provider named (`authConfigFromEnv` reads HENOSIS_OIDC_*).
   */
  auth?: AuthConfig | undefined;
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
  /** The storage seam (docs/04, "Storage"); the server owns it and closes it with itself. */
  readonly store: LiveStore;
  readonly projects = new Map<string, ProjectHost>();
  readonly orgs: OrgRegistry;
  readonly memories = new Map<string, MemoryStore>();
  /** One chat host per organisation, loaded on start and persisted on every event. */
  readonly chats = new Map<string, ChatHost>();
  /** One council host per organisation: it runs the councils its chat log convenes. */
  readonly councils = new Map<string, CouncilHost>();
  /** Claude models by model id, one per distinct id a member profile names. */
  private readonly claudeModels = new Map<string, Model>();
  readonly notifier: Notifier;
  /** Who is asking: dev-mode assertions or verified ID tokens (auth.ts). */
  readonly auth: Auth;
  /** Tokens per person per calendar day, for the glance's "tokens today" (glance.ts); a file under `root` in every edition. */
  readonly usageDays: UsageDays;
  /** "Keep this search": saved queries per person, persisted at <root>/searches.json. */
  readonly searches: SavedSearches;
  /** Live adapter status; mutable so an adapter started after `listen` can report itself. */
  readonly integrations: Integrations;
  /** Member models (docs/19_council.md): the `Model` a profile runs on, by provider and model id. */
  readonly models: ModelFactory;
  /** Display names learned from sessions and chat subscriptions for people users.json does not know. */
  private readonly names = new Map<string, string>();
  private readonly pendingReplies = new Map<string, PendingReply[]>();
  private http: Server | null = null;
  private wss: WebSocketServer | null = null;

  constructor(private readonly opts: ServerOptions) {
    this.store = opts.store ?? new FileStore(opts.root);
    this.orgs = new OrgRegistry(this.store);
    this.auth = new Auth(opts.auth ?? { mode: "dev", token: opts.token });
    this.notifier = new Notifier(this.store, null, opts.log ?? (() => {}));
    this.usageDays = new UsageDays(opts.root);
    this.searches = new SavedSearches(opts.root);
    // Every push payload carries the needs-you figure, so the badge and the tab agree.
    this.notifier.badge = (userId) => this.glance(userId).needsYou;
    this.integrations = { slack: false, ...opts.integrations };
    this.models = new ModelFactory({ log: opts.log });
    for (const o of this.orgs.orgs.orgs) this.chat(o.id);
  }

  /**
   * The glance for a person: what needs them, the top gate, the agents running and the
   * tokens today, over the projects identity gives them (every project for an unknown user,
   * as `/api/me` lists them).
   */
  glance(userId: string) {
    const projects: ProjectHost[] = [];
    for (const p of this.orgs.projectsFor(userId)) projects.push(this.project(p.projectId));
    for (const [id, p] of this.projects)
      if (!projects.some((x) => x.projectId === id)) projects.push(p);
    const user = this.orgs.user(userId);
    const src: GlanceSource = {
      projects,
      user: user ? { id: user.id, name: user.name } : null,
      roleIn: (projectId, ownerId) => {
        const ref = this.orgs.project(projectId);
        return ref ? this.orgs.sessionRole(userId, ref, ownerId) : null;
      },
      usageDays: this.usageDays,
    };
    return computeGlance(src, userId);
  }

  /** Get or create the host for a project known to the org registry (or "default"). */
  project(projectId: string): ProjectHost {
    let p = this.projects.get(projectId);
    if (p) return p;
    const ref = this.orgs.project(projectId);
    if (!ref) throw new KernelError("not_found", `unknown project ${projectId}`);
    const base = {
      root: this.opts.root,
      store: this.store,
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
      this.notifier.onProjectEvent(projectId, e, leads, host.state().name || ref.name);
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
        this.notifier.onSessionEvent(projectId, sessionId, e, participants, st.policy, {
          title: st.title,
          ownerId: st.ownerId,
          projectName: host.state().name || ref.name,
        });
        if (e.kind === "agent.model.completed" && e.payload.usage)
          this.usageDays.record(st.ownerId ?? "unknown", e.payload.usage);
        if (e.kind === "participant.joined" && e.payload.actor.kind === "human")
          this.names.set(e.payload.actor.id, e.payload.actor.name);
        this.answerMentions(sessionId, e);
        this.matchSavedSearches(projectId, sessionId, st.title || sessionId, e);
        this.notifier.settle(settledTags(st, e));
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
    const base = {
      root: this.opts.root,
      store: this.store,
      orgId,
      directory: this.chatDirectory(orgId),
    };
    c = new ChatHost(this.opts.log ? { ...base, log: this.opts.log } : base);
    this.chats.set(orgId, c);
    const host = c;
    host.chat.onEvent((e) => this.onChatEvent(host, e));
    // The council host (docs/19_council.md) runs what the chat log convenes, now and after a restart.
    const council = new CouncilHost({
      orgId,
      chat: host.chat,
      projectFor: (group) => this.projectForGroup(orgId, group),
      profile: (profileId) => this.orgs.agentProfile(profileId),
      modelFor: (profile) => this.memberModel(profile),
      personName: (userId) => this.orgs.user(userId)?.name ?? this.names.get(userId) ?? userId,
      onUsage: (userId, usage) => this.usageDays.record(userId, usage),
      log: this.opts.log,
    });
    this.councils.set(orgId, council);
    council.resume();
    return c;
  }

  /** The council host for an organisation (created with its chat host). */
  council(orgId: string): CouncilHost {
    this.chat(orgId);
    const c = this.councils.get(orgId);
    if (!c) throw new KernelError("not_found", `unknown organisation ${orgId}`);
    return c;
  }

  /**
   * The project a group's councils run their sessions in: the group's project, else the
   * first project of the group's team, else the org's first project.
   */
  private projectForGroup(orgId: string, group: Group): ProjectHost | null {
    const org = this.orgs.orgs.orgs.find((o) => o.id === orgId);
    if (!org) return null;
    const team = group.scope.teamId ? org.teams.find((t) => t.id === group.scope.teamId) : null;
    const projectId =
      group.scope.projectId ?? team?.projects[0]?.id ?? org.teams.flatMap((t) => t.projects)[0]?.id;
    return projectId ? this.project(projectId) : null;
  }

  /** The model a member profile speaks through; the scripted server model is the offline fallback. */
  private memberModel(profile: AgentProfile | null): Model {
    if (!profile) return this.opts.model;
    if (this.opts.modelFor) return this.opts.modelFor(profile);
    if (profile.provider === "claude" && claudeAvailable()) {
      const key = profile.model || "default";
      let m = this.claudeModels.get(key);
      if (!m) {
        m = profile.model ? new ClaudeModel(profile.model) : new ClaudeModel();
        this.claudeModels.set(key, m);
      }
      return m;
    }
    return this.opts.model;
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
      // Phase-0 identity (no users.json, no agents.json) takes member models on trust.
      ...(this.orgs.users.size > 0 || this.orgs.agents.agents.length > 0
        ? {
            profile: (profileId: string) => {
              const p = this.orgs.agentProfile(profileId);
              return p ? { id: p.id, name: p.name, ownerId: p.ownerId } : null;
            },
          }
        : {}),
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
  /** Something said in a session: a steer, a note to the team, or the agent's words. */
  private matchSavedSearches(
    projectId: string,
    sessionId: string,
    title: string,
    e: SessionEvent,
  ): void {
    const text =
      e.kind === "directive.submitted"
        ? e.payload.input.text
        : e.kind === "note.posted"
          ? e.payload.text
          : e.kind === "agent.model.completed"
            ? e.payload.text
            : null;
    if (!text?.trim()) return;
    const ref = this.orgs.project(projectId);
    const st = this.projects.get(projectId)?.hosts.get(sessionId)?.session.state();
    this.notifySavedSearches(text, {
      author: e.actor,
      authorName: st?.participants[e.actor]?.actor.name ?? this.names.get(e.actor) ?? e.actor,
      place: title,
      orgId: ref?.orgId ?? "default",
      link: `henosis://p/${projectId}/s/${sessionId}`,
      ref: e.id,
    });
  }

  /** The "Keep this search" path: a kept query that a new text matches lands in that inbox. */
  private notifySavedSearches(
    text: string,
    meta: {
      author: string;
      authorName: string;
      place: string;
      orgId: string;
      link: string;
      ref: string;
    },
  ): void {
    for (const s of this.searches.matching(text, meta))
      this.notifier.notify(s.userId, {
        kind: "search",
        who: meta.authorName,
        verb: "said",
        what: `something that matches “${s.name}”.`,
        body: `${meta.place} · ${text.replace(/\s+/g, " ").trim().slice(0, 140)}`,
        link: meta.link,
        route: `#/search?q=${encodeURIComponent(s.q)}`,
        tag: `search:${s.id}:${meta.ref}`,
        ref: s.id,
      });
  }

  private onChatEvent(host: ChatHost, e: ChatEvent): void {
    if (e.kind !== "message.posted") return;
    const group = host.state().groups[e.payload.groupId];
    if (!group) return;
    const author = e.actor;
    const me = group.members.find((m) => m.kind === "human" && m.userId === author);
    const authorName = (me ? memberName(me) : null) ?? this.names.get(author) ?? author;
    this.notifySavedSearches(e.payload.text, {
      author,
      authorName,
      place: `#${group.name}`,
      orgId: host.orgId,
      link: `henosis://c/${host.orgId}/${group.id}`,
      ref: e.payload.messageId,
    });
    for (const mention of e.payload.mentions) {
      const member = memberOfMention(group, mention);
      if (!member) continue;
      if (member.kind === "human") {
        if (member.userId === author) continue;
        this.notifier.notify(member.userId, {
          kind: "mention",
          who: authorName,
          verb: "mentioned you in",
          what: `#${group.name}`,
          body: e.payload.text.slice(0, 160),
          link: `henosis://c/${host.orgId}/${group.id}`,
          tag: `mention:${e.payload.messageId}`,
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
          // Decision 5: the rank is the identity rules' or contributor; a group role (creator,
          // host) never lifts a mention above what the session itself would grant.
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
        // The list and the open group both show the agent answering until its words land.
        host.startAnswering({
          groupId: group.id,
          projectId: member.projectId,
          sessionId: member.sessionId,
          messageId: e.payload.messageId,
          askedBy: author,
          since: e.payload.at || Date.now(),
        });
        void sh.drive().catch((err: unknown) => {
          host.stopAnswering(group.id, member.sessionId);
          this.opts.log?.(
            `chat: ${member.sessionId} stopped before answering: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      } catch (err) {
        host.stopAnswering(group.id, member.sessionId);
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
        // The agent left the group before answering, or the words did not fold: nothing waits.
        this.chats.get(p.orgId)?.stopAnswering(p.groupId, p.sessionId);
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
      /** What it is on: the goal, else the last summary; for the pickers' "what it is on" line. */
      doing: string | null;
      /** Tokens spent so far, for the pickers' spend figure. */
      tokens: number;
      crew: string | null;
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
          const live = ph.hosts.get(s.sessionId)?.session.state() ?? null;
          agents.push({
            projectId: pr.id,
            projectName: pr.name,
            sessionId: s.sessionId,
            title: s.title,
            ownerId: s.ownerId,
            live: live?.status ?? null,
            doing: goalText(live?.intent.goal) ?? s.report?.goal ?? s.report?.summary ?? null,
            tokens: usageTotal(live?.usage ?? s.report?.usage),
            crew: s.crew,
          });
        }
      }
    // The council (docs/19_council.md): the member models a group can convene, each person's
    // agent and the org's shared ones, as the convene sheet lists them.
    const models = this.orgs.agentProfiles().map((p) => ({
      profileId: p.id,
      name: p.name,
      ownerId: p.ownerId,
      provider: p.provider,
      model: p.model,
    }));
    return {
      // Each person with the member model they bring to a council and the model id it runs on.
      people: [...people.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ ...p, agent: agentRow(this.orgs.personalAgent(p.id, p.name)) })),
      agents,
      models,
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

  /** Flushes the memory logs through the store (one per org). */
  private readonly memoryWriters = new Map<string, LogWriter>();

  /** The organisation's memory store, persisted as the `memory` log of the org and curated on a timer. */
  memory(orgId: string): MemoryStore {
    let m = this.memories.get(orgId);
    if (m) return m;
    const existing = this.store.readLog("memory", orgId) as SerializedMemory | null;
    const writer = new LogWriter(this.store, "memory", orgId, existing);
    this.memoryWriters.set(orgId, writer);
    m = existing ? MemoryStore.fromSerialized(existing) : MemoryStore.create(orgId);
    const store = m;
    m.onEvent(() => {
      // Debounced persist; `close()` clears it and flushes the ledger itself, so nothing lands
      // after the store is closed.
      if (this.closed || this.memoryTimers.has(orgId)) return;
      this.memoryTimers.set(
        orgId,
        setTimeout(() => {
          this.memoryTimers.delete(orgId);
          writer.flush(store.ledger.serialize());
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
    const log = this.store.readLog("session", sessionId) as SerializedLog | null;
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
    const ids = new Set(this.store.listLogs("session"));
    for (const p of this.projects.values()) for (const id of p.hosts.keys()) ids.add(id);
    return [...ids].sort();
  }

  listen(port: number, hostname = "127.0.0.1"): Promise<number> {
    const http = createServer((req, res) => this.handleHttp(req, res));
    const wss = new WebSocketServer({ server: http, path: "/ws" });
    wss.on("connection", (ws, req) => this.connection(ws, req));
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
    for (const c of this.councils.values()) c.close();
    for (const p of this.projects.values()) p.close();
    for (const c of this.chats.values()) c.close();
    this.usageDays.flush();
    for (const [org, m] of this.memories) this.memoryWriters.get(org)?.flush(m.ledger.serialize());
    this.wss?.close();
    await new Promise<void>((r) => (this.http ? this.http.close(() => r()) : r()));
    await this.store.close();
  }

  // ---- HTTP: read-only API for the web app --------------------------------------------

  /**
   * Identity first: `GET /api/auth` says how to sign in; every other route is reached once the
   * bearer token (or `?token=`) has been read. In oidc mode a verified token names the person
   * and a `?user=` that disagrees with it is refused; a `?user=` without a token is refused;
   * a verified person who sent no `?user=` gets it filled in, so the routes below read one
   * field either way. Dev mode takes `?user=` at its word, as before.
   */
  private handleHttp(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? "/", "http://localhost");
    const json = jsonOn(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
      });
      res.end();
      return;
    }
    if (url.pathname === "/api/auth") {
      void this.auth.describe().then((d) => json(200, d));
      return;
    }
    void this.auth
      .authenticate({ token: bearerOf(req, url), userId: url.searchParams.get("user") })
      .then(
        (who) => {
          if (who?.verified) {
            this.orgs.resolve(who);
            if (!url.searchParams.get("user")) url.searchParams.set("user", who.userId);
          }
          this.route(req, res, url);
        },
        (err: unknown) =>
          json(err instanceof AuthError ? 401 : 500, {
            error: err instanceof Error ? err.message : String(err),
          }),
      );
  }

  private route(req: IncomingMessage, res: ServerResponse, url: URL): boolean {
    const json = jsonOn(res);
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
          if (!this.auth.acceptsSharedToken(bearerOf(req, url)))
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
      // Member models (agentsApi.ts): a person's own agent and the org's shared team agents.
      if (
        handleAgentsApi(
          req,
          url,
          {
            orgs: this.orgs,
            auth: this.auth,
            tools: this.opts.tools,
            models: this.models,
            nameOf: (id) => this.names.get(id) ?? null,
          },
          json,
        )
      )
        return true;
      // token-usage: totals and breakdowns from the logs and ledgers on disk (usageApi.ts).
      if (url.pathname === USAGE_PATH)
        return json(
          200,
          computeUsage(
            {
              root: this.opts.root,
              store: this.store,
              projects: this.projects,
              chats: this.chats,
              orgs: this.orgs,
            },
            usageQueryOf(url.searchParams),
          ),
        );
      if (url.pathname === "/api/integrations") return json(200, { ...this.integrations });
      // mobile-rail / widgets: the one needs-you number, the top gate, agents running, tokens today.
      if (url.pathname === GLANCE_PATH)
        return json(200, this.glance(url.searchParams.get("user") ?? ""));
      // search: one query over sessions, messages, memory, people and agents (search.ts).
      if (url.pathname === SEARCH_PATH)
        return json(
          200,
          search(
            {
              root: this.opts.root,
              projects: this.projects,
              orgs: this.orgs,
              chats: this.chats,
              memory: (org) => this.memory(org),
              names: this.names,
            },
            searchQueryOf(url.searchParams),
          ),
        );
      // "Keep this search": a person's saved queries; a new match becomes a notification.
      const ss = url.pathname.match(SAVED_SEARCH_PATH);
      if (ss) {
        const user = url.searchParams.get("user") ?? "";
        if (!user) return json(400, { error: "user is required" });
        if (req.method === "POST") {
          void readBody(req).then((body) => {
            try {
              const input = JSON.parse(body || "{}") as { name?: string; q?: string; org?: string };
              const saved = this.searches.save(user, {
                q: input.q ?? "",
                ...(input.name ? { name: input.name } : {}),
                ...(input.org ? { org: input.org } : {}),
              });
              json(200, { saved, searches: this.searches.list(user) });
            } catch (err) {
              json(400, { error: err instanceof Error ? err.message : String(err) });
            }
          });
          return true;
        }
        if (req.method === "DELETE" && ss[1]) {
          const removed = this.searches.remove(user, decodeURIComponent(ss[1]));
          return json(removed ? 200 : 404, { ok: removed, searches: this.searches.list(user) });
        }
        return json(200, { searches: this.searches.list(user) });
      }
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
          needsYou: this.glance(user).needsYou,
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
          { root: this.opts.root, store: this.store, projects: this.projects },
          sessionId,
        );
        res.writeHead(200, exportHeaders(sessionId, url.searchParams.get("download") === "1"));
        res.end(markdown);
        return true;
      }
      const mm = url.pathname.match(/^\/api\/memory\/([^/]+)(?:\/(curate|context|keep|retract))?$/);
      if (mm) {
        const store = this.memory(mm[1] as string);
        if (mm[2] === "curate") return json(200, new Curator(store).tick());
        // memory-browser: a person keeps one side of a conflict or retracts an entry, in their
        // name. Any contributor to the scope may (Decision 1): a member of the org, or of the
        // team or project the request names; an observer may not, and the curator never does.
        if (mm[2] === "keep" || mm[2] === "retract") {
          if (req.method !== "POST") return json(405, { error: "POST" });
          if (this.opts.token && bearerOf(req, url) !== this.opts.token)
            return json(401, { error: "unauthorized" });
          const userId = url.searchParams.get("user") ?? "";
          const user = this.orgs.user(userId);
          if (!user) return json(403, { error: "sign in as a person to change team memory" });
          const standing = this.orgs.memoryRole(user.id, mm[1] as string, {
            ...(url.searchParams.get("team") ? { teamId: url.searchParams.get("team") ?? "" } : {}),
            ...(url.searchParams.get("project")
              ? { projectId: url.searchParams.get("project") ?? "" }
              : {}),
          });
          if (standing === "observer")
            return json(403, {
              error:
                "only a contributor to this team's memory can keep or retract what it remembers",
            });
          const act = mm[2];
          void readBody(req).then((body) => {
            let parsed: {
              conflictId?: string;
              winnerId?: string | null;
              entryId?: string;
              reason?: string;
              note?: string;
            };
            try {
              parsed = JSON.parse(body || "{}") as typeof parsed;
            } catch {
              return json(400, { error: "bad json" });
            }
            try {
              if (act === "keep") {
                if (!parsed.conflictId) return json(400, { error: "conflictId" });
                store.resolveConflict(
                  user.id,
                  parsed.conflictId,
                  parsed.winnerId ?? null,
                  parsed.note ?? "",
                );
                const c = store.state().conflicts[parsed.conflictId];
                // The loser is retracted in the person's name, as the foot of the card says.
                if (c?.winnerId)
                  for (const id of c.entryIds)
                    if (id !== c.winnerId && store.state().entries[id]?.status !== "retracted")
                      store.retract(
                        { userId: user.id, userName: user.name },
                        id,
                        parsed.note ||
                          `kept ${store.state().entries[c.winnerId]?.key ?? "the other side"}`,
                      );
              } else {
                if (!parsed.entryId) return json(400, { error: "entryId" });
                store.retract(
                  { userId: user.id, userName: user.name },
                  parsed.entryId,
                  parsed.reason ?? "",
                );
              }
              return json(200, memoryFeed(store.state(), memoryQueryOf(url.searchParams)));
            } catch (err) {
              return json(400, { error: err instanceof Error ? err.message : String(err) });
            }
          });
          return true;
        }
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
      // The council (docs/19_council.md): one council with what its session says of the vote.
      const cc = url.pathname.match(/^\/api\/chat\/([^/]+)\/councils(?:\/([^/]+))?$/);
      if (cc) {
        const orgId = decodeURIComponent(cc[1] as string);
        const council = this.council(orgId);
        if (cc[2]) return json(200, council.view(decodeURIComponent(cc[2])));
        return json(200, {
          councils: Object.values(council.chat.state().councils)
            .sort((a, b) => b.lastSeq - a.lastSeq)
            .map((c) => council.view(c.id)),
        });
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
              // The council (docs/19_council.md): the rail's card under the group.
              councils: councilsOf(st.councils ?? {}, g.id).map((c) => ({
                councilId: c.id,
                task: c.task,
                models: c.members.some((m) => m.profileId === c.chair.profileId)
                  ? c.members.length
                  : c.members.length + 1,
                status: c.status,
                label: councilLabel(c),
                lastSeq: c.lastSeq,
              })),
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

  private connection(ws: WebSocket, req?: IncomingMessage): void {
    let host: SessionHost | null = null;
    let link: ClientLink | null = null;
    let projectHost: ProjectHost | null = null;
    let subscriber: ProjectSubscriber | null = null;
    let chatHost: ChatHost | null = null;
    let chatSub: ChatSubscriber | null = null;
    let userId: string | null = null;
    /** A token on the upgrade request (`authorization` header or `?token=`) covers every message without one. */
    const connToken = req ? bearerOf(req, new URL(req.url ?? "/", "http://localhost")) : null;
    const send = (msg: OutgoingMessage) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    };
    /**
     * Identity: who this message is from. A refusal is sent as an `unauthorized…` error (the
     * web client stops re-dialling on it); in oidc mode the verified person is remembered in
     * the org registry, with the memberships their groups grant, before roles are derived.
     */
    const identify = async (
      token: string | undefined,
      asserted: string | null | undefined,
      name?: string,
      enforceShared = false,
    ): Promise<Principal | null> => {
      const who = await this.auth.authenticate({
        token: token ?? connToken,
        userId: asserted,
        name,
        enforceShared,
      });
      if (who?.verified) this.orgs.resolve(who);
      return who;
    };
    // Messages are handled one after another, in order, so a verification in flight for a
    // `join` finishes before the directive that follows it is looked at.
    let chain: Promise<void> = Promise.resolve();
    ws.on("message", (raw) => {
      chain = chain.then(() => handle(raw));
    });
    const handle = async (raw: RawData): Promise<void> => {
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
          let who: Principal | null;
          try {
            who = await identify(msg.token, msg.userId ?? msg.actor.id, msg.actor.name, true);
          } catch (err) {
            send({
              type: "error",
              message: err instanceof AuthError ? err.message : "unauthorized",
            });
            ws.close();
            return;
          }
          if (host && link) host.leave(link);
          // oidc: the actor is who the token says, by the server's hand, not the client's.
          const actor = who?.verified
            ? { ...msg.actor, id: who.userId, name: who.name ?? msg.actor.name }
            : msg.actor;
          userId = msg.userId ?? actor.id;
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
          link = { actor, branch: msg.branch, status: "", send };
          host.joinWithRole(link, derived, msg.sinceSeq, msg.attempt ?? 0);
          return;
        }
        if (msg.type === "project.subscribe") {
          await identify(msg.token, msg.userId ?? userId);
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
          await identify(msg.token, msg.userId, msg.name);
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
            // The council (docs/19_council.md): the log records it here; the rounds run in
            // the council host.
            case "chat.council.convene":
              chat.convene(me, msg.groupId, {
                task: msg.task,
                members: msg.members,
                ...(msg.chair ? { chair: msg.chair } : {}),
                rounds: msg.rounds,
                discussionRounds: msg.discussionRounds,
                budget: msg.budget,
              });
              break;
            case "chat.council.instruct":
              chat.instruct(me, msg.councilId, msg.profileId, msg.text);
              break;
            case "chat.council.end":
              chat.endCouncil(me, msg.councilId, msg.summary);
              break;
            case "chat.role":
              chat.setRole(me, msg.groupId, msg.userId, msg.role);
              break;
            case "chat.check":
              send({ type: "chat.name", name: msg.name, free: chat.nameFree(msg.name) });
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
            case "project.policy":
              projectHost.project.setPolicy(me, msg.policy);
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
    };
    ws.on("close", () => {
      if (host && link) host.leave(link);
      if (subscriber && projectHost) projectHost.unsubscribe(subscriber);
      if (chatSub && chatHost) chatHost.unsubscribe(chatSub);
    });
  }
}

/** The goal as one line, whatever shape the intent keeps it in. */
function goalText(goal: unknown): string | null {
  if (!goal) return null;
  if (typeof goal === "string") return goal;
  if (typeof goal === "object" && "text" in goal && typeof goal.text === "string") return goal.text;
  return null;
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
    "project.policy",
    "session.create",
    "project.subscribe",
    "project.unsubscribe",
  ].includes(m.type);
}

/** A JSON reply with the CORS header the web app's dev server and the shells rely on. */
function jsonOn(res: ServerResponse): (code: number, body: unknown) => boolean {
  return (code, body) => {
    res.writeHead(code, {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    });
    res.end(JSON.stringify(body));
    return true;
  };
}

/** The token a request carries: `authorization: Bearer <token>` or `?token=` (dev: the shared token; oidc: the ID token). */
function bearerOf(req: IncomingMessage, url: URL): string | null {
  const h = req.headers.authorization;
  if (typeof h === "string" && h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return url.searchParams.get("token");
}

/** The notification tags a session event settles: the thing behind them is no longer waiting. */
function settledTags(
  st: { approvals: Record<string, { status: string }>; plans: Record<string, { status: string }> },
  e: SessionEvent,
): string[] {
  switch (e.kind) {
    case "approval.voted":
      return st.approvals[e.payload.approvalId]?.status === "pending"
        ? []
        : [`approval:${e.payload.approvalId}`];
    case "handoff.accepted":
    case "handoff.declined":
      return [`handoff:${e.payload.handoffId}`];
    case "plan.decided":
      return [`plan:${e.payload.planId}`];
    case "plan.rated":
      // A rating can decide the plan by policy; once it is no longer proposed, the item is settled.
      return st.plans[e.payload.planId]?.status === "proposed" ? [] : [`plan:${e.payload.planId}`];
    default:
      return [];
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
