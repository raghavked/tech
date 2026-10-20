import { type ApprovalRecord, initialState, type SessionState } from "@henosis/kernel";
import { DEFAULT_SESSION_POLICY, type RiskClass, type Role } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import {
  askParts,
  consequenceOf,
  countsOf,
  filterRows,
  glanceOf,
  ledeOf,
  moveCursor,
  ratingWord,
  rowState,
  rowsOf,
} from "./approvalsQueue.js";

function session(
  people: [string, string, Role][],
  approvals: ApprovalRecord[],
  driver: string | null = null,
): SessionState {
  const s = initialState();
  s.sessionId = "invoice-pdf";
  s.title = "Invoice PDF";
  s.projectId = "billing";
  s.ownerId = "ana";
  s.policy = structuredClone(DEFAULT_SESSION_POLICY);
  s.driver = driver;
  s.participants.agent = {
    actor: { id: "agent", kind: "agent", name: "Agent" },
    role: "contributor",
    present: true,
    joinedSeq: 0,
    lastSeenSeq: 0,
  };
  for (const [id, name, role] of people)
    s.participants[id] = {
      actor: { id, kind: "human", name },
      role,
      present: true,
      joinedSeq: 0,
      lastSeenSeq: 0,
    };
  for (const a of approvals) s.approvals[a.id] = a;
  return s;
}

function approval(
  id: string,
  risk: RiskClass,
  call: { name: string; args: Record<string, unknown> },
  ballots: Record<string, { vote: "approve" | "deny"; rating: number | null }> = {},
  status: ApprovalRecord["status"] = "pending",
): ApprovalRecord {
  return {
    id,
    call: { id: `c_${id}`, name: call.name, args: call.args, risk },
    votes: Object.fromEntries(Object.entries(ballots).map(([k, v]) => [k, v.vote])),
    ballots: Object.fromEntries(Object.entries(ballots).map(([k, v]) => [k, { ...v, note: "" }])),
    status,
    requestedSeq: Number(id.replace(/\D/g, "")) || 1,
    turn: 3,
    planId: null,
    stepIndex: null,
  };
}

const meta = { projectId: "billing", projectName: "Billing page", fallbackTitle: "" };
const people: [string, string, Role][] = [
  ["ana", "Ana", "owner"],
  ["bo", "Bo", "contributor"],
  ["cy", "Cy", "driver"],
];

describe("approvals queue rows", () => {
  it("writes the sentence, the mono call and what the row still needs", () => {
    const s = session(people, [
      approval("a1", "exec", { name: "shell.run", args: { command: "pnpm", args: ["test"] } }),
    ]);
    const [row] = rowsOf(s, meta, "bo");
    expect(row?.agentName).toBe("Ana's agent");
    expect(row?.action).toBe("run `pnpm test`");
    expect(row?.code).toBe("pnpm test");
    expect(askParts(row?.action ?? "")).toEqual([
      { text: "run " },
      { text: "pnpm test", code: "pnpm test" },
    ]);
    expect(row?.needs).toBe("needs a contributor");
    expect(row?.turn).toBe(3);
    expect(row?.ratings).toBe(false);
    expect(row?.override).toBeNull();
    expect(rowState(row as NonNullable<typeof row>)).toBe("exec");
  });

  it("tells the five states apart and offers the owner override only where the policy returns one", () => {
    const s = session(
      people,
      [
        approval("a1", "irreversible", { name: "deploy", args: { env: "production" } }),
        approval(
          "a2",
          "irreversible",
          { name: "deploy", args: { env: "staging" } },
          { bo: { vote: "approve", rating: 4 } },
        ),
        approval("a3", "external", { name: "http", args: {} }),
        approval(
          "a4",
          "irreversible",
          { name: "deploy", args: { env: "eu" } },
          { cy: { vote: "approve", rating: 3 } },
        ),
        approval(
          "a5",
          "exec",
          { name: "shell.run", args: { command: "ls" } },
          { ana: { vote: "approve", rating: null } },
          "granted",
        ),
      ],
      "cy",
    );
    const asBo = rowsOf(s, meta, "bo");
    const state = (id: string, who: string) => {
      const r = rowsOf(s, meta, who).find((x) => x.approvalId === id);
      if (!r) throw new Error(id);
      return r;
    };
    expect(rowState(state("a1", "bo"))).toBe("needs-you");
    expect(state("a1", "bo").quorum).toEqual({ count: 0, min: 2, average: 0, bar: 4, low: false });
    expect(state("a1", "bo").needs).toBe("needs 2 at 4+");
    // Bo's vote is in on a2: locked stars, "waits on others".
    expect(rowState(state("a2", "bo"))).toBe("voted");
    expect(state("a2", "bo").myRating).toBe(4);
    expect(state("a2", "bo").needs).toBe("needs one more at 4+");
    expect(state("a2", "bo").approvedBy).toEqual(["you"]);
    // The external call wants a driver: Bo cannot decide, the row waits for Cy; Ana outranks it.
    expect(rowState(state("a3", "bo"))).toBe("driver-only");
    expect(state("a3", "bo").waitsFor).toEqual({ role: "driver", who: "Cy" });
    expect(state("a3", "bo").override).toBeNull();
    expect(state("a3", "ana").canDecide).toBe(true);
    expect(state("a3", "ana").override).toBeNull();
    // A gate at avg 3.0: a 3 is a voice, not a vote.
    expect(rowState(state("a4", "bo"))).toBe("low");
    expect(state("a4", "bo").quorum?.low).toBe(true);
    // The kernel counts every rated approve toward the minimum; the 3 drags the average under the bar.
    expect(state("a4", "bo").quorum?.count).toBe(1);
    expect(state("a4", "bo").quorum?.average).toBe(3);
    // Decision 3: the owner may decide a gate alone; a contributor may not.
    expect(state("a1", "ana").override?.requires).toBe(
      "2 contributors or above rating it 4+ of 5 on average",
    );
    expect(state("a1", "bo").override).toBeNull();
    expect(rowState(state("a5", "bo"))).toBe("done");
    expect(asBo.filter((r) => r.status === "pending")).toHaveLength(4);
  });

  it("filters so that gates and others add up to all, and needs-you is what my vote can move", () => {
    const s = session(people, [
      approval("a1", "irreversible", { name: "deploy", args: { env: "production" } }),
      approval("a2", "exec", { name: "shell.run", args: { command: "ls" } }),
      approval("a3", "external", { name: "http", args: {} }),
      approval(
        "a4",
        "irreversible",
        { name: "deploy", args: { env: "eu" } },
        { bo: { vote: "approve", rating: 4 } },
      ),
    ]);
    const rows = rowsOf(s, meta, "bo");
    const counts = countsOf(rows);
    expect(counts).toEqual({ "needs-you": 2, gates: 2, others: 2, all: 4 });
    expect(counts.gates + counts.others).toBe(counts.all);
    expect(filterRows(rows, "needs-you").map((r) => r.approvalId)).toEqual(["a1", "a2"]);
    expect(filterRows(rows, "gates").map((r) => r.approvalId)).toEqual(["a1", "a4"]);
    expect(glanceOf(rows)).toEqual({ needYou: 2, voteIn: 1, theirs: 1 });
    const lede = ledeOf(rows);
    expect(lede.sentence).toBe("Four approvals waiting in one session across one project.");
    expect(lede.emphasis).toBe("Two are release gates;");
    expect(lede.rest).toBe("one waits for the driver.");
    expect(ledeOf([]).sentence).toBe("Nothing is waiting for approval.");
  });

  it("says what the pick does on a phone card: grants it, a voice, waits for names, the baton", () => {
    const s = session(
      people,
      [
        // nobody has rated: Bo's 4 alone is one of two
        approval("a1", "irreversible", { name: "deploy", args: { env: "production" } }),
        // Cy gave a 4: Bo's pick decides it
        approval(
          "a2",
          "irreversible",
          { name: "deploy", args: { env: "staging" } },
          { cy: { vote: "approve", rating: 4 } },
        ),
        // Bo's vote is in: the row waits for the others who may still rate
        approval(
          "a3",
          "irreversible",
          { name: "deploy", args: { env: "eu" } },
          { bo: { vote: "approve", rating: 4 } },
        ),
        // a driver's call: Cy has the baton
        approval("a4", "external", { name: "http", args: {} }),
        // a plain exec row needs no phrase
        approval("a5", "exec", { name: "shell.run", args: { command: "ls" } }),
      ],
      "cy",
    );
    const row = (id: string, who = "bo") => {
      const r = rowsOf(s, meta, who).find((x) => x.approvalId === id);
      if (!r) throw new Error(id);
      return r;
    };
    expect(row("a1").waitingFor).toEqual(["Ana", "Cy"]);
    expect(consequenceOf(row("a1"), 4)).toBe("waits for Ana or Cy");
    expect(consequenceOf(row("a2"), null)).toBe("your 4 grants it");
    expect(consequenceOf(row("a2"), 5)).toBe("your 5 grants it");
    expect(consequenceOf(row("a2"), 3)).toBe("a 3 is a voice, not a vote");
    expect(row("a3").waitingFor).toEqual(["Ana", "Cy"]);
    expect(consequenceOf(row("a3"), null)).toBe("waits for Ana or Cy");
    expect(consequenceOf(row("a4"), null)).toBe("Cy has the baton; this one is Cy's call");
    expect(consequenceOf(row("a5"), null)).toBeNull();
    // one name left: "waits for Cy"; nobody left: "waits for one more"
    expect(row("a1", "ana").waitingFor).toEqual(["Bo", "Cy"]);
    expect(consequenceOf({ ...row("a3"), waitingFor: ["Cy"] }, null)).toBe("waits for Cy");
    expect(consequenceOf({ ...row("a3"), waitingFor: [] }, null)).toBe("waits for one more");
  });

  it("names the rating and moves the cursor", () => {
    expect(ratingWord(null)).toEqual({ word: "Rate", tone: "" });
    expect(ratingWord(3)).toEqual({ word: "A voice", tone: "mid" });
    expect(ratingWord(4)).toEqual({ word: "Good", tone: "high" });
    expect(ratingWord(1)).toEqual({ word: "Not this", tone: "low" });
    expect(moveCursor(["a", "b"], null, 1)).toBe("a");
    expect(moveCursor(["a", "b"], "a", 1)).toBe("b");
    expect(moveCursor(["a", "b"], "b", 1)).toBe("b");
    expect(moveCursor(["a", "b"], "a", -1)).toBe("a");
    expect(moveCursor([], "a", 1)).toBeNull();
  });
});
