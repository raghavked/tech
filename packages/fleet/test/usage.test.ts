import { ZERO_USAGE } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import { fleetBrief } from "../src/brief.js";
import { SessionStatusReport } from "../src/events.js";
import { Project } from "../src/project.js";
import { projectUsage, usageOf } from "../src/state.js";

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
});
