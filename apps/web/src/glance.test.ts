import type { GlanceReport } from "@henosis/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  approvalsSubtitle,
  foldedSentence,
  needsYouOf,
  refreshGlance,
  resetGlance,
  tabOf,
} from "./glance.js";
import { parseHash } from "./router.js";

const report = (needsYou: number): GlanceReport => ({
  user: { id: "ana", name: "Ana" },
  needsYou,
  approvals: needsYou,
  handoffs: 0,
  topGate: null,
  agents: { open: 2, running: 1, awaitingApproval: 1, blocked: 0 },
  tokensToday: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  day: "2026-10-20",
});

describe("the one needs-you number", () => {
  afterEach(() => {
    resetGlance();
    vi.restoreAllMocks();
  });

  it("is unknown until the server has answered once, then the glance's figure", () => {
    expect(needsYouOf({ report: null })).toBeNull();
    expect(needsYouOf({ report: report(3) })).toBe(3);
    expect(needsYouOf({ report: report(0) })).toBe(0);
  });

  it("refreshing without a person is a no-op (nothing is fetched)", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    refreshGlance();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("the four tabs", () => {
  it("put every route under Sessions except chats, approvals and me", () => {
    expect(tabOf(parseHash("#/"))).toBe("sessions");
    expect(tabOf(parseHash("#/p/billing"))).toBe("sessions");
    expect(tabOf(parseHash("#/p/billing/s/invoice"))).toBe("sessions");
    expect(tabOf(parseHash("#/inbox"))).toBe("sessions");
    expect(tabOf(parseHash("#/memory/default"))).toBe("sessions");
    expect(tabOf(parseHash("#/m/default"))).toBe("sessions");
    expect(tabOf(parseHash("#/c/default"))).toBe("chats");
    expect(tabOf(parseHash("#/c/default/billing"))).toBe("chats");
    expect(tabOf(parseHash("#/approvals"))).toBe("approvals");
    expect(tabOf(parseHash("#/settings"))).toBe("me");
  });
});

describe("the phone subtitles", () => {
  it("reads '2 need you · 4 waiting · Payments' with one project and counts more", () => {
    expect(approvalsSubtitle(2, 4, ["Payments"])).toBe("2 need you · 4 waiting · Payments");
    expect(approvalsSubtitle(1, 1, ["Payments", "Billing"])).toBe(
      "1 needs you · 1 waiting · 2 projects",
    );
    expect(approvalsSubtitle(0, 0, [])).toBe("Nothing waiting");
    expect(approvalsSubtitle(0, 2, ["Billing"])).toBe("0 need you · 2 waiting · Billing");
  });

  it("folds the manager's sentence to '4 open · 3 need you · 212k this week'", () => {
    expect(foldedSentence(4, 3, 212_400, "this week")).toBe("4 open · 3 need you · 212k this week");
    expect(foldedSentence(1, 1, 900, "in 20 turns")).toBe("1 open · 1 needs you · 900 in 20 turns");
    expect(foldedSentence(2, 0, 0, "this week")).toBe("2 open · nothing needs you");
  });
});
