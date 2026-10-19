/**
 * The storage seam: one suite, two stores. The file store is the folder every store has been
 * so far; the Postgres store runs on pg-mem, so no database is needed. Both must append, read
 * back, fold to the same head hash, list, and round-trip documents the same way.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkReplay, hashValue, Session } from "@henosis/kernel";
import { type Actor, DEFAULT_SESSION_POLICY } from "@henosis/protocol";
import { newDb } from "pg-mem";
import { afterEach, describe, expect, it } from "vitest";
import { readLog as readLogFile, sessionDir } from "../src/storage.js";
import {
  type AnyLog,
  eventsOf,
  FileStore,
  headHash,
  LOG_KINDS,
  LogWriter,
  MirrorStore,
  type PgPool,
  PostgresStore,
  type Store,
} from "../src/store/index.js";

const ana: Actor = { id: "ana", kind: "human", name: "Ana" };

/** A session log with two branches, the shape every store has to keep. */
function sampleSession(): Session {
  const s = Session.create("s1", "Sample", DEFAULT_SESSION_POLICY);
  s.join("main", ana, "owner");
  s.note("main", "ana", "first");
  s.writeFile("main", "ana", "a.txt", "hello");
  s.checkpoint("main", "ana", "cp1");
  s.fork("main", "ana", "spike");
  s.note("spike", "ana", "on the spike");
  s.note("main", "ana", "back on main");
  return s;
}

/** pg-mem gives a `pg`-shaped pool; a fresh one per call on the same database. */
function memPool(db: ReturnType<typeof newDb>): PgPool {
  const { Pool } = db.adapters.createPg();
  return new Pool() as unknown as PgPool;
}

async function memStore(
  db = newDb(),
): Promise<{ db: ReturnType<typeof newDb>; store: PostgresStore }> {
  const store = new PostgresStore(memPool(db));
  await store.ensureSchema();
  return { db, store };
}

interface Fixture {
  store: Store;
  cleanup(): Promise<void>;
}

const fixtures: [string, () => Promise<Fixture>][] = [
  [
    "file",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "henosis-store-"));
      return { store: new FileStore(root), cleanup: async () => rmSync(root, { recursive: true }) };
    },
  ],
  [
    "postgres",
    async () => {
      const { store } = await memStore();
      return { store, cleanup: () => store.close() };
    },
  ],
];

describe.each(fixtures)("store: %s", (_name, open) => {
  let fx: Fixture;
  afterEach(async () => {
    await fx?.cleanup();
  });

  it("writes a log, reads it back, folds to the same head hash", async () => {
    fx = await open();
    const s = sampleSession();
    const log = s.log.serialize();
    expect(await fx.store.readLog("session", "s1")).toBeNull();
    await fx.store.writeLog("session", "s1", log);
    const back = (await fx.store.readLog("session", "s1")) as AnyLog;
    expect(back.branches).toEqual(log.branches);
    expect(hashValue(back)).toBe(hashValue(log));
    expect(headHash(back)).toEqual(headHash(log));
    const again = Session.fromSerialized(back as typeof log);
    for (const b of again.branches()) expect(checkReplay(again.log, b).ok).toBe(true);
    expect(again.state("spike").notes.at(-1)?.text).toBe("on the spike");
  });

  it("appends events (and a new branch) instead of rewriting, and reads the same log", async () => {
    fx = await open();
    const s = sampleSession();
    const full = s.log.serialize();
    const mainEvents = full.events.main ?? [];
    // Persist the first three events of main, then append the rest in two batches.
    await fx.store.writeLog("session", "s1", {
      version: 1,
      branches: [full.branches[0] as (typeof full.branches)[number]],
      events: { main: mainEvents.slice(0, 3) },
    });
    const forkedAt = mainEvents.findIndex((e) => e.kind === "branch.created");
    await fx.store.appendEvents("session", "s1", mainEvents.slice(3, forkedAt + 1), full.branches);
    await fx.store.appendEvents("session", "s1", [
      ...(full.events.spike ?? []),
      ...mainEvents.slice(forkedAt + 1),
    ]);
    const back = (await fx.store.readLog("session", "s1")) as AnyLog;
    expect(back.branches).toEqual(full.branches);
    expect(hashValue(back)).toBe(hashValue(full));
    expect(headHash(back)).toEqual(headHash(full));
    expect(eventsOf(back).length).toBe(eventsOf(full).length);
    // Appending the same tail twice changes nothing.
    await fx.store.appendEvents("session", "s1", mainEvents.slice(-2));
    expect(hashValue(await fx.store.readLog("session", "s1"))).toBe(hashValue(full));
  });

  it("appends to a log the store never saw", async () => {
    fx = await open();
    const s = sampleSession();
    const full = s.log.serialize();
    await fx.store.appendEvents("ledger", "p1", full.events.main ?? []);
    const back = (await fx.store.readLog("ledger", "p1")) as AnyLog;
    expect(back.branches.map((b) => b.name)).toEqual(["main"]);
    expect(back.events.main?.length).toBe(full.events.main?.length);
    expect(await fx.store.listLogs("ledger")).toEqual(["p1"]);
  });

  it("lists logs per kind", async () => {
    fx = await open();
    const log = sampleSession().log.serialize();
    for (const kind of LOG_KINDS) expect(await fx.store.listLogs(kind)).toEqual([]);
    await fx.store.writeLog("session", "s2", log);
    await fx.store.writeLog("session", "s1", log);
    await fx.store.writeLog("ledger", "billing", log);
    await fx.store.writeLog("memory", "acme", log);
    await fx.store.writeLog("chat", "acme", log);
    expect(await fx.store.listLogs("session")).toEqual(["s1", "s2"]);
    expect(await fx.store.listLogs("ledger")).toEqual(["billing"]);
    expect(await fx.store.listLogs("memory")).toEqual(["acme"]);
    expect(await fx.store.listLogs("chat")).toEqual(["acme"]);
    // A rewrite replaces, never duplicates.
    await fx.store.writeLog("session", "s1", log);
    expect(await fx.store.listLogs("session")).toEqual(["s1", "s2"]);
    expect(hashValue(await fx.store.readLog("session", "s1"))).toBe(hashValue(log));
  });

  it("round-trips documents", async () => {
    fx = await open();
    expect(await fx.store.readDoc("orgs")).toBeNull();
    expect(await fx.store.listDocs()).toEqual([]);
    const orgs = { orgs: [{ id: "acme", name: "Acme", teams: [] }] };
    await fx.store.writeDoc("orgs", orgs);
    await fx.store.writeDoc("push", { subs: [{ userId: "ana", platform: "web", token: "t" }] });
    expect(await fx.store.readDoc("orgs")).toEqual(orgs);
    expect(await fx.store.listDocs()).toEqual(["orgs", "push"]);
    await fx.store.writeDoc("push", { subs: [] });
    expect(await fx.store.readDoc("push")).toEqual({ subs: [] });
    expect(await fx.store.listDocs()).toEqual(["orgs", "push"]);
  });

  it("refuses ids that could leave the store", async () => {
    fx = await open();
    await expect(async () => await fx.store.readLog("session", "../x")).rejects.toThrow(/bad/);
    await expect(async () => await fx.store.writeDoc("a/b", {})).rejects.toThrow(/bad/);
  });
});

describe("file store layout", () => {
  let root: string;
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("keeps the folder every store has had, byte for byte", () => {
    root = mkdtempSync(join(tmpdir(), "henosis-layout-"));
    const store = new FileStore(root);
    const log = sampleSession().log.serialize();
    store.writeLog("session", "s1", log);
    store.writeLog("ledger", "billing", log);
    store.writeLog("memory", "acme", log);
    store.writeLog("chat", "acme", log);
    const bytes = JSON.stringify(log);
    expect(readFileSync(join(root, "sessions", "s1", "log.json"), "utf8")).toBe(bytes);
    expect(readFileSync(join(root, "projects", "billing", "ledger.json"), "utf8")).toBe(bytes);
    expect(readFileSync(join(root, "memory", "acme.json"), "utf8")).toBe(bytes);
    expect(readFileSync(join(root, "chat", "acme.json"), "utf8")).toBe(bytes);
    // The legacy reader sees the same file.
    expect(JSON.stringify(readLogFile(sessionDir(root, "s1")))).toBe(bytes);
    // Documents: orgs.json stays hand-editable, push.json compact.
    store.writeDoc("orgs", { orgs: [] });
    store.writeDoc("push", { subs: [] });
    expect(readFileSync(join(root, "orgs.json"), "utf8")).toBe(
      `${JSON.stringify({ orgs: [] }, null, 2)}\n`,
    );
    expect(readFileSync(join(root, "push.json"), "utf8")).toBe('{"subs":[]}');
    expect(store.listDocs()).toEqual(["orgs", "push"]);
  });

  it("an append through the writer leaves the same bytes a full write would", () => {
    root = mkdtempSync(join(tmpdir(), "henosis-layout-"));
    const store = new FileStore(root);
    const s = Session.create("s1", "Sample", DEFAULT_SESSION_POLICY);
    const w = new LogWriter(store, "session", "s1");
    expect(w.flush(s.log.serialize())).toBe("written");
    s.join("main", ana, "owner");
    s.note("main", "ana", "one");
    expect(w.flush(s.log.serialize())).toBe("appended");
    expect(w.flush(s.log.serialize())).toBe("unchanged");
    s.fork("main", "ana", "spike");
    s.note("spike", "ana", "two");
    expect(w.flush(s.log.serialize())).toBe("appended");
    expect(readFileSync(join(root, "sessions", "s1", "log.json"), "utf8")).toBe(
      JSON.stringify(s.log.serialize()),
    );
    // A writer seeded with what the store holds appends from there, never rewriting.
    const reopened = new FileStore(root);
    const w2 = new LogWriter(reopened, "session", "s1", reopened.readLog("session", "s1"));
    expect(w2.flush(s.log.serialize())).toBe("unchanged");
    s.note("main", "ana", "three");
    expect(w2.flush(s.log.serialize())).toBe("appended");
    expect(readFileSync(join(root, "sessions", "s1", "log.json"), "utf8")).toBe(
      JSON.stringify(s.log.serialize()),
    );
    expect(existsSync(join(root, "sessions", "s1", "log.json.tmp"))).toBe(false);
  });
});

describe("mirror store over postgres", () => {
  it("answers at once, writes through in order, and a fresh mirror sees everything", async () => {
    const { db, store } = await memStore();
    const mirror = await MirrorStore.open(store);
    const s = sampleSession();
    const log = s.log.serialize();
    expect(mirror.listLogs("session")).toEqual([]);
    const w = new LogWriter(mirror, "session", "s1");
    w.flush({
      version: 1,
      branches: [log.branches[0] as (typeof log.branches)[number]],
      events: { main: (log.events.main ?? []).slice(0, 2) },
    });
    w.flush(log);
    mirror.writeDoc("orgs", { orgs: [] });
    // Synchronous view before anything reached the database.
    expect(mirror.listLogs("session")).toEqual(["s1"]);
    expect(hashValue(mirror.readLog("session", "s1"))).toBe(hashValue(log));
    expect(mirror.readDoc("orgs")).toEqual({ orgs: [] });
    await mirror.flush();
    expect(hashValue(await store.readLog("session", "s1"))).toBe(hashValue(log));
    await mirror.close();
    const again = await MirrorStore.open(new PostgresStore(memPool(db)));
    expect(again.listLogs("session")).toEqual(["s1"]);
    expect(hashValue(again.readLog("session", "s1"))).toBe(hashValue(log));
    expect(again.listDocs()).toEqual(["orgs"]);
    await again.close();
  });

  it("reports a write the database refused", async () => {
    const { store } = await memStore();
    const lines: string[] = [];
    let closed = false;
    const flaky: Store = {
      readLog: (k, id) => store.readLog(k, id),
      writeLog: (k, id, log) => store.writeLog(k, id, log),
      appendEvents: (k, id, ev, br) => store.appendEvents(k, id, ev, br),
      listLogs: (k) => store.listLogs(k),
      readDoc: (n) => store.readDoc(n),
      writeDoc: () => Promise.reject(new Error("connection lost")),
      listDocs: () => store.listDocs(),
      close: async () => {
        closed = true;
        await store.close();
      },
    };
    const mirror = await MirrorStore.open(flaky, { log: (l) => lines.push(l) });
    mirror.writeDoc("orgs", { orgs: [] });
    mirror.writeLog("session", "s1", sampleSession().log.serialize());
    await expect(mirror.flush()).rejects.toThrow(/connection lost/);
    expect(lines).toEqual(["store: write failed: connection lost"]);
    // The queue kept going past the failure; the second write landed.
    expect(await store.listLogs("session")).toEqual(["s1"]);
    await mirror.close();
    expect(closed).toBe(true);
  });
});
