/**
 * Search over everything the team keeps, for `GET /api/search`:
 *
 *   GET /api/search?q=<text>&org=<id>&kind=<session|message|memory|person|agent>&user=<id>
 *
 * Sessions (title, goal, intent), messages (what people said to the agent or the team in a
 * session, what the agent said back, and what was said in a group chat), team memory (key,
 * content, tags, author), people and agents (by name, with where they are right now). The
 * query takes three typed filters inline, `from:<person> in:<place> kind:<kind>`, the way
 * the search page's syntax hint teaches them. Counts are per kind and add up to `total`.
 *
 * Live project hosts are read in memory so unflushed events count; sessions only on disk are
 * folded from their logs, as the usage report does. The store keeps a logical clock, so a
 * session message carries its `seq`; a chat message carries the wall-clock `at` it was posted.
 *
 * Saved searches ("Keep this search") are persisted in <root>/searches.json per user; a new
 * message in a session or a group that matches one becomes a `search` notification for the
 * person who kept it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChatState, Message } from "@henosis/chat";
import { Project, type ProjectState, type SerializedLedger } from "@henosis/fleet";
import { Session, type SessionState } from "@henosis/kernel";
import type { EntryRecord, MemoryState } from "@henosis/memory";
import type { SessionEvent } from "@henosis/protocol";
import { memoryFeed } from "./memoryQuery.js";
import type { OrgRegistry } from "./orgs.js";
import type { ProjectHost } from "./projectHost.js";
import { atomicWrite, listSessions, readLog, sessionDir } from "./storage.js";

export const SEARCH_PATH = "/api/search";
export const SAVED_SEARCH_PATH = /^\/api\/search\/saved(?:\/([^/]+))?$/;

export type SearchKind = "session" | "message" | "memory" | "person" | "agent";
export const SEARCH_KINDS: readonly SearchKind[] = [
  "session",
  "message",
  "memory",
  "person",
  "agent",
];

export interface SearchQuery {
  /** The free text, with the inline filters already taken out. */
  text: string;
  org?: string;
  kind?: SearchKind;
  /** `from:bo`: who said or wrote it (a user id or name, or an agent's owner). */
  from?: string;
  /** `in:#billing` or `in:Billing page`: a group, a session or a project. */
  in?: string;
  /** Most hits per kind; `kind` set lifts it. */
  limit?: number;
}

export interface SearchHit {
  kind: SearchKind;
  id: string;
  orgId: string;
  /** The serif name: the session's title, the author, the person, the agent, the memory key. */
  title: string;
  /** Where it lives, in words: "in Billing page", "to the team in Invoice PDF", "#billing". */
  where: string;
  /** The matched text, cut around the first match. */
  snippet: string;
  /** The web client's hash route. */
  route: string;
  link: string;
  projectId?: string;
  sessionId?: string;
  groupId?: string;
  who?: string;
  whoKind?: "human" | "agent";
  status?: string | null;
  seq?: number;
  at?: number;
  /** Memory: the key, the kind of entry, whether a conflict names it, and who added it. */
  key?: string;
  entryKind?: string;
  conflict?: boolean;
  attribution?: string;
  /** People: their role word and the session they drive now; agents: the owner. */
  role?: string;
  driving?: string;
  ownerId?: string;
  score: number;
}

export interface SearchResult {
  q: string;
  query: SearchQuery;
  scope: { orgId: string; orgName: string } | null;
  counts: Record<SearchKind, number>;
  total: number;
  hits: SearchHit[];
  tookMs: number;
  /** Wall-clock time of the search, so a client can print ages for chat hits. */
  at: number;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  q: string;
  org?: string;
  at: number;
}

export interface SearchSource {
  root: string;
  projects: Map<string, ProjectHost>;
  orgs: Pick<OrgRegistry, "orgs" | "users" | "project" | "user">;
  chats: Map<string, { orgId: string; state(): ChatState }>;
  memory: (orgId: string) => { state(): MemoryState };
  /** Display names learned from sessions for people users.json does not know. */
  names: Map<string, string>;
}

// ---- the query ----------------------------------------------------------------------------

const KIND_WORDS: Record<string, SearchKind> = {
  session: "session",
  sessions: "session",
  message: "message",
  messages: "message",
  memory: "memory",
  person: "person",
  people: "person",
  agent: "agent",
  agents: "agent",
};

/** `proration from:bo in:#billing kind:messages` → text and the three filters. */
export function parseQuery(raw: string): Pick<SearchQuery, "text" | "from" | "in" | "kind"> {
  const out: Pick<SearchQuery, "text" | "from" | "in" | "kind"> = { text: "" };
  const words: string[] = [];
  // A quoted value keeps its spaces: in:"Billing page".
  const re = /(\w+):("([^"]*)"|(\S+))|(\S+)/g;
  for (const m of raw.matchAll(re)) {
    const key = m[1]?.toLowerCase();
    const value = (m[3] ?? m[4] ?? "").trim();
    if (key === "from" && value) out.from = value;
    else if (key === "in" && value) out.in = value;
    else if (key === "kind" && value && KIND_WORDS[value.toLowerCase()])
      out.kind = KIND_WORDS[value.toLowerCase()] as SearchKind;
    else if (m[5]) words.push(m[5]);
    else if (m[0]) words.push(m[0]);
  }
  out.text = words.join(" ").trim();
  return out;
}

export function searchQueryOf(params: URLSearchParams): SearchQuery {
  const parsed = parseQuery(params.get("q") ?? "");
  const out: SearchQuery = { text: parsed.text };
  if (parsed.from) out.from = parsed.from;
  if (parsed.in) out.in = parsed.in;
  const kind = params.get("kind")?.trim().toLowerCase();
  const k = kind ? KIND_WORDS[kind] : parsed.kind;
  if (k) out.kind = k;
  const org = params.get("org")?.trim();
  if (org) out.org = org;
  const limit = Number(params.get("limit"));
  if (Number.isInteger(limit) && limit > 0) out.limit = limit;
  return out;
}

// ---- matching -----------------------------------------------------------------------------

/** 0 when `needle` is not in `hay`; higher for a match at the start or on a word boundary. */
export function scoreOf(needle: string, hay: string | null | undefined): number {
  if (!needle || !hay) return 0;
  const h = hay.toLowerCase();
  const at = h.indexOf(needle);
  if (at < 0) return 0;
  if (at === 0) return 3;
  return /[\s./:_#@-]/.test(h[at - 1] ?? "") ? 2 : 1;
}

/** The text cut to `width` around the first match, with ellipses where it was cut. */
export function snippetOf(needle: string, text: string, width = 160): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= width) return one;
  const at = needle ? one.toLowerCase().indexOf(needle) : -1;
  const start = at < 0 ? 0 : Math.max(0, Math.min(at - Math.floor(width / 3), one.length - width));
  const cut = one.slice(start, start + width);
  return `${start > 0 ? "…" : ""}${cut.trim()}${start + width < one.length ? "…" : ""}`;
}

function same(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b) && (a as string).toLowerCase() === (b as string).toLowerCase();
}

/** Does `from:` name this person or agent (by id, name, or the agent's owner)? */
function fromMatches(q: SearchQuery, ids: (string | undefined)[]): boolean {
  if (!q.from) return true;
  const want = q.from.replace(/^@/, "").toLowerCase();
  return ids.some((id) => id && id.toLowerCase() === want);
}

/** Does `in:` name this place (a session title, a project, a group)? */
function inMatches(q: SearchQuery, places: (string | undefined)[]): boolean {
  if (!q.in) return true;
  const want = q.in.replace(/^#/, "").toLowerCase();
  return places.some((p) => p && p.replace(/^#/, "").toLowerCase() === want);
}

// ---- sources ------------------------------------------------------------------------------

interface ProjectRow {
  orgId: string;
  orgName: string;
  teamId: string;
  projectId: string;
  name: string;
}

function projectRows(src: SearchSource, org?: string): ProjectRow[] {
  const out: ProjectRow[] = [];
  for (const o of src.orgs.orgs.orgs) {
    if (org && o.id !== org) continue;
    for (const t of o.teams)
      for (const p of t.projects)
        out.push({ orgId: o.id, orgName: o.name, teamId: t.id, projectId: p.id, name: p.name });
  }
  return out;
}

function ledgerOf(src: SearchSource, projectId: string): ProjectState | null {
  const live = src.projects.get(projectId);
  if (live) return live.state();
  const path = join(src.root, "projects", projectId, "ledger.json");
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as SerializedLedger;
    return Project.fromSerialized(data).state();
  } catch {
    return null;
  }
}

/** Every session with a log: live first, then the ones only on disk. */
function loadSessions(src: SearchSource): Map<string, Session> {
  const out = new Map<string, Session>();
  for (const host of src.projects.values())
    for (const [id, h] of host.hosts) out.set(id, h.session);
  const dir = join(src.root, "sessions");
  if (!existsSync(dir)) return out;
  for (const id of listSessions(src.root)) {
    if (out.has(id)) continue;
    try {
      const log = readLog(sessionDir(src.root, id));
      if (log) out.set(id, Session.fromSerialized(log));
    } catch {
      // a malformed id or log is simply not a session
    }
  }
  return out;
}

function nameOf(src: SearchSource, st: SessionState | null, userId: string): string {
  return (
    st?.participants[userId]?.actor.name ??
    src.orgs.user(userId)?.name ??
    src.names.get(userId) ??
    userId
  );
}

function agentNameOf(src: SearchSource, st: SessionState | null, ownerId: string | null): string {
  if (ownerId) return `${nameOf(src, st, ownerId)}'s agent`;
  const agent = st ? Object.values(st.participants).find((p) => p.actor.kind === "agent") : null;
  return agent?.actor.name ?? "The agent";
}

// ---- the search ---------------------------------------------------------------------------

export function search(src: SearchSource, q: SearchQuery, now = Date.now()): SearchResult {
  const t0 = performance.now();
  const needle = q.text.trim().toLowerCase();
  const counts: Record<SearchKind, number> = {
    session: 0,
    message: 0,
    memory: 0,
    person: 0,
    agent: 0,
  };
  const scopeOrg = q.org ? src.orgs.orgs.orgs.find((o) => o.id === q.org) : undefined;
  const scope = scopeOrg ? { orgId: scopeOrg.id, orgName: scopeOrg.name } : null;
  const hits: SearchHit[] = [];
  if (!needle && !q.from && !q.in) return done();

  const projects = projectRows(src, q.org);
  const byProject = new Map(projects.map((p) => [p.projectId, p]));
  const ledgers = new Map<string, ProjectState | null>();
  for (const p of projects) ledgers.set(p.projectId, ledgerOf(src, p.projectId));
  const sessions = loadSessions(src);
  const want = (k: SearchKind) => !q.kind || q.kind === k;

  // People: everyone users.json knows in these orgs, plus the names sessions taught us.
  const people = new Map<string, { id: string; name: string; role: string; projects: string[] }>();
  const addPerson = (id: string, name: string, role: string, project?: string) => {
    const p = people.get(id) ?? { id, name, role, projects: [] };
    if (project && !p.projects.includes(project)) p.projects.push(project);
    if (role !== "member" && p.role === "member") p.role = role;
    people.set(id, p);
  };
  const orgIds = new Set(projects.map((p) => p.orgId));
  for (const u of src.orgs.users.values()) {
    const inOrg =
      u.orgs.some((o) => orgIds.has(o.orgId)) ||
      u.teams.some((t) => projects.some((p) => p.teamId === t.teamId)) ||
      u.projects.some((pp) => byProject.has(pp.projectId));
    if (!q.org || inOrg) addPerson(u.id, u.name, u.orgs[0]?.role ?? u.teams[0]?.role ?? "member");
  }
  for (const [id, name] of src.names) if (!people.has(id)) addPerson(id, name, "member");
  for (const [projectId, ledger] of ledgers)
    for (const m of Object.values(ledger?.members ?? {}))
      addPerson(m.userId, m.name, m.role, byProject.get(projectId)?.name ?? projectId);

  // Sessions and the messages inside them.
  const driving = new Map<string, string>(); // userId -> session title
  for (const [sessionId, session] of sessions) {
    const st = session.state();
    const row = byProject.get(st.projectId);
    if (!row) continue;
    const ledgerRow = ledgers.get(st.projectId)?.sessions[sessionId];
    const title = st.title || ledgerRow?.title || sessionId;
    const ownerId = st.ownerId ?? ledgerRow?.ownerId ?? null;
    if (st.driver) driving.set(st.driver, title);
    for (const p of Object.values(st.participants))
      if (p.actor.kind === "human") addPerson(p.actor.id, p.actor.name, p.role, row.name);
    const link = `henosis://p/${row.projectId}/s/${sessionId}`;
    const route = `#/p/${row.projectId}/s/${sessionId}`;
    const goal = ledgerRow?.report?.goal ?? st.intent.goal?.text ?? "";
    const summary = ledgerRow?.report?.summary ?? "";
    const open = ledgerRow?.open ?? true;
    const status = st.status;

    if (want("session") && inMatches(q, [title, row.name]) && fromMatches(q, [ownerId ?? ""])) {
      const s = Math.max(
        scoreOf(needle, title) * 2,
        scoreOf(needle, sessionId),
        scoreOf(needle, goal),
        scoreOf(needle, summary),
      );
      if (s > 0 || (!needle && (q.from || q.in)))
        hits.push({
          kind: "session",
          id: `s:${sessionId}`,
          orgId: row.orgId,
          title,
          where: `in ${row.name}`,
          snippet: snippetOf(needle, goal || summary || ""),
          route,
          link,
          projectId: row.projectId,
          sessionId,
          status: open ? status : "closed",
          seq: st.seq,
          ...(ownerId ? { ownerId, who: nameOf(src, st, ownerId), whoKind: "human" } : {}),
          score: s + (open ? 0.5 : 0),
        });
    }

    if (want("agent") && inMatches(q, [title, row.name]) && fromMatches(q, [ownerId ?? ""])) {
      const agent = agentNameOf(src, st, ownerId);
      const s = Math.max(scoreOf(needle, agent), scoreOf(needle, "agent") > 0 ? 0.5 : 0);
      if (open && (s > 0 || (!needle && (q.from || q.in))))
        hits.push({
          kind: "agent",
          id: `a:${sessionId}`,
          orgId: row.orgId,
          title: agent,
          where: `in ${row.name}`,
          snippet: snippetOf(needle, title + (goal ? ` · ${goal}` : "")),
          route,
          link,
          projectId: row.projectId,
          sessionId,
          status,
          ...(ownerId ? { ownerId } : {}),
          score: s,
        });
    }

    if (!want("message") || !inMatches(q, [title, row.name])) continue;
    for (const e of session.events(st.branch)) {
      const m = messageOf(src, st, e, ownerId);
      if (!m) continue;
      if (!fromMatches(q, [m.actorId, m.actorName, m.ownerId])) continue;
      const s = scoreOf(needle, m.text);
      if (s === 0 && needle) continue;
      hits.push({
        kind: "message",
        id: `m:${sessionId}:${e.id}`,
        orgId: row.orgId,
        title: m.actorName,
        where: m.toTeam ? `to the team in ${title}` : `in ${title}`,
        snippet: snippetOf(needle, m.text),
        route,
        link,
        projectId: row.projectId,
        sessionId,
        who: m.actorName,
        whoKind: m.kind,
        seq: e.seq,
        score: s,
      });
    }
  }

  // Group chats: what people and agents said in the organisation's groups.
  if (want("message"))
    for (const chat of src.chats.values()) {
      if (q.org && chat.orgId !== q.org) continue;
      if (!orgIds.has(chat.orgId) && q.org) continue;
      const st = chat.state();
      for (const [groupId, messages] of Object.entries(st.messages)) {
        const group = st.groups[groupId];
        if (!group) continue;
        if (!inMatches(q, [`#${group.name}`, group.name])) continue;
        for (const msg of messages) {
          const who = chatAuthor(src, msg, sessions);
          if (!fromMatches(q, [who.id, who.name, who.ownerId])) continue;
          const s = scoreOf(needle, msg.text);
          if (s === 0 && needle) continue;
          hits.push({
            kind: "message",
            id: `c:${chat.orgId}:${msg.id}`,
            orgId: chat.orgId,
            title: who.name,
            where: `in #${group.name}`,
            snippet: snippetOf(needle, msg.text),
            route: `#/c/${chat.orgId}/${groupId}`,
            link: `henosis://c/${chat.orgId}/${groupId}`,
            groupId,
            who: who.name,
            whoKind: who.kind,
            at: msg.at,
            seq: msg.seq,
            score: s,
          });
        }
      }
    }

  // Team memory: live entries whose key, content, tags or author match.
  if (want("memory") && needle)
    for (const orgId of orgIds) {
      const st = src.memory(orgId).state();
      const feed = memoryFeed(st, { q: needle, status: ["active"] });
      const conflicted = new Set(
        feed.conflicts.filter((c) => !c.resolved).flatMap((c) => c.entryIds),
      );
      for (const e of feed.entries) {
        if (e.kind === "retraction") continue;
        const project = e.scope.projectId ? byProject.get(e.scope.projectId) : undefined;
        if (!fromMatches(q, [e.attribution.userId, e.attribution.userName])) continue;
        if (!inMatches(q, [project?.name, e.scope.teamId, orgId])) continue;
        const s = Math.max(
          scoreOf(needle, e.key) * 2,
          scoreOf(needle, e.content),
          ...e.tags.map((t) => scoreOf(needle, t)),
        );
        hits.push({
          kind: "memory",
          id: `e:${e.id}`,
          orgId,
          title: e.key ?? e.kind,
          where: project
            ? `in ${project.name}`
            : e.scope.teamId
              ? `in team ${e.scope.teamId}`
              : "org-wide",
          snippet: snippetOf(needle, e.content),
          route: memoryRoute(e, orgId),
          link: project
            ? e.attribution.sessionId
              ? `henosis://p/${project.projectId}/s/${e.attribution.sessionId}`
              : `henosis://p/${project.projectId}`
            : "henosis://inbox",
          ...(project ? { projectId: project.projectId } : {}),
          ...(e.attribution.sessionId ? { sessionId: e.attribution.sessionId } : {}),
          ...(e.key ? { key: e.key } : {}),
          entryKind: e.kind,
          conflict: conflicted.has(e.id),
          attribution: attributionOf(e),
          who: e.attribution.userName ?? e.attribution.userId,
          whoKind: e.attribution.agentId ? "agent" : "human",
          seq: e.seq,
          score: s,
        });
      }
    }

  // People: by name or id; the sentence says where they are.
  if (want("person"))
    for (const p of people.values()) {
      if (!fromMatches(q, [p.id, p.name])) continue;
      if (q.in && !p.projects.some((pr) => inMatches(q, [pr]))) continue;
      const s = Math.max(scoreOf(needle, p.name) * 2, scoreOf(needle, p.id));
      if (s === 0 && needle) continue;
      const drives = driving.get(p.id);
      hits.push({
        kind: "person",
        id: `p:${p.id}`,
        orgId: scope?.orgId ?? projects[0]?.orgId ?? "default",
        title: p.name,
        where: p.projects.length ? `in ${p.projects.slice(0, 3).join(", ")}` : "",
        snippet: drives
          ? `driving ${drives}`
          : p.projects.length
            ? `${p.projects.length} project${p.projects.length === 1 ? "" : "s"}`
            : "",
        route: drives ? routeOfSession(sessions, drives) : "#/",
        link: "henosis://inbox",
        role: p.role,
        ...(drives ? { driving: drives } : {}),
        score: s,
      });
    }

  return done();

  function done(): SearchResult {
    for (const h of hits) counts[h.kind] += 1;
    const order: Record<SearchKind, number> = {
      session: 0,
      agent: 1,
      person: 2,
      message: 3,
      memory: 4,
    };
    hits.sort(
      (a, b) =>
        order[a.kind] - order[b.kind] ||
        b.score - a.score ||
        (b.at ?? 0) - (a.at ?? 0) ||
        (b.seq ?? 0) - (a.seq ?? 0),
    );
    const cap = q.limit ?? (q.kind ? 200 : 40);
    const perKind: Record<SearchKind, number> = {
      session: 0,
      message: 0,
      memory: 0,
      person: 0,
      agent: 0,
    };
    const kept = hits.filter((h) => {
      perKind[h.kind] += 1;
      return perKind[h.kind] <= cap;
    });
    const total = SEARCH_KINDS.reduce((n, k) => n + counts[k], 0);
    return {
      q: q.text,
      query: q,
      scope,
      counts,
      total,
      hits: kept,
      tookMs: Math.max(0, Math.round((performance.now() - t0) * 100) / 100),
      at: now,
    };
  }
}

/** A session event that is something somebody said, or null. */
function messageOf(
  src: SearchSource,
  st: SessionState,
  e: SessionEvent,
  ownerId: string | null,
): {
  text: string;
  actorId: string;
  actorName: string;
  ownerId: string | undefined;
  kind: "human" | "agent";
  toTeam: boolean;
} | null {
  if (e.kind === "directive.submitted")
    return {
      text: e.payload.input.text,
      actorId: e.actor,
      actorName: nameOf(src, st, e.actor),
      ownerId: undefined,
      kind: "human",
      toTeam: false,
    };
  if (e.kind === "note.posted")
    return {
      text: e.payload.text,
      actorId: e.actor,
      actorName: nameOf(src, st, e.actor),
      ownerId: undefined,
      kind: "human",
      toTeam: true,
    };
  if (e.kind === "agent.model.completed" && e.payload.text.trim())
    return {
      text: e.payload.text,
      actorId: e.actor,
      actorName: agentNameOf(src, st, ownerId),
      ownerId: ownerId ?? undefined,
      kind: "agent",
      toTeam: false,
    };
  return null;
}

function chatAuthor(
  src: SearchSource,
  msg: Message,
  sessions: Map<string, Session>,
): { id: string; name: string; kind: "human" | "agent"; ownerId: string | undefined } {
  if (msg.author.kind === "human")
    return {
      id: msg.author.userId,
      name: nameOf(src, null, msg.author.userId),
      kind: "human",
      ownerId: undefined,
    };
  const st = sessions.get(msg.author.sessionId)?.state() ?? null;
  const ownerId = st?.ownerId ?? null;
  return {
    id: msg.author.sessionId,
    name: agentNameOf(src, st, ownerId),
    kind: "agent",
    ownerId: ownerId ?? undefined,
  };
}

function routeOfSession(sessions: Map<string, Session>, title: string): string {
  for (const [id, s] of sessions) {
    const st = s.state();
    if ((st.title || id) === title) return `#/p/${st.projectId}/s/${id}`;
  }
  return "#/";
}

function memoryRoute(e: EntryRecord, orgId: string): string {
  const p = new URLSearchParams();
  if (e.scope.teamId) p.set("team", e.scope.teamId);
  if (e.scope.projectId) p.set("project", e.scope.projectId);
  const qs = p.toString();
  return `#/memory/${orgId}${qs ? `?${qs}` : ""}`;
}

function attributionOf(e: EntryRecord): string {
  const a = e.attribution;
  const parts = [`added by ${a.userName ?? a.userId}`];
  if (a.sessionId) parts.push(`session ${a.sessionId}`);
  if (a.commitSha) parts.push(`commit ${a.commitSha.slice(0, 7)}`);
  return parts.join(" · ");
}

// ---- saved searches -----------------------------------------------------------------------

export class SavedSearches {
  private readonly path: string;
  private saved: SavedSearch[] = [];
  private counter = 0;

  constructor(root: string) {
    this.path = join(root, "searches.json");
    if (existsSync(this.path)) {
      try {
        const data = JSON.parse(readFileSync(this.path, "utf8")) as { saved: SavedSearch[] };
        this.saved = data.saved ?? [];
      } catch {
        this.saved = [];
      }
    }
  }

  list(userId: string): SavedSearch[] {
    return this.saved.filter((s) => s.userId === userId);
  }

  /** Keep a search; the same query kept twice by one person is one saved search. */
  save(userId: string, input: { name?: string; q: string; org?: string }): SavedSearch {
    const q = input.q.trim();
    if (!q) throw new Error("a saved search needs a query");
    const have = this.saved.find((s) => s.userId === userId && s.q === q && s.org === input.org);
    if (have) return have;
    this.counter += 1;
    const s: SavedSearch = {
      id: `ss${Date.now()}_${this.counter}`,
      userId,
      name: (input.name ?? "").trim() || q,
      q,
      ...(input.org ? { org: input.org } : {}),
      at: Date.now(),
    };
    this.saved.push(s);
    this.persist();
    return s;
  }

  remove(userId: string, id: string): boolean {
    const before = this.saved.length;
    this.saved = this.saved.filter((s) => !(s.userId === userId && s.id === id));
    if (this.saved.length === before) return false;
    this.persist();
    return true;
  }

  /**
   * The saved searches a new text matches, for everyone but its author: the notification
   * path behind "Keep this search · tells you when something new matches".
   */
  matching(text: string, meta: { author: string; place: string; orgId: string }): SavedSearch[] {
    const hay = text.toLowerCase();
    return this.saved.filter((s) => {
      if (s.userId === meta.author) return false;
      if (s.org && s.org !== meta.orgId) return false;
      const parsed = parseQuery(s.q);
      if (parsed.kind && parsed.kind !== "message") return false;
      if (parsed.text && !hay.includes(parsed.text.toLowerCase())) return false;
      if (parsed.from && !same(parsed.from.replace(/^@/, ""), meta.author)) return false;
      if (parsed.in && !same(parsed.in.replace(/^#/, ""), meta.place.replace(/^#/, "")))
        return false;
      return Boolean(parsed.text || parsed.from || parsed.in);
    });
  }

  private persist(): void {
    atomicWrite(this.path, JSON.stringify({ saved: this.saved }));
  }
}
