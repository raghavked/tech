#!/usr/bin/env node
/**
 * The live check (docs/20_hosting.md, "Proving the deployment"): the deployment at
 * HENOSIS_LIVE_URL is wired front to back. Five checks, one line each when they pass, a
 * `FAIL` line and a non-zero exit when any does not:
 *
 *   GET /api/health   the function answers and reports `ok`, `store` and `auth`
 *   GET /api/auth     the identity mode, with the fields each mode promises the web app
 *   GET /app/         the app shell, with its scripts under /app/assets/ (the build landed under the base)
 *   GET /             the landing page, with its hero sentence
 *   /ws               a websocket `join` with no token. In supabase (and oidc) mode the
 *                     server answers the `unauthorized…` error the web client treats as final
 *                     (apps/web/src/client.ts), which proves the rewrite, the function and the
 *                     websocket upgrade all work. A dev-mode server (a local pair) either
 *                     refuses the same way, when it wants its shared token, or lets the join in.
 *
 * Nothing beyond `ws`, which the root already has. CI runs it against the hosted deployment
 * (.github/workflows/ci.yml, job `live`); it runs against a local pair the same way:
 *
 *   HENOSIS_LIVE_URL=https://henosis-raghav14.vercel.app node scripts/live-check.mjs
 */
import WebSocket from "ws";

const TIMEOUT_MS = 20_000;

/**
 * The wire shape of a `join` (packages/protocol/src/index.ts, `ClientMessage`): `sessionId`,
 * the `actor` (`id`, `kind`, `name`) and the `branch`; `token`, `userId`, `projectId`,
 * `title`, `sinceSeq` and `attempt` are optional and left out here on purpose.
 */
const JOIN = {
  type: "join",
  sessionId: "live-check",
  actor: { id: "live-check", kind: "human", name: "Live check" },
  branch: "main",
};

const base = (process.env.HENOSIS_LIVE_URL ?? "").trim().replace(/\/+$/, "");
if (!/^https?:\/\/[^/]+$/.test(base)) {
  console.error(
    "FAIL HENOSIS_LIVE_URL must be the deployment's origin, e.g. https://henosis-raghav14.vercel.app",
  );
  process.exit(2);
}

/** The checks that failed, by name; the exit code says whether there were any. */
const failed = [];
const pass = (check, detail) => console.log(`ok   ${check}: ${detail}`);
const fail = (check, reason) => {
  failed.push(check);
  console.log(`FAIL ${check}: ${reason}`);
};

async function run(check, work) {
  try {
    pass(check, await work());
  } catch (err) {
    fail(check, err instanceof Error ? err.message : String(err));
  }
}

async function get(path, accept) {
  const res = await fetch(`${base}${path}`, {
    redirect: "follow",
    headers: { accept },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  return { res, text };
}

async function getJson(path) {
  const { res, text } = await get(path, "application/json");
  if (!res.ok) throw new Error(`answered ${res.status}: ${excerpt(text)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`did not answer JSON: ${excerpt(text)}`);
  }
}

async function getHtml(path) {
  const { res, text } = await get(path, "text/html");
  if (!res.ok) throw new Error(`answered ${res.status}: ${excerpt(text)}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("text/html")) throw new Error(`answered content-type ${type || "(none)"}`);
  return text;
}

const excerpt = (text) => text.replace(/\s+/g, " ").trim().slice(0, 160);
const isString = (v) => typeof v === "string" && v.trim().length > 0;

// ---- 1. the function answers ----------------------------------------------------------

async function checkHealth() {
  const h = await getJson("/api/health");
  if (h.ok !== true) throw new Error(`ok is ${JSON.stringify(h.ok)}`);
  if (!isString(h.store)) throw new Error(`store is missing: ${JSON.stringify(h)}`);
  if (!isString(h.auth)) throw new Error(`auth is missing: ${JSON.stringify(h)}`);
  const sessions = Array.isArray(h.sessions) ? h.sessions.length : "?";
  const projects = Array.isArray(h.projects) ? h.projects.length : "?";
  return `ok=true model=${h.model ?? "?"} store=${h.store} auth=${h.auth} sessions=${sessions} projects=${projects}`;
}

// ---- 2. how to sign in -----------------------------------------------------------------

/** Returns the mode so the socket check knows what answer to expect. */
async function checkAuth() {
  const a = await getJson("/api/auth");
  if (a.mode === "supabase") {
    if (!isString(a.url) || !/^https:\/\//.test(a.url))
      throw new Error(`supabase mode without a project url: ${JSON.stringify(a)}`);
    if (!isString(a.anonKey)) throw new Error("supabase mode without an anon key");
    return { mode: a.mode, detail: `mode=supabase url=${a.url} anonKey=${a.anonKey.length} chars` };
  }
  if (a.mode === "dev") {
    if (typeof a.tokenRequired !== "boolean")
      throw new Error(`dev mode without tokenRequired: ${JSON.stringify(a)}`);
    return { mode: a.mode, detail: `mode=dev tokenRequired=${a.tokenRequired}` };
  }
  throw new Error(
    `mode is ${JSON.stringify(a.mode)}; the hosted deployment runs supabase (a local pair runs dev)`,
  );
}

// ---- 3. the app shell under its base ---------------------------------------------------

async function checkApp() {
  const html = await getHtml("/app/");
  if (!/<div id="root">/.test(html)) throw new Error('no <div id="root"> in the shell');
  const scripts = [...html.matchAll(/<script[^>]*\ssrc="(\/app\/assets\/[^"]+\.js)"/g)].map(
    (m) => m[1],
  );
  if (scripts.length === 0)
    throw new Error(`no <script src="/app/assets/…js"> in the shell: ${excerpt(html)}`);
  return `the shell with ${scripts.length} script${scripts.length === 1 ? "" : "s"} (${scripts.join(", ")})`;
}

// ---- 4. the landing page ---------------------------------------------------------------

const HERO = "One team, people and agents.";

async function checkLanding() {
  const html = await getHtml("/");
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  if (!text.includes(HERO)) throw new Error(`the hero sentence "${HERO}" is not on the page`);
  return `"${HERO}"`;
}

// ---- 5. the websocket, through the rewrite and the upgrade -----------------------------

function wsUrl() {
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  return url.toString();
}

/** Dial, send the join, and resolve with the first message the server sends back. */
function firstAnswer(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error(`no answer to the join within ${TIMEOUT_MS} ms`));
    }, TIMEOUT_MS);
    const settle = (fn) => (value) => {
      clearTimeout(timer);
      fn(value);
      ws.terminate();
    };
    ws.once("open", () => ws.send(JSON.stringify(JOIN)));
    ws.once(
      "message",
      settle((raw) => resolve(JSON.parse(raw.toString()))),
    );
    ws.once("error", settle(reject));
    ws.once(
      "close",
      settle((code) => reject(new Error(`closed (${code}) before any answer`))),
    );
  });
}

async function checkSocket(mode) {
  const url = wsUrl();
  const answer = await firstAnswer(url);
  if (answer.type === "error" && isString(answer.message)) {
    if (answer.message.startsWith("unauthorized"))
      return `${url} refused the token-less join as the web client expects: "${answer.message}"`;
    throw new Error(`${url} answered an error that is not unauthorized: "${answer.message}"`);
  }
  if (mode === "dev" && ["joined", "snapshot", "presence", "event"].includes(answer.type))
    return `${url} let the join in (dev mode, first message ${answer.type})`;
  throw new Error(
    `${url} answered ${JSON.stringify(answer).slice(0, 160)}; ${mode ?? "supabase"} mode must refuse a join without a token`,
  );
}

// ---- all five ---------------------------------------------------------------------------

console.log(`live check against ${base}`);
await run("GET /api/health", checkHealth);
let mode = null;
await run("GET /api/auth", async () => {
  const a = await checkAuth();
  mode = a.mode;
  return a.detail;
});
await run("GET /app/", checkApp);
await run("GET /", checkLanding);
await run("WS /ws join without a token", () => checkSocket(mode));

if (failed.length > 0) {
  console.log(`live check failed: ${failed.join("; ")}`);
  process.exit(1);
}
console.log("live check: all 5 ok");
