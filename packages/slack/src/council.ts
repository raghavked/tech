/**
 * The council in Slack (docs/19_council.md, "Slack and CLI"). `/henosis council <group> <task>`
 * convenes a council of the group's people's agents in the group's chat log; the council's
 * events then post into the group's channel: the root message when it is convened, every
 * round and every word in its thread with the member and its model named, the chair's plan
 * with rating buttons, the assignments and reports as lines, and the conclusion with the
 * dissent. A star rates the plan in the chair's session, exactly as the app's plan card does.
 *
 * The bridge watches the chat log, so a council convened from the app posts here too, and it
 * runs nothing itself: the rounds are the council host's. Posts for one council are chained
 * so the thread reads in the order the log wrote it.
 */
import type { ChatEvent, ChatState, Council, CouncilMember, Group } from "@henosis/chat";
import { councilMemberOf, personalAgentId } from "@henosis/fleet";
import type { PlanRecord, SessionState } from "@henosis/kernel";
import { usageTotal } from "@henosis/protocol";
import type { HenosisServer, ProjectHost, SessionHost } from "@henosis/server";
import type { ChannelMap } from "./adapter.js";
import type { Block, SlackClient } from "./client.js";
import {
  type CouncilModelLabel,
  councilAssignedLine,
  councilConcluded,
  councilConvened,
  councilReportedLine,
  councilRoundLine,
  councilSaid,
  councilSynthesised,
} from "./councilTemplates.js";
import { appUrlOf, linkOf } from "./links.js";

interface ThreadRef {
  channel: string;
  ts: string;
}

export interface SlackCouncilOptions {
  server: HenosisServer;
  client: SlackClient;
  map: ChannelMap;
  appBaseUrl?: string | undefined;
  /** Join a person to a session (as the adapter does for a vote) and return its state. */
  join: (host: ProjectHost, sh: SessionHost, userId: string) => SessionState;
  log?: ((line: string) => void) | undefined;
}

/** The sentence `/henosis council` answers with. */
export interface ConveneResult {
  councilId: string;
  group: Group;
  channel: string | null;
  members: CouncilMember[];
  chair: CouncilMember;
}

export class SlackCouncil {
  /** The council's root message, by council id. */
  private readonly threads = new Map<string, ThreadRef>();
  /** The synthesis message, by council id, edited as the ratings land. */
  private readonly planMessages = new Map<string, ThreadRef>();
  /** The council a plan belongs to, by plan id. */
  private readonly plans = new Map<string, { orgId: string; councilId: string }>();
  /** One promise chain per council so its posts land in log order. */
  private readonly chains = new Map<string, Promise<void>>();
  private readonly watched = new Set<string>();

  constructor(private readonly opts: SlackCouncilOptions) {}

  /** Follow an organisation's chat log: its councils post into their groups' channels. */
  watchOrg(orgId: string): void {
    if (this.watched.has(orgId)) return;
    this.watched.add(orgId);
    const host = this.opts.server.chat(orgId);
    host.chat.onEvent((e, state) => this.onChatEvent(orgId, e, state));
  }

  /** Wait for every queued post to land (tests and shutdown). */
  async settle(): Promise<void> {
    await Promise.all([...this.chains.values()]);
  }

  // ---- convene -------------------------------------------------------------------------

  /**
   * Convene a council in a group on a task, with every member's agent as a member model. The
   * group is named by id or name; a group whose channel is the one the command came from wins
   * a tie. The convener must be a member of the group; the chair defaults to their agent.
   */
  convene(userId: string, channel: string, groupArg: string, task: string): ConveneResult {
    const found = this.findGroup(groupArg, channel);
    if (!found) throw new Error(`no group named ${groupArg}`);
    const { orgId, group } = found;
    const members = this.memberModels(group);
    if (!members.length) throw new Error(`${group.name} has no member with an agent`);
    const chat = this.opts.server.chat(orgId).chat;
    const council = chat.convene(userId, group.id, { task, members });
    return {
      councilId: council.id,
      group,
      channel: this.channelForGroup(group),
      members: council.members,
      chair: council.chair,
    };
  }

  private findGroup(arg: string, channel: string): { orgId: string; group: Group } | null {
    const key = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-");
    const wanted = key(arg);
    const hits: { orgId: string; group: Group }[] = [];
    for (const org of this.opts.server.orgs.orgs.orgs) {
      const st = this.opts.server.chat(org.id).state();
      for (const g of Object.values(st.groups))
        if (g.id === arg || key(g.name) === wanted) hits.push({ orgId: org.id, group: g });
    }
    return (
      hits.find((h) => this.channelForGroup(h.group) === channel) ??
      hits.sort((a, b) => b.group.lastSeq - a.group.lastSeq)[0] ??
      null
    );
  }

  /** The member models of a group: each person's agent, as the org's profiles know it. */
  private memberModels(group: Group): CouncilMember[] {
    const orgs = this.opts.server.orgs;
    const trusting = orgs.users.size === 0 && orgs.agents.agents.length === 0;
    const out: CouncilMember[] = [];
    for (const m of group.members) {
      if (m.kind !== "human") continue;
      const profile = orgs.agentProfile(personalAgentId(m.userId));
      if (profile) out.push(councilMemberOf(profile));
      else if (trusting)
        out.push({
          kind: "agent",
          userId: m.userId,
          profileId: personalAgentId(m.userId),
          name: `${m.name ?? m.userId}'s agent`,
        });
    }
    return out;
  }

  // ---- outbound ------------------------------------------------------------------------

  private channelForGroup(g: Group): string | null {
    return (
      (g.scope.projectId ? this.opts.map.projects[g.scope.projectId] : undefined) ??
      (g.scope.teamId ? this.opts.map.teams[g.scope.teamId] : undefined) ??
      this.opts.map.management ??
      null
    );
  }

  private personName(userId: string): string {
    return this.opts.server.orgs.user(userId)?.name ?? userId;
  }

  /** The model a member speaks through, from its profile: "scripted", "claude", "claude <model>". */
  private modelOf(m: CouncilMember): string {
    const p = this.opts.server.orgs.agentProfile(m.profileId);
    if (!p) return "";
    return p.provider === "claude" ? (p.model ? `claude ${p.model}` : "claude") : p.provider;
  }

  private label(m: CouncilMember): CouncilModelLabel {
    return { name: m.name, model: this.modelOf(m) };
  }

  /** The session the chair's plan lives in, if it is open anywhere. */
  private planSession(
    planId: string,
  ): { host: ProjectHost; sh: SessionHost; plan: PlanRecord; state: SessionState } | null {
    for (const host of this.opts.server.projects.values())
      for (const sh of host.hosts.values()) {
        const state = sh.session.state();
        const plan = state.plans[planId];
        if (plan) return { host, sh, plan, state };
      }
    return null;
  }

  private enqueue(councilId: string, fn: () => Promise<void>): void {
    const prev = this.chains.get(councilId) ?? Promise.resolve();
    const next = prev.then(fn).catch((err) => {
      this.opts.log?.(
        `slack council post failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
    this.chains.set(councilId, next);
  }

  private onChatEvent(orgId: string, e: ChatEvent, state: ChatState): void {
    if (!("councilId" in e.payload)) return;
    const councilId = e.payload.councilId;
    const c = state.councils[councilId];
    if (!c) return;
    const group = state.groups[c.groupId];
    if (!group) return;
    switch (e.kind) {
      case "council.convened":
        this.enqueue(councilId, async () => {
          await this.postRoot(c, group);
        });
        break;
      case "council.round.started": {
        const { round, index } = e.payload;
        this.enqueue(councilId, () =>
          this.reply(c, group, {
            text: councilRoundLine(round, index, c.discussionRounds, c.members.length),
          }),
        );
        break;
      }
      case "council.said": {
        const p = e.payload;
        const cites = p.cites.map((x) => this.personName(x.by));
        const r = councilSaid({
          member: this.label(p.member),
          round: p.round,
          index: p.index,
          stance: p.stance ?? null,
          text: p.text,
          cites,
          tokens: usageTotal(p.usage),
        });
        this.enqueue(councilId, () => this.reply(c, group, { ...r, as: p.member.name }));
        break;
      }
      case "council.synthesised": {
        const planId = e.payload.planId;
        this.plans.set(planId, { orgId, councilId });
        this.enqueue(councilId, async () => {
          const root = await this.rootOf(c, group);
          if (!root) return;
          const r = this.renderPlan(orgId, c, planId, undefined);
          const posted = await this.opts.client.post({
            channel: root.channel,
            threadTs: root.ts,
            broadcast: true,
            ...r,
          });
          this.planMessages.set(councilId, posted);
        });
        break;
      }
      case "council.assigned": {
        const p = e.payload;
        const step = c.synthesis?.steps.find((s) => s.id === p.stepId);
        this.enqueue(councilId, () =>
          this.reply(c, group, {
            text: councilAssignedLine(
              this.label(p.owner),
              step?.title ?? p.stepId,
              appUrlOf(linkOf(p.projectId, p.sessionId), this.opts.appBaseUrl),
            ),
          }),
        );
        break;
      }
      case "council.reported": {
        const p = e.payload;
        const step = c.synthesis?.steps.find((s) => s.id === p.stepId);
        this.enqueue(councilId, () =>
          this.reply(c, group, {
            text: councilReportedLine(
              this.label(p.owner),
              step?.title ?? p.stepId,
              p.status,
              p.text,
            ),
          }),
        );
        break;
      }
      case "council.concluded": {
        const steps = c.synthesis
          ? {
              done: c.synthesis.steps.filter((s) => c.reports[s.id]?.status === "done").length,
              of: c.synthesis.steps.length,
            }
          : null;
        const found = c.synthesis ? this.planSession(c.synthesis.planId) : null;
        const r = councilConcluded({
          task: c.task,
          outcome: c.outcome ?? "abandoned",
          summary: c.summary,
          steps,
          dissent: (c.synthesis?.dissent ?? []).map((d) => ({
            member: this.label(d.member),
            text: d.text,
          })),
          tokens: usageTotal(c.usage),
          url: found
            ? appUrlOf(linkOf(found.host.projectId, found.sh.sessionId), this.opts.appBaseUrl)
            : null,
        });
        this.enqueue(councilId, () => this.reply(c, group, { ...r, broadcast: true }));
        break;
      }
      default:
        // council.instructed is private to the instructed member's owner and the chair.
        break;
    }
  }

  private async postRoot(c: Council, group: Group): Promise<ThreadRef | null> {
    const existing = this.threads.get(c.id);
    if (existing) return existing;
    const channel = this.channelForGroup(group);
    if (!channel) return null;
    const r = councilConvened({
      councilId: c.id,
      group: group.name,
      by: this.personName(c.by),
      task: c.task,
      chair: this.label(c.chair),
      members: c.members.map((m) => this.label(m)),
      rounds: c.roundPlan,
      discussionRounds: c.discussionRounds,
      budget: c.budget,
      url: null,
    });
    const posted = await this.opts.client.post({ channel, ...r });
    this.threads.set(c.id, posted);
    return posted;
  }

  /** The council's thread, posted now when the council predates the adapter. */
  private rootOf(c: Council, group: Group): Promise<ThreadRef | null> {
    return this.postRoot(c, group);
  }

  private async reply(
    c: Council,
    group: Group,
    r: { text: string; blocks?: Block[]; as?: string; broadcast?: boolean },
  ): Promise<void> {
    const root = await this.rootOf(c, group);
    if (!root) return;
    await this.opts.client.post({ channel: root.channel, threadTs: root.ts, ...r });
  }

  private renderPlan(orgId: string, c: Council, planId: string, by: string | undefined) {
    const found = this.planSession(planId);
    const name = (id: string) => found?.state.participants[id]?.actor.name ?? this.personName(id);
    const ratings = found
      ? Object.entries(found.plan.ratings).map(([id, r]) => ({ name: name(id), rating: r.rating }))
      : [];
    const status = found?.plan.status;
    const decided =
      status === "approved" || status === "revise" || status === "rejected"
        ? {
            status,
            by:
              by ??
              (found?.plan.decidedBy && found.plan.decidedBy !== "policy"
                ? name(found.plan.decidedBy)
                : "policy"),
          }
        : undefined;
    return councilSynthesised({
      orgId,
      councilId: c.id,
      planId,
      chair: this.label(c.chair),
      task: c.task,
      steps: (c.synthesis?.steps ?? []).map((s) => ({
        title: s.title,
        owner: this.label(s.owner),
        risk: s.risk,
        estTokens: s.estTokens,
      })),
      dissent: (c.synthesis?.dissent ?? []).map((d) => ({
        member: this.label(d.member),
        text: d.text,
      })),
      bar: found ? found.state.policy.planApproval : null,
      ratings,
      decided,
      url: found
        ? appUrlOf(linkOf(found.host.projectId, found.sh.sessionId), this.opts.appBaseUrl)
        : null,
    });
  }

  // ---- inbound -------------------------------------------------------------------------

  /** A star on the synthesis message rates the chair's plan in its session. */
  rate(userId: string, orgId: string, councilId: string, planId: string, rating: number): void {
    const found = this.planSession(planId);
    if (!found) throw new Error("the chair's plan has no open session to rate in yet");
    const c = this.opts.server.chat(orgId).state().councils[councilId];
    if (!c) throw new Error(`unknown council ${councilId}`);
    this.opts.join(found.host, found.sh, userId);
    found.sh.session.ratePlan("main", userId, planId, rating, "from Slack");
    void found.sh.drive("main");
  }

  /**
   * A rating or a decision on a council's plan, seen in its session, edits the synthesis
   * message: the ratings so far while it is proposed; the result line, buttons gone, after.
   */
  onPlanChanged(planId: string, by?: string): void {
    const ref = this.plans.get(planId);
    const msg = ref ? this.planMessages.get(ref.councilId) : undefined;
    if (!ref || !msg) return;
    const c = this.opts.server.chat(ref.orgId).state().councils[ref.councilId];
    if (!c) return;
    const r = this.renderPlan(ref.orgId, c, planId, by);
    this.enqueue(ref.councilId, () =>
      this.opts.client.update(msg.channel, msg.ts, r.text, r.blocks),
    );
  }
}
