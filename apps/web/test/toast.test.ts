import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearToasts,
  dismissToast,
  getToasts,
  subscribeToasts,
  TOAST_MS,
  toast,
} from "../src/toast.js";

describe("toast store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearToasts();
  });
  afterEach(() => {
    clearToasts();
    vi.useRealTimers();
  });

  it("shows a trimmed text and dismisses it after TOAST_MS", () => {
    const seen: number[] = [];
    const off = subscribeToasts(() => seen.push(getToasts().length));
    const id = toast("  Link copied  ");
    expect(id).toBeGreaterThan(0);
    expect(getToasts().map((t) => t.text)).toEqual(["Link copied"]);
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToasts()).toHaveLength(0);
    expect(seen).toEqual([1, 0]);
    off();
  });

  it("ignores empty text and a text that is already showing", () => {
    expect(toast("   ")).toBe(0);
    const first = toast("Connection lost");
    expect(toast("Connection lost")).toBe(0);
    expect(getToasts()).toHaveLength(1);
    dismissToast(first);
    expect(getToasts()).toHaveLength(0);
    expect(toast("Connection lost")).toBeGreaterThan(first);
  });

  it("keeps at most three and drops the oldest first", () => {
    toast("one");
    toast("two");
    toast("three");
    toast("four");
    expect(getToasts().map((t) => t.text)).toEqual(["two", "three", "four"]);
    vi.advanceTimersByTime(TOAST_MS);
    expect(getToasts()).toHaveLength(0);
  });

  it("returns the same array reference until something changes", () => {
    toast("steady");
    const a = getToasts();
    expect(getToasts()).toBe(a);
    dismissToast(999);
    expect(getToasts()).toBe(a);
    toast("steady");
    expect(getToasts()).toBe(a);
  });

  it("honours a custom duration", () => {
    toast("quick", 100);
    vi.advanceTimersByTime(99);
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToasts()).toHaveLength(0);
  });
});
