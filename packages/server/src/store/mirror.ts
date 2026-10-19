/**
 * MirrorStore: a database as a `LiveStore`. `open()` loads every log and document into memory;
 * reads answer from the mirror and writes update it at once and reach the database in order
 * on a queue. `flush()` waits for the queue; `close()` flushes and closes the database.
 *
 * The hosts already hold every open log folded in memory, so the mirror costs little more
 * than the arrays that point at the same event objects. Nothing else writes the database
 * while a server owns it (one process per org in the Team edition), which is what makes a
 * load-on-start mirror sound.
 */
import type { BranchMeta, ChainEvent } from "@henosis/kernel";
import {
  type AnyLog,
  applyAppend,
  copyLog,
  emptyLog,
  type LiveStore,
  LOG_KINDS,
  type LogKind,
  type Store,
} from "./types.js";

export interface MirrorOptions {
  log?: ((line: string) => void) | undefined;
}

export class MirrorStore implements LiveStore {
  private readonly logs = new Map<string, AnyLog>();
  private readonly docs = new Map<string, unknown>();
  private tail: Promise<void> = Promise.resolve();
  private failed: Error | null = null;
  private readonly log: (line: string) => void;

  private constructor(
    readonly inner: Store,
    opts: MirrorOptions,
  ) {
    this.log = opts.log ?? (() => {});
  }

  /** Load the whole store and return the mirror. */
  static async open(inner: Store, opts: MirrorOptions = {}): Promise<MirrorStore> {
    const m = new MirrorStore(inner, opts);
    for (const kind of LOG_KINDS)
      for (const id of await inner.listLogs(kind)) {
        const log = await inner.readLog(kind, id);
        if (log) m.logs.set(`${kind}/${id}`, log);
      }
    for (const name of await inner.listDocs()) m.docs.set(name, await inner.readDoc(name));
    return m;
  }

  readLog(kind: LogKind, id: string): AnyLog | null {
    const log = this.logs.get(`${kind}/${id}`);
    return log ? copyLog(log) : null;
  }

  writeLog(kind: LogKind, id: string, log: AnyLog): void {
    this.logs.set(`${kind}/${id}`, copyLog(log));
    const snapshot = copyLog(log);
    this.enqueue(() => this.inner.writeLog(kind, id, snapshot));
  }

  appendEvents(kind: LogKind, id: string, events: ChainEvent[], branches?: BranchMeta[]): void {
    const key = `${kind}/${id}`;
    let log = this.logs.get(key);
    if (!log) {
      log = emptyLog();
      this.logs.set(key, log);
    }
    applyAppend(log, events, branches);
    const evs = [...events];
    const brs = branches ? branches.map((b) => ({ ...b })) : undefined;
    this.enqueue(() => this.inner.appendEvents(kind, id, evs, brs));
  }

  listLogs(kind: LogKind): string[] {
    const prefix = `${kind}/`;
    return [...this.logs.keys()]
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length))
      .sort();
  }

  readDoc(name: string): unknown {
    return this.docs.get(name) ?? null;
  }

  writeDoc(name: string, json: unknown): void {
    const snapshot: unknown = JSON.parse(JSON.stringify(json));
    this.docs.set(name, snapshot);
    this.enqueue(() => this.inner.writeDoc(name, snapshot));
  }

  listDocs(): string[] {
    return [...this.docs.keys()].sort();
  }

  /** Every write so far has reached the database, or the first one that did not is thrown. */
  async flush(): Promise<void> {
    await this.tail;
    if (this.failed) {
      const err = this.failed;
      this.failed = null;
      throw err;
    }
  }

  async close(): Promise<void> {
    try {
      await this.flush();
    } finally {
      await this.inner.close();
    }
  }

  private enqueue(fn: () => Promise<void> | void): void {
    this.tail = this.tail.then(fn).catch((err: unknown) => {
      const e = err instanceof Error ? err : new Error(String(err));
      this.failed ??= e;
      this.log(`store: write failed: ${e.message}`);
    });
  }
}
