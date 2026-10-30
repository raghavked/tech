/**
 * The live spec (docs/20_hosting.md, "Proving the deployment"): the deployment at
 * HENOSIS_LIVE_URL serves the web app, and the app reaches its backend through the same
 * origin. It runs only when the variable is set, under playwright.live.config.ts, which
 * starts no local servers (`pnpm --filter @henosis/web run smoke:live`); the ordinary smoke
 * config ignores it. scripts/live-check.mjs proves the same deployment without a browser.
 */
import { expect, test } from "@playwright/test";

const live = (process.env.HENOSIS_LIVE_URL ?? "").trim().replace(/\/+$/, "");
test.skip(!live, "HENOSIS_LIVE_URL is not set; the live spec proves a hosted deployment only");

test("the app at /app/ shows the sign-in card its backend's /api/auth asks for", async ({
  page,
}) => {
  const origin = new URL(live).origin;
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const url = msg.location().url;
    // A resource on another origin that would not load (the font CDN, say) is not the
    // deployment's doing; anything the deployment itself served or logged counts.
    if (url && !url.startsWith(origin) && msg.text().startsWith("Failed to load resource")) return;
    errors.push(url ? `${msg.text()} (${url})` : msg.text());
  });
  page.on("pageerror", (err) => errors.push(`uncaught: ${err.message}`));
  // The front end asks /api/auth on its own origin (apps/web/src/auth.ts), where the rewrite is.
  const asked = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/auth");
  await page.goto(`${live}/app/`);
  const answer = await asked;
  expect(answer.ok(), `/api/auth answered ${answer.status()}`).toBe(true);
  const { mode } = (await answer.json()) as { mode: string };
  if (mode === "supabase") {
    // views/SupabaseSignIn.tsx: the email field, then "Send a code".
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send a code" })).toBeVisible();
  } else if (mode === "dev") {
    // views/Home.tsx, the dev form a local pair shows: a name, a user id, "Continue".
    await expect(page.getByLabel("Your name")).toBeVisible();
    await expect(page.getByLabel("User id")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  } else {
    throw new Error(
      `/api/auth says mode ${mode}; expected supabase (hosted) or dev (a local pair)`,
    );
  }
  expect(errors, "console errors while the app loaded").toEqual([]);
});

test("the landing page at / says the hero sentence", async ({ page }) => {
  await page.goto(`${live}/`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("One team, people and agents.");
});
