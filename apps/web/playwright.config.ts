import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
    // A preinstalled Chromium can be used instead of a download (e.g. cloud sandboxes).
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: [
    {
      command: "node ../../packages/cli/dist/main.js serve --port 7730 --dir ../../store-web-smoke",
      url: "http://127.0.0.1:7730/health",
      reuseExistingServer: false,
      env: { QUORUM_OFFLINE: "1" },
    },
    {
      command: "pnpm exec vite preview --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
    },
  ],
});
