/**
 * The glance: one needs-you number for the signed-in person, the top gate with its quorum,
 * the agents running and the tokens spent today.
 *
 *   GET /api/glance?user=<id>  -> GlanceReport
 *
 * The phone's Approvals tab, the manager's sentence, the widgets, the menu-bar panel and the
 * push badge all read this one figure (mobile-rail, widgets): approvals the person can still
 * vote on plus handoffs offered to them, never mentions. Everything comes from the live
 * session states in the person's projects; the day's tokens come from `UsageDays`, which
 * counts model calls as they land because the logs keep only a logical clock.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describeRule,
  isRatingsRule,
  minimumRank,
  rankOf,
  requiredVotes,
  ruleFor,
  type SessionState,
} from "@henosis/kernel";
import {
  addUsage,
  type GlanceGate,
  type GlanceReport,
  type RiskClass,
  ROLE_RANK,
  type Role,
  type Usage,
  ZERO_USAGE,
} from "@henosis/protocol";
import type { ProjectHost } from "./projectHost.js";
import { atomicWrite } from "./storage.js";

export const GLANCE_PATH = "/api/glance";

/** How many calendar days of per-user totals `UsageDays` keeps. */
export const USAGE_DAYS_KEPT = 14;

/** The UTC calendar day of a time, "YYYY-MM-DD". */
export function dayOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Per-day, per-person token totals, persisted at `<root>/usage-days.json`. The server adds
 * every `agent.model.completed` as it lands, attributed to the session's owner (the same
 * attribution `/api/usage` uses), so "tokens today" survives a restart. Writes are debounced.
 */
export class UsageDays {
  private days: Record<string, Record<string, Usage>> = {};
  private readonly path: string;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    root: string,
    private readonly clock: () => number = () => Date.now(),
  ) {
    this.path = join(root, "usage-days.json");
    if (existsSync(this.path)) {
      try {
        const data = JSON.parse(readFileSync(this.path, "utf8")) as {
          days?: Record<string, Record<string, Usage>>;
        };
        this.days = data.days ?? {};
      } catch {
        /* start empty */
      }
    }
  }

  record(userId: string, usage: Partial<Usage> | undefined, at = this.clock()): void {
    if (!usage) return;
    const day = dayOf(at);
    const byUser = this.days[day] ?? {};
    this.days[day] = byUser;
    byUser[userId] = addUsage(byUser[userId] ?? { ...ZERO_USAGE }, usage);
    this.prune(day);
    this.scheduleFlush();
  }

  /** The person's total for a day (today by default). */
  of(userId: string, day = dayOf(this.clock())): Usage {
    return { ...(this.days[day]?.[userId] ?? ZERO_USAGE) };
  }

  today(): string {
    return dayOf(this.clock());
  }

  private prune(latest: string): void {
    const keys = Object.keys(this.days).sort();
    const cutoff = dayOf(Date.parse(`${latest}T00:00:00Z`) - (USAGE_DAYS_KEPT - 1) * 86_400_000);
    for (const k of keys) if (k < cutoff) delete this.days[k];
  }

  private scheduleFlush(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 20);
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    atomicWrite(this.path, JSON.stringify({ days: this.days }));
  }
}

export interface GlanceSource {
  /** The project hosts the person belongs to, loaded. */
  projects: Iterable<ProjectHost>;
  user: { id: string; name: string } | null;
  /**
   * The role identity gives the person in a session they have not joined, or null when
   * identity does not know them. A joined participant's role wins.
   */
  roleIn: (projectId: string, ownerId: string | null) => Role | null;
  usageDays: UsageDays;
}

/** Risk classes from the most to the least consequential: the order the top gate is picked in. */
const RISK_ORDER: RiskClass[] = ["irreversible", "external", "exec", "write", "read"];

export function computeGlance(src: GlanceSource, userId: string): GlanceReport {
  let approvals = 0;
  let handoffs = 0;
  const gates: { gate: GlanceGate; rank: number; seq: number }[] = [];
  const agents = { open: 0, running: 0, awaitingApproval: 0, blocked: 0 };
  for (const host of src.projects) {
    const pst = host.state();
    const name = (id: string | null) => (id ? (pst.members[id]?.name ?? id) : "someone");
    for (const [sessionId, sh] of host.hosts) {
      if (pst.sessions[sessionId] && !pst.sessions[sessionId]?.open) continue;
      const st = sh.session.state();
      agents.open += 1;
      if (st.status === "running") agents.running += 1;
      if (st.status === "awaiting_approval") agents.awaitingApproval += 1;
      if (st.status === "blocked") agents.blocked += 1;
      const myRank = rankIn(st, userId, src.roleIn(host.projectId, st.ownerId));
      for (const a of Object.values(st.approvals)) {
        if (a.status !== "pending" || a.ballots[userId]) continue;
        const rule = ruleFor(st.policy.approvals, a.call.risk);
        if (rule === "none" || myRank < minimumRank(rule)) continue;
        approvals += 1;
        const ratings = isRatingsRule(rule);
        const eligible = Object.entries(a.ballots).filter(
          ([id, b]) => b.vote === "approve" && rankOf(st, id) >= minimumRank(rule),
        );
        const rated = eligible.map(([, b]) => b.rating).filter((r): r is number => r !== null);
        gates.push({
          rank: RISK_ORDER.indexOf(a.call.risk),
          seq: a.requestedSeq,
          gate: {
            projectId: host.projectId,
            sessionId,
            title: st.title,
            owner: name(st.ownerId),
            approvalId: a.id,
            call: { name: a.call.name, risk: a.call.risk },
            rule: describeRule(rule),
            ratings,
            votes: ratings ? rated.length : eligible.length,
            needed: requiredVotes(rule),
            average:
              ratings && rated.length
                ? Math.round((rated.reduce((n, r) => n + r, 0) / rated.length) * 10) / 10
                : ratings
                  ? 0
                  : null,
            bar: ratings ? rule.ratings.average : null,
          },
        });
      }
      for (const h of Object.values(st.handoffs))
        if (h.status === "pending" && h.to === userId) handoffs += 1;
    }
  }
  gates.sort((a, b) => a.rank - b.rank || a.seq - b.seq);
  return {
    user: src.user,
    needsYou: approvals + handoffs,
    approvals,
    handoffs,
    topGate: gates[0]?.gate ?? null,
    agents,
    tokensToday: src.usageDays.of(userId),
    day: src.usageDays.today(),
  };
}

/** The person's effective rank in a session: as a participant, else as identity would seat them. */
function rankIn(st: SessionState, userId: string, derived: Role | null): number {
  if (st.participants[userId]) return rankOf(st, userId);
  return derived ? ROLE_RANK[derived] : -1;
}
