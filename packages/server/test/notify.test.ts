import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HenosisServer } from "../src/server.js";

describe("notifications", () => {
  let root: string;
  let server: HenosisServer;
  let port: number;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-notify-"));
    server = new HenosisServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    port = await server.listen(0);
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("files approvals, handoffs and completions into the right inboxes and records push subscriptions", async () => {
    const host = server.project("default");
    const sh = host.session("s1", { title: "Helper", ownerId: "ana" });
    sh.session.join("main", { id: "ana", kind: "human", name: "Ana" }, "owner");
    sh.session.join("main", { id: "bo", kind: "human", name: "Bo" }, "contributor");
    sh.session.join("main", { id: "ol", kind: "human", name: "Ollie" }, "observer");
    sh.session.directive("main", "ana", { text: "Build a doubling helper" });
    void sh.drive("main"); // parks at the exec approval; do not await
    for (let i = 0; i < 100 && !Object.values(sh.session.state().approvals).length; i++)
      await new Promise((r) => setTimeout(r, 50));
    const ana = server.notifier.list("ana");
    const bo = server.notifier.list("bo");
    expect(ana.map((n) => n.kind)).toContain("approval");
    expect(bo.map((n) => n.kind)).toContain("approval");
    // Observers are not asked; the people already in the circle hear who joined.
    expect(server.notifier.list("ol")).toEqual([]);
    expect(ana.filter((n) => n.kind === "joined").map((n) => n.title)).toEqual([
      "Bo joins the circle.",
      "Ollie joins the circle.",
    ]);
    const approval = ana.find((n) => n.kind === "approval");
    expect(approval?.link).toBe("henosis://p/default/s/s1");
    expect(approval?.route).toBe("#/p/default/s/s1");
    // One sentence at three distances: who · verb · what, then where and what it means for you.
    expect(approval?.who).toBe("Ana's agent");
    expect(approval?.verb).toBe("wants to");
    expect(approval?.title).toBe(`Ana's agent wants to ${approval?.what}`);
    expect(approval?.body).toBe("Helper · You can approve, Ana");
    expect(bo.find((n) => n.kind === "approval")?.body).toBe("Helper · You can approve, Bo");
    expect(approval?.tag).toBe(`approval:${approval?.ref}`);
    expect(approval?.age).toBeGreaterThanOrEqual(0);
    // The inbox acts inline on the exact item: the approval id rides along as `ref`.
    const pendingIds = Object.keys(sh.session.state().approvals);
    expect(pendingIds).toContain(approval?.ref);
    const h = sh.session.requestHandoff("main", "ana", "bo");
    expect(h.kind).toBe("handoff.requested");
    const offer = server.notifier.list("bo").find((n) => n.kind === "handoff");
    expect(offer?.title).toBe("Ana offers you the baton.");
    expect(offer?.body).toBe("Helper · you drive once you accept");
    if (h.kind === "handoff.requested") expect(offer?.ref).toBe(h.payload.handoffId);

    const res = await fetch(`http://127.0.0.1:${port}/api/push/subscribe`, {
      method: "POST",
      body: JSON.stringify({ userId: "bo", platform: "ios", token: "apns-123" }),
    });
    expect((await res.json()) as unknown).toEqual({ ok: true, subscriptions: 1 });
    const inbox = (await (
      await fetch(`http://127.0.0.1:${port}/api/notifications?user=bo&unread=1`)
    ).json()) as { notifications: { id: string; kind: string }[] };
    expect(inbox.notifications.length).toBeGreaterThan(0);
    await fetch(`http://127.0.0.1:${port}/api/notifications?user=bo`, {
      method: "POST",
      body: JSON.stringify({ read: inbox.notifications.map((n) => n.id) }),
    });
    const after = (await (
      await fetch(`http://127.0.0.1:${port}/api/notifications?user=bo&unread=1`)
    ).json()) as { notifications: unknown[] };
    expect(after.notifications).toEqual([]);
  });

  it("replaces a repeat with the same tag in place, keeping its id, and unreads it again", () => {
    const first = server.notifier.notify("dee", {
      kind: "mention",
      who: "Cy",
      verb: "mentioned you in",
      what: "#billing",
      body: "the rounding looks off",
      link: "henosis://c/default/grp_1",
      tag: "mention:m1",
      ref: "m1",
    });
    expect(first.title).toBe("Cy mentioned you in #billing");
    expect(first.route).toBe("#/c/default/grp_1");
    server.notifier.markRead("dee", [first.id]);
    const again = server.notifier.notify("dee", {
      kind: "mention",
      who: "Cy",
      verb: "mentioned you in",
      what: "#billing",
      body: "the rounding looks off (edited)",
      link: "henosis://c/default/grp_1",
      tag: "mention:m1",
      ref: "m1",
    });
    const box = server.notifier.list("dee");
    expect(box).toHaveLength(1);
    expect(again.id).toBe(first.id);
    expect(box[0]?.read).toBe(false);
    expect(box[0]?.body).toContain("(edited)");
    // A different tag stacks beside it; the default tag is the kind and the ref.
    const other = server.notifier.notify("dee", {
      kind: "done",
      who: "Ana's agent",
      verb: "finished",
      what: "the invoice PDF.",
      link: "henosis://p/default/s/s1",
    });
    expect(other.tag).toBe("done:henosis://p/default/s/s1");
    expect(server.notifier.list("dee")).toHaveLength(2);
  });
});
