import { ROLE_RANK } from "@quorum/protocol";
import { describe, expect, it } from "vitest";
import { type Arbiter, arbitrate, type DirectiveRecord, renderIntent } from "../src/intent.js";

let seq = 0;
function d(
  author: string,
  rank: number,
  text: string,
  o: Partial<{
    scope: string;
    mode: DirectiveRecord["input"]["mode"];
    epoch: number;
    merged: boolean;
    interrupt: boolean;
  }> = {},
): DirectiveRecord {
  seq += 1;
  return {
    id: `d${seq}`,
    author,
    rank,
    epoch: o.epoch ?? 0,
    seq,
    merged: o.merged ?? false,
    status: "active",
    contentionId: null,
    input: {
      text,
      mode: o.mode ?? "steer",
      scope: o.scope ?? "goal",
      supersedes: [],
      interrupt: o.interrupt ?? false,
    },
  };
}

const ctx = (over: Partial<Arbiter> = {}): Arbiter => ({
  rankOf: () => 1,
  driver: "ana",
  policy: "block",
  epoch: 0,
  consumedInterrupts: new Set(),
  ...over,
});

const C = ROLE_RANK.contributor;
const D = ROLE_RANK.driver;
const O = ROLE_RANK.owner;

describe("arbitration rules", () => {
  it("same author: latest supersedes", () => {
    const a = d("ana", D, "build a cli");
    const b = d("ana", D, "build a web app");
    const r = arbitrate([a, b], [], ctx());
    expect(r.intent.goal?.text).toBe("build a web app");
    expect(r.statuses[a.id]).toBe("superseded");
    expect(r.contentions).toHaveLength(0);
  });

  it("higher rank wins regardless of order; lower is shadowed", () => {
    const low = d("bo", C, "use sqlite", { scope: "db", epoch: 3 });
    const high = d("ana", D, "use postgres", { scope: "db", epoch: 1 });
    const r = arbitrate([low, high], [], ctx());
    expect(r.intent.steers.db?.text).toBe("use postgres");
    expect(r.statuses[low.id]).toBe("shadowed");
    expect(r.statuses[high.id]).toBe("active");
  });

  it("same rank, different epochs: later is a redirect", () => {
    const a = d("bo", C, "tests first", { scope: "approach", epoch: 1 });
    const b = d("cy", C, "prototype first", { scope: "approach", epoch: 2 });
    const r = arbitrate([a, b], [], ctx());
    expect(r.intent.steers.approach?.text).toBe("prototype first");
    expect(r.statuses[a.id]).toBe("superseded");
  });

  it("same rank, same epoch: contention blocks the scope", () => {
    const a = d("bo", C, "tests first", { scope: "approach", epoch: 2 });
    const b = d("cy", C, "prototype first", { scope: "approach", epoch: 2 });
    const r = arbitrate([a, b], [], ctx());
    expect(r.intent.steers.approach).toBeUndefined();
    expect(r.intent.contendedScopes).toEqual(["approach"]);
    expect(r.contentions).toHaveLength(1);
    expect(r.contentions[0]?.directiveIds.sort()).toEqual([a.id, b.id].sort());
    expect(r.statuses[a.id]).toBe("contended");
  });

  it("latest-wins and driver-wins policies resolve concurrent peers", () => {
    const a = d("ana", D, "x", { epoch: 2 });
    const b = d("dee", D, "y", { epoch: 2 });
    expect(arbitrate([a, b], [], ctx({ policy: "latest-wins" })).intent.goal?.text).toBe("y");
    expect(
      arbitrate([a, b], [], ctx({ policy: "driver-wins", driver: "ana" })).intent.goal?.text,
    ).toBe("x");
    expect(
      arbitrate([a, b], [], ctx({ policy: "driver-wins", driver: "zed" })).contentions,
    ).toHaveLength(1);
  });

  it("constraints accumulate and never conflict; observers are shadowed", () => {
    const a = d("bo", C, "no network calls", { mode: "constrain", scope: "x" });
    const b = d("cy", C, "keep it under 200 lines", { mode: "constrain", scope: "x" });
    const obs = d("ollie", ROLE_RANK.observer, "do it my way", { scope: "x" });
    const r = arbitrate([a, b, obs], [], ctx());
    expect(r.intent.constraints.map((c) => c.text)).toEqual([
      "no network calls",
      "keep it under 200 lines",
    ]);
    expect(r.statuses[obs.id]).toBe("shadowed");
  });

  it("control: pause by contributor, resume needs driver, steer revives cancel", () => {
    const pause = d("bo", C, "hold on", { mode: "pause" });
    const badResume = d("bo", C, "go", { mode: "resume" });
    let r = arbitrate([pause, badResume], [], ctx());
    expect(r.intent.control).toBe("paused");
    expect(r.statuses[badResume.id]).toBe("shadowed");
    const resume = d("ana", D, "go", { mode: "resume" });
    r = arbitrate([pause, badResume, resume], [], ctx());
    expect(r.intent.control).toBe("running");
    const cancel = d("ana", D, "stop", { mode: "cancel" });
    r = arbitrate([pause, resume, cancel], [], ctx());
    expect(r.intent.control).toBe("cancelled");
    const steer = d("bo", C, "new plan");
    r = arbitrate([pause, resume, cancel, steer], [], ctx());
    expect(r.intent.control).toBe("running");
  });

  it("merged directives are concurrent with everything in their scope", () => {
    const ours = d("ana", D, "rest api", { scope: "api", epoch: 1 });
    const theirs = d("dee", D, "graphql api", { scope: "api", epoch: 5, merged: true });
    const r = arbitrate([ours, theirs], [], ctx());
    expect(r.intent.contendedScopes).toEqual(["api"]);
  });

  it("interrupt flag clears once consumed", () => {
    const a = d("ana", D, "stop and refactor", { interrupt: true });
    expect(arbitrate([a], [], ctx()).intent.interrupt).toBe(true);
    expect(arbitrate([a], [], ctx({ consumedInterrupts: new Set([a.id]) })).intent.interrupt).toBe(
      false,
    );
  });

  it("renders the intent for the model", () => {
    const r = arbitrate(
      [
        d("ana", D, "ship it"),
        d("bo", C, "tests", { scope: "qa" }),
        d("bo", C, "no deps", { mode: "constrain" }),
      ],
      [],
      ctx(),
    );
    const text = renderIntent(r.intent);
    expect(text).toContain("GOAL: ship it");
    expect(text).toContain("[qa] tests");
    expect(text).toContain("- no deps");
  });
});

/** Deterministic PRNG for the property test. */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Interleave per-author streams randomly while preserving each author's own order. */
function interleave(streams: DirectiveRecord[][], rnd: () => number): DirectiveRecord[] {
  const idx = streams.map(() => 0);
  const out: DirectiveRecord[] = [];
  const total = streams.reduce((n, s) => n + s.length, 0);
  let s = 0;
  while (out.length < total) {
    const live = streams
      .map((_st, i) => i)
      .filter((i) => (idx[i] as number) < (streams[i] as DirectiveRecord[]).length);
    const pick = live[Math.floor(rnd() * live.length)] as number;
    const rec = (streams[pick] as DirectiveRecord[])[idx[pick] as number] as DirectiveRecord;
    idx[pick] = (idx[pick] as number) + 1;
    s += 1;
    out.push({ ...rec, seq: s });
  }
  return out;
}

describe("order independence within an epoch", () => {
  it("composed intent and contentions do not depend on arrival order of different authors", () => {
    const rnd = mulberry32(42);
    const scopes = ["goal", "api", "db", "tests"];
    const authors: [string, number][] = [
      ["ana", O],
      ["bo", C],
      ["cy", C],
      ["dee", D],
      ["eve", C],
    ];
    for (let trial = 0; trial < 300; trial++) {
      const streams = authors.map(([name, rank]) => {
        const n = Math.floor(rnd() * 3);
        const arr: DirectiveRecord[] = [];
        for (let k = 0; k < n; k++) {
          const modeRoll = rnd();
          const mode = modeRoll < 0.7 ? "steer" : modeRoll < 0.9 ? "constrain" : "pause";
          arr.push(
            d(name, rank, `${name}-${trial}-${k}`, {
              scope: scopes[Math.floor(rnd() * scopes.length)] as string,
              mode,
              epoch: 7,
            }),
          );
        }
        return arr;
      });
      const orderA = interleave(streams, rnd);
      const orderB = interleave(streams, rnd);
      const ra = arbitrate(orderA, [], ctx({ driver: "dee" }));
      const rb = arbitrate(orderB, [], ctx({ driver: "dee" }));
      const norm = (r: ReturnType<typeof arbitrate>) => ({
        goal: r.intent.goal?.text ?? null,
        steers: Object.fromEntries(Object.entries(r.intent.steers).map(([k, v]) => [k, v.text])),
        constraints: [...r.intent.constraints.map((c) => c.text)].sort(),
        control: r.intent.control,
        contended: r.intent.contendedScopes,
        contentions: r.contentions
          .map((c) => `${c.scope}:${[...c.directiveIds].sort().join(",")}`)
          .sort(),
        statuses: Object.fromEntries(
          Object.entries(r.statuses).filter(
            ([id]) => orderA.find((x) => x.id === id)?.input.mode !== "steer" || true,
          ),
        ),
      });
      expect(norm(ra)).toEqual(norm(rb));
    }
  });
});
