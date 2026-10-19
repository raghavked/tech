/**
 * The storage seam. Every edition keeps the same logs (sessions, project ledgers, org memory,
 * org chat) and the same documents (orgs, users, push subscriptions); what differs is where.
 * Starter keeps them as JSON files under a folder (`FileStore`); Team and Enterprise keep them
 * in a database (`PostgresStore`). The hosts fold whichever they are given.
 *
 * Two views of one seam:
 *
 * - `Store` is what an implementation provides. A file answers at once and a database answers
 *   later, so every caller of a `Store` awaits (`Soon<T>` is `T | Promise<T>`).
 * - `LiveStore` is what a host needs: the same operations, synchronous, because a host folds
 *   its log in memory and answers a websocket message without waiting on the disk. The file
 *   store is a `LiveStore` directly; a database is mirrored into one by `MirrorStore`, which
 *   loads on start and writes through.
 */
import type { BranchMeta, ChainEvent, SerializedChain } from "@henosis/kernel";

/** The four logs. A `ledger` is a project's, `memory` and `chat` are an organisation's. */
export type LogKind = "session" | "ledger" | "memory" | "chat";
export const LOG_KINDS: readonly LogKind[] = ["session", "ledger", "memory", "chat"];

/** Any hash-chained log as it is persisted: a session log, a ledger, a memory or a chat. */
export type AnyLog = SerializedChain<ChainEvent>;

export type Soon<T> = T | Promise<T>;

export interface Store {
  /** The whole log, or null when the store has no log of that kind and id. */
  readLog(kind: LogKind, id: string): Soon<AnyLog | null>;
  /** Replace the log (create it when absent). */
  writeLog(kind: LogKind, id: string, log: AnyLog): Soon<void>;
  /**
   * Append events (each carries its branch and seq) to a log, creating it when absent. A
   * database appends rows; a file rewrites. `branches` is the log's full, ordered branch list
   * and is passed when a branch was created since the last append (the store upserts them).
   */
  appendEvents(kind: LogKind, id: string, events: ChainEvent[], branches?: BranchMeta[]): Soon<void>;
  /** Ids of every log of a kind, sorted. */
  listLogs(kind: LogKind): Soon<string[]>;
  /** A document (orgs, users, push), or null when absent. */
  readDoc(name: string): Soon<unknown>;
  writeDoc(name: string, json: unknown): Soon<void>;
  /** Names of every document, sorted. */
  listDocs(): Soon<string[]>;
  /** Flush and release connections; the store is not used after. */
  close(): Soon<void>;
}

/** The synchronous view a host folds from and writes to; see the module comment. */
export interface LiveStore {
  readLog(kind: LogKind, id: string): AnyLog | null;
  writeLog(kind: LogKind, id: string, log: AnyLog): void;
  appendEvents(kind: LogKind, id: string, events: ChainEvent[], branches?: BranchMeta[]): void;
  listLogs(kind: LogKind): string[];
  readDoc(name: string): unknown;
  writeDoc(name: string, json: unknown): void;
  listDocs(): string[];
  /** Resolves once every write so far has reached the durable copy (at once for a file). */
  flush(): Promise<void>;
  close(): Promise<void>;
}

const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

/** Log ids and doc names name files and rows; the same rule for every store. */
export function checkId(what: string, id: string): string {
  if (!ID.test(id)) throw new Error(`bad ${what} id ${id}`);
  return id;
}

/** A log's events in persisted order: branch by branch (creation order), seq ascending. */
export function eventsOf(log: AnyLog): ChainEvent[] {
  const out: ChainEvent[] = [];
  for (const b of log.branches) out.push(...(log.events[b.name] ?? []));
  return out;
}

/** An empty log, the shape `ChainLog.serialize()` gives before any event. */
export function emptyLog(): AnyLog {
  return { version: 1, branches: [], events: {} };
}

/** A copy that shares the event objects but none of the arrays, so callers may not alias the store. */
export function copyLog(log: AnyLog): AnyLog {
  const events: Record<string, ChainEvent[]> = {};
  for (const b of log.branches) events[b.name] = [...(log.events[b.name] ?? [])];
  return { version: 1, branches: log.branches.map((b) => ({ ...b })), events };
}

/** Apply an append to a log held in memory (the file store and the mirror both do this). */
export function applyAppend(log: AnyLog, events: ChainEvent[], branches?: BranchMeta[]): void {
  if (branches) {
    log.branches = branches.map((b) => ({ ...b }));
    for (const b of branches) if (!log.events[b.name]) log.events[b.name] = [];
  }
  for (const e of events) {
    let own = log.events[e.branch];
    if (!own) {
      // An event on a branch the caller never announced: keep it rather than lose it.
      own = [];
      log.events[e.branch] = own;
      if (!log.branches.some((b) => b.name === e.branch))
        log.branches.push({ name: e.branch, parent: null, forkPoint: null, createdSeq: 0 });
    }
    const last = own[own.length - 1];
    if (last && e.seq <= last.seq) {
      // A re-sent event (a second flush of the same tail) replaces its seq in place.
      const at = own.findIndex((x) => x.seq === e.seq);
      if (at >= 0) own[at] = e;
      continue;
    }
    own.push(e);
  }
}
