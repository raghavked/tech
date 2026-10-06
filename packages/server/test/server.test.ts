import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fold, type SessionState } from "@henosis/kernel";
import {
  type Actor,
  type ClientMessage,
  DEFAULT_SESSION_POLICY,
  type ServerMessage,
} from "@henosis/protocol";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { SessionHost } from "../src/host.js";
import { HenosisServer } from "../src/server.js";

class Client {
  ws: WebSocket;
  events: ServerMessage[] = [];
  state: SessionState | null = null;
  private waiters: ((m: ServerMessage) => void)[] = [];
  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString()) as ServerMessage;
      this.events.push(m);
      if (m.type === "snapshot") this.state = fold(m.events);
      if (m.type === "event" && this.state) this.state = fold([m.event], this.state);
      for (const w of this.waiters.splice(0)) w(m);
    });
  }
  open(): Promise<void> {
    return new Promise((r) => this.ws.once("open", () => r()));
  }
  send(m: ClientMessage): void {
    this.ws.send(JSON.stringify(m));
  }
  next(): Promise<ServerMessage> {
    return new Promise((r) => this.waiters.push(r));
  }
  async until(pred: (s: SessionState) => boolean, ms = 8000): Promise<SessionState> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (this.state && pred(this.state)) return this.state;
      await Promise.race([this.next(), new Promise((r) => setTimeout(r, 100))]);
    }
    throw new Error("timeout waiting for state");
  }
  close(): void {
    this.ws.close();
  }
}

const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const bo: Actor = { id: "bo", kind: "human", name: "Bo" };

describe("websocket server", () => {
  let root: string;
  let server: HenosisServer;
  let url: string;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-srv-"));
    server = new HenosisServer({
      root,
      model: new ScriptedModel(),
      tools: defaultTools(),
      token: "secret",
    });
    const port = await server.listen(0);
    url = `ws://127.0.0.1:${port}/ws`;
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("rejects a bad token", async () => {
    const c = new Client(url);
    await c.open();
    c.send({ type: "join", sessionId: "s1", actor: ana, token: "nope", branch: "main" });
    const m = await c.next();
    expect(m).toEqual({ type: "error", message: "unauthorized" });
    c.close();
  });

  it("two humans steer one agent, approve its shell call, and hand off", async () => {
    const a = new Client(url);
    const b = new Client(url);
    await Promise.all([a.open(), b.open()]);
    a.send({ type: "join", sessionId: "s1", actor: ana, token: "secret", branch: "main" });
    await a.until((s) => s.participants.ana?.role === "owner");
    b.send({ type: "join", sessionId: "s1", actor: bo, token: "secret", branch: "main" });
    await b.until((s) => s.participants.bo?.role === "contributor");
    expect(a.state?.driver).toBe("ana");

    // Bo votes on approvals as they appear.
    b.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString()) as ServerMessage;
      if (m.type === "event" && m.event.kind === "approval.requested") {
        b.send({ type: "vote", approvalId: m.event.payload.approvalId, vote: "approve" });
      }
    });
    a.send({
      type: "directive",
      input: {
        text: "Build a greeter",
        mode: "steer",
        scope: "goal",
        supersedes: [],
        interrupt: false,
      },
    });
    b.send({
      type: "directive",
      input: {
        text: "Keep it tiny",
        mode: "constrain",
        scope: "goal",
        supersedes: [],
        interrupt: false,
      },
    });
    const done = await a.until(
      (s) => s.turns.length > 0 && s.turns[s.turns.length - 1]?.summary.startsWith("DONE") === true,
      15000,
    );
    expect(Object.keys(done.workspace)).toContain("src/build_a_greeter.mjs");
    expect(Object.values(done.approvals).every((x) => x.status === "granted")).toBe(true);
    // Both replicas folded to the same state.
    await b.until((s) => s.seq === done.seq);
    expect(JSON.stringify(b.state)).toBe(JSON.stringify(done));

    // Handoff to Bo.
    a.send({ type: "handoff.request", to: "bo" });
    const pending = await b.until((s) =>
      Object.values(s.handoffs).some((h) => h.status === "pending"),
    );
    const h = Object.values(pending.handoffs).find((x) => x.status === "pending");
    b.send({ type: "handoff.accept", handoffId: h?.id ?? "" });
    await a.until((s) => s.driver === "bo");
    b.send({ type: "brief" });
    const brief = await new Promise<ServerMessage>((r) => {
      const check = () => {
        const m = b.events.find((e) => e.type === "brief");
        if (m) r(m);
        else b.next().then(check);
      };
      check();
    });
    expect(brief.type === "brief" && brief.markdown).toContain("Driver: Bo");

    // Presence shows both online.
    const presence = [...a.events].reverse().find((e) => e.type === "presence");
    expect(presence?.type === "presence" && presence.entries.filter((e) => e.online).length).toBe(
      2,
    );
    a.close();
    b.close();
  });

  it("creates a plan-first session over the wire; a rating approves the plan and resumes the agent", async () => {
    const a = new Client(url);
    await a.open();
    a.send({ type: "project.subscribe", projectId: "default", userId: "ana" } as never);
    a.send({
      type: "session.create",
      sessionId: "s-plan",
      title: "Plan first",
      policy: { planFirst: true, tokenBudget: 9000 },
    } as never);
    a.send({ type: "join", sessionId: "s-plan", actor: ana, token: "secret", branch: "main" });
    const joined = await a.until((s) => s.participants.ana?.role === "owner");
    expect(joined.policy.planFirst).toBe(true);
    expect(joined.policy.tokenBudget).toBe(9000);
    expect(joined.policy.approvals).toEqual(DEFAULT_SESSION_POLICY.approvals);
    a.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString()) as ServerMessage;
      if (m.type === "event" && m.event.kind === "approval.requested")
        a.send({ type: "vote", approvalId: m.event.payload.approvalId, vote: "approve" });
    });
    a.send({
      type: "directive",
      input: {
        text: "Build a ledger",
        mode: "steer",
        scope: "goal",
        supersedes: [],
        interrupt: false,
      },
    });
    // The agent proposes and yields; nothing is written while the plan waits.
    const proposed = await a.until(
      (s) => s.activePlanId !== null && s.plans[s.activePlanId]?.status === "proposed",
      15000,
    );
    expect(Object.keys(proposed.workspace)).toEqual([]);
    expect(proposed.turns[proposed.turns.length - 1]?.reason).toBe("blocked");
    const planId = proposed.activePlanId ?? "";
    expect(() => a.send({ type: "plan.rate", planId, rating: 5, note: "good" })).not.toThrow();
    await a.until((s) => s.plans[planId]?.status === "approved", 5000);
    const done = await a.until(
      (s) => s.turns.length > 0 && s.turns[s.turns.length - 1]?.summary.startsWith("DONE") === true,
      15000,
    );
    expect(Object.keys(done.workspace)).toContain("src/build_a_ledger.mjs");
    expect(done.plans[planId]?.status).toBe("done");
    expect(done.plans[planId]?.steps.every((st) => st.actualTokens > 0)).toBe(true);
    // The fleet report carries the plan.
    const report = server.project("default").state().sessions["s-plan"]?.report;
    expect(report?.plan?.status).toBe("done");
    expect(report?.plan?.estTokens).toBe(1500);
    a.close();
  });

  it("persists to disk and a new host resumes the same state", async () => {
    const h = server.project("default").hosts.get("s1");
    expect(h).toBeDefined();
    h?.flush();
    const again = new SessionHost({
      root,
      sessionId: "s1",
      model: new ScriptedModel(),
      tools: defaultTools(),
    });
    expect(again.session.log.verify()).toEqual({ ok: true });
    expect(again.session.state().driver).toBe("bo");
    expect(again.session.readFile("main", "PLAN.md")).toContain("Build a greeter");
    again.close();
  });

  // settings-page: the Team policy and Integrations sections read these two routes.
  it("serves the project's session policy and the integration status over HTTP", async () => {
    const base = url.replace(/^ws/, "http").replace(/\/ws$/, "");
    const policy = await (await fetch(`${base}/api/projects/default/policy`)).json();
    expect(policy).toEqual(DEFAULT_SESSION_POLICY);
    expect(await (await fetch(`${base}/api/integrations`)).json()).toEqual({ slack: false });
    server.integrations.slack = true;
    expect(await (await fetch(`${base}/api/integrations`)).json()).toEqual({ slack: true });
    server.integrations.slack = false;
  });

  it("relays a composing presence status to the others and clears it on demand", async () => {
    const a = new Client(url);
    const b = new Client(url);
    await Promise.all([a.open(), b.open()]);
    a.send({ type: "join", sessionId: "s1", actor: ana, token: "secret", branch: "main" });
    await a.until((s) => s.participants.ana?.present === true);
    b.send({ type: "join", sessionId: "s1", actor: bo, token: "secret", branch: "main" });
    await b.until((s) => s.participants.bo?.present === true);
    const statusOfBo = async (c: Client, want: string) => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const m = [...c.events].reverse().find((e) => e.type === "presence");
        const entry = m?.type === "presence" ? m.entries.find((e) => e.actor.id === "bo") : null;
        if (entry && entry.status === want) return entry;
        await Promise.race([c.next(), new Promise((r) => setTimeout(r, 100))]);
      }
      throw new Error(`timeout waiting for bo's status to be "${want}"`);
    };
    // Bo starts typing ("composing" is the web composer's status): Ana sees it, and nothing
    // enters the log.
    const seq = a.state?.seq ?? -1;
    b.send({ type: "presence", status: "composing" });
    const typing = await statusOfBo(a, "composing");
    expect(typing.online).toBe(true);
    expect(a.state?.seq).toBe(seq);
    // Bo sends or blurs: the status clears for everyone.
    b.send({ type: "presence", status: "" });
    await statusOfBo(a, "");
    await statusOfBo(b, "");
    a.close();
    b.close();
  });
});
