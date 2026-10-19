import type { MemoryEntry, MemoryEvent, MemoryPolicy } from "./events.js";
import { DEFAULT_MEMORY_POLICY } from "./events.js";

/** One recorded read of an entry: who took it into context, at which ledger seq and wall-clock ms. */
export interface MemoryRead {
  by: string;
  seq: number;
  /** Wall clock in ms, or null for a read journaled before the log carried one. */
  at: number | null;
}

/** How many reads an entry keeps, newest last; older ones are counted in `reads` only. */
export const READ_LOG_KEEP = 32;

export interface EntryRecord extends MemoryEntry {
  seq: number;
  status: "active" | "superseded" | "retracted" | "folded" | "redacted";
  /** Ledger seq of the last recorded read; used for staleness. */
  lastReadSeq: number;
  reads: number;
  /** Wall clock of the last read, or null when no read carried one. */
  lastReadAt: number | null;
  /** Distinct readers (session ids, people, "api"), first read first. */
  readBy: string[];
  /** The newest reads, oldest first, at most READ_LOG_KEEP. */
  readLog: MemoryRead[];
}

export interface MemoryConflict {
  id: string;
  key: string;
  scopeKey: string;
  entryIds: string[];
  resolved: boolean;
  winnerId: string | null;
  note: string;
  seq: number;
}

export interface MemoryState {
  orgId: string;
  policy: MemoryPolicy;
  head: string | null;
  seq: number;
  entries: Record<string, EntryRecord>;
  conflicts: Record<string, MemoryConflict>;
  compactions: {
    scopeKey: string;
    level: number;
    summaryId: string;
    folded: number;
    seq: number;
  }[];
}

export function initialMemoryState(): MemoryState {
  return {
    orgId: "",
    policy: DEFAULT_MEMORY_POLICY,
    head: null,
    seq: -1,
    entries: {},
    conflicts: {},
    compactions: [],
  };
}

export function reduceMemory(prev: MemoryState, e: MemoryEvent): MemoryState {
  const s: MemoryState = structuredClone(prev);
  s.head = e.id;
  s.seq = e.seq;
  switch (e.kind) {
    case "memory.created":
      s.orgId = e.payload.orgId;
      s.policy = e.payload.policy;
      break;
    case "memory.appended": {
      const entry = e.payload.entry;
      s.entries[entry.id] = {
        ...entry,
        seq: e.seq,
        status: "active",
        lastReadSeq: e.seq,
        reads: 0,
        lastReadAt: null,
        readBy: [],
        readLog: [],
      };
      for (const id of entry.supersedes) {
        const t = s.entries[id];
        if (t && t.status === "active") t.status = "superseded";
      }
      if (entry.kind === "retraction" && entry.retracts) {
        const t = s.entries[entry.retracts];
        if (t && (t.status === "active" || t.status === "superseded")) t.status = "retracted";
      }
      break;
    }
    case "memory.conflict.opened":
      s.conflicts[e.payload.conflictId] = {
        id: e.payload.conflictId,
        key: e.payload.key,
        scopeKey: e.payload.scopeKey,
        entryIds: e.payload.entryIds,
        resolved: false,
        winnerId: null,
        note: "",
        seq: e.seq,
      };
      break;
    case "memory.conflict.resolved": {
      const c = s.conflicts[e.payload.conflictId];
      if (!c) break;
      c.resolved = true;
      c.winnerId = e.payload.winnerId;
      c.note = e.payload.note;
      for (const id of c.entryIds) {
        const t = s.entries[id];
        if (t && t.status === "active" && e.payload.winnerId && id !== e.payload.winnerId)
          t.status = "superseded";
      }
      break;
    }
    case "memory.compacted":
      for (const id of e.payload.folded) {
        const t = s.entries[id];
        if (t && t.status === "active") t.status = "folded";
      }
      s.compactions.push({
        scopeKey: e.payload.scopeKey,
        level: e.payload.level,
        summaryId: e.payload.summaryId,
        folded: e.payload.folded.length,
        seq: e.seq,
      });
      break;
    case "memory.redacted": {
      const t = s.entries[e.payload.entryId];
      if (t) {
        t.content = "[redacted]";
        t.status = "redacted";
      }
      break;
    }
    case "memory.read": {
      const at = e.payload.at ?? null;
      for (const id of e.payload.entryIds) {
        const t = s.entries[id];
        if (!t) continue;
        t.lastReadSeq = e.seq;
        t.reads += 1;
        if (at !== null) t.lastReadAt = at;
        // Ledgers folded before the read log existed lack these fields.
        if (!t.readBy) t.readBy = [];
        if (!t.readLog) t.readLog = [];
        if (!t.readBy.includes(e.payload.by)) t.readBy.push(e.payload.by);
        t.readLog.push({ by: e.payload.by, seq: e.seq, at });
        if (t.readLog.length > READ_LOG_KEEP) t.readLog.splice(0, t.readLog.length - READ_LOG_KEEP);
      }
      break;
    }
  }
  return s;
}

export function foldMemory(events: readonly MemoryEvent[], from?: MemoryState): MemoryState {
  let s = from ?? initialMemoryState();
  for (const e of events) s = reduceMemory(s, e);
  return s;
}

export function activeEntries(s: MemoryState): EntryRecord[] {
  return Object.values(s.entries).filter(
    (x) => x.status === "active" && x.kind !== "retraction" && x.kind !== "conflict",
  );
}
