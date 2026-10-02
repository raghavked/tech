/** Websocket client for one project: folds the project ledger with the fleet reducer. */
import {
  foldProject,
  type ProjectClientMessage,
  type ProjectEvent,
  type ProjectServerMessage,
  type ProjectState,
  reduceProject,
} from "@fold/fleet";

export interface ProjectSnapshot {
  state: ProjectState | null;
  events: ProjectEvent[];
  brief: string | null;
  errors: string[];
  connected: boolean;
}

type Incoming = ProjectServerMessage | { type: "error"; message: string };

const EMPTY: ProjectSnapshot = {
  state: null,
  events: [],
  brief: null,
  errors: [],
  connected: false,
};

export class ProjectClient {
  private ws: WebSocket | null = null;
  snapshot: ProjectSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  private liveListeners = new Set<(e: ProjectEvent) => void>();

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
    const ws = new WebSocket(url);
    this.ws = ws;
    this.emit({ ...EMPTY });
    ws.onopen = () => {
      this.emit({ connected: true });
      this.send({ type: "project.subscribe", projectId, userId });
      this.send({ type: "fleet.brief" });
    };
    ws.onclose = () => this.emit({ connected: false });
    ws.onmessage = (m) => {
      const msg = JSON.parse(String(m.data)) as Incoming;
      switch (msg.type) {
        case "project.snapshot":
          this.emit({ state: foldProject(msg.events), events: msg.events });
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
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
    this.emit({ connected: false });
  }

  send(msg: ProjectClientMessage): void {
    this.ws?.send(JSON.stringify(msg));
  }
}
