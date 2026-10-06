import {
  type Actor,
  DEFAULT_SESSION_POLICY,
  MAIN_BRANCH,
  type SessionPolicy,
} from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import { activePlan, gateForCall, planForGoal, planWaiting, ratingSummary } from "../src/plans.js";
import { checkReplay, replayBranch, stateHash } from "../src/replay.js";
import { KernelError, Session } from "../src/session.js";

const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const bo: Actor = { id: "bo", kind: "human", name: "Bo" };
const cy: Actor = { id: "cy", kind: "human", name: "Cy" };
const ol: Actor = { id: "ol", kind: "human", name: "Ollie" };
const bot: Actor = { id: "agent", kind: "agent", name: "Agent" };
const M = MAIN_BRANCH;

const policy: SessionPolicy = {
  ...DEFAULT_SESSION_POLICY,
  planFirst: true,
  planApproval: { min: 2, average: 4 },
  tokenBudget: 5000,
};

const STEPS = [
  { title: "Write the module", detail: "src/thing.mjs", estTokens: 600, risk: "write" as const },
  { title: "Write and run the tests", estTokens: 900, risk: "exec" as const },
  { title: "Deploy", estTokens: 300, risk: "irreversible" as const },
];

function setup(p: SessionPolicy = policy) {
  const s = Session.create("s1", "Plan first", p);
  s.join(M, bot, "contributor");
  s.join(M, ana, "owner");
  s.join(M, bo, "contributor");
  s.join(M, cy, "contributor");
  s.join(M, ol, "observer");
  s.directive(M, "ana", { text: "Build a thing and deploy it" });
  return s;
}

function planId(s: Session): string {
  const id = s.state().activePlanId;
  if (!id) throw new Error("no plan");
  return id;
}

/** A model call with synthetic usage, so step actuals have something to count. */
function spend(s: Session, tokens: number) {
  s.modelCompleted(M, "agent", "working", [], "test", {
    input: tokens,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  });
}

describe("plan first", () => {
  it("a proposal opens a plan; ratings meeting the policy approve it in the fold", () => {
    const s = setup();
    s.turnStarted(M, "agent");
    s.proposePlan(M, "agent", { steps: STEPS, rationale: "Small steps, tests before deploy." });
    let st = s.state();
    const p = activePlan(st);
    expect(p?.status).toBe("proposed");
    expect(p?.goal).toBe("Build a thing and deploy it");
    expect(p?.steps.map((x) => x.id)).toEqual(["s1", "s2", "s3"]);
    expect(p?.estTokens).toBe(1800);
    expect(planWaiting(st)).toBe(true);
    expect(planForGoal(st)?.id).toBe(p?.id);

    // Observers and the agent cannot rate; a rating is 1..5.
    expect(() => s.ratePlan(M, "ol", planId(s), 5)).toThrow(/contributor or above/);
    expect(() => s.ratePlan(M, "agent", planId(s), 5)).toThrow(/only humans/);
    expect(() => s.ratePlan(M, "bo", planId(s), 7)).toThrow(KernelError);

    s.ratePlan(M, "bo", planId(s), 3, "fine but the deploy step is vague");
    st = s.state();
    expect(activePlan(st)?.status).toBe("proposed"); // one of two
    expect(ratingSummary(activePlan(st) ?? { ratings: {} })).toEqual({ count: 1, average: 3 });
    s.ratePlan(M, "cy", planId(s), 5);
    st = s.state();
    expect(ratingSummary(activePlan(st) ?? { ratings: {} })).toEqual({ count: 2, average: 4 });
    expect(activePlan(st)?.status).toBe("approved");
    expect(activePlan(st)?.decidedBy).toBe("policy");
    expect(planWaiting(st)).toBe(false);
    // The log holds no plan.decided: the approval is derived by every replica.
    expect(s.events().some((e) => e.kind === "plan.decided")).toBe(false);
    expect(() => s.ratePlan(M, "ana", planId(s), 5)).toThrow(/already approved/);
  });

  it("a low average keeps the plan waiting; an owner can approve it now", () => {
    const s = setup();
    s.turnStarted(M, "agent");
    s.proposePlan(M, "agent", { steps: STEPS });
    s.ratePlan(M, "bo", planId(s), 2);
    s.ratePlan(M, "cy", planId(s), 3);
    expect(activePlan(s.state())?.status).toBe("proposed");
    expect(() => s.decidePlan(M, "bo", planId(s), "approved")).toThrow(/driver or an owner/);
    s.decidePlan(M, "ana", planId(s), "approved", "we need this today");
    const p = activePlan(s.state());
    expect(p?.status).toBe("approved");
    expect(p?.decidedBy).toBe("ana");
    expect(p?.note).toBe("we need this today");
    // The driver can send an approved plan back for revision; a done plan is final.
    s.decidePlan(M, "ana", planId(s), "revise", "add a rollback step");
    expect(activePlan(s.state())?.status).toBe("revise");
    expect(() => s.decidePlan(M, "ana", planId(s), "rejected")).toThrow(/already revise/);
  });

  it("a new proposal supersedes the active plan and the gate follows the active one", () => {
    const s = setup();
    s.turnStarted(M, "agent");
    s.proposePlan(M, "agent", { steps: STEPS });
    const first = planId(s);
    s.decidePlan(M, "ana", first, "revise", "fewer steps");
    s.proposePlan(M, "agent", { steps: STEPS.slice(0, 2), rationale: "revised: no deploy" });
    const second = planId(s);
    expect(second).not.toBe(first);
    const st = s.state();
    expect(st.plans[first]?.supersededBy).toBe(second);
    expect(st.plans[first]?.status).toBe("revise");
    expect(st.plans[second]?.status).toBe("proposed");
    expect(st.plans[second]?.steps).toHaveLength(2);
    expect(Object.keys(st.plans)).toHaveLength(2);
  });

  it("gates every call above read until the plan for the current goal is approved", () => {
    const s = setup();
    const write = { id: "c1", name: "workspace.write", args: {}, risk: "write" as const };
    const read = { id: "c2", name: "workspace.read", args: {}, risk: "read" as const };
    expect(gateForCall(s.state(), read)).toEqual({ ok: true });
    expect(gateForCall(s.state(), write)).toEqual({
      ok: false,
      reason: "the plan is not approved yet; wait or revise",
    });
    s.turnStarted(M, "agent");
    s.proposePlan(M, "agent", { steps: STEPS });
    expect(gateForCall(s.state(), write).ok).toBe(false);
    s.decidePlan(M, "ana", planId(s), "approved");
    expect(gateForCall(s.state(), write).ok).toBe(true);
    // A new goal needs a new plan: the approved one no longer covers it.
    s.directive(M, "ana", { text: "Build a different thing" });
    expect(planForGoal(s.state())).toBeNull();
    expect(gateForCall(s.state(), write).ok).toBe(false);
    // Without plan first nothing is gated.
    const loose = setup({ ...policy, planFirst: false });
    expect(gateForCall(loose.state(), write).ok).toBe(true);
  });

  it("steps run one at a time, record the tokens they took, and finish the plan", () => {
    const s = setup();
    s.turnStarted(M, "agent");
    s.proposePlan(M, "agent", { steps: STEPS });
    expect(() => s.startStep(M, "agent", null, "s1")).toThrow(/plan is proposed/);
    s.decidePlan(M, "ana", planId(s), "approved");
    spend(s, 100); // tokens before the first step do not count against it
    s.startStep(M, "agent", null, "s1");
    expect(s.startStep(M, "agent", null, "s1")).toBeNull(); // already running
    spend(s, 250);
    // Starting the next step completes the running one with what it spent.
    s.startStep(M, "agent", null, "s2");
    let p = activePlan(s.state());
    expect(p?.steps.map((x) => x.status)).toEqual(["done", "running", "pending"]);
    expect(p?.steps[0]?.actualTokens).toBe(250);
    expect(() => s.startStep(M, "agent", null, "s1")).toThrow(/is done/);
    expect(() => s.completeStep(M, "agent", null, "s3")).toThrow(/not running/);
    spend(s, 400);
    s.completeStep(M, "agent", null, "s2", "tests green");
    s.startStep(M, "agent", null, "s3");
    spend(s, 50);
    s.completeStep(M, "agent", null, "s3");
    p = activePlan(s.state());
    expect(p?.status).toBe("done");
    expect(p?.steps.map((x) => x.actualTokens)).toEqual([250, 400, 50]);
    expect(p?.steps[1]?.note).toBe("tests green");
    expect(s.state().usage.input).toBe(800);
  });

  it("replays deterministically from the log and from a snapshot", () => {
    const s = setup();
    s.turnStarted(M, "agent");
    s.proposePlan(M, "agent", { steps: STEPS });
    s.ratePlan(M, "bo", planId(s), 4);
    s.ratePlan(M, "cy", planId(s), 4);
    s.startStep(M, "agent", null, "s1");
    spend(s, 120);
    s.startStep(M, "agent", null, "s2");
    s.turnEnded(M, "agent", "done", "continuing");
    const st = s.state();
    expect(activePlan(st)?.status).toBe("approved");
    expect(checkReplay(s.log, M).ok).toBe(true);
    expect(stateHash(replayBranch(s.log, M))).toBe(stateHash(st));
    const again = Session.fromSerialized(s.log.serialize());
    expect(stateHash(again.state())).toBe(stateHash(st));
  });
});
