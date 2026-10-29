/**
 * GitHub adapter: a pull request is a session. The adapter keeps one comment per attached
 * session on its pull request and edits it in place on every change that matters (the plan,
 * its ratings and steps, the release gate and its voices, the tokens), finding its own
 * comment by the marker so a restart never posts a second one. Nothing comes back from
 * GitHub: reactions are ignored on purpose, and steering stays in the app and in Slack.
 *
 * The comment is the pr-template's Markdown (comment.ts); this file computes its data from
 * the live session and project state. Updates coalesce per session so a busy turn is one
 * edit, and a body that has not changed is not sent.
 */
import type { ProjectEvent } from "@henosis/fleet";
import {
  type ApprovalRecord,
  activePlan,
  describeRule,
  isRatingsRule,
  minimumRank,
  type PlanRecord,
  planActualTokens,
  rankOf,
  ratingSummary,
  ruleFor,
  type SessionState,
} from "@henosis/kernel";
import { ROLE_RANK, usageTotal } from "@henosis/protocol";
import { describeCall, type HenosisServer, type ProjectHost } from "@henosis/server";
import { z } from "zod";
import { type GitHubClient, type PrRef, parsePrRef, prKey } from "./client.js";
import {
  type CommentInput,
  fitBody,
  type GatePart,
  type PlanPart,
  prComment,
  sessionOfMarker,
  type Voice,
} from "./comment.js";

/** github.json: the token, which session is which pull request, and where the app lives. */
export const GitHubConfig = z.object({
  token: z.string().optional(),
  /** sessionId -> "owner/repo#418" (or the PR's URL). */
  prs: z.record(z.string()).default({}),
  /** Projects to watch; every project when absent. */
  projects: z.array(z.string()).optional(),
  appBaseUrl: z.string().optional(),
  /** Where the server's HTTP API is served, for the audit record link. */
  apiBaseUrl: z.string().optional(),
  /** A GitHub Enterprise API root; api.github.com when absent. */
  githubApiBaseUrl: z.string().optional(),
});
export type GitHubConfig = z.infer<typeof GitHubConfig>;

export interface GitHubAdapterOptions {
  server: HenosisServer;
  client: GitHubClient;
  /** sessionId -> pull request, from the config; `attach` adds more at runtime. */
  prs?: Record<string, string | PrRef>;
  appBaseUrl?: string | undefined;
  apiBaseUrl?: string | undefined;
  /** Coalesce window for edits, ms. 0 = immediate (tests). */
  coalesceMs?: number;
  log?: (line: string) => void;
}

const ROLE_WORDS: Record<string, string> = {
  observer: "observer",
  contributor: "contributor",
  driver: "driver",
  owner: "owner",
};

export class GitHubAdapter {
  private readonly prs = new Map<string, PrRef>();
  private readonly commentIds = new Map<string, number>();
  private readonly lastBody = new Map<string, string>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly watched = new Set<string>();
  private readonly listening = new Set<string>();
  private readonly inflight = new Map<string, Promise<void>>();

  constructor(private readonly opts: GitHubAdapterOptions) {
    for (const [sid, ref] of Object.entries(opts.prs ?? {})) this.prs.set(sid, parsePrRef(ref));
  }

  /** Attach a session to a pull request; the comment is posted on the next change, or now. */
  attach(sessionId: string, pr: string | PrRef): void {
    this.prs.set(sessionId, parsePrRef(pr));
    for (const host of this.opts.server.projects.values())
      if (host.hosts.has(sessionId)) {
        this.listen(host, sessionId);
        this.schedule(sessionId);
        return;
      }
  }

  prOf(sessionId: string): PrRef | null {
    return this.prs.get(sessionId) ?? null;
  }

  /** Watch a project: its attached sessions get their comment; new ones are picked up as they register. */
  watchProject(projectId: string): void {
    if (this.watched.has(projectId)) return;
    this.watched.add(projectId);
    const host = this.opts.server.project(projectId);
    host.project.onEvent((e: ProjectEvent) => {
      if (e.kind === "session.registered" && this.prs.has(e.payload.sessionId)) {
        this.listen(host, e.payload.sessionId);
        this.schedule(e.payload.sessionId);
      }
    });
    for (const sid of host.hosts.keys())
      if (this.prs.has(sid)) {
        this.listen(host, sid);
        this.schedule(sid);
      }
  }

  private listen(host: ProjectHost, sessionId: string): void {
    if (this.listening.has(sessionId)) return;
    const sh = host.hosts.get(sessionId);
    if (!sh) return;
    this.listening.add(sessionId);
    sh.session.onEvent((e) => {
      if (e.branch !== "main") return;
      this.schedule(sessionId);
    });
  }

  private schedule(sessionId: string): void {
    const ms = this.opts.coalesceMs ?? 1500;
    if (ms === 0) {
      void this.sync(sessionId);
      return;
    }
    if (this.timers.has(sessionId)) return;
    this.timers.set(
      sessionId,
      setTimeout(() => {
        this.timers.delete(sessionId);
        void this.sync(sessionId);
      }, ms),
    );
  }

  stop(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  /** Every pending edit, sent now. */
  async flushAll(): Promise<void> {
    const ids = [...this.timers.keys()];
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    for (const id of ids) await this.sync(id);
    await Promise.all(this.inflight.values());
  }

  private hostOf(sessionId: string): ProjectHost | null {
    for (const host of this.opts.server.projects.values())
      if (host.hosts.has(sessionId)) return host;
    return null;
  }

  /** Create or edit the one comment. Serialised per session so two changes never race. */
  sync(sessionId: string): Promise<void> {
    const prev = this.inflight.get(sessionId) ?? Promise.resolve();
    const next = prev
      .then(() => this.syncNow(sessionId))
      .catch((err) => {
        this.opts.log?.(
          `github comment for ${sessionId} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    this.inflight.set(sessionId, next);
    return next;
  }

  private async syncNow(sessionId: string): Promise<void> {
    const pr = this.prs.get(sessionId);
    const host = this.hostOf(sessionId);
    if (!pr || !host) return;
    const body = fitBody(this.render(host.projectId, sessionId) ?? "");
    if (!body || body === this.lastBody.get(sessionId)) return;
    let id = this.commentIds.get(sessionId);
    if (id === undefined) {
      const mine = (await this.opts.client.listComments(pr)).find(
        (c) => sessionOfMarker(c.body) === sessionId.replace(/[\s>]+/g, "_"),
      );
      if (mine) {
        id = mine.id;
        this.commentIds.set(sessionId, id);
        if (mine.body === body) {
          this.lastBody.set(sessionId, body);
          return;
        }
      }
    }
    if (id === undefined) {
      const created = await this.opts.client.createComment(pr, body);
      this.commentIds.set(sessionId, created.id);
    } else await this.opts.client.updateComment(pr, id, body);
    this.lastBody.set(sessionId, body);
  }

  /** The comment as it would read now, or null when the session is not hosted. */
  render(projectId: string, sessionId: string): string | null {
    const input = this.commentInput(projectId, sessionId);
    return input ? prComment(input) : null;
  }

  // ---- the data -------------------------------------------------------------------------

  private nameOf(host: ProjectHost, st: SessionState | undefined, id: string | null): string {
    if (!id) return "someone";
    return (
      st?.participants[id]?.actor.name ??
      host.state().members[id]?.name ??
      this.opts.server.orgs.user(id)?.name ??
      id
    );
  }

  private urlOf(projectId: string, sessionId: string): string | null {
    const base = this.opts.appBaseUrl
      ?.trim()
      .replace(/\/?#.*$/, "")
      .replace(/\/+$/, "");
    if (!base) return null;
    return `${base}/#/p/${encodeURIComponent(projectId)}/s/${encodeURIComponent(sessionId)}`;
  }

  commentInput(projectId: string, sessionId: string): CommentInput | null {
    const host = this.opts.server.project(projectId);
    const sh = host.hosts.get(sessionId);
    if (!sh) return null;
    const st = sh.session.state();
    const pst = host.state();
    const name = (id: string) => this.nameOf(host, st, id);
    const owner = this.nameOf(host, st, st.ownerId);
    const humans = Object.values(st.participants).filter((p) => p.actor.kind === "human");
    const others = humans.filter((p) => p.actor.id !== st.ownerId).map((p) => p.actor.name);
    const mode = others.length ? `Team with ${joinNames(others)}` : "Solo";
    const teamName = this.opts.server.orgs.team(pst.teamId)?.team.name ?? pst.teamId;
    // The role in faint sans beside a voice is the participant's role in the lattice; the baton is
    // the session's business, not the comment's.
    const roleOf = (id: string) => ROLE_WORDS[st.participants[id]?.role ?? ""] ?? "member";

    const plan = activePlan(st);
    const planPart = plan ? this.planPart(st, plan, roleOf, name) : null;
    const gate = topGate(st);
    const gatePart = gate ? this.gatePart(st, gate, roleOf, name) : null;
    const sentence = this.sentence(st, plan, gate, name);
    const apiBase = this.opts.apiBaseUrl?.trim().replace(/\/+$/, "");
    return {
      sessionId,
      agent: `${owner}'s agent`,
      mode,
      team: `the ${teamName} team`,
      url: this.urlOf(projectId, sessionId),
      sentence,
      goal: st.intent.goal?.text ?? null,
      plan: planPart,
      gate: gatePart,
      tokens: {
        spent: usageTotal(st.usage),
        budget: st.policy.tokenBudget,
        input: st.usage.input,
        output: st.usage.output,
        cache: st.usage.cacheRead + st.usage.cacheWrite,
        estimate: plan ? plan.estTokens : null,
        actual: plan ? planActualTokens(plan) || null : null,
      },
      hash: st.head,
      replayUrl: null,
      auditUrl: apiBase
        ? `${apiBase}/api/sessions/${encodeURIComponent(sessionId)}/export.md`
        : null,
    };
  }

  private planPart(
    st: SessionState,
    plan: PlanRecord,
    roleOf: (id: string) => string,
    name: (id: string) => string,
  ): PlanPart {
    const { count, average } = ratingSummary(plan);
    const policy = st.policy.planApproval;
    const policyWords = `${policy.min === 1 ? "one rating" : `${policy.min} ratings`} at ${policy.average}+`;
    const ratings: Voice[] = Object.entries(plan.ratings).map(([id, r]) => ({
      who: name(id),
      role: roleOf(id),
      rating: r.rating,
      note: r.note,
      counts: true,
    }));
    const left = Math.max(0, policy.min - count);
    let state: string;
    let verdict: string;
    switch (plan.status) {
      case "proposed":
        state =
          left === 0
            ? `waits for an average of ${policy.average}+`
            : `waits for ${left === 1 ? (count ? "one more rating" : "one rating") : `${left} more ratings`}`;
        verdict = `⏳ ${count ? `${count} of ${policy.min} ratings · ${average} average` : "No rating yet"} · policy: ${policyWords}`;
        break;
      case "approved":
      case "done":
        state = plan.status;
        verdict = `✓ Plan approved · ${count} rating${count === 1 ? "" : "s"}${count ? ` · ${average} average` : ""} · policy: ${policyWords} · ${
          plan.decidedBy === "policy" || !plan.decidedBy
            ? "decided in the fold"
            : `decided by ${name(plan.decidedBy)}`
        }`;
        break;
      case "revise":
        state = "asked to revise";
        verdict = `↩ Revision asked${plan.decidedBy && plan.decidedBy !== "policy" ? ` by ${name(plan.decidedBy)}` : ""}${count ? ` · ${count} rating${count === 1 ? "" : "s"} · ${average} average` : ""}`;
        break;
      default:
        state = "rejected";
        verdict = `✕ Plan rejected${plan.decidedBy && plan.decidedBy !== "policy" ? ` by ${name(plan.decidedBy)}` : ""}`;
    }
    return {
      state,
      steps: plan.steps.map((s) => ({
        title: s.title,
        est: s.estTokens,
        actual: s.actualTokens || null,
        status: s.status,
      })),
      ratings,
      verdict,
    };
  }

  private gatePart(
    st: SessionState,
    a: ApprovalRecord,
    roleOf: (id: string) => string,
    name: (id: string) => string,
  ): GatePart {
    const rule = ruleFor(st.policy.approvals, a.call.risk);
    const ratings = isRatingsRule(rule);
    const min = minimumRank(rule);
    const voices: Voice[] = Object.entries(a.ballots).map(([id, b]) => ({
      who: name(id),
      role: roleOf(id),
      rating: b.rating,
      note: b.note,
      counts: rankOf(st, id) >= min && (!ratings || b.rating !== null),
      ...(b.vote === "deny" ? { deny: true } : {}),
    }));
    const counted = voices.filter((v) => v.counts && !v.deny);
    const needed = ratings ? rule.ratings.min : typeof rule === "string" ? 1 : rule.quorum;
    const avg = counted.length
      ? Math.round((counted.reduce((n, v) => n + (v.rating ?? 0), 0) / counted.length) * 10) / 10
      : null;
    const tally = `${counted.length} of ${needed}${ratings && avg !== null ? ` · ${avg} average` : ""}`;
    let state: string;
    let verdict: string;
    if (a.status === "granted") {
      state = "granted";
      verdict = `✓ Gate granted · ${tally}`;
    } else if (a.status === "denied") {
      const by = voices.filter((v) => v.deny).map((v) => v.who);
      state = `held by ${joinNames(by)}`;
      verdict = `✕ Held by ${joinNames(by)} · the agent waits for a steer`;
    } else {
      const left = Math.max(0, needed - counted.length);
      const who = ratings ? rule.ratings.of : typeof rule === "string" ? rule : rule.of;
      state = waitsOn(left, who, ratings ? rule.ratings.average : null, avg);
      verdict = `⏳ ${state[0]?.toUpperCase()}${state.slice(1)} · ${tally}`;
    }
    return {
      state,
      call: callText(a.call),
      risk: a.call.risk,
      rule: describeRule(rule),
      voices,
      verdict,
    };
  }

  /** Where the session stands, in one sentence. */
  private sentence(
    st: SessionState,
    plan: PlanRecord | null,
    gate: ApprovalRecord | null,
    name: (id: string) => string,
  ): string {
    if (gate && gate.status === "pending") {
      const rule = ruleFor(st.policy.approvals, gate.call.risk);
      const ratings = isRatingsRule(rule);
      const min = minimumRank(rule);
      const counted = Object.entries(gate.ballots).filter(
        ([id, b]) =>
          b.vote === "approve" && rankOf(st, id) >= min && (!ratings || b.rating !== null),
      );
      const needed = ratings ? rule.ratings.min : typeof rule === "string" ? 1 : rule.quorum;
      const who = ratings ? rule.ratings.of : typeof rule === "string" ? rule : rule.of;
      const avg = counted.length
        ? counted.reduce((n, [, b]) => n + (b.rating ?? 0), 0) / counted.length
        : null;
      const w = waitsOn(
        Math.max(0, needed - counted.length),
        who,
        ratings ? rule.ratings.average : null,
        avg,
      );
      return `\`${callText(gate.call)}\` ${w}.`;
    }
    if (gate && gate.status === "denied") {
      const by = Object.entries(gate.ballots)
        .filter(([, b]) => b.vote === "deny")
        .map(([id]) => name(id));
      return `Held by ${joinNames(by)}; the agent waits for a steer.`;
    }
    if (!st.intent.goal) return "Waiting for a goal.";
    if (plan?.status === "proposed") {
      const { count } = ratingSummary(plan);
      const left = Math.max(0, st.policy.planApproval.min - count);
      return left === 0
        ? `The plan waits for an average of ${st.policy.planApproval.average}+.`
        : `The plan waits for ${left === 1 ? (count ? "one more rating" : "one rating") : `${left} more ratings`}${count ? ` at ${st.policy.planApproval.average}+` : ""}.`;
    }
    if (plan?.status === "revise") return "The team asked for a revised plan.";
    if (plan?.status === "rejected") return "The plan was rejected; the agent waits for a steer.";
    if (plan && (plan.status === "approved" || plan.status === "done")) {
      const done = plan.steps.filter((s) => s.status === "done").length;
      const running = plan.steps.findIndex((s) => s.status === "running");
      if (done === plan.steps.length) return `Done · ${done} of ${plan.steps.length} steps.`;
      if (running >= 0)
        return `Step ${running + 1} of ${plan.steps.length}: ${plan.steps[running]?.title ?? ""}.`;
      return `Approved · ${done} of ${plan.steps.length} steps done.`;
    }
    if (st.status === "running") return "Working.";
    if (st.status === "blocked") return "Blocked on another session's claim.";
    if (st.status === "paused") return "Paused.";
    return "Waiting for a steer.";
  }
}

/** The call as the comment names it: the command itself for a shell call, else the verb phrase. */
export function callText(call: { name: string; args: Record<string, unknown> }): string {
  const words = describeCall(call as Parameters<typeof describeCall>[0]);
  return call.name === "shell.run" && words.code ? words.code : words.what;
}

/** The pending approval if any, else the most consequential decided one, else null. */
export function topGate(st: SessionState): ApprovalRecord | null {
  const all = Object.values(st.approvals);
  const pending = all
    .filter((a) => a.status === "pending")
    .sort((a, b) => a.requestedSeq - b.requestedSeq);
  if (pending[0]) return pending[0];
  const order = ["irreversible", "external", "exec", "write", "read"];
  const decided = all
    .filter((a) => a.status !== "pending")
    .sort(
      (a, b) =>
        order.indexOf(a.call.risk) - order.indexOf(b.call.risk) || b.requestedSeq - a.requestedSeq,
    );
  return decided[0] ?? null;
}

/** "waits on one more contributor at 4 or above" / "waits on one owner or above". */
export function waitsOn(
  left: number,
  role: string,
  bar: number | null,
  average: number | null,
): string {
  const atBar = bar !== null ? ` at ${bar} or above` : " or above";
  if (left === 0 && bar !== null && average !== null && average < bar)
    return `waits for an average of ${bar} or above (now ${Math.round(average * 10) / 10})`;
  if (left === 0) return "waits for the fold";
  const n = left === 1 ? "one more" : `${left} more`;
  return `waits on ${n} ${role}${left === 1 ? "" : "s"}${atBar}`;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export { prKey, ROLE_RANK };
