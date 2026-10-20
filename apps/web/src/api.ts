/** The read-only HTTP API of the Henosis server, plus a small fetch hook. */
import type { ChatScope, ChatState, Council, CouncilStatus } from "@henosis/chat";
import type { ProjectState, SessionSummary, TeamTheme } from "@henosis/fleet";
import type { SessionStatus } from "@henosis/kernel";
import type { CuratorReport, EntryRecord, MemoryConflict } from "@henosis/memory";
import type { SessionPolicy, UsageQuery, UsageReport } from "@henosis/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders } from "./identity.js";
import { apiUrl } from "./shell.js";

export interface ProjectRef {
  orgId: string;
  orgName: string;
  teamId: string;
  teamName: string;
  projectId: string;
  name: string;
}

export interface Me {
  user: { id: string; name: string } | null;
  projects: ProjectRef[];
  /** team-theme: the teams whose look this user may change (a lead or manager of them). */
  styles?: string[];
}

/** team-theme: how a team looks; the zod shape lives in @henosis/fleet (identity.ts). */
export type { TeamTheme };
export interface TeamThemeResponse {
  teamId: string;
  name: string;
  theme: TeamTheme | null;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  online: boolean;
  driving: boolean;
}
export type SessionRow = SessionSummary & { live: SessionStatus | null; people: Person[] };

/** The aside's "At this scope" figures (packages/server/src/memoryQuery.ts `MemoryStats`). */
export interface MemoryStats {
  entries: number;
  openConflicts: number;
  retracted: number;
  readInLastHour: number;
  oldestStillRead: { id: string; key: string | null; seq: number; at: number } | null;
  readersInLastHour: number;
  now: number;
}

export interface MemoryFeed {
  orgId: string;
  seq: number;
  entries: EntryRecord[];
  conflicts: MemoryConflict[];
  compactions: {
    scopeKey: string;
    level: number;
    summaryId: string;
    folded: number;
    seq: number;
  }[];
  stats: MemoryStats;
}

/** Optional filters on the memory feed; see packages/server/src/memoryQuery.ts. */
export interface MemoryQuery {
  level?: "org" | "team" | "project";
  team?: string;
  project?: string;
  /** Comma-separated entry statuses. */
  status?: string;
  q?: string;
}

/**
 * One sentence at three distances (toast, OS banner, inbox row): `who · verb · what` with the
 * mono part in `code`, a `body` that says where and what it means for you, a `tag` so a repeat
 * replaces, the client `route` beside the deep `link`, and the `age` when listed. The grammar
 * fields are optional for an older server, which sends `title` and `body` only.
 */
export interface Notification {
  id: string;
  userId: string;
  kind:
    | "approval"
    | "handoff"
    | "contention"
    | "done"
    | "blocked"
    | "plan"
    | "mention"
    | "joined"
    | "search";
  title: string;
  body: string;
  who?: string;
  verb?: string;
  what?: string;
  code?: string;
  /** henosis://p/<project>/s/<session>, or henosis://c/<org>/<group> for a mention */
  link: string;
  route?: string;
  tag?: string;
  /** The approvalId, handoffId, contentionId, planId or messageId behind the item, when there is one to act on. */
  ref?: string;
  /** An approval under a release gate: Approve carries a 1..5 rating. */
  ratings?: boolean;
  at: number;
  age?: number;
  read: boolean;
}

/**
 * A council as the rail shows it (docs/19_council.md): one row per council in a group of
 * GET /api/chat/:org/unread, with the models' count and the label of where it stands.
 */
export interface CouncilRailRow {
  councilId: string;
  task: string;
  models: number;
  status: CouncilStatus;
  label: string;
  lastSeq: number;
}

/** One row of GET /api/chat/:org/unread: a group the person belongs to and what is new in it. */
export interface ChatGroupRow {
  groupId: string;
  name: string;
  purpose: string;
  scope: ChatScope;
  members: number;
  lastSeq: number;
  unread: number;
  /** The councils convened in the group, most recently active first (absent on older servers). */
  councils?: CouncilRailRow[];
}

/**
 * A member model as the convene sheet lists it: a person's agent or a shared team agent
 * (packages/fleet `AgentProfile`, trimmed to what the picker shows).
 */
export interface ModelRow {
  profileId: string;
  name: string;
  ownerId: string | null;
  provider: string;
  model: string;
}

/** GET /api/chat/:org/directory: who and which agents a group can be made of. */
export interface ChatDirectoryListing {
  people: { id: string; name: string }[];
  agents: {
    projectId: string;
    projectName: string;
    sessionId: string;
    title: string;
    ownerId: string;
    live: SessionStatus | null;
    /** What it is on (its goal or last summary), for the pickers; absent on older servers. */
    doing?: string | null;
    /** Tokens spent so far, for the pickers' spend figure; absent on older servers. */
    tokens?: number;
    crew?: string | null;
  }[];
  /** The member models a council can convene (absent on a server without profiles). */
  models?: ModelRow[];
}

/**
 * GET /api/chat/:org/councils/:id: the council as the log folds it, plus where the chair's
 * plan lives (the council session the host opened, under `plan` with the plan's id and
 * status), null until the plan is proposed.
 */
export interface CouncilLookup {
  council?: Council;
  plan?: { projectId: string; sessionId: string; planId: string; status: string } | null;
  session?: { projectId: string; sessionId: string } | null;
}

export type { CuratorReport, EntryRecord, MemoryConflict, ProjectState, UsageQuery, UsageReport };

export async function getJson<T>(url: string): Promise<T> {
  // `apiUrl` is a no-op in a browser; the desktop shell's bundled client prefixes its server.
  // Identity: the token rides along (the ID token in oidc mode; the server checks `?user=` against it).
  const res = await fetch(apiUrl(url), {
    headers: { accept: "application/json", ...authHeaders() },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(url), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `${res.status} ${res.statusText} for ${url}`);
  return data;
}

export const api = {
  me: (userId: string) => getJson<Me>(`/api/me?user=${encodeURIComponent(userId)}`),
  project: (id: string) => getJson<ProjectState>(`/api/projects/${encodeURIComponent(id)}`),
  sessions: (id: string) =>
    getJson<SessionRow[]>(`/api/projects/${encodeURIComponent(id)}/sessions`),
  brief: (id: string) =>
    getJson<{ markdown: string }>(`/api/projects/${encodeURIComponent(id)}/brief`),
  memory: (org: string, q: MemoryQuery = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
    const qs = p.toString();
    return getJson<MemoryFeed>(`/api/memory/${encodeURIComponent(org)}${qs ? `?${qs}` : ""}`);
  },
  memoryContext: (org: string, q: { team?: string; project?: string; user?: string }) => {
    const p = new URLSearchParams();
    if (q.team) p.set("team", q.team);
    if (q.project) p.set("project", q.project);
    if (q.user) p.set("user", q.user);
    return getJson<{ context: string }>(`/api/memory/${encodeURIComponent(org)}/context?${p}`);
  },
  curate: (org: string) => getJson<CuratorReport>(`/api/memory/${encodeURIComponent(org)}/curate`),
  /** memory-browser: a person keeps one side of a conflict; the loser is retracted in their name. */
  memoryKeep: (org: string, user: string, conflictId: string, winnerId: string, note = "") =>
    postJson<MemoryFeed>(
      `/api/memory/${encodeURIComponent(org)}/keep?user=${encodeURIComponent(user)}`,
      {
        conflictId,
        winnerId,
        note,
      },
    ),
  /** memory-browser: a person retracts an entry with a reason; the curator never does. */
  memoryRetract: (org: string, user: string, entryId: string, reason: string) =>
    postJson<MemoryFeed>(
      `/api/memory/${encodeURIComponent(org)}/retract?user=${encodeURIComponent(user)}`,
      { entryId, reason },
    ),
  /** settings-page: the policy new sessions in a project are created with. */
  policy: (id: string) => getJson<SessionPolicy>(`/api/projects/${encodeURIComponent(id)}/policy`),
  /** settings-page: which adapters run beside the server. */
  integrations: () => getJson<{ slack: boolean }>("/api/integrations"),
  /** token-usage: totals by session, user, project and turn bucket (packages/server/src/usageApi.ts). */
  usage: (q: UsageQuery = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
    const qs = p.toString();
    return getJson<UsageReport>(`/api/usage${qs ? `?${qs}` : ""}`);
  },
  /** team-theme: how a team looks, null when it keeps the palette. */
  teamTheme: (teamId: string) =>
    getJson<TeamThemeResponse>(`/api/teams/${encodeURIComponent(teamId)}/theme`),
  /** team-theme: set (or with null clear) a team's look; the server checks the user's role. */
  putTeamTheme: async (
    teamId: string,
    userId: string,
    theme: TeamTheme | null,
    token?: string,
  ): Promise<TeamThemeResponse> => {
    const url = `/api/teams/${encodeURIComponent(teamId)}/theme?user=${encodeURIComponent(userId)}`;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...authHeaders(),
    };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(apiUrl(url), {
      method: "PUT",
      headers,
      body: JSON.stringify({ theme }),
    });
    const body = (await res.json().catch(() => ({}))) as TeamThemeResponse & { error?: string };
    if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
    return body;
  },
  /** The session rendered as markdown (export-session); opens in a tab, `download` saves a file. */
  exportUrl: (sessionId: string, download = false) =>
    `/api/sessions/${encodeURIComponent(sessionId)}/export.md${download ? "?download=1" : ""}`,
  notifications: (user: string) =>
    getJson<{ notifications: Notification[] }>(
      `/api/notifications?user=${encodeURIComponent(user)}`,
    ),
  /** Groups and chats: the folded state of an org's chat, a person's unread rows, the pickers. */
  chat: (org: string) => getJson<ChatState>(`/api/chat/${encodeURIComponent(org)}`),
  chatUnread: (org: string, user: string) =>
    getJson<{ total: number; groups: ChatGroupRow[] }>(
      `/api/chat/${encodeURIComponent(org)}/unread?user=${encodeURIComponent(user)}`,
    ),
  chatDirectory: (org: string) =>
    getJson<ChatDirectoryListing>(`/api/chat/${encodeURIComponent(org)}/directory`),
  /** The council (docs/19_council.md): where the chair's plan is, for the ratings. */
  council: (org: string, councilId: string) =>
    getJson<CouncilLookup>(
      `/api/chat/${encodeURIComponent(org)}/councils/${encodeURIComponent(councilId)}`,
    ),
  markRead: async (user: string, ids: string[]): Promise<void> => {
    const res = await fetch(`/api/notifications?user=${encodeURIComponent(user)}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ read: ids }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for /api/notifications`);
  },
};

/** Mark notifications read for a user; failures are the caller's to ignore. */
export async function markNotificationsRead(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const res = await fetch(`/api/notifications?user=${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify({ read: ids }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} marking notifications read`);
}

// Deep links (henosis://p/<project>/s/<session>, henosis://inbox) are parsed in links.ts; this
// re-export keeps the name the views already import.
export { routeOfLink } from "./links.js";

export interface Fetched<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Fetch on mount and whenever `key` changes; `load` is null to skip. */
export function useFetch<T>(load: (() => Promise<T>) | null, key: string): Fetched<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(load));
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const loadRef = useRef(load);
  loadRef.current = load;
  const enabled = load !== null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` names the request; `load` is read through a ref because callers write it inline
  useEffect(() => {
    const fn = loadRef.current;
    if (!fn || !enabled) return;
    let alive = true;
    setLoading(true);
    fn()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [key, tick, enabled]);
  return { data, error, loading, reload };
}

/** Find the org and team of a project from /api/me; falls back to the "default" org. */
export function refOf(me: Me | null, projectId: string): ProjectRef {
  return (
    me?.projects.find((p) => p.projectId === projectId) ?? {
      orgId: "default",
      orgName: "Default org",
      teamId: "default",
      teamName: "Default team",
      projectId,
      name: projectId,
    }
  );
}
