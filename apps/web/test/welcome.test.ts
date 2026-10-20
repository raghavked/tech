import { welcomeBrief } from "@henosis/fleet";
import { fold, type SessionState } from "@henosis/kernel";
import { DEFAULT_SESSION_POLICY, type SessionPolicy } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import type { SessionRow } from "../src/api.js";
import {
  arrivalFacts,
  circleOf,
  isArriving,
  recordedWelcome,
  welcomeInputFromSession,
} from "../src/welcome.js";

const policy: SessionPolicy = {
  ...DEFAULT_SESSION_POLICY,
  planFirst: true,
  approvals: {
    ...DEFAULT_SESSION_POLICY.approvals,
    irreversible: { ratings: { min: 2, of: "contributor", average: 4 } },
  },
  tokenBudget: 400_000,
};

/** A young session: Ana owns it, Bo and Cy contribute, Dee observes; no turn has ended. */
function young(): SessionState {
  const base = fold([]);
  return {
    ...base,
    sessionId: "checkout",
    title: "Checkout",
    projectId: "payments",
    ownerId: "ana",
    policy,
    status: "idle",
    participants: {
      dee: {
        actor: { id: "dee", kind: "human", name: "Dee" },
        role: "observer",
        present: true,
        joinedSeq: 4,
        lastSeenSeq: 4,
      },
      ana: {
        actor: { id: "ana", kind: "human", name: "Ana" },
        role: "owner",
        present: true,
        joinedSeq: 1,
        lastSeenSeq: 1,
      },
      bo: {
        actor: { id: "bo", kind: "human", name: "Bo" },
        role: "contributor",
        present: true,
        joinedSeq: 2,
        lastSeenSeq: 2,
      },
      cy: {
        actor: { id: "cy", kind: "human", name: "Cy" },
        role: "contributor",
        present: false,
        joinedSeq: 3,
        lastSeenSeq: 3,
      },
    },
  };
}

const row = (
  sessionId: string,
  ownerId: string,
  title: string,
  crew: string | null,
  live: string | null = "running",
): SessionRow => ({
  sessionId,
  ownerId,
  title,
  open: true,
  registeredSeq: 1,
  report: null,
  crew,
  briefs: [],
  live: live as SessionRow["live"],
  people: [],
});

describe("welcome an agent, on the web", () => {
  it("names the circle with the owner first and the gate held by whoever ranks high enough", () => {
    const s = young();
    expect(circleOf(s).map((p) => [p.name, p.owner, p.holdsGate])).toEqual([
      ["Ana", true, true],
      ["Bo", false, true],
      ["Cy", false, true],
      ["Dee", false, false],
    ]);
  });

  it("reads the four facts of the arrival card from the live state", () => {
    const s = young();
    const rows = [
      row("checkout", "ana", "Checkout", "Invoice rollout"),
      row("billing", "bo", "Billing page", "Invoice rollout"),
    ];
    const f = arrivalFacts(s, rows);
    expect(f).toMatchObject({
      status: "idle",
      planning: false,
      mentionedBy: ["Ana", "Bo", "Cy", "Dee"],
      gate: ["Ana", "Bo", "Cy"],
      gateRule: "2 contributors or above rating it 4+ of 5 on average",
      ownerName: "Ana",
      crew: "Invoice rollout",
      freshWorkspace: true,
      files: 0,
      goal: null,
    });
    expect(isArriving(s)).toBe(true);
    // Once a turn has ended the card leaves the stream; the brief stays in Details.
    const later = {
      ...s,
      turns: [{ turn: 1, startedSeq: 5, endedSeq: 9, reason: "done", summary: "ok" }],
    } as unknown as SessionState;
    expect(isArriving(later)).toBe(false);
  });

  it("composes the same paragraph the server records, from the live state and the listing", () => {
    const s = young();
    const rows = [
      row("checkout", "ana", "Checkout", "Invoice rollout"),
      row("billing", "bo", "Billing page", "Invoice rollout"),
      row("pdf", "cy", "Invoice PDF", null, "awaiting_approval"),
    ];
    const nameOf = (id: string) => s.participants[id]?.actor.name ?? id;
    const input = welcomeInputFromSession(
      s,
      rows,
      "Payments",
      "TEAM MEMORY:\n  - [rounding] Round half-up per tax line (Cy, commit a3f91c)\n",
      nameOf,
    );
    expect(input.agent).toEqual({
      title: "Checkout",
      ownerName: "Ana",
      project: "Payments",
      crew: "Invoice rollout",
      branch: "main",
      freshWorkspace: true,
    });
    expect(input.agents.map((a) => [a.title, a.crewmate, a.status])).toEqual([
      ["Billing page", true, "running"],
      ["Invoice PDF", false, "awaiting_approval"],
    ]);
    expect(input.context).toEqual([
      { text: "Round half-up per tax line", who: "Cy, commit a3f91c" },
    ]);
    const b = welcomeBrief(input);
    expect(b.paragraph).toBe(
      "You join Payments: Ana, Bo, Cy and Dee, and 2 agents. You are Ana's agent on Checkout. Plan first; the people who consume your code open your gate.",
    );
    expect(b.sections[0]?.lines).toContain("Dee may steer and constrain you (observer).");
    expect(b.sections[2]?.lines[3]).toBe(
      "400,000 tokens, soft. You are told what you have spent; nobody stops you at the line.",
    );
  });

  it("finds the recorded welcome brief and ignores an older bare fleet context", () => {
    expect(recordedWelcome(undefined)).toBeNull();
    const old = {
      reader: "agent",
      kind: "fleet" as const,
      seq: 1,
      atSeq: 0,
      brief: "no other agents",
    };
    expect(recordedWelcome([old])).toBeNull();
    const told = { ...old, brief: "## Henosis · you have joined\nYou join Payments." };
    expect(recordedWelcome([old, told])?.brief).toBe(told.brief);
    expect(recordedWelcome([told, { ...old, kind: "handoff" as const }])?.brief).toBe(told.brief);
  });
});
