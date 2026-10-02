import { describe, expect, it } from "vitest";
import { appUrlOf, linkOf, mrkdwnLink, routeOfLink } from "../src/links.js";

describe("slack app links", () => {
  it("turns fold:// links into hash routes", () => {
    expect(routeOfLink("fold://p/billing/s/s-ana")).toBe("#/p/billing/s/s-ana");
    expect(routeOfLink("fold://p/billing/s/s-ana?title=Tax%20lines")).toBe(
      "#/p/billing/s/s-ana?title=Tax%20lines",
    );
    expect(routeOfLink("fold://p/billing")).toBe("#/p/billing");
    expect(routeOfLink("fold://inbox")).toBe("#/inbox");
    expect(routeOfLink("fold://settings")).toBeNull();
    expect(routeOfLink("https://example.com/#/inbox")).toBeNull();
  });

  it("puts routes under the app base URL, tolerating trailing slashes and hashes", () => {
    expect(appUrlOf("fold://p/billing/s/s-ana", "https://fold.example.com")).toBe(
      "https://fold.example.com/#/p/billing/s/s-ana",
    );
    expect(appUrlOf("fold://inbox", "https://fold.example.com/")).toBe(
      "https://fold.example.com/#/inbox",
    );
    expect(appUrlOf("fold://inbox", "https://fold.example.com/#/")).toBe(
      "https://fold.example.com/#/inbox",
    );
    expect(appUrlOf("fold://p/billing", "http://localhost:5173")).toBe(
      "http://localhost:5173/#/p/billing",
    );
    expect(appUrlOf("fold://p/billing", undefined)).toBeNull();
    expect(appUrlOf("fold://p/billing", "  ")).toBeNull();
    expect(appUrlOf("fold://nope", "https://fold.example.com")).toBeNull();
  });

  it("builds the links the server writes and Slack mrkdwn for them", () => {
    expect(linkOf("billing", "s-ana")).toBe("fold://p/billing/s/s-ana");
    expect(linkOf("billing")).toBe("fold://p/billing");
    expect(linkOf("a/b", "c d")).toBe("fold://p/a%2Fb/s/c%20d");
    expect(mrkdwnLink("https://x/#/inbox", "Open in Fold")).toBe(
      "<https://x/#/inbox|Open in Fold>",
    );
    expect(mrkdwnLink("https://x/#/inbox", "a|b<c>")).toBe("<https://x/#/inbox|a b c >");
    expect(mrkdwnLink(null, "Open")).toBe("");
  });
});
