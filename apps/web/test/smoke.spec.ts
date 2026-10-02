import { expect, type Page, test } from "@playwright/test";

/** Pick an identity on the home page, then open a session in project `default` by the session route. */
async function enter(page: Page, name: string, userId: string, session: string) {
  await page.goto("/");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("User id").fill(userId);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Session id").fill(session);
  await page.getByRole("button", { name: "Open session" }).click();
  await expect(page).toHaveURL(new RegExp(`#/p/default/s/${session}$`));
}

test("two people share one live agent session in the browser", async ({ browser }) => {
  const session = `smoke-${Date.now()}`;
  const ana = await browser.newPage();
  await enter(ana, "Ana", "ana", session);
  await expect(ana.locator("header.chrome")).toContainText("Ana (you) · owner · driving");

  const bo = await browser.newPage();
  await enter(bo, "Bo", "bo", session);
  await expect(bo.locator("header.chrome")).toContainText("Bo (you) · contributor");
  await expect(ana.locator("header.chrome")).toContainText("Bo · contributor");

  // Ana sets the goal; the agent starts and asks for approval to run tests.
  await ana.getByPlaceholder("Steer the agent").fill("Build a greeter");
  await ana.getByRole("button", { name: "Send", exact: true }).click();
  await expect(bo.locator(".stream")).toContainText("Build a greeter");
  await expect(bo.locator("aside")).toContainText("shell.run", { timeout: 30_000 });

  // Bo approves from the other browser; the agent finishes.
  await bo.getByRole("button", { name: "Approve", exact: true }).first().click();
  await expect(ana.locator(".stream")).toContainText("DONE", { timeout: 30_000 });
  await expect(ana.locator("aside")).toContainText("src/build_a_greeter.mjs");
  await expect(bo.locator("aside")).toContainText("src/build_a_greeter.mjs");

  // Handoff to Bo and read the brief.
  await ana.getByRole("button", { name: "Hand off", exact: true }).click();
  await bo.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(ana.locator("header.chrome")).toContainText("Bo · contributor · driving");
  await bo.getByRole("button", { name: "Ask for brief" }).first().click();
  await expect(bo.locator("pre.brief")).toContainText("Driver: Bo");
});

test("fleet board and management dashboard render from the same server", async ({ page }) => {
  const session = `smoke-f-${Date.now()}`;
  await enter(page, "Dee", "dee", session);
  await expect(page.locator("header.chrome")).toContainText("Dee (you) · owner");
  await page.goto("/#/p/default");
  await expect(page.locator(".sessions")).toContainText(session, { timeout: 15_000 });
  await expect(page.locator(".board")).toContainText("Claims map");
  await expect(page.locator(".board")).toContainText("Shared memory");
  await page.goto("/#/m/default");
  await expect(page.locator(".dash")).toContainText("Team management");
  await expect(page.locator(".tiles")).toContainText("Running");
  await expect(page.locator(".briefs")).toContainText("Default project", { timeout: 15_000 });
});

test.describe("phone layout", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("the session view collapses to one column with a tabbed drawer", async ({ page }) => {
    const session = `smoke-m-${Date.now()}`;
    await enter(page, "Ana", "ana", session);
    await expect(page.locator("header.chrome")).toContainText("Idle");
    await expect(page.locator("aside.inspector")).toHaveCount(0);
    await expect(page.locator(".drawer-tabs")).toBeVisible();
    await page.getByRole("button", { name: "Team", exact: true }).click();
    await expect(page.locator(".drawer-panel")).toContainText("Ana (you)");
    await page.getByRole("button", { name: "Brief", exact: true }).click();
    await expect(page.locator(".drawer-panel")).toContainText("Catch-up brief");
    await expect(page.getByPlaceholder("Steer the agent")).toBeVisible();
  });
});
