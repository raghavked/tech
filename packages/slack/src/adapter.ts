/**
 * Slack adapter: channels map to team, project and management; each session is a thread in
 * its project channel; approvals are buttons; fleet contentions and memory conflicts go to
 * the management channel and to the owners' threads; thread replies steer the session.
 *
 * The messages are the slack-templates: one sentence first, the context line, the buttons,
 * the link last; one message edited in place when the decision lands (templates.ts). Slack
 * is write-mostly here (no polling of threads) and updates coalesce per thread so a busy
 * fleet stays under the roughly one-message-per-second-per-channel limit.
 */
import type { ProjectEvent } from "@henosis/fleet";
import {
  type ApprovalRecord,
  describeRule,
  isRatingsRule,
  type PlanRecord,
  ruleFor,
  type SessionState,
} from "@henosis/kernel";
import type { MemoryEvent, MemoryStore } from "@henosis/memory";
import {
  DEFAULT_RATING,
  type DirectiveInput,
  Rating,
  type SessionEvent,
  usageTotal,
} from "@henosis/protocol";
import type { HenosisServer, ProjectHost } from "@henosis/server";
import { z } from "zod";
import type { SlackClient } from "./client.js";
import { SlackCouncil } from "./council.js";
import { appUrlOf, linkOf } from "./links.js";
import {
  answeredLine,
  approvalDecided,
  approvalRequested,
  type Ballot,
  type BriefNeed,
  batonLine,
  briefNow,
  contentionOpened,
  contentionResolved,
  type DailyBriefInput,
  dailyBrief,
  joinLine,
  memoryConflict,
  memoryResolved,
  mentionPlaceholder,
  mentionReply,
  planDecided,
  planProposed,
  type Rendered,
  refusedWriteLine,
  sessionStarted,
  weekdayOf,
} from "./templates.js";

export const ChannelMap = z.object({
  /** teamId -> channel id */
  teams: z.record(z.string()).default({}),
  /** projectId -> channel id */
  projects: z.record(z.string()).default({}),
  /** channel id for leads and managers: digests, contentions, memory conflicts */
  management: z.string().optional(),
  /** slack user id -> henosis user id */
  users: z.record(z.string()).default({}),
});
export type ChannelMap = z.infer<typeof ChannelMap>;

interface ThreadRef {
  channel: string;
  ts: string;
}

/** A mention in a team channel waiting for the agent's next words. */
interface PendingMention {
  projectId: string;
  sessionId: string;
  /** The seq of the directive; only later words answer it. */
  afterSeq: number;
  placeholder: ThreadRef;
  asker: string;
  channel: string;
}

export interface SlackAdapterOptions {
  server: HenosisServer;
  client: SlackClient;
  map: ChannelMap;
  /** Coalesce window for thread updates, ms. 0 = immediate (tests). */
  coalesceMs?: number;
  /**
   * Where the web app is served, e.g. "https://henosis.example.com". When set, threads,
   * approvals and contentions carry a link that opens the session or project in the app
   * (the client's hash route under this origin; the desktop shell opens it too). Unset: no links.
   */
  appBaseUrl?: string | undefined;
  /** The clock for the daily brief's weekday; the ledger keeps none. */
  now?: () => Date;
  log?: (line: string) => void;
}

export class SlackAdapter {
  /** The council in Slack (docs/19_council.md): `/henosis council`, the rounds, the plan's stars. */
  readonly council: SlackCouncil;
  private readonly threads = new Map<string, ThreadRef>();
  private readonly approvalMessages = new Map<string, ThreadRef>();
  private readonly planMessages = new Map<string, ThreadRef>();
  private readonly contentionMessages = new Map<string, ThreadRef>();
  private readonly memoryMessages = new Map<string, ThreadRef>();
  private readonly pendingMentions = new Map<string, PendingMention[]>();
  /** Answers posted in team channels, by message ts, for "Remember for the team". */
  private readonly answers = new Map<
    string,
    { orgId: string; projectId: string; sessionId: string; text: string }
  >();
  private readonly pendingLines = new Map<string, string[]>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly watched = new Set<string>();
  private readonly memoriesWatched = new Set<string>();

  constructor(private readonly opts: SlackAdapterOptions) {
    const { client } = opts;
    client.onAction((e) => this.onAction(e));
    client.onMessage((e) => this.onMessage(e));
    client.onSlash("/henosis", (e) => this.onSlash(e));
    this.council = new SlackCouncil({
      server: opts.server,
      client,
      map: opts.map,
      appBaseUrl: opts.appBaseUrl,
      join: (host, sh, user) => this.joinIfNeeded(host, sh, user),
      log: opts.log,
    });
  }

  /** Attach to a project host: existing sessions get threads; new ones are picked up as they register. */
  watchProject(projectId: string): void {
    if (this.watched.has(projectId)) return;
    this.watched.add(projectId);
    const host = this.opts.server.project(projectId);
    host.project.onEvent((e) => void this.onProjectEvent(host, e));
    for (const sid of host.hosts.keys()) this.attachSession(host, sid);
    const org = host.state().orgId;
    if (!this.memoriesWatched.has(org)) {
      this.memoriesWatched.add(org);
      const store = this.opts.server.memory(org);
      store.onEvent((e) => void this.onMemoryEvent(store, e));
    }
    this.council.watchOrg(org);
  }

  async start(): Promise<void> {
    await this.opts.client.start();
  }

  async stop(): Promise<void> {
    for (const t of this.timers.values()) clearTimeout(t);
    await this.council.settle();
    await this.opts.client.stop();
  }

  // ---- outbound ------------------------------------------------------------------------

  private nameOf(host: ProjectHost, userId: string | null): string {
    if (!userId) return "someone";
    return host.state().members[userId]?.name ?? this.opts.server.orgs.user(userId)?.name ?? userId;
  }

  /** The app URL of a session or project when `appBaseUrl` is set, else null. */
  private urlOf(projectId: string, sessionId?: string): string | null {
    return appUrlOf(linkOf(projectId, sessionId), this.opts.appBaseUrl);
  }

  private channelFor(host: ProjectHost): string | null {
    const st = host.state();
    return (
      this.opts.map.projects[st.projectId] ??
      this.opts.map.teams[st.teamId] ??
      this.opts.map.management ??
      null
    );
  }

  private attachSession(host: ProjectHost, sessionId: string): void {
    if (this.threads.has(sessionId)) return;
    const channel = this.channelFor(host);
    if (!channel) return;
    const sh = host.hosts.get(sessionId);
    const st = sh?.session.state();
    const summary = host.state().sessions[sessionId];
    const title = st?.title ?? summary?.title ?? sessionId;
    const ownerId = st?.ownerId ?? summary?.ownerId ?? null;
    const r = sessionStarted({
      owner: this.nameOf(host, ownerId),
      title,
      project: host.state().name,
      url: this.urlOf(host.projectId, sessionId),
      planFirst: st?.policy.planFirst ?? false,
      crew: summary?.crew ?? null,
      driver: st?.driver ? this.nameOf(host, st.driver) : null,
      budget: st?.policy.tokenBudget ?? null,
    });
    void this.opts.client.post({ channel, ...r }).then((posted) => {
      this.threads.set(sessionId, posted);
      sh?.session.onEvent((e) => void this.onSessionEvent(host, sessionId, e));
      this.flushLater(sessionId);
    });
  }

  private onProjectEvent(host: ProjectHost, e: ProjectEvent): void {
    switch (e.kind) {
      case "session.registered":
        this.attachSession(host, e.payload.sessionId);
        break;
      case "fleet.contention.opened": {
        const r = this.renderContention(host, e.payload.contentionId);
        if (!r) break;
        if (this.opts.map.management)
          void this.opts.client
            .post({ channel: this.opts.map.management, ...r })
            .then((posted) => this.contentionMessages.set(e.payload.contentionId, posted));
        for (const id of e.payload.sessionIds) this.queue(id, r.text);
        break;
      }
      case "fleet.contention.resolved": {
        const c = host.state().contentions[e.payload.contentionId];
        if (!c) break;
        const owner = (id: string) => this.nameOf(host, host.state().sessions[id]?.ownerId ?? null);
        const r = contentionResolved({
          resource: c.resource,
          by: this.nameOf(host, e.actor),
          winner: c.winnerSessionId ? owner(c.winnerSessionId) : null,
          losers: c.sessionIds.filter((id) => id !== c.winnerSessionId).map(owner),
          note: e.payload.note,
          url: this.urlOf(host.projectId),
        });
        const ref = this.contentionMessages.get(c.id);
        if (ref) void this.opts.client.update(ref.channel, ref.ts, r.text, r.blocks);
        for (const id of c.sessionIds) this.queue(id, r.text);
        break;
      }
      case "project.directive.submitted": {
        const who = this.nameOf(host, e.actor);
        const channel = this.channelFor(host);
        const text = `:bookmark_tabs: *Project directive from ${who}* [${e.payload.input.mode}/${e.payload.input.scope}]: ${e.payload.input.text} (applies to ${e.payload.targets === "all" ? "all sessions" : `${e.payload.targets.length} session(s)`})`;
        if (channel) void this.opts.client.post({ channel, text });
        break;
      }
      case "claim.violation": {
        const holder = host.state().claims[e.payload.holderClaimId];
        const where = this.opts.map.management ? `<#${this.opts.map.management}>` : "";
        this.queue(
          e.payload.sessionId,
          refusedWriteLine(
            e.payload.path,
            this.nameOf(host, holder?.ownerId ?? null),
            e.payload.holderClaimId,
            where,
          ),
        );
        break;
      }
      default:
        break;
    }
  }

  /** Template 03: both sides as fields, no primary button, the link last. */
  private renderContention(host: ProjectHost, contentionId: string): Rendered | null {
    const c = host.state().contentions[contentionId];
    if (!c) return null;
    const pst = host.state();
    const sides = c.sessionIds.map((id) => {
      const ss = pst.sessions[id];
      const live = host.hosts.get(id)?.session.state();
      return {
        sessionId: id,
        owner: this.nameOf(host, ss?.ownerId ?? null),
        title: ss?.title ?? id,
        status: live?.status ?? ss?.report?.status ?? "unknown",
        turn: live?.turn ?? ss?.report?.turn ?? 0,
        tokens: usageTotal(live?.usage ?? ss?.report?.usage),
        holds: Object.values(pst.claims)
          .filter((cl) => cl.sessionId === id && cl.status === "active")
          .map((cl) => (cl.resource.type === "path" ? cl.resource.pattern : c.resource))
          .filter((k) => c.resource.includes(k) || k.includes(c.resource)),
      };
    });
    return contentionOpened({
      projectId: host.projectId,
      contentionId: c.id,
      kind: c.kind,
      resource: c.resource,
      detail: c.detail,
      sides,
      waitsOn: "a lead",
      url: this.urlOf(host.projectId),
    });
  }

  private ballotsOf(st: SessionState | undefined, a: ApprovalRecord): Ballot[] {
    const name = (id: string) => st?.participants[id]?.actor.name ?? id;
    return Object.entries(a.ballots).map(([id, b]) => ({
      name: name(id),
      vote: b.vote,
      rating: b.rating,
      note: b.note,
    }));
  }

  private ratingsOf(st: SessionState | undefined, plan: PlanRecord) {
    const name = (id: string) => st?.participants[id]?.actor.name ?? id;
    return Object.entries(plan.ratings).map(([id, r]) => ({ name: name(id), rating: r.rating }));
  }

  private onSessionEvent(host: ProjectHost, sessionId: string, e: SessionEvent): void {
    const sh = host.hosts.get(sessionId);
    const st = sh?.session.state(e.branch);
    const name = (id: string) =>
      st?.participants[id]?.actor.name ?? host.state().members[id]?.name ?? id;
    const ownerName = this.nameOf(host, st?.ownerId ?? null);
    const url = this.urlOf(host.projectId, sessionId);
    switch (e.kind) {
      case "participant.joined":
        this.queue(
          sessionId,
          e.payload.actor.kind === "agent"
            ? joinLine(ownerName, true)
            : joinLine(e.payload.actor.name, false),
        );
        break;
      case "agent.turn.ended":
        this.queue(
          sessionId,
          `turn ${e.payload.turn} ${e.payload.reason}: ${e.payload.summary.slice(0, 300)}`,
        );
        this.answerMention(host, sessionId, e, e.payload.summary, 0);
        break;
      case "agent.model.completed":
        if (e.payload.text.trim())
          this.answerMention(
            host,
            sessionId,
            e,
            e.payload.text,
            e.payload.usage ? usageTotal(e.payload.usage) : 0,
          );
        break;
      case "directive.submitted":
        this.queue(
          sessionId,
          `*${name(e.actor)}* [${e.payload.input.mode}/${e.payload.input.scope}]: ${e.payload.input.text}`,
        );
        break;
      case "approval.requested": {
        const ref = this.threads.get(sessionId);
        if (!ref) break;
        const call = e.payload.call;
        const rule = st ? ruleFor(st.policy.approvals, call.risk) : undefined;
        const r = approvalRequested({
          projectId: host.projectId,
          sessionId,
          approvalId: e.payload.approvalId,
          owner: ownerName,
          call,
          rule,
          url,
        });
        void this.opts.client
          .post({
            channel: ref.channel,
            threadTs: ref.ts,
            ...r,
            broadcast: call.risk === "irreversible",
          })
          .then((posted) => this.approvalMessages.set(e.payload.approvalId, posted));
        break;
      }
      case "approval.voted": {
        const a = st?.approvals[e.payload.approvalId];
        const ref = this.approvalMessages.get(e.payload.approvalId);
        if (!ref || !a || !st) break;
        const rule = ruleFor(st.policy.approvals, a.call.risk);
        const r =
          a.status === "pending"
            ? approvalRequested({
                projectId: host.projectId,
                sessionId,
                approvalId: a.id,
                owner: ownerName,
                call: a.call,
                rule,
                url,
                ballots: this.ballotsOf(st, a),
              })
            : approvalDecided({
                call: a.call,
                status: a.status,
                rule,
                ballots: this.ballotsOf(st, a),
                url,
              });
        void this.opts.client.update(ref.channel, ref.ts, r.text, r.blocks);
        break;
      }
      case "plan.proposed": {
        const ref = this.threads.get(sessionId);
        if (!ref || !st) break;
        const r = planProposed({
          projectId: host.projectId,
          sessionId,
          planId: e.payload.planId,
          owner: ownerName,
          goal: e.payload.goal,
          steps: e.payload.steps,
          estTokens: e.payload.estTokens,
          min: st.policy.planApproval.min,
          average: st.policy.planApproval.average,
          url,
        });
        void this.opts.client
          .post({ channel: ref.channel, threadTs: ref.ts, ...r })
          .then((posted) => this.planMessages.set(e.payload.planId, posted));
        break;
      }
      case "plan.rated": {
        const plan = st?.plans[e.payload.planId];
        // A council's plan lives in the chair's session: its synthesis message follows the ratings.
        if (plan) this.council.onPlanChanged(plan.id);
        const ref = this.planMessages.get(e.payload.planId);
        if (!ref || !plan || !st) break;
        // The fold approves the plan the moment the ratings meet the policy (no separate
        // event), so a rating may be the decision: buttons go, the result line takes their place.
        const r =
          plan.status === "proposed"
            ? planProposed({
                projectId: host.projectId,
                sessionId,
                planId: plan.id,
                owner: ownerName,
                goal: plan.goal,
                steps: plan.steps,
                estTokens: plan.estTokens,
                min: st.policy.planApproval.min,
                average: st.policy.planApproval.average,
                url,
                ratings: this.ratingsOf(st, plan),
              })
            : planDecided({
                status: plan.status === "approved" ? "approved" : "revise",
                by: "policy",
                ratings: this.ratingsOf(st, plan),
                url,
              });
        void this.opts.client.update(ref.channel, ref.ts, r.text, r.blocks);
        if (plan.status !== "proposed") this.queue(sessionId, r.text.replace(/ _\(edited\)_$/, ""));
        break;
      }
      case "plan.decided": {
        const plan = st?.plans[e.payload.planId];
        if (!plan) break;
        this.council.onPlanChanged(
          plan.id,
          e.payload.by === "policy" ? "policy" : name(e.payload.by),
        );
        const ref = this.planMessages.get(e.payload.planId);
        const r = planDecided({
          status: e.payload.status,
          by: e.payload.by === "policy" ? "policy" : name(e.payload.by),
          ratings: this.ratingsOf(st, plan),
          url,
        });
        if (ref) void this.opts.client.update(ref.channel, ref.ts, r.text, r.blocks);
        this.queue(sessionId, r.text.replace(/ _\(edited\)_$/, ""));
        break;
      }
      case "handoff.accepted":
        this.queue(sessionId, batonLine(name(e.actor)));
        break;
      case "workspace.blocked":
        break;
      default:
        break;
    }
  }

  private onMemoryEvent(store: MemoryStore, e: MemoryEvent): void {
    if (!this.opts.map.management) return;
    const st = store.state();
    if (e.kind === "memory.conflict.opened") {
      const sides = e.payload.entryIds
        .map((id) => st.entries[id])
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
        .map((s) => ({
          entryId: s.id,
          name: s.attribution.userName ?? s.attribution.userId,
          claim: s.content.split("\n")[0] ?? "",
        }));
      const r = memoryConflict({
        orgId: st.orgId,
        conflictId: e.payload.conflictId,
        key: e.payload.key,
        sides,
      });
      void this.opts.client
        .post({ channel: this.opts.map.management, ...r })
        .then((posted) => this.memoryMessages.set(e.payload.conflictId, posted));
    } else if (e.kind === "memory.conflict.resolved") {
      const ref = this.memoryMessages.get(e.payload.conflictId);
      const c = st.conflicts[e.payload.conflictId];
      if (!ref || !c) return;
      const winner = e.payload.winnerId ? st.entries[e.payload.winnerId] : undefined;
      const r = memoryResolved({
        key: c.key,
        by: this.opts.server.orgs.user(e.actor)?.name ?? e.actor,
        winner: winner ? (winner.attribution.userName ?? winner.attribution.userId) : null,
      });
      void this.opts.client.update(ref.channel, ref.ts, r.text, r.blocks);
    }
  }

  private queue(sessionId: string, line: string): void {
    const q = this.pendingLines.get(sessionId) ?? [];
    q.push(line);
    this.pendingLines.set(sessionId, q);
    this.flushLater(sessionId);
  }

  private flushLater(sessionId: string): void {
    const ms = this.opts.coalesceMs ?? 1500;
    if (ms === 0) {
      void this.flush(sessionId);
      return;
    }
    if (this.timers.has(sessionId)) return;
    this.timers.set(
      sessionId,
      setTimeout(() => {
        this.timers.delete(sessionId);
        void this.flush(sessionId);
      }, ms),
    );
  }

  /** Post queued lines for a session as one thread reply. Public so tests and shutdown can drain. */
  async flush(sessionId: string): Promise<void> {
    const ref = this.threads.get(sessionId);
    const lines = this.pendingLines.get(sessionId) ?? [];
    if (!ref || !lines.length) return;
    this.pendingLines.set(sessionId, []);
    await this.opts.client.post({ channel: ref.channel, threadTs: ref.ts, text: lines.join("\n") });
  }

  async flushAll(): Promise<void> {
    for (const id of this.pendingLines.keys()) await this.flush(id);
  }

  // ---- 05 · the daily brief --------------------------------------------------------------

  /** The brief's data, computed from the ledger and the live sessions (template 05). */
  briefInput(
    projectId: string,
    now: Date = (this.opts.now ?? (() => new Date()))(),
  ): DailyBriefInput {
    const host = this.opts.server.project(projectId);
    const pst = host.state();
    const states = host.sessionStates();
    const open = Object.values(pst.sessions).filter((s) => s.open);
    const counts = new Map<string, number>();
    const needs: BriefNeed[] = [];
    const sessions: DailyBriefInput["sessions"] = [];
    let tokens = 0;
    let budget = 0;
    const plans = { approved: 0, waiting: 0, ratings: [] as number[] };
    const gates = { granted: 0, waiting: 0 };
    let approvalsWaiting = 0;
    for (const s of open.sort((a, b) => a.registeredSeq - b.registeredSeq)) {
      const live = states[s.sessionId];
      const status = live?.status ?? s.report?.status ?? "unknown";
      counts.set(status, (counts.get(status) ?? 0) + 1);
      const owner = this.nameOf(host, s.ownerId);
      const used = usageTotal(live?.usage ?? s.report?.usage);
      tokens += used;
      budget += live?.policy.tokenBudget ?? 0;
      sessions.push({
        owner,
        title: s.title,
        status,
        turn: live?.turn ?? s.report?.turn ?? 0,
        tokens: used,
        crew: s.crew,
      });
      if (!live) continue;
      const url = this.urlOf(projectId, s.sessionId);
      for (const a of Object.values(live.approvals)) {
        const rule = ruleFor(live.policy.approvals, a.call.risk);
        const ratings = isRatingsRule(rule);
        if (a.status === "pending") {
          approvalsWaiting += 1;
          if (ratings) gates.waiting += 1;
          const so = this.ballotsOf(live, a)
            .map((b) =>
              b.vote === "deny" ? `${b.name} denied` : `${b.name} rated ${b.rating ?? "it"}`,
            )
            .join(" · ");
          needs.push({
            line: `\`${a.call.name}\` in *${owner}*'s session waits for ${describeRule(rule)}${so ? ` · ${so}` : ""}`,
            url,
            action: ratings ? "Rate it" : "Vote",
          });
        } else if (a.status === "granted" && ratings) gates.granted += 1;
      }
      for (const p of Object.values(live.plans)) {
        if (p.status === "proposed") {
          plans.waiting += 1;
          needs.push({
            line: `A plan in *${owner}*'s session waits for a rating`,
            url,
            action: "Rate it",
          });
        } else if (p.status === "approved" || p.status === "done") plans.approved += 1;
        for (const r of Object.values(p.ratings)) plans.ratings.push(r.rating);
      }
    }
    for (const c of Object.values(pst.contentions).filter((c) => !c.resolved))
      needs.push({
        line: `${c.sessionIds.map((id) => `*${this.nameOf(host, pst.sessions[id]?.ownerId ?? null)}*`).join(" and ")} contend for \`${c.resource}\``,
        url: this.urlOf(projectId),
        action: "Resolve",
      });
    const crews = new Map<string, string[]>();
    for (const s of open)
      if (s.crew) crews.set(s.crew, [...(crews.get(s.crew) ?? []), this.nameOf(host, s.ownerId)]);
    const direction = Object.values(pst.directives).find(
      (d) => d.status === "active" && d.input.scope === "goal",
    );
    const average = plans.ratings.length
      ? Math.round((plans.ratings.reduce((n, r) => n + r, 0) / plans.ratings.length) * 10) / 10
      : null;
    return {
      projectId,
      project: pst.name || projectId,
      weekday: weekdayOf(now),
      seq: pst.seq,
      open: open.length,
      counts: [...counts].map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`).join(", "),
      needs,
      sessions,
      tokens,
      budget: budget || null,
      plans: { approved: plans.approved, waiting: plans.waiting, average },
      gates,
      crews: [...crews].map(([name, owners]) => ({ name, owners })),
      direction: direction?.input.text ?? null,
      approvalsWaiting,
      contentionsOpen: Object.values(pst.contentions).filter((c) => !c.resolved).length,
      url: this.urlOf(projectId),
    };
  }

  /** The daily brief as Slack renders it. */
  renderBrief(projectId: string, now?: Date): Rendered {
    return dailyBrief(this.briefInput(projectId, now));
  }

  /**
   * Post the brief to the management channel (or the project's). The schedule (8:00 on
   * working days, skipped when nothing ran) belongs to whoever runs the adapter; this is the
   * one call it makes.
   */
  async postBrief(projectId: string, now?: Date): Promise<ThreadRef | null> {
    const host = this.opts.server.project(projectId);
    const channel = this.opts.map.management ?? this.channelFor(host);
    if (!channel) return null;
    return this.opts.client.post({ channel, ...this.renderBrief(projectId, now) });
  }

  // ---- inbound -------------------------------------------------------------------------

  private userFor(slackUserId: string): string {
    return this.opts.map.users[slackUserId] ?? slackUserId;
  }

  private joinIfNeeded(host: ProjectHost, sh: FleetSessionHost, user: string): SessionState {
    const st = sh.session.state();
    if (!st.participants[user])
      sh.session.join(
        "main",
        { id: user, kind: "human", name: this.nameOf(host, user) },
        this.roleFor(host, user, st.ownerId),
      );
    return sh.session.state();
  }

  /**
   * Buttons. A vote's rating is the button's `value`; a plain Approve under a release gate
   * (no value) sends `DEFAULT_RATING`, which is what the app's Approve sends; a plain Approve
   * under any other rule carries no rating, as the app's does not.
   */
  private async onAction(e: { actionId: string; value: string; userId: string }): Promise<void> {
    const [kind, a, b, c, d] = e.actionId.split(":");
    const user = this.userFor(e.userId);
    try {
      if (kind === "vote" && a && b && c && d) {
        const host = this.opts.server.project(a);
        const sh = host.hosts.get(b);
        if (!sh) throw new Error(`unknown session ${b}`);
        const st = this.joinIfNeeded(host, sh, user);
        const approval = st.approvals[c];
        const rule = approval ? ruleFor(st.policy.approvals, approval.call.risk) : "owner";
        const picked = Rating.safeParse(Number(e.value));
        const rating =
          d !== "approve"
            ? undefined
            : picked.success
              ? picked.data
              : isRatingsRule(rule)
                ? DEFAULT_RATING
                : undefined;
        sh.session.vote(
          "main",
          user,
          c,
          d === "approve" ? "approve" : "deny",
          rating,
          "from Slack",
        );
        void sh.drive("main");
      } else if (kind === "plan" && a && b && c) {
        const host = this.opts.server.project(a);
        const sh = host.hosts.get(b);
        if (!sh) throw new Error(`unknown session ${b}`);
        this.joinIfNeeded(host, sh, user);
        const picked = Rating.safeParse(Number(e.value));
        if (!picked.success) throw new Error("a plan rating is a whole number from 1 to 5");
        sh.session.ratePlan("main", user, c, picked.data, "from Slack");
        void sh.drive("main");
      } else if (kind === "council.rate" && a && b && c) {
        const picked = Rating.safeParse(Number(e.value));
        if (!picked.success) throw new Error("a plan rating is a whole number from 1 to 5");
        this.council.rate(user, a, b, c, picked.data);
      } else if (kind === "resolve" && a && b && c) {
        this.opts.server.project(a).project.resolveContention(user, b, c, "resolved from Slack");
      } else if (kind === "memory" && a && b && c) {
        this.opts.server.memory(a).resolveConflict(user, b, c, "resolved from Slack");
      } else if (kind === "memory.add" && a) {
        const answer = this.answers.get(e.value || a);
        if (!answer) throw new Error("that answer is no longer here to remember");
        const name = this.opts.server.orgs.user(user)?.name;
        this.opts.server.memory(answer.orgId).remember({
          scope: { orgId: answer.orgId, projectId: answer.projectId },
          content: answer.text,
          tags: ["slack"],
          attribution: {
            userId: user,
            ...(name ? { userName: name } : {}),
            agentId: "agent",
            sessionId: answer.sessionId,
          },
        });
      }
    } catch (err) {
      this.opts.log?.(`slack action failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private roleFor(
    host: ProjectHost,
    user: string,
    ownerId: string | null,
  ): "owner" | "contributor" | "observer" {
    if (user === ownerId) return "owner";
    const rank = host.project.rankOf(user);
    return rank >= 2 ? "owner" : rank >= 1 ? "contributor" : "observer";
  }

  private async onMessage(e: {
    channel: string;
    threadTs: string | null;
    ts: string;
    userId: string;
    text: string;
  }): Promise<void> {
    if (!e.threadTs) {
      await this.onMention(e);
      return;
    }
    const entry = [...this.threads.entries()].find(
      ([, ref]) => ref.channel === e.channel && ref.ts === e.threadTs,
    );
    if (!entry) return;
    const [sessionId] = entry;
    const user = this.userFor(e.userId);
    for (const host of this.opts.server.projects.values()) {
      const sh = host.hosts.get(sessionId);
      if (!sh) continue;
      try {
        this.joinIfNeeded(host, sh, user);
        const m = e.text.match(/^\/(\w+)\s*(.*)$/s);
        const text = m ? (m[2] ?? "") : e.text;
        const scopeMatch = text.match(/^\[([a-z0-9._-]+)\]\s*(.*)$/s);
        const scope = scopeMatch?.[1];
        const input: Partial<DirectiveInput> & { text: string } =
          m?.[1] === "constrain"
            ? { text, mode: "constrain" }
            : m?.[1] === "pause" || m?.[1] === "resume" || m?.[1] === "cancel"
              ? { text: text || m[1], mode: m[1] as "pause" | "resume" | "cancel" }
              : scope
                ? { text: scopeMatch?.[2] ?? "", scope }
                : { text };
        sh.session.directive("main", user, input);
        void sh.drive("main");
      } catch (err) {
        this.opts.log?.(`slack steer failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }
  }

  // ---- 04 · mention reply ----------------------------------------------------------------

  /**
   * "@Ana's agent, …" in a team channel routes to Ana's running session (else her newest
   * paused one) as a steer in the scope `chat`; a placeholder is posted at once in the
   * message's thread as "Ana's agent" and edited into the agent's next words. The owner's
   * session thread gets one line, so nothing happens behind the driver's back.
   */
  private async onMention(e: {
    channel: string;
    ts: string;
    userId: string;
    text: string;
  }): Promise<void> {
    const m = e.text.match(/@([^@'’\n]+?)['’]s agent\b/i);
    if (!m?.[1]) return;
    const wanted = m[1].trim().toLowerCase();
    const teamId = Object.entries(this.opts.map.teams).find(([, ch]) => ch === e.channel)?.[0];
    const projectId = Object.entries(this.opts.map.projects).find(
      ([, ch]) => ch === e.channel,
    )?.[0];
    const hosts = [...this.opts.server.projects.values()].filter(
      (h) =>
        this.watched.has(h.projectId) &&
        (projectId ? h.projectId === projectId : teamId ? h.state().teamId === teamId : true),
    );
    const asker = this.userFor(e.userId);
    const first = hosts[0];
    const askerName = first
      ? this.nameOf(first, asker)
      : (this.opts.server.orgs.user(asker)?.name ?? asker);
    // A running session answers with its next words, an idle one starts a turn; a session
    // parked at an approval or a pause cannot answer until someone frees it.
    const rank = (s: string) => (s === "running" ? 3 : s === "idle" ? 2 : s === "paused" ? 1 : 0);
    const candidates: { host: ProjectHost; sessionId: string; score: number; seq: number }[] = [];
    for (const host of hosts) {
      const pst = host.state();
      for (const s of Object.values(pst.sessions)) {
        if (!s.open || this.nameOf(host, s.ownerId).toLowerCase() !== wanted) continue;
        const live = host.hosts.get(s.sessionId)?.session.state();
        if (!live) continue;
        candidates.push({
          host,
          sessionId: s.sessionId,
          score: rank(live.status),
          seq: s.registeredSeq,
        });
      }
    }
    const best = candidates.sort((x, y) => y.score - x.score || y.seq - x.seq)[0];
    if (!best) {
      void this.opts.client.post({
        channel: e.channel,
        threadTs: e.ts,
        text: `No session of ${m[1].trim()}'s is running.`,
      });
      return;
    }
    const { host, sessionId } = best;
    const sh = host.hosts.get(sessionId);
    if (!sh) return;
    const ownerName = this.nameOf(host, host.state().sessions[sessionId]?.ownerId ?? null);
    try {
      const st = this.joinIfNeeded(host, sh, asker);
      if (st.participants[asker]?.role === "observer") {
        void this.opts.client.post({
          channel: e.channel,
          threadTs: e.ts,
          text: `You can watch ${ownerName}'s session; ask ${ownerName} to join you as a contributor.`,
        });
        return;
      }
      const placeholder = await this.opts.client.post({
        channel: e.channel,
        threadTs: e.ts,
        as: `${ownerName}'s agent`,
        ...mentionPlaceholder(ownerName),
      });
      const directive = sh.session.directive("main", asker, {
        text: `${askerName} in <#${e.channel}>: ${e.text}`,
        mode: "steer",
        scope: "chat",
      });
      const list = this.pendingMentions.get(sessionId) ?? [];
      list.push({
        projectId: host.projectId,
        sessionId,
        afterSeq: directive.seq,
        placeholder,
        asker: askerName,
        channel: `<#${e.channel}>`,
      });
      this.pendingMentions.set(sessionId, list);
      void sh.drive("main");
    } catch (err) {
      this.opts.log?.(`slack mention failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** The agent's next words after a mention edit the placeholder into the answer. */
  private answerMention(
    host: ProjectHost,
    sessionId: string,
    e: SessionEvent,
    text: string,
    tokens: number,
  ): void {
    const list = this.pendingMentions.get(sessionId);
    if (!list?.length || e.branch !== "main") return;
    const rest: PendingMention[] = [];
    const st = host.hosts.get(sessionId)?.session.state();
    const ownerName = this.nameOf(host, st?.ownerId ?? null);
    for (const p of list) {
      if (e.seq <= p.afterSeq) {
        rest.push(p);
        continue;
      }
      const answer = text.replace(/^(DONE|continuing):?\s*/i, "").trim() || "(nothing to say)";
      this.answers.set(p.placeholder.ts, {
        orgId: host.state().orgId,
        projectId: host.projectId,
        sessionId,
        text: answer,
      });
      const r = mentionReply({
        owner: ownerName,
        title: st?.title ?? sessionId,
        asker: p.asker,
        channel: p.channel,
        answer,
        tokens,
        url: this.urlOf(host.projectId, sessionId),
        rememberActionId: `memory.add:${p.placeholder.ts}`,
        rememberValue: p.placeholder.ts,
      });
      void this.opts.client.update(p.placeholder.channel, p.placeholder.ts, r.text, r.blocks);
      this.queue(sessionId, answeredLine(ownerName, p.asker, p.channel));
    }
    if (rest.length) this.pendingMentions.set(sessionId, rest);
    else this.pendingMentions.delete(sessionId);
  }

  private async onSlash(e: {
    text: string;
    userId: string;
    channel: string;
    respond(t: string): Promise<void>;
  }): Promise<void> {
    const [cmd, arg, ...rest] = e.text.trim().split(/\s+/);
    try {
      if (cmd === "council" && arg && rest.length) {
        const r = this.council.convene(this.userFor(e.userId), e.channel, arg, rest.join(" "));
        const where = r.channel
          ? `It runs in <#${r.channel}>.`
          : "No Slack channel maps to this group; follow it in Henosis.";
        await e.respond(
          `Convened a council in _${r.group.name}_: ${r.members.length === 1 ? "one model" : `${r.members.length} models`}, *${r.chair.name}* chairs. ${where}`,
        );
      } else if (cmd === "brief" && arg) {
        const now = briefNow(this.briefInput(arg));
        await e.respond(`${now}\n\n${this.opts.server.project(arg).brief()}`);
      } else if (cmd === "sessions" && arg) {
        const st = this.opts.server.project(arg).state();
        await e.respond(
          Object.values(st.sessions)
            .filter((s) => s.open)
            .map((s) => {
              const url = this.urlOf(arg, s.sessionId);
              return `• ${st.members[s.ownerId]?.name ?? s.ownerId}: ${s.title} [${s.report?.status ?? "unknown"}]${url ? ` <${url}|open>` : ""}`;
            })
            .join("\n") || "no open sessions",
        );
      } else if (cmd === "memory" && arg) {
        await e.respond(
          this.opts.server.memory(arg).contextFor({ orgId: arg }, this.userFor(e.userId)) ||
            "team memory is empty",
        );
      } else {
        await e.respond(
          "usage: /henosis brief <project> | sessions <project> | memory <org> | council <group> <task>",
        );
      }
    } catch (err) {
      await e.respond(`error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

type FleetSessionHost = ReturnType<ProjectHost["session"]>;
