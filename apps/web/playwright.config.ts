import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  // Only the Playwright specs: the *.test.ts files beside them belong to vitest.
  testMatch: /.*\.spec\.ts$/,
  // test/live.spec.ts proves a hosted deployment and has its own config (playwright.live.config.ts).
  testIgnore: /live\.spec\.ts$/,
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
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
      command:
        "rm -rf ../../store-web-smoke && mkdir -p ../../store-web-smoke && cp test/fixtures/orgs.json test/fixtures/users.json test/fixtures/agents.json ../../store-web-smoke/ && node ../../packages/cli/dist/main.js serve --port 7730 --host 127.0.0.1 --dir ../../store-web-smoke",
      url: "http://127.0.0.1:7730/health",
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      env: { HENOSIS_OFFLINE: "1" },
    },
    {
      command: "pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
