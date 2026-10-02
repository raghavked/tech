/** The read-only HTTP API of the Fold server, plus a small fetch hook. */
import type { ProjectState, SessionSummary } from "@fold/fleet";
import type { SessionStatus } from "@fold/kernel";
import type { CuratorReport, EntryRecord, MemoryConflict } from "@fold/memory";
import type { SessionPolicy } from "@fold/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
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
}

export interface Person {
  id: string;
  name: string;
  role: string;
  online: boolean;
  driving: boolean;
}
export type SessionRow = SessionSummary & { live: SessionStatus | null; people: Person[] };

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

export interface Notification {
  id: string;
  userId: string;
  kind: "approval" | "handoff" | "contention" | "done" | "blocked";
  title: string;
  body: string;
  /** fold://p/<project>/s/<session> */
  link: string;
  /** The approvalId, handoffId or contentionId behind the item, when there is one to act on. */
  ref?: string;
  at: number;
  read: boolean;
}

export type { CuratorReport, EntryRecord, MemoryConflict, ProjectState };

export async function getJson<T>(url: string): Promise<T> {
  // `apiUrl` is a no-op in a browser; the desktop shell's bundled client prefixes its server.
  const res = await fetch(apiUrl(url), { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
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
  /** settings-page: the policy new sessions in a project are created with. */
  policy: (id: string) => getJson<SessionPolicy>(`/api/projects/${encodeURIComponent(id)}/policy`),
  /** settings-page: which adapters run beside the server. */
  integrations: () => getJson<{ slack: boolean }>("/api/integrations"),
  /** The session rendered as markdown (export-session); opens in a tab, `download` saves a file. */
  exportUrl: (sessionId: string, download = false) =>
    `/api/sessions/${encodeURIComponent(sessionId)}/export.md${download ? "?download=1" : ""}`,
  notifications: (user: string) =>
    getJson<{ notifications: Notification[] }>(
      `/api/notifications?user=${encodeURIComponent(user)}`,
    ),
  markRead: async (user: string, ids: string[]): Promise<void> => {
    const res = await fetch(`/api/notifications?user=${encodeURIComponent(user)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ read: ids }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for /api/notifications`);
  },
};

/** Turn a fold:// deep link into the client's hash route, or null when it is not one. */
export function routeOfLink(link: string): string | null {
  const m = link.match(/^fold:\/\/p\/([^/]+)\/s\/([^/?#]+)/);
  return m ? `#/p/${m[1]}/s/${m[2]}` : null;
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
