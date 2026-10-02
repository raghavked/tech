import { type Actor, DEFAULT_APPROVAL_POLICY, MAIN_BRANCH } from "@fold/protocol";
import { describe, expect, it } from "vitest";
import { compareBranches, lastTurns } from "../src/compare.js";
import { Session } from "../src/session.js";
import { lineDelta } from "../src/workspace.js";

const policy = { approvals: DEFAULT_APPROVAL_POLICY, contention: "block" as const, maxTurns: 50 };
const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const M = MAIN_BRANCH;

function turn(s: Session, branch: string, n: number, summary: string) {
  s.turnStarted(branch, "agent");
  s.modelCompleted(branch, "agent", `thinking about ${n}`, [], "scripted");
  s.turnEnded(branch, "agent", "done", summary);
}

function setup() {
  const s = Session.create("s1", "Compare me", policy);
  s.join(M, ana, "owner");
  s.writeFile(M, "ana", "a.txt", "one\ntwo\nthree");
  s.writeFile(M, "ana", "same.txt", "untouched");
  s.writeFile(M, "ana", "gone.txt", "bye");
  turn(s, M, 1, "DONE: scaffolded");
  s.fork(M, "ana", "try/idea");
  // main moves on
  s.writeFile(M, "ana", "a.txt", "1\ntwo\nthree\nfour");
  s.deleteFile(M, "ana", "gone.txt");
  turn(s, M, 2, "added four");
  turn(s, M, 3, "polished");
  turn(s, M, 4, "shipped");
  turn(s, M, 5, "DONE: wrapped up");
  // the branch goes its own way
  s.writeFile("try/idea", "ana", "a.txt", "ONE\ntwo\nthree");
  s.writeFile("try/idea", "ana", "new.txt", "x\ny");
  turn(s, "try/idea", 2, "tried the idea");
  return s;
}

describe("lineDelta", () => {
  it("counts added and removed lines", () => {
    expect(lineDelta("a\nb\nc", "a\nB\nc\nd")).toEqual({ plus: 2, minus: 1 });
    expect(lineDelta(null, "x\ny")).toEqual({ plus: 2, minus: 0 });
    expect(lineDelta("x", null)).toEqual({ plus: 0, minus: 1 });
    expect(lineDelta("same", "same")).toEqual({ plus: 0, minus: 0 });
  });
});

describe("compareBranches", () => {
  it("lists only the files that differ, with counts from a to b", () => {
    const s = setup();
    const c = compareBranches(s, M, "try/idea");
    expect(c.a).toBe(M);
    expect(c.b).toBe("try/idea");
    expect(c.files.map((f) => f.path)).toEqual(["a.txt", "gone.txt", "new.txt"]);
    const a = c.files.find((f) => f.path === "a.txt");
    expect(a).toMatchObject({ inA: true, inB: true, plus: 1, minus: 2 });
    expect(c.files.find((f) => f.path === "gone.txt")).toMatchObject({
      inA: false,
      inB: true,
      plus: 1,
      minus: 0,
    });
    expect(c.files.find((f) => f.path === "new.txt")).toMatchObject({
      inA: false,
      inB: true,
      plus: 2,
      minus: 0,
    });
    expect(c.conflicts).toEqual([]);
  });

  it("is symmetric in which side is a", () => {
    const s = setup();
    const ab = compareBranches(s, M, "try/idea");
    const ba = compareBranches(s, "try/idea", M);
    expect(ba.files.map((f) => f.path)).toEqual(ab.files.map((f) => f.path));
    for (const f of ab.files) {
      const r = ba.files.find((g) => g.path === f.path);
      expect(r).toMatchObject({ inA: f.inB, inB: f.inA, plus: f.minus, minus: f.plus });
    }
  });

  it("carries the last three turns of each side, latest last", () => {
    const s = setup();
    const c = compareBranches(s, M, "try/idea");
    expect(c.turns.a.map((t) => t.turn)).toEqual([3, 4, 5]);
    expect(c.turns.a[2]).toMatchObject({ summary: "wrapped up", reason: "done", toolCalls: 0 });
    expect(c.turns.b.map((t) => t.turn)).toEqual([1, 2]);
    expect(c.turns.b[1]?.text).toBe("tried the idea");
  });

  it("includes a turn in progress", () => {
    const s = setup();
    s.turnStarted(M, "agent");
    const t = lastTurns(s.state(M));
    expect(t.map((x) => x.turn)).toEqual([4, 5, 6]);
    expect(t[2]?.reason).toBe("in progress");
  });

  it("reports the conflicts a fold left behind on a", () => {
    const s = setup();
    s.merge(M, "ana", "try/idea");
    const st = s.state(M);
    expect(st.openConflicts).toEqual(["a.txt"]);
    expect(s.readFile(M, "a.txt")).toContain("<<<<<<< ours");
    const c = compareBranches(s, M, "try/idea");
    expect(c.conflicts).toEqual(["a.txt"]);
    // new.txt now matches on both sides; only the conflicted and the deleted file still differ
    expect(c.files.map((f) => f.path)).toEqual(["a.txt", "gone.txt"]);
  });
});
