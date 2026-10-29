import { expect, type Page, test } from "@playwright/test";

/**
 * The leftovers settled in design/henosis BACKLOG.md L7, on the session page:
 * looking back with the scrubber folds the stream and the composer, and nothing else — the
 * token chip keeps the live total and the Team panel the live circle (N3 ships them unfolded,
 * and that stays the rule); and in dark the hand as text is chocolate 300 (`--accent-ink`
 * #CAA49B, SYSTEM.md §20), never the apricot of the pulses beside it.
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
const tokenChip = (page: Page) => page.getByLabel(/^Tokens: /);

/** Steer; the agent holds its shell at a gate, Ana grants it, and a second directive brings turn 2. */
async function twoTurns(page: Page, text: string) {
  const box = page.getByLabel("Directive", { exact: true });
  await box.fill(text);
  await box.press("Enter");
  await expect(conversation(page)).toContainText(text);
  const gate = page.getByRole("region", { name: "Approval" }).last();
  await expect(gate).toBeVisible({ timeout: 15_000 });
  await gate.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(conversation(page)).toContainText("Done:", { timeout: 15_000 });
  await box.fill(`${text} again`);
  await box.press("Enter");
  // The second turn holds at its own gate: a steady state, so the token chip's figure stays put.
  await expect(page.getByText(/Awaiting approval · turn 2/).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("slider", { name: "Turn" })).toHaveAttribute(
    "aria-valuemax",
    /^[2-9]/,
  );
}

test("looking back folds the stream, not the token chip or the Team panel", async ({ page }) => {
  const session = `e2e-left-${token()}`;
  await enter(page, "Ana", "ana", "e2e-leftovers", session);
  await twoTurns(page, `Build a greeter ${token()}`);

  const chip = tokenChip(page);
  await expect(chip).toBeVisible();
  const liveLabel = await chip.getAttribute("aria-label");
  expect(liveLabel).toMatch(/^Tokens: [\d,.]+k? used/);

  // One turn back: the composer is read-only and says so.
  const slider = page.getByRole("slider", { name: "Turn" });
  await slider.focus();
  await slider.press("ArrowLeft");
  await expect(page.getByPlaceholder("Nothing is sent while you look back")).toBeVisible();
  await expect(page.getByRole("button", { name: "Return to now" }).first()).toBeVisible();

  // The token chip still carries the live total: spend is a fact about now, not about the turn viewed.
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("aria-label", liveLabel ?? "");

  // The Team panel opens on the live circle while looking back.
  await page.getByRole("button", { name: "Team", exact: true }).click();
  const team = page.getByRole("complementary", { name: "Team" });
  await expect(team).toBeVisible();
  await expect(team).toContainText("Ana");
  await expect(page.getByPlaceholder("Nothing is sent while you look back")).toBeVisible();

  // Return to now: the composer is live again and the chip reads the same.
  await page.getByRole("button", { name: "Return to now" }).first().click();
  await expect(page.getByPlaceholder("Nothing is sent while you look back")).toHaveCount(0);
  await expect(page.getByLabel("Directive", { exact: true })).toBeEditable();
  await expect(chip).toHaveAttribute("aria-label", liveLabel ?? "");
});

test("in dark the hand as text is chocolate 300, not the apricot pulse", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("henosis.theme", "dark"));
  const session = `e2e-dark-${token()}`;
  await enter(page, "Ana", "ana", "e2e-leftovers", session);
  const box = page.getByLabel("Directive", { exact: true });
  await box.fill("Build a greeter for the checkout page");
  await box.press("Enter");
  const goal = page.locator(".msg .goal").first();
  await expect(goal).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const read = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const el = document.querySelector(".msg .goal") as HTMLElement;
    const pill = document.querySelector(".pill.planning") as HTMLElement | null;
    return {
      goal: getComputedStyle(el).color,
      accentInk: root.getPropertyValue("--accent-ink").trim().toUpperCase(),
      apricot: root.getPropertyValue("--apricot").trim().toUpperCase(),
      pulse: pill ? getComputedStyle(pill, "::before").backgroundColor : null,
    };
  });
  // #CAA49B as the browser paints it; the token is the same word; the pulse beside it is apricot.
  expect(read.goal).toBe("rgb(202, 164, 155)");
  expect(read.accentInk).toBe("#CAA49B");
  expect(read.apricot).toBe("#E2C4A6");
  if (read.pulse) expect(read.pulse).toBe("rgb(226, 196, 166)");
});
