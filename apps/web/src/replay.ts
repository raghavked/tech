/**
 * Time travel: fold the session up to a point in its own log, in the client.
 * A pure fold over the events already here; nothing is asked of the server.
 */
import { fold, type SessionState } from "@henosis/kernel";
import type { SessionEvent } from "@henosis/protocol";

/** One agent turn as a window of the log: from its `agent.turn.started` to just before the next. */
export interface TurnMark {
  turn: number;
  startSeq: number;
  /** Last seq that still belongs to this turn (the last event for the newest turn). */
  endSeq: number;
}

/** One mark per turn, in order; empty when the agent has not started yet. */
export function turnMarks(events: readonly SessionEvent[]): TurnMark[] {
  const out: TurnMark[] = [];
  const last = events[events.length - 1]?.seq ?? -1;
  for (const e of events) {
    if (e.kind !== "agent.turn.started") continue;
    const prev = out[out.length - 1];
    if (prev) prev.endSeq = e.seq - 1;
    out.push({ turn: e.payload.turn, startSeq: e.seq, endSeq: last });
  }
  return out;
}

/** The session as it was once `seq` had been folded: the events up to it and their state. */
export function foldUpTo(
  events: readonly SessionEvent[],
  seq: number,
): { events: SessionEvent[]; state: SessionState } {
  const upTo = events.filter((e) => e.seq <= seq);
  return { events: upTo, state: fold(upTo) };
}

/** Which mark a viewed seq falls in; the newest when `seq` is null (now). */
export function markIndexOf(marks: readonly TurnMark[], seq: number | null): number {
  if (seq === null) return marks.length - 1;
  const i = marks.findIndex((m) => seq <= m.endSeq);
  return i === -1 ? marks.length - 1 : i;
}

export function viewingLabel(index: number, total: number): string {
  return `Viewing turn ${index + 1} of ${total}`;
}
