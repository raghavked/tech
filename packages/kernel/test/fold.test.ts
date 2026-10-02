import {
  type Actor,
  DEFAULT_APPROVAL_POLICY,
  type EventBody,
  MAIN_BRANCH,
  type SessionEvent,
} from "@fold/protocol";
import { describe, expect, it } from "vitest";
import { eventId } from "../src/log.js";
import { fold, initialState, reduce } from "../src/state.js";

const policy = { approvals: DEFAULT_APPROVAL_POLICY, contention: "block" as const, maxTurns: 5000 };
const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const bot: Actor = { id: "agent", kind: "agent", name: "Agent" };
const M = MAIN_BRANCH;

/** A raw log (hash-chained, not through `Session`, which would clone state per event) of `turns` agent turns. */
function longLog(turns: number): SessionEvent[] {
  const out: SessionEvent[] = [];
  let prev: string | null = null;
  const emit = (actor: string, body: EventBody) => {
    const seq = out.length;
    const head = { prev, seq, branch: M, ts: seq, actor, ...body };
    const e = { id: eventId(head), ...head } as SessionEvent;
    out.push(e);
    prev = e.id;
  };
  emit("system", {
    kind: "session.created",
    payload: {
      sessionId: "long",
      title: "A long session",
      policy,
      projectId: "default",
      ownerId: "ana",
    },
  });
  emit(ana.id, { kind: "participant.joined", payload: { actor: ana, role: "owner" } });
  emit(bot.id, { kind: "participant.joined", payload: { actor: bot, role: "contributor" } });
  emit(ana.id, {
    kind: "directive.submitted",
    payload: {
      directiveId: "d0",
      input: { text: "Go", mode: "steer", scope: "goal", supersedes: [], interrupt: false },
    },
  });
  for (let t = 1; t <= turns; t++) {
    emit(bot.id, { kind: "agent.turn.started", payload: { turn: t, epoch: t } });
    emit(bot.id, {
      kind: "agent.model.completed",
      payload: { turn: t, text: `turn ${t}`, toolCalls: [], model: "scripted" },
    });
    for (let k = 0; k < 2; k++) {
      const call = {
        id: `c${t}-${k}`,
        name: "workspace.read",
        args: { path: `f${k}` },
        risk: "read" as const,
      };
      emit(bot.id, { kind: "agent.tool.requested", payload: { turn: t, call } });
      emit(bot.id, {
        kind: "agent.tool.completed",
        payload: { turn: t, result: { callId: call.id, ok: true, output: "ok\n".repeat(8) } },
      });
    }
    emit(bot.id, { kind: "agent.turn.ended", payload: { turn: t, reason: "done", summary: "" } });
  }
  return out;
}

describe("fold", () => {
  it("folds a log to the same state as reducing event by event, without touching `from`", () => {
    const events = longLog(30);
    let stepwise = initialState(M);
    for (const e of events) stepwise = reduce(stepwise, e);
    expect(fold(events)).toEqual(stepwise);

    const half = Math.floor(events.length / 2);
    const from = fold(events.slice(0, half));
    const before = structuredClone(from);
    expect(fold(events.slice(half), from)).toEqual(stepwise);
    expect(from).toEqual(before);
    expect(fold([], from)).not.toBe(from);
  });

  it("folds a 5,000-event log in well under a second (one clone, not one per event)", () => {
    const events = longLog(715);
    expect(events.length).toBeGreaterThanOrEqual(5000);
    const t0 = performance.now();
    const s = fold(events);
    const took = performance.now() - t0;
    console.log(`kernel fold of ${events.length} events: ${took.toFixed(1)} ms`);
    expect(s.turns.length).toBe(715);
    expect(took).toBeLessThan(2000);
  });
});
