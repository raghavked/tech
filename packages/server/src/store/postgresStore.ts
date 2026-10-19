/**
 * PostgresStore: the Team and Enterprise editions' store. The same logs as the folder, one
 * row per event, with the hash chain intact so `henosis migrate` can prove a copy faithful.
 *
 *   branches (kind, log_id, name, parent, fork_point, created_seq, ord)   one row per branch
 *   events   (kind, log_id, branch, seq, event jsonb)                     one row per event
 *   docs     (name, json jsonb)                                           orgs, users, push
 *
 * A log exists when it has a branch row. `appendEvents` inserts rows; `writeLog` replaces the
 * log in one transaction. The connection comes from `HENOSIS_DATABASE_URL` (`connect()`), or
 * any pool with the `pg` shape, which is how the tests run it on pg-mem without a server.
 */
import type { BranchMeta, ChainEvent } from "@henosis/kernel";
import { type AnyLog, checkId, type LogKind, type Store } from "./types.js";

export interface PgQueryable {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/** The part of a `pg.Pool` the store uses; pg-mem's adapter provides the same. */
export interface PgPool extends PgQueryable {
  connect(): Promise<PgQueryable & { release(): void }>;
  end(): Promise<void>;
}

const SCHEMA = [
  `create table if not exists branches (
    kind text not null,
    log_id text not null,
    name text not null,
    parent text,
    fork_point text,
    created_seq integer not null,
    ord integer not null,
    primary key (kind, log_id, name)
  )`,
  `create table if not exists events (
    kind text not null,
    log_id text not null,
    branch text not null,
    seq integer not null,
    event jsonb not null,
    primary key (kind, log_id, branch, seq)
  )`,
  `create table if not exists docs (
    name text primary key,
    json jsonb not null
  )`,
];

const UPSERT_BRANCH = `insert into branches (kind, log_id, name, parent, fork_point, created_seq, ord)
  values ($1, $2, $3, $4, $5, $6, $7)
  on conflict (kind, log_id, name) do update
  set parent = excluded.parent, fork_point = excluded.fork_point,
      created_seq = excluded.created_seq, ord = excluded.ord`;

/** Rows per insert statement; well under the driver's parameter limit. */
const CHUNK = 200;

export class PostgresStore implements Store {
  constructor(private readonly pool: PgPool) {}

  /** A store on the database `HENOSIS_DATABASE_URL` (or `url`) names; the schema is not created here. */
  static async connect(url = process.env.HENOSIS_DATABASE_URL): Promise<PostgresStore> {
    if (!url) throw new Error("HENOSIS_DATABASE_URL is unset; pass --database-url or set it");
    const mod = (await import("pg")) as unknown as {
      default?: { Pool: new (opts: { connectionString: string }) => PgPool };
      Pool?: new (opts: { connectionString: string }) => PgPool;
    };
    const Pool = mod.default?.Pool ?? mod.Pool;
    if (!Pool) throw new Error("the pg driver did not export Pool");
    return new PostgresStore(new Pool({ connectionString: url }));
  }

  /** Create the three tables when they are missing; safe to run on every start. */
  async ensureSchema(): Promise<void> {
    for (const ddl of SCHEMA) await this.pool.query(ddl);
  }

  async readLog(kind: LogKind, id: string): Promise<AnyLog | null> {
    checkId(kind, id);
    const branches = await this.pool.query(
      `select name, parent, fork_point, created_seq from branches
       where kind = $1 and log_id = $2 order by ord, name`,
      [kind, id],
    );
    if (!branches.rows.length) return null;
    const rows = await this.pool.query(
      `select branch, event from events where kind = $1 and log_id = $2 order by branch, seq`,
      [kind, id],
    );
    const events: Record<string, ChainEvent[]> = {};
    const metas: BranchMeta[] = branches.rows.map((r) => {
      events[r.name as string] = [];
      return {
        name: r.name as string,
        parent: (r.parent as string | null) ?? null,
        forkPoint: (r.fork_point as string | null) ?? null,
        createdSeq: Number(r.created_seq),
      };
    });
    for (const r of rows.rows) {
      const branch = r.branch as string;
      (events[branch] ??= []).push(orderedEvent(r.event));
    }
    return { version: 1, branches: metas, events };
  }

  async writeLog(kind: LogKind, id: string, log: AnyLog): Promise<void> {
    checkId(kind, id);
    await this.transaction(async (c) => {
      await c.query("delete from events where kind = $1 and log_id = $2", [kind, id]);
      await c.query("delete from branches where kind = $1 and log_id = $2", [kind, id]);
      await this.putBranches(c, kind, id, log.branches);
      const all: ChainEvent[] = [];
      for (const b of log.branches) all.push(...(log.events[b.name] ?? []));
      await this.putEvents(c, kind, id, all);
    });
  }

  async appendEvents(
    kind: LogKind,
    id: string,
    events: ChainEvent[],
    branches?: BranchMeta[],
  ): Promise<void> {
    checkId(kind, id);
    if (!events.length && !branches) return;
    await this.transaction(async (c) => {
      if (branches) await this.putBranches(c, kind, id, branches);
      // A branch named by an event but announced by nobody (the first append of a new log,
      // or a caller that skipped `branches`) still gets its row, so the log stays listable.
      const have = await c.query("select name from branches where kind = $1 and log_id = $2", [
        kind,
        id,
      ]);
      const known = new Set(have.rows.map((r) => r.name as string));
      const missing = [...new Set(events.map((e) => e.branch))].filter((n) => !known.has(n));
      if (missing.length)
        await this.putBranches(
          c,
          kind,
          id,
          missing.map((name) => ({ name, parent: null, forkPoint: null, createdSeq: 0 })),
          known.size,
        );
      await this.putEvents(c, kind, id, events);
    });
  }

  async listLogs(kind: LogKind): Promise<string[]> {
    const r = await this.pool.query(
      "select distinct log_id from branches where kind = $1 order by log_id",
      [kind],
    );
    return r.rows.map((x) => x.log_id as string);
  }

  async readDoc(name: string): Promise<unknown> {
    const r = await this.pool.query("select json from docs where name = $1", [
      checkId("doc", name),
    ]);
    return r.rows.length ? (r.rows[0]?.json ?? null) : null;
  }

  async writeDoc(name: string, json: unknown): Promise<void> {
    await this.pool.query(
      `insert into docs (name, json) values ($1, $2::jsonb)
       on conflict (name) do update set json = excluded.json`,
      [checkId("doc", name), JSON.stringify(json)],
    );
  }

  async listDocs(): Promise<string[]> {
    const r = await this.pool.query("select name from docs order by name");
    return r.rows.map((x) => x.name as string);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // ---- internals ---------------------------------------------------------------------

  private async transaction(fn: (c: PgQueryable) => Promise<void>): Promise<void> {
    const c = await this.pool.connect();
    try {
      await c.query("begin");
      try {
        await fn(c);
        await c.query("commit");
      } catch (err) {
        await c.query("rollback").catch(() => {});
        throw err;
      }
    } finally {
      c.release();
    }
  }

  private async putBranches(
    c: PgQueryable,
    kind: LogKind,
    id: string,
    branches: BranchMeta[],
    firstOrd = 0,
  ): Promise<void> {
    for (const [i, b] of branches.entries())
      await c.query(UPSERT_BRANCH, [
        kind,
        id,
        b.name,
        b.parent,
        b.forkPoint,
        b.createdSeq,
        firstOrd + i,
      ]);
  }

  private async putEvents(
    c: PgQueryable,
    kind: LogKind,
    id: string,
    events: ChainEvent[],
  ): Promise<void> {
    for (let at = 0; at < events.length; at += CHUNK) {
      const chunk = events.slice(at, at + CHUNK);
      const values: unknown[] = [];
      const tuples = chunk.map((e, i) => {
        const n = i * 5;
        values.push(kind, id, e.branch, e.seq, JSON.stringify(e));
        return `($${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}, $${n + 5}::jsonb)`;
      });
      await c.query(
        `insert into events (kind, log_id, branch, seq, event) values ${tuples.join(", ")}
         on conflict (kind, log_id, branch, seq) do update set event = excluded.event`,
        values,
      );
    }
  }
}

/** jsonb forgets key order; put the chain fields back in the order the kernel writes them. */
function orderedEvent(raw: unknown): ChainEvent {
  const e = raw as ChainEvent & Record<string, unknown>;
  const { id, prev, seq, branch, ts, actor, kind, payload, ...rest } = e;
  return { id, prev, seq, branch, ts, actor, kind, payload, ...rest } as ChainEvent;
}
