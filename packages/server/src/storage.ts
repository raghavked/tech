/**
 * Disk persistence: the serialized log as JSON and blobs by hash. Writes are atomic
 * (temp file + rename) so a crash never leaves a half-written log.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { MemoryBlobStore, type SerializedLog } from "@henosis/kernel";

export class FileBlobStore extends MemoryBlobStore {
  constructor(private readonly dir: string) {
    super();
    mkdirSync(dir, { recursive: true });
    for (const name of readdirSync(dir)) {
      if (/^[0-9a-f]{64}$/.test(name)) this.blobs.set(name, readFileSync(join(dir, name), "utf8"));
    }
  }
  override put(content: string): string {
    const h = super.put(content);
    const path = join(this.dir, h);
    if (!existsSync(path)) atomicWrite(path, content);
    return h;
  }
}

export function atomicWrite(path: string, content: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

export function sessionDir(root: string, sessionId: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(sessionId))
    throw new Error(`bad session id ${sessionId}`);
  return join(root, "sessions", sessionId);
}

export function readLog(dir: string): SerializedLog | null {
  const path = join(dir, "log.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as SerializedLog;
}

export function writeLog(dir: string, log: SerializedLog): void {
  mkdirSync(dir, { recursive: true });
  atomicWrite(join(dir, "log.json"), JSON.stringify(log));
}

export function listSessions(root: string): string[] {
  const dir = join(root, "sessions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => existsSync(join(dir, n, "log.json")));
}
