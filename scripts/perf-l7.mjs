#!/usr/bin/env node
/**
 * The paint measurements design/henosis/BACKLOG.md L7 asks for, taken on the built web app
 * (apps/web/dist) against a real Henosis server with forty sessions on one fleet board:
 *
 *   1. the canvas wash: the radial gradient `--canvas-wash` the main column paints against the
 *      blurred disc loading-screens proposed (and two ways of keeping that disc), and against
 *      no wash at all — paint and raster at load and while the board scrolls through its forty
 *      rows, the frame times the scroll produces, the document's width (a blur bleeds), and
 *      the weight of a full-page PNG of the board (the finding that started the question);
 *   2. the team colours on a route change: `--team-*` set at once on `:root` (what ships),
 *      the 500 ms crossfade MOTION.md 6.10 asked to measure, and the same change under Calm —
 *      style recalculations, paint and raster while every reader of the team properties
 *      repaints, and the frames each one drops;
 *   3. `--accent-ink` in dark on the session page (SYSTEM.md §20): the colour the hand's text
 *      resolves to beside the apricot pulses, its contrast on the canvas and the surface, and a
 *      1440×900 shot of that page in dark for the eye.
 *
 *   node scripts/perf-l7.mjs [--runs 5] [--rows 40] [--json out.json] [--shots dir]
 *
 * Needs `pnpm build` first and a Chromium: Playwright's own, or the binary PW_CHROMIUM names
 * (the variable apps/web/playwright.config.ts reads). The server runs offline with the web
 * fixtures (apps/web/test/fixtures) in a store of its own; `vite preview` serves dist and
 * proxies the socket and the API to it, as the Playwright runs do. Paint numbers come from
 * Chromium's own trace (devtools.timeline), so they are the renderer's accounting, not a stopwatch.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const runs = Number(args.runs ?? 5);
const rows = Number(args.rows ?? 40);
const shots = args.shots ? path.resolve(args.shots) : null;

const SERVER_PORT = 7741;
const WEB_PORT = 4191;
const PROJECT = "default";
const USER = { id: "ana", name: "Ana" };
/** The Apricot preset from apps/web/src/theme.ts: every one of the four properties changes. */
const TEAM = {
  "--team-accent": "#2A3244",
  "--team-highlight": "#E2C4A6",
  "--team-surface": "#56352D",
  "--team-glow": "#E2C4A6",
};

/** loading-screens' blurred disc, as the v6 draft of tokens.css drew it under `.main::before`. */
const DISC =
  '.main{background:var(--canvas)!important}.main::before{content:\"\";position:absolute;left:10%;top:-320px;width:1100px;height:560px;max-width:100%;border-radius:50%;background:var(--wash);filter:blur(110px);pointer-events:none;z-index:-1}';

/** The wash as the app ships it, the disc that was tried, and none, so each one's cost shows. */
const WASHES = [
  { name: "radial gradient (shipped)", css: "" },
  { name: "blurred disc (loading-screens)", css: DISC },
  { name: "no wash", css: ".main{background:var(--canvas)!important}" },
  // Two ways the disc might have been kept: the blur's bleed clipped at the main column's edge,
  // and the disc on a compositor layer of its own so the blur is rasterised once, not per scroll.
  { name: "blurred disc, clipped", css: `${DISC}.main{overflow:clip}` },
  {
    name: "blurred disc, clipped, own layer",
    css: `${DISC}.main{overflow:clip}.main::before{will-change:transform}`,
  },
];

async function main() {
  const dist = path.join(root, "apps/web/dist");
  await fs.access(path.join(dist, "index.html")).catch(() => {
    throw new Error("apps/web/dist is missing: run `pnpm build` first");
  });
  if (shots) await fs.mkdir(shots, { recursive: true });
  const { chromium } = await import("@playwright/test");
  const exe = process.env.PW_CHROMIUM;
  const browser = await chromium.launch({
    headless: true,
    ...(exe ? { executablePath: exe } : {}),
  });
  const store = path.join(root, "store-perf-l7");
  const procs = [];
  try {
    await fs.rm(store, { recursive: true, force: true });
    await fs.mkdir(store, { recursive: true });
    for (const f of ["orgs.json", "users.json", "agents.json"])
      await fs.copyFile(path.join(root, "apps/web/test/fixtures", f), path.join(store, f));
    procs.push(
      spawn(
        "node",
        [
          "packages/cli/dist/main.js",
          "serve",
          "--port",
          String(SERVER_PORT),
          "--host",
          "127.0.0.1",
          "--dir",
          store,
        ],
        { cwd: root, env: { ...process.env, HENOSIS_OFFLINE: "1" }, stdio: "ignore" },
      ),
    );
    await waitFor(`http://127.0.0.1:${SERVER_PORT}/health`);
    procs.push(
      spawn(
        "pnpm",
        [
          "exec",
          "vite",
          "preview",
          "--host",
          "127.0.0.1",
          "--port",
          String(WEB_PORT),
          "--strictPort",
        ],
        {
          cwd: path.join(root, "apps/web"),
          env: { ...process.env, HENOSIS_WS: `ws://127.0.0.1:${SERVER_PORT}` },
          stdio: "ignore",
        },
      ),
    );
    await waitFor(`http://127.0.0.1:${WEB_PORT}/`);

    const sessions = await createSessions(rows);
    const session = await runOneSession(sessions[0]);
    const base = `http://127.0.0.1:${WEB_PORT}`;

    const wash = await measureWash(browser, base, rows);
    const crossfade = await measureCrossfade(browser, base, rows);
    const ink = await confirmAccentInk(browser, base, session);
    const out = { chromium: browser.version(), rows, runs, wash, crossfade, accentInk: ink };
    print(out);
    if (args.json) {
      await fs.writeFile(args.json, JSON.stringify(out, null, 2));
      console.log(`\nWrote ${args.json}`);
    }
  } finally {
    await browser.close();
    await Promise.all(
      procs.map(
        (p) =>
          new Promise((r) => {
            p.once("exit", r);
            p.kill();
          }),
      ),
    );
    await fs.rm(store, { recursive: true, force: true, maxRetries: 5 });
  }
}

// ---- the server side --------------------------------------------------------------------

/** `rows` sessions in the project, each with its own id and title, over one project socket. */
async function createSessions(n) {
  const ids = Array.from({ length: n }, (_, i) => `perf-l7-${String(i + 1).padStart(2, "0")}`);
  const ws = new WebSocket(`ws://127.0.0.1:${SERVER_PORT}/ws`);
  await new Promise((r) => ws.once("open", r));
  const send = (m) => ws.send(JSON.stringify(m));
  send({ type: "project.subscribe", projectId: PROJECT, userId: USER.id });
  for (const [i, id] of ids.entries())
    send({
      type: "session.create",
      sessionId: id,
      title: `Row ${i + 1} · ${["Checkout", "Invoices", "Proration", "Refunds", "Ledger"][i % 5]}`,
      policy: { planFirst: true, tokenBudget: 60_000 },
    });
  send({ type: "fleet.brief" });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("no fleet.brief after session.create")), 15_000);
    ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === "fleet.brief") {
        clearTimeout(t);
        resolve();
      } else if (m.type === "error") {
        clearTimeout(t);
        reject(new Error(m.message));
      }
    });
  });
  ws.close();
  return ids;
}

/** One session gets a goal and runs a turn, so its page has a goal label, a plan and a running dot. */
async function runOneSession(sessionId) {
  const ws = new WebSocket(`ws://127.0.0.1:${SERVER_PORT}/ws`);
  await new Promise((r) => ws.once("open", r));
  const send = (m) => ws.send(JSON.stringify(m));
  let seen = 0;
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.type === "snapshot") seen += m.events.length;
    else if (m.type === "event") seen += 1;
  });
  send({
    type: "join",
    sessionId,
    actor: { id: USER.id, kind: "human", name: USER.name },
    branch: "main",
  });
  await new Promise((r) => setTimeout(r, 300));
  send({
    type: "directive",
    input: {
      text: "Build a greeter for the checkout page",
      mode: "steer",
      scope: "goal",
      supersedes: [],
      interrupt: false,
    },
  });
  // Enough of a turn for the stream to carry the goal label and the plan; the page does the rest.
  const until = Date.now() + 6000;
  while (seen < 6 && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
  ws.close();
  return sessionId;
}

// ---- the browser side -------------------------------------------------------------------

async function openPage(
  browser,
  base,
  hash,
  { dark = false, calm = false, css = "", scale = 1, trace = null } = {},
) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: scale,
    colorScheme: dark ? "dark" : "light",
    serviceWorkers: "block",
  });
  await context.addInitScript(
    ({ user, dark, calm, css }) => {
      localStorage.setItem(
        "henosis.identity",
        JSON.stringify({ name: user.name, userId: user.id, token: "" }),
      );
      localStorage.setItem("henosis.theme", dark ? "dark" : "light");
      // The tour, the welcome brief and every first-run sheet stay out of the measurement.
      localStorage.setItem("henosis.tour", "done");
      addEventListener("DOMContentLoaded", () => {
        if (calm) document.documentElement.dataset.motion = "calm";
        if (css) {
          const el = document.createElement("style");
          el.textContent = css;
          document.head.append(el);
        }
      });
    },
    { user: USER, dark, calm, css },
  );
  await context.route(
    (url) => !url.href.startsWith(base),
    (route) => route.abort(),
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  // `trace`: a trace of the load itself, from the navigation until `trace(page)` returns.
  const load = trace
    ? await traced(cdp, async () => {
        await page.goto(`${base}/${hash}`, { waitUntil: "load" });
        return (await trace(page)) ?? {};
      })
    : null;
  if (!trace) await page.goto(`${base}/${hash}`, { waitUntil: "load" });
  return { context, page, cdp, load };
}

async function waitForBoard(page, n) {
  await page.waitForFunction(
    (n) => document.querySelectorAll(".board .rowitem.agentrow").length >= n,
    n,
    {
      timeout: 60_000,
    },
  );
  // Fonts and the first paints settle before anything is traced.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

/**
 * Chromium's trace around `fn`: paint, raster, layout and style-recalc time (ms, every thread),
 * the number of style recalcs and paints, plus whatever `fn` returns from the page.
 */
async function traced(cdp, fn) {
  const events = [];
  const onData = (e) => events.push(...e.value);
  cdp.on("Tracing.dataCollected", onData);
  await cdp.send("Tracing.start", {
    traceConfig: {
      includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline"],
    },
    transferMode: "ReportEvents",
  });
  const result = await fn();
  const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.end");
  await done;
  cdp.off("Tracing.dataCollected", onData);
  return { ...sumTrace(events), ...result };
}

const PAINT = new Set(["Paint", "PrePaint", "Layerize", "Commit", "UpdateLayerTree"]);
const RASTER = new Set(["RasterTask", "ImageDecodeTask"]);
const LAYOUT = new Set(["Layout"]);
const STYLE = new Set(["UpdateLayoutTree"]);

function sumTrace(events) {
  const out = { paintMs: 0, rasterMs: 0, layoutMs: 0, styleMs: 0, paints: 0, recalcs: 0 };
  const open = new Map();
  const add = (name, us) => {
    const ms = us / 1000;
    if (PAINT.has(name)) out.paintMs += ms;
    else if (RASTER.has(name)) out.rasterMs += ms;
    else if (LAYOUT.has(name)) out.layoutMs += ms;
    else if (STYLE.has(name)) out.styleMs += ms;
    if (name === "Paint") out.paints += 1;
    if (name === "UpdateLayoutTree") out.recalcs += 1;
  };
  for (const e of events) {
    if (e.ph === "X") add(e.name, e.dur ?? 0);
    else if (e.ph === "B") {
      const k = `${e.pid}:${e.tid}:${e.name}`;
      (open.get(k) ?? open.set(k, []).get(k)).push(e.ts);
    } else if (e.ph === "E") {
      const k = `${e.pid}:${e.tid}:${e.name}`;
      const start = open.get(k)?.pop();
      if (start !== undefined) add(e.name, e.ts - start);
    }
  }
  for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 100) / 100;
  return out;
}

/** Scroll the board from the top to the bottom and back in `steps` frames; the time of each frame. */
const scrollScript = async (steps) => {
  // The board scrolls inside `.scroll` (styles.css), not the document; find whichever holds it.
  let el = document.querySelector(".board");
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    if (/auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) break;
    el = el.parentElement;
  }
  if (!el || el === document.body) el = document.scrollingElement;
  const max = Math.max(1, el.scrollHeight - el.clientHeight);
  const frames = [];
  const tick = () => new Promise((r) => requestAnimationFrame(() => r(performance.now())));
  let prev = await tick();
  for (let i = 0; i <= steps * 2; i++) {
    const k = i <= steps ? i : steps * 2 - i;
    el.scrollTop = (max * k) / steps;
    const now = await tick();
    frames.push(now - prev);
    prev = now;
  }
  el.scrollTop = 0;
  return {
    frames,
    scrolled: max,
    // A wash that bleeds past the window widens the document: a horizontal scrollbar on every page.
    docWidth: document.documentElement.scrollWidth,
    window: innerWidth,
  };
};

async function measureWash(browser, base, n) {
  const results = [];
  for (const w of WASHES) {
    const samples = [];
    let png = null;
    for (let i = 0; i < runs; i++) {
      const { context, page, cdp, load } = await openPage(browser, base, `#/p/${PROJECT}`, {
        css: w.css,
        trace: (p) => waitForBoard(p, n),
      });
      try {
        const r = await traced(cdp, () => page.evaluate(scrollScript, 60));
        samples.push({ ...r, ...frameStats(r.frames), load });
        if (i === 0) {
          const buf = await page.screenshot({ fullPage: true, type: "png" });
          png = buf.length;
          if (shots) await fs.writeFile(path.join(shots, `board-${slug(w.name)}.png`), buf);
        }
      } finally {
        await context.close();
      }
    }
    results.push({ name: w.name, png, samples });
  }
  return results;
}

async function measureCrossfade(browser, base, n) {
  const results = [];
  // What ships sets the four properties at once; the 500 ms crossfade on :root is re-created
  // here so the cost that retired it stays measurable, and Calm is checked to be instant.
  const variants = [
    { name: "idle (nothing changes)", calm: false, change: false, css: "" },
    { name: "set at once (shipped)", calm: false, change: true, css: "" },
    {
      name: "crossfade 500 ms on :root (MOTION.md 6.10, retired)",
      calm: false,
      change: true,
      css: ":root{transition:--team-accent .5s,--team-highlight .5s,--team-surface .5s,--team-glow .5s}",
    },
    { name: "set at once, Calm", calm: true, change: true, css: "" },
  ];
  for (const v of variants) {
    const samples = [];
    for (let i = 0; i < runs; i++) {
      const { context, page, cdp } = await openPage(browser, base, `#/p/${PROJECT}`, {
        calm: v.calm,
        css: v.css,
      });
      try {
        await waitForBoard(page, n);
        const readers = await page.evaluate(() => {
          // Every element whose computed colours could move. The team properties are registered as
          // inheriting, so this is every element on the page: each one's style is recomputed per frame.
          let n = 0;
          for (const el of document.querySelectorAll("*")) {
            const cs = getComputedStyle(el);
            const v = cs.getPropertyValue("--team-accent") + cs.getPropertyValue("--accent");
            if (v.trim()) n += 1;
          }
          return n;
        });
        const r = await traced(cdp, () =>
          page.evaluate(
            async (theme) => {
              const root = document.documentElement;
              const tick = () =>
                new Promise((r) => requestAnimationFrame(() => r(performance.now())));
              const frames = [];
              let prev = await tick();
              const t0 = prev;
              for (const [k, v] of Object.entries(theme)) root.style.setProperty(k, v);
              // Watch 700 ms: the 500 ms crossfade and the frames after it settle.
              while (prev - t0 < 700) {
                const now = await tick();
                frames.push(now - prev);
                prev = now;
              }
              for (const k of Object.keys(theme)) root.style.removeProperty(k);
              return { frames };
            },
            v.change ? TEAM : {},
          ),
        );
        samples.push({ ...r, ...frameStats(r.frames), readers });
      } finally {
        await context.close();
      }
    }
    results.push({ name: v.name, samples });
  }
  return results;
}

async function confirmAccentInk(browser, base, sessionId) {
  const { context, page } = await openPage(browser, base, `#/p/${PROJECT}/s/${sessionId}`, {
    dark: true,
  });
  try {
    await page.waitForSelector(".composer", { timeout: 60_000 });
    const found = await page
      .waitForSelector(".msg .goal, .joinline .who, .plan .pstep .used.sofar, .linkish", {
        timeout: 15_000,
      })
      .then(() => true)
      .catch(() => false);
    if (!found) {
      const seen = await page.evaluate(() => ({
        text: document.body.innerText.slice(0, 800),
        classes: [...new Set([...document.querySelectorAll("[class]")].map((e) => e.className))]
          .filter((c) => typeof c === "string")
          .slice(0, 120),
      }));
      console.error("session page without the hand's text:", JSON.stringify(seen, null, 1));
      if (shots) await page.screenshot({ path: path.join(shots, "session-dark-missing.png") });
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    const read = await page.evaluate(() => {
      const first = (sel) => document.querySelector(sel);
      const colour = (el) => (el ? getComputedStyle(el).color : null);
      const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null);
      const pseudo = (el, p) => (el ? getComputedStyle(el, p).backgroundColor : null);
      const rootCs = getComputedStyle(document.documentElement);
      const token = (k) => rootCs.getPropertyValue(k).trim();
      const inkEl =
        first(".msg .goal") ??
        first(".joinline .who") ??
        first(".plan .pstep .used.sofar") ??
        first(".linkish");
      const pulseEl = first(".pill.planning") ?? first(".status.running") ?? first(".mode");
      const chipDot = first(".tokmeter .dot, .meterchip .dot, .usage .dot");
      // The stream's top: the goal label sits on the first human message.
      const scroller = document.querySelector(".scroll");
      if (scroller) scroller.scrollTop = 0;
      const box = (el) => {
        const r = el?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
      };
      return {
        theme: document.documentElement.dataset.theme ?? null,
        inkSelector: inkEl?.className ?? null,
        inkText: inkEl?.textContent?.trim().slice(0, 40) ?? null,
        inkBox: box(inkEl?.closest(".msg, .joinline, .plan") ?? inkEl),
        pulseBox: box(pulseEl),
        inkColour: colour(inkEl),
        pulseColour: pseudo(pulseEl, "::before") ?? bg(chipDot),
        canvas: bg(first(".main")),
        surface: bg(first(".msg.human")) ?? bg(first(".card")) ?? token("--surface"),
        tokens: {
          accent: token("--accent"),
          accentInk: token("--accent-ink"),
          apricot: token("--apricot"),
          canvas: token("--canvas"),
          surface: token("--surface"),
        },
      };
    });
    const ink = toHex(read.inkColour) ?? read.tokens.accentInk;
    const canvas = toHex(read.canvas) ?? read.tokens.canvas;
    const surface = toHex(read.surface) ?? read.tokens.surface;
    const pulse = toHex(read.pulseColour) ?? read.tokens.apricot;
    if (shots) {
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(shots, "session-dark.png") });
      // The same page at 3x, clipped to the hand's text and to the pulse beside it.
      const three = await openPage(browser, base, `#/p/${PROJECT}/s/${sessionId}`, {
        dark: true,
        scale: 3,
      });
      try {
        await three.page.waitForSelector(".composer", { timeout: 60_000 });
        await three.page.evaluate(() => document.fonts.ready);
        await three.page.evaluate(() => {
          const scroller = document.querySelector(".scroll");
          if (scroller) scroller.scrollTop = 0;
        });
        await three.page.waitForTimeout(800);
        const clips = [
          ["session-dark-ink-3x.png", read.inkBox],
          ["session-dark-pulse-3x.png", read.pulseBox],
        ];
        for (const [file, b] of clips) {
          if (!b) continue;
          const clip = {
            x: Math.max(0, b.x - 24),
            y: Math.max(0, b.y - 24),
            width: Math.min(1440, b.width + 48),
            height: Math.min(900, b.height + 48),
          };
          await three.page.screenshot({ path: path.join(shots, file), clip, scale: "device" });
        }
      } finally {
        await three.context.close();
      }
    }
    return {
      ...read,
      ink,
      canvas,
      surface,
      pulse,
      onCanvas: round(contrast(ink, canvas)),
      onSurface: round(contrast(ink, surface)),
      inkVsPulse: round(contrast(ink, pulse)),
      pulseOnCanvas: round(contrast(pulse, canvas)),
    };
  } finally {
    await context.close();
  }
}

// ---- arithmetic -------------------------------------------------------------------------

function frameStats(frames) {
  const sorted = [...frames].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return {
    frameCount: frames.length,
    frameMean: round(frames.reduce((n, x) => n + x, 0) / Math.max(1, frames.length)),
    frameP95: round(at(0.95)),
    frameMax: round(sorted.at(-1) ?? 0),
    // A frame over 20 ms missed the 60 Hz tick; over 34 ms it missed two.
    dropped: frames.filter((f) => f > 20).length,
  };
}

function median(xs) {
  const s = [...xs].filter((x) => typeof x === "number").sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function round(x) {
  return Math.round(x * 100) / 100;
}

function luminance(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = [16, 8, 0].map((shift) => {
    const v = ((n >> shift) & 255) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a, b) {
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return 1;
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** "rgb(202, 164, 155)" → "#CAA49B"; a transparent or odd value → null. */
function toHex(rgb) {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(rgb ?? "");
  if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return null;
  return `#${[m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ---- plumbing ---------------------------------------------------------------------------

async function waitFor(url) {
  const until = Date.now() + 60_000;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`${url} did not come up`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else out[key] = true;
  }
  return out;
}

function print(out) {
  const ms = (x) => (x === null ? "–" : `${Math.round(x)} ms`);
  const med = (samples, k) => median(samples.map((s) => s[k]));
  console.log(
    `## The wash on the fleet board (${out.rows} rows, 60-step scroll down and back, median of ${out.runs}; headless Chromium ${out.chromium})\n`,
  );
  console.log(
    "| wash | load: paint | load: raster | load: style | scroll: paint | scroll: raster | paints | frame mean | p95 | max | dropped | document width | full-page PNG |",
  );
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  const ld = (r, k) => median(r.samples.map((s) => s.load?.[k]));
  for (const r of out.wash)
    console.log(
      `| ${r.name} | ${ms(ld(r, "paintMs"))} | ${ms(ld(r, "rasterMs"))} | ${ms(ld(r, "styleMs"))} | ${ms(med(r.samples, "paintMs"))} | ${ms(med(r.samples, "rasterMs"))} | ${med(r.samples, "paints")} | ${med(r.samples, "frameMean")?.toFixed(1)} ms | ${med(r.samples, "frameP95")?.toFixed(1)} ms | ${med(r.samples, "frameMax")?.toFixed(1)} ms | ${med(r.samples, "dropped")} of ${med(r.samples, "frameCount")} | ${med(r.samples, "docWidth")} of ${med(r.samples, "window")} px | ${r.png === null ? "–" : `${Math.round(r.png / 1024)} KB`} |`,
    );
  console.log(
    `\n## The team-colour crossfade on the fleet board (${out.rows} rows, 700 ms watched, median of ${out.runs})\n`,
  );
  console.log(
    "| change | readers | style recalcs | style | paint | raster | paints | frame mean | p95 | max | dropped |",
  );
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const r of out.crossfade)
    console.log(
      `| ${r.name} | ${med(r.samples, "readers")} | ${med(r.samples, "recalcs")} | ${ms(med(r.samples, "styleMs"))} | ${ms(med(r.samples, "paintMs"))} | ${ms(med(r.samples, "rasterMs"))} | ${med(r.samples, "paints")} | ${med(r.samples, "frameMean")?.toFixed(1)} ms | ${med(r.samples, "frameP95")?.toFixed(1)} ms | ${med(r.samples, "frameMax")?.toFixed(1)} ms | ${med(r.samples, "dropped")} of ${med(r.samples, "frameCount")} |`,
    );
  const a = out.accentInk;
  console.log("\n## --accent-ink on the session page in dark\n");
  console.log(
    `- read from: \`${a.inkSelector}\` ("${a.inkText}") → ${a.ink} (token --accent-ink ${a.tokens.accentInk}, --accent ${a.tokens.accent})`,
  );
  console.log(
    `- the pulse beside it: ${a.pulse} (token --apricot ${a.tokens.apricot}); canvas ${a.canvas}; surface ${a.surface}`,
  );
  console.log(
    `- contrast: ${a.onCanvas} : 1 on the canvas, ${a.onSurface} : 1 on the surface; pulse ${a.pulseOnCanvas} : 1 on the canvas; ink against the pulse ${a.inkVsPulse} : 1`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
