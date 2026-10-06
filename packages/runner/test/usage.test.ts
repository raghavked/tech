import { Session } from "@henosis/kernel";
import { type Actor, addUsage, MAIN_BRANCH, type Usage, ZERO_USAGE } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import type { ModelRequest } from "../src/model.js";
import { Runner } from "../src/runner.js";
import { ScriptedModel, syntheticUsage } from "../src/scripted.js";
import { defaultTools } from "../src/tools.js";

const none = {
  read: "none",
  write: "none",
  exec: "none",
  external: "none",
  irreversible: "none",
} as const;
const policy = {
  approvals: none,
  contention: "block" as const,
  maxTurns: 40,
  planFirst: false,
  planApproval: { min: 1, average: 3 },
  tokenBudget: null,
};
const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const bot: Actor = { id: "agent", kind: "agent", name: "Agent" };
const M = MAIN_BRANCH;

function request(): ModelRequest {
  return {
    title: "T",
    intent: {
      goal: { text: "Build a doubling helper", author: "ana", directiveId: "d", rank: 3 },
      steers: {},
      constraints: [],
      control: "running",
      interrupt: false,
      contendedScopes: [],
    },
    intentText: "GOAL: Build a doubling helper",
    history: [],
    files: [],
    transcript: [],
    tools: defaultTools().specs(),
    turn: 1,
    newDirectives: ["Ana [steer/goal]: Build a doubling helper"],
  };
}

describe("scripted usage", () => {
  it("is a pure function of the request and the output", async () => {
    const m = new ScriptedModel();
    const a = await m.complete(request());
    const b = await m.complete(request());
    expect(a.usage).toEqual(b.usage);
    expect(a.usage?.input).toBeGreaterThan(64);
    expect(a.usage?.output).toBeGreaterThan(0);
    // The first call of a turn writes the prefix to cache; later calls read it.
    expect(a.usage?.cacheWrite).toBeGreaterThan(0);
    expect(a.usage?.cacheRead).toBe(0);
    const later = {
      ...request(),
      transcript: [{ role: "assistant" as const, text: a.text, toolCalls: a.toolCalls }],
    };
    const c = syntheticUsage(later, "x", []);
    expect(c.cacheRead).toBe(a.usage?.cacheWrite);
    expect(c.cacheWrite).toBe(0);
    expect(c.input).toBeGreaterThan(a.usage?.input ?? 0);
    expect(syntheticUsage(request(), "longer text here", [])).not.toEqual(
      syntheticUsage(request(), "x", []),
    );
  });

  it("reaches the log through the runner and folds into the session state", async () => {
    const s = Session.create("s", "Demo", policy);
    s.join(M, ana, "owner");
    s.directive(M, "ana", { text: "Build a doubling helper" });
    await new Runner(s, M, bot, new ScriptedModel(), defaultTools()).drive();
    const calls = s.events().filter((e) => e.kind === "agent.model.completed");
    expect(calls.length).toBeGreaterThan(1);
    let sum: Usage = { ...ZERO_USAGE };
    for (const e of calls) {
      if (e.kind !== "agent.model.completed") continue;
      expect(e.payload.usage?.input).toBeGreaterThan(0);
      sum = addUsage(sum, e.payload.usage);
    }
    const st = s.state();
    expect(st.usage).toEqual(sum);
    expect(st.turns.every((t) => t.usage.input > 0)).toBe(true);
    expect(st.turns.reduce((t, x) => addUsage(t, x.usage), { ...ZERO_USAGE })).toEqual(sum);
  });
});
