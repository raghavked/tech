import { defineConfig } from "@playwright/test";

/**
 * The live project (docs/20_hosting.md, "Proving the deployment"): test/live.spec.ts against
 * the deployment HENOSIS_LIVE_URL names, with no local servers started. Run with
 * `pnpm --filter @henosis/web run smoke:live`; the ordinary config (playwright.config.ts)
 * ignores that spec, and the spec skips itself when the variable is not set.
 */
export default defineConfig({
  testDir: "./test",
  testMatch: /live\.spec\.ts$/,
  timeout: 90_000,
  // A cold function and the supabase-js chunk can take a moment before the card shows.
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: "list",
  use: {
    // A preinstalled Chromium can be used instead of a download (e.g. cloud sandboxes).
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
