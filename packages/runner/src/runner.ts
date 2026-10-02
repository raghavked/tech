/**
 * The runner drives one agent on one branch. It reads the composed intent at each turn
 * boundary, yields between tool calls so humans can pause, cancel, redirect or withhold
 * approval, and records everything in the log. If the process dies mid-turn, a new runner
 * resumes from the log: the transcript of the current turn is the state.
 */
import { renderIntent, type Session, type SessionState } from "@atelier/kernel";
import type { Actor, ToolCall, ToolResult } from "@atelier/protocol";
import type { Model, ModelRequest, TranscriptEntry } from "./model.js";
import type { ToolRegistry, WorkspaceGuard } from "./tools.js";

export interface RunnerOptions {
  maxStepsPerTurn?: number;
  /** How long to wait for an approval before ending the turn as blocked. Default: forever. */
  approvalTimeoutMs?: number;
  /** Called after each tool execution; useful for tests and the server to interleave actions. */
  onStep?: (state: SessionState) => void | Promise<void>;
  log?: (line: string) => void;
  /** Fleet hook: claims, blocked writes and status reports to the project. */
  guard?: WorkspaceGuard | undefined;
}

export type TurnOutcome =
  | "done"
  | "interrupted"
  | "paused"
  | "cancelled"
  | "blocked"
  | "error"
  | "idle";

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
    const continuing = last
      ? last.reason === "interrupted" ||
        (last.reason === "done" && !last.summary.startsWith("DONE"))
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
      // Resume: finish tool calls the model already decided on but the dead runner never ran.
      const open = s.currentTurn;
      if (open) {
        const done = new Set(open.toolResults.map((r) => r.callId));
        const pending = open.toolCalls.filter((c) => !done.has(c.id));
        if (pending.length) {
          log(`resuming turn ${turn}: ${pending.length} pending tool calls`);
          const yielded = await this.executeCalls(pending);
          if (yielded) return this.end(yielded, `yielded while resuming: ${yielded}`);
        }
      }
      for (let step = 0; step < this.maxSteps; step++) {
        const yielded = this.checkYield();
        if (yielded) return this.end(yielded, `yielded: ${yielded}`);

        const req = this.buildRequest();
        const res = await this.model.complete(req);
        session.modelCompleted(branch, agent.id, res.text, res.toolCalls, this.model.name);
        if (res.toolCalls.length === 0) {
          return this.end("done", res.done ? `DONE ${res.text}` : res.text || "(no output)");
        }
        const yieldedMid = await this.executeCalls(res.toolCalls);
        if (yieldedMid) return this.end(yieldedMid, `${yieldedMid} mid-turn`);
        lastText = res.text;
      }
      return this.end("done", `continuing: ${lastText}`);
    } catch (err) {
      return this.end("error", err instanceof Error ? err.message : String(err));
    }
  }

  /** Execute calls in order, yielding at safe points. Returns the yield reason, if any. */
  private async executeCalls(
    calls: ToolCall[],
  ): Promise<Exclude<TurnOutcome, "done" | "error" | "idle"> | null> {
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
            output: `not executed: session ${yielded}`,
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
  private checkYield(): Exclude<TurnOutcome, "done" | "error" | "idle"> | null {
    const s = this.state();
    if (s.intent.control === "cancelled") return "cancelled";
    if (s.intent.control === "paused") return "paused";
    if (s.intent.interrupt) return "interrupted";
    if (s.intent.contendedScopes.includes("goal") || s.openConflicts.length > 0) return "blocked";
    return null;
  }

  private async execute(call: ToolCall): Promise<ToolResult> {
    const { session, branch, agent } = this;
    const tool = this.tools.get(call.name);
    if (!tool) return { callId: call.id, ok: false, output: `unknown tool ${call.name}` };
    session.toolRequested(branch, agent.id, call);
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
    const fleet = this.opts.guard?.context() ?? "";
    return {
      title: s.title,
      intent: s.intent,
      intentText: fleet ? `${renderIntent(s.intent)}\n${fleet}` : renderIntent(s.intent),
      history: s.turns.map((x) => `turn ${x.turn}: ${x.summary}`),
      files: Object.keys(s.workspace).sort(),
      transcript,
      tools: this.tools.specs(),
      turn: s.turn,
      newDirectives,
    };
  }
}
