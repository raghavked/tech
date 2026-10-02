/**
 * The session log: append-only, hash-chained, branchable.
 *
 * A branch is a sequence of events. A forked branch starts at a checkpoint event of its parent
 * and shares the parent's history up to that point; `eventsOf(branch)` returns the full linear
 * history a reducer must fold. Every event id commits to its predecessor, so any edit to the
 * past is detectable with `verify()`.
 */
import { type EventBody, MAIN_BRANCH, type SessionEvent } from "@atelier/protocol";
import { hashValue } from "./hash.js";

export interface BranchMeta {
  name: string;
  parent: string | null;
  /** Id of the parent's event (a checkpoint) this branch forked from. */
  forkPoint: string | null;
  createdSeq: number;
}

export interface SerializedLog {
  version: 1;
  branches: BranchMeta[];
  /** Own events per branch, in order. */
  events: Record<string, SessionEvent[]>;
}

export function eventId(e: Omit<SessionEvent, "id">): string {
  const { prev, seq, branch, ts, actor, kind, payload } = e;
  return hashValue({ prev, seq, branch, ts, actor, kind, payload });
}

export class SessionLog {
  private readonly branches = new Map<string, BranchMeta>();
  private readonly own = new Map<string, SessionEvent[]>();
  private readonly byId = new Map<string, SessionEvent>();

  constructor() {
    this.branches.set(MAIN_BRANCH, {
      name: MAIN_BRANCH,
      parent: null,
      forkPoint: null,
      createdSeq: 0,
    });
    this.own.set(MAIN_BRANCH, []);
  }

  static fromSerialized(data: SerializedLog): SessionLog {
    const log = new SessionLog();
    log.branches.clear();
    log.own.clear();
    for (const b of data.branches) {
      log.branches.set(b.name, { ...b });
      log.own.set(b.name, []);
    }
    for (const b of data.branches) {
      for (const e of data.events[b.name] ?? []) {
        log.own.get(b.name)?.push(e);
        log.byId.set(e.id, e);
      }
    }
    return log;
  }

  serialize(): SerializedLog {
    const events: Record<string, SessionEvent[]> = {};
    for (const [name, evs] of this.own) events[name] = [...evs];
    return { version: 1, branches: [...this.branches.values()].map((b) => ({ ...b })), events };
  }

  branchNames(): string[] {
    return [...this.branches.keys()];
  }

  branchMeta(name: string): BranchMeta | undefined {
    return this.branches.get(name);
  }

  hasBranch(name: string): boolean {
    return this.branches.has(name);
  }

  get(id: string): SessionEvent | undefined {
    return this.byId.get(id);
  }

  /** Own events of a branch (excluding inherited history). */
  ownEvents(branch: string): readonly SessionEvent[] {
    return this.own.get(branch) ?? [];
  }

  /** Full linear history of a branch including inherited parent history. */
  eventsOf(branch: string): SessionEvent[] {
    const meta = this.branches.get(branch);
    if (!meta) throw new Error(`unknown branch ${branch}`);
    const inherited: SessionEvent[] =
      meta.parent && meta.forkPoint ? this.eventsUpTo(meta.parent, meta.forkPoint) : [];
    return inherited.concat(this.ownEvents(branch));
  }

  /** History of `branch` up to and including event `id`. */
  eventsUpTo(branch: string, id: string): SessionEvent[] {
    const all = this.eventsOf(branch);
    const idx = all.findIndex((e) => e.id === id);
    if (idx < 0) throw new Error(`event ${id} not on branch ${branch}`);
    return all.slice(0, idx + 1);
  }

  head(branch: string): SessionEvent | null {
    const all = this.eventsOf(branch);
    return all.length ? (all[all.length - 1] as SessionEvent) : null;
  }

  append(branch: string, actor: string, body: EventBody): SessionEvent {
    if (!this.branches.has(branch)) throw new Error(`unknown branch ${branch}`);
    const head = this.head(branch);
    const draft: Omit<SessionEvent, "id"> = {
      prev: head?.id ?? null,
      seq: head ? head.seq + 1 : 0,
      branch,
      ts: head ? head.ts + 1 : 0,
      actor,
      ...body,
    } as Omit<SessionEvent, "id">;
    const event = { id: eventId(draft), ...draft } as SessionEvent;
    this.own.get(branch)?.push(event);
    this.byId.set(event.id, event);
    return event;
  }

  /** Create a branch from an event (must be a checkpoint) of an existing branch. */
  fork(parent: string, forkPoint: string, name: string): BranchMeta {
    if (this.branches.has(name)) throw new Error(`branch ${name} exists`);
    const at = this.byId.get(forkPoint);
    if (!at) throw new Error(`unknown event ${forkPoint}`);
    if (at.kind !== "checkpoint.created") throw new Error("fork point must be a checkpoint");
    // The event must be on the parent's linear history.
    this.eventsUpTo(parent, forkPoint);
    const meta: BranchMeta = { name, parent, forkPoint, createdSeq: at.seq };
    this.branches.set(name, meta);
    this.own.set(name, []);
    return meta;
  }

  /** Re-hash every event on every branch and check the chain. Returns the first problem found. */
  verify(): { ok: true } | { ok: false; branch: string; seq: number; reason: string } {
    for (const name of this.branches.keys()) {
      const events = this.eventsOf(name);
      let prev: SessionEvent | null = null;
      for (const e of events) {
        const { id, ...rest } = e;
        if (eventId(rest) !== id)
          return { ok: false, branch: name, seq: e.seq, reason: "bad hash" };
        if ((prev?.id ?? null) !== e.prev)
          return { ok: false, branch: name, seq: e.seq, reason: "broken chain" };
        if (prev && e.seq !== prev.seq + 1)
          return { ok: false, branch: name, seq: e.seq, reason: "seq gap" };
        if (prev && e.ts <= prev.ts)
          return { ok: false, branch: name, seq: e.seq, reason: "clock not monotonic" };
        prev = e;
      }
    }
    return { ok: true };
  }
}
