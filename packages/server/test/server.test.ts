import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fold, type SessionState } from "@quorum/kernel";
import type { Actor, ClientMessage, ServerMessage } from "@quorum/protocol";
import { defaultTools, ScriptedModel } from "@quorum/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { SessionHost } from "../src/host.js";
import { QuorumServer } from "../src/server.js";

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
  let server: QuorumServer;
  let url: string;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "quorum-srv-"));
    server = new QuorumServer({
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

  it("persists to disk and a new host resumes the same state", async () => {
    const h = server.hosts.get("s1");
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
});
