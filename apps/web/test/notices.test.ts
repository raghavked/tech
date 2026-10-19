import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearNotices,
  decisionNotice,
  dismissNotice,
  getNotices,
  isPaused,
  MAX_SHOWN,
  NOTICE_MS,
  type Notice,
  notice,
  pauseNotice,
  resumeNotice,
  setNoticeOutcome,
  shownNotices,
  subscribeNotices,
} from "../src/toast.js";

const base = (id: string, patch: Partial<Notice> = {}): Notice => ({
  id,
  kind: "mention",
  who: "Cy",
  verb: "mentioned you in",
  what: "#billing",
  where: "#billing",
  route: "#/c/default/grp_1",
  sticky: false,
  at: Number(id.replace(/\D/g, "")) || 1,
  ...patch,
});

describe("typed notices", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearNotices();
  });
  afterEach(() => {
    clearNotices();
    vi.useRealTimers();
  });

  it("drains news over NOTICE_MS and keeps a decision until it is answered", () => {
    const seen: number[] = [];
    const off = subscribeNotices(() => seen.push(getNotices().length));
    notice(base("n1"));
    notice(base("n2", { kind: "approval", sticky: true, at: 2 }));
    expect(getNotices().map((n) => n.id)).toEqual(["n1", "n2"]);
    vi.advanceTimersByTime(NOTICE_MS - 1);
    expect(getNotices()).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(getNotices().map((n) => n.id)).toEqual(["n2"]);
    vi.advanceTimersByTime(NOTICE_MS * 10);
    expect(getNotices().map((n) => n.id)).toEqual(["n2"]);
    expect(decisionNotice()?.id).toBe("n2");
    dismissNotice("n2");
    expect(getNotices()).toEqual([]);
    expect(seen).toEqual([1, 2, 1, 0]);
    off();
  });

  it("replaces a repeat with the same id in place rather than stacking", () => {
    notice(base("n1", { what: "#billing" }));
    notice(base("n3", { at: 3 }));
    notice(base("n1", { what: "#payments" }));
    expect(getNotices().map((n) => `${n.id}:${n.what}`)).toEqual(["n1:#payments", "n3:#billing"]);
  });

  it("shows three and folds the rest into the tail, decisions outranking news", () => {
    notice(base("n1", { at: 1 }));
    notice(base("n2", { at: 2 }));
    notice(base("n3", { at: 3 }));
    notice(base("n4", { at: 4 }));
    const { shown, tail } = shownNotices();
    expect(shown.map((n) => n.id)).toEqual(["n2", "n3", "n4"]);
    expect(tail).toBe(1);
    expect(shown).toHaveLength(MAX_SHOWN);
    notice(base("d1", { kind: "approval", sticky: true, at: 0 }));
    const next = shownNotices();
    expect(next.shown.map((n) => n.id)).toEqual(["n3", "n4", "d1"]);
    expect(next.tail).toBe(2);
  });

  it("pauses the life line on hover and resumes the rest of it", () => {
    notice(base("n1"));
    vi.advanceTimersByTime(NOTICE_MS / 2);
    pauseNotice("n1");
    expect(isPaused("n1")).toBe(true);
    vi.advanceTimersByTime(NOTICE_MS * 2);
    expect(getNotices()).toHaveLength(1);
    resumeNotice("n1");
    expect(isPaused("n1")).toBe(false);
    vi.advanceTimersByTime(NOTICE_MS / 2 - 1);
    expect(getNotices()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getNotices()).toHaveLength(0);
  });

  it("carries the outcome of pressing it, and y/n skip a notice that is already answered", () => {
    notice(base("d1", { kind: "handoff", sticky: true, at: 1 }));
    notice(base("d2", { kind: "approval", sticky: true, at: 2 }));
    setNoticeOutcome("d2", { busy: true });
    expect(getNotices().find((n) => n.id === "d2")?.outcome).toEqual({ busy: true });
    expect(decisionNotice()?.id).toBe("d1");
    setNoticeOutcome("d2", undefined);
    expect(getNotices().find((n) => n.id === "d2")?.outcome).toBeUndefined();
    expect(decisionNotice()?.id).toBe("d2");
  });
});
