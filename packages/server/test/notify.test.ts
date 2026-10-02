import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultTools, ScriptedModel } from "@atelier/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AtelierServer } from "../src/server.js";

describe("notifications", () => {
  let root: string;
  let server: AtelierServer;
  let port: number;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "atelier-notify-"));
    server = new AtelierServer({ root, model: new ScriptedModel(), tools: defaultTools() });
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
    await sh.drive("main"); // stops at the exec approval
    const ana = server.notifier.list("ana");
    const bo = server.notifier.list("bo");
    expect(ana.map((n) => n.kind)).toContain("approval");
    expect(bo.map((n) => n.kind)).toContain("approval");
    expect(server.notifier.list("ol")).toEqual([]);
    expect(ana[0]?.link).toBe("atelier://p/default/s/s1");
    const h = sh.session.requestHandoff("main", "ana", "bo");
    expect(h.kind).toBe("handoff.requested");
    expect(
      server.notifier.list("bo").some((n) => n.kind === "handoff" && n.body.includes("Ana")),
    ).toBe(true);

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
});
