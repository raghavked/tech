import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  // Only the Playwright specs: the *.test.ts files beside them belong to vitest.
  testMatch: /.*\.spec\.ts$/,
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
    // A preinstalled Chromium can be used instead of a download (e.g. cloud sandboxes).
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: [
    {
      // A fresh store every run: claims held by a previous run's sessions would refuse this run's writes.
      // The fixtures give each flow in test/flows.spec.ts its own project (claims are per project)
      // and one users.json lead who may set project direction.
      command:
        "rm -rf ../../store-web-smoke && mkdir -p ../../store-web-smoke && cp test/fixtures/orgs.json test/fixtures/users.json ../../store-web-smoke/ && node ../../packages/cli/dist/main.js serve --port 7730 --dir ../../store-web-smoke",
      url: "http://127.0.0.1:7730/health",
      reuseExistingServer: false,
      env: { FOLD_OFFLINE: "1" },
    },
    {
      command: "pnpm exec vite preview --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
    },
  ],
});
