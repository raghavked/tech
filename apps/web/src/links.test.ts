import { describe, expect, it } from "vitest";
import { linkOf, parseLink, pendingLinkIn, routeOfAny, routeOfLink } from "./links.js";

describe("fold:// deep links", () => {
  it("parses session, project and inbox links", () => {
    expect(parseLink("fold://p/billing/s/s-ana")).toEqual({
      kind: "session",
      projectId: "billing",
      sessionId: "s-ana",
      title: null,
    });
    expect(parseLink("fold://p/billing/s/s-ana?title=Doubling%20helper")).toEqual({
      kind: "session",
      projectId: "billing",
      sessionId: "s-ana",
      title: "Doubling helper",
    });
    expect(parseLink("fold://p/billing")).toEqual({ kind: "project", projectId: "billing" });
    expect(parseLink("fold://inbox")).toEqual({ kind: "inbox" });
    expect(parseLink("  FOLD://inbox/ ")).toEqual({ kind: "inbox" });
  });

  it("decodes encoded segments and ignores trailing ones", () => {
    expect(parseLink("fold://p/pay%2Fbilling/s/s%201")).toEqual({
      kind: "session",
      projectId: "pay/billing",
      sessionId: "s 1",
      title: null,
    });
    expect(parseLink("fold://p/billing/s/s-ana/a/ap1")?.kind).toBe("session");
  });

  it("rejects anything that is not a known fold:// route", () => {
    for (const bad of [
      "",
      "https://example.com/#/p/x/s/y",
      "fold://",
      "fold://p",
      "fold://p/",
      "fold://p/x/s",
      "fold://p/x/extra",
      "fold://inbox/all",
      "fold://settings",
      "fold:p/x/s/y",
      "#/p/x/s/y",
    ])
      expect(parseLink(bad), bad).toBeNull();
  });

  it("turns links into hash routes", () => {
    expect(routeOfLink("fold://p/billing/s/s-ana")).toBe("#/p/billing/s/s-ana");
    expect(routeOfLink("fold://p/billing/s/s-ana?title=Tax%20lines")).toBe(
      "#/p/billing/s/s-ana?title=Tax%20lines",
    );
    expect(routeOfLink("fold://p/billing")).toBe("#/p/billing");
    expect(routeOfLink("fold://inbox")).toBe("#/inbox");
    expect(routeOfLink("fold://p/a%2Fb/s/c d")).toBe("#/p/a%2Fb/s/c%20d");
    expect(routeOfLink("https://example.com/")).toBeNull();
  });

  it("round-trips through linkOf", () => {
    for (const link of [
      "fold://inbox",
      "fold://p/billing",
      "fold://p/billing/s/s-ana",
      "fold://p/billing/s/s-ana?title=Tax%20lines",
      "fold://p/a%2Fb/s/c%20d",
    ]) {
      const parsed = parseLink(link);
      expect(parsed, link).not.toBeNull();
      if (parsed) expect(linkOf(parsed)).toBe(link);
    }
  });

  it("accepts hash routes as well as links", () => {
    expect(routeOfAny("#/p/x/s/y")).toBe("#/p/x/s/y");
    expect(routeOfAny("/#/inbox")).toBe("#/inbox");
    expect(routeOfAny("fold://inbox")).toBe("#/inbox");
    expect(routeOfAny("mailto:x")).toBeNull();
    expect(routeOfAny(42)).toBeNull();
    expect(routeOfAny(undefined)).toBeNull();
  });

  it("finds a link handed over on load", () => {
    expect(pendingLinkIn("?link=fold%3A%2F%2Fp%2Fbilling%2Fs%2Fs-ana", "")).toBe(
      "#/p/billing/s/s-ana",
    );
    expect(pendingLinkIn("?x=1&link=fold://inbox", "#/")).toBe("#/inbox");
    expect(pendingLinkIn("", "#fold://p/billing")).toBe("#/p/billing");
    expect(pendingLinkIn("", "#fold%3A%2F%2Finbox")).toBe("#/inbox");
    expect(pendingLinkIn("", "#/p/billing")).toBeNull();
    expect(pendingLinkIn("?link=https://evil.example/", "")).toBeNull();
    expect(pendingLinkIn("", "")).toBeNull();
  });
});
