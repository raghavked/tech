/**
 * The glance's pure half (widgets): the figures a widget shows, the over-budget rule, the
 * quorum's segments, the one needs-you state, and the pause's wording.
 */
import { DEFAULT_RATING, type GlanceGate, type GlanceReport } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import {
  approveLabel,
  gateLine,
  glanceLine,
  outcomeText,
  pauseText,
  segmentsOf,
  tokensLine,
  usedToday,
  widgetState,
} from "./glance.js";
import { isNotifyPaused, pauseEndOf, pauseNotifications, resumeNotifications } from "./prefs.js";

const gate: GlanceGate = {
  projectId: "billing",
  sessionId: "s1",
  title: "Invoice PDF",
  owner: "Ana",
  approvalId: "a1",
  call: { name: "deploy", risk: "irreversible" },
  rule: "2 contributors or above rating it 4+ of 5",
  ratings: true,
  votes: 1,
  needed: 2,
  average: 4,
  bar: 4,
};

const report: GlanceReport = {
  user: { id: "bo", name: "Bo" },
  needsYou: 2,
  approvals: 2,
  handoffs: 0,
  topGate: gate,
  agents: { open: 4, running: 3, awaitingApproval: 1, blocked: 0 },
  tokensToday: { input: 100_000, output: 42_600, cacheRead: 900_000, cacheWrite: 0 },
  day: "2026-10-20",
};

describe("the tokens widget", () => {
  it("counts input and output only; the cache never moves the bar", () => {
    expect(usedToday(report)).toBe(142_600);
  });

  it("says the figure, what is left of the budget, and the meter's fill", () => {
    const t = tokensLine(142_600, 200_000);
    expect(t.figure).toBe("143k");
    expect(t.detail).toBe("of 200k · 57.4k left");
    expect(t.fraction).toBeCloseTo(0.713, 3);
    expect(t.over).toBe(false);
    expect(t.foot).toBeNull();
  });

  it("over budget: the line turns red, says only that, and 'nothing stops' moves to the foot", () => {
    const t = tokensLine(214_000, 200_000);
    expect(t.over).toBe(true);
    expect(t.detail).toBe("Over the budget");
    expect(t.detail).not.toContain("nothing stops");
    expect(t.foot).toBe("nothing stops");
    expect(t.fraction).toBe(1);
  });

  it("with no budget there is no meter and no guess", () => {
    const t = tokensLine(12_400, null);
    expect(t.figure).toBe("12.4k");
    expect(t.detail).toBe("no budget set");
    expect(t.fraction).toBeNull();
    expect(t.foot).toBeNull();
  });
});

describe("the needs-you row", () => {
  it("reads who's agent · session, wants to, and the call", () => {
    expect(gateLine(gate)).toEqual({ who: "Ana's agent", session: "Invoice PDF", call: "deploy" });
  });

  it("fills the segments a vote counts for and outlines the next one", () => {
    expect(segmentsOf(1, 2)).toEqual(["on", "next"]);
    expect(segmentsOf(0, 2)).toEqual(["next", ""]);
    expect(segmentsOf(2, 2)).toEqual(["on", "on"]);
    expect(segmentsOf(0, 0)).toEqual([]);
  });

  it("the Approve button sends the default rating under a release gate and nothing elsewhere", () => {
    expect(approveLabel(gate, DEFAULT_RATING)).toBe("Approve · 4");
    expect(approveLabel({ ...gate, ratings: false, call: { name: "run", risk: "exec" } }, 4)).toBe(
      "Approve",
    );
  });

  it("says what the ballot did", () => {
    expect(outcomeText({ outcome: "granted", rating: 4, votes: 2, needed: 2 })).toBe(
      "Your 4 granted it",
    );
    expect(outcomeText({ outcome: "granted", rating: null, votes: 1, needed: 1 })).toBe(
      "Your approve granted it",
    );
    expect(outcomeText({ outcome: "pending", rating: 4, votes: 1, needed: 2 })).toBe(
      "Your 4 is in · 1 of 2",
    );
    expect(outcomeText({ outcome: "denied", rating: null, votes: 0, needed: 2 })).toBe(
      "Your deny stopped it",
    );
  });
});

describe("the one state and the lock screen", () => {
  it("is paused first, stale before a guess, empty at zero, live otherwise", () => {
    expect(widgetState({ report, stale: false, paused: true })).toBe("paused");
    expect(widgetState({ report, stale: true, paused: false })).toBe("stale");
    expect(widgetState({ report: null, stale: false, paused: false })).toBe("stale");
    expect(widgetState({ report: { ...report, needsYou: 0 }, stale: false, paused: false })).toBe(
      "empty",
    );
    expect(widgetState({ report, stale: false, paused: false })).toBe("live");
  });

  it("the lock-screen line is approvals · running · tokens", () => {
    expect(glanceLine(report)).toBe("2 approvals · 3 running · 143k");
    expect(glanceLine({ ...report, approvals: 1, agents: { ...report.agents, running: 0 } })).toBe(
      "1 approval · 0 running · 143k",
    );
  });
});

describe("pause notifications", () => {
  const noon = new Date(2026, 9, 20, 12, 0, 0).getTime();

  it("ends an hour on, at the next midnight, or never", () => {
    expect(pauseEndOf("hour", noon)).toBe(noon + 3_600_000);
    expect(new Date(pauseEndOf("tomorrow", noon)).getHours()).toBe(0);
    expect(pauseEndOf("tomorrow", noon) - noon).toBe(12 * 3_600_000);
    expect(pauseEndOf("always", noon)).toBe(Number.POSITIVE_INFINITY);
  });

  it("reads as until a time, until tomorrow, or until you say", () => {
    expect(pauseText(pauseEndOf("hour", noon), noon)).toMatch(/^until \d{1,2}:\d{2}/);
    expect(pauseText(pauseEndOf("tomorrow", noon), noon)).toBe("until tomorrow");
    expect(pauseText(pauseEndOf("always", noon), noon)).toBe("until you say");
  });

  it("holds every kind back but a mention, and lapses on its own", () => {
    pauseNotifications("hour", noon);
    expect(isNotifyPaused("approval", noon + 1000)).toBe(true);
    expect(isNotifyPaused(undefined, noon + 1000)).toBe(true);
    expect(isNotifyPaused("mention", noon + 1000)).toBe(false);
    expect(isNotifyPaused("approval", noon + 3_600_001)).toBe(false);
    pauseNotifications("always", noon);
    expect(isNotifyPaused("approval", noon + 365 * 86_400_000)).toBe(true);
    resumeNotifications();
    expect(isNotifyPaused("approval", noon)).toBe(false);
  });
});
