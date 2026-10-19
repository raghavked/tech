import { ZERO_USAGE } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import { fleetBrief } from "../src/brief.js";
import { SessionStatusReport } from "../src/events.js";
import { Project } from "../src/project.js";
import { projectBudget, projectUsage, usageOf } from "../src/state.js";

const report = (sessionId: string, turn: number) => ({
  sessionId,
  status: "idle",
  goal: "Ship it",
  turn,
  summary: "DONE",
  activePaths: [],
  pendingApprovals: 0,
});

describe("token usage on the project ledger", () => {
  it("a report without usage still parses, and reads as zero", () => {
    const r = SessionStatusReport.parse(report("s", 1));
    expect(r.usage).toBeUndefined();
    const p = Project.create("x", "o", "t", "X", { autoClaimOnWrite: true, claimTtlTurns: 0 });
    p.join("ana", "Ana", "member");
    p.registerSession("s", "ana", "S");
    p.reportStatus(r);
    const ss = p.state().sessions.s;
    expect(ss && usageOf(ss)).toEqual(ZERO_USAGE);
    expect(projectUsage(p.state())).toEqual(ZERO_USAGE);
  });

  it("the fleet brief carries a tokens line per session and a project total", () => {
    const p = Project.create("billing", "nw", "pay", "Billing", {
      autoClaimOnWrite: true,
      claimTtlTurns: 0,
    });
    p.join("ana", "Ana", "member");
    p.join("bo", "Bo", "member");
    p.registerSession("s-ana", "ana", "Invoices");
    p.registerSession("s-bo", "bo", "Receipts");
    p.reportStatus({
      ...report("s-ana", 3),
      usage: { input: 10_000, output: 2_000, cacheRead: 4_000, cacheWrite: 0 },
    });
    p.reportStatus({
      ...report("s-bo", 1),
      usage: { input: 1_000, output: 500, cacheRead: 0, cacheWrite: 0 },
    });
    expect(projectUsage(p.state())).toEqual({
      input: 11_000,
      output: 2_500,
      cacheRead: 4_000,
      cacheWrite: 0,
    });
    const brief = fleetBrief(p.state());
    expect(brief).toContain(
      "Tokens: 13,500 (in 11,000, out 2,500, cache read 4,000) across the open sessions.",
    );
    expect(brief).toContain("  tokens: 12,000 (in 10,000, out 2,000, cache read 4,000)");
    expect(brief).toContain("  tokens: 1,500 (in 1,000, out 500)");
    // A closed session drops out of the total.
    p.closeSession("s-bo");
    expect(projectUsage(p.state()).input).toBe(10_000);
  });

  it("the project budget is the sum of the sessions' budgets until a lead sets one (Decision 8)", () => {
    const p = Project.create("billing", "nw", "pay", "Billing", {
      autoClaimOnWrite: true,
      claimTtlTurns: 0,
    });
    p.join("dee", "Dee", "lead");
    p.join("ana", "Ana", "member");
    p.join("bo", "Bo", "member");
    p.registerSession("s-ana", "ana", "Invoices");
    p.registerSession("s-bo", "bo", "Receipts");
    p.registerSession("s-cy", "ana", "Fonts");
    // Nothing reported yet: no budget anywhere.
    expect(projectBudget(p.state())).toEqual({
      budget: null,
      source: null,
      sessionsWithBudget: 0,
      sessionsWithout: 3,
    });
    p.reportStatus({ ...report("s-ana", 3), budget: 120_000 });
    p.reportStatus({ ...report("s-bo", 1), budget: 60_000 });
    p.reportStatus({ ...report("s-cy", 1), budget: null });
    expect(projectBudget(p.state())).toEqual({
      budget: 180_000,
      source: "sessions",
      sessionsWithBudget: 2,
      sessionsWithout: 1,
    });
    // A caller that knows the session policies (the usage API) overrides the reports.
    expect(projectBudget(p.state(), new Map([["s-cy", 20_000]])).budget).toBe(200_000);
    // A closed session's budget drops out.
    p.closeSession("s-bo");
    expect(projectBudget(p.state()).budget).toBe(120_000);
    // Only a lead sets the project's own number; it then replaces the sum.
    expect(() => p.setPolicy("ana", { tokenBudget: 320_000 })).toThrow(/lead/);
    expect(() => p.setPolicy("dee", {})).toThrow(/nothing/);
    p.setPolicy("dee", { tokenBudget: 320_000 });
    expect(p.state().policy).toMatchObject({
      autoClaimOnWrite: true,
      claimTtlTurns: 0,
      tokenBudget: 320_000,
    });
    expect(projectBudget(p.state())).toMatchObject({ budget: 320_000, source: "project" });
    // Clearing it returns to the sum; the fold is deterministic across a reload.
    p.setPolicy("dee", { tokenBudget: null });
    expect(projectBudget(p.state())).toMatchObject({ budget: 120_000, source: "sessions" });
    expect(Project.fromSerialized(p.ledger.serialize()).state().policy).toEqual(p.state().policy);
    expect(p.ledger.verify()).toEqual({ ok: true });
  });
});
