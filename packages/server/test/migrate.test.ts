/**
 * `henosis migrate`: a store folder goes into Postgres (pg-mem) and back out into a new
 * folder; every log folds to the same head hash on each side, and a copy that does not is
 * refused.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Chat } from "@henosis/chat";
import { Project } from "@henosis/fleet";
import { checkReplay, hashValue, Session } from "@henosis/kernel";
import { MemoryStore } from "@henosis/memory";
import { type Actor, DEFAULT_SESSION_POLICY } from "@henosis/protocol";
import { newDb } from "pg-mem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type AnyLog,
  FileStore,
  headHash,
  migrateStore,
  type PgPool,
  PostgresStore,
  renderMigrateTable,
  type Store,
} from "../src/store/index.js";

const ana: Actor = { id: "ana", kind: "human", name: "Ana" };

function memPool(db: ReturnType<typeof newDb>): PgPool {
  const { Pool } = db.adapters.createPg();
  return new Pool() as unknown as PgPool;
}

/** A folder with one of every log and two documents, as a Starter server leaves it. */
function seed(root: string): FileStore {
  const store = new FileStore(root);
  const s = Session.create("demo", "Demo", DEFAULT_SESSION_POLICY, { projectId: "billing" });
  s.join("main", ana, "owner");
  s.writeFile("main", "ana", "README.md", "# hi");
  s.checkpoint("main", "ana", "cp");
  s.fork("main", "ana", "spike");
  s.note("spike", "ana", "spiking");
  s.note("main", "ana", "mainline");
  store.writeLog("session", "demo", s.log.serialize());
  const s2 = Session.create("other", "Other", DEFAULT_SESSION_POLICY, { projectId: "billing" });
  s2.join("main", ana, "owner");
  store.writeLog("session", "other", s2.log.serialize());
  const p = Project.create("billing", "acme", "payments", "Billing", {
    autoClaimOnWrite: true,
    claimTtlTurns: 0,
  });
  p.join("ana", "Ana", "lead");
  p.registerSession("demo", "ana", "Demo");
  store.writeLog("ledger", "billing", p.ledger.serialize());
  const m = MemoryStore.create("acme");
  m.remember({
    scope: { orgId: "acme" },
    content: "deploys go through CI",
    attribution: { userId: "ana", agentId: "agent", sessionId: "demo" },
  });
  store.writeLog("memory", "acme", m.ledger.serialize());
  const c = Chat.create("acme");
  c.createGroup("ana", { name: "general" });
  store.writeLog("chat", "acme", c.log.serialize());
  store.writeDoc("orgs", {
    orgs: [
      {
        id: "acme",
        name: "Acme",
        teams: [
          { id: "payments", name: "Payments", projects: [{ id: "billing", name: "Billing" }] },
        ],
      },
    ],
  });
  store.writeDoc("push", { subs: [{ userId: "ana", platform: "web", token: "t" }] });
  return store;
}

describe("henosis migrate", () => {
  let from: string;
  let back: string;
  beforeAll(() => {
    from = mkdtempSync(join(tmpdir(), "henosis-mig-from-"));
    back = mkdtempSync(join(tmpdir(), "henosis-mig-back-"));
  });
  afterAll(() => {
    rmSync(from, { recursive: true, force: true });
    rmSync(back, { recursive: true, force: true });
  });

  it("copies a folder into postgres and back; every head hash matches", async () => {
    const source = seed(from);
    const db = newDb();
    const pg = new PostgresStore(memPool(db));
    await pg.ensureSchema();
    const up = await migrateStore(source, pg);
    expect(up.ok).toBe(true);
    expect(up.rows.map((r) => `${r.kind}:${r.id}`)).toEqual([
      "session:demo",
      "session:other",
      "ledger:billing",
      "memory:acme",
      "chat:acme",
      "doc:orgs",
      "doc:push",
    ]);
    expect(up.rows.find((r) => r.id === "demo")?.branches).toBe(2);
    const table = renderMigrateTable(up);
    expect(table).toContain("session  demo");
    expect(table).toContain("7 verified; every head hash matches.");
    await pg.close();

    const target = new FileStore(back);
    const down = await migrateStore(new PostgresStore(memPool(db)), target);
    expect(down.ok).toBe(true);
    expect(down.rows).toHaveLength(7);
    for (const kind of ["session", "ledger", "memory", "chat"] as const)
      for (const id of source.listLogs(kind)) {
        const a = source.readLog(kind, id) as AnyLog;
        const b = target.readLog(kind, id) as AnyLog;
        expect(headHash(b)).toEqual(headHash(a));
        expect(hashValue(b)).toBe(hashValue(a));
      }
    // The round-tripped session folds like the original, branch by branch.
    const s = Session.fromSerialized(target.readLog("session", "demo") as never);
    for (const b of s.branches()) expect(checkReplay(s.log, b).ok).toBe(true);
    expect(s.state("spike").notes.at(-1)?.text).toBe("spiking");
    // Documents come back as the same files.
    expect(readFileSync(join(back, "orgs.json"), "utf8")).toBe(
      readFileSync(join(from, "orgs.json"), "utf8"),
    );
    expect(readFileSync(join(back, "push.json"), "utf8")).toBe(
      readFileSync(join(from, "push.json"), "utf8"),
    );
  });

  it("refuses to finish when a copy does not fold to the same head", async () => {
    const source = new FileStore(from);
    const db = newDb();
    const pg = new PostgresStore(memPool(db));
    await pg.ensureSchema();
    // A target that quietly drops the last event of every log it is given.
    const lossy: Store = {
      readLog: (k, id) => pg.readLog(k, id),
      writeLog: (k, id, log) => {
        const events = Object.fromEntries(
          Object.entries(log.events).map(([b, evs]) => [b, evs.slice(0, -1)]),
        );
        return pg.writeLog(k, id, { ...log, events });
      },
      appendEvents: (k, id, ev, br) => pg.appendEvents(k, id, ev, br),
      listLogs: (k) => pg.listLogs(k),
      readDoc: (n) => pg.readDoc(n),
      writeDoc: (n, j) => pg.writeDoc(n, j),
      listDocs: () => pg.listDocs(),
      close: () => pg.close(),
    };
    const report = await migrateStore(source, lossy);
    expect(report.ok).toBe(false);
    const bad = report.rows.filter((r) => !r.ok);
    expect(bad.map((r) => r.id)).toEqual(["demo", "other", "billing", "acme", "acme"]);
    expect(bad.every((r) => r.reason === "head hash differs")).toBe(true);
    expect(report.rows.filter((r) => r.kind === "doc").every((r) => r.ok)).toBe(true);
    const table = renderMigrateTable(report);
    expect(table).toContain("MISMATCH (head hash differs)");
    expect(table).toContain("5 of 7 did not verify; the migration is not complete.");
    await pg.close();
  });
});
