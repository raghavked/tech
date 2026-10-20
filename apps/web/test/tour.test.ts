/**
 * The tour's geometry and store, without a DOM: where a coach mark sits for a target, the four
 * rectangles of the dim around the lit hole, and when the tour shows.
 */
import { fold } from "@henosis/kernel";
import { DEFAULT_SESSION_POLICY } from "@henosis/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import {
  COACH_GAP,
  COACH_W,
  dimRects,
  finishTour,
  HOLE_PAD,
  placeCoach,
  requestTour,
  requestTourIfNew,
  TOUR_KEY,
  tourPending,
  tourState,
  tourStepsFor,
} from "../src/tour.js";

const viewport = { width: 1440, height: 900 };
const coach = { width: COACH_W, height: 220 };

describe("placing a coach mark", () => {
  it("sits to the right of the rail with a left caret, 24 px down from its top", () => {
    const rail = { left: 0, top: 0, width: 248, height: 900 };
    expect(placeCoach(rail, viewport, "right", coach)).toEqual({
      left: 248 + COACH_GAP,
      top: 24,
      caret: "left",
    });
  });

  it("hangs under a stream card with an up caret, and flips above when the card is low", () => {
    const card = { left: 400, top: 300, width: 600, height: 120 };
    expect(placeCoach(card, viewport, "below", coach)).toEqual({
      left: 400,
      top: 300 + 120 + COACH_GAP,
      caret: "up",
    });
    const low = { left: 400, top: 760, width: 600, height: 120 };
    expect(placeCoach(low, viewport, "below", coach)).toEqual({
      left: 400,
      top: 760 - 220 - COACH_GAP,
      caret: "down",
    });
  });

  it("sits above the composer with a down caret and never leaves the viewport", () => {
    const composer = { left: 400, top: 780, width: 600, height: 110 };
    expect(placeCoach(composer, viewport, "above", coach)).toEqual({
      left: 400,
      top: 780 - 220 - COACH_GAP,
      caret: "down",
    });
    // A target at the right edge: the mark is clamped 16 px in from the edge.
    const edge = { left: 1300, top: 300, width: 200, height: 60 };
    expect(placeCoach(edge, viewport, "below", coach).left).toBe(1440 - COACH_W - 16);
  });

  it("is centred with no caret when the target is not on the page", () => {
    expect(placeCoach(null, viewport, "below", coach)).toEqual({
      left: (1440 - COACH_W) / 2,
      top: (900 - 220) / 2,
      caret: "none",
    });
  });
});

describe("the dim around the lit hole", () => {
  it("leaves the target clear, padded, and covers everything else in four rectangles", () => {
    const hole = { left: 100, top: 200, width: 300, height: 100 };
    const rects = dimRects(hole, viewport);
    expect(rects).toHaveLength(4);
    const [top, bottom, left, right] = rects;
    expect(top).toEqual({ left: 0, top: 0, width: 1440, height: 200 - HOLE_PAD });
    expect(bottom).toEqual({
      left: 0,
      top: 300 + HOLE_PAD,
      width: 1440,
      height: 900 - 300 - HOLE_PAD,
    });
    expect(left).toEqual({
      left: 0,
      top: 200 - HOLE_PAD,
      width: 100 - HOLE_PAD,
      height: 100 + 2 * HOLE_PAD,
    });
    expect(right).toEqual({
      left: 400 + HOLE_PAD,
      top: 200 - HOLE_PAD,
      width: 1440 - 400 - HOLE_PAD,
      height: 100 + 2 * HOLE_PAD,
    });
    // The covered area plus the hole is the whole viewport.
    const covered = rects.reduce((n, r) => n + r.width * r.height, 0);
    expect(covered + (300 + 2 * HOLE_PAD) * (100 + 2 * HOLE_PAD)).toBe(1440 * 900);
  });

  it("is one whole-screen rectangle without a target", () => {
    expect(dimRects(null, viewport)).toEqual([{ left: 0, top: 0, width: 1440, height: 900 }]);
  });
});

describe("the five, in order, reading the policy", () => {
  it("walks rail → stream → plan → gate → composer and says what this session does", () => {
    const s = {
      ...fold([]),
      policy: { ...DEFAULT_SESSION_POLICY, planFirst: true, planApproval: { min: 2, average: 4 } },
    };
    const steps = tourStepsFor(s);
    expect(steps.map((x) => x.id)).toEqual(["rail", "stream", "plan", "gate", "composer"]);
    expect(steps[2]?.body).toContain("2 ratings at 4 or above open it");
    expect(steps[3]?.body).toContain("An approve without a pick sends 4.");
    expect(steps[4]?.next).toBeNull();
    const off = tourStepsFor(fold([]));
    expect(off[2]?.body).toContain("This session goes straight to work");
  });
});

describe("when the tour shows", () => {
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

  it("is asked for once by the first run, again from Settings, and done after either end", () => {
    expect(tourState()).toBeNull();
    expect(tourPending()).toBe(false);
    requestTourIfNew();
    expect(tourPending()).toBe(true);
    finishTour();
    expect(tourState()).toBe("done");
    expect(store.get(TOUR_KEY)).toBe("done");
    // A browser that has done it is not asked again by the first run, only by Settings.
    requestTourIfNew();
    expect(tourPending()).toBe(false);
    requestTour();
    expect(tourPending()).toBe(true);
  });
});
