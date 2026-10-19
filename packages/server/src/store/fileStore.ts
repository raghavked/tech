/**
 * FileStore: the Starter edition's store, a folder of JSON files written atomically. The
 * layout is the one every existing store folder has, byte for byte:
 *
 *   sessions/<id>/log.json      the session log (and blobs/<sha256> beside it)
 *   projects/<id>/ledger.json   the project ledger
 *   memory/<id>.json            an organisation's memory
 *   chat/<id>.json              an organisation's chat
 *   orgs.json, users.json, push.json   documents
 *
 * It is a `Store` and a `LiveStore` at once: every method answers synchronously. An append
 * rewrites the file from a copy of the log kept in memory, so a flush never re-reads the disk.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { BranchMeta, ChainEvent } from "@henosis/kernel";
import { atomicWrite, listSessions, sessionDir } from "../storage.js";
import {
  type AnyLog,
  applyAppend,
  checkId,
  copyLog,
  emptyLog,
  type LiveStore,
  type LogKind,
  type Store,
} from "./types.js";

/** Hand-edited documents keep the pretty layout they always had; the rest are compact. */
const PRETTY_DOCS = new Set(["orgs", "users"]);

export class FileStore implements Store, LiveStore {
  /** The last log read or written per kind/id; an append extends it and rewrites the file. */
  private readonly logs = new Map<string, AnyLog>();

  constructor(readonly root: string) {}

  /** Where a log of this kind lives. */
  logPath(kind: LogKind, id: string): string {
    checkId(kind, id);
    switch (kind) {
      case "session":
        return join(sessionDir(this.root, id), "log.json");
      case "ledger":
        return join(this.root, "projects", id, "ledger.json");
      case "memory":
        return join(this.root, "memory", `${id}.json`);
      case "chat":
        return join(this.root, "chat", `${id}.json`);
    }
  }

  docPath(name: string): string {
    return join(this.root, `${checkId("doc", name)}.json`);
  }

  readLog(kind: LogKind, id: string): AnyLog | null {
    const path = this.logPath(kind, id);
    if (!existsSync(path)) return null;
    const log = JSON.parse(readFileSync(path, "utf8")) as AnyLog;
    this.logs.set(`${kind}/${id}`, log);
    return copyLog(log);
  }

  writeLog(kind: LogKind, id: string, log: AnyLog): void {
    const kept = copyLog(log);
    this.logs.set(`${kind}/${id}`, kept);
    this.persist(kind, id, kept);
  }

  appendEvents(kind: LogKind, id: string, events: ChainEvent[], branches?: BranchMeta[]): void {
    const key = `${kind}/${id}`;
    let log = this.logs.get(key);
    if (!log) {
      const path = this.logPath(kind, id);
      log = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as AnyLog) : emptyLog();
      this.logs.set(key, log);
    }
    applyAppend(log, events, branches);
    this.persist(kind, id, log);
  }

  listLogs(kind: LogKind): string[] {
    switch (kind) {
      case "session":
        return listSessions(this.root).sort();
      case "ledger": {
        const dir = join(this.root, "projects");
        if (!existsSync(dir)) return [];
        return readdirSync(dir)
          .filter((n) => existsSync(join(dir, n, "ledger.json")))
          .sort();
      }
      case "memory":
      case "chat": {
        const dir = join(this.root, kind);
        if (!existsSync(dir)) return [];
        return readdirSync(dir)
          .filter((n) => n.endsWith(".json"))
          .map((n) => basename(n, ".json"))
          .sort();
      }
    }
  }

  readDoc(name: string): unknown {
    const path = this.docPath(name);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8"));
  }

  writeDoc(name: string, json: unknown): void {
    mkdirSync(this.root, { recursive: true });
    atomicWrite(
      this.docPath(name),
      PRETTY_DOCS.has(name) ? `${JSON.stringify(json, null, 2)}\n` : JSON.stringify(json),
    );
  }

  listDocs(): string[] {
    if (!existsSync(this.root)) return [];
    return readdirSync(this.root, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(".json"))
      .map((d) => basename(d.name, ".json"))
      .sort();
  }

  flush(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.logs.clear();
    return Promise.resolve();
  }

  private persist(kind: LogKind, id: string, log: AnyLog): void {
    const path = this.logPath(kind, id);
    mkdirSync(dirname(path), { recursive: true });
    atomicWrite(path, JSON.stringify(log));
  }
}
