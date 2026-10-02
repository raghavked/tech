/** reconnect-resume: `join` with `sinceSeq` gets a trimmed snapshot that folds to the same state. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fold, type SessionState } from "@fold/kernel";
import {
  type Actor,
  type ClientMessage,
  DEFAULT_APPROVAL_POLICY,
  type ServerMessage,
  type SessionEvent,
} from "@fold/protocol";
import { defaultTools, ScriptedModel } from "@fold/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { SessionHost } from "../src/host.js";
import { FoldServer } from "../src/server.js";

const open: Client[] = [];

class Client {
  ws: WebSocket;
  events: SessionEvent[] = [];
  snapshots: SessionEvent[][] = [];
  state: SessionState | null = null;
  private waiters: ((m: ServerMessage) => void)[] = [];
  constructor(url: string) {
    this.ws = new WebSocket(url);
    open.push(this);
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString()) as ServerMessage;
      if (m.type === "snapshot") {
        this.snapshots.push(m.events);
        // Fold a delta onto what we hold, exactly as the web client does.
        const last = this.events[this.events.length - 1];
        const first = m.events[0];
        if (this.state && last && first && first.seq === last.seq + 1) {
          this.state = fold(m.events, this.state);
          this.events = [...this.events, ...m.events];
        } else {
          this.state = fold(m.events);
          this.events = [...m.events];
        }
      }
      if (m.type === "event" && this.state) {
        this.state = fold([m.event], this.state);
        this.events.push(m.event);
      }
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
  closed(): Promise<void> {
    return new Promise((r) => {
      this.ws.once("close", () => r());
      this.ws.close();
    });
  }
}

const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const bo: Actor = { id: "bo", kind: "human", name: "Bo" };

describe("reconnect-resume", () => {
  let root: string;
  let server: FoldServer;
  let url: string;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "fold-resume-"));
    server = new FoldServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    const port = await server.listen(0);
    url = `ws://127.0.0.1:${port}/ws`;
  });
  afterAll(async () => {
    for (const c of open) c.ws.terminate();
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("a rejoin with sinceSeq gets only the events after it, and folds to the same state", async () => {
    const a = new Client(url);
    await a.open();
    a.send({ type: "join", sessionId: "r1", actor: ana, branch: "main" });
    await a.until((s) => s.participants.ana?.role === "owner");
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
    // The scripted model asks to run a shell command; nobody approves, so the agent waits.
    const before = await a.until(
      (s) => Object.values(s.approvals).some((x) => x.status === "pending"),
      15000,
    );
    const held = [...a.events];
    const last = held[held.length - 1];
    expect(last).toBeDefined();
    if (!last) return;
    expect(a.snapshots[0]?.[0]?.seq).toBe(0);
    await a.closed();

    // Meanwhile Bo joins and steers: events Ana missed while away.
    const b = new Client(url);
    await b.open();
    b.send({ type: "join", sessionId: "r1", actor: bo, branch: "main" });
    await b.until((s) => s.participants.bo?.role === "contributor");
    b.send({ type: "note", text: "back in a moment" });
    await b.until((s) => s.seq > last.seq + 2);

    // Ana comes back from where she left off.
    const a2 = new Client(url);
    a2.events = held;
    a2.state = before;
    await a2.open();
    a2.send({ type: "join", sessionId: "r1", actor: ana, branch: "main", sinceSeq: last.seq });
    // `before` already has Ana present, so wait for the delta itself to land.
    await a2.until((s) => s.seq > last.seq);
    const delta = a2.snapshots[0] ?? [];
    expect(delta.length).toBeGreaterThan(0);
    expect(delta.every((e) => e.seq > last.seq)).toBe(true);
    expect(delta[0]?.seq).toBe(last.seq + 1);
    expect(delta[0]?.prev).toBe(last.id);
    expect(delta.some((e) => e.kind === "note.posted")).toBe(true);
    expect(delta.some((e) => e.kind === "participant.joined" && e.actor === "ana")).toBe(true);

    // The fold is identical: delta onto held state == full history folded from scratch.
    const host = server.project("default").hosts.get("r1");
    expect(host).toBeDefined();
    const full = fold(host?.session.events("main") ?? []);
    expect(JSON.stringify(a2.state)).toBe(JSON.stringify(full));
    expect(a2.events.length).toBe(host?.session.events("main").length);

    await a2.closed();
    await b.closed();
  });

  it("a sinceSeq the branch does not hold falls back to the full history", async () => {
    const c = new Client(url);
    await c.open();
    c.send({ type: "join", sessionId: "r1", actor: ana, branch: "main", sinceSeq: 100_000 });
    await c.until((s) => s.participants.ana?.present === true);
    expect(c.snapshots[0]?.[0]?.seq).toBe(0);
    const host = server.project("default").hosts.get("r1");
    expect(c.snapshots[0]?.length).toBe(host?.session.events("main").length);
    await c.closed();
  });

  it("eventsSince slices by seq on the host", () => {
    const h = new SessionHost({
      root,
      sessionId: "r2",
      model: new ScriptedModel(),
      tools: defaultTools(),
      create: {
        title: "r2",
        policy: { approvals: DEFAULT_APPROVAL_POLICY, contention: "block", maxTurns: 10 },
      },
    });
    h.session.join("main", ana, "owner");
    h.session.note("main", "ana", "one");
    h.session.note("main", "ana", "two");
    const all = h.session.events("main");
    expect(h.eventsSince("main")).toEqual(all);
    expect(h.eventsSince("main", 1).map((e) => e.seq)).toEqual(all.slice(2).map((e) => e.seq));
    expect(h.eventsSince("main", all.length - 1)).toEqual([]);
    expect(h.eventsSince("main", all.length)).toEqual(all);
    h.close();
  });
});
