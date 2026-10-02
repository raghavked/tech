#!/usr/bin/env node
/**
 * Measure the built web app (apps/web/dist): the size of every chunk, which chunks the first
 * paint waits on, time-to-interactive in headless Chromium against a local static server, and
 * how long the session view takes to show each live event on top of a long log.
 *
 *   node scripts/perf.mjs [--dist apps/web/dist] [--runs 7] [--json out.json] [--no-browser]
 *
 * Bundle numbers need nothing but the dist folder. Browser numbers use Playwright's Chromium,
 * or the binary PW_CHROMIUM points at (the same variable apps/web/playwright.config.ts reads);
 * when neither launches, the bundle table is printed and the browser part is skipped.
 *
 * Time-to-interactive here is: the view has rendered (its first real content is in the DOM) and
 * the main thread has then been free of long tasks (>50 ms) for 500 ms. It is measured cold, in
 * a fresh browser context per run with the service worker blocked and third-party requests cut,
 * so the numbers are about the network and the JavaScript, not the cache or the font host. The
 * static server gzips like a real host would. The live-stream scenario speaks the websocket
 * protocol from a stub server: a snapshot of a long session, then one event at a time; what is
 * timed is the gap between a message arriving and the DOM changing for it.
 */
import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = path.resolve(root, args.dist ?? "apps/web/dist");
const runs = Number(args.runs ?? 7);

async function main() {
  const bundle = await measureBundle(dist);
  printBundle(bundle);
  const browser = args["no-browser"] ? null : await measureBrowser(dist, runs);
  if (browser) printBrowser(browser, runs);
  if (args.json) {
    await fs.writeFile(args.json, JSON.stringify({ dist, bundle, browser }, null, 2));
    console.log(`\nWrote ${args.json}`);
  }
}

// ---- bundle -----------------------------------------------------------------------------

async function measureBundle(dir) {
  const html = await fs.readFile(path.join(dir, "index.html"), "utf8");
  const attr = (re) => [...html.matchAll(re)].map((m) => m[1].replace(/^\//, ""));
  const entries = attr(/<script[^>]+type="module"[^>]+src="([^"]+)"/g);
  const preload = attr(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g);
  const styles = attr(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g);
  const files = (await fs.readdir(path.join(dir, "assets"))).map((f) => `assets/${f}`);
  const assets = new Map();
  for (const f of files) {
    const buf = await fs.readFile(path.join(dir, f));
    const js = f.endsWith(".js");
    const text = js ? buf.toString("utf8") : "";
    assets.set(f, {
      file: f,
      raw: buf.length,
      gzip: gzipSync(buf).length,
      brotli: brotliCompressSync(buf).length,
      imports: js ? importsOf(text, "static") : [],
      dynamic: js ? importsOf(text, "dynamic") : [],
    });
  }
  // The critical path: the entry, its static imports (transitively), preloads and stylesheets.
  const critical = new Set([...styles, ...preload]);
  const walk = (f) => {
    if (critical.has(f) || !assets.has(f)) return;
    critical.add(f);
    for (const i of assets.get(f).imports) walk(i);
  };
  for (const e of entries) walk(e);
  const rows = [...assets.values()]
    .map((a) => ({ ...a, critical: critical.has(a.file) }))
    .sort((a, b) => Number(b.critical) - Number(a.critical) || b.raw - a.raw);
  const sum = (xs, k) => xs.reduce((n, x) => n + x[k], 0);
  const crit = rows.filter((r) => r.critical);
  const lazy = rows.filter((r) => !r.critical);
  return {
    entries,
    rows,
    totals: {
      critical: { files: crit.length, raw: sum(crit, "raw"), gzip: sum(crit, "gzip") },
      lazy: { files: lazy.length, raw: sum(lazy, "raw"), gzip: sum(lazy, "gzip") },
      all: { files: rows.length, raw: sum(rows, "raw"), gzip: sum(rows, "gzip") },
    },
  };
}

/** Relative chunk references in a built module, static (`from"./x.js"`) or dynamic (`import("./x.js")`). */
function importsOf(text, kind) {
  const out = new Set();
  for (const m of text.matchAll(/(import\s*\(\s*)?["'](\.\/[^"']+\.js)["']/g)) {
    const dynamic = Boolean(m[1]);
    if ((kind === "dynamic") === dynamic) out.add(`assets/${m[2].slice(2)}`);
  }
  return [...out];
}

function printBundle(b) {
  console.log(`## Bundle (${path.relative(root, dist) || dist})\n`);
  console.log("| chunk | raw | gzip | brotli | on first paint |");
  console.log("|---|---:|---:|---:|---|");
  for (const r of b.rows)
    console.log(
      `| ${path.basename(r.file)} | ${kb(r.raw)} | ${kb(r.gzip)} | ${kb(r.brotli)} | ${r.critical ? "yes" : "lazy"} |`,
    );
  const t = b.totals;
  console.log(
    `\nFirst paint waits on ${t.critical.files} files: ${kb(t.critical.raw)} raw, ${kb(t.critical.gzip)} gzip. ` +
      `Lazy: ${t.lazy.files} files, ${kb(t.lazy.raw)} raw, ${kb(t.lazy.gzip)} gzip. ` +
      `All: ${kb(t.all.raw)} raw, ${kb(t.all.gzip)} gzip.`,
  );
}

// ---- browser ----------------------------------------------------------------------------

const PROFILES = [
  { name: "local", network: null, cpu: 1 },
  {
    // Lighthouse's "Fast 3G" with a mid-tier phone: 1.6 Mbps down, 750 kbps up, 150 ms RTT, 4x CPU.
    name: "fast 3G, 4x CPU",
    network: { latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 },
    cpu: 4,
  },
];

/** The live stream is about the main thread, so it runs unthrottled and with the slow CPU only. */
const STREAM_PROFILES = [
  { name: "local", network: null, cpu: 1 },
  { name: "4x CPU", network: null, cpu: 4 },
];

/** The stream scenario: a session this long in the snapshot, then this many live events. */
const HISTORY_TURNS = 200;
const LIVE_EVENTS = 40;
const LIVE_GAP_MS = 150;

const SCENARIOS = [
  // A new browser on the home page: no identity, nothing but the entry chunk.
  { name: "home (no identity)", hash: "#/", identity: false, ready: { sel: ".home" } },
  // A deep link into a session: the session view (lazy after this pass) with no server behind it.
  {
    name: "session deep link",
    hash: "#/p/default/s/perf",
    identity: true,
    ready: { sel: ".main .column p.muted", re: "Connecting|Joining" },
  },
];

const STREAM_SESSION = "perf-stream";

const STREAM_SCENARIO = {
  name: `live stream (${HISTORY_TURNS} turns, +${LIVE_EVENTS} events)`,
  hash: `#/p/default/s/${STREAM_SESSION}`,
  identity: true,
  ready: { sel: ".composer" },
  stream: true,
};

async function measureBrowser(dir, n) {
  let chromium;
  try {
    ({ chromium } = await import("@playwright/test"));
  } catch {
    console.log("\n(Playwright is not installed; skipping the browser measurement.)");
    return null;
  }
  const exe = process.env.PW_CHROMIUM;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  } catch (e) {
    console.log(
      `\n(No Chromium to measure with: ${String(e.message).split("\n")[0]}. Set PW_CHROMIUM to a binary.)`,
    );
    return null;
  }
  const server = await serve(dir);
  const results = [];
  const streams = [];
  try {
    for (const profile of PROFILES)
      for (const scenario of SCENARIOS) {
        const samples = [];
        for (let i = 0; i < n; i++) samples.push(await runOnce(browser, server, profile, scenario));
        results.push({ profile: profile.name, scenario: scenario.name, samples });
      }
    const streamRuns = Math.min(n, 3);
    for (const profile of STREAM_PROFILES) {
      const samples = [];
      for (let i = 0; i < streamRuns; i++)
        samples.push(await runOnce(browser, server, profile, STREAM_SCENARIO));
      streams.push({ profile: profile.name, scenario: STREAM_SCENARIO.name, samples });
    }
  } finally {
    await browser.close();
    server.close();
  }
  return { chromium: browser.version(), results, streams };
}

async function runOnce(browser, server, profile, scenario) {
  const base = server.url;
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    if (scenario.identity)
      await context.addInitScript(() => {
        localStorage.setItem(
          "fold.identity",
          JSON.stringify({ name: "Ana", userId: "ana", token: "" }),
        );
      });
    await context.addInitScript((ready) => {
      const perf = { firstRender: null, viewReady: null, longTasks: [], pending: null, events: [] };
      window.__foldPerf = perf;
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries())
            perf.longTasks.push({ start: e.startTime, end: e.startTime + e.duration });
        }).observe({ type: "longtask", buffered: true });
      } catch {
        // no long task timing in this browser
      }
      // A live event is timed from the websocket message to the DOM change it causes.
      const desc = Object.getOwnPropertyDescriptor(WebSocket.prototype, "onmessage");
      if (desc?.set) {
        Object.defineProperty(WebSocket.prototype, "onmessage", {
          configurable: true,
          get() {
            return desc.get.call(this);
          },
          set(fn) {
            desc.set.call(this, (ev) => {
              if (typeof ev.data === "string" && ev.data.startsWith('{"type":"event"'))
                perf.pending = performance.now();
              return fn.call(this, ev);
            });
          },
        });
      }
      const check = () => {
        if (perf.pending !== null) {
          perf.events.push(performance.now() - perf.pending);
          perf.pending = null;
        }
        const root = document.getElementById("root");
        if (perf.firstRender === null && root && root.children.length > 0)
          perf.firstRender = performance.now();
        if (perf.viewReady === null) {
          const el = document.querySelector(ready.sel);
          if (el && (!ready.re || new RegExp(ready.re).test(el.textContent ?? ""))) {
            perf.viewReady = performance.now();
            // Tells the stub server the view is up, so it can start the live stream.
            fetch("/__perf/ready", { method: "POST" }).catch(() => undefined);
          }
        }
      };
      // Init scripts run before the document has an element, so observe the document itself.
      new MutationObserver(check).observe(document, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      addEventListener("DOMContentLoaded", check);
      addEventListener("load", check);
    }, scenario.ready);
    // Third parties (the Google Fonts import) are cut so the numbers are about this app alone.
    await context.route(
      (url) => !url.href.startsWith(base),
      (route) => route.abort(),
    );
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    if (profile.network)
      await cdp.send("Network.emulateNetworkConditions", { offline: false, ...profile.network });
    if (profile.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
    server.arm(scenario.stream ? LIVE_EVENTS : 0);
    await page.goto(`${base}/${scenario.hash}`, { waitUntil: "commit" });
    await page.waitForFunction(() => window.__foldPerf.viewReady !== null, null, {
      timeout: 120_000,
    });
    if (scenario.stream)
      await page.waitForFunction((n) => window.__foldPerf.events.length >= n, LIVE_EVENTS, {
        timeout: 120_000,
      });
    // Interactive: the view is up and the main thread has been quiet for 500 ms since.
    return await page.evaluate(async () => {
      const p = window.__foldPerf;
      const lastBusy = () => Math.max(p.viewReady, ...p.longTasks.map((t) => t.end));
      while (performance.now() - lastBusy() < 500) await new Promise((r) => setTimeout(r, 50));
      const nav = performance.getEntriesByType("navigation")[0];
      const res = performance
        .getEntriesByType("resource")
        .filter((r) => r.responseEnd <= lastBusy() + 1);
      const sorted = [...p.events].sort((a, b) => a - b);
      const at = (q) =>
        sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null;
      return {
        firstRender: p.firstRender,
        viewReady: p.viewReady,
        tti: lastBusy(),
        domContentLoaded: nav?.domContentLoadedEventEnd ?? null,
        longTasks: p.longTasks.length,
        longTaskMs: p.longTasks.reduce((n, t) => n + (t.end - t.start), 0),
        requests: res.length,
        transfer: res.reduce((n, r) => n + (r.transferSize || 0), 0),
        eventMedian: at(0.5),
        eventP95: at(0.95),
        eventTotal: sorted.reduce((n, x) => n + x, 0),
      };
    });
  } finally {
    await context.close();
  }
}

function printBrowser(b, n) {
  console.log(
    `\n## Time to interactive (median of ${n} cold runs, headless Chromium ${b.chromium})\n`,
  );
  console.log(
    "| profile | scenario | DOMContentLoaded | first render | view ready | interactive | long tasks | requests | transfer |",
  );
  console.log("|---|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const r of b.results) {
    const med = (k) => median(r.samples.map((s) => s[k]));
    console.log(
      `| ${r.profile} | ${r.scenario} | ${ms(med("domContentLoaded"))} | ${ms(med("firstRender"))} | ${ms(med("viewReady"))} | ${ms(med("tti"))} | ${med("longTasks")} (${ms(med("longTaskMs"))}) | ${med("requests")} | ${kb(med("transfer"))} |`,
    );
  }
  if (!b.streams?.length) return;
  console.log(
    `\n## Live events on a long session (median of ${Math.min(n, 3)} runs; per-event time is message to DOM)\n`,
  );
  console.log(
    "| profile | scenario | snapshot folded and shown | per event (median) | per event (p95) | all live events | long tasks during run |",
  );
  console.log("|---|---|---:|---:|---:|---:|---:|");
  for (const r of b.streams) {
    const med = (k) => median(r.samples.map((s) => s[k]));
    console.log(
      `| ${r.profile} | ${r.scenario} | ${ms(med("viewReady"))} | ${ms(med("eventMedian"))} | ${ms(med("eventP95"))} | ${ms(med("eventTotal"))} | ${med("longTasks")} (${ms(med("longTaskMs"))}) |`,
    );
  }
}

// ---- a synthetic session ----------------------------------------------------------------

const POLICY = {
  approvals: {
    read: "none",
    write: "none",
    exec: "contributor",
    external: "driver",
    irreversible: { quorum: 2, of: "driver" },
  },
  contention: "block",
  maxTurns: 100_000,
};

/** A long session as the server would replay it: one goal, then turns of text and two tool calls each. */
function syntheticSession(sessionId, turns) {
  const events = [];
  let seq = 0;
  const push = (actor, kind, payload) => {
    events.push({
      id: `e${seq}`,
      prev: seq ? `e${seq - 1}` : null,
      seq,
      branch: "main",
      ts: seq,
      actor,
      kind,
      payload,
    });
    seq++;
  };
  push("ana", "session.created", {
    sessionId,
    title: "Perf session",
    policy: POLICY,
    projectId: "default",
    ownerId: "ana",
  });
  push("ana", "participant.joined", {
    actor: { id: "ana", kind: "human", name: "Ana" },
    role: "owner",
  });
  push("agent", "participant.joined", {
    actor: { id: "agent", kind: "agent", name: "Agent" },
    role: "contributor",
  });
  push("ana", "directive.submitted", {
    directiveId: "d1",
    input: {
      text: "Build the thing",
      mode: "steer",
      scope: "goal",
      supersedes: [],
      interrupt: false,
    },
  });
  const turn = (t) => [
    ["agent.turn.started", { turn: t, epoch: t }],
    [
      "agent.model.completed",
      {
        turn: t,
        text: `Turn ${t}: reading the module and running the tests.`,
        toolCalls: [],
        model: "scripted",
      },
    ],
    [
      "agent.tool.requested",
      {
        turn: t,
        call: {
          id: `c${t}a`,
          name: "workspace.read",
          args: { path: `src/mod${t}.ts` },
          risk: "read",
        },
      },
    ],
    [
      "agent.tool.completed",
      { turn: t, result: { callId: `c${t}a`, ok: true, output: "export const x = 1;" } },
    ],
    [
      "agent.tool.requested",
      {
        turn: t,
        call: {
          id: `c${t}b`,
          name: "shell.run",
          args: { command: "pnpm", args: ["test"] },
          risk: "exec",
        },
      },
    ],
    [
      "agent.tool.completed",
      { turn: t, result: { callId: `c${t}b`, ok: true, output: "31 passed" } },
    ],
    ["agent.turn.ended", { turn: t, reason: "done", summary: `continuing: turn ${t}` }],
  ];
  for (let t = 1; t <= turns; t++)
    for (const [kind, payload] of turn(t)) push("agent", kind, payload);
  // The live tail: the same shape, served one event at a time once the page is up.
  const live = [];
  let t = turns;
  while (live.length < LIVE_EVENTS) {
    t++;
    for (const [kind, payload] of turn(t)) {
      push("agent", kind, payload);
      live.push(events.pop());
    }
  }
  return { history: events, live: live.slice(0, LIVE_EVENTS) };
}

// ---- static server with a stub websocket ------------------------------------------------

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

/**
 * Serves the dist folder on an ephemeral port, gzipped, with the SPA fallback and a dead API.
 * `/ws` answers a join with a synthetic snapshot and, once the page posts `/__perf/ready`,
 * streams `armed` live events one at a time.
 */
async function serve(dir) {
  let armed = 0;
  let live = null;
  let socket = null;
  const startStream = () => {
    if (!socket || !live || armed === 0) return;
    const tail = live.slice(0, armed);
    armed = 0;
    let i = 0;
    const tick = () => {
      if (socket?.readyState !== 1 || i >= tail.length) return;
      socket.send(JSON.stringify({ type: "event", event: tail[i++] }));
      setTimeout(tick, LIVE_GAP_MS);
    };
    setTimeout(tick, LIVE_GAP_MS);
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname === "/__perf/ready") {
      res.writeHead(204);
      res.end();
      startStream();
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end('{"error":"no server behind the perf harness"}');
      return;
    }
    const rel = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
    let file = path.join(dir, rel);
    if (!file.startsWith(dir) || !path.extname(file)) file = path.join(dir, "index.html");
    let body;
    try {
      body = await fs.readFile(file);
    } catch {
      res.writeHead(404);
      res.end();
      return;
    }
    const headers = { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" };
    if (/\bgzip\b/.test(req.headers["accept-encoding"] ?? "") && body.length > 1024) {
      body = gzipSync(body);
      headers["content-encoding"] = "gzip";
    }
    headers["content-length"] = body.length;
    res.writeHead(200, headers);
    res.end(body);
  });
  const { WebSocketServer } = await import("ws");
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    socket = ws;
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      // Only the stream scenario's session gets a log; a plain deep link stays at "Joining…".
      if (msg.type !== "join" || msg.sessionId !== STREAM_SESSION) return;
      const s = syntheticSession(msg.sessionId, HISTORY_TURNS);
      live = s.live;
      ws.send(JSON.stringify({ type: "snapshot", branch: "main", events: s.history }));
    });
    ws.on("close", () => {
      if (socket === ws) socket = null;
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    arm: (n) => {
      armed = n;
    },
    close: () => {
      wss.close();
      server.close();
    },
  };
}

// ---- helpers ----------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else out[key] = true;
  }
  return out;
}

function median(xs) {
  const s = xs.filter((x) => typeof x === "number").sort((a, b) => a - b);
  if (s.length === 0) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function kb(n) {
  return n === null ? "–" : `${(n / 1024).toFixed(1)} kB`;
}

function ms(n) {
  return n === null ? "–" : `${Math.round(n)} ms`;
}

await main();
