/**
 * The Henosis server as one Vercel Function (docs/20_hosting.md). Vercel's Node runtime takes
 * a module whose default export is a `node:http` Server and keeps the websocket connections
 * it upgrades pinned to this instance. `vercel.json` rewrites `/ws` and every `/api/*` route
 * here, so the function is reached as `/api/server` (plus whatever the rewrite carried), and
 * the web app at `/app/` keeps talking to `/ws` and `/api/...` on its own origin, exactly as
 * it does against `henosis serve`.
 *
 * One HenosisServer is built per function instance, lazily on the first request, from the
 * environment:
 *
 *   HENOSIS_STORE=postgres + HENOSIS_DATABASE_URL   the store (file under HENOSIS_DIR otherwise)
 *   HENOSIS_DIR                                      the blobs root (/tmp/henosis-store by default)
 *   ANTHROPIC_API_KEY, HENOSIS_OFFLINE=1             the Claude model, or the scripted one
 *   HENOSIS_AUTH=supabase, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, HENOSIS_AUTO_JOIN
 *   HENOSIS_TOKEN                                    the dev-mode shared token instead
 *
 * Everything the function does with the store, the model and identity is the same code
 * `henosis serve` runs; only the http server is Vercel's.
 */
import { mkdirSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Duplex } from "node:stream";
import {
  ClaudeModel,
  claudeAvailable,
  defaultTools,
  type Model,
  ScriptedModel,
} from "@henosis/runner";
import { authConfigFromEnv, HenosisServer, openLiveStore, storeKindOf } from "@henosis/server";

/** Fluid compute: a session's websocket may stay open this long (seconds). */
export const config = { maxDuration: 300 };

/** Where the rewrites land; the server strips it from every route it is asked for. */
const API_PREFIX = "/api/server";
/** The query parameter `vercel.json` puts the original path in, in case the runtime only shows the destination. */
const PATH_PARAM = "__path";

const http = createServer();
let booting: Promise<HenosisServer> | null = null;
let attached = false;

const log = (line: string) => process.stderr.write(`${line}\n`);

/** The model `henosis serve --model claude` would run, when the key is there; the scripted one otherwise. */
function pickModel(): Model {
  if (process.env.HENOSIS_OFFLINE === "1" || !claudeAvailable()) return new ScriptedModel();
  return new ClaudeModel();
}

async function build(): Promise<HenosisServer> {
  const root = resolve(process.env.HENOSIS_DIR || "/tmp/henosis-store");
  mkdirSync(root, { recursive: true });
  const kind = storeKindOf(process.env.HENOSIS_STORE || "file");
  const store = await openLiveStore(kind, {
    root,
    databaseUrl: process.env.HENOSIS_DATABASE_URL,
    log,
  });
  const token = process.env.HENOSIS_TOKEN;
  const auth = authConfigFromEnv(process.env, token);
  const model = pickModel();
  const server = new HenosisServer({
    root,
    store,
    model,
    tools: defaultTools(),
    token,
    auth,
    log,
  });
  server.attach(http, { wsPath: null, apiPrefix: API_PREFIX });
  attached = true;
  log(`henosis function up (model ${server.describe().model}, store ${kind}, auth ${auth.mode})`);
  return server;
}

/** The one server of this instance; a failed build is retried on the next request. */
function boot(): Promise<HenosisServer> {
  if (!booting)
    booting = build().catch((err: unknown) => {
      booting = null;
      throw err;
    });
  return booting;
}

/**
 * The path the person asked for. The rewrite carries it in `__path` for the case where the
 * runtime shows only the destination; when the original path is already there (`/api/me`,
 * `/api/server/api/me`) nothing changes except that the carrier parameter goes.
 */
function normalize(req: IncomingMessage): void {
  const url = new URL(req.url ?? "/", "http://localhost");
  const carried = url.searchParams.get(PATH_PARAM);
  if (carried === null) return;
  url.searchParams.delete(PATH_PARAM);
  if (url.pathname === API_PREFIX || url.pathname === `${API_PREFIX}/`)
    url.pathname = carried.startsWith("/") ? carried : `/${carried}`;
  req.url = `${url.pathname}${url.search}`;
}

function fail(res: ServerResponse, err: unknown): void {
  res.writeHead(503, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
}

// Until the server is attached, every request waits for the build and is then replayed to it;
// after that these listeners do nothing and the server's own take over.
http.on("request", (req: IncomingMessage, res: ServerResponse) => {
  normalize(req);
  if (attached) return;
  boot().then(
    () => http.emit("request", req, res),
    (err: unknown) => fail(res, err),
  );
});
http.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
  normalize(req);
  if (attached) return;
  boot().then(
    () => http.emit("upgrade", req, socket, head),
    () => socket.destroy(),
  );
});

export default http;
