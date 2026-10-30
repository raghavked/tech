/**
 * Websocket client for one organisation's groups and chats: folds the chat log with the same
 * reducer the server uses, and keeps the live state beside it (which agent is answering whom,
 * which names are free). When the socket drops it re-dials with backoff and resubscribes; the
 * fresh snapshot replaces what it held.
 */
import {
  type Answering,
  applyAnswering,
  type ChatClientMessage,
  type ChatEvent,
  type ChatServerMessage,
  type ChatState,
  foldChat,
  reduceChat,
} from "@henosis/chat";
import { getIdentity } from "./identity.js";
import { Reconnector, type Retry } from "./reconnect.js";

export interface ChatSnapshot {
  state: ChatState | null;
  events: ChatEvent[];
  errors: string[];
  connected: boolean;
  /** The socket dropped and a re-dial is pending or in flight; `state` is kept meanwhile. */
  reconnecting: boolean;
  /** The re-dial scheduled while reconnecting: its attempt number and when it fires. */
  retry: Retry | null;
  /** Agent members mentioned and not yet answered, across the organisation (chat.answering). */
  answering: Answering[];
  /** Names the server has been asked about: true when free for a new group. */
  names: Record<string, boolean>;
}

type Incoming = ChatServerMessage | { type: "error"; message: string };

const EMPTY: ChatSnapshot = {
  state: null,
  events: [],
  errors: [],
  connected: false,
  reconnecting: false,
  retry: null,
  answering: [],
  names: {},
};

/** What a person meant, kept while the socket is away; a name check is only worth asking once. */
const KEPT_WHILE_AWAY = new Set<ChatClientMessage["type"]>([
  "chat.say",
  "chat.read",
  "chat.create",
  "chat.add",
  "chat.remove",
  "chat.rename",
  "chat.role",
  "chat.council.convene",
  "chat.council.instruct",
  "chat.council.end",
]);

export class ChatClient {
  private ws: WebSocket | null = null;
  snapshot: ChatSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  private liveListeners = new Set<(e: ChatEvent) => void>();
  private target: { url: string; orgId: string; userId: string; name: string } | null = null;
  private readonly reconnector = new Reconnector(() => this.dial());
  /** Sent after the next subscribe: what was said or read while the socket was dialling. */
  private held: ChatClientMessage[] = [];

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

  /** "Try now": dial at once instead of waiting out the backoff. */
  reconnectNow(): void {
    if (this.target) this.reconnector.now();
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
      // Identity: the token the identity store holds rides along (the ID token in oidc mode).
      const token = getIdentity()?.token;
      this.send({ type: "chat.subscribe", orgId, userId, name, ...(token ? { token } : {}) });
      // What was meant while the socket was away goes out now, in order, after the subscribe.
      const held = this.held;
      this.held = [];
      for (const msg of held) this.send(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.target) {
        this.emit({ connected: false, reconnecting: false, retry: null });
        return;
      }
      const delay = this.reconnector.schedule();
      this.emit({ connected: false, reconnecting: true, retry: this.reconnector.pending(delay) });
    };
    ws.onmessage = (m) => {
      if (this.ws !== ws) return;
      const msg = JSON.parse(String(m.data)) as Incoming;
      switch (msg.type) {
        case "chat.snapshot":
          this.reconnector.reset();
          this.emit({
            state: foldChat(msg.events),
            events: msg.events,
            reconnecting: false,
            retry: null,
            answering: msg.answering ?? [],
            names: {},
          });
          break;
        case "chat.event": {
          const state = this.snapshot.state ? reduceChat(this.snapshot.state, msg.event) : null;
          // A new group takes or frees a name: what the sheet knew about names is stale.
          const names =
            msg.event.kind === "group.created" || msg.event.kind === "group.renamed"
              ? {}
              : this.snapshot.names;
          this.emit({ state, events: [...this.snapshot.events, msg.event], names });
          for (const fn of this.liveListeners) fn(msg.event);
          break;
        }
        case "chat.answering":
          this.emit({ answering: applyAnswering(this.snapshot.answering, msg.on, msg.answering) });
          break;
        case "chat.name":
          this.emit({ names: { ...this.snapshot.names, [msg.name]: msg.free } });
          break;
        case "error":
          this.emit({ errors: [...this.snapshot.errors.slice(-4), msg.message] });
          break;
      }
    };
  }

  disconnect(): void {
    this.target = null;
    this.reconnector.reset();
    this.held = [];
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
    this.emit({ connected: false, reconnecting: false, retry: null });
  }

  /**
   * Send on an open socket; while the socket is dialling or away, keep what the person meant
   * for the next subscribe instead of throwing (a socket still connecting refuses `send` with an
   * InvalidStateError, and the composer calls this from a React effect, where a throw would take
   * the whole chat view down with it).
   */
  send(msg: ChatClientMessage): void {
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return;
    }
    if (this.target && KEPT_WHILE_AWAY.has(msg.type)) this.held.push(msg);
  }

  /** Messages waiting for the socket, oldest first (tests). */
  get pending(): readonly ChatClientMessage[] {
    return this.held;
  }
}
