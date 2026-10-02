import { MAIN_BRANCH } from "@fold/protocol";
import { describe, expect, it } from "vitest";
import { SessionLog } from "../src/log.js";

const policy = { approvals: {}, contention: "block" as const, maxTurns: 10 };

describe("session log", () => {
  it("chains hashes and detects tampering", () => {
    const log = new SessionLog();
    log.append(MAIN_BRANCH, "system", {
      kind: "session.created",
      payload: { sessionId: "s", title: "t", policy },
    });
    const e = log.append(MAIN_BRANCH, "u", { kind: "note.posted", payload: { text: "hi" } });
    log.append(MAIN_BRANCH, "u", { kind: "note.posted", payload: { text: "again" } });
    expect(log.verify()).toEqual({ ok: true });
    expect(e.prev).toBe(log.eventsOf(MAIN_BRANCH)[0]?.id);
    expect(e.seq).toBe(1);

    const data = log.serialize();
    const tampered = structuredClone(data);
    const ev = tampered.events[MAIN_BRANCH]?.[1];
    if (ev && ev.kind === "note.posted") ev.payload.text = "edited";
    const bad = SessionLog.fromSerialized(tampered).verify();
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("bad hash");
  });

  it("forks from checkpoints and inherits history", () => {
    const log = new SessionLog();
    log.append(MAIN_BRANCH, "system", {
      kind: "session.created",
      payload: { sessionId: "s", title: "t", policy },
    });
    const note = log.append(MAIN_BRANCH, "u", { kind: "note.posted", payload: { text: "a" } });
    expect(() => log.fork(MAIN_BRANCH, note.id, "x")).toThrow(/checkpoint/);
    const cp = log.append(MAIN_BRANCH, "u", {
      kind: "checkpoint.created",
      payload: { checkpointId: "cp1", tree: "t", label: "l" },
    });
    log.fork(MAIN_BRANCH, cp.id, "feature");
    log.append(MAIN_BRANCH, "u", { kind: "note.posted", payload: { text: "main only" } });
    const f = log.append("feature", "u", {
      kind: "note.posted",
      payload: { text: "feature only" },
    });
    expect(f.prev).toBe(cp.id);
    expect(f.seq).toBe(cp.seq + 1);
    expect(log.eventsOf("feature").map((e) => e.kind)).toEqual([
      "session.created",
      "note.posted",
      "checkpoint.created",
      "note.posted",
    ]);
    expect(log.eventsOf(MAIN_BRANCH)).toHaveLength(4);
    expect(log.verify()).toEqual({ ok: true });
    const round = SessionLog.fromSerialized(log.serialize());
    expect(round.eventsOf("feature")).toEqual(log.eventsOf("feature"));
    expect(round.verify()).toEqual({ ok: true });
  });
});
