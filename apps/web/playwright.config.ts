import { defineConfig } from "@playwright/test";

// The two ports and the store folder: fixed by default, moved with HENOSIS_SMOKE_PORT (the
// preview) and HENOSIS_SMOKE_API_PORT (the server) so two checkouts can run the smoke at once.
const WEB_PORT = Number(process.env.HENOSIS_SMOKE_PORT ?? 4173);
const API_PORT = Number(process.env.HENOSIS_SMOKE_API_PORT ?? 7730);
const STORE = API_PORT === 7730 ? "../../store-web-smoke" : `../../store-web-smoke-${API_PORT}`;

export default defineConfig({
  testDir: "./test",
  // Only the Playwright specs: the *.test.ts files beside them belong to vitest.
  testMatch: /.*\.spec\.ts$/,
  // test/live.spec.ts proves a hosted deployment and has its own config (playwright.live.config.ts).
  testIgnore: /live\.spec\.ts$/,
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    // A preinstalled Chromium can be used instead of a download (e.g. cloud sandboxes).
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  // Both servers are polled and used at 127.0.0.1, so both bind 127.0.0.1 explicitly. `vite
  // preview` listens on "localhost" by default, and on a host whose /etc/hosts maps localhost to
  // ::1 as well (GitHub's Ubuntu runners do) Node resolves that to ::1 first, so the preview would
  // answer only on [::1]:4173 and this config would wait out its timeout on 127.0.0.1:4173.
  // Both servers' stdout is shown too, so a failed start in CI says what each server printed.
  webServer: [
    {
      // A fresh store every run: claims held by a previous run's sessions would refuse this run's writes.
      // The fixtures give each flow in test/flows.spec.ts its own project (claims are per project),
      // one users.json lead who may set project direction, and the member models a council convenes.
      command: `rm -rf ${STORE} && mkdir -p ${STORE} && cp test/fixtures/orgs.json test/fixtures/users.json test/fixtures/agents.json ${STORE}/ && node ../../packages/cli/dist/main.js serve --port ${API_PORT} --host 127.0.0.1 --dir ${STORE}`,
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      env: { HENOSIS_OFFLINE: "1" },
    },
    {
      command: `pnpm exec vite preview --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      // The preview proxies /ws and /api to the server this config started.
      env: { HENOSIS_WS: process.env.HENOSIS_WS ?? `ws://127.0.0.1:${API_PORT}` },
    },
  ],
});
