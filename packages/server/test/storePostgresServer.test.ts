/**
 * The Team edition's server: `HenosisServer` on the Postgres store (pg-mem, so no database),
 * one scripted session end to end over the websocket, then a second server on the same
 * database resumes it.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkReplay, fold, type SessionState } from "@henosis/kernel";
import type { Actor, ClientMessage, ServerMessage } from "@henosis/protocol";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { newDb } from "pg-mem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { HenosisServer } from "../src/server.js";
import { MirrorStore, type PgPool, PostgresStore } from "../src/store/index.js";

class Client {
  ws: WebSocket;
  state: SessionState | null = null;
  private waiters: ((m: ServerMessage) => void)[] = [];
  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString()) as ServerMessage;
      if (m.type === "snapshot") this.state = fold(m.events);
      if (m.type === "event" && this.state) this.state = fold([m.event], this.state);
      if (m.type === "event" && m.event.kind === "approval.requested")
        this.send({ type: "vote", approvalId: m.event.payload.approvalId, vote: "approve" });
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
  async until(pred: (s: SessionState) => boolean, ms = 15000): Promise<SessionState> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (this.state && pred(this.state)) return this.state;
      await Promise.race([this.next(), new Promise((r) => setTimeout(r, 100))]);
    }
    throw new Error("timeout waiting for state");
  }
}

const ana: Actor = { id: "ana", kind: "human", name: "Ana" };

function memPool(db: ReturnType<typeof newDb>): PgPool {
  const { Pool } = db.adapters.createPg();
  return new Pool() as unknown as PgPool;
}

describe("server on the postgres store", () => {
  const db = newDb();
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "henosis-pg-"));
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("runs a scripted session end to end and persists every log as rows", async () => {
    const pg = new PostgresStore(memPool(db));
    await pg.ensureSchema();
    const server = new HenosisServer({
      root,
      store: await MirrorStore.open(pg),
      model: new ScriptedModel(),
      tools: defaultTools(),
    });
    const port = await server.listen(0);
    const c = new Client(`ws://127.0.0.1:${port}/ws`);
    await c.open();
    c.send({ type: "join", sessionId: "pg1", actor: ana, branch: "main" });
    await c.until((s) => s.participants.ana?.role === "owner");
    c.send({
      type: "directive",
      input: {
        text: "Build a greeter",
        mode: "steer",
        scope: "goal",
        supersedes: [],
        interrupt: false,
      },
    });
    const done = await c.until(
      (s) => s.turns.length > 0 && s.turns[s.turns.length - 1]?.summary.startsWith("DONE") === true,
    );
    expect(Object.keys(done.workspace)).toContain("src/build_a_greeter.mjs");
    c.send({ type: "note", text: "shipped" });
    await c.until((s) => s.notes.some((n) => n.text === "shipped"));
    c.ws.close();
    // The HTTP API reads through the same store.
    const health = (await (await fetch(`http://127.0.0.1:${port}/health`)).json()) as {
      sessions: string[];
    };
    expect(health.sessions).toEqual(["pg1"]);
    const usage = (await (await fetch(`http://127.0.0.1:${port}/api/usage`)).json()) as {
      totals: { output: number };
    };
    expect(usage.totals.output).toBeGreaterThan(0);
    await server.close();

    // Rows, not files: nothing of the session is under the root but its blobs.
    const check = new PostgresStore(memPool(db));
    expect(await check.listLogs("session")).toEqual(["pg1"]);
    expect(await check.listLogs("ledger")).toEqual(["default"]);
    const log = await check.readLog("session", "pg1");
    expect(log?.events.main?.length ?? 0).toBeGreaterThan(done.seq + 1);
    const ledger = await check.readLog("ledger", "default");
    expect(ledger?.events.main?.some((e) => e.kind === "session.registered")).toBe(true);
    await check.close();
  });

  it("a second server on the same database resumes the session and keeps appending", async () => {
    const pg = new PostgresStore(memPool(db));
    const server = new HenosisServer({
      root,
      store: await MirrorStore.open(pg),
      model: new ScriptedModel(),
      tools: defaultTools(),
    });
    expect(server.sessions()).toEqual(["pg1"]);
    expect(server.projectOfSession("pg1")).toBe("default");
    const host = server.host("pg1");
    expect(host.session.log.verify()).toEqual({ ok: true });
    expect(host.session.state().notes.at(-1)?.text).toBe("shipped");
    expect(host.session.readFile("main", "src/build_a_greeter.mjs")).toBeTruthy();
    const before = host.session.state().seq;
    host.session.join("main", ana, "owner");
    host.session.note("main", "ana", "second run");
    await server.close();

    const check = new PostgresStore(memPool(db));
    const log = await check.readLog("session", "pg1");
    expect(log).not.toBeNull();
    if (!log) throw new Error("no log");
    const events = log.events.main ?? [];
    expect(events.length).toBe(before + 3);
    expect(events.at(-1)?.kind).toBe("note.posted");
    const { Session } = await import("@henosis/kernel");
    const s = Session.fromSerialized(log as never);
    expect(checkReplay(s.log, "main").ok).toBe(true);
    await check.close();
  });
});
