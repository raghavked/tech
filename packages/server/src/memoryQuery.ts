/**
 * Filters for the memory feed (`GET /api/memory/:org`), so a browser can ask for one
 * scope, one status set or a search term instead of the whole ledger. Pure: takes the
 * folded state and a query, returns the same feed shape the unfiltered route returns.
 *
 *   ?level=org|team|project   entries at exactly that depth (org-wide, team-wide, project)
 *   ?team=<id>                entries scoped to that team, including its projects
 *   ?project=<id>             entries scoped to that project
 *   ?status=active,retracted  entry statuses to keep (default: every status)
 *   ?q=<text>                 key, content, tags, author, session or commit contain it
 *
 * Conflicts are kept when any of their entries survives the filter; compactions are kept
 * when their scope key matches the team/project asked for.
 */
import type { EntryRecord, MemoryConflict, MemoryState } from "@henosis/memory";

export type MemoryLevel = "org" | "team" | "project";

export interface MemoryQuery {
  level?: MemoryLevel;
  team?: string;
  project?: string;
  status?: EntryRecord["status"][];
  q?: string;
}

/** How long an entry counts as "still read": the oldest entry read in this window is named. */
export const STILL_READ_WINDOW_MS = 7 * 24 * 3600_000;
export const LAST_HOUR_MS = 3600_000;

/** The aside's "At this scope" figures, computed from the per-entry read log (memory/state.ts). */
export interface MemoryStats {
  /** Active entries after the filter. */
  entries: number;
  openConflicts: number;
  retracted: number;
  /** Entries a session or person took into context in the last hour of wall-clock time. */
  readInLastHour: number;
  /** The oldest entry (by ledger seq) still read within STILL_READ_WINDOW_MS, when there is one. */
  oldestStillRead: { id: string; key: string | null; seq: number; at: number } | null;
  /** Distinct readers (session ids, people) in the last hour. */
  readersInLastHour: number;
  /** The wall clock the figures were read at, so a client can age them. */
  now: number;
}

export interface MemoryFeed {
  orgId: string;
  seq: number;
  entries: EntryRecord[];
  conflicts: MemoryConflict[];
  compactions: MemoryState["compactions"];
  stats: MemoryStats;
}

const STATUSES = new Set<EntryRecord["status"]>([
  "active",
  "superseded",
  "retracted",
  "folded",
  "redacted",
]);

export function memoryQueryOf(params: URLSearchParams): MemoryQuery {
  const out: MemoryQuery = {};
  const level = params.get("level");
  if (level === "org" || level === "team" || level === "project") out.level = level;
  const team = params.get("team");
  if (team) out.team = team;
  const project = params.get("project");
  if (project) out.project = project;
  const status = (params.get("status") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is EntryRecord["status"] => STATUSES.has(s as EntryRecord["status"]));
  if (status.length) out.status = status;
  const q = params.get("q")?.trim();
  if (q) out.q = q;
  return out;
}

export function entryMatches(e: EntryRecord, q: MemoryQuery): boolean {
  if (q.level === "org" && (e.scope.teamId || e.scope.projectId)) return false;
  if (q.level === "team" && (!e.scope.teamId || e.scope.projectId)) return false;
  if (q.level === "project" && !e.scope.projectId) return false;
  if (q.team && e.scope.teamId !== q.team) return false;
  if (q.project && e.scope.projectId !== q.project) return false;
  if (q.status && !q.status.includes(e.status)) return false;
  if (q.q) {
    const needle = q.q.toLowerCase();
    const a = e.attribution;
    const hay = [
      e.key ?? "",
      e.content,
      ...e.tags,
      a.userName ?? "",
      a.userId,
      a.sessionId ?? "",
      a.commitSha ?? "",
    ];
    if (!hay.some((h) => h.toLowerCase().includes(needle))) return false;
  }
  return true;
}

export function memoryStats(
  entries: readonly EntryRecord[],
  conflicts: readonly MemoryConflict[],
  now = Date.now(),
): MemoryStats {
  const hourAgo = now - LAST_HOUR_MS;
  const windowStart = now - STILL_READ_WINDOW_MS;
  let readInLastHour = 0;
  const readers = new Set<string>();
  let oldest: MemoryStats["oldestStillRead"] = null;
  for (const e of entries) {
    const log = e.readLog ?? [];
    const lastHour = log.filter((r) => r.at !== null && r.at >= hourAgo);
    if (lastHour.length) {
      readInLastHour += 1;
      for (const r of lastHour) readers.add(r.by);
    }
    const stillRead = e.lastReadAt !== null && e.lastReadAt >= windowStart;
    if (stillRead && e.status === "active" && (oldest === null || e.seq < oldest.seq))
      oldest = { id: e.id, key: e.key, seq: e.seq, at: e.lastReadAt as number };
  }
  return {
    entries: entries.filter((e) => e.status === "active" && e.kind !== "retraction").length,
    openConflicts: conflicts.filter((c) => !c.resolved).length,
    retracted: entries.filter((e) => e.status === "retracted").length,
    readInLastHour,
    oldestStillRead: oldest,
    readersInLastHour: readers.size,
    now,
  };
}

export function memoryFeed(st: MemoryState, q: MemoryQuery = {}, now = Date.now()): MemoryFeed {
  const entries = Object.values(st.entries).filter((e) => entryMatches(e, q));
  const kept = new Set(entries.map((e) => e.id));
  const conflicts = Object.values(st.conflicts).filter((c) =>
    c.entryIds.some((id) => kept.has(id)),
  );
  const compactions = st.compactions.filter((c) => {
    const [, team = "", project = ""] = c.scopeKey.split("/");
    if (q.team && team !== q.team) return false;
    if (q.project && project !== q.project) return false;
    if (q.level === "org" && (team || project)) return false;
    if (q.level === "team" && (!team || project)) return false;
    if (q.level === "project" && !project) return false;
    return true;
  });
  return {
    orgId: st.orgId,
    seq: st.seq,
    entries,
    conflicts,
    compactions,
    stats: memoryStats(entries, conflicts, now),
  };
}
