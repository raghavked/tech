/** Websocket client that folds events with the same reducer the server uses. */
import { fold, type SessionState } from "@atelier/kernel";
import type {
  Actor,
  ClientMessage,
  PresenceEntry,
  ServerMessage,
  SessionEvent,
} from "@atelier/protocol";

export interface ClientSnapshot {
  state: SessionState | null;
  events: SessionEvent[];
  presence: PresenceEntry[];
  errors: string[];
  brief: string | null;
  connected: boolean;
}

export class AtelierClient {
  private ws: WebSocket | null = null;
  snapshot: ClientSnapshot = {
    state: null,
    events: [],
    presence: [],
    errors: [],
    brief: null,
    connected: false,
  };
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(patch: Partial<ClientSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) fn();
  }

  connect(url: string, sessionId: string, actor: Actor, token: string, branch = "main"): void {
    this.ws?.close();
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.emit({ connected: true, events: [], state: null });
      const join: ClientMessage = token
        ? { type: "join", sessionId, actor, token, branch }
        : { type: "join", sessionId, actor, branch };
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

  send(msg: ClientMessage): void {
    this.ws?.send(JSON.stringify(msg));
  }
}
