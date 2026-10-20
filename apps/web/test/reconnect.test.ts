/**
 * The bad moments' facts: the re-dial the snapshot reports (attempt and when it fires), what
 * this browser keeps of a session for the server-down page, and the host it names.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clockOf,
  hostOf,
  lastSeenKey,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  Reconnector,
  readLastSeen,
  reconnectDelay,
  rememberLastSeen,
} from "../src/reconnect.js";

describe("the re-dial in the snapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The reconnector listens for the browser coming back online and the tab being shown.
    const noop = () => {};
    Object.assign(globalThis, { addEventListener: noop, removeEventListener: noop });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { visibilityState: "visible", addEventListener: noop, removeEventListener: noop },
    });
  });
  afterEach(() => vi.useRealTimers());

  it("backs off 0.5s → 15s with jitter and reports the attempt and the time it fires", () => {
    for (let i = 0; i < 8; i++) {
      const d = reconnectDelay(i);
      const base = Math.min(RECONNECT_BASE_MS * 2 ** i, RECONNECT_MAX_MS);
      expect(d).toBeGreaterThanOrEqual(Math.round(base * 0.75));
      expect(d).toBeLessThanOrEqual(Math.round(base * 1.25));
    }
    const dials: number[] = [];
    const r = new Reconnector(() => dials.push(Date.now()));
    const d1 = r.schedule();
    const p1 = r.pending(d1);
    expect(p1.attempt).toBe(1);
    expect(p1.at).toBe(Date.now() + d1);
    vi.advanceTimersByTime(d1);
    expect(dials).toHaveLength(1);
    const d2 = r.schedule();
    expect(r.pending(d2).attempt).toBe(2);
    // "Try now" dials at once and cancels the scheduled one.
    r.now();
    expect(dials).toHaveLength(2);
    vi.advanceTimersByTime(RECONNECT_MAX_MS);
    expect(dials).toHaveLength(2);
    r.reset();
    expect(r.attempt).toBe(0);
  });

  it("takes the snapshot's delay for the first dial after a drop, then its own ladder", () => {
    const r = new Reconnector(() => {});
    // The server said 4 s: the first dial after this socket drops waits about that long.
    r.hint(4_000);
    const d1 = r.schedule();
    expect(d1).toBeGreaterThanOrEqual(3_000);
    expect(d1).toBeLessThanOrEqual(5_000);
    expect(r.pending(d1).attempt).toBe(1);
    // The hint is used once; the second dial backs off from the client's ladder (1 s ± 25 %).
    const d2 = r.schedule();
    expect(d2).toBeGreaterThanOrEqual(750);
    expect(d2).toBeLessThanOrEqual(1_250);
    // A nonsense hint is ignored.
    r.reset();
    r.hint(Number.NaN);
    expect(r.schedule()).toBeLessThanOrEqual(625);
    r.cancel();
  });

  it("writes a clock time for the stale stamp", () => {
    expect(clockOf(null)).toBeNull();
    const d = new Date(2026, 9, 19, 14, 2);
    expect(clockOf(d.getTime())).toBe("14:02");
  });
});

describe("what this browser last saw", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });

  it("keeps only the time, the status and the turn, per session", () => {
    expect(readLastSeen("p", "s")).toBeNull();
    rememberLastSeen("p", "s", { at: 1_000, status: "running", turn: 3 });
    expect(readLastSeen("p", "s")).toEqual({ at: 1_000, status: "running", turn: 3 });
    expect(readLastSeen("p", "other")).toBeNull();
    expect(JSON.parse(store.get(lastSeenKey("p", "s")) ?? "{}")).not.toHaveProperty("goal");
    store.set(lastSeenKey("p", "bad"), '{"at":"soon"}');
    expect(readLastSeen("p", "bad")).toBeNull();
  });

  it("names the host of the websocket it dials", () => {
    expect(hostOf("wss://henosis.payments.internal/ws")).toBe("henosis.payments.internal");
    expect(hostOf("ws://127.0.0.1:7730/ws")).toBe("127.0.0.1:7730");
    expect(hostOf("nonsense")).toBe("nonsense");
  });
});
