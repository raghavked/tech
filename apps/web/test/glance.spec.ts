import { expect, type Page, test } from "@playwright/test";

/**
 * The glance (widgets): the menu-bar panel at #/glance counts what needs you from
 * GET /api/glance, approves from the row with the same vote the session takes (a plain approve
 * under a release gate sends the default 4), and pauses notifications with the moon in its head.
 * The flow runs in its own project (test/fixtures/orgs.json) with identities of its own, so
 * what other flows leave waiting never counts here.
 */
test.describe.configure({ timeout: 45_000 });

const token = () => Date.now().toString(36).slice(-4);

async function signIn(page: Page, name: string, userId: string) {
  await page.goto("/");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("User id").fill(userId);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(`Signed in as ${name}`)).toBeVisible();
}

async function enter(page: Page, name: string, userId: string, project: string, session: string) {
  await signIn(page, name, userId);
  await page.goto(`/#/p/${project}/s/${session}`);
  await expect(page).toHaveURL(new RegExp(`#/p/${project}/s/${session}$`));
  await expect(page.getByLabel("Directive", { exact: true })).toBeVisible();
}

const conversation = (page: Page) => page.getByLabel("Conversation");

async function steer(page: Page, text: string) {
  const box = page.getByLabel("Directive", { exact: true });
  await box.fill(text);
  await box.press("Enter");
  await expect(conversation(page)).toContainText(text);
}

test("the menu-bar panel counts what needs you, approves from the row, and pauses notifications", async ({
  browser,
}) => {
  const t = token();
  const session = `e2e-glance-${t}`;
  const ana = await browser.newPage();
  await enter(ana, "Gil", `ana-${t}`, "e2e-glance", session);
  const bo = await browser.newPage();
  await enter(bo, "Hal", `bo-${t}`, "e2e-glance", session);
  await expect(conversation(ana)).toContainText("Hal joins the circle");

  // The test run parks the agent at an exec approval any contributor may grant.
  await steer(ana, `Build a doubler ${t} and deploy it`);
  await expect(conversation(bo)).toContainText("The agent wants to run", { timeout: 15_000 });

  // The panel: the one needs-you number in the head, the row in the toast's grammar.
  await bo.goto("/#/glance");
  const panel = bo.getByRole("main", { name: "Henosis at a glance" });
  const needs = panel.getByRole("region", { name: "Needs you" });
  await expect(needs.getByRole("img", { name: "1 needs you" })).toBeVisible();
  const row = needs.getByRole("article").first();
  await expect(row).toContainText("Gil's agent");
  await expect(row).toContainText(session);
  await expect(row).toContainText("wants to");
  await expect(row.locator("code")).toContainText("run");
  // The same figure the server gives every widget and push payload.
  const glance = (await (await bo.request.get(`/api/glance?user=bo-${t}`)).json()) as {
    needsYou: number;
  };
  expect(glance.needsYou).toBe(1);

  // Approve from the row: a plain approve on an exec gate, no rating; the row says what it did.
  await row.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(needs.getByRole("status")).toContainText("Your approve granted it");
  await expect(conversation(ana)).toContainText("Approved: run", { timeout: 15_000 });

  // The deploy is a release gate: Gate with its quorum, and Approve sends the default 4.
  const gateRow = needs.getByRole("article").filter({ hasText: "deploy" });
  await expect(gateRow).toContainText("Gate", { timeout: 20_000 });
  await expect(gateRow).toContainText("0 of 2");
  await gateRow.getByRole("button", { name: "Approve · 4" }).click();
  await expect(needs.getByRole("status")).toContainText("Your 4 is in · 1 of 2");
  await expect(conversation(ana)).toContainText("Hal approved · 4 of 5");
  await expect(needs.getByRole("img", { name: "Nothing needs you" })).toBeVisible();

  // The other two questions a glance settles: who is running, what today has cost.
  await expect(panel.getByRole("region", { name: "Agents" })).toContainText(/\d+ open/);
  const tokens = panel.getByRole("region", { name: "Tokens today" });
  await expect(tokens).toContainText("no budget set");
  await expect(tokens.locator(".gl-figure")).toHaveText(/^\d+(\.\d+)?[kM]?$/);

  // Pause notifications: the moon takes the count's place until you resume.
  await panel.getByRole("button", { name: "Pause notifications" }).click();
  await panel.getByRole("button", { name: "An hour" }).click();
  await expect(needs.getByRole("img", { name: /^Notifications paused until/ })).toBeVisible();
  await panel.getByRole("button", { name: "Resume notifications" }).click();
  await expect(needs.getByRole("img", { name: "Nothing needs you" })).toBeVisible();
});
