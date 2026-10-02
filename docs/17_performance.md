# Performance

What the web client costs to open and to keep up with a running agent, measured, and what
this pass changed. Everything here comes from `node scripts/perf.mjs` run against a production
build; re-run it after any change to `apps/web` and update the tables.

## What changed

- **Event rendering is memoised.** `blocksOf` (the function that turns the log into stream
  rows) now folds only the events that arrived since the last render: it takes its previous
  result back as a carry (`BlockFold`) and walks the tail. Rows already built keep their
  identity; a row whose tool steps change is replaced, not mutated. Each row is a
  `memo` component (`BlockRow`, `StepLine`), and approval notices compare by value because
  the kernel clones the whole state on every event. `useIncrementalFold` in
  `apps/web/src/incremental.ts` is the generic hook; it falls back to a full fold whenever
  the list it is given is not an extension of the last one (branch switch, reconnect).
- **The rail stays out of the stream's renders.** `Sidebar` is memoised and `Shell` hands it
  a stable close handler, so a stream event no longer redraws every agent card.
- **Views load on demand.** `apps/web/src/views/lazy.ts` wraps the session, project and team
  views in `React.lazy`; `App` shows the shell with an empty column while a chunk is on its
  way, and warms all three chunks once the page is idle. Home stays in the entry chunk because
  it is the first thing a new browser renders.
- **Vendor code is split.** `vite.config.ts` puts React in one chunk and zod in another, so a
  deploy that touches only app code leaves 67 kB (gzip) of React in the browser and service
  worker caches, and so zod (12 kB gzip, only the kernel and the fleet reducer need it) is off
  the first paint.

## Method

`scripts/perf.mjs` reads `apps/web/dist` and prints three tables:

1. **Bundle.** Every chunk with raw, gzip and brotli sizes, and whether the first paint waits
   on it (reachable from the entry through static imports, modulepreloads and stylesheets).
2. **Time to interactive.** Headless Chromium (Playwright's, or `PW_CHROMIUM`) opens the built
   app from a local static server that gzips like a real host. Each run is a fresh browser
   context with the service worker blocked and third-party requests (the Google Fonts import)
   cut, so the numbers are about this app's network and JavaScript, not a cache or a font
   host. Two scenarios: the home page with no identity, and a deep link into a session with no
   Fold server behind it. Two profiles: unthrottled, and Lighthouse's "fast 3G" with a 4x
   slower CPU. *View ready* is the moment the view's own content is in the DOM; *interactive*
   is the view being ready and the main thread then having no long task (>50 ms) for 500 ms.
   Median of 7 cold runs.
3. **Live events on a long session.** A stub websocket server answers the join with a
   200-turn session (1,404 events: a goal, then text and two tool calls per turn), waits for
   the composer to appear, and streams 40 more events one at a time, 150 ms apart. Per-event
   time is from the websocket message arriving to the DOM changing for it, which covers the
   fold, the render and the commit. Median of 3 runs, unthrottled and at 4x CPU.

Before is the tree at the start of this pass; after is this pass. Same machine, same
Chromium 141, runs back to back.

## Numbers

### Bundle

| | before | after |
|---|---:|---:|
| chunks | 1 js + 1 css | 7 js + 1 css |
| first paint waits on | 377.0 kB raw / 109.7 kB gzip (2 files) | 259.5 kB raw / 80.3 kB gzip (3 files) |
| loaded on demand | – | 120.5 kB raw / 34.0 kB gzip (5 files) |
| all | 377.0 kB raw / 109.7 kB gzip | 380.0 kB raw / 114.3 kB gzip |

After, by chunk:

| chunk | raw | gzip | brotli | on first paint |
|---|---:|---:|---:|---|
| react | 216.5 kB | 67.3 kB | 58.0 kB | yes |
| index (app shell, Home, rail) | 22.8 kB | 8.2 kB | 7.3 kB | yes |
| index.css | 20.2 kB | 4.8 kB | 4.2 kB | yes |
| zod | 54.0 kB | 12.4 kB | 11.0 kB | lazy |
| SessionView | 26.1 kB | 7.9 kB | 7.1 kB | lazy |
| client (kernel + websocket client) | 17.4 kB | 6.3 kB | 5.5 kB | lazy |
| Project (fleet reducer) | 16.6 kB | 5.2 kB | 4.7 kB | lazy |
| Team | 6.6 kB | 2.2 kB | 2.0 kB | lazy |

### Time to interactive (median of 7 cold runs)

| profile | scenario | | DOMContentLoaded | first render | view ready | interactive | long tasks | transfer |
|---|---|---|---:|---:|---:|---:|---:|---:|
| local | home | before | 82 ms | 95 ms | 95 ms | 95 ms | 0 | 110.3 kB |
| | | after | 64 ms | 75 ms | 75 ms | **75 ms** | 0 | 81.2 kB |
| local | session deep link | before | 78 ms | 91 ms | 91 ms | 91 ms | 0 | 110.3 kB |
| | | after | 63 ms | 76 ms | 119 ms | **119 ms** | 0 | 117.0 kB |
| fast 3G, 4x CPU | home | before | 1044 ms | 1095 ms | 1095 ms | 1104 ms | 1 (127 ms) | 110.3 kB |
| | | after | 860 ms | 912 ms | 912 ms | **912 ms** | 1 (89 ms) | 81.2 kB |
| fast 3G, 4x CPU | session deep link | before | 1052 ms | 1101 ms | 1101 ms | 1101 ms | 1 (131 ms) | 110.3 kB |
| | | after | 873 ms | 938 ms | 1348 ms | **1348 ms** | 2 (161 ms) | 117.0 kB |

### Live events on a 200-turn session (median of 3 runs)

| profile | | snapshot folded and shown | per event (median) | per event (p95) | all 40 live events |
|---|---|---:|---:|---:|---:|
| local | before | 622 ms | 6 ms | 10 ms | 283 ms |
| | after | 628 ms | **3 ms** | **4 ms** | **102 ms** |
| 4x CPU | before | 2830 ms | 27 ms | 46 ms | 1187 ms |
| | after | 3061 ms | **11 ms** | **21 ms** | **481 ms** |

## Reading the numbers

- The first paint carries 27% fewer gzipped bytes and is interactive about 20 ms sooner on a
  fast machine and about 190 ms sooner on a slow phone. The shell appears earlier in every
  scenario (*first render*).
- Keeping up with a running agent costs half what it did: on a 200-turn session each new
  event takes 3 ms instead of 6 locally and 11 ms instead of 27 on a slow CPU, and the p95
  came down more than the median because the old path re-rendered every row on every event.
  The gain grows with the length of the session; the old cost was linear in it.
- A **cold deep link** into a session (a notification opened in a browser that has never
  loaded Fold) now waits one extra round trip for the session chunk: +28 ms locally, +250 ms
  on fast 3G. Three things make this the right trade: the view chunks are fetched as soon as
  the page is idle, so a navigation inside the app never waits; the service worker caches
  `/assets/` cache-first, so the second deep link is instant; and the chunk hashes are stable
  across deploys that do not touch them, so React and zod stay cached from one release to the
  next.
- Folding the snapshot itself is unchanged, about 620 ms locally and 3 s at 4x CPU for 1,404
  events, and it is the one long task on the way in. That cost is in the kernel, not the
  client; see below.

## Follow-ups, in order of payoff

1. **The reducer clones the state on every event.** `reduce` in `packages/kernel/src/state.ts`
   starts with `structuredClone(prev)`, so folding a snapshot is quadratic in the number of
   turns, and every live event clones the workspace and the turn list before touching a few
   fields. A copy-on-write reducer, or cloning only the records an event writes, would cut the
   snapshot fold by an order of magnitude and would also give React stable references to
   compare, which would let `ApprovalNotice` drop its by-value comparator. This is a kernel
   change with determinism tests behind it, so it was left out of a client pass.
2. **One HTTP request per event.** `SessionView` refetches `/api/projects/:id/sessions` whenever
   `state.seq` changes, to keep the Team pill fresh. It is off the main thread, but on a busy
   session it is a request every few hundred milliseconds; keying the fetch on the events
   that change crews and people, or on a coarse interval, would be enough.
3. **The font import is render-blocking.** `tokens.css` starts with `@import` of the Google
   Fonts stylesheet, so the first paint waits one round trip to that host before any of the
   app's own CSS applies (the harness cuts it, real browsers do not). A `<link rel="preload">`
   or moving the import to a `<link>` in `index.html` lets the fonts load alongside the app.
   `tokens.css` is copied verbatim from `design/`, so the change belongs there.
4. **Step output is sliced on open.** `StepLine` splits a tool's output on every open; long
   outputs could be trimmed once in `blocksOf`.

## Re-running

```bash
pnpm build
node scripts/perf.mjs                      # bundle, time to interactive, live events
node scripts/perf.mjs --no-browser         # bundle only, no Chromium needed
PW_CHROMIUM=/path/to/chrome node scripts/perf.mjs --runs 9 --json perf.json
```

The script is read-only against `apps/web/dist`, serves it on an ephemeral port, and needs no
Fold server: the stub websocket inside it plays the long session.
