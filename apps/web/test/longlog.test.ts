/**
 * Long sessions: the stream folds incrementally and windows the column.
 *
 * A synthetic 5,000-event session (directives, agent turns with tool calls, notes, approvals,
 * handoffs) checks that the incremental folder produces exactly what a whole-log fold does, and
 * prints how the costs compare: refolding the history on every event (what the stream did) vs
 * folding only the new event, and how many rows a window of a 5,000-block column mounts.
 */
import { eventId, fold, reduce } from "@henosis/kernel";
import { MAIN_BRANCH, type SessionEvent, SessionPolicy } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import { BlockFolder, blocksOf, estimateHeight } from "../src/stream/blocks.js";
import { atBottom, bottomOf, layoutOf, rangeOf, rowAt } from "../src/stream/window.js";

const N = 5000;
const ANA = { id: "ana", kind: "human" as const, name: "Ana" };
const BO = { id: "bo", kind: "human" as const, name: "Bo" };
const AGENT = { id: "agent", kind: "agent" as const, name: "Agent" };

type Body =
  Extract<SessionEvent, { kind: string }> extends infer E
    ? E extends { kind: infer K; payload: infer P }
      ? { kind: K; payload: P }
      : never
    : never;

/** A plausible session log of `n` events: one goal, then turns of model text and tool calls. */
function syntheticLog(n: number): SessionEvent[] {
  const out: SessionEvent[] = [];
  let prev: string | null = null;
  const emit = (actor: string, body: Body) => {
    const seq = out.length;
    const head = { prev, seq, branch: MAIN_BRANCH, ts: seq, actor, ...body };
    const e = { id: eventId(head), ...head } as SessionEvent;
    out.push(e);
    prev = e.id;
    return e;
  };
  emit("system", {
    kind: "session.created",
    payload: {
      sessionId: "long",
      title: "A long session",
      policy: SessionPolicy.parse({}),
      projectId: "default",
      ownerId: "ana",
    },
  });
  emit(ANA.id, { kind: "participant.joined", payload: { actor: ANA, role: "owner" } });
  emit(BO.id, { kind: "participant.joined", payload: { actor: BO, role: "contributor" } });
  emit(AGENT.id, { kind: "participant.joined", payload: { actor: AGENT, role: "contributor" } });
  emit(ANA.id, {
    kind: "directive.submitted",
    payload: {
      directiveId: "d0",
      input: {
        text: "Migrate billing to v2",
        mode: "steer",
        scope: "goal",
        supersedes: [],
        interrupt: false,
      },
    },
  });
  let turn = 0;
  let call = 0;
  while (out.length < n) {
    turn += 1;
    emit(AGENT.id, { kind: "agent.turn.started", payload: { turn, epoch: turn } });
    emit(AGENT.id, {
      kind: "agent.model.completed",
      payload: {
        turn,
        text: `Turn ${turn}: reading the invoice module, then running the tests again. `.repeat(
          1 + (turn % 3),
        ),
        toolCalls: [],
        model: "scripted",
      },
    });
    for (let k = 0; k < 2 + (turn % 3); k++) {
      call += 1;
      const id = `c${call}`;
      const name = k % 2 === 0 ? "workspace.read" : "shell.run";
      const args =
        k % 2 === 0 ? { path: `src/billing/${k}.ts` } : { command: "pnpm", args: ["vitest"] };
      emit(AGENT.id, {
        kind: "agent.tool.requested",
        payload: { turn, call: { id, name, args, risk: k % 2 === 0 ? "read" : "exec" } },
      });
      emit(AGENT.id, {
        kind: "agent.tool.completed",
        payload: {
          turn,
          result: { callId: id, ok: k !== 3, output: `output of ${id}\n`.repeat(4) },
        },
      });
    }
    if (turn % 7 === 0)
      emit(BO.id, { kind: "note.posted", payload: { text: `Note from Bo after turn ${turn}` } });
    if (turn % 11 === 0)
      emit(BO.id, {
        kind: "directive.submitted",
        payload: {
          directiveId: `d${turn}`,
          input: {
            text: `Keep the API stable (turn ${turn})`,
            mode: "constrain",
            scope: "api",
            supersedes: [],
            interrupt: false,
          },
        },
      });
    if (turn % 13 === 0)
      emit(AGENT.id, {
        kind: "approval.requested",
        payload: {
          approvalId: `a${turn}`,
          call: { id: `c-a${turn}`, name: "deploy", args: { env: "staging" }, risk: "external" },
        },
      });
    if (turn % 17 === 0)
      emit(ANA.id, { kind: "handoff.requested", payload: { handoffId: `h${turn}`, to: "bo" } });
    emit(AGENT.id, {
      kind: "agent.turn.ended",
      payload: { turn, reason: turn % 19 === 0 ? "blocked" : "done", summary: "" },
    });
  }
  return out.slice(0, n);
}

const ms = (t: number) => `${t.toFixed(2)} ms`;
const us = (t: number) => `${(t * 1000).toFixed(1)} µs`;

const events = syntheticLog(N);
const state = fold(events);

describe("long-log: incremental folding", () => {
  it("the incremental folder matches a whole-log fold, event by event", () => {
    const whole = blocksOf(events, state, "ana");
    const f = new BlockFolder();
    const seen: SessionEvent[] = [];
    let versions = 0;
    for (const e of events) {
      seen.push(e);
      const before = f.version;
      f.sync(seen, state, "ana");
      if (f.version !== before) versions += 1;
    }
    expect(f.count).toBe(N);
    expect(f.blocks).toEqual(whole);
    expect(versions).toBeGreaterThan(0);
    // A new log (a reconnect gives fresh objects) starts over instead of appending.
    const again = syntheticLog(40);
    f.sync(again, fold(again), "ana");
    expect(f.count).toBe(40);
    expect(f.blocks).toEqual(blocksOf(again, fold(again), "ana"));
  });

  it("a completed tool step replaces its block object, leaving the others untouched", () => {
    const f = new BlockFolder();
    const idx = events.findIndex((e) => e.kind === "agent.tool.completed");
    f.sync(events.slice(0, idx), state, "ana");
    const before = [...f.blocks];
    f.sync(events.slice(0, idx + 1), state, "ana");
    const changed = f.blocks.filter((b, i) => b !== before[i]);
    expect(changed).toHaveLength(1);
    expect(changed[0]?.kind).toBe("agent");
  });

  it("measures: refold-everything vs one event, kernel fold vs reduce", () => {
    const t0 = performance.now();
    blocksOf(events, state, "ana");
    const whole = performance.now() - t0;

    const f = new BlockFolder();
    f.sync(events.slice(0, N - 1), state, "ana");
    const t1 = performance.now();
    f.sync(events, state, "ana");
    const one = performance.now() - t1;

    // Simulate the whole session arriving live: every event folded on arrival.
    const live = new BlockFolder();
    const growing: SessionEvent[] = [];
    const t2 = performance.now();
    for (const e of events) {
      growing.push(e);
      live.sync(growing, state, "ana");
    }
    const liveTotal = performance.now() - t2;

    // What the stream used to do on each arrival, sampled at 500-event steps.
    let quadratic = 0;
    for (let k = 500; k <= N; k += 500) {
      const ta = performance.now();
      blocksOf(events.slice(0, k), state, "ana");
      quadratic += (performance.now() - ta) * 500;
    }

    const t3 = performance.now();
    const full = fold(events);
    const kernelWhole = performance.now() - t3;
    const last = events[N - 1];
    if (!last) throw new Error("empty log");
    const t4 = performance.now();
    reduce(full, last);
    const kernelOne = performance.now() - t4;

    console.log(
      [
        `long-log (${N} events, ${f.blocks.length} blocks):`,
        `  blocks, whole log once:            ${ms(whole)}`,
        `  blocks, one more event (sync):     ${us(one)}`,
        `  blocks, all ${N} arriving live:   ${ms(liveTotal)} total, ${us(liveTotal / N)} per event`,
        `  blocks, refold on every arrival:   ~${ms(quadratic)} total (sampled every 500 events)`,
        `  kernel fold, whole log:            ${ms(kernelWhole)}`,
        `  kernel reduce, one event:          ${ms(kernelOne)}`,
      ].join("\n"),
    );
    expect(one).toBeLessThan(whole);
    expect(liveTotal).toBeLessThan(quadratic);
  });
});

describe("long-log: windowing", () => {
  const blocks = blocksOf(events, state, "ana");

  it("mounts only the rows near the viewport, at the top, in the middle and at the end", () => {
    const t0 = performance.now();
    const layout = layoutOf(blocks.length, (i) => {
      const b = blocks[i];
      return b ? estimateHeight(b) + 28 : 0;
    });
    const layoutMs = performance.now() - t0;
    const view = 900;
    const overscan = 600;
    const samples = [0, layout.total / 2, bottomOf(layout, view)];
    const mounted = samples.map((top) => {
      const r = rangeOf(layout, top, view, overscan);
      return r.end - r.start;
    });
    const t1 = performance.now();
    for (let i = 0; i < 10_000; i++) rangeOf(layout, (i * 97) % layout.total, view, overscan);
    const rangeUs = ((performance.now() - t1) / 10_000) * 1000;
    console.log(
      [
        `window (${blocks.length} blocks, ${Math.round(layout.total / 1000)}k px tall, ${view}px viewport, ${overscan}px overscan):`,
        `  layout (prefix sums):              ${ms(layoutMs)}`,
        `  rangeOf (binary search):           ${rangeUs.toFixed(2)} µs`,
        `  rows mounted top/middle/end:       ${mounted.join(" / ")} of ${blocks.length}`,
      ].join("\n"),
    );
    for (const m of mounted) {
      expect(m).toBeGreaterThan(0);
      expect(m).toBeLessThan(blocks.length / 10);
    }
    const end = rangeOf(layout, bottomOf(layout, view), view, overscan);
    expect(end.end).toBe(blocks.length);
    expect(atBottom(layout, bottomOf(layout, view), view)).toBe(true);
    expect(atBottom(layout, 0, view)).toBe(false);
    expect(rowAt(layout, -10)).toBe(0);
    expect(rowAt(layout, layout.total + 10)).toBe(blocks.length - 1);
  });

  it("covers the viewport exactly: every row touching it is in the range", () => {
    const layout = layoutOf(200, (i) => 10 + (i % 7) * 9);
    for (let top = 0; top < layout.total; top += 37) {
      const r = rangeOf(layout, top, 300, 0);
      for (let i = 0; i < 200; i++) {
        const rowTop = layout.tops[i] ?? 0;
        const rowBottom = i + 1 < 200 ? (layout.tops[i + 1] ?? 0) : layout.total;
        const touches = rowBottom > top && rowTop < top + 300;
        if (touches) {
          expect(i).toBeGreaterThanOrEqual(r.start);
          expect(i).toBeLessThan(r.end);
        }
      }
    }
  });
});
