/** The read-only HTTP API of the Henosis server, plus a small fetch hook. */
import type { ChatScope, ChatState, Council, CouncilStatus } from "@henosis/chat";
import type {
  AgentProfile,
  AgentProfileInput,
  ProjectState,
  SessionSummary,
  SharedAgentInput,
  TeamTheme,
} from "@henosis/fleet";
import type { SessionStatus } from "@henosis/kernel";
import type { CuratorReport, EntryRecord, MemoryConflict } from "@henosis/memory";
import type {
  GlanceGate,
  GlanceReport,
  GlanceVoteInput,
  GlanceVoteResult,
  SessionPolicy,
  UsageQuery,
  UsageReport,
} from "@henosis/protocol";
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
  /** `workspaces`: people make their own workspace here; `shared` (or absent): one org. */
  tenancy?: "shared" | "workspaces";
}

/** What a workspace's agents run on, as Settings and the notice under the top row read it. */
export interface WorkspaceModel {
  provider: "anthropic";
  connected: boolean;
  last4: string | null;
  addedBy: string | null;
  addedByName: string | null;
  addedAt: string | null;
  /** The default model the admin picked; empty for the provider's default. */
  model: string;
  status: "ok" | "refused" | "none";
  checkedAt: string | null;
  /** `workspace`: its own key. `server`: the server owner's model. `demo`: the scripted stand-in. */
  source: "workspace" | "server" | "demo";
  /** The model id the agents run on right now. */
  running: string;
  defaultModel: string;
  canManage: boolean;
  /** Whether this server can keep keys at all. */
  storage: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  role: "admin" | "member" | null;
  teams: { id: string; name: string; projects: { id: string; name: string }[] }[];
  members: number;
  model: WorkspaceModel;
}

export interface WorkspacesResponse {
  tenancy: "shared" | "workspaces";
  canCreate: boolean;
  workspaces: Workspace[];
}

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string | null;
  role: "admin" | "member";
}

export interface WorkspaceInvite {
  id: string;
  orgId: string;
  role: "admin" | "member";
  email: string | null;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  uses: number;
  state: "open" | "used" | "expired" | "revoked";
}

export interface WorkspaceMembers {
  members: WorkspaceMember[];
  invites: WorkspaceInvite[];
  canManage: boolean;
}

/** GET /api/invites/:token: where an invitation link leads. */
export interface InviteLookup {
  workspace: { id: string; name: string };
  role: "admin" | "member";
  state: WorkspaceInvite["state"];
  email: string | null;
  expiresAt: string;
  invitedBy: string | null;
  /** The person asking is already in the workspace. */
  member: boolean;
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
  /** The teams the owner manages: a manager's agent, which chairs by default (absent on older servers). */
  manages?: string[];
}

/**
 * A member model (docs/19_council.md) as the server answers it: the profile from users.json
 * or agents.json with its defaults filled in, plus the model id it runs on.
 */
export type AgentRow = AgentProfile & { modelName: string };

/** GET /api/agents?user=U: the person's own agent and what the server offers around it. */
export interface AgentsResponse {
  /** Null when no person was named. */
  mine: AgentRow | null;
  /** The person manages a team, so their persona defaults to the chair's. */
  manager: boolean;
  chairPersona: string;
  shared: AgentRow[];
  /** The orgs whose shared agents the person may edit (Settings, "Team agents"). */
  leads: string[];
  providers: { scripted: boolean; claude: boolean };
  tools: { name: string; risk: string }[];
}

/** GET /api/agents/:org: the org's shared team agents and whether this person may edit them. */
export interface OrgAgentsResponse {
  orgId: string;
  agents: AgentRow[];
  canEdit: boolean;
}

/** GET /api/chat/:org/directory: who and which agents a group can be made of. */
export interface ChatDirectoryListing {
  /**
   * Each person with the member model they bring to a council and the model it runs on, and
   * the teams they are in (absent on older servers), which say whose manager's agent chairs.
   */
  people: { id: string; name: string; teams?: string[]; agent?: AgentRow }[];
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

export type {
  AgentProfile,
  AgentProfileInput,
  CuratorReport,
  EntryRecord,
  GlanceGate,
  GlanceReport,
  GlanceVoteInput,
  GlanceVoteResult,
  MemoryConflict,
  ProjectState,
  SharedAgentInput,
  UsageQuery,
  UsageReport,
};

/** A write with the person's bearer token (dev: the shared token; oidc: the ID token). */
async function putJson<T>(url: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    ...authHeaders(),
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl(url), { method: "PUT", headers, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `${res.status} ${res.statusText}`);
  return data;
}

/** A write (POST, PUT, DELETE) that answers JSON; the server's `error` sentence is the thrown message. */
async function sendJson<T>(
  method: "POST" | "PUT" | "DELETE",
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(apiUrl(url), {
    method,
    headers: {
      accept: "application/json",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...authHeaders(),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `${res.status} ${res.statusText}`);
  return data;
}

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
    headers: { "content-type": "application/json", accept: "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `${res.status} ${res.statusText} for ${url}`);
  return data;
}

/** `/api/workspaces/<org>[/rest]?user=<id>`: the person rides along for a dev-mode server. */
const wsPath = (userId: string, org?: string, rest = "") =>
  `/api/workspaces${org ? `/${encodeURIComponent(org)}` : ""}${rest}?user=${encodeURIComponent(userId)}`;

export const api = {
  me: (userId: string) => getJson<Me>(`/api/me?user=${encodeURIComponent(userId)}`),
  /** Workspaces (packages/server/src/workspaceApi.ts): the person's own, with what each runs on. */
  workspaces: (userId: string) => getJson<WorkspacesResponse>(wsPath(userId)),
  /** `as` is the person's display name, for a server that has only their id (dev mode). */
  createWorkspace: (userId: string, name: string, as: string) =>
    sendJson<{ workspace: Workspace }>("POST", `${wsPath(userId)}&name=${encodeURIComponent(as)}`, {
      name,
    }),
  renameWorkspace: (userId: string, org: string, name: string) =>
    sendJson<{ workspace: Workspace }>("PUT", wsPath(userId, org), { name }),
  workspaceMembers: (userId: string, org: string) =>
    getJson<WorkspaceMembers>(wsPath(userId, org, "/members")),
  setWorkspaceRole: (userId: string, org: string, member: string, role: "admin" | "member") =>
    sendJson<WorkspaceMembers>(
      "PUT",
      wsPath(userId, org, `/members/${encodeURIComponent(member)}`),
      { role },
    ),
  removeWorkspaceMember: (userId: string, org: string, member: string) =>
    sendJson<WorkspaceMembers | { left: true }>(
      "DELETE",
      wsPath(userId, org, `/members/${encodeURIComponent(member)}`),
    ),
  /** An invitation link; the token is answered once, here. */
  createInvite: (
    userId: string,
    org: string,
    opts: { role?: "admin" | "member"; email?: string } = {},
  ) =>
    sendJson<{ invite: WorkspaceInvite; token: string }>(
      "POST",
      wsPath(userId, org, "/invites"),
      opts,
    ),
  revokeInvite: (userId: string, org: string, inviteId: string) =>
    sendJson<{ invites: WorkspaceInvite[] }>(
      "DELETE",
      wsPath(userId, org, `/invites/${encodeURIComponent(inviteId)}`),
    ),
  addProject: (userId: string, org: string, name: string, teamId?: string) =>
    sendJson<{ workspace: Workspace }>("POST", wsPath(userId, org, "/projects"), {
      name,
      ...(teamId ? { teamId } : {}),
    }),
  addTeam: (userId: string, org: string, name: string) =>
    sendJson<{ workspace: Workspace }>("POST", wsPath(userId, org, "/teams"), { name }),
  /** Connect or replace the workspace's own model key, and/or pick its default model. */
  putWorkspaceModel: (userId: string, org: string, body: { key?: string; model?: string }) =>
    sendJson<{ model: WorkspaceModel }>("PUT", wsPath(userId, org, "/model"), body),
  removeWorkspaceModel: (userId: string, org: string) =>
    sendJson<{ model: WorkspaceModel }>("DELETE", wsPath(userId, org, "/model")),
  checkWorkspaceModel: (userId: string, org: string) =>
    sendJson<{ model: WorkspaceModel; error?: string }>(
      "POST",
      wsPath(userId, org, "/model/check"),
    ),
  workspaceModels: (userId: string, org: string) =>
    getJson<{ models: { id: string; name: string }[]; error?: string }>(
      wsPath(userId, org, "/models"),
    ),
  invite: (userId: string, token: string) =>
    getJson<InviteLookup>(
      `/api/invites/${encodeURIComponent(token)}?user=${encodeURIComponent(userId)}`,
    ),
  acceptInvite: (userId: string, token: string, as: string) =>
    sendJson<{ workspace: Workspace }>(
      "POST",
      `/api/invites/${encodeURIComponent(token)}/accept?user=${encodeURIComponent(userId)}&name=${encodeURIComponent(as)}`,
    ),
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
  integrations: () => getJson<Integrations>("/api/integrations"),
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
  /** Member models (docs/19_council.md): the person's own agent and what the server offers around it. */
  agents: (userId: string) =>
    getJson<AgentsResponse>(`/api/agents?user=${encodeURIComponent(userId)}`),
  /** Settings, "My agent": set the person's own agent; the server fills the defaults back in. */
  putMyAgent: (userId: string, agent: AgentProfileInput, token?: string) =>
    putJson<AgentsResponse>(`/api/agents?user=${encodeURIComponent(userId)}`, { agent }, token),
  /** The org's shared team agents, and whether this person may edit them. */
  orgAgents: (orgId: string, userId: string) =>
    getJson<OrgAgentsResponse>(
      `/api/agents/${encodeURIComponent(orgId)}?user=${encodeURIComponent(userId)}`,
    ),
  /** Settings, "Team agents": a lead replaces the org's shared agents; the server checks the role. */
  putOrgAgents: (orgId: string, userId: string, agents: SharedAgentInput[], token?: string) =>
    putJson<OrgAgentsResponse>(
      `/api/agents/${encodeURIComponent(orgId)}?user=${encodeURIComponent(userId)}`,
      { agents },
      token,
    ),
  /** The session rendered as markdown (export-session); opens in a tab, `download` saves a file. */
  exportUrl: (sessionId: string, download = false) =>
    `/api/sessions/${encodeURIComponent(sessionId)}/export.md${download ? "?download=1" : ""}`,
  notifications: (user: string) =>
    getJson<{ notifications: Notification[] }>(
      `/api/notifications?user=${encodeURIComponent(user)}`,
    ),
  /**
   * The glance (widgets, mobile-rail): the one needs-you number, the top gate with its quorum,
   * the agents running and the tokens today, in one call for a widget's timeline, the
   * menu-bar panel (views/Glance.tsx) and the phone's Approvals tab.
   */
  glance: (user: string) => getJson<GlanceReport>(`/api/glance?user=${encodeURIComponent(user)}`),
  /**
   * Approve or Deny from a widget: the same vote as in the session. A plain approve under a
   * release gate sends `DEFAULT_RATING`; the answer carries the glance after the vote.
   */
  glanceVote: (user: string, input: GlanceVoteInput) =>
    postJson<GlanceVoteResult>(`/api/glance/vote?user=${encodeURIComponent(user)}`, input),
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

/** settings-page: which adapters run beside the server (GET /api/integrations). */
export interface Integrations {
  slack: boolean;
  /** The GitHub adapter keeps one comment per attached pull request. */
  github: boolean;
  /** A mailer is configured: leads get the digest. */
  email: boolean;
}

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
