import {
  activePlan,
  checkReplay,
  PLAN_NOT_APPROVED,
  replayBranch,
  Session,
  stateHash,
} from "@henosis/kernel";
import {
  type Actor,
  DEFAULT_APPROVAL_POLICY,
  DEFAULT_SESSION_POLICY,
  MAIN_BRANCH,
  type SessionPolicy,
} from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import type { Model, ModelRequest, ModelResponse } from "../src/model.js";
import { PLAN_WAITING_SUMMARY, Runner } from "../src/runner.js";
import { ScriptedModel } from "../src/scripted.js";
import { defaultTools } from "../src/tools.js";

const policy: SessionPolicy = {
  ...DEFAULT_SESSION_POLICY,
  approvals: DEFAULT_APPROVAL_POLICY,
  contention: "block",
  maxTurns: 40,
};
const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const bo: Actor = { id: "bo", kind: "human", name: "Bo" };
const cy: Actor = { id: "cy", kind: "human", name: "Cy" };
const bot: Actor = { id: "agent", kind: "agent", name: "Agent" };
const M = MAIN_BRANCH;

function setup(p: SessionPolicy = policy) {
  const s = Session.create("s", "Demo", p);
  s.join(M, ana, "owner");
  s.join(M, bo, "contributor");
  s.join(M, cy, "contributor");
  return s;
}

const planFirst: SessionPolicy = {
  ...policy,
  planFirst: true,
  planApproval: { min: 1, average: 4 },
  tokenBudget: 20_000,
};

/** Auto-vote on approvals as they appear, like attentive teammates. */
function autoApprove(s: Session, voters: string[], vote: "approve" | "deny" = "approve") {
  return s.onEvent((e) => {
    if (e.kind !== "approval.requested") return;
    queueMicrotask(() => {
      for (const v of voters) {
        try {
          s.vote(M, v, e.payload.approvalId, vote, 5);
        } catch {
          /* already decided */
        }
      }
    });
  });
}

describe("runner with the scripted model", () => {
  it("completes a goal end to end, gating exec and irreversible calls", async () => {
    const s = setup();
    s.setRole(M, "ana", "cy", "driver");
    autoApprove(s, ["bo", "ana", "cy"]);
    s.directive(M, "ana", { text: "Build a doubling helper and deploy it" });
    s.directive(M, "bo", { text: "No external dependencies", mode: "constrain" });
    const r = new Runner(s, M, bot, new ScriptedModel(), defaultTools());
    await r.drive();
    const st = s.state();
    expect(st.status).toBe("idle");
    expect(Object.keys(st.workspace).sort()).toEqual([
      ".deployments/production.log",
      "PLAN.md",
      "src/build_a_doubling_helper_.mjs",
      "test/build_a_doubling_helper_.test.mjs",
    ]);
    expect(s.readFile(M, "PLAN.md")).toContain("No external dependencies");
    const approvals = Object.values(st.approvals);
    expect(approvals.map((a) => a.call.risk).sort()).toEqual(["exec", "irreversible"]);
    expect(approvals.every((a) => a.status === "granted")).toBe(true);
    const shell = st.turns.flatMap((t) => t.toolResults).find((x) => x.output.startsWith("exit"));
    expect(shell?.ok).toBe(true);
    expect(shell?.output).toMatch(/^exit 0/);
    expect(st.turns[st.turns.length - 1]?.summary).toMatch(/^DONE/);
    expect(checkReplay(s.log, M).ok).toBe(true);
    expect(stateHash(replayBranch(s.log, M))).toBe(stateHash(st));
  });

  it("stops when a deploy is denied and does not retry", async () => {
    const s = setup();
    s.setRole(M, "ana", "bo", "driver");
    s.onEvent((e) => {
      if (e.kind !== "approval.requested") return;
      const vote = e.payload.call.risk === "irreversible" ? "deny" : "approve";
      queueMicrotask(() => {
        s.vote(M, "bo", e.payload.approvalId, vote, 5);
        if (vote === "approve") return;
      });
    });
    s.directive(M, "ana", { text: "Ship and deploy the widget" });
    const r = new Runner(s, M, bot, new ScriptedModel(), defaultTools());
    await r.drive();
    const st = s.state();
    expect(st.workspace[".deployments/production.log"]).toBeUndefined();
    const denied = Object.values(st.approvals).find((a) => a.call.name === "deploy");
    expect(denied?.status).toBe("denied");
    expect(st.turns[st.turns.length - 1]?.summary).toContain("denied");
  });

  it("pauses at a safe point and resumes when the driver says so", async () => {
    const s = setup();
    autoApprove(s, ["bo"]);
    s.directive(M, "ana", { text: "Make a thing" });
    let paused = false;
    const r = new Runner(s, M, bot, new ScriptedModel(), defaultTools(), {
      onStep: () => {
        if (!paused) {
          paused = true;
          s.directive(M, "bo", { text: "hold on", mode: "pause" });
        }
      },
    });
    await r.drive();
    expect(s.state().status).toBe("paused");
    expect(s.state().turns.some((t) => t.reason === "paused")).toBe(true);
    const before = Object.keys(s.state().workspace).length;
    s.directive(M, "ana", { text: "carry on", mode: "resume" });
    await r.drive();
    expect(s.state().status).toBe("idle");
    expect(Object.keys(s.state().workspace).length).toBeGreaterThan(before);
  });

  it("an interrupting redirect abandons the turn and re-plans", async () => {
    const s = setup();
    autoApprove(s, ["bo"]);
    s.directive(M, "ana", { text: "Build an exporter" });
    let fired = false;
    const r = new Runner(s, M, bot, new ScriptedModel(), defaultTools(), {
      onStep: () => {
        if (!fired) {
          fired = true;
          s.directive(M, "ana", { text: "Write it in Python", scope: "language", interrupt: true });
        }
      },
    });
    await r.drive();
    const st = s.state();
    expect(st.turns.some((t) => t.reason === "interrupted")).toBe(true);
    expect(st.workspace["src/build_an_exporter.py"]).toBeDefined();
    expect(st.status).toBe("idle");
  });

  it("resumes a half-finished turn from the log after a crash", async () => {
    const s = setup();
    autoApprove(s, ["bo"]);
    s.directive(M, "ana", { text: "Build a parser" });
    let crashed = false;
    const first = new Runner(s, M, bot, new ScriptedModel(), defaultTools(), {
      onStep: () => {
        if (!crashed) {
          crashed = true;
          throw new Error("simulated process death");
        }
      },
    });
    await expect(first.runTurn()).resolves.toBe("error");
    // A real crash would not have written turn.ended; drop it to simulate.
    const serialized = s.log.serialize();
    const own = serialized.events[M] ?? [];
    const last = own[own.length - 1];
    if (last?.kind === "agent.turn.ended") own.pop();
    const resumed = Session.fromSerialized(serialized, s.store);
    expect(resumed.state().currentTurn).not.toBeNull();
    const second = new Runner(resumed, M, bot, new ScriptedModel(), defaultTools());
    autoApprove(resumed, ["bo"]);
    await second.drive();
    const st = resumed.state();
    expect(st.status).toBe("idle");
    expect(st.workspace["src/build_a_parser.mjs"]).toBeDefined();
    expect(st.workspace["test/build_a_parser.test.mjs"]).toBeDefined();
    expect(resumed.log.verify()).toEqual({ ok: true });
  });

  it("records the model's token usage on the turn and the session", async () => {
    const s = setup();
    autoApprove(s, ["bo"]);
    s.directive(M, "ana", { text: "Build a counter" });
    await new Runner(s, M, bot, new ScriptedModel(), defaultTools()).drive();
    const st = s.state();
    expect(st.usage.input).toBeGreaterThan(0);
    expect(st.usage.output).toBeGreaterThan(0);
    expect(st.turns.every((t) => t.usage.input > 0)).toBe(true);
    const sum = st.turns.reduce((n, t) => n + t.usage.input + t.usage.output, 0);
    expect(sum).toBe(st.usage.input + st.usage.output);
  });
});

describe("plan first", () => {
  it("proposes a plan, waits for ratings, then works through the steps", async () => {
    const s = setup(planFirst);
    s.setRole(M, "ana", "cy", "driver");
    autoApprove(s, ["bo", "ana", "cy"]);
    s.directive(M, "ana", { text: "Build a doubling helper and deploy it" });
    const r = new Runner(s, M, bot, new ScriptedModel(), defaultTools());
    await r.drive();
    let st = s.state();
    // One turn: the proposal, then the runner yields for the team.
    expect(st.turns).toHaveLength(1);
    expect(st.turns[0]?.reason).toBe("blocked");
    expect(st.turns[0]?.summary).toBe(PLAN_WAITING_SUMMARY);
    const plan = activePlan(st);
    expect(plan?.status).toBe("proposed");
    expect(plan?.steps.map((x) => x.id)).toEqual(["s1", "s2", "s3"]);
    expect(plan?.estTokens).toBe(1800);
    expect(Object.keys(st.workspace)).toEqual([]);
    expect(r.shouldTurn()).toBe(false);
    // Nothing happens until someone rates it.
    await r.drive();
    expect(s.state().turns).toHaveLength(1);

    // One rating at the bar approves it; the runner resumes and the steps are marked as it goes.
    s.ratePlan(M, "bo", plan?.id ?? "", 4, "fine");
    expect(activePlan(s.state())?.status).toBe("approved");
    expect(r.shouldTurn()).toBe(true);
    await r.drive();
    st = s.state();
    expect(st.status).toBe("idle");
    expect(st.workspace[".deployments/production.log"]).toBeDefined();
    expect(st.turns[st.turns.length - 1]?.summary).toMatch(/^DONE/);
    const done = activePlan(st);
    expect(done?.status).toBe("done");
    expect(done?.steps.map((x) => x.status)).toEqual(["done", "done", "done"]);
    expect(done?.steps.every((x) => x.actualTokens > 0)).toBe(true);
    // The model marked s2 and s3 itself; s1 was started by the runner at the first working turn.
    const started = s.events().filter((e) => e.kind === "plan.step.started");
    expect(started.map((e) => (e.kind === "plan.step.started" ? e.payload.stepId : ""))).toEqual([
      "s1",
      "s2",
      "s3",
    ]);
    expect(checkReplay(s.log, M).ok).toBe(true);
    expect(stateHash(replayBranch(s.log, M))).toBe(stateHash(st));
  });

  it("refuses every call above read until the plan is approved, as a result the model reads", async () => {
    const s = setup({ ...planFirst, maxTurns: 1 });
    s.directive(M, "ana", { text: "Build a thing" });
    const seen: ModelRequest[] = [];
    const eager: Model = {
      name: "eager",
      async complete(req): Promise<ModelResponse> {
        seen.push(req);
        const failed = req.transcript.some(
          (e) => e.role === "tool" && e.results.some((x) => !x.ok),
        );
        if (failed) return { text: "I will wait.", toolCalls: [], done: false };
        return {
          text: "Writing straight away.",
          toolCalls: [
            {
              id: "w1",
              name: "workspace.write",
              args: { path: "a.txt", content: "x" },
              risk: "write",
            },
            { id: "r1", name: "workspace.list", args: {}, risk: "read" },
          ],
          done: false,
        };
      },
    };
    await new Runner(s, M, bot, eager, defaultTools()).drive();
    const st = s.state();
    expect(Object.keys(st.workspace)).toEqual([]);
    const results = st.turns.flatMap((t) => t.toolResults);
    expect(results.find((x) => x.callId === "w1")).toEqual({
      callId: "w1",
      ok: false,
      output: PLAN_NOT_APPROVED,
    });
    expect(results.find((x) => x.callId === "r1")?.ok).toBe(true);
    expect(seen[0]?.needsPlan).toBe(true);
    expect(seen[0]?.intentText).toContain("PLAN FIRST");
    expect(seen[0]?.intentText).toContain("TOKEN BUDGET: 0 of 20000");
    expect(seen[0]?.tools.some((t) => t.name === "plan.propose")).toBe(true);
  });

  it("a revision asks for a new plan, which supersedes the old one", async () => {
    const s = setup(planFirst);
    s.directive(M, "ana", { text: "Build a widget" });
    const r = new Runner(s, M, bot, new ScriptedModel(), defaultTools());
    await r.drive();
    const first = activePlan(s.state());
    expect(first?.status).toBe("proposed");
    s.decidePlan(M, "ana", first?.id ?? "", "revise", "shorter");
    await r.drive();
    const second = activePlan(s.state());
    expect(second?.id).not.toBe(first?.id);
    expect(second?.status).toBe("proposed");
    expect(s.state().plans[first?.id ?? ""]?.supersededBy).toBe(second?.id);
    // Rejected: the agent stops until someone steers again.
    s.decidePlan(M, "ana", second?.id ?? "", "rejected");
    expect(r.shouldTurn()).toBe(false);
    s.directive(M, "ana", { text: "Build a widget", mode: "constrain" });
    expect(r.shouldTurn()).toBe(true);
  });

  it("hides the plan tools when the session does not plan first", async () => {
    const s = setup();
    s.directive(M, "ana", { text: "Build a thing" });
    let tools: string[] = [];
    const peek: Model = {
      name: "peek",
      async complete(req): Promise<ModelResponse> {
        tools = req.tools.map((t) => t.name);
        return { text: "DONE", toolCalls: [], done: true };
      },
    };
    await new Runner(s, M, bot, peek, defaultTools()).drive();
    expect(tools).not.toContain("plan.propose");
    expect(tools).not.toContain("plan.step");
  });
});
