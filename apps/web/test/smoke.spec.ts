import { expect, test } from "@playwright/test";

test("two people share one live agent session in the browser", async ({ browser }) => {
  const session = `smoke-${Date.now()}`;
  const ana = await browser.newPage();
  await ana.goto("/");
  await ana.getByPlaceholder("your name").fill("Ana");
  await ana.getByPlaceholder("session id").fill(session);
  await ana.getByRole("button", { name: "Join" }).click();
  await expect(ana.locator("header")).toContainText("Ana (you) · owner · driving");

  const bo = await browser.newPage();
  await bo.goto("/");
  await bo.getByPlaceholder("your name").fill("Bo");
  await bo.getByPlaceholder("session id").fill(session);
  await bo.getByRole("button", { name: "Join" }).click();
  await expect(bo.locator("header")).toContainText("Bo (you) · contributor");
  await expect(ana.locator("header")).toContainText("Bo · contributor");

  // Ana sets the goal; the agent starts and asks for approval to run tests.
  await ana.getByPlaceholder("steer the agent…").fill("Build a greeter");
  await ana.getByRole("button", { name: "Send" }).click();
  await expect(bo.locator(".log")).toContainText("Ana [steer/goal] Build a greeter");
  await expect(bo.locator("aside")).toContainText("shell.run", { timeout: 30_000 });

  // Bo approves from the other browser; the agent finishes.
  await bo.getByRole("button", { name: "approve" }).first().click();
  await expect(ana.locator(".log")).toContainText("DONE", { timeout: 30_000 });
  await expect(ana.locator("aside")).toContainText("src/build_a_greeter.mjs");
  await expect(bo.locator("aside")).toContainText("src/build_a_greeter.mjs");

  // Handoff to Bo and read the brief.
  await ana.getByRole("button", { name: "hand off" }).click();
  await bo.getByRole("button", { name: "accept" }).click();
  await expect(ana.locator("header")).toContainText("Bo · contributor · driving");
  await bo.getByRole("button", { name: "generate handoff brief" }).click();
  await expect(bo.locator("pre.brief")).toContainText("Driver: Bo");
});
