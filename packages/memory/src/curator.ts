/**
 * The curator: the organisation's long-lived driver for memory. It is an API-driven loop,
 * not a computer-use agent: it compacts scopes that have grown, flags stale and conflicting
 * entries, and proposes tombstones for a human to approve. Every action is a ledger event.
 */
import { type Scope, scopeKey } from "./events.js";
import type { EntryRecord } from "./state.js";
import { activeEntries } from "./state.js";
import { bulletSummarizer, type MemoryStore, type Summarizer } from "./store.js";

export interface CuratorReport {
  compacted: { scope: string; level: number; summaryId: string; folded: number }[];
  stale: { id: string; key: string | null; author: string; unreadFor: number }[];
  conflicts: {
    id: string;
    key: string;
    entries: { id: string; author: string; content: string }[];
  }[];
  proposedRetractions: { id: string; reason: string }[];
}

export class Curator {
  constructor(
    private readonly store: MemoryStore,
    private readonly summarizer: Summarizer = bulletSummarizer,
  ) {}

  /** One pass. Idempotent when nothing changed. */
  tick(now?: number): CuratorReport {
    const st = this.store.state();
    const seq = now ?? st.seq;
    const report: CuratorReport = {
      compacted: [],
      stale: [],
      conflicts: [],
      proposedRetractions: [],
    };
    // Compaction per scope and level.
    const byScopeLevel = new Map<string, { scope: Scope; level: number; n: number }>();
    for (const e of activeEntries(st)) {
      const k = `${scopeKey(e.scope)}@${e.level}`;
      const cur = byScopeLevel.get(k) ?? { scope: e.scope, level: e.level, n: 0 };
      cur.n += 1;
      byScopeLevel.set(k, cur);
    }
    for (const { scope, level, n } of byScopeLevel.values()) {
      if (n > st.policy.compactAfter) {
        const summary = this.store.compact(scope, level, this.summarizer);
        if (summary)
          report.compacted.push({
            scope: scopeKey(scope),
            level: level + 1,
            summaryId: summary.id,
            folded: summary.derivedFrom.length,
          });
      }
    }
    // Stale: unread for too long and never confirmed by a human or a commit.
    const after = this.store.state();
    for (const e of activeEntries(after)) {
      const unreadFor = seq - e.lastReadSeq;
      if (e.trust === "agent" && unreadFor > after.policy.staleAfter) {
        report.stale.push({ id: e.id, key: e.key, author: e.attribution.userId, unreadFor });
        report.proposedRetractions.push({
          id: e.id,
          reason: `agent-written and unread for ${unreadFor} events`,
        });
      }
    }
    for (const c of Object.values(after.conflicts).filter((c) => !c.resolved)) {
      report.conflicts.push({
        id: c.id,
        key: c.key,
        entries: c.entryIds
          .map((id) => after.entries[id])
          .filter((e): e is EntryRecord => Boolean(e))
          .map((e) => ({
            id: e.id,
            author: e.attribution.userName ?? e.attribution.userId,
            content: e.content,
          })),
      });
    }
    return report;
  }
}
