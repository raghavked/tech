import { type Actor, DEFAULT_APPROVAL_POLICY, MAIN_BRANCH } from "@fold/protocol";
import { describe, expect, it } from "vitest";
import { renderReport } from "../src/report.js";
import { Session } from "../src/session.js";

const policy = { approvals: DEFAULT_APPROVAL_POLICY, contention: "block" as const, maxTurns: 50 };
const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const bo: Actor = { id: "bo", kind: "human", name: "Bo" };
const bot: Actor = { id: "agent", kind: "agent", name: "Agent" };
const M = MAIN_BRANCH;

function setup(): Session {
  const s = Session.create("s1", "Ship the billing page", policy);
  s.join(M, bot, "contributor");
  s.join(M, ana, "owner");
  s.join(M, bo, "contributor");
  s.directive(M, "ana", { text: "Build the billing page | with Stripe" });
  s.turnStarted(M, "agent");
  s.turnEnded(M, "agent", "done", "scaffolded the page");
  return s;
}

describe("renderReport", () => {
  it("renders a markdown table per branch and ends with the handoff brief", () => {
    const md = renderReport(setup());
    expect(md.startsWith("# Session report: Ship the billing page\n")).toBe(true);
    expect(md).toMatch(/^## Branch main \(\d+ events, status idle, 1 turns\)$/m);
    expect(md).toContain("| seq | actor | event | detail |");
    expect(md).toContain("| Ana | participant.joined | Ana as owner |");
    expect(md).toContain("| Agent | agent.turn.ended | done: scaffolded the page |");
    expect(md).toContain("# Handoff brief: Ship the billing page");
    expect(md.endsWith("\n")).toBe(true);
  });

  it("escapes pipes in details so the table stays well formed", () => {
    const md = renderReport(setup());
    expect(md).toContain("Build the billing page \\| with Stripe");
  });

  it("is deterministic across a serialize and reload", () => {
    const s = setup();
    const again = Session.fromSerialized(JSON.parse(JSON.stringify(s.log.serialize())));
    expect(renderReport(again)).toBe(renderReport(s));
  });

  it("lists every branch", () => {
    const s = setup();
    s.checkpoint(M, "ana", "before fork");
    s.fork(M, "ana", "alt");
    const md = renderReport(s);
    expect(md).toContain("## Branch main (");
    expect(md).toContain("## Branch alt (");
  });
});
