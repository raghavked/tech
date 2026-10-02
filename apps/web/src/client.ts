/** Websocket client for one session. It folds events with the same reducer the server uses. */
import { fold, type SessionState } from "@fold/kernel";
import type {
  Actor,
  ClientMessage,
  PresenceEntry,
  ServerMessage,
  SessionEvent,
} from "@fold/protocol";

export interface ClientSnapshot {
  state: SessionState | null;
  events: SessionEvent[];
  presence: PresenceEntry[];
  errors: string[];
  brief: string | null;
  connected: boolean;
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
};

export class FoldClient {
  private ws: WebSocket | null = null;
  snapshot: ClientSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  private liveListeners = new Set<(e: SessionEvent) => void>();

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
    const ws = new WebSocket(url);
    this.ws = ws;
    this.emit({ ...EMPTY });
    ws.onopen = () => {
      this.emit({ connected: true, events: [], state: null });
      const join: ClientMessage = {
        type: "join",
        sessionId: opts.sessionId,
        actor: opts.actor,
        branch: opts.branch ?? "main",
        userId: opts.userId,
        projectId: opts.projectId,
        title: opts.title,
        ...(opts.token ? { token: opts.token } : {}),
      };
      ws.send(JSON.stringify(join));
    };
    ws.onclose = () => this.emit({ connected: false });
    ws.onmessage = (m) => {
      const msg = JSON.parse(String(m.data)) as ServerMessage;
      switch (msg.type) {
        case "snapshot":
          this.emit({ state: fold(msg.events), events: msg.events });
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
          this.emit({ errors: [...this.snapshot.errors.slice(-4), msg.message] });
          break;
        case "joined":
          break;
      }
    };
  }

  disconnect(): void {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
    this.emit({ connected: false });
  }

  send(msg: ClientMessage): void {
    this.ws?.send(JSON.stringify(msg));
  }
}

export const wsUrl = () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
