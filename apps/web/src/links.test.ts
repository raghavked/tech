import { describe, expect, it } from "vitest";
import { linkOf, parseLink, pendingLinkIn, routeOfAny, routeOfLink } from "./links.js";

describe("henosis:// deep links", () => {
  it("parses session, project and inbox links", () => {
    expect(parseLink("henosis://p/billing/s/s-ana")).toEqual({
      kind: "session",
      projectId: "billing",
      sessionId: "s-ana",
      title: null,
    });
    expect(parseLink("henosis://p/billing/s/s-ana?title=Doubling%20helper")).toEqual({
      kind: "session",
      projectId: "billing",
      sessionId: "s-ana",
      title: "Doubling helper",
    });
    expect(parseLink("henosis://p/billing")).toEqual({ kind: "project", projectId: "billing" });
    expect(parseLink("henosis://inbox")).toEqual({ kind: "inbox" });
    expect(parseLink("  HENOSIS://inbox/ ")).toEqual({ kind: "inbox" });
    expect(parseLink("henosis://c/northwind/grp_1")).toEqual({
      kind: "chat",
      orgId: "northwind",
      groupId: "grp_1",
    });
    expect(routeOfLink("henosis://c/northwind/grp_1")).toBe("#/c/northwind/grp_1");
    expect(linkOf({ kind: "chat", orgId: "northwind", groupId: "grp_1" })).toBe(
      "henosis://c/northwind/grp_1",
    );
  });

  it("decodes encoded segments and ignores trailing ones", () => {
    expect(parseLink("henosis://p/pay%2Fbilling/s/s%201")).toEqual({
      kind: "session",
      projectId: "pay/billing",
      sessionId: "s 1",
      title: null,
    });
    expect(parseLink("henosis://p/billing/s/s-ana/a/ap1")?.kind).toBe("session");
  });

  it("rejects anything that is not a known henosis:// route", () => {
    for (const bad of [
      "",
      "https://example.com/#/p/x/s/y",
      "henosis://",
      "henosis://p",
      "henosis://p/",
      "henosis://p/x/s",
      "henosis://p/x/extra",
      "henosis://inbox/all",
      "henosis://settings",
      "henosis:p/x/s/y",
      "#/p/x/s/y",
    ])
      expect(parseLink(bad), bad).toBeNull();
  });

  it("turns links into hash routes", () => {
    expect(routeOfLink("henosis://p/billing/s/s-ana")).toBe("#/p/billing/s/s-ana");
    expect(routeOfLink("henosis://p/billing/s/s-ana?title=Tax%20lines")).toBe(
      "#/p/billing/s/s-ana?title=Tax%20lines",
    );
    expect(routeOfLink("henosis://p/billing")).toBe("#/p/billing");
    expect(routeOfLink("henosis://inbox")).toBe("#/inbox");
    expect(routeOfLink("henosis://p/a%2Fb/s/c d")).toBe("#/p/a%2Fb/s/c%20d");
    expect(routeOfLink("https://example.com/")).toBeNull();
  });

  it("round-trips through linkOf", () => {
    for (const link of [
      "henosis://inbox",
      "henosis://p/billing",
      "henosis://p/billing/s/s-ana",
      "henosis://p/billing/s/s-ana?title=Tax%20lines",
      "henosis://p/a%2Fb/s/c%20d",
    ]) {
      const parsed = parseLink(link);
      expect(parsed, link).not.toBeNull();
      if (parsed) expect(linkOf(parsed)).toBe(link);
    }
  });

  it("accepts hash routes as well as links", () => {
    expect(routeOfAny("#/p/x/s/y")).toBe("#/p/x/s/y");
    expect(routeOfAny("/#/inbox")).toBe("#/inbox");
    expect(routeOfAny("henosis://inbox")).toBe("#/inbox");
    expect(routeOfAny("mailto:x")).toBeNull();
    expect(routeOfAny(42)).toBeNull();
    expect(routeOfAny(undefined)).toBeNull();
  });

  it("finds a link handed over on load", () => {
    expect(pendingLinkIn("?link=henosis%3A%2F%2Fp%2Fbilling%2Fs%2Fs-ana", "")).toBe(
      "#/p/billing/s/s-ana",
    );
    expect(pendingLinkIn("?x=1&link=henosis://inbox", "#/")).toBe("#/inbox");
    expect(pendingLinkIn("", "#henosis://p/billing")).toBe("#/p/billing");
    expect(pendingLinkIn("", "#henosis%3A%2F%2Finbox")).toBe("#/inbox");
    expect(pendingLinkIn("", "#/p/billing")).toBeNull();
    expect(pendingLinkIn("?link=https://evil.example/", "")).toBeNull();
    expect(pendingLinkIn("", "")).toBeNull();
  });
});
