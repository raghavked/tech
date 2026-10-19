/**
 * Websocket client for one project: folds the project ledger with the fleet reducer.
 * When the socket drops it re-dials with backoff and resubscribes; the fresh project
 * snapshot replaces what it held.
 */
import {
  foldProject,
  type ProjectClientMessage,
  type ProjectEvent,
  type ProjectServerMessage,
  type ProjectState,
  reduceProject,
} from "@henosis/fleet";
import type { SessionPolicyPatch } from "@henosis/protocol";
import { getIdentity } from "./identity.js";
import { Reconnector, type Retry } from "./reconnect.js";

/** Identity: the subscribe message carries the token the identity store holds (the ID token in oidc mode). */
function subscribeMessage(projectId: string, userId: string): ProjectClientMessage {
  const token = getIdentity()?.token;
  return { type: "project.subscribe", projectId, userId, ...(token ? { token } : {}) };
}

/**
 * Start a session with a policy of its own (plan first, a token budget) over a short-lived
 * project socket. Resolves once the server has answered, or after a short wait, so the caller
 * can open the session; an existing session is left as it is.
 */
export function createSession(
  url: string,
  input: {
    projectId: string;
    userId: string;
    sessionId: string;
    title: string;
    policy: SessionPolicyPatch;
  },
): Promise<void> {
  return new Promise((resolve) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // already closed
      }
      resolve();
    };
    const timer = setTimeout(finish, 4000);
    ws.onopen = () => {
      const send = (m: ProjectClientMessage) => ws.send(JSON.stringify(m));
      send(subscribeMessage(input.projectId, input.userId));
      send({
        type: "session.create",
        sessionId: input.sessionId,
        title: input.title,
        policy: input.policy,
      });
      // The server answers in order: the brief comes back once the session exists.
      send({ type: "fleet.brief" });
    };
    ws.onmessage = (m) => {
      const msg = JSON.parse(String(m.data)) as { type: string };
      if (msg.type === "fleet.brief" || msg.type === "error") finish();
    };
    ws.onerror = finish;
    ws.onclose = finish;
  });
}

export interface ProjectSnapshot {
  state: ProjectState | null;
  events: ProjectEvent[];
  brief: string | null;
  errors: string[];
  connected: boolean;
  /** The socket dropped and a re-dial is pending or in flight; `state` is kept meanwhile. */
  reconnecting: boolean;
  /** The re-dial scheduled while reconnecting: its attempt number and when it fires. */
  retry: Retry | null;
}

type Incoming = ProjectServerMessage | { type: "error"; message: string };

const EMPTY: ProjectSnapshot = {
  state: null,
  events: [],
  brief: null,
  errors: [],
  connected: false,
  reconnecting: false,
  retry: null,
};

export class ProjectClient {
  private ws: WebSocket | null = null;
  snapshot: ProjectSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  private liveListeners = new Set<(e: ProjectEvent) => void>();
  private target: { url: string; projectId: string; userId: string } | null = null;
  private readonly reconnector = new Reconnector(() => this.dial());

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  onLiveEvent(fn: (e: ProjectEvent) => void): () => void {
    this.liveListeners.add(fn);
    return () => this.liveListeners.delete(fn);
  }
  private emit(patch: Partial<ProjectSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) fn();
  }

  connect(url: string, projectId: string, userId: string): void {
    this.disconnect();
    this.target = { url, projectId, userId };
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
    const { url, projectId, userId } = target;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.emit({ connected: true });
      this.send(subscribeMessage(projectId, userId));
      this.send({ type: "fleet.brief" });
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
        case "project.snapshot":
          this.reconnector.reset();
          this.emit({
            state: foldProject(msg.events),
            events: msg.events,
            reconnecting: false,
            retry: null,
          });
          break;
        case "project.event": {
          const state = this.snapshot.state ? reduceProject(this.snapshot.state, msg.event) : null;
          this.emit({ state, events: [...this.snapshot.events, msg.event] });
          for (const fn of this.liveListeners) fn(msg.event);
          break;
        }
        case "fleet.brief":
          this.emit({ brief: msg.markdown });
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
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
    this.emit({ connected: false, reconnecting: false, retry: null });
  }

  /** Sends on an open socket; while a re-dial is in flight the message is dropped, not thrown. */
  send(msg: ProjectClientMessage): void {
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }
}
