/**
 * LogWriter: what a host flushes through. It remembers how much of each branch the store
 * holds, so a flush appends only the events since the last one (and announces new branches),
 * and writes the whole log only the first time a log the store never saw is flushed.
 */
import type { AnyLog, LiveStore, LogKind } from "./types.js";

export class LogWriter {
  /** Own events persisted per branch; null until the log is in the store. */
  private seen: Map<string, number> | null;

  constructor(
    private readonly store: LiveStore,
    private readonly kind: LogKind,
    private readonly id: string,
    /** The log as read from the store at open, so the first flush appends rather than rewrites. */
    persisted: AnyLog | null = null,
  ) {
    this.seen = persisted ? counts(persisted) : null;
  }

  /** Persist what `log` holds beyond the last flush. Returns what it did, for tests and logs. */
  flush(log: AnyLog): "written" | "appended" | "unchanged" {
    const seen = this.seen;
    if (!seen) {
      this.store.writeLog(this.kind, this.id, log);
      this.seen = counts(log);
      return "written";
    }
    const events = [];
    let newBranch = false;
    for (const b of log.branches) {
      const own = log.events[b.name] ?? [];
      const had = seen.get(b.name);
      if (had === undefined) newBranch = true;
      else if (own.length < had) {
        // The log shrank (never in normal use): the store gets the whole truth again.
        this.store.writeLog(this.kind, this.id, log);
        this.seen = counts(log);
        return "written";
      }
      events.push(...own.slice(had ?? 0));
    }
    if (!events.length && !newBranch) return "unchanged";
    this.store.appendEvents(this.kind, this.id, events, newBranch ? log.branches : undefined);
    this.seen = counts(log);
    return "appended";
  }
}

function counts(log: AnyLog): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of log.branches) out.set(b.name, (log.events[b.name] ?? []).length);
  return out;
}
