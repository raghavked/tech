/**
 * `HenosisServer.attach` (server.ts): the routes and the websocket on an http server the
 * caller owns, with a path prefix a platform put in front and the websocket on any path, as
 * the Vercel function at api/server.ts mounts it.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServerMessage } from "@henosis/protocol";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { HenosisServer } from "../src/server.js";

describe("attach", () => {
  let root: string;
  let server: HenosisServer;
  let base: string;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-attach-"));
    server = new HenosisServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    const http = createServer();
    server.attach(http, { wsPath: null, apiPrefix: "/api/server/" });
    const port = await new Promise<number>((r) =>
      http.listen(0, "127.0.0.1", () => {
        const a = http.address();
        r(typeof a === "object" && a ? a.port : 0);
      }),
    );
    base = `http://127.0.0.1:${port}`;
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("answers the routes with and without the prefix", async () => {
    for (const path of ["/api/health", "/api/server/api/health", "/health", "/api/server/health"]) {
      const h = (await (await fetch(`${base}${path}`)).json()) as Record<string, unknown>;
      expect(h).toMatchObject({ ok: true, model: "scripted", store: "file", auth: "dev" });
    }
    const auth = (await (await fetch(`${base}/api/server/api/auth`)).json()) as { mode: string };
    expect(auth.mode).toBe("dev");
    expect((await fetch(`${base}/api/server`)).status).toBe(404);
    expect((await fetch(`${base}/api/serverless`)).status).toBe(404);
  });

  it("takes a websocket join on whatever path the upgrade arrived on", async () => {
    for (const path of ["/ws", "/api/server", "/api/server?__path=/ws"]) {
      const ws = new WebSocket(`${base.replace(/^http/, "ws")}${path}`);
      await new Promise<void>((r) => ws.once("open", () => r()));
      const snapshot = new Promise<ServerMessage>((resolve) => {
        ws.on("message", (raw) => {
          const m = JSON.parse(raw.toString()) as ServerMessage;
          if (m.type === "snapshot") resolve(m);
        });
      });
      ws.send(
        JSON.stringify({
          type: "join",
          sessionId: `s-${path.replace(/[^a-z]/g, "")}`,
          actor: { id: "ana", kind: "human", name: "Ana" },
          branch: "main",
          projectId: "default",
        }),
      );
      expect((await snapshot).type).toBe("snapshot");
      ws.close();
    }
  });

  it("still listens on /ws only by default", async () => {
    const other = new HenosisServer({
      root: mkdtempSync(join(tmpdir(), "henosis-attach2-")),
      model: new ScriptedModel(),
      tools: defaultTools(),
    });
    const port = await other.listen(0);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/elsewhere`);
    const failed = await new Promise<boolean>((r) => {
      ws.once("error", () => r(true));
      ws.once("open", () => r(false));
    });
    expect(failed).toBe(true);
    await other.close();
  });
});
