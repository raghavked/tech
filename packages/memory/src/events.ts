/**
 * Organisation memory: what every agent and human in a scope has learned, stored once,
 * attributed to the engineer who added it, append-only with compaction into levels.
 *
 * The shape follows W3C PROV (entity, activity, agents) and Zep-style bi-temporality: an
 * entry is valid from the ledger position it was added at until a tombstone or a superseding
 * entry; nothing is ever rewritten in place. Levels follow a log-structured merge: level 0 is
 * raw entries, level n+1 is a summary that cites the ids and authors it folded, so attribution
 * survives compaction.
 */
import type { ChainEvent } from "@atelier/kernel";
import { z } from "zod";

export const Scope = z.object({
  orgId: z.string().min(1),
  teamId: z.string().optional(),
  projectId: z.string().optional(),
  /** Path prefix inside the project's workspace the entry is about. */
  path: z.string().optional(),
});
export type Scope = z.infer<typeof Scope>;

export const EntryKind = z.enum([
  "fact",
  "decision",
  "convention",
  "summary",
  "retraction",
  "conflict",
]);
export type EntryKind = z.infer<typeof EntryKind>;

/** Who vouches for the entry; higher trust survives compaction preferentially. */
export const Trust = z.enum(["agent", "human", "commit"]);
export type Trust = z.infer<typeof Trust>;

export const Attribution = z.object({
  /** The engineer the entry is attributed to; for agent writes, the session's owner. */
  userId: z.string().min(1),
  userName: z.string().optional(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  commitSha: z.string().optional(),
});
export type Attribution = z.infer<typeof Attribution>;

export const MemoryEntry = z.object({
  id: z.string(),
  scope: Scope,
  kind: EntryKind,
  /** Normalised topic key ("db.engine", "api.style"); entries with the same key compete. */
  key: z.string().min(1).max(120).nullable(),
  content: z.string().min(1).max(20_000),
  tags: z.array(z.string()).default([]),
  attribution: Attribution,
  trust: Trust,
  /** 0 = raw; n = summary folding level n-1 entries. */
  level: z.number().int().min(0),
  /** Entries this one replaces (same author, same key) or folds (summaries). */
  supersedes: z.array(z.string()).default([]),
  derivedFrom: z.array(z.string()).default([]),
  /** For retraction entries: the entry being retracted and why. */
  retracts: z.string().nullable().default(null),
  reason: z.string().default(""),
  /** Pointers to evidence: file paths, event ids, ticket keys, urls. */
  evidence: z.array(z.string()).default([]),
});
export type MemoryEntry = z.infer<typeof MemoryEntry>;

const base = <K extends string, P extends z.ZodTypeAny>(kind: K, payload: P) =>
  z.object({ kind: z.literal(kind), payload });

export const MemoryEventBody = z.discriminatedUnion("kind", [
  base(
    "memory.created",
    z.object({
      orgId: z.string(),
      policy: z.object({
        coreBudgetBytes: z.number().int(),
        compactAfter: z.number().int(),
        staleAfter: z.number().int(),
      }),
    }),
  ),
  base("memory.appended", z.object({ entry: MemoryEntry })),
  base(
    "memory.conflict.opened",
    z.object({
      conflictId: z.string(),
      key: z.string(),
      scopeKey: z.string(),
      entryIds: z.array(z.string()),
    }),
  ),
  base(
    "memory.conflict.resolved",
    z.object({ conflictId: z.string(), winnerId: z.string().nullable(), note: z.string() }),
  ),
  base(
    "memory.compacted",
    z.object({
      scopeKey: z.string(),
      level: z.number().int(),
      summaryId: z.string(),
      folded: z.array(z.string()),
    }),
  ),
  base("memory.redacted", z.object({ entryId: z.string() })),
  base("memory.read", z.object({ entryIds: z.array(z.string()), by: z.string() })),
]);
export type MemoryEventBody = z.infer<typeof MemoryEventBody>;
export type MemoryEvent = MemoryEventBody & ChainEvent;

export interface MemoryPolicy {
  /** Bytes of rendered context injected per scope chain. */
  coreBudgetBytes: number;
  /** Compact a scope's level once it holds more than this many active entries. */
  compactAfter: number;
  /** An entry unread for this many ledger events is flagged stale by the curator. */
  staleAfter: number;
}

export const DEFAULT_MEMORY_POLICY: MemoryPolicy = {
  coreBudgetBytes: 24_000,
  compactAfter: 12,
  staleAfter: 500,
};

export function scopeKey(s: Scope): string {
  return [s.orgId, s.teamId ?? "", s.projectId ?? "", s.path ?? ""].join("/");
}

/** Narrow scopes first: path, project, team, org. */
export function scopeChain(s: Scope): Scope[] {
  const out: Scope[] = [];
  if (s.path && s.projectId)
    out.push({ orgId: s.orgId, teamId: s.teamId, projectId: s.projectId, path: s.path } as Scope);
  if (s.projectId)
    out.push({ orgId: s.orgId, ...(s.teamId ? { teamId: s.teamId } : {}), projectId: s.projectId });
  if (s.teamId) out.push({ orgId: s.orgId, teamId: s.teamId });
  out.push({ orgId: s.orgId });
  return out;
}

/** Does `entryScope` cover a reader at `at`? (entry scope must be an ancestor-or-equal) */
export function scopeCovers(entryScope: Scope, at: Scope): boolean {
  if (entryScope.orgId !== at.orgId) return false;
  if (entryScope.teamId && entryScope.teamId !== at.teamId) return false;
  if (entryScope.projectId && entryScope.projectId !== at.projectId) return false;
  if (entryScope.path) {
    if (!at.path) return false;
    const p = entryScope.path.endsWith("/") ? entryScope.path : `${entryScope.path}/`;
    return at.path === entryScope.path || at.path.startsWith(p);
  }
  return true;
}

export function scopeDepth(s: Scope): number {
  return (s.teamId ? 1 : 0) + (s.projectId ? 1 : 0) + (s.path ? 1 : 0);
}
