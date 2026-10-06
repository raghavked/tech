import { describe, expect, it } from "vitest";
import { appUrlOf, linkOf, mrkdwnLink, routeOfLink } from "../src/links.js";

describe("slack app links", () => {
  it("turns henosis:// links into hash routes", () => {
    expect(routeOfLink("henosis://p/billing/s/s-ana")).toBe("#/p/billing/s/s-ana");
    expect(routeOfLink("henosis://p/billing/s/s-ana?title=Tax%20lines")).toBe(
      "#/p/billing/s/s-ana?title=Tax%20lines",
    );
    expect(routeOfLink("henosis://p/billing")).toBe("#/p/billing");
    expect(routeOfLink("henosis://inbox")).toBe("#/inbox");
    expect(routeOfLink("henosis://settings")).toBeNull();
    expect(routeOfLink("https://example.com/#/inbox")).toBeNull();
  });

  it("puts routes under the app base URL, tolerating trailing slashes and hashes", () => {
    expect(appUrlOf("henosis://p/billing/s/s-ana", "https://henosis.example.com")).toBe(
      "https://henosis.example.com/#/p/billing/s/s-ana",
    );
    expect(appUrlOf("henosis://inbox", "https://henosis.example.com/")).toBe(
      "https://henosis.example.com/#/inbox",
    );
    expect(appUrlOf("henosis://inbox", "https://henosis.example.com/#/")).toBe(
      "https://henosis.example.com/#/inbox",
    );
    expect(appUrlOf("henosis://p/billing", "http://localhost:5173")).toBe(
      "http://localhost:5173/#/p/billing",
    );
    expect(appUrlOf("henosis://p/billing", undefined)).toBeNull();
    expect(appUrlOf("henosis://p/billing", "  ")).toBeNull();
    expect(appUrlOf("henosis://nope", "https://henosis.example.com")).toBeNull();
  });

  it("builds the links the server writes and Slack mrkdwn for them", () => {
    expect(linkOf("billing", "s-ana")).toBe("henosis://p/billing/s/s-ana");
    expect(linkOf("billing")).toBe("henosis://p/billing");
    expect(linkOf("a/b", "c d")).toBe("henosis://p/a%2Fb/s/c%20d");
    expect(mrkdwnLink("https://x/#/inbox", "Open in Henosis")).toBe(
      "<https://x/#/inbox|Open in Henosis>",
    );
    expect(mrkdwnLink("https://x/#/inbox", "a|b<c>")).toBe("<https://x/#/inbox|a b c >");
    expect(mrkdwnLink(null, "Open")).toBe("");
  });
});
