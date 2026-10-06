/**
 * Token usage across the store, for GET /api/usage.
 *
 *   GET /api/usage?org=&team=&project=&user=&since=<seq>  -> UsageReport
 *
 * The numbers come from the session logs: every `agent.model.completed` event carries the
 * usage the model reported, summed over the own events of every branch (inherited history is
 * counted once, on the branch that wrote it). The project ledgers supply what the logs do
 * not: which project a session was registered in, the owner's name, the project's name, and
 * the last reported usage of a session whose log is no longer on disk. Live hosts are read
 * in memory so unflushed events count; everything else is folded from disk.
 *
 * Clock: events carry `ts` as a Lamport clock and the store keeps no wall-clock time (see
 * storage.ts), so the report cannot be sliced by day. `since` is therefore a seq on the
 * logical clock (events with seq > since count), and the time series is `byTurnBucket`:
 * usage grouped by the agent turn it was spent in, ten turns per bucket, which is the one
 * axis every session shares. An ISO `since` is accepted, ignored, and named in `warnings`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Project, type ProjectState, type SerializedLedger } from "@henosis/fleet";
import { Session } from "@henosis/kernel";
import {
  addUsage,
  type Usage,
  type UsageProjectRow,
  type UsageQuery,
  type UsageReport,
  type UsageSessionRow,
  type UsageTurnBucket,
  type UsageUserRow,
  usageTotal,
  ZERO_USAGE,
} from "@henosis/protocol";
import type { OrgRegistry } from "./orgs.js";
import type { ProjectHost } from "./projectHost.js";
import { listSessions, readLog, sessionDir } from "./storage.js";

export const USAGE_PATH = "/api/usage";

/** Turns per bucket of the `byTurnBucket` series. */
export const TURN_BUCKET = 10;

export interface UsageSource {
  root: string;
  /** Live project hosts; their sessions and ledgers are read in memory. */
  projects: Map<string, ProjectHost>;
  orgs: Pick<OrgRegistry, "project" | "user">;
}

export function usageQueryOf(params: URLSearchParams): UsageQuery {
  const out: UsageQuery = {};
  for (const k of ["org", "team", "project", "user"] as const) {
    const v = params.get(k)?.trim();
    if (v) out[k] = v;
  }
  const since = params.get("since")?.trim();
  if (since) out.since = since;
  return out;
}

export function computeUsage(src: UsageSource, q: UsageQuery = {}): UsageReport {
  const warnings: string[] = [];
  const since = sinceSeq(q.since, warnings);
  const ledgers = loadLedgers(src);
  const rows: UsageSessionRow[] = [];
  const buckets = new Map<number, UsageTurnBucket>();
  const seen = new Set<string>();

  const keep = (projectId: string, ownerId: string): boolean => {
    if (q.project && q.project !== projectId) return false;
    if (q.user && q.user !== ownerId) return false;
    if (q.org || q.team) {
      const ref = src.orgs.project(projectId);
      if (!ref) return false;
      if (q.org && ref.orgId !== q.org) return false;
      if (q.team && ref.teamId !== q.team) return false;
    }
    return true;
  };

  // Sessions with a log: live first, then the ones only on disk.
  for (const [sessionId, session] of loadSessions(src)) {
    seen.add(sessionId);
    const st = session.state();
    const ledgerRow = ledgers.get(st.projectId)?.sessions[sessionId];
    const ownerId = st.ownerId ?? ledgerRow?.ownerId ?? "unknown";
    if (!keep(st.projectId, ownerId)) continue;
    let usage: Usage = { ...ZERO_USAGE };
    let turns = 0;
    for (const branch of session.branches()) {
      for (const e of session.log.ownEvents(branch)) {
        if (since !== null && e.seq <= since) continue;
        if (e.kind === "agent.turn.ended") turns++;
        if (e.kind === "agent.model.completed" && e.payload.usage) {
          usage = addUsage(usage, e.payload.usage);
          bucket(buckets, e.payload.turn, e.payload.usage);
        }
      }
    }
    rows.push({
      projectId: st.projectId,
      sessionId,
      title: st.title || ledgerRow?.title || sessionId,
      ownerId,
      usage,
      turns,
      budget: st.policy.tokenBudget ?? null,
    });
  }

  // Sessions a ledger still lists but whose log is gone: the last report is all that is left.
  for (const [projectId, ledger] of ledgers) {
    for (const ss of Object.values(ledger.sessions)) {
      if (seen.has(ss.sessionId) || !keep(projectId, ss.ownerId)) continue;
      seen.add(ss.sessionId);
      const usage = since === null ? (ss.report?.usage ?? { ...ZERO_USAGE }) : { ...ZERO_USAGE };
      rows.push({
        projectId,
        sessionId: ss.sessionId,
        title: ss.title,
        ownerId: ss.ownerId,
        usage,
        turns: since === null ? (ss.report?.turn ?? 0) : 0,
        budget: null,
      });
    }
  }

  rows.sort((a, b) => usageTotal(b.usage) - usageTotal(a.usage) || cmp(a.sessionId, b.sessionId));
  const totals = rows.reduce((t, r) => addUsage(t, r.usage), { ...ZERO_USAGE } as Usage);

  const users = new Map<string, UsageUserRow>();
  const projects = new Map<string, UsageProjectRow>();
  for (const r of rows) {
    const u = users.get(r.ownerId) ?? {
      userId: r.ownerId,
      name: nameOfUser(src, ledgers, r.projectId, r.ownerId),
      usage: { ...ZERO_USAGE },
    };
    u.usage = addUsage(u.usage, r.usage);
    users.set(r.ownerId, u);
    const p = projects.get(r.projectId) ?? {
      projectId: r.projectId,
      name: nameOfProject(src, ledgers, r.projectId),
      usage: { ...ZERO_USAGE },
    };
    p.usage = addUsage(p.usage, r.usage);
    projects.set(r.projectId, p);
  }
  const byTotal = <T extends { usage: Usage }>(xs: T[], key: (x: T) => string) =>
    xs.sort((a, b) => usageTotal(b.usage) - usageTotal(a.usage) || cmp(key(a), key(b)));

  return {
    totals,
    bySession: rows,
    byUser: byTotal([...users.values()], (u) => u.userId),
    byProject: byTotal([...projects.values()], (p) => p.projectId),
    byTurnBucket: [...buckets.values()].sort((a, b) => a.from - b.from),
    since,
    clock: "logical",
    warnings,
  };
}

// ---- internals ---------------------------------------------------------------------------

function sinceSeq(raw: string | undefined, warnings: string[]): number | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (!Number.isNaN(Date.parse(raw))) {
    warnings.push(
      `since=${raw} ignored: the store keeps a logical clock only; pass a seq (events after it count)`,
    );
    return null;
  }
  warnings.push(`since=${raw} ignored: not a seq`);
  return null;
}

function bucket(buckets: Map<number, UsageTurnBucket>, turn: number, u: Usage): void {
  const from = Math.max(1, Math.floor((turn - 1) / TURN_BUCKET) * TURN_BUCKET + 1);
  const b = buckets.get(from) ?? {
    from,
    to: from + TURN_BUCKET - 1,
    usage: { ...ZERO_USAGE },
    calls: 0,
  };
  b.usage = addUsage(b.usage, u);
  b.calls += 1;
  buckets.set(from, b);
}

function loadLedgers(src: UsageSource): Map<string, ProjectState> {
  const out = new Map<string, ProjectState>();
  for (const [id, host] of src.projects) out.set(id, host.state());
  const dir = join(src.root, "projects");
  if (!existsSync(dir)) return out;
  for (const id of readdirSync(dir)) {
    if (out.has(id)) continue;
    const path = join(dir, id, "ledger.json");
    if (!existsSync(path)) continue;
    try {
      const data = JSON.parse(readFileSync(path, "utf8")) as SerializedLedger;
      out.set(id, Project.fromSerialized(data).state());
    } catch {
      // an unreadable ledger contributes nothing
    }
  }
  return out;
}

function loadSessions(src: UsageSource): Map<string, Session> {
  const out = new Map<string, Session>();
  for (const host of src.projects.values())
    for (const [id, h] of host.hosts) out.set(id, h.session);
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

function nameOfUser(
  src: UsageSource,
  ledgers: Map<string, ProjectState>,
  projectId: string,
  userId: string,
): string {
  return (
    src.orgs.user(userId)?.name ??
    ledgers.get(projectId)?.members[userId]?.name ??
    [...ledgers.values()].find((l) => l.members[userId])?.members[userId]?.name ??
    userId
  );
}

function nameOfProject(
  src: UsageSource,
  ledgers: Map<string, ProjectState>,
  projectId: string,
): string {
  return src.orgs.project(projectId)?.name ?? ledgers.get(projectId)?.name ?? projectId;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
