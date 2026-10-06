import {
  type Actor,
  DEFAULT_APPROVAL_POLICY,
  MAIN_BRANCH,
  type Usage,
  ZERO_USAGE,
} from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import { handoffBrief } from "../src/brief.js";
import { replayBranch, stateHash } from "../src/replay.js";
import { renderReport } from "../src/report.js";
import { Session } from "../src/session.js";
import { budgetStatus, compactTokens, describeBudget, formatTokens } from "../src/usage.js";

const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const M = MAIN_BRANCH;
const u1: Usage = { input: 1200, output: 300, cacheRead: 800, cacheWrite: 0 };
const u2: Usage = { input: 2000, output: 500, cacheRead: 1000, cacheWrite: 64 };

function setup(tokenBudget: number | null = null): Session {
  const s = Session.create("s", "Usage", {
    approvals: DEFAULT_APPROVAL_POLICY,
    contention: "block",
    maxTurns: 50,
    planFirst: false,
    planApproval: { min: 1, average: 3 },
    tokenBudget,
  });
  s.join(M, ana, "owner");
  s.directive(M, "ana", { text: "Count tokens" });
  return s;
}

describe("token usage in the kernel", () => {
  it("sums model usage into the turn and the branch; calls without usage add nothing", () => {
    const s = setup();
    expect(s.state().usage).toEqual(ZERO_USAGE);
    s.turnStarted(M, "agent");
    s.modelCompleted(M, "agent", "a", [], "m", u1);
    s.modelCompleted(M, "agent", "b", [], "m");
    s.modelCompleted(M, "agent", "c", [], "m", u2);
    s.turnEnded(M, "agent", "done", "DONE");
    const st = s.state();
    const sum: Usage = { input: 3200, output: 800, cacheRead: 1800, cacheWrite: 64 };
    expect(st.usage).toEqual(sum);
    expect(st.turns[0]?.usage).toEqual(sum);
    s.turnStarted(M, "agent");
    s.modelCompleted(M, "agent", "d", [], "m", u1);
    s.turnEnded(M, "agent", "done", "DONE");
    expect(s.state().turns[1]?.usage).toEqual(u1);
    expect(s.state().usage.input).toBe(4400);
    // A call without usage records no `usage` key, so ids of old-style events are unchanged.
    const bare = s
      .events()
      .find((e) => e.kind === "agent.model.completed" && e.payload.text === "b");
    expect(bare && "usage" in bare.payload).toBe(false);
    expect(stateHash(replayBranch(s.log, M))).toBe(stateHash(s.state()));
  });

  it("budgetStatus reads the policy's soft budget", () => {
    const s = setup(4000);
    s.turnStarted(M, "agent");
    s.modelCompleted(M, "agent", "a", [], "m", u1);
    expect(budgetStatus(s.state())).toEqual({
      used: 1500,
      budget: 4000,
      fraction: 0.375,
      over: false,
    });
    s.modelCompleted(M, "agent", "b", [], "m", u2);
    s.modelCompleted(M, "agent", "c", [], "m", u2);
    const b = budgetStatus(s.state());
    expect(b.used).toBe(6500);
    expect(b.over).toBe(true);
    expect(describeBudget(b)).toBe("6,500 of 4,000 (163%), over budget");
    expect(budgetStatus(setup().state())).toEqual({
      used: 0,
      budget: null,
      fraction: 0,
      over: false,
    });
    expect(describeBudget(budgetStatus(setup().state()))).toBe("0, no budget");
  });

  it("formats deterministically", () => {
    expect(formatTokens(1234567)).toBe("1,234,567");
    expect(compactTokens(980)).toBe("980");
    expect(compactTokens(12_400)).toBe("12.4k");
    expect(compactTokens(1_000)).toBe("1k");
    expect(compactTokens(123_456)).toBe("123k");
    expect(compactTokens(1_250_000)).toBe("1.3M");
  });

  it("the brief and the report say what was spent", () => {
    const s = setup(10_000);
    s.turnStarted(M, "agent");
    s.modelCompleted(M, "agent", "a", [], "m", u1);
    s.turnEnded(M, "agent", "done", "DONE");
    const brief = handoffBrief(s.state(), { events: s.events() });
    expect(brief).toContain(
      "Tokens used: 1,500 (in 1,200, out 300, cache read 800); budget 1,500 of 10,000 (15%).",
    );
    expect(brief).toContain("[0 tool calls, done, 1,500 tokens]");
    const report = renderReport(s);
    expect(report).toContain("## Tokens");
    expect(report).toContain("| 1 | 1,200 | 300 | 800 | 0 | 1,500 |");
  });
});
