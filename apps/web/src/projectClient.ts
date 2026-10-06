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
import { Reconnector } from "./reconnect.js";

export interface ProjectSnapshot {
  state: ProjectState | null;
  events: ProjectEvent[];
  brief: string | null;
  errors: string[];
  connected: boolean;
  /** The socket dropped and a re-dial is pending or in flight; `state` is kept meanwhile. */
  reconnecting: boolean;
}

type Incoming = ProjectServerMessage | { type: "error"; message: string };

const EMPTY: ProjectSnapshot = {
  state: null,
  events: [],
  brief: null,
  errors: [],
  connected: false,
  reconnecting: false,
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

  private dial(): void {
    const target = this.target;
    if (!target) return;
    const { url, projectId, userId } = target;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.emit({ connected: true });
      this.send({ type: "project.subscribe", projectId, userId });
      this.send({ type: "fleet.brief" });
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
        case "project.snapshot":
          this.reconnector.reset();
          this.emit({ state: foldProject(msg.events), events: msg.events, reconnecting: false });
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
    this.emit({ connected: false, reconnecting: false });
  }

  send(msg: ProjectClientMessage): void {
    this.ws?.send(JSON.stringify(msg));
  }
}
