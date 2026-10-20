/**
 * Who is answering whom: an agent member that was mentioned and has not replied yet. This is
 * live state beside the log, never in it: the host starts an entry when a mention reaches the
 * session, and the agent's reply (or a failure to reach it) ends it. The list and the open
 * group both read it, so "Bo's agent is answering Cy…" is one truth across pages.
 */
import type { ChatEvent } from "./events.js";
import type { Answering } from "./wire.js";

const key = (a: Pick<Answering, "groupId" | "sessionId">) => `${a.groupId}\u0000${a.sessionId}`;

export class AnsweringBoard {
  private readonly entries = new Map<string, Answering>();

  /** A mention reached the session: the agent is answering until its next words land. */
  start(a: Answering): Answering {
    this.entries.set(key(a), a);
    return a;
  }

  /** The agent answered, or could not be reached: nothing waits on it in this group any more. */
  stop(groupId: string, sessionId: string): Answering | null {
    const k = key({ groupId, sessionId });
    const was = this.entries.get(k) ?? null;
    this.entries.delete(k);
    return was;
  }

  /** An agent's reply in the log ends its entry; other events change nothing. */
  clearedBy(e: ChatEvent): Answering | null {
    if (e.kind !== "message.agent.replied") return null;
    return this.stop(e.payload.groupId, e.payload.sessionId);
  }

  inGroup(groupId: string): Answering[] {
    return [...this.entries.values()].filter((a) => a.groupId === groupId);
  }

  all(): Answering[] {
    return [...this.entries.values()];
  }
}

/** Fold a live `chat.answering` message into the list a client holds. */
export function applyAnswering(list: readonly Answering[], on: boolean, a: Answering): Answering[] {
  const rest = list.filter((x) => !(x.groupId === a.groupId && x.sessionId === a.sessionId));
  return on ? [...rest, a] : rest;
}
