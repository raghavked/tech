import { DEFAULT_SESSION_POLICY, type SessionPolicy } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import { Project } from "../src/project.js";
import {
  briefTokens,
  isWelcomeBrief,
  memoryEntriesOf,
  welcomeBrief,
  welcomeInputOf,
} from "../src/welcome.js";

const policy: SessionPolicy = {
  ...DEFAULT_SESSION_POLICY,
  planFirst: true,
  planApproval: { min: 2, average: 3 },
  approvals: {
    ...DEFAULT_SESSION_POLICY.approvals,
    irreversible: { ratings: { min: 2, of: "contributor", average: 4 } },
  },
  tokenBudget: 400_000,
};

function setup(): Project {
  const p = Project.create("checkout", "acme", "payments", "Payments", {
    autoClaimOnWrite: true,
    claimTtlTurns: 0,
  });
  p.join("ana", "Ana", "lead");
  p.join("bo", "Bo", "member");
  p.join("cy", "Cy", "member");
  p.registerSession("s-bo", "bo", "Billing page");
  p.registerSession("s-cy", "cy", "Invoice PDF");
  p.registerSession("s-ana", "ana", "Checkout");
  p.crew("ana", "s-bo", "Invoice rollout");
  p.crew("ana", "s-ana", "Invoice rollout");
  p.claim("s-cy", { type: "path", pattern: "billing/tax-lines" }, "exclusive", "tax table");
  p.reportStatus({
    sessionId: "s-bo",
    status: "running",
    turn: 3,
    goal: "the tax lines table",
    summary: "writing",
    activePaths: [],
    pendingApprovals: 0,
  });
  return p;
}

describe("the welcome brief", () => {
  it("writes the circle, the crew, the manners and the context from the ledger, in one voice", () => {
    const p = setup();
    const input = welcomeInputOf(p.state(), "s-ana", {
      policy,
      memoryContext:
        "TEAM MEMORY (attributed; narrower scope wins on the same key):\n  - [rounding] Round half-up per tax line (Cy, commit a3f91c)\n  ! [tax] Tax applies after the credit (Dee)\n",
    });
    expect(input.agent).toEqual({
      title: "Checkout",
      ownerName: "Ana",
      project: "Payments",
      crew: "Invoice rollout",
      branch: "main",
      freshWorkspace: true,
    });
    // The owner first; a lead opens a session as an owner, a member as a contributor: both
    // reach a contributor gate.
    expect(input.people.map((x) => [x.name, x.owner, x.holdsGate])).toEqual([
      ["Ana", true, true],
      ["Bo", false, true],
      ["Cy", false, true],
    ]);
    expect(input.agents.map((a) => [a.title, a.crewmate, a.holds])).toEqual([
      ["Billing page", true, []],
      ["Invoice PDF", false, ["path:billing/tax-lines"]],
    ]);
    expect(input.context).toEqual([
      { text: "Round half-up per tax line", who: "Cy, commit a3f91c" },
      { text: "Tax applies after the credit", who: "Dee" },
    ]);

    const b = welcomeBrief(input);
    expect(b.paragraph).toBe(
      "You join Payments: Ana, Bo and Cy, and 2 agents. You are Ana's agent on Checkout. Plan first; the people who consume your code open your gate.",
    );
    expect(b.sections.map((s) => [s.title, s.note])).toEqual([
      ["The circle", "3 people · 2 agents"],
      ["Your crew", "Invoice rollout"],
      ["Manners", ""],
      ["In your context", "2 entries"],
    ]);
    const circle = b.sections[0]?.lines ?? [];
    expect(circle[0]).toBe(
      "Ana is your owner and the lead. Ana can pause, resume, cancel and hand you on.",
    );
    expect(circle.at(-1)).toBe(
      "Bo and Cy hold your release gate: nothing that cannot be undone goes until they say so.",
    );
    const crew = b.sections[1]?.lines ?? [];
    expect(crew[0]).toBe("Billing page (Bo's, running) · the tax lines table");
    expect(crew.at(-1)).toContain(
      "Also on Payments: Invoice PDF, Cy's; holds path:billing/tax-lines",
    );
    const manners = b.sections[2]?.lines ?? [];
    expect(manners[0]).toBe(
      "Plan before work. Steps, token estimates and risk; the plan waits for 2 ratings at 3+ or an owner's Approve.",
    );
    expect(manners[1]).toContain(
      "the gate is 2 contributors or above rating it 4+ of 5 on average",
    );
    expect(manners[2]).toBe(
      "In a group you hear mentions only. Answer there as Ana's agent; team chat is never sent to you.",
    );
    expect(manners[3]).toBe(
      "400,000 tokens, soft. You are told what you have spent; nobody stops you at the line.",
    );
    const context = b.sections[3]?.lines ?? [];
    expect(context).toEqual([
      "Round half-up per tax line (Cy, commit a3f91c)",
      "Tax applies after the credit (Dee)",
      "Not told: the groups' history, the team's chat, the other projects' memory.",
    ]);
    // As the model reads it: the same facts as markdown, under one heading the web recognises.
    expect(isWelcomeBrief(b.markdown)).toBe(true);
    expect(b.markdown).toContain("agent: Checkout · owner: Ana · project: Payments");
    expect(b.markdown).toContain("## Manners\n- Plan before work.");
    expect(briefTokens(b.markdown)).toBe(Math.ceil(b.markdown.length / 4));
  });

  it("says solo, no budget and nobody else when the ledger is empty", () => {
    const p = Project.create("p", "o", "t", "", { autoClaimOnWrite: true, claimTtlTurns: 0 });
    p.registerSession("s1", "dee", "Helper");
    const b = welcomeBrief(welcomeInputOf(p.state(), "s1", { policy: DEFAULT_SESSION_POLICY }));
    expect(b.paragraph).toBe(
      "You join p: dee. You are dee's agent on Helper. The people who consume your code open your gate.",
    );
    expect(b.sections[0]?.lines).toEqual([
      "dee is your owner. dee can pause, resume, cancel and hand you on.",
    ]);
    expect(b.sections[1]?.lines).toEqual([
      "Solo. Your owner can name a crew to share one task with other agents.",
    ]);
    expect(b.sections[2]?.lines[0]).toContain("Ask for risky calls.");
    expect(b.sections[2]?.lines.at(-1)).toBe("No token budget. You are told what you have spent.");
    expect(b.sections[3]?.lines[0]).toBe("Nothing remembered in your scope yet.");
    expect(isWelcomeBrief("OTHER AGENTS IN THIS PROJECT")).toBe(false);
    expect(memoryEntriesOf("")).toEqual([]);
  });
});
