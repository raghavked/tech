/**
 * The runner drives one agent on one branch. It reads the composed intent at each turn
 * boundary, yields between tool calls so humans can pause, cancel, redirect or withhold
 * approval, and records everything in the log. If the process dies mid-turn, a new runner
 * resumes from the log: the transcript of the current turn is the state.
 *
 * Plan first: when the policy asks for a plan, the runner tells the model to propose one,
 * ends the turn once it is proposed, and starts again when the team's ratings (or an owner)
 * approve it. While the plan is approved, steps are started and completed as the model moves
 * through them, and every call above `read` is refused until then.
 */
import {
  activePlan,
  gateForCall,
  planForGoal,
  planNeeded,
  planWaiting,
  renderIntent,
  type Session,
  type SessionState,
  totalTokens,
} from "@henosis/kernel";
import type { Actor, ToolCall, ToolResult } from "@henosis/protocol";
import type { Model, ModelRequest, PlanView, TranscriptEntry } from "./model.js";
import type { MemoryAccess, ToolRegistry, WorkspaceGuard } from "./tools.js";

export interface RunnerOptions {
  maxStepsPerTurn?: number;
  /** How long to wait for an approval before ending the turn as blocked. Default: forever. */
  approvalTimeoutMs?: number;
  /** Called after each tool execution; useful for tests and the server to interleave actions. */
  onStep?: (state: SessionState) => void | Promise<void>;
  log?: (line: string) => void;
  /** Fleet hook: claims, blocked writes and status reports to the project. */
  guard?: WorkspaceGuard | undefined;
  /** Organisation memory hook: attributed writes and scoped context. */
  memory?: MemoryAccess | undefined;
}

export type TurnOutcome =
  | "done"
  | "interrupted"
  | "paused"
  | "cancelled"
  | "blocked"
  | "error"
  | "idle";

type YieldReason = Exclude<TurnOutcome, "done" | "error" | "idle">;
interface YieldPoint {
  reason: YieldReason;
  summary: string;
}

/** The turn summary while a proposed plan waits for the team. */
export const PLAN_WAITING_SUMMARY = "plan proposed: waiting for ratings";

const PLAN_TOOLS = new Set(["plan.propose", "plan.step"]);

export class Runner {
  private driving = false;
  private pending = false;
  private stopped = false;
  private readonly maxSteps: number;

  constructor(
    readonly session: Session,
    readonly branch: string,
    readonly agent: Actor,
    readonly model: Model,
    readonly tools: ToolRegistry,
    readonly opts: RunnerOptions = {},
  ) {
    this.maxSteps = opts.maxStepsPerTurn ?? 8;
    if (!session.state(branch).participants[agent.id]) session.join(branch, agent, "contributor");
  }

  private state(): SessionState {
    return this.session.state(this.branch);
  }

  /** Is there a reason to start a turn right now? */
  shouldTurn(s: SessionState = this.state()): boolean {
    if (s.status !== "idle") return false;
    if (!s.intent.goal) return false;
    if (s.turn >= s.policy.maxTurns) return false;
    const fresh = Object.values(s.directives).some(
      (d) =>
        d.epoch === s.epoch &&
        (d.status === "active" || d.status === "contended") &&
        d.input.mode !== "pause",
    );
    const last = s.turns[s.turns.length - 1];
    const finished = last?.reason === "done" && last.summary.startsWith("DONE");
    if (s.policy.planFirst) {
      const plan = planForGoal(s);
      // The team is rating: nothing to do until they decide.
      if (plan?.status === "proposed") return false;
      // Asked to revise: propose again. Approved: carry on with the steps.
      if (plan?.status === "revise") return true;
      if (plan?.status === "approved" && !finished) return true;
    }
    const continuing = last
      ? last.reason === "interrupted" || (last.reason === "done" && !finished)
      : true;
    return fresh || continuing;
  }

  stop(): void {
    this.stopped = true;
  }

  /** Run turns until there is nothing to do. Safe to call concurrently; extra calls coalesce. */
  async drive(): Promise<void> {
    if (this.driving) {
      this.pending = true;
      return;
    }
    this.driving = true;
    try {
      do {
        this.pending = false;
        // A turn left open by a crashed runner is resumed first.
        if (!this.stopped && this.state().currentTurn) await this.runTurn();
        while (!this.stopped && this.shouldTurn()) {
          await this.runTurn();
        }
      } while (this.pending && !this.stopped);
    } finally {
      this.driving = false;
    }
  }

  /** Execute one turn, or resume the turn in progress after a crash. */
  async runTurn(): Promise<TurnOutcome> {
    const { session, branch, agent } = this;
    let s = this.state();
    if (!s.currentTurn) {
      session.turnStarted(branch, agent.id);
      s = this.state();
    }
    const turn = s.turn;
    const log = this.opts.log ?? (() => {});
    log(`turn ${turn} started on ${branch}`);
    let lastText = "";
    try {
      // An approved plan always has a step running while the agent works.
      this.autoStartStep();
      // Resume: finish tool calls the model already decided on but the dead runner never ran.
      const open = s.currentTurn;
      if (open) {
        const done = new Set(open.toolResults.map((r) => r.callId));
        const pending = open.toolCalls.filter((c) => !done.has(c.id));
        if (pending.length) {
          log(`resuming turn ${turn}: ${pending.length} pending tool calls`);
          const yielded = await this.executeCalls(pending);
          if (yielded)
            return this.end(yielded.reason, `yielded while resuming: ${yielded.summary}`);
        }
      }
      for (let step = 0; step < this.maxSteps; step++) {
        const yielded = this.checkYield();
        if (yielded) return this.end(yielded.reason, yielded.summary);

        const req = this.buildRequest();
        const res = await this.model.complete(req);
        session.modelCompleted(
          branch,
          agent.id,
          res.text,
          res.toolCalls,
          this.model.name,
          res.usage,
        );
        if (res.toolCalls.length === 0) {
          // The goal is complete: the step the agent was on completes with it.
          if (res.done) this.completeRunningStep();
          return this.end("done", res.done ? `DONE ${res.text}` : res.text || "(no output)");
        }
        const yieldedMid = await this.executeCalls(res.toolCalls);
        if (yieldedMid) return this.end(yieldedMid.reason, yieldedMid.summary);
        lastText = res.text;
      }
      return this.end("done", `continuing: ${lastText}`);
    } catch (err) {
      return this.end("error", err instanceof Error ? err.message : String(err));
    }
  }

  /** Execute calls in order, yielding at safe points. Returns the yield point, if any. */
  private async executeCalls(calls: ToolCall[]): Promise<YieldPoint | null> {
    const { session, branch, agent } = this;
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i] as ToolCall;
      const yielded = this.checkYield();
      if (yielded) {
        // Unexecuted calls get an explicit result so the transcript stays well formed and a
        // resumed runner does not re-run them.
        for (const c of calls.slice(i)) {
          session.toolCompleted(branch, agent.id, {
            callId: c.id,
            ok: false,
            output: `not executed: session ${yielded.reason}`,
          });
        }
        return yielded;
      }
      const result = await this.execute(call);
      session.toolCompleted(branch, agent.id, result);
      await this.opts.onStep?.(this.state());
    }
    return null;
  }

  private end(reason: TurnOutcome, summary: string): TurnOutcome {
    if (reason === "idle") return reason;
    this.session.turnEnded(this.branch, this.agent.id, reason, summary);
    this.opts.log?.(`turn ended: ${reason} (${summary})`);
    this.opts.guard?.reportStatus();
    return reason;
  }

  /** Why the runner must stop at this safe point, if anything. */
  private checkYield(): YieldPoint | null {
    const s = this.state();
    const at = (reason: YieldReason): YieldPoint => ({ reason, summary: `yielded: ${reason}` });
    if (s.intent.control === "cancelled") return at("cancelled");
    if (s.intent.control === "paused") return at("paused");
    if (s.intent.interrupt) return at("interrupted");
    if (s.intent.contendedScopes.includes("goal") || s.openConflicts.length > 0)
      return at("blocked");
    if (planWaiting(s)) return { reason: "blocked", summary: PLAN_WAITING_SUMMARY };
    return null;
  }

  /** Plan first: when the plan is approved and no step is running, the first pending step starts. */
  private autoStartStep(): void {
    const s = this.state();
    if (!s.policy.planFirst) return;
    const plan = planForGoal(s);
    if (plan?.status !== "approved") return;
    if (plan.steps.some((st) => st.status === "running")) return;
    const next = plan.steps.find((st) => st.status === "pending");
    if (next) this.session.startStep(this.branch, this.agent.id, plan.id, next.id);
  }

  private completeRunningStep(): void {
    const plan = activePlan(this.state());
    const running = plan?.steps.find((st) => st.status === "running");
    if (plan && running) this.session.completeStep(this.branch, this.agent.id, plan.id, running.id);
  }

  private async execute(call: ToolCall): Promise<ToolResult> {
    const { session, branch, agent } = this;
    const tool = this.tools.get(call.name);
    if (!tool) return { callId: call.id, ok: false, output: `unknown tool ${call.name}` };
    session.toolRequested(branch, agent.id, call);
    // Plan first: nothing above a read runs until the plan is approved.
    const gate = gateForCall(this.state(), call);
    if (!gate.ok) return { callId: call.id, ok: false, output: gate.reason };
    const approvalId = session.requestApproval(branch, agent.id, call);
    if (approvalId) {
      const verdict = await this.awaitApproval(approvalId);
      if (verdict !== "granted") {
        return { callId: call.id, ok: false, output: `${call.name} ${verdict} by the team` };
      }
    }
    try {
      const output = await tool.run(call.args, {
        session,
        branch,
        agentId: agent.id,
        guard: this.opts.guard,
        memory: this.opts.memory,
      });
      return { callId: call.id, ok: true, output };
    } catch (err) {
      return {
        callId: call.id,
        ok: false,
        output: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private awaitApproval(approvalId: string): Promise<"granted" | "denied" | "timeout"> {
    const current = this.state().approvals[approvalId];
    if (current && current.status !== "pending") return Promise.resolve(current.status);
    return new Promise((resolve) => {
      let timer: NodeJS.Timeout | undefined;
      const off = this.session.onEvent((_e, st) => {
        if (st.branch !== this.branch) return;
        const a = st.approvals[approvalId];
        if (a && a.status !== "pending") {
          off();
          if (timer) clearTimeout(timer);
          resolve(a.status);
        }
      });
      if (this.opts.approvalTimeoutMs) {
        timer = setTimeout(() => {
          off();
          resolve("timeout");
        }, this.opts.approvalTimeoutMs);
      }
    });
  }

  /** Plan first, rendered for the model beneath the intent. */
  private planText(s: SessionState, plan: PlanView | null, needsPlan: boolean): string {
    if (!s.policy.planFirst) return "";
    const lines: string[] = [];
    const spent = totalTokens(s.usage);
    if (s.policy.tokenBudget)
      lines.push(`TOKEN BUDGET: ${spent} of ${s.policy.tokenBudget} tokens used so far.`);
    if (needsPlan) {
      const previous = planForGoal(s);
      lines.push(
        "PLAN FIRST: before any write, exec, external or irreversible tool, call plan.propose with two to six steps {title, detail, estTokens, risk}. The team rates the plan; work starts once it is approved.",
      );
      if (previous?.status === "revise")
        lines.push(`The team asked for a revision${previous.note ? `: ${previous.note}` : "."}`);
      if (previous?.status === "rejected")
        lines.push(`The team rejected the last plan${previous.note ? `: ${previous.note}` : "."}`);
    } else if (plan?.status === "approved") {
      lines.push(
        "PLAN (approved; follow it, call plan.step {stepId} as you move to the next step):",
      );
      for (const st of plan.steps) lines.push(`  ${st.id} [${st.status}] ${st.title}`);
    } else if (plan?.status === "proposed") {
      lines.push(
        "PLAN: proposed and waiting for the team's ratings; do not act until it is approved.",
      );
    }
    return lines.join("\n");
  }

  private buildRequest(): ModelRequest {
    const s = this.state();
    const transcript: TranscriptEntry[] = [];
    const t = s.currentTurn;
    if (t) {
      // Rebuild the in-turn transcript from the log: model calls interleaved with results.
      const byCall = new Map(t.toolResults.map((r) => [r.callId, r]));
      let i = 0;
      const texts = t.modelText; // last text only; tool calls carry the structure
      const calls = t.toolCalls;
      // Group calls by the id prefix the model used (one assistant entry per model call).
      while (i < calls.length) {
        const group: ToolCall[] = [calls[i] as ToolCall];
        i++;
        transcript.push({ role: "assistant", text: texts, toolCalls: group });
        const results = group
          .map((c) => byCall.get(c.id))
          .filter((r): r is ToolResult => Boolean(r));
        if (results.length) transcript.push({ role: "tool", results });
      }
    }
    const newDirectives = Object.values(s.directives)
      .filter((d) => d.epoch === s.epoch - 1 || d.epoch === s.epoch)
      .filter((d) => d.status === "active")
      .map(
        (d) =>
          `${s.participants[d.author]?.actor.name ?? d.author} [${d.input.mode}/${d.input.scope}]: ${d.input.text}`,
      );
    const record = planForGoal(s);
    const plan: PlanView | null = record
      ? {
          id: record.id,
          goal: record.goal,
          status: record.status,
          steps: record.steps.map((st) => ({ id: st.id, title: st.title, status: st.status })),
        }
      : null;
    const needsPlan = planNeeded(s);
    const extras = [
      this.planText(s, plan, needsPlan),
      this.opts.guard?.context() ?? "",
      this.opts.memory?.context() ?? "",
    ].filter(Boolean);
    return {
      title: s.title,
      intent: s.intent,
      intentText: [renderIntent(s.intent), ...extras].join("\n"),
      planFirst: s.policy.planFirst,
      plan,
      needsPlan,
      history: s.turns.map((x) => `turn ${x.turn}: ${x.summary}`),
      files: Object.keys(s.workspace).sort(),
      transcript,
      tools: this.tools.specs().filter((spec) => s.policy.planFirst || !PLAN_TOOLS.has(spec.name)),
      turn: s.turn,
      newDirectives,
    };
  }
}
