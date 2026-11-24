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

  // With no budget the breakdown's spend ring is the spend alone: an image named by its
  // tokens, no meter and no percent; it opens over the scrubber and the stream.
  await chip.click();
  const breakdown = page.getByRole("dialog", { name: "Token breakdown" });
  const ring = breakdown.getByRole("img", { name: /: [\d,]+ tokens, no budget set/ });
  await expect(ring).toBeVisible();
  await expect(ring).not.toContainText("%");
  await expect(breakdown.getByRole("meter")).toHaveCount(0);
  await expect(breakdown).toContainText("No budget set");
  await ring.hover({ trial: true });
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

test("the night is one room: the sky's ramp, a lit hand, and one seal on the decision that landed", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("henosis.theme", "dark"));
  const session = `e2e-night-${token()}`;
  await enter(page, "Ana", "ana", "e2e-leftovers", session);
  const box = page.getByLabel("Directive", { exact: true });
  await box.fill(`Build a counter ${token()}`);
  await box.press("Enter");
  const approve = page.getByRole("button", { name: /^Approve( with \d)?$/ });
  await expect(approve).toBeVisible({ timeout: 15_000 });

  const night = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const main = document.querySelector(".shell > .main") as HTMLElement;
    const hand = [...document.querySelectorAll(".notice .btn.primary")].pop() as HTMLElement;
    const value = (name: string) => root.getPropertyValue(name).trim().toUpperCase();
    return {
      canvas: value("--canvas"),
      surface: value("--surface"),
      ground: value("--out-bg"),
      page: getComputedStyle(document.body).backgroundColor,
      lamp: getComputedStyle(main).backgroundImage,
      grain: getComputedStyle(main, "::before").mixBlendMode,
      hand: getComputedStyle(hand).backgroundColor,
      edge: getComputedStyle(hand).boxShadow,
      shadow: root.getPropertyValue("--shadow-pop"),
    };
  });
  // Dress Blues is the sky, chocolate-black the ground; the lamp and the dusk are on the page
  expect(night.canvas).toBe("#121826");
  expect(night.surface).toBe("#1A2131");
  expect(night.ground).toBe("#140F0E");
  expect(night.page).toBe("rgb(18, 24, 38)");
  expect(night.lamp).toContain("radial-gradient");
  expect(night.lamp).toContain("linear-gradient");
  expect(night.grain).toBe("screen");
  // the hand is the lifted fill, lit on its top edge; a shadow is the ground, never black
  expect(night.hand).toBe("rgb(122, 75, 62)");
  expect(night.edge).toContain("inset");
  expect(night.shadow).toContain("20, 15, 14");

  // the decision lands: its line takes the seal, and the page carries one seal
  await approve.click();
  await expect(page.getByRole("img", { name: /^Approved, / })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".seal")).toHaveCount(1);
});
