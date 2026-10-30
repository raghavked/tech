import { expect, type Page, test } from "@playwright/test";

/**
 * The phone (design/henosis BACKLOG.md L3): one frame, one sheet, one needs-you number. The
 * four-tab bar is the frame and Sessions opens the rail drawer; the Approvals tab carries the
 * glance's needs-you count, the same figure the manager's sentence shows; the queue is a stack
 * of cards with the filters at the thumb; a release gate rates with the star tiles in the stream
 * and opens the one bottom sheet from the queue. Every test runs at 390 × 844 with touch.
 */
test.describe.configure({ timeout: 45_000 });
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

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

async function steer(page: Page, text: string) {
  const box = page.getByLabel("Directive", { exact: true });
  await box.fill(text);
  await box.press("Enter");
  await expect(page.getByLabel("Conversation")).toContainText(text);
}

const tabs = (page: Page) => page.getByRole("navigation", { name: "Sections" });
const approve = (page: Page) => page.getByRole("button", { name: /^Approve( with \d)?$/ });

test("the tab bar is the frame and the Approvals tab carries the one needs-you number", async ({
  page,
}) => {
  const session = `m-tabs-${token()}`;
  await enter(page, "Pia", `pia-${session}`, "e2e-phone", session);
  const bar = tabs(page);
  await expect(bar).toBeVisible();
  await expect(bar.getByRole("button", { name: "Sessions" })).toBeVisible();
  await expect(bar.getByRole("link", { name: /^Chats/ })).toBeVisible();
  await expect(bar.getByRole("link", { name: /^Approvals/ })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Me" })).toBeVisible();
  // the menu button carries no badge; the mark sits in the top block
  await expect(page.getByRole("button", { name: "Menu" }).locator(".count")).toHaveCount(0);
  await expect(page.locator(".topbar .topmark")).toBeVisible();
  // the subtitle's status word
  await expect(page.locator(".topbar .subtitle")).toContainText("drives");

  // Sessions opens the rail drawer
  const rail = page.getByRole("navigation", { name: "Sidebar" });
  await expect(rail).not.toBeInViewport();
  await bar.getByRole("button", { name: "Sessions" }).click();
  await expect(rail).toBeInViewport();
  await rail.getByRole("button", { name: "Close the rail" }).click();
  await expect(rail).not.toBeInViewport();

  // the count the tab shows now: other specs may have gates open meanwhile, so what follows is relative
  const count = bar.getByRole("link", { name: /^Approvals/ }).locator(".count");
  const readCount = async () => ((await count.count()) ? Number(await count.textContent()) : 0);

  // the agent asks for an approval: the glance counts it on the tab and on the manager's sentence
  await steer(page, `Build a counter ${token()}`);
  await expect(approve(page)).toBeVisible({ timeout: 15_000 });
  await expect.poll(readCount, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
  await page.goto("/#/m/default");
  // other specs raise gates of their own meanwhile: the figure is whatever the tab shows
  await expect(page.locator(".sentence-bar .sentence")).toContainText(/\d+ things? needs? you/, {
    timeout: 15_000,
  });

  // the queue on the phone: a card with a 44 px Approve and the filters at the thumb
  await tabs(page)
    .getByRole("link", { name: /^Approvals/ })
    .click();
  await expect(page).toHaveURL(/#\/approvals$/);
  await expect(page.locator(".topbar .subtitle")).toContainText(/\d+ needs? you/, {
    timeout: 15_000,
  });
  // the tab and the page carry the one figure, read from the same glance
  const figure = async () =>
    Number(
      ((await page.locator(".topbar .subtitle").textContent()) ?? "").match(
        /(\d+) needs? you/,
      )?.[1] ?? -1,
    );
  await expect
    .poll(async () => (await figure()) === (await readCount()), { timeout: 15_000 })
    .toBe(true);
  const card = page.locator(".grow", { hasText: session });
  await expect(card).toContainText("wants to run");
  const thumb = page.locator(".thumb");
  await expect(thumb.getByRole("button", { name: /^Needs you/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Her own ask reached the corner as a decision toast, which never times out (MOTION.md 6) and
  // sits full width just above the thumb: when the queue is long enough for her card to be its
  // last, the card's buttons are under the toast until she dismisses it, as flows.spec does.
  await expect
    .poll(
      async () => {
        const x = page.getByRole("alert").getByRole("button", { name: "Dismiss" }).first();
        if (await x.isVisible().catch(() => false)) await x.click().catch(() => {});
        return await page.getByRole("alert").count();
      },
      { timeout: 15_000, intervals: [250] },
    )
    .toBe(0);
  const box = await card.getByRole("button", { name: "Approve", exact: true }).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await card.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator(`.drow[data-key*="/${session}/"]`)).toContainText("Approved", {
    timeout: 15_000,
  });
});

test("a release gate rates with the star tiles and opens the one sheet from the queue", async ({
  page,
}) => {
  const session = `m-gate-${token()}`;
  await enter(page, "Pia", `pia-${session}`, "e2e-phone-gate", session);
  await steer(page, `Build a doubler ${token()} and deploy it`);
  await expect(page.getByLabel("Conversation")).toContainText("The agent wants to run", {
    timeout: 15_000,
  });
  await approve(page).click();
  await expect(page.getByLabel("Conversation")).toContainText("Approved: run", {
    timeout: 15_000,
  });

  // the gate in the stream: five tiles, the pick says what it does, the button carries the number
  await expect(page.getByLabel("Conversation")).toContainText("deploy to production", {
    timeout: 15_000,
  });
  const tiles = page.locator(".star-tiles");
  await expect(tiles).toBeVisible();
  await expect(page.locator(".tile-word")).toContainText("4 if you leave it");
  await tiles.getByRole("radio", { name: "5 of 5, Ship it" }).click();
  await expect(page.locator(".tile-word")).toContainText("Ship it · 5 of 5");
  await expect(page.getByRole("button", { name: "Approve with 5" })).toBeVisible();
  // a second tap on the pick clears it
  await tiles.getByRole("radio", { name: "5 of 5, Ship it" }).click();
  await expect(page.locator(".tile-word")).toContainText("4 if you leave it");

  // the queue: the gate card opens the sheet over the dimmed list with the card ringed
  await tabs(page)
    .getByRole("link", { name: /^Approvals/ })
    .click();
  const card = page.locator(".grow.gate", { hasText: session });
  await expect(card).toContainText("deploy", { timeout: 15_000 });
  await expect(card).toContainText("Release gate");
  await card.getByRole("button", { name: "Open the gate" }).click();
  const sheet = page.getByRole("dialog", { name: "Release gate" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("The release gate.");
  await expect(sheet).toContainText("held");
  await expect(sheet.getByRole("button", { name: "Approve with 4" })).toBeVisible();
  await expect(card).toHaveClass(/open/);
  const radius = await sheet.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  expect(radius).toBe("26px");
  // the rule in plain words, once; the tally says what one rating does with nobody else here
  await expect(sheet).toContainText("irreversible needs 2 at 4+");
  await expect(sheet).not.toContainText("needs needs");
  await expect(sheet).toContainText("0 of 2 raters · no rating yet · waits for one more");
  await sheet.getByRole("radio", { name: "5 of 5, Ship it" }).click();
  await expect(sheet.getByRole("button", { name: "Approve with 5" })).toBeVisible();
  await sheet.getByRole("button", { name: "Later" }).first().click();
  await expect(sheet).toHaveCount(0);
});
