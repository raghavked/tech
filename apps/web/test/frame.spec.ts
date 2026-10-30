import { expect, type Page, test } from "@playwright/test";

/**
 * The frame and the desktop shell (design/henosis BACKLOG.md L1): the breakpoints written once
 * with 40 px of hysteresis and `[` `]` pinning the rail; the compact topbar dropping words, not
 * facts; the drawer overlaying at 720 behind a scrim; and, with a bridge in place of the Tauri
 * shell, the Windows titlebar, the macOS brand row, the drag region, the platform's composer
 * hint and the first run's fourth step, the tray taught by dropping it open.
 */
test.describe.configure({ timeout: 45_000 });

async function signIn(page: Page, name: string, userId: string) {
  await page.goto("/");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("User id").fill(userId);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(`Signed in as ${name}`)).toBeVisible();
}

const rail = (page: Page) => page.getByRole("navigation", { name: "Sidebar" });
const shell = (page: Page) => page.locator(".shell").first();

/** A bridge standing in for apps/desktop/src/bridge.js: the platform it names, and hooks to feed it. */
function fakeShell(platform: "macos" | "windows" | "linux"): string {
  return `
    const ok = () => Promise.resolve();
    const hook = (name) => (cb) => { window[name] = cb; return Promise.resolve(() => {}); };
    window.__HENOSIS_DESKTOP__ = {
      info: () => Promise.resolve({ version: "0.0.0-test", platform: ${JSON.stringify(platform)}, serverUrl: "", launchRoute: null, pollSeconds: 15 }),
      notify: ok, setIdentity: ok, setRoute: ok, setPending: ok, refreshInbox: ok, openExternal: ok,
      setRecents: (items) => { window.__recents = items; return ok(); },
      minimize: ok, toggleMaximize: ok,
      closeToTray: () => { window.__closed = true; return ok(); },
      onDeepLink: hook("__deepLink"), onTray: hook("__tray"), onInbox: hook("__inbox"), onAction: hook("__action"),
    };
  `;
}

test("the rail folds at 1180 with 40 px of hysteresis, and [ ] pin the choice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "Fay", "fay");
  await expect(shell(page)).toHaveAttribute("data-frame", "full");
  await expect(rail(page)).not.toHaveClass(/collapsed/);
  // narrowing: folds the moment the edge is crossed
  await page.setViewportSize({ width: 1170, height: 900 });
  await expect(shell(page)).toHaveAttribute("data-frame", "folded");
  await expect(rail(page)).toHaveClass(/collapsed/);
  // widening: stays folded until 40 px past the edge, so a resize never flaps it
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(shell(page)).toHaveAttribute("data-frame", "folded");
  await expect(rail(page)).toHaveClass(/collapsed/);
  await page.setViewportSize({ width: 1230, height: 900 });
  await expect(shell(page)).toHaveAttribute("data-frame", "full");
  await expect(rail(page)).not.toHaveClass(/collapsed/);
  // [ folds and the choice holds through a resize; ] unfolds
  await page.locator("body").click({ position: { x: 700, y: 400 } });
  await page.keyboard.press("[");
  await expect(rail(page)).toHaveClass(/collapsed/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(rail(page)).toHaveClass(/collapsed/);
  await page.keyboard.press("]");
  await expect(rail(page)).not.toHaveClass(/collapsed/);
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect(rail(page)).not.toHaveClass(/collapsed/);
});

test("at 960 the topbar drops words, not facts; at 720 the drawer overlays behind a scrim", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "Fay", "fay");
  await page.goto(`/#/p/default/s/frame-${Date.now().toString(36)}`);
  await expect(page.getByLabel("Directive", { exact: true })).toBeVisible();
  const details = page.getByRole("button", { name: "Details" });
  await expect(details.locator(".lbl")).toBeVisible();
  await page.setViewportSize({ width: 900, height: 800 });
  // the word goes, the button stays (34 px, named for a reader)
  await expect(details).toBeVisible();
  await expect(details.locator(".lbl")).toBeHidden();
  await expect(page.getByRole("button", { name: "Team", exact: true })).toBeVisible();
  const box = await details.boundingBox();
  expect(box?.width).toBe(34);
  await details.click();
  const drawer = page.getByRole("complementary", { name: "Details" });
  await expect(drawer).toBeVisible();
  await expect(shell(page)).toHaveAttribute("data-frame", "folded");
  await expect(page.locator(".drawer-scrim")).toHaveCount(0);
  // 720: the drawer rides over the stream at 300 with a scrim that closes it
  await page.setViewportSize({ width: 700, height: 800 });
  await expect(shell(page)).toHaveAttribute("data-frame", "overlay");
  const scrim = page.locator(".drawer-scrim");
  await expect(scrim).toBeVisible();
  const dbox = await drawer.boundingBox();
  expect(dbox?.width).toBe(300);
  await scrim.click({ position: { x: 20, y: 300 } });
  await expect(drawer).toBeHidden();
  await expect(scrim).toHaveCount(0);
});

test("on Windows the client draws the titlebar; the first run teaches the tray with the menu as it is", async ({
  page,
}) => {
  await page.addInitScript(fakeShell("windows"));
  await page.setViewportSize({ width: 1280, height: 840 });
  await signIn(page, "Fay", "fay");
  await expect(page.locator("html")).toHaveAttribute("data-shell", "windows");
  const bar = page.locator(".w11bar");
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("Henosis");
  const bbox = await bar.boundingBox();
  expect(bbox?.height).toBe(36);
  await expect(bar.getByRole("button", { name: "Minimise" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "Maximise" })).toBeVisible();
  const close = bar.getByRole("button", { name: "Close to the tray" });
  expect((await close.boundingBox())?.width).toBe(46);
  await close.click();
  expect(await page.evaluate(() => (window as unknown as { __closed?: boolean }).__closed)).toBe(
    true,
  );
  // the rail's brand is hidden because the titlebar names the app
  await expect(rail(page).locator(".brand")).toBeHidden();

  // step four: the tray, with the menu as the shell has it and nothing awaiting Fay
  const step = page.locator(".fr-step", { hasText: "The tray" });
  await expect(step).toBeVisible();
  await expect(step).toContainText("Henosis lives in your tray.");
  await expect(step).toContainText("Nothing awaits you, Fay.");
  await expect(step).toContainText("Open Henosis");
  await expect(step).toContainText("Ctrl+Shift+H");
  await expect(step).toContainText("Nothing waits for you yet, Fay.");
  // the shell polls and says an approval waits: the menu lists it, who · verb · what · age
  await page.evaluate(() => {
    (window as unknown as { __inbox: (p: unknown) => void }).__inbox({
      approvals: 1,
      handoffs: 0,
      mentions: 0,
      items: [
        {
          id: "n1",
          kind: "approval",
          who: "Ana's agent",
          verb: "asks to",
          what: "git push · irreversible",
          age: 120,
          route: "#/p/default/s/tray-target",
        },
      ],
      paused: false,
    });
  });
  await expect(step).toContainText("Pending approvals · 1");
  await expect(step).toContainText("Ana's agent asks to git push · irreversible2m");
  await expect(step).toContainText("One thing already waits for you, Fay.");
  await expect(step.locator(".waits code")).toHaveText("git push");
  // a tray row routes into the client
  await page.evaluate(() => {
    (window as unknown as { __tray: (p: unknown) => void }).__tray("#/p/default/s/tray-target");
  });
  await expect(page).toHaveURL(/#\/p\/default\/s\/tray-target$/);
  await expect(page.getByLabel("Directive", { exact: true })).toBeVisible();
  // the composer's hint names the platform's keys and what closing does
  await expect(page.locator(".composer-wrap .hint")).toContainText("closing hides to the tray");
});

test("on macOS the brand row drops under the traffic lights and the title row is the drag region", async ({
  page,
}) => {
  await page.addInitScript(fakeShell("macos"));
  await page.setViewportSize({ width: 1280, height: 840 });
  await signIn(page, "Fay", "fay");
  await expect(page.locator("html")).toHaveAttribute("data-shell", "macos");
  await expect(page.locator(".w11bar")).toHaveCount(0);
  const brandRow = rail(page).locator(".brand-row");
  await expect(brandRow).toHaveCSS("padding-top", "34px");
  await expect(rail(page).locator(".brand")).toBeVisible();
  await page.goto(`/#/p/default/s/mac-${Date.now().toString(36)}`);
  await expect(page.getByLabel("Directive", { exact: true })).toBeVisible();
  const topbar = page.locator(".topbar").first();
  await expect(topbar).toHaveAttribute("data-tauri-drag-region", "true");
  // Share, Team and Details never drag the window
  for (const name of ["Share", "Team", "Details"]) {
    const b = topbar.getByRole("button", { name, exact: true });
    await expect(b).not.toHaveAttribute("data-tauri-drag-region", /.*/);
    await expect(b).toHaveCSS("-webkit-app-region", "no-drag");
  }
  await expect(page.locator(".composer-wrap .hint")).toContainText(
    "the window closes into the tray",
  );
  // the fourth step names the menu bar on macOS, with the platform's shortcut
  await page.goto("/");
  const step = page.locator(".fr-step", { hasText: "The tray" });
  await expect(step).toContainText("Henosis lives in your menu bar.");
  await expect(step).toContainText("⌥⇧H");
});
