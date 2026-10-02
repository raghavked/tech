/**
 * Websocket client for one session. It folds events with the same reducer the server uses.
 * When the socket drops it re-dials with backoff and rejoins from the last event it holds
 * (`sinceSeq`), so the server sends only what was missed and the fold stays identical.
 */
import type { ProjectClientMessage } from "@fold/fleet";
import { fold, type SessionState } from "@fold/kernel";
import type {
  Actor,
  ClientMessage,
  PresenceEntry,
  ServerMessage,
  SessionEvent,
} from "@fold/protocol";
import { isQueueable, OfflineQueue, type QueuedMessage, queueKey } from "./offlineQueue.js";
import { Reconnector } from "./reconnect.js";
import { wsBase } from "./shell.js";

export interface ClientSnapshot {
  state: SessionState | null;
  events: SessionEvent[];
  presence: PresenceEntry[];
  errors: string[];
  brief: string | null;
  connected: boolean;
  /** The socket dropped and a re-dial is pending or in flight; `state` is kept meanwhile. */
  reconnecting: boolean;
  /** Messages waiting for the socket to come back (offline queue), oldest first. */
  queued: QueuedMessage[];
}

export interface JoinOptions {
  sessionId: string;
  actor: Actor;
  token?: string;
  branch?: string;
  /** Identity in users.json; roles derive from memberships when the server knows it. */
  userId: string;
  /** Project to create the session in when it does not exist yet. */
  projectId: string;
  title: string;
}

const EMPTY: ClientSnapshot = {
  state: null,
  events: [],
  presence: [],
  errors: [],
  brief: null,
  connected: false,
  reconnecting: false,
  queued: [],
};

export class FoldClient {
  private ws: WebSocket | null = null;
  snapshot: ClientSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  private liveListeners = new Set<(e: SessionEvent) => void>();
  /** Where `connect` pointed us; null once `disconnect` has been called. */
  private target: { url: string; opts: JoinOptions } | null = null;
  private readonly reconnector = new Reconnector(() => this.dial());
  /** The server refused the join for good (bad token): do not keep dialling. */
  private fatal = false;
  /** Set once per socket when a trimmed snapshot did not line up and we asked for everything. */
  private askedFull = false;
  /** Offline queue (hook point): `send` parks queueable messages here while disconnected. */
  readonly queue = new OfflineQueue();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  /** Events that arrive after the snapshot, one by one: what a notification should react to. */
  onLiveEvent(fn: (e: SessionEvent) => void): () => void {
    this.liveListeners.add(fn);
    return () => this.liveListeners.delete(fn);
  }
  private emit(patch: Partial<ClientSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) fn();
  }

  connect(url: string, opts: JoinOptions): void {
    this.disconnect();
    this.target = { url, opts };
    this.queue.load(queueKey(opts.projectId, opts.sessionId));
    this.emit({ ...EMPTY, queued: this.queue.items });
    this.dial();
  }

  /** The last event we hold, on the branch we hold it for: where a rejoin resumes from. */
  private resumePoint(): { branch: string; sinceSeq: number } | null {
    const last = this.snapshot.events[this.snapshot.events.length - 1];
    return last && this.snapshot.state ? { branch: last.branch, sinceSeq: last.seq } : null;
  }

  private joinMessage(opts: JoinOptions, resume: { branch: string; sinceSeq: number } | null) {
    const join: ClientMessage = {
      type: "join",
      sessionId: opts.sessionId,
      actor: opts.actor,
      branch: resume?.branch ?? opts.branch ?? "main",
      userId: opts.userId,
      projectId: opts.projectId,
      title: opts.title,
      ...(opts.token ? { token: opts.token } : {}),
      ...(resume ? { sinceSeq: resume.sinceSeq } : {}),
    };
    return join;
  }

  private dial(): void {
    const target = this.target;
    if (!target) return;
    const { url, opts } = target;
    const ws = new WebSocket(url);
    this.ws = ws;
    this.askedFull = false;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.emit({ connected: true });
      ws.send(JSON.stringify(this.joinMessage(opts, this.resumePoint())));
      // Offline queue (hook point): everything typed while away goes out now, in order.
      this.queue.flush((m) => ws.send(JSON.stringify(m)));
      this.emit({ queued: this.queue.items });
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.fatal || !this.target) {
        this.emit({ connected: false, reconnecting: false });
        return;
      }
      this.reconnector.schedule();
      this.emit({ connected: false, reconnecting: true });
    };
    ws.onmessage = (m) => {
      if (this.ws !== ws) return;
      const msg = JSON.parse(String(m.data)) as ServerMessage;
      switch (msg.type) {
        case "snapshot":
          this.reconnector.reset();
          this.emit({ reconnecting: false });
          this.applySnapshot(msg.events, opts);
          break;
        case "event": {
          const state = this.snapshot.state ? fold([msg.event], this.snapshot.state) : null;
          this.emit({ state, events: [...this.snapshot.events, msg.event] });
          for (const fn of this.liveListeners) fn(msg.event);
          break;
        }
        case "presence":
          this.emit({ presence: msg.entries });
          break;
        case "brief":
          this.emit({ brief: msg.markdown });
          break;
        case "error":
          if (msg.message === "unauthorized") this.fatal = true;
          this.emit({ errors: [...this.snapshot.errors.slice(-4), msg.message] });
          break;
        case "joined":
          break;
      }
    };
  }

  /**
   * A snapshot is either the whole branch (first seq 0) or, after a rejoin with `sinceSeq`,
   * the events after the one we hold. A delta folds onto the held state, which gives the same
   * state as folding the whole history; the missed events reach live listeners too.
   */
  private applySnapshot(events: SessionEvent[], opts: JoinOptions): void {
    const prev = this.snapshot;
    const last = prev.events[prev.events.length - 1];
    const first = events[0];
    const continues =
      prev.state !== null &&
      last !== undefined &&
      (first === undefined ||
        (first.seq === last.seq + 1 && first.prev === last.id && first.branch === last.branch));
    if (continues && prev.state) {
      this.emit({ state: fold(events, prev.state), events: [...prev.events, ...events] });
      for (const e of events) for (const fn of this.liveListeners) fn(e);
      return;
    }
    if (first && first.seq > 0) {
      // Trimmed to a point we do not hold (the log changed under us): ask for everything, once.
      if (!this.askedFull) {
        this.askedFull = true;
        this.send(this.joinMessage(opts, null));
      }
      return;
    }
    this.emit({ state: fold(events), events });
  }

  disconnect(): void {
    this.target = null;
    this.fatal = false;
    this.reconnector.reset();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
    this.emit({ connected: false, reconnecting: false });
  }

  send(msg: ClientMessage): void {
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return;
    }
    // Offline queue (hook point): human intent waits for the socket; the rest is dropped.
    if (isQueueable(msg)) {
      this.queue.enqueue(msg);
      this.emit({ queued: this.queue.items });
    }
  }

  /** Drop one queued message before it is sent. */
  unqueue(id: string): void {
    this.queue.remove(id);
    this.emit({ queued: this.queue.items });
  }
  /** Project-level messages ride the same socket once joined (the server knows the project). */
  sendProject(msg: ProjectClientMessage): void {
    this.ws?.send(JSON.stringify(msg));
  }
}

/** `/ws` on this origin, or next to the server the desktop shell's bundled client talks to. */
export const wsUrl = () =>
  wsBase() ?? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
