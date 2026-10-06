import { checkReplay, replayBranch, Session, stateHash } from "@henosis/kernel";
import { type Actor, DEFAULT_APPROVAL_POLICY, MAIN_BRANCH } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import { Runner } from "../src/runner.js";
import { ScriptedModel } from "../src/scripted.js";
import { defaultTools } from "../src/tools.js";

const policy = { approvals: DEFAULT_APPROVAL_POLICY, contention: "block" as const, maxTurns: 40 };
const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const bo: Actor = { id: "bo", kind: "human", name: "Bo" };
const cy: Actor = { id: "cy", kind: "human", name: "Cy" };
const bot: Actor = { id: "agent", kind: "agent", name: "Agent" };
const M = MAIN_BRANCH;

function setup() {
  const s = Session.create("s", "Demo", policy);
  s.join(M, ana, "owner");
  s.join(M, bo, "contributor");
  s.join(M, cy, "contributor");
  return s;
}

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
});
