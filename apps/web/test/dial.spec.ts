import { expect, type Page, test } from "@playwright/test";

/**
 * The rating as a dial (sig-approval-dial; src/stream/RatingDial.tsx): a release gate is rated on
 * one radiogroup whose five stops keep their names ("4 of 5, Good"). Arrows move along the stops
 * without picking, Home and End jump, Space and Enter pick, 1–5 pick at once and 0 clears; a
 * click on a word picks the nearest stop and a drag turns the hand. The face reads the gate's
 * bar and the ratings in so far, and the reading beside it says what the pick does. One page and
 * its own project (test/fixtures/orgs.json), so no other flow's claims are in its way.
 */
test.describe.configure({ timeout: 45_000 });

const token = () => Date.now().toString(36).slice(-4);

async function enter(page: Page, name: string, userId: string, project: string, session: string) {
  await page.goto("/");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("User id").fill(userId);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(`Signed in as ${name}`)).toBeVisible();
  await page.goto(`/#/p/${project}/s/${session}`);
  await expect(page).toHaveURL(new RegExp(`#/p/${project}/s/${session}$`));
  await expect(page.getByLabel("Directive", { exact: true })).toBeVisible();
}

test("a release gate is rated on a dial: keys, a click on a word, a turn of the hand", async ({
  page,
}) => {
  const t = token();
  const session = `e2e-dial-${t}`;
  await enter(page, "Dana", `dana-${t}`, "e2e-dial", session);
  const box = page.getByLabel("Directive", { exact: true });
  await box.fill(`Build a doubler ${t} and deploy it`);
  await box.press("Enter");
  const conversation = page.getByLabel("Conversation");
  await expect(conversation).toContainText("The agent wants to run", { timeout: 15_000 });
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(conversation).toContainText("deploy to production", { timeout: 15_000 });

  // One radiogroup, five radios with their names; the face says what the gate needs and has.
  const gate = page.getByRole("region", { name: "Approval" }).last();
  const dial = gate.getByRole("radiogroup", { name: "Your rating" });
  const stop = (name: string) => dial.getByRole("radio", { name, exact: true });
  const approve = (n: number) => gate.getByRole("button", { name: `Approve with ${n}` });
  await expect(dial.getByRole("radio")).toHaveCount(5);
  await expect(dial).toHaveAccessibleDescription(
    "No rating is in yet. The gate needs 2 at 4 or above.",
  );
  // Nothing is picked: the hand rests at the 4 a plain Approve sends, and Tab lands there.
  await expect(dial.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(approve(4)).toBeVisible();
  await expect(gate).toContainText("4 if you leave it");
  await expect(stop("4 of 5, Good")).toHaveAttribute("tabindex", "0");
  await expect(stop("5 of 5, Ship it")).toHaveAttribute("tabindex", "-1");

  // Arrows move without picking; Space picks; Home and End jump; Enter picks.
  await stop("4 of 5, Good").focus();
  await page.keyboard.press("ArrowRight");
  await expect(stop("5 of 5, Ship it")).toBeFocused();
  await expect(stop("5 of 5, Ship it")).not.toBeChecked();
  await expect(gate).toContainText("5 of 5 · preview");
  await expect(approve(4)).toBeVisible();
  await page.keyboard.press("Space");
  await expect(stop("5 of 5, Ship it")).toBeChecked();
  await expect(approve(5)).toBeVisible();
  await page.keyboard.press("Home");
  await expect(stop("1 of 5, Not yet")).toBeFocused();
  await expect(approve(5)).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(stop("1 of 5, Not yet")).toBeChecked();
  await expect(approve(1)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/s/${session}$`));
  await page.keyboard.press("End");
  await expect(stop("5 of 5, Ship it")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  await expect(stop("3 of 5, Fine")).toBeFocused();
  await expect(approve(1)).toBeVisible();
  // 1–5 pick at once and the focus follows; 0 clears back to the rest.
  await page.keyboard.press("2");
  await expect(stop("2 of 5, Risky")).toBeChecked();
  await expect(stop("2 of 5, Risky")).toBeFocused();
  await expect(approve(2)).toBeVisible();
  await page.keyboard.press("0");
  await expect(dial.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(approve(4)).toBeVisible();

  // The reading beside the face is the tally's arithmetic for the pick.
  await stop("5 of 5, Ship it").click();
  await expect(gate).toContainText(
    "With your 5 the average is 5; one more rating is still needed.",
  );
  await expect(gate).toContainText("5 of 5 · Ship it");

  // A click on a word picks its stop; a drag round the rim turns the hand and picks where it lands.
  await stop("3 of 5, Fine").scrollIntoViewIfNeeded();
  const face = await dial.locator(".face").boundingBox();
  if (!face) throw new Error("the dial has no face");
  const at = (deg: number, r: number): [number, number] => {
    const a = ((deg - 90) * Math.PI) / 180;
    const k = face.width / 360;
    return [face.x + (180 + r * Math.cos(a)) * k, face.y + (136 + r * Math.sin(a)) * k];
  };
  const [wx, wy] = at(-60, 140);
  await page.mouse.click(wx - 12, wy);
  await expect(stop("2 of 5, Risky")).toBeChecked();
  await expect(approve(2)).toBeVisible();
  await page.mouse.move(...at(-60, 100));
  await page.mouse.down();
  for (let deg = -54; deg <= 62; deg += 4) await page.mouse.move(...at(deg, 100));
  await page.mouse.up();
  await expect(stop("4 of 5, Good")).toBeChecked();
  await expect(approve(4)).toBeVisible();
  await expect(gate).toContainText("4 of 5 · Good");

  // The quiet clear lets the pick go; then her rating is sent and the dial locks at it.
  await gate.getByRole("button", { name: "Clear your rating" }).click();
  await expect(dial.getByRole("radio", { checked: true })).toHaveCount(0);
  await stop("5 of 5, Ship it").click();
  await approve(5).click();
  await expect(conversation).toContainText("Dana approved · 5 of 5");
  await expect(conversation).toContainText("1 of 2 raters · 5 average");
  await expect(stop("5 of 5, Ship it")).toBeChecked();
  await expect(stop("5 of 5, Ship it")).toHaveAttribute("aria-disabled", "true");
  await expect(dial).toHaveAccessibleDescription(
    "1 of 2 ratings are in at 5 on average. The bar is 4.",
  );
});
