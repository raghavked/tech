/**
 * MemoryStore: the command layer. Writes are attributed at write time (the caller maps a
 * session to its engineer), conflicts between different authors on the same key become
 * explicit entries, and compaction is copy-on-write into a higher level.
 */
import { ChainLog, KernelError, type SerializedChain, shortId } from "@henosis/kernel";
import { MAIN_BRANCH } from "@henosis/protocol";
import {
  type Attribution,
  DEFAULT_MEMORY_POLICY,
  type EntryKind,
  type MemoryEntry,
  MemoryEntry as MemoryEntrySchema,
  type MemoryEvent,
  type MemoryEventBody,
  type MemoryPolicy,
  type Scope,
  Scope as ScopeSchema,
  scopeChain,
  scopeCovers,
  scopeDepth,
  scopeKey,
  type Trust,
} from "./events.js";
import {
  activeEntries,
  type EntryRecord,
  foldMemory,
  type MemoryState,
  reduceMemory,
} from "./state.js";

export type SerializedMemory = SerializedChain<MemoryEvent>;

export class MemoryLedger extends ChainLog<MemoryEventBody, MemoryEvent> {
  constructor() {
    super(null);
  }
  static fromSerialized(data: SerializedMemory): MemoryLedger {
    return new MemoryLedger().load(data);
  }
}

export interface RememberInput {
  scope: Scope;
  kind?: Exclude<EntryKind, "summary" | "retraction" | "conflict">;
  key?: string | null;
  content: string;
  tags?: string[];
  attribution: Attribution;
  trust?: Trust;
  evidence?: string[];
}

export interface RememberResult {
  entry: MemoryEntry;
  superseded: string[];
  conflictId: string | null;
}

/** Deterministic summariser used by default; an LLM-backed one can be injected and its output is journaled the same way. */
export type Summarizer = (entries: EntryRecord[], scope: Scope, level: number) => string;

export const bulletSummarizer: Summarizer = (entries, scope, level) => {
  const lines = [
    `Level ${level} summary for ${scopeKey(scope)} (${entries.length} entries folded):`,
  ];
  for (const e of [...entries].sort((a, b) => a.seq - b.seq)) {
    lines.push(
      `- ${e.key ? `[${e.key}] ` : ""}${e.content.split("\n")[0]?.slice(0, 200)} (${e.attribution.userName ?? e.attribution.userId}, ${e.trust})`,
    );
  }
  return lines.join("\n");
};

export type MemoryListener = (event: MemoryEvent, state: MemoryState) => void;

export class MemoryStore {
  readonly ledger: MemoryLedger;
  private current: MemoryState;
  private readonly listeners = new Set<MemoryListener>();

  constructor(ledger: MemoryLedger = new MemoryLedger()) {
    this.ledger = ledger;
    this.current = foldMemory(ledger.eventsOf(MAIN_BRANCH));
  }

  static create(orgId: string, policy: MemoryPolicy = DEFAULT_MEMORY_POLICY): MemoryStore {
    const m = new MemoryStore();
    m.emit("system", { kind: "memory.created", payload: { orgId, policy } });
    return m;
  }

  static fromSerialized(data: SerializedMemory): MemoryStore {
    return new MemoryStore(MemoryLedger.fromSerialized(data));
  }

  state(): MemoryState {
    return this.current;
  }

  onEvent(fn: MemoryListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---- writes ------------------------------------------------------------------------

  remember(input: RememberInput): RememberResult {
    const scope = ScopeSchema.parse(input.scope);
    const key = input.key ? normalizeKey(input.key) : null;
    const same = key
      ? activeEntries(this.current).filter(
          (e) => e.key === key && scopeKey(e.scope) === scopeKey(scope),
        )
      : [];
    const mine = same.filter((e) => e.attribution.userId === input.attribution.userId);
    const theirs = same.filter(
      (e) =>
        e.attribution.userId !== input.attribution.userId &&
        e.content.trim() !== input.content.trim(),
    );
    const entry = MemoryEntrySchema.parse({
      id: shortId(
        "mem",
        scopeKey(scope),
        key,
        input.content,
        input.attribution.userId,
        this.current.seq + 1,
      ),
      scope,
      kind: input.kind ?? "fact",
      key,
      content: input.content,
      tags: input.tags ?? [],
      attribution: input.attribution,
      trust:
        input.trust ??
        (input.attribution.commitSha ? "commit" : input.attribution.agentId ? "agent" : "human"),
      level: 0,
      supersedes: mine.map((e) => e.id),
      derivedFrom: [],
      retracts: null,
      reason: "",
      evidence: input.evidence ?? [],
    });
    this.emit(input.attribution.userId, { kind: "memory.appended", payload: { entry } });
    let conflictId: string | null = null;
    if (theirs.length && key) {
      const ids = [entry.id, ...theirs.map((e) => e.id)].sort();
      conflictId = shortId("mcf", scopeKey(scope), key, ids);
      if (!this.current.conflicts[conflictId]) {
        this.emit("system", {
          kind: "memory.conflict.opened",
          payload: { conflictId, key, scopeKey: scopeKey(scope), entryIds: ids },
        });
      }
    }
    return { entry, superseded: mine.map((e) => e.id), conflictId };
  }

  /** A tombstone: first-class, authored, with a reason. */
  retract(attribution: Attribution, entryId: string, reason: string): MemoryEntry {
    const target = this.current.entries[entryId];
    if (!target) throw new KernelError("not_found", `unknown entry ${entryId}`);
    const entry = MemoryEntrySchema.parse({
      id: shortId("mem", "retract", entryId, attribution.userId, this.current.seq + 1),
      scope: target.scope,
      kind: "retraction",
      key: target.key,
      content: `retracted: ${target.content.split("\n")[0]?.slice(0, 120)}`,
      tags: [],
      attribution,
      trust: attribution.agentId ? "agent" : "human",
      level: 0,
      supersedes: [],
      derivedFrom: [],
      retracts: entryId,
      reason,
      evidence: [],
    });
    this.emit(attribution.userId, { kind: "memory.appended", payload: { entry } });
    return entry;
  }

  resolveConflict(by: string, conflictId: string, winnerId: string | null, note = ""): void {
    const c = this.current.conflicts[conflictId];
    if (!c || c.resolved) throw new KernelError("not_found", `no open conflict ${conflictId}`);
    if (winnerId && !c.entryIds.includes(winnerId))
      throw new KernelError("invalid", "winner is not part of the conflict");
    this.emit(by, { kind: "memory.conflict.resolved", payload: { conflictId, winnerId, note } });
  }

  redact(by: string, entryId: string): void {
    if (!this.current.entries[entryId])
      throw new KernelError("not_found", `unknown entry ${entryId}`);
    this.emit(by, { kind: "memory.redacted", payload: { entryId } });
  }

  /** Henosis a scope's active level-n entries into one level-(n+1) summary that cites them. */
  compact(
    scope: Scope,
    level = 0,
    summarizer: Summarizer = bulletSummarizer,
    minEntries = 2,
  ): MemoryEntry | null {
    const sk = scopeKey(scope);
    const candidates = activeEntries(this.current)
      .filter((e) => e.level === level && scopeKey(e.scope) === sk)
      .filter((e) => !this.inOpenConflict(e.id))
      .sort((a, b) => a.seq - b.seq);
    if (candidates.length < minEntries) return null;
    const authors = [...new Set(candidates.map((e) => e.attribution.userId))].sort();
    const trust: Trust = candidates.some((e) => e.trust === "commit")
      ? "commit"
      : candidates.some((e) => e.trust === "human")
        ? "human"
        : "agent";
    const entry = MemoryEntrySchema.parse({
      id: shortId(
        "mem",
        "summary",
        sk,
        level + 1,
        candidates.map((c) => c.id),
      ),
      scope,
      kind: "summary",
      key: null,
      content: summarizer(candidates, scope, level + 1),
      tags: ["summary", ...authors.map((a) => `by:${a}`)],
      attribution: { userId: "curator", userName: "Curator", agentId: "curator" },
      trust,
      level: level + 1,
      supersedes: [],
      derivedFrom: candidates.map((c) => c.id),
      retracts: null,
      reason: "",
      evidence: candidates.flatMap((c) => c.evidence).slice(0, 50),
    });
    this.emit("curator", { kind: "memory.appended", payload: { entry } });
    this.emit("curator", {
      kind: "memory.compacted",
      payload: {
        scopeKey: sk,
        level: level + 1,
        summaryId: entry.id,
        folded: candidates.map((c) => c.id),
      },
    });
    return entry;
  }

  // ---- reads -------------------------------------------------------------------------

  /** Entries that apply to a reader at `at`, narrowest scope first, then newest. */
  entriesFor(at: Scope): EntryRecord[] {
    return activeEntries(this.current)
      .filter((e) => scopeCovers(e.scope, at))
      .sort(
        (a, b) => scopeDepth(b.scope) - scopeDepth(a.scope) || b.level - a.level || b.seq - a.seq,
      );
  }

  /** Does the scope chain know anything under this key? */
  knows(at: Scope, key: string): boolean {
    const k = normalizeKey(key);
    return this.entriesFor(at).some((e) => e.key === k);
  }

  recall(at: Scope, query: string, limit = 10): EntryRecord[] {
    const q = query.toLowerCase();
    return this.entriesFor(at)
      .filter(
        (e) =>
          e.content.toLowerCase().includes(q) ||
          (e.key ?? "").includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .slice(0, limit);
  }

  /**
   * The rendered core context for a reader: open conflicts first (both sides, attributed),
   * then entries narrowest-scope-first within a byte budget. Reads are journaled so the
   * curator can see what is stale.
   */
  contextFor(at: Scope, reader: string, budget = this.current.policy.coreBudgetBytes): string {
    const lines: string[] = [];
    const used: string[] = [];
    let bytes = 0;
    const push = (line: string, id?: string) => {
      if (bytes + line.length > budget) return false;
      lines.push(line);
      bytes += line.length + 1;
      if (id) used.push(id);
      return true;
    };
    const chain = scopeChain(at).map(scopeKey);
    const conflicts = Object.values(this.current.conflicts).filter(
      (c) => !c.resolved && chain.includes(c.scopeKey),
    );
    if (conflicts.length) {
      push("TEAM MEMORY CONFLICTS (ask before relying on either):");
      for (const c of conflicts) {
        for (const id of c.entryIds) {
          const e = this.current.entries[id];
          if (e && e.status === "active")
            push(`  ! [${c.key}] ${e.content.split("\n")[0]} (${who(e)})`, e.id);
        }
      }
    }
    const entries = this.entriesFor(at).filter((e) => !this.inOpenConflict(e.id));
    if (entries.length) push("TEAM MEMORY (attributed; narrower scope wins on the same key):");
    const seenKeys = new Set<string>();
    for (const e of entries) {
      if (e.key) {
        if (seenKeys.has(e.key)) continue;
        seenKeys.add(e.key);
      }
      const head = e.level > 0 ? e.content : `${e.key ? `[${e.key}] ` : ""}${e.content}`;
      if (!push(`  - ${head.replace(/\n/g, "\n    ")} (${who(e)})`, e.id)) break;
    }
    if (used.length)
      this.emit(reader, { kind: "memory.read", payload: { entryIds: used, by: reader } });
    return lines.join("\n");
  }

  // ---- internals ---------------------------------------------------------------------

  private inOpenConflict(entryId: string): boolean {
    return Object.values(this.current.conflicts).some(
      (c) => !c.resolved && c.entryIds.includes(entryId),
    );
  }

  private emit(actor: string, body: MemoryEventBody): MemoryEvent {
    const event = this.ledger.append(MAIN_BRANCH, actor, body);
    this.current = reduceMemory(this.current, event);
    for (const fn of this.listeners) fn(event, this.current);
    return event;
  }
}

export function normalizeKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._/-]/g, "")
    .slice(0, 120);
}

function who(e: EntryRecord): string {
  const a = e.attribution;
  const parts = [a.userName ?? a.userId];
  if (a.agentId && a.agentId !== "curator") parts.push("via agent");
  if (a.sessionId) parts.push(`session ${a.sessionId}`);
  if (a.commitSha) parts.push(`commit ${a.commitSha.slice(0, 7)}`);
  return parts.join(", ");
}
