import type { MemoryEntry, MemoryEvent, MemoryPolicy } from "./events.js";
import { DEFAULT_MEMORY_POLICY } from "./events.js";

export interface EntryRecord extends MemoryEntry {
  seq: number;
  status: "active" | "superseded" | "retracted" | "folded" | "redacted";
  /** Ledger seq of the last recorded read; used for staleness. */
  lastReadSeq: number;
  reads: number;
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
    case "memory.read":
      for (const id of e.payload.entryIds) {
        const t = s.entries[id];
        if (t) {
          t.lastReadSeq = e.seq;
          t.reads += 1;
        }
      }
      break;
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
