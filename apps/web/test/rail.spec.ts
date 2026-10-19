import { expect, type Page, test } from "@playwright/test";

/**
 * The rail is drawn once (design/henosis BACKLOG.md W5): the same roster on every route apart
 * from the active row; folded to 72 px below 1180 with the hover card beside it; a drawer on a
 * phone with the "who · where" line.
 */

async function signIn(page: Page, name: string, userId: string) {
  await page.goto("/");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("User id").fill(userId);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(`Signed in as ${name}`)).toBeVisible();
}

const rail = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });

/** The rail's markup with the active state and anything that polls (counts) taken out. */
async function shape(page: Page): Promise<string> {
  return rail(page).evaluate((nav) => {
    const clone = nav.cloneNode(true) as HTMLElement;
    for (const el of clone.querySelectorAll("[aria-current]")) el.removeAttribute("aria-current");
    for (const el of clone.querySelectorAll(".active")) el.classList.remove("active");
    for (const el of clone.querySelectorAll(".count")) el.remove();
    // the roster itself is live data (other specs open and close sessions meanwhile)
    for (const el of clone.querySelectorAll(
      ".agent, .crew, .crew-block, .solo-block, .rail-empty, .hint, .n, .chatrow:not(.new-group), .item.recent, .item.mem",
    ))
      el.remove();
    for (const el of clone.querySelectorAll("[style]")) el.removeAttribute("style");
    return clone.innerHTML;
  });
}

test("the rail is the same on every route apart from the active row", async ({ page }) => {
  await signIn(page, "Lee", "lee");
  await page.goto("/#/p/default");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Default project");
  await expect(rail(page)).toContainText("Agents");
  const base = await shape(page);
  const order = [
    "New session",
    "Inbox",
    "Approvals",
    "Agents",
    "Default project",
    "Overview",
    "Groups",
    "Memory",
    "Chats",
    "New group",
    "Lee",
  ];
  await expect(rail(page).getByPlaceholder("Search or jump to")).toBeVisible();
  // textContent, not innerText: the section kickers are set in capitals by CSS
  const text = (await rail(page).evaluate((nav) => nav.textContent)) ?? "";
  let at = -1;
  for (const word of order) {
    const next = text.indexOf(word, at + 1);
    expect(next, `${word} comes after the item before it`).toBeGreaterThan(at);
    at = next;
  }
  for (const route of [
    "/#/m/default",
    "/#/inbox",
    "/#/approvals",
    "/#/memory/default",
    "/#/settings",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await shape(page), `the rail on ${route}`).toBe(base);
  }
  // the active row is the only difference (the fixtures also have a project called Inbox)
  await page.goto("/#/inbox");
  await expect(rail(page).locator("a.item.inbox", { hasText: "Inbox" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(rail(page).locator("a.item.inbox", { hasText: "Approvals" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );
});

test.describe("folded", () => {
  test.use({ viewport: { width: 960, height: 760 } });
  test("below 1180 the rail folds to 72 px and the card opens on a rest", async ({ page }) => {
    await signIn(page, "Lee", "lee");
    const session = `rail-${Date.now()}`;
    await page.goto(`/#/p/default/s/${session}`);
    await expect(page.getByLabel("Directive", { exact: true })).toBeVisible();
    const nav = rail(page);
    await expect(nav).toHaveClass(/collapsed/);
    const box = await nav.boundingBox();
    expect(box?.width).toBe(72);
    const me = nav.locator(".sq.av", { hasText: "LE" });
    await expect(me).toHaveAttribute("aria-current", "page", { timeout: 15_000 });
    await me.hover();
    await expect(page.getByRole("tooltip")).toContainText(session);
    await page.mouse.move(600, 400);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    // `]` unfolds it, `[` folds it again
    await page.keyboard.press("]");
    await expect(nav).not.toHaveClass(/collapsed/);
    await expect(nav.getByRole("link", { name: "New group" })).toBeVisible();
    await page.keyboard.press("[");
    await expect(nav).toHaveClass(/collapsed/);
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("the drawer carries who · where and closes from its own button", async ({ page }) => {
    await signIn(page, "Lee", "lee");
    await page.goto("/#/p/default");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Default project");
    const nav = rail(page);
    await expect(nav).not.toBeInViewport();
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(nav).toBeInViewport();
    await expect(nav).not.toHaveClass(/collapsed/);
    await expect(nav.locator(".sys")).toContainText("Lee · Default team");
    await nav.getByRole("button", { name: "Close the rail" }).click();
    await expect(nav).not.toBeInViewport();
  });
});
