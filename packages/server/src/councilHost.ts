/**
 * CouncilHost: runs the councils of one organisation (docs/19_council.md, "Orchestration").
 * The chat log is the record and `councilNext` (packages/chat) is the brain; this host does
 * what the protocol says next and nothing else:
 *
 * - a deliberation round calls every member model in parallel, through the same `Model`
 *   interface a session uses, with the member's profile (persona, provider), the group's
 *   recent messages and that member's uncited private instructions, and records each answer
 *   as `council.said` with the usage the model counted;
 * - synthesis calls the chair's model with every answer and dissent, records its words, opens
 *   the council session (owned by the chair's owner, in the group's project, in the council's
 *   crew) and proposes the plan there for real, so the ordinary ratings and release gates
 *   apply; `council.synthesised` names the plan;
 * - the vote is the plan's status in that session: approved assigns, revise reopens synthesis,
 *   rejected concludes;
 * - every step becomes a directive `council <id> step <n>: <title>` in its owner's member
 *   session (one per owner per council, in the crew named for the council), and each turn that
 *   ends there after the directive is relayed back as `council.reported`;
 * - the council concludes when every step reports done, when the budget is spent, when a
 *   round has no answers, when the plan is rejected, or when the convener ends it.
 *
 * One loop per council; every wait is a sleep until an event touches the council (a chat
 * event, a plan event in the council session, a turn ending in a member session). The loop
 * reads the log afresh each time round, so a restart resumes any council that is not concluded.
 */
import {
  type Chat,
  type ChatEvent,
  type ChatState,
  type Council,
  type CouncilInstruction,
  type CouncilMember,
  type CouncilNext,
  type CouncilReportStatus,
  type CouncilRoundRef,
  type CouncilStep,
  type CouncilVote,
  councilLabel,
  councilNext,
  type Group,
  memberName,
  owedIn,
  pendingInstructions,
  sameCouncilMember,
} from "@henosis/chat";
import type { AgentProfile } from "@henosis/fleet";
import { KernelError, type PlanRecord, shortId } from "@henosis/kernel";
import {
  type Actor,
  GOAL_SCOPE,
  MAIN_BRANCH,
  type Usage,
  usageTotal,
  ZERO_USAGE,
} from "@henosis/protocol";
import {
  citesFor,
  councilContext,
  councilPrompt,
  type Model,
  parseSaid,
  parseSynthesis,
} from "@henosis/runner";
import type { SessionHost } from "./host.js";
import type { ProjectHost } from "./projectHost.js";

export interface CouncilHostOptions {
  orgId: string;
  chat: Chat;
  /** The project a council's sessions live in: the group's project, else the org's first. */
  projectFor: (group: Group) => ProjectHost | null;
  /** A member model's profile, or null when the directory does not know it. */
  profile: (profileId: string) => AgentProfile | null;
  /** The model a member speaks through; the profile decides the provider. */
  modelFor: (profile: AgentProfile | null, member: CouncilMember) => Model;
  /** A person's display name. */
  personName: (userId: string) => string;
  /** Every model call's usage, attributed to the member's owner (the convener for a shared agent). */
  onUsage?: ((userId: string, usage: Usage) => void) | undefined;
  log?: ((line: string) => void) | undefined;
  /** How many of the group's latest messages a member reads; 6 by default. */
  contextMessages?: number | undefined;
}

/** The council as the HTTP route serves it: the fold plus what the chair's session knows. */
export interface CouncilView {
  council: Council;
  label: string;
  vote: CouncilVote;
  next: CouncilNext;
  plan: {
    projectId: string;
    sessionId: string;
    planId: string;
    status: PlanRecord["status"];
    ratings: PlanRecord["ratings"];
    decidedBy: string | null;
  } | null;
  /** The member sessions the steps run in, by profile id. */
  sessions: Record<string, { projectId: string; sessionId: string; status: string | null }>;
}

const DIRECTIVE_PREFIX = "council ";

/** The sentence a report carries, from a turn summary: the DONE and "continuing" markers off. */
function reportText(summary: string, reason: string): string {
  return summary.replace(/^(DONE|continuing):?\s*/i, "").trim() || reason;
}

export class CouncilHost {
  readonly orgId: string;
  readonly chat: Chat;
  private readonly running = new Set<string>();
  private readonly wakers = new Map<string, () => void>();
  private readonly dirty = new Set<string>();
  /** Sessions this host listens to, so a session is wired once however often it is opened. */
  private readonly watched = new Set<string>();
  /**
   * Instructions that landed while a member's model was already thinking: their seq is below
   * the answer's, so the chat counts them as cited; the host carries them into that member's
   * next round instead. By council id, then profile id.
   */
  private readonly carried = new Map<string, Map<string, CouncilInstruction[]>>();
  private closed = false;

  constructor(private readonly opts: CouncilHostOptions) {
    this.orgId = opts.orgId;
    this.chat = opts.chat;
    this.chat.onEvent((e) => this.onChatEvent(e));
  }

  /** Start (or resume, after a restart) every council in the log that has not concluded. */
  resume(): void {
    for (const c of Object.values(this.chat.state().councils))
      if (c.status !== "concluded") this.run(c.id);
  }

  /** Councils this host is driving right now. */
  active(): string[] {
    return [...this.running].sort();
  }

  close(): void {
    this.closed = true;
    for (const id of [...this.wakers.keys()]) this.wake(id);
  }

  /** The council with what its session says of the vote and the work; throws when unknown. */
  view(councilId: string): CouncilView {
    const c = this.chat.council(councilId);
    const vote = this.voteOf(c);
    const ph = this.projectOf(c);
    let plan: CouncilView["plan"] = null;
    if (c.synthesis && ph) {
      const sh = this.openIfStored(ph, this.councilSessionId(c));
      const p = sh?.session.state().plans[c.synthesis.planId];
      if (sh && p)
        plan = {
          projectId: ph.projectId,
          sessionId: sh.sessionId,
          planId: p.id,
          status: p.status,
          ratings: p.ratings,
          decidedBy: p.decidedBy,
        };
    }
    const sessions: CouncilView["sessions"] = {};
    for (const a of Object.values(c.assignments)) {
      const live = ph?.hosts.get(a.sessionId)?.session.state().status ?? null;
      sessions[a.owner.profileId] = {
        projectId: a.projectId,
        sessionId: a.sessionId,
        status: live,
      };
    }
    return { council: c, label: councilLabel(c), vote, next: councilNext(c, vote), plan, sessions };
  }

  // ---- the loop ------------------------------------------------------------------------

  private run(councilId: string): void {
    if (this.running.has(councilId) || this.closed) return;
    this.running.add(councilId);
    // After the current synchronous work (a convene inside a websocket handler, a constructor).
    void Promise.resolve().then(() => this.loop(councilId));
  }

  private async loop(id: string): Promise<void> {
    const log = this.opts.log ?? (() => {});
    try {
      while (!this.closed) {
        const c = this.chat.council(id);
        const next = councilNext(c, this.voteOf(c));
        switch (next.kind) {
          case "concluded":
            return;
          case "stop": {
            const why =
              next.reason === "budget"
                ? `budget spent: ${usageTotal(c.usage)} of ${c.budget ?? 0} tokens`
                : "the plan was rejected";
            this.chat.conclude(id, next.outcome, why);
            return;
          }
          case "start-round":
            this.chat.startRound(id, { round: next.round, index: next.index });
            break;
          case "await-answers": {
            const answered = await this.answer(c, { round: next.round, index: next.index });
            if (this.closed || this.chat.council(id).status === "concluded") return;
            if (!answered) {
              this.chat.conclude(id, "abandoned", `no answers in the ${next.round} round`);
              return;
            }
            break;
          }
          case "synthesise":
            await this.synthesise(c, next.index);
            break;
          case "await-vote":
            await this.sleep(id);
            break;
          case "revise":
            this.chat.startRound(id, { round: "synthesis", index: next.index });
            break;
          case "assign":
            this.assign(c, next.steps);
            break;
          case "await-reports": {
            this.watchAssigned(c);
            if (!this.relayReports(id)) await this.sleep(id);
            break;
          }
          case "conclude":
            this.chat.conclude(id, "done", this.summaryOf(c));
            return;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`council ${id}: ${message}`);
      try {
        if (!this.closed && this.chat.council(id).status !== "concluded")
          this.chat.conclude(id, "abandoned", `the host stopped: ${message}`);
      } catch {
        // the log is closed or the council is gone; nothing more to record
      }
    } finally {
      this.running.delete(id);
      this.wakers.delete(id);
      this.dirty.delete(id);
      this.carried.delete(id);
    }
  }

  private sleep(id: string): Promise<void> {
    if (this.closed || this.dirty.delete(id)) return Promise.resolve();
    return new Promise((resolve) => this.wakers.set(id, resolve));
  }

  private wake(id: string): void {
    const w = this.wakers.get(id);
    if (w) {
      this.wakers.delete(id);
      w();
    } else if (this.running.has(id)) this.dirty.add(id);
  }

  // ---- rounds --------------------------------------------------------------------------

  /** Every owed member answers in parallel; a model that fails answers "No answer". Returns false when nobody did. */
  private async answer(c: Council, ref: CouncilRoundRef): Promise<boolean> {
    const context = this.context(c);
    const owed = owedIn(c, ref);
    const results = await Promise.all(
      owed.map(async (member) => {
        const profile = this.opts.profile(member.profileId);
        const pending = this.instructionsFor(c, member);
        const ctx = councilContext(member, c, ref, pending, profile?.persona ?? "");
        try {
          const req = councilPrompt(member, c, ref, pending, {
            persona: profile?.persona ?? "",
            context,
          });
          const res = await this.opts.modelFor(profile, member).complete(req);
          this.carryMissed(c.id, member, pending);
          const said = parseSaid(res, ctx);
          if (!said.text) throw new Error("the model said nothing");
          return { member, said: { ...said, usage: res.usage ?? ZERO_USAGE }, ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.opts.log?.(`council ${c.id}: ${member.name} did not answer: ${message}`);
          return {
            member,
            said: { text: `No answer: ${message}`, cites: citesFor(ctx), usage: ZERO_USAGE },
            ok: false,
          };
        }
      }),
    );
    if (this.closed || this.chat.council(c.id).status === "concluded") return true;
    if (!results.some((r) => r.ok)) return false;
    for (const r of results) {
      this.chat.said(c.id, ref, r.member, r.said);
      if (r.ok) this.opts.onUsage?.(r.member.userId ?? c.by, r.said.usage);
    }
    return true;
  }

  /** The chair writes the plan: its words go in the log, the plan into the council session. */
  private async synthesise(c: Council, index: number): Promise<void> {
    const ref: CouncilRoundRef = { round: "synthesis", index };
    const chair = c.chair;
    const profile = this.opts.profile(chair.profileId);
    const pending = this.instructionsFor(c, chair);
    const ctx = councilContext(chair, c, ref, pending, profile?.persona ?? "");
    const req = councilPrompt(chair, c, ref, pending, {
      persona: profile?.persona ?? "",
      context: this.context(c),
    });
    const res = await this.opts.modelFor(profile, chair).complete(req);
    if (this.closed || this.chat.council(c.id).status === "concluded") return;
    this.carryMissed(c.id, chair, pending);
    const parsed = parseSynthesis(res, c);
    const text =
      res.text.trim() ||
      parsed?.rationale ||
      (parsed ? `The chair proposes ${parsed.steps.length} steps.` : "The chair wrote no plan.");
    this.chat.said(c.id, ref, chair, {
      text,
      usage: res.usage ?? ZERO_USAGE,
      cites: citesFor(ctx),
    });
    this.opts.onUsage?.(chair.userId ?? c.by, res.usage ?? ZERO_USAGE);
    if (!parsed) {
      this.chat.conclude(c.id, "abandoned", "the chair wrote no plan");
      return;
    }
    // The budget may have gone on the chair's words; the loop concludes it before any plan.
    if (councilNext(this.chat.council(c.id)).kind === "stop") return;
    const ph = this.requireProject(c);
    const sh = ph.session(this.councilSessionId(c), {
      title: `Council: ${c.task.slice(0, 60)}`,
      ownerId: chair.userId ?? c.by,
      policy: { planFirst: true },
    });
    this.watch(c.id, sh);
    this.crew(ph, sh.sessionId, c);
    const actor = this.modelActor(chair);
    if (!sh.session.state().participants[actor.id])
      sh.session.join(MAIN_BRANCH, actor, "contributor");
    const ev = sh.session.proposePlan(MAIN_BRANCH, actor.id, {
      goal: c.task,
      steps: parsed.steps.map((s) => ({
        id: s.id,
        title: s.title,
        detail: s.detail,
        estTokens: s.estTokens,
        risk: s.risk,
      })),
      rationale: parsed.rationale,
    });
    if (ev.kind !== "plan.proposed") throw new KernelError("invalid", "the plan did not record");
    this.chat.synthesise(c.id, ev.payload.planId, parsed.steps, parsed.dissent);
  }

  /** Each step becomes a directive in its owner's member session, in the council's crew. */
  private assign(c: Council, steps: CouncilStep[]): void {
    const ph = this.requireProject(c);
    const all = c.synthesis?.steps ?? [];
    for (const step of steps) {
      const owner = step.owner;
      const ownerId = owner.userId ?? c.by;
      const sh = ph.session(this.memberSessionId(c, owner), {
        title: `${owner.name}: ${c.task.slice(0, 48)}`,
        ownerId,
        policy: { planFirst: false },
      });
      this.watch(c.id, sh);
      this.crew(ph, sh.sessionId, c);
      const n = all.findIndex((s) => s.id === step.id) + 1;
      const author: Actor = { id: ownerId, kind: "human", name: this.opts.personName(ownerId) };
      const joined = !sh.session.state().participants[ownerId];
      if (joined) sh.session.join(MAIN_BRANCH, author, "owner");
      sh.session.directive(MAIN_BRANCH, ownerId, {
        text: `${DIRECTIVE_PREFIX}${c.id} step ${n}: ${step.title}${step.detail ? `\n${step.detail}` : ""}`,
        mode: "steer",
        scope: GOAL_SCOPE,
      });
      if (joined) sh.session.leave(MAIN_BRANCH, ownerId);
      this.chat.assign(c.id, step.id, ph.projectId, sh.sessionId);
      void sh.drive();
    }
  }

  /**
   * Every turn that ended in a member session after a step's directive is the owner's report
   * on that step: DONE is done, a blocked, errored or cancelled turn is blocked, anything else
   * is still work in progress. Idempotent over the log, so a restart relays what it missed.
   * Returns true when a report was recorded.
   */
  private relayReports(id: string): boolean {
    const c = this.chat.council(id);
    const ph = this.projectOf(c);
    if (!c.synthesis || c.status === "concluded" || !ph) return false;
    let changed = false;
    for (const [n, step] of c.synthesis.steps.entries()) {
      if (c.reports[step.id]?.status === "done") continue;
      const a = c.assignments[step.id];
      const sh = a ? ph.hosts.get(a.sessionId) : undefined;
      if (!a || !sh) continue;
      const st = sh.session.state();
      const prefix = `${DIRECTIVE_PREFIX}${c.id} step ${n + 1}:`;
      const directive = Object.values(st.directives)
        .filter((d) => d.input.text.startsWith(prefix))
        .sort((x, y) => y.seq - x.seq)[0];
      if (!directive) continue;
      const turn = [...st.turns]
        .reverse()
        .find((t) => t.endedSeq !== null && t.startedSeq > directive.seq);
      if (!turn || turn.reason === null) continue;
      let status: CouncilReportStatus | null = null;
      if (turn.reason === "done" && /^DONE\b/.test(turn.summary)) status = "done";
      else if (turn.reason === "blocked" || turn.reason === "error" || turn.reason === "cancelled")
        status = "blocked";
      if (!status) continue;
      const text = reportText(turn.summary, turn.reason);
      const last = c.reports[step.id];
      if (last && last.status === status && last.text === text) continue;
      this.chat.report(id, step.id, status, text, turn.usage);
      changed = true;
    }
    return changed;
  }

  /** A member's uncited instructions: the chat's pending ones plus what landed while it last thought. */
  private instructionsFor(c: Council, member: CouncilMember): CouncilInstruction[] {
    const carried = this.carried.get(c.id)?.get(member.profileId) ?? [];
    const seen = new Set(carried.map((i) => i.seq));
    const out = [...carried];
    for (const i of pendingInstructions(c, member)) if (!seen.has(i.seq)) out.push(i);
    return out.sort((a, b) => a.seq - b.seq);
  }

  /** After a model answered: the instructions that arrived meanwhile are carried to its next round. */
  private carryMissed(councilId: string, member: CouncilMember, seen: CouncilInstruction[]): void {
    const live = this.chat.council(councilId);
    const known = new Set(seen.map((i) => i.seq));
    const missed = pendingInstructions(live, member).filter((i) => !known.has(i.seq));
    const byMember = this.carried.get(councilId) ?? new Map<string, CouncilInstruction[]>();
    if (missed.length) byMember.set(member.profileId, missed);
    else byMember.delete(member.profileId);
    this.carried.set(councilId, byMember);
  }

  private summaryOf(c: Council): string {
    const steps = c.synthesis?.steps ?? [];
    const done = steps.filter((s) => c.reports[s.id]?.status === "done").length;
    const lines = [`${done} of ${steps.length} steps done`];
    for (const s of steps) {
      const r = c.reports[s.id];
      if (r?.text) lines.push(`- ${s.title} (${s.owner.name}): ${r.text}`);
    }
    for (const d of c.synthesis?.dissent ?? []) lines.push(`dissent, ${d.member.name}: ${d.text}`);
    return lines.join("\n");
  }

  // ---- events --------------------------------------------------------------------------

  private onChatEvent(e: ChatEvent): void {
    if (this.closed) return;
    switch (e.kind) {
      case "council.convened":
        this.run(e.payload.councilId);
        break;
      case "council.instructed":
        this.relayInstruction(e.payload.councilId, e.payload.member, e.actor, e.payload.text);
        this.wake(e.payload.councilId);
        break;
      case "council.round.started":
      case "council.said":
      case "council.synthesised":
      case "council.assigned":
      case "council.reported":
      case "council.concluded":
        this.wake(e.payload.councilId);
        break;
      default:
        break;
    }
  }

  /** A private instruction lands as a steer in the member's session too, once it has one. */
  private relayInstruction(councilId: string, member: CouncilMember, by: string, text: string) {
    try {
      const c = this.chat.council(councilId);
      const a = Object.values(c.assignments).find((x) => sameCouncilMember(x.owner, member));
      const ph = this.projectOf(c);
      if (!a || !ph) return;
      const sh = ph.hosts.get(a.sessionId);
      if (!sh) return;
      const name = this.opts.personName(by);
      const joined = !sh.session.state().participants[by];
      if (joined) sh.session.join(MAIN_BRANCH, { id: by, kind: "human", name }, "contributor");
      sh.session.directive(MAIN_BRANCH, by, {
        text: `${name} instructs ${member.name} in the council: ${text}`,
        mode: "steer",
        scope: "council",
      });
      if (joined) sh.session.leave(MAIN_BRANCH, by);
      void sh.drive();
    } catch (err) {
      this.opts.log?.(
        `council ${councilId}: instruction not relayed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** A plan event in the council session or a turn ending in a member session wakes the loop. */
  private watch(councilId: string, sh: SessionHost): void {
    if (this.watched.has(sh.sessionId)) return;
    this.watched.add(sh.sessionId);
    sh.session.onEvent((e) => {
      if (this.closed || e.branch !== MAIN_BRANCH) return;
      if (e.kind.startsWith("plan.") || e.kind === "agent.turn.ended") this.wake(councilId);
    });
  }

  private watchAssigned(c: Council): void {
    const ph = this.projectOf(c);
    if (!ph) return;
    for (const a of Object.values(c.assignments)) {
      const sh = ph.hosts.get(a.sessionId) ?? this.openIfStored(ph, a.sessionId);
      if (sh) this.watch(c.id, sh);
    }
  }

  // ---- sessions ------------------------------------------------------------------------

  /** What the people said of the plan, as the chair's session knows it. */
  private voteOf(c: Council): CouncilVote {
    if (!c.synthesis) return "pending";
    const ph = this.projectOf(c);
    const sh = ph ? this.openIfStored(ph, this.councilSessionId(c)) : null;
    if (!sh) return "pending";
    this.watch(c.id, sh);
    const plan = sh.session.state().plans[c.synthesis.planId];
    switch (plan?.status) {
      case "approved":
      case "done":
        return "approved";
      case "revise":
        return "revise";
      case "rejected":
        return "rejected";
      default:
        return "pending";
    }
  }

  private councilSessionId(c: Council): string {
    return shortId("council", c.id);
  }

  private memberSessionId(c: Council, owner: CouncilMember): string {
    return shortId("member", c.id, owner.profileId);
  }

  private modelActor(m: CouncilMember): Actor {
    return { id: `model:${m.profileId}`, kind: "agent", name: m.name };
  }

  private crewName(c: Council): string {
    return `Council: ${c.task.slice(0, 48)}`;
  }

  private crew(ph: ProjectHost, sessionId: string, c: Council): void {
    const ss = ph.state().sessions[sessionId];
    const name = this.crewName(c);
    if (!ss || ss.crew === name) return;
    ph.project.crew(ss.ownerId, sessionId, name);
  }

  /** The host of a session that exists in the store (or is live), without creating one. */
  private openIfStored(ph: ProjectHost, sessionId: string): SessionHost | null {
    const live = ph.hosts.get(sessionId);
    if (live) return live;
    try {
      return ph.session(sessionId);
    } catch (err) {
      if (err instanceof KernelError && err.code === "not_found") return null;
      throw err;
    }
  }

  private projectOf(c: Council): ProjectHost | null {
    const g = this.chat.state().groups[c.groupId];
    return g ? this.opts.projectFor(g) : null;
  }

  private requireProject(c: Council): ProjectHost {
    const ph = this.projectOf(c);
    if (!ph) throw new KernelError("not_found", "no project for the council's sessions");
    return ph;
  }

  /** The group's latest messages, oldest first, as the models read them. */
  private context(c: Council): string[] {
    const st: ChatState = this.chat.state();
    const g = st.groups[c.groupId];
    const n = this.opts.contextMessages ?? 6;
    const names = new Map<string, string>();
    for (const m of g?.members ?? []) {
      if (m.kind === "human") names.set(`human:${m.userId}`, memberName(m));
      else names.set(`agent:${m.sessionId}`, memberName(m));
    }
    return (st.messages[c.groupId] ?? []).slice(-n).map((m) => {
      const who =
        m.author.kind === "human"
          ? (names.get(`human:${m.author.userId}`) ?? this.opts.personName(m.author.userId))
          : (names.get(`agent:${m.author.sessionId}`) ?? m.author.sessionId);
      return `${who}: ${m.text}`;
    });
  }
}
