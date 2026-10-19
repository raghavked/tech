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

const conversation = (page: Page) => page.getByLabel("Conversation");
/** One drawer, two faces: the aside is named after the face that is up. */
const details = (page: Page) => page.getByRole("complementary", { name: "Details" });
const team = (page: Page) => page.getByRole("complementary", { name: "Team" });
/** The person's own row in the Team face: "Ana", "you", "owner · driving". */
const myRow = (page: Page) => team(page).locator(".person", { hasText: "you" });

test("two people share one live agent session in the browser", async ({ browser }) => {
  test.setTimeout(120_000);
  const session = `smoke-${Date.now()}`;
  const ana = await browser.newPage();
  await enter(ana, "Ana", "ana", session);
  await ana.getByRole("button", { name: "Team", exact: true }).click();
  await expect(myRow(ana)).toContainText("Ana");
  await expect(myRow(ana)).toContainText("driving");

  const bo = await browser.newPage();
  await enter(bo, "Bo", "bo", session);
  await bo.getByRole("button", { name: "Team", exact: true }).click();
  await expect(myRow(bo)).toContainText("Bo");
  await expect(myRow(bo)).toContainText("contributor");
  await expect(team(ana)).toContainText("Bo");
  await expect(conversation(ana)).toContainText("Bo joins the circle");

  // Ana sets the goal. Sessions from the home page plan first: the agent proposes, Ana rates
  // the plan, then the agent starts and asks for approval to run tests.
  await ana.getByPlaceholder("Steer the agent").fill("Build a greeter");
  await ana.getByPlaceholder("Steer the agent").press("Enter");
  await expect(conversation(bo)).toContainText("Build a greeter");
  const plan = ana.getByRole("region", { name: "Plan" });
  await expect(plan).toContainText("Waiting for ratings", { timeout: 30_000 });
  await plan.getByRole("radio", { name: "5 of 5, Ship it" }).click();
  await expect(bo.getByRole("region", { name: "Plan" })).toContainText("approved");
  await expect(conversation(bo)).toContainText("The agent wants to run", { timeout: 30_000 });
  await expect(conversation(bo)).toContainText("Wrote src/build_a_greeter.mjs");

  // Bo approves from the other browser; the agent finishes.
  await bo.getByRole("button", { name: "Approve", exact: true }).first().click();
  await expect(conversation(ana)).toContainText("Approved: run", { timeout: 30_000 });
  await expect(conversation(ana)).toContainText("Done:", { timeout: 30_000 });
  await expect(conversation(ana)).toContainText("exit 0");

  // Handoff to Bo (from the Team face) and read the brief (Catch-up, folded in Details).
  await ana.getByRole("button", { name: "Hand off", exact: true }).click();
  await expect(conversation(bo)).toContainText("Ana offers the baton to you");
  await bo.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(team(ana).locator(".person", { hasText: "Bo" })).toContainText("driving");
  await expect(conversation(ana)).toContainText("Bo has the baton");
  await expect(myRow(bo)).toContainText("driving");
  await team(bo).getByRole("button", { name: "Details", exact: true }).click();
  await details(bo)
    .getByRole("button", { name: /Catch-up/ })
    .click();
  await details(bo).getByRole("button", { name: "Ask for brief" }).click();
  await expect(details(bo).locator("pre.brief")).toContainText("Driver: Bo");

  // The session is now in the sidebar as an agent card: a team of two, with Bo.
  const rail = ana.getByRole("navigation", { name: "Sidebar" });
  await expect(rail).toContainText(session);
  await expect(rail.locator(".agent", { hasText: session })).toContainText("Team");
  await expect(rail.locator(".agent", { hasText: session })).toContainText("with Bo");

  // Team chat: Ana talks to the people in the session, not to the agent.
  await ana.getByLabel("Send to").getByText("Team").click();
  await ana.getByPlaceholder("Say something to the people in this session").fill("Bo, take tests?");
  await ana.getByPlaceholder("Say something to the people in this session").press("Enter");
  await expect(conversation(bo)).toContainText("to the team");
  await expect(conversation(bo)).toContainText("Bo, take tests?");

  // Crew: Ana puts the session in a crew from the Team face; the rail groups it under the crew.
  await expect(team(ana)).toContainText("Bo, take tests?");
  await team(ana).getByLabel("Crew name").fill("Greeter rollout");
  await team(ana).getByRole("button", { name: "Team up" }).click();
  await expect(team(ana)).toContainText("Working on Greeter rollout");
  await expect(rail).toContainText("Greeter rollout");
});

test("project and team pages render from the same server", async ({ page }) => {
  const session = `smoke-f-${Date.now()}`;
  await enter(page, "Dee", "dee", session);
  await expect(page.getByRole("navigation", { name: "Sidebar" })).toContainText(session);
  await page.goto("/#/p/default");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Default project");
  await expect(page.locator(".rowitem")).toContainText([session], { timeout: 15_000 });
  await expect(page.getByPlaceholder("Set direction for everyone in this project")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Team memory" })).toBeVisible();
  await page.goto("/#/m/default");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Default team");
  await expect(page.getByRole("heading", { name: "Needs you" })).toBeVisible();
  await expect(page.locator(".rowitem")).toContainText(["Default project"], { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Memory housekeeping" })).toBeVisible();
});

test.describe("phone layout", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("the sidebar is a drawer and details a bottom sheet", async ({ page }) => {
    const session = `smoke-m-${Date.now()}`;
    await enter(page, "Ana", "ana", session);
    const sidebar = page.getByRole("navigation", { name: "Sidebar" });
    await expect(sidebar).not.toBeInViewport();
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(sidebar).toBeInViewport();
    // The scrim fills the viewport and the open drawer covers its centre: tap the strip beside it.
    await page.getByRole("button", { name: "Close menu" }).click({ position: { x: 370, y: 400 } });
    await expect(sidebar).not.toBeInViewport();
    await expect(details(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Details" }).click();
    await expect(details(page)).toContainText("Intent");
    await expect(details(page)).toContainText("Catch-up");
    // The same sheet, the other face.
    await details(page).getByRole("button", { name: "Team", exact: true }).click();
    await expect(myRow(page)).toContainText("Ana");
    await team(page).getByRole("button", { name: "Close team" }).click();
    await expect(team(page)).toHaveCount(0);
    await expect(page.getByPlaceholder("Steer the agent")).toBeVisible();
  });
});
