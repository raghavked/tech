/**
 * Websocket client for one organisation's groups and chats: folds the chat log with the same
 * reducer the server uses. When the socket drops it re-dials with backoff and resubscribes;
 * the fresh snapshot replaces what it held.
 */
import {
  type ChatClientMessage,
  type ChatEvent,
  type ChatServerMessage,
  type ChatState,
  foldChat,
  reduceChat,
} from "@henosis/chat";
import { Reconnector } from "./reconnect.js";

export interface ChatSnapshot {
  state: ChatState | null;
  events: ChatEvent[];
  errors: string[];
  connected: boolean;
  /** The socket dropped and a re-dial is pending or in flight; `state` is kept meanwhile. */
  reconnecting: boolean;
}

type Incoming = ChatServerMessage | { type: "error"; message: string };

const EMPTY: ChatSnapshot = {
  state: null,
  events: [],
  errors: [],
  connected: false,
  reconnecting: false,
};

export class ChatClient {
  private ws: WebSocket | null = null;
  snapshot: ChatSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  private liveListeners = new Set<(e: ChatEvent) => void>();
  private target: { url: string; orgId: string; userId: string; name: string } | null = null;
  private readonly reconnector = new Reconnector(() => this.dial());

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  /** Events after the snapshot, one by one: what a notification or a navigation reacts to. */
  onLiveEvent(fn: (e: ChatEvent) => void): () => void {
    this.liveListeners.add(fn);
    return () => this.liveListeners.delete(fn);
  }
  private emit(patch: Partial<ChatSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) fn();
  }

  connect(url: string, orgId: string, userId: string, name: string): void {
    this.disconnect();
    this.target = { url, orgId, userId, name };
    this.emit({ ...EMPTY });
    this.dial();
  }

  private dial(): void {
    const target = this.target;
    if (!target) return;
    const { url, orgId, userId, name } = target;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.emit({ connected: true });
      this.send({ type: "chat.subscribe", orgId, userId, name });
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.target) {
        this.emit({ connected: false, reconnecting: false });
        return;
      }
      this.reconnector.schedule();
      this.emit({ connected: false, reconnecting: true });
    };
    ws.onmessage = (m) => {
      if (this.ws !== ws) return;
      const msg = JSON.parse(String(m.data)) as Incoming;
      switch (msg.type) {
        case "chat.snapshot":
          this.reconnector.reset();
          this.emit({ state: foldChat(msg.events), events: msg.events, reconnecting: false });
          break;
        case "chat.event": {
          const state = this.snapshot.state ? reduceChat(this.snapshot.state, msg.event) : null;
          this.emit({ state, events: [...this.snapshot.events, msg.event] });
          for (const fn of this.liveListeners) fn(msg.event);
          break;
        }
        case "error":
          this.emit({ errors: [...this.snapshot.errors.slice(-4), msg.message] });
          break;
      }
    };
  }

  disconnect(): void {
    this.target = null;
    this.reconnector.reset();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
    this.emit({ connected: false, reconnecting: false });
  }

  send(msg: ChatClientMessage): void {
    this.ws?.send(JSON.stringify(msg));
  }
}
