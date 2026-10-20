/**
 * The glance (mobile-rail, widgets): one needs-you number, the top gate, agents running and
 * tokens today; the same figure in every push payload. Also the snapshot's `reconnect` and
 * the `session.briefed` events the ledger records.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fleetBrief, isWelcomeBrief } from "@henosis/fleet";
import {
  type Actor,
  type ClientMessage,
  type GlanceReport,
  reconnectBackoffMs,
  type ServerMessage,
} from "@henosis/protocol";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { dayOf, UsageDays } from "../src/glance.js";
import { AGENT_READER } from "../src/projectHost.js";
import { HenosisServer } from "../src/server.js";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ana: Actor = { id: "ana", kind: "human", name: "Ana" };

class Client {
  ws: WebSocket;
  messages: ServerMessage[] = [];
  private waiters: ((m: ServerMessage) => void)[] = [];
  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString()) as ServerMessage;
      this.messages.push(m);
      for (const w of this.waiters.splice(0)) w(m);
    });
  }
  open(): Promise<void> {
    return new Promise((r) => this.ws.once("open", () => r()));
  }
  send(m: ClientMessage): void {
    this.ws.send(JSON.stringify(m));
  }
  async until(type: ServerMessage["type"]): Promise<ServerMessage> {
    for (let i = 0; i < 100; i++) {
      const found = this.messages.find((m) => m.type === type);
      if (found) return found;
      await Promise.race([new Promise((r) => this.waiters.push(r)), wait(100)]);
    }
    throw new Error(`no ${type}`);
  }
  closed(): Promise<void> {
    return new Promise((r) => {
      this.ws.once("close", () => r());
      this.ws.close();
    });
  }
}

describe("glance, reconnect info and briefed events", () => {
  let root: string;
  let server: HenosisServer;
  let port: number;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-glance-"));
    writeFileSync(
      join(root, "orgs.json"),
      JSON.stringify({
        orgs: [
          {
            id: "nw",
            name: "Northwind",
            teams: [
              { id: "pay", name: "Payments", projects: [{ id: "billing", name: "Billing" }] },
            ],
          },
        ],
      }),
    );
    writeFileSync(
      join(root, "users.json"),
      JSON.stringify({
        users: [
          { id: "ana", name: "Ana", projects: [{ projectId: "billing", role: "member" }] },
          { id: "bo", name: "Bo", projects: [{ projectId: "billing", role: "member" }] },
          { id: "ol", name: "Ollie", projects: [] },
        ],
      }),
    );
    server = new HenosisServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    port = await server.listen(0);
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("counts the approvals a person can still vote on and the handoffs offered to them, never mentions", async () => {
    const host = server.project("billing");
    const sh = host.session("s1", { title: "Helper", ownerId: "ana", ownerName: "Ana" });
    sh.session.join("main", { id: "ana", kind: "human", name: "Ana" }, "owner");
    sh.session.join("main", { id: "bo", kind: "human", name: "Bo" }, "contributor");
    sh.session.directive("main", "ana", { text: "Build a doubling helper and deploy it" });
    void sh.drive("main"); // parks at the exec approval; do not await
    for (let i = 0; i < 100 && !Object.values(sh.session.state().approvals).length; i++)
      await wait(50);
    let bo = server.glance("bo");
    expect(bo.user).toEqual({ id: "bo", name: "Bo" });
    expect(bo.approvals).toBe(1);
    expect(bo.handoffs).toBe(0);
    expect(bo.needsYou).toBe(1);
    expect(bo.topGate?.call.risk).toBe("exec");
    expect(bo.topGate?.ratings).toBe(false);
    expect(bo.topGate?.owner).toBe("Ana");
    expect(bo.topGate?.needed).toBe(1);
    expect(bo.agents).toEqual({ open: 1, running: 0, awaitingApproval: 1, blocked: 0 });
    // Ollie is not in the project: identity seats him as an observer, so nothing needs him.
    expect(server.glance("ol").needsYou).toBe(0);
    // The push payload carries the same figure.
    const pushed = server.notifier.list("bo").find((n) => n.kind === "approval");
    expect(pushed?.needsYou).toBe(1);

    // Bo votes: the approval leaves his count; the agent reaches the release gate.
    const exec = bo.topGate?.approvalId ?? "";
    sh.session.vote("main", "bo", exec, "approve");
    void sh.drive("main");
    for (
      let i = 0;
      i < 100 &&
      !Object.values(sh.session.state().approvals).some(
        (x) => x.call.risk === "irreversible" && x.status === "pending",
      );
      i++
    )
      await wait(50);
    bo = server.glance("bo");
    expect(bo.topGate?.ratings).toBe(true);
    expect(bo.topGate?.needed).toBe(2);
    expect(bo.topGate?.bar).toBe(4);
    expect(bo.topGate?.votes).toBe(0);
    const gate = bo.topGate?.approvalId ?? "";
    sh.session.vote("main", "ana", gate, "approve", 4);
    bo = server.glance("bo");
    expect(bo.topGate?.votes).toBe(1);
    expect(bo.topGate?.average).toBe(4);
    // Ana has voted; the gate no longer needs her.
    expect(server.glance("ana").approvals).toBe(0);
    // A handoff offered to Bo counts; one offered to Ana does not count for Bo.
    sh.session.requestHandoff("main", "ana", "bo");
    bo = server.glance("bo");
    expect(bo.handoffs).toBe(1);
    expect(bo.needsYou).toBe(2);
    // Tokens today belong to the session's owner, on the UTC day.
    const today = server.glance("ana");
    expect(today.day).toBe(dayOf(Date.now()));
    expect(today.tokensToday.input + today.tokensToday.output).toBeGreaterThan(0);
    expect(bo.tokensToday).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

    // Over HTTP, and the inbox carries the figure beside the items.
    const res = (await (
      await fetch(`http://127.0.0.1:${port}/api/glance?user=bo`)
    ).json()) as GlanceReport;
    expect(res.needsYou).toBe(2);
    expect(res.topGate?.approvalId).toBe(gate);
    const inbox = (await (
      await fetch(`http://127.0.0.1:${port}/api/notifications?user=bo`)
    ).json()) as { needsYou: number; notifications: { needsYou?: number }[] };
    expect(inbox.needsYou).toBe(2);
    expect(inbox.notifications.every((n) => typeof n.needsYou === "number")).toBe(true);
  });

  it("keeps per-day totals beside the store and prunes old days", () => {
    const dir = mkdtempSync(join(tmpdir(), "henosis-days-"));
    let now = Date.parse("2026-10-13T10:00:00Z");
    const days = new UsageDays(dir, () => now);
    days.record("ana", { input: 10, output: 5 });
    days.record("ana", { input: 1, output: 1 });
    expect(days.of("ana")).toEqual({ input: 11, output: 6, cacheRead: 0, cacheWrite: 0 });
    days.flush();
    const again = new UsageDays(dir, () => now);
    expect(again.of("ana").input).toBe(11);
    now += 20 * 86_400_000;
    again.record("ana", { input: 2 });
    expect(again.of("ana")).toEqual({ input: 2, output: 0, cacheRead: 0, cacheWrite: 0 });
    expect(again.of("ana", "2026-10-13")).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
    again.flush();
    rmSync(dir, { recursive: true, force: true });
  });

  it("the snapshot echoes the reconnect attempt with the server's next delay, and says whether it resumed", async () => {
    const url = `ws://127.0.0.1:${port}/ws`;
    const c = new Client(url);
    await c.open();
    c.send({
      type: "join",
      sessionId: "s1",
      actor: ana,
      branch: "main",
      projectId: "billing",
      attempt: 2,
    });
    const snap = await c.until("snapshot");
    expect(snap.type === "snapshot" && snap.reconnect).toEqual({
      attempt: 2,
      delayMs: reconnectBackoffMs(3),
      resumed: false,
    });
    expect(reconnectBackoffMs(3)).toBe(4000);
    expect(reconnectBackoffMs(20)).toBe(15_000);
    const last = snap.type === "snapshot" ? snap.events[snap.events.length - 1] : undefined;
    await c.closed();
    const d = new Client(url);
    await d.open();
    d.send({
      type: "join",
      sessionId: "s1",
      actor: ana,
      branch: "main",
      projectId: "billing",
      sinceSeq: last?.seq ?? 0,
    });
    const delta = await d.until("snapshot");
    expect(delta.type === "snapshot" && delta.reconnect).toEqual({
      attempt: 0,
      delayMs: reconnectBackoffMs(1),
      resumed: true,
    });
    // A first connection with no attempt still gets the field.
    const e = new Client(url);
    await e.open();
    e.send({ type: "join", sessionId: "s1", actor: ana, branch: "main", projectId: "billing" });
    const full = await e.until("snapshot");
    expect(full.type === "snapshot" && full.reconnect?.attempt).toBe(0);
    expect(full.type === "snapshot" && full.reconnect?.resumed).toBe(false);

    // Asking for the handoff brief over the wire records the read in the project ledger.
    e.send({ type: "brief" });
    await e.until("brief");
    await wait(20);
    const reads = server.project("billing").state().sessions.s1?.briefs ?? [];
    expect(reads[0]).toMatchObject({ reader: AGENT_READER, kind: "fleet", atSeq: 0 });
    // The welcome brief: the circle, the manners, then the fleet context of the moment.
    expect(isWelcomeBrief(reads[0]?.brief ?? "")).toBe(true);
    expect(reads[0]?.brief).toContain("You are Ana's agent on Helper.");
    expect(reads[0]?.brief).toContain("## Manners");
    expect(reads[0]?.brief).toContain("## Other agents\nno other agents in this project");
    const mine = reads.find((r) => r.kind === "handoff");
    expect(mine?.reader).toBe("ana");
    expect(mine?.brief).toContain("# Handoff brief: Helper");
    expect(mine?.atSeq).toBe(server.project("billing").hosts.get("s1")?.session.state().seq);
    expect(fleetBrief(server.project("billing").state())).toContain(
      "briefed: agent read the fleet brief at seq 0; Ana read the handoff brief at seq",
    );
    await d.closed();
    await e.closed();
  });
});
