/**
 * Websocket front door. One process hosts many sessions; each session is a SessionHost.
 * Phase-0 auth: an optional shared token. Identity is asserted by the client (dev only).
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import {
  ClientMessage,
  DEFAULT_APPROVAL_POLICY,
  type ServerMessage,
  type SessionPolicy,
} from "@atelier/protocol";
import type { Model, ToolRegistry } from "@atelier/runner";
import { type WebSocket, WebSocketServer } from "ws";
import { type ClientLink, SessionHost } from "./host.js";
import { listSessions } from "./storage.js";

export interface ServerOptions {
  root: string;
  model: Model;
  tools: ToolRegistry;
  token?: string | undefined;
  defaultPolicy?: SessionPolicy;
  log?: (line: string) => void;
}

export class AtelierServer {
  readonly hosts = new Map<string, SessionHost>();
  private http: Server | null = null;
  private wss: WebSocketServer | null = null;

  constructor(private readonly opts: ServerOptions) {}

  host(sessionId: string, title?: string): SessionHost {
    let h = this.hosts.get(sessionId);
    if (!h) {
      const policy = this.opts.defaultPolicy ?? {
        approvals: DEFAULT_APPROVAL_POLICY,
        contention: "block",
        maxTurns: 200,
      };
      const base = {
        root: this.opts.root,
        sessionId,
        model: this.opts.model,
        tools: this.opts.tools,
      };
      const withLog = this.opts.log ? { ...base, log: this.opts.log } : base;
      try {
        h = new SessionHost(withLog);
      } catch {
        h = new SessionHost({ ...withLog, create: { title: title ?? sessionId, policy } });
      }
      this.hosts.set(sessionId, h);
    }
    return h;
  }

  sessions(): string[] {
    return [...new Set([...listSessions(this.opts.root), ...this.hosts.keys()])].sort();
  }

  listen(port: number, hostname = "127.0.0.1"): Promise<number> {
    const http = createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, sessions: this.sessions() }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    const wss = new WebSocketServer({ server: http, path: "/ws" });
    wss.on("connection", (ws, req) => this.connection(ws, req));
    this.http = http;
    this.wss = wss;
    return new Promise((resolve) => {
      http.listen(port, hostname, () => {
        const addr = http.address();
        resolve(typeof addr === "object" && addr ? addr.port : port);
      });
    });
  }

  async close(): Promise<void> {
    for (const h of this.hosts.values()) h.close();
    this.wss?.close();
    await new Promise<void>((r) => (this.http ? this.http.close(() => r()) : r()));
  }

  private connection(ws: WebSocket, _req: IncomingMessage): void {
    let host: SessionHost | null = null;
    let link: ClientLink | null = null;
    const send = (msg: ServerMessage) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    };
    ws.on("message", (raw) => {
      let msg: ClientMessage;
      try {
        msg = ClientMessage.parse(JSON.parse(raw.toString()));
      } catch (err) {
        send({
          type: "error",
          message: `bad message: ${err instanceof Error ? err.message : String(err)}`,
        });
        return;
      }
      if (msg.type === "join") {
        if (this.opts.token && msg.token !== this.opts.token) {
          send({ type: "error", message: "unauthorized" });
          ws.close();
          return;
        }
        if (host && link) host.leave(link);
        host = this.host(msg.sessionId);
        link = { actor: msg.actor, branch: msg.branch, status: "", send };
        host.join(link);
        return;
      }
      if (!host || !link) {
        send({ type: "error", message: "join first" });
        return;
      }
      host.handle(link, msg);
    });
    ws.on("close", () => {
      if (host && link) host.leave(link);
    });
  }
}
