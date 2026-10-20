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
 * `turns=N` is the range control's unit: only the last N agent turns of every session count.
 *
 * Every row carries its `usage` with the in/out split (the charts are labelled "in + out"),
 * `cache` reports what never counts against a budget, each project row carries its budget
 * (Decision 8: the ledger policy's number, else the sum of its sessions' budgets) and
 * `forecast` reads the pace against the budget in scope, in turns rather than days.
 *
 * Councils (docs/19_council.md): what the member models said in a council is in the chat
 * log as `council.said` with usage, outside any session. It is reported per person in
 * `byCouncil` (a model's owner; the convener for a shared team agent), counted in `totals`
 * and in the person's `byUser` row, and sliced by the group's scope for the org, team and
 * project filters. The work a council assigns runs in ordinary sessions and is counted there.
 */
import { Chat, type ChatEvent, type ChatState, type SerializedChat } from "@henosis/chat";
import { Project, type ProjectState, projectBudget, type SerializedLedger } from "@henosis/fleet";
import { type SerializedLog, Session } from "@henosis/kernel";
import {
  addUsage,
  type Usage,
  type UsageCouncilRow,
  type UsageForecast,
  type UsageProjectRow,
  type UsageQuery,
  type UsageReport,
  type UsageSessionRow,
  type UsageTurnBucket,
  type UsageUserRow,
  usageTotal,
  ZERO_USAGE,
} from "@henosis/protocol";
import type { ChatHost } from "./chatHost.js";
import type { OrgRegistry } from "./orgs.js";
import type { ProjectHost } from "./projectHost.js";
import { FileStore, type LiveStore } from "./store/index.js";

export const USAGE_PATH = "/api/usage";

/** Turns per bucket of the `byTurnBucket` series. */
export const TURN_BUCKET = 10;

export interface UsageSource {
  root: string;
  /** Where the logs and ledgers not hosted live; a `FileStore` on `root` when absent. */
  store?: LiveStore | undefined;
  /** Live project hosts; their sessions and ledgers are read in memory. */
  projects: Map<string, ProjectHost>;
  /** Live chat hosts by org; their council events are read in memory, other orgs' from the store. */
  chats?: Map<string, ChatHost> | undefined;
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
  const turns = params.get("turns")?.trim();
  if (turns) out.turns = turns;
  return out;
}

/** The budget's amber line, as a fraction; the same 0.8 every meter uses. */
export const BUDGET_WARN = 0.8;

export function computeUsage(src: UsageSource, q: UsageQuery = {}): UsageReport {
  const warnings: string[] = [];
  const since = sinceSeq(q.since, warnings);
  const lastTurns = turnsOf(q.turns, warnings);
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
    // The last N turns: everything spent in turn numbers above `st.turn - N`.
    const fromTurn = lastTurns === null ? 0 : Math.max(0, st.turn - lastTurns);
    for (const branch of session.branches()) {
      for (const e of session.log.ownEvents(branch)) {
        if (since !== null && e.seq <= since) continue;
        if (e.kind === "agent.turn.ended" && e.payload.turn > fromTurn) turns++;
        if (e.kind === "agent.model.completed" && e.payload.usage && e.payload.turn > fromTurn) {
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
      const whole = since === null && lastTurns === null;
      const usage = whole ? (ss.report?.usage ?? { ...ZERO_USAGE }) : { ...ZERO_USAGE };
      rows.push({
        projectId,
        sessionId: ss.sessionId,
        title: ss.title,
        ownerId: ss.ownerId,
        usage,
        turns: whole ? (ss.report?.turn ?? 0) : 0,
        budget: ss.report?.budget ?? null,
      });
    }
  }

  rows.sort((a, b) => usageTotal(b.usage) - usageTotal(a.usage) || cmp(a.sessionId, b.sessionId));
  let totals = rows.reduce((t, r) => addUsage(t, r.usage), { ...ZERO_USAGE } as Usage);

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
      budget: null,
      budgetSource: null,
    };
    p.usage = addUsage(p.usage, r.usage);
    projects.set(r.projectId, p);
  }
  // Decision 8: a project's budget is the ledger policy's number when a lead set one, else the
  // sum of its open sessions' budgets (read from the logs here, where the policy is known).
  for (const p of projects.values()) {
    const ledger = ledgers.get(p.projectId);
    const budgets = new Map<string, number | null>();
    for (const r of rows) if (r.projectId === p.projectId) budgets.set(r.sessionId, r.budget);
    if (ledger) {
      const b = projectBudget(ledger, budgets);
      p.budget = b.budget;
      p.budgetSource = b.source;
    } else {
      let sum = 0;
      for (const b of budgets.values()) if (b) sum += b;
      p.budget = sum > 0 ? sum : null;
      p.budgetSource = sum > 0 ? "sessions" : null;
    }
  }
  // Councils: what each person's models said, from the chat logs.
  const councils = councilRows(src, q, since, ledgers);
  for (const c of councils) {
    totals = addUsage(totals, c.usage);
    const u = users.get(c.userId) ?? { userId: c.userId, name: c.name, usage: { ...ZERO_USAGE } };
    u.usage = addUsage(u.usage, c.usage);
    users.set(c.userId, u);
  }
  const byTotal = <T extends { usage: Usage }>(xs: T[], key: (x: T) => string) =>
    xs.sort((a, b) => usageTotal(b.usage) - usageTotal(a.usage) || cmp(key(a), key(b)));
  const byProject = byTotal([...projects.values()], (p) => p.projectId);
  const turnsCounted = rows.reduce((n, r) => n + r.turns, 0);
  const seenInput = totals.input + totals.cacheRead;

  return {
    totals,
    bySession: rows,
    byUser: byTotal([...users.values()], (u) => u.userId),
    byProject,
    byCouncil: byTotal(councils, (c) => c.userId),
    byTurnBucket: [...buckets.values()].sort((a, b) => a.from - b.from),
    cache: {
      read: totals.cacheRead,
      write: totals.cacheWrite,
      shareOfInput: seenInput ? totals.cacheRead / seenInput : 0,
    },
    forecast: forecastOf(usageTotal(totals), turnsCounted, byProject),
    since,
    turns: lastTurns,
    clock: "logical",
    warnings,
  };
}

/**
 * The pace against the budget in scope: tokens per counted turn, carried forward until the
 * budget's 80 % line and its end. The budget is the sum of the project budgets in scope; a
 * project without one contributes nothing, and the forecast says so in its method line.
 */
export function forecastOf(
  spent: number,
  turns: number,
  byProject: readonly UsageProjectRow[],
): UsageForecast {
  const withBudget = byProject.filter((p) => p.budget !== null);
  const budget = withBudget.length ? withBudget.reduce((n, p) => n + (p.budget ?? 0), 0) : null;
  const perTurn = turns > 0 ? spent / turns : 0;
  const left = (line: number): number | null => {
    if (budget === null || perTurn <= 0) return null;
    return Math.max(0, Math.ceil((budget * line - spent) / perTurn));
  };
  const unbudgeted = byProject.length - withBudget.length;
  const method =
    budget === null
      ? "No budget in scope: the pace is tokens per agent turn over the counted range."
      : `The pace is tokens per agent turn over the counted range, carried forward against ${
          unbudgeted
            ? `the ${withBudget.length} budgeted of ${byProject.length} projects`
            : "the budget"
        }. The budget is soft: the meter turns amber at 80 %, then red, and nothing stops.`;
  return {
    budget,
    spent,
    turns,
    perTurn: Math.round(perTurn),
    turnsToWarn: left(BUDGET_WARN),
    turnsToBudget: left(1),
    method,
  };
}

// ---- internals ---------------------------------------------------------------------------

function turnsOf(raw: string | undefined, warnings: string[]): number | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw) && Number(raw) > 0) return Number(raw);
  warnings.push(`turns=${raw} ignored: not a count of turns`);
  return null;
}

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
  const store = src.store ?? new FileStore(src.root);
  for (const id of store.listLogs("ledger")) {
    if (out.has(id)) continue;
    try {
      const data = store.readLog("ledger", id) as SerializedLedger | null;
      if (data) out.set(id, Project.fromSerialized(data).state());
    } catch {
      // an unreadable ledger contributes nothing
    }
  }
  return out;
}

/** Every organisation's chat log: live hosts first, then the ones only in the store. */
function loadChats(src: UsageSource): Map<string, { events: ChatEvent[]; state: ChatState }> {
  const out = new Map<string, { events: ChatEvent[]; state: ChatState }>();
  for (const [orgId, host] of src.chats ?? [])
    out.set(orgId, { events: host.chat.events(), state: host.state() });
  const store = src.store ?? new FileStore(src.root);
  for (const orgId of store.listLogs("chat")) {
    if (out.has(orgId)) continue;
    try {
      const data = store.readLog("chat", orgId) as SerializedChat | null;
      if (!data) continue;
      const chat = Chat.fromSerialized(data);
      out.set(orgId, { events: chat.events(), state: chat.state() });
    } catch {
      // an unreadable chat log contributes nothing
    }
  }
  return out;
}

/**
 * One row per person whose models spoke in a council: every `council.said` after `since`,
 * attributed to the member's owner or, for a shared agent, the convener; filtered by the
 * group's scope (its project, or its team) and the chat's organisation.
 */
function councilRows(
  src: UsageSource,
  q: UsageQuery,
  since: number | null,
  ledgers: Map<string, ProjectState>,
): UsageCouncilRow[] {
  const rows = new Map<string, UsageCouncilRow & { ids: Set<string> }>();
  for (const [orgId, { events, state }] of loadChats(src)) {
    if (q.org && q.org !== orgId) continue;
    for (const e of events) {
      if (e.kind !== "council.said") continue;
      if (since !== null && e.seq <= since) continue;
      const council = state.councils[e.payload.councilId];
      if (!council) continue;
      const scope = state.groups[council.groupId]?.scope ?? {};
      const projectId = scope.projectId ?? null;
      const teamId =
        scope.teamId ?? (projectId ? (src.orgs.project(projectId)?.teamId ?? null) : null);
      if (q.project && q.project !== projectId) continue;
      if (q.team && q.team !== teamId) continue;
      const userId = e.payload.member.userId ?? council.by;
      if (q.user && q.user !== userId) continue;
      const row = rows.get(userId) ?? {
        userId,
        name: nameOfUser(src, ledgers, projectId ?? "", userId),
        councils: 0,
        usage: { ...ZERO_USAGE },
        ids: new Set<string>(),
      };
      row.usage = addUsage(row.usage, e.payload.usage);
      row.ids.add(council.id);
      row.councils = row.ids.size;
      rows.set(userId, row);
    }
  }
  return [...rows.values()].map(({ ids: _ids, ...row }) => row);
}

function loadSessions(src: UsageSource): Map<string, Session> {
  const out = new Map<string, Session>();
  for (const host of src.projects.values())
    for (const [id, h] of host.hosts) out.set(id, h.session);
  const store = src.store ?? new FileStore(src.root);
  for (const id of store.listLogs("session")) {
    if (out.has(id)) continue;
    try {
      const log = store.readLog("session", id) as SerializedLog | null;
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
