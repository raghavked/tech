import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionEvent } from "@henosis/protocol";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Notifier, routeOfLink, sentenceOf } from "../src/notify.js";

/**
 * The one notification grammar (design/henosis BACKLOG.md L1, desktop-tray): every item is
 * `who · verb · what` with a body, a tag that replaces, the client's route and an age, and the
 * mention kind rides in the same inbox so the tray can list it without ever badging it.
 */
describe("notification grammar", () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "henosis-notify-grammar-"));
  });
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const people = [
    { id: "ana", name: "Ana", role: "owner", isDriver: true, kind: "human" },
    { id: "bo", name: "Bo", role: "contributor", isDriver: false, kind: "human" },
    { id: "agent", name: "Billing page", role: "contributor", isDriver: false, kind: "agent" },
  ];

  const approval = (approvalId: string, seq = 1): SessionEvent =>
    ({
      seq,
      branch: "main",
      actor: "agent",
      ts: 1,
      kind: "approval.requested",
      payload: {
        approvalId,
        call: {
          name: "shell.run",
          risk: "irreversible",
          args: { command: "git", args: ["push"] },
        },
      },
      prev: "",
      hash: "",
    }) as unknown as SessionEvent;

  it("files an approval as who · verb · what with the owner's agent, the route and a tag", () => {
    const n = new Notifier(root);
    n.onSessionEvent("payments", "s_7f2", approval("ap1"), people, undefined, {
      title: "Billing page",
      ownerId: "ana",
    });
    const [item] = n.list("bo");
    expect(item).toMatchObject({
      kind: "approval",
      who: "Ana's agent",
      verb: "wants to",
      what: "run git push.",
      code: "git push",
      body: "Billing page · You can approve, Bo",
      link: "henosis://p/payments/s/s_7f2",
      route: "#/p/payments/s/s_7f2",
      tag: "approval:ap1",
      ref: "ap1",
    });
    // the banner's title is the same three words
    expect(item?.title).toBe("Ana's agent wants to run git push.");
    expect(sentenceOf(item as NonNullable<typeof item>)).toBe(item?.title);
  });

  it("the same tag replaces the earlier notice in place, keeping its id, and unreads it again", () => {
    const n = new Notifier(root);
    n.onSessionEvent("payments", "s_7f2", approval("ap1"), people, undefined, { ownerId: "ana" });
    const [first] = n.list("bo");
    n.onSessionEvent("payments", "s_7f2", approval("ap1", 2), people, undefined, {
      ownerId: "ana",
    });
    expect(n.list("bo").map((x) => x.tag)).toEqual(["approval:ap1"]);
    expect(n.list("bo")[0]?.id).toBe(first?.id);
    n.markRead(
      "bo",
      n.list("bo").map((x) => x.id),
    );
    expect(n.list("bo", true)).toEqual([]);
    n.onSessionEvent("payments", "s_7f2", approval("ap1", 3), people, undefined, {
      ownerId: "ana",
    });
    expect(n.list("bo").map((x) => [x.tag, x.read])).toEqual([["approval:ap1", false]]);
  });

  it("a handoff names the person and the baton; a ratings rule says to rate it first", () => {
    const n = new Notifier(root);
    const handoff = {
      seq: 4,
      branch: "main",
      actor: "ana",
      ts: 1,
      kind: "handoff.requested",
      payload: { handoffId: "h1", from: "ana", to: "bo" },
      prev: "",
      hash: "",
    } as unknown as SessionEvent;
    n.onSessionEvent("payments", "s_7f2", handoff, people, undefined, {
      title: "Tax lines and proration",
      ownerId: "ana",
    });
    expect(n.list("bo")[0]).toMatchObject({
      kind: "handoff",
      who: "Ana",
      verb: "offers you",
      what: "the baton.",
      body: "Tax lines and proration · you drive once you accept",
      tag: "handoff:h1",
      route: "#/p/payments/s/s_7f2",
    });
    const ratings = {
      approvals: { irreversible: { ratings: { min: 2, average: 4 } } },
    } as unknown as Parameters<Notifier["onSessionEvent"]>[4];
    n.onSessionEvent("payments", "s_7f2", approval("ap2", 5), people, ratings, { ownerId: "ana" });
    const gate = n.list("bo").find((x) => x.kind === "approval");
    expect(gate?.ratings).toBe(true);
    expect(gate?.body).toContain("rate it, then approve");
  });

  it("lists every item with its age in seconds from the server's clock", () => {
    const n = new Notifier(root);
    const item = n.notify("ana", {
      kind: "mention",
      who: "Bo",
      verb: "mentioned you in",
      what: "#billing",
      body: "Can you look at the tax lines?",
      link: "henosis://c/acme/billing",
      ref: "m1",
    });
    const [row] = n.list("ana", true, item.at + 125_000);
    expect(row?.age).toBe(125);
    expect(row?.route).toBe("#/c/acme/billing");
    expect(row?.title).toBe("Bo mentioned you in #billing");
    expect(row?.tag).toBe("mention:m1");
  });

  it("routes every link shape the shells send", () => {
    expect(routeOfLink("henosis://p/payments/s/s_7f2")).toBe("#/p/payments/s/s_7f2");
    expect(routeOfLink("henosis://p/payments")).toBe("#/p/payments");
    expect(routeOfLink("henosis://c/acme/billing")).toBe("#/c/acme/billing");
    expect(routeOfLink("henosis://inbox")).toBe("#/inbox");
    expect(routeOfLink("nonsense")).toBe("#/");
  });
});
