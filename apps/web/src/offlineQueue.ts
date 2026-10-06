/**
 * Offline queue: directives, votes and handoff actions typed while the socket is closed wait
 * here, in order, and go out the moment the session is joined again. The queue lives in memory
 * and is mirrored to localStorage (guarded) so a reload while offline does not lose them.
 * Pure, framework-free; `HenosisClient` owns one per connection (hook point: client.ts `send`).
 */
import { ClientMessage } from "@henosis/protocol";

export interface QueuedMessage {
  id: string;
  /** Epoch ms when it was queued. */
  at: number;
  msg: ClientMessage;
}

const QUEUEABLE = new Set<ClientMessage["type"]>([
  "directive",
  "vote",
  "handoff.request",
  "handoff.accept",
  "handoff.decline",
]);

/** Only human intent is worth replaying later; `brief`, `presence` and the like are not. */
export function isQueueable(msg: ClientMessage): boolean {
  return QUEUEABLE.has(msg.type);
}

export const queueKey = (projectId: string, sessionId: string) =>
  `henosis.queue.${projectId}/${sessionId}`;

/** One line per queued message, in the voice of the stream. */
export function describeQueued(msg: ClientMessage, who: (id: string) => string = (id) => id) {
  switch (msg.type) {
    case "directive": {
      const i = msg.input;
      const tag = i.mode === "steer" ? "" : `${i.mode} · `;
      return `${tag}${i.text}`;
    }
    case "vote":
      return `${msg.vote === "approve" ? "Approve" : "Deny"} ${msg.approvalId.slice(0, 8)}`;
    case "handoff.request":
      return `Hand off to ${who(msg.to)}`;
    case "handoff.accept":
      return "Accept the fold";
    case "handoff.decline":
      return "Decline the fold";
    default:
      return msg.type;
  }
}

let seq = 0;
const newId = () => `q${Date.now().toString(36)}${(seq++).toString(36)}`;

export class OfflineQueue {
  items: QueuedMessage[] = [];
  private key: string | null = null;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Bind to a session; restores whatever an earlier page load left behind for it. */
  load(key: string): void {
    this.key = key;
    this.set(readStored(key));
  }

  enqueue(msg: ClientMessage): QueuedMessage {
    const item: QueuedMessage = { id: newId(), at: Date.now(), msg };
    this.set([...this.items, item]);
    return item;
  }

  remove(id: string): void {
    this.set(this.items.filter((i) => i.id !== id));
  }

  clear(): void {
    this.set([]);
  }

  /**
   * Send everything in order. Stops at the first `send` that throws and keeps the rest, so a
   * socket that drops mid-flush loses nothing.
   */
  flush(send: (msg: ClientMessage) => void): number {
    const pending = this.items;
    let sent = 0;
    for (const item of pending) {
      try {
        send(item.msg);
        sent += 1;
      } catch {
        break;
      }
    }
    if (sent > 0) this.set(pending.slice(sent));
    return sent;
  }

  private set(items: QueuedMessage[]): void {
    this.items = items;
    if (this.key) writeStored(this.key, items);
    for (const fn of this.listeners) fn();
  }
}

function readStored(key: string): QueuedMessage[] {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(v)) return [];
    const out: QueuedMessage[] = [];
    for (const r of v as unknown[]) {
      if (typeof r !== "object" || r === null) continue;
      const { id, at, msg } = r as Partial<QueuedMessage>;
      if (typeof id !== "string" || typeof at !== "number") continue;
      const parsed = ClientMessage.safeParse(msg);
      if (parsed.success && isQueueable(parsed.data)) out.push({ id, at, msg: parsed.data });
    }
    return out;
  } catch {
    return [];
  }
}

function writeStored(key: string, items: QueuedMessage[]): void {
  try {
    if (items.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // private mode or quota: the queue lives in memory for this page only
  }
}
