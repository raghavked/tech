import { expect, type Page, test } from "@playwright/test";

/**
 * A server of workspaces in the browser (the second pair of playwright.config.ts): a person
 * makes a workspace for their company, connects its model key, invites a colleague by link,
 * and works in a session; someone outside sees nothing of it.
 */
const WEB_PORT = Number(process.env.HENOSIS_SMOKE_PORT ?? 4173) + 1;
test.use({ baseURL: `http://127.0.0.1:${WEB_PORT}` });
test.describe.configure({ timeout: 45_000 });

const token = () => Date.now().toString(36).slice(-4);

async function signIn(page: Page, name: string, userId: string, path = "/") {
  await page.goto(path);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("User id").fill(userId);
  await page.getByRole("button", { name: "Continue" }).click();
}

test("a company makes its workspace, connects its key, invites a colleague, and nobody else sees in", async ({
  page,
  browser,
}) => {
  const t = token();
  const ana = `ana-${t}`;
  const bo = `bo-${t}`;
  const cy = `cy-${t}`;
  const company = `Acme ${t}`;
  const org = `acme-${t}`;

  // Ana signs in to an empty server: the second step asks for her workspace.
  await signIn(page, "Ana", ana);
  await expect(page.getByText("Signed in as Ana")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your workspace" })).toBeVisible();
  await page.getByLabel("Workspace name").fill(company);
  await page.getByRole("button", { name: "Create workspace" }).click();
  // The workspace's first team appears in the step, and the line under the top row says what
  // its agents run on until a key is connected.
  await expect(page.getByRole("button", { name: /^General/ })).toBeVisible();
  const notice = page.getByRole("status").filter({ hasText: "run the demo model" });
  await expect(notice).toBeVisible();
  await notice.getByRole("link", { name: "Connect your key" }).click();

  // Settings → Workspace: she is its admin, and connects the company's key.
  await expect(page).toHaveURL(/#\/settings$/);
  const section = page.locator(`#workspace-${org}`);
  await expect(section.getByRole("heading", { name: `Workspace · ${company}` })).toBeVisible();
  await expect(section.getByText("You are an admin")).toBeVisible();
  const key = `sk-ant-api03-${"k".repeat(40)}-${t}`;
  await section.getByLabel("Anthropic API key").fill(key);
  await section.getByRole("button", { name: "Connect key" }).click();
  await expect(section.getByText(`Connected · key ending ${t}`)).toBeVisible();
  // The key is never shown again: not in the page, not in what the server answers.
  await expect(page.locator("body")).not.toContainText(key);
  const listed = await page.request.get(`/api/workspaces?user=${ana}`);
  expect(await listed.text()).not.toContain(key);

  // An invitation link for Bo.
  await section.getByRole("button", { name: "Create invitation link" }).click();
  const link = await section.getByLabel("Copy this link now. It is not shown again.").inputValue();
  expect(link).toMatch(/#\/join\/[\w-]{20,}$/);

  // Bo opens the link in his own browser, signs in, and joins.
  const boContext = await browser.newContext();
  const boPage = await boContext.newPage();
  await signIn(boPage, "Bo", bo, link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(boPage.getByRole("heading", { name: `Join ${company}?` })).toBeVisible();
  await expect(boPage.getByText("Ana invited you as a member.")).toBeVisible();
  await boPage.getByRole("button", { name: "Join", exact: true }).click();
  await expect(boPage).toHaveURL(new RegExp(`#/p/${org}-main$`));

  // Ana sees Bo among the people; Bo, a member, sees no way to manage the key.
  await page.reload();
  const people = section.getByRole("list", { name: "People" });
  await expect(people).toContainText("Bo");
  await expect(people.getByLabel("Role of Bo")).toHaveValue("member");
  await boPage.goto("/#/settings");
  const boSection = boPage.locator(`#workspace-${org}`);
  await expect(boSection.getByText("You are a member")).toBeVisible();
  await expect(boSection.getByRole("button", { name: "Replace" })).toHaveCount(0);
  await expect(boSection.getByRole("button", { name: "Create invitation link" })).toHaveCount(0);

  // They work in one session of the workspace's project.
  const session = `ws-${t}`;
  await page.goto(`/#/p/${org}-main/s/${session}`);
  const box = page.getByLabel("Directive", { exact: true });
  await expect(box).toBeVisible();
  await box.fill(`Build a widget ${t}`);
  await box.press("Enter");
  await expect(page.getByLabel("Conversation")).toContainText(`Build a widget ${t}`);
  await boPage.goto(`/#/p/${org}-main/s/${session}`);
  await expect(boPage.getByLabel("Conversation")).toContainText(`Build a widget ${t}`, {
    timeout: 15_000,
  });

  // Cy, who was not invited, signs in to the same server and finds none of it.
  const cyContext = await browser.newContext();
  const cyPage = await cyContext.newPage();
  await signIn(cyPage, "Cy", cy);
  await expect(cyPage.getByLabel("Workspace name")).toBeVisible();
  for (const path of [
    `/api/workspaces/${org}`,
    `/api/projects/${org}-main/sessions`,
    `/api/chat/${org}`,
    `/api/sessions/${session}/export.md`,
  ]) {
    const res = await cyPage.request.get(`${path}?user=${cy}`);
    expect(`${path} ${res.status()}`).toBe(`${path} 404`);
  }
  const mine = await cyPage.request.get(`/api/workspaces?user=${cy}`);
  expect(((await mine.json()) as { workspaces: unknown[] }).workspaces).toEqual([]);
  await cyPage.goto(`/#/p/${org}-main/s/${session}`);
  // Cy is in no workspace: a link into Ana's brings him back to making his own.
  await expect(cyPage.getByLabel("Workspace name")).toBeVisible();
  await expect(cyPage.locator("body")).not.toContainText(`Build a widget ${t}`);

  // Once Cy has a workspace of his own, the same link says it is not his to open.
  await cyPage.getByLabel("Workspace name").fill(`Beta ${t}`);
  await cyPage.getByRole("button", { name: "Create workspace" }).click();
  await expect(cyPage.getByRole("heading", { name: "Not in your workspaces" })).toBeVisible();
  await expect(cyPage.locator("body")).not.toContainText(`Build a widget ${t}`);
  // The rail names Ana by her standing in the workspace.
  await expect(page.getByRole("button", { name: /Ana.*(admin|owner)/ })).toBeVisible();

  await boContext.close();
  await cyContext.close();
});

test("an invitation that does not exist says so", async ({ page }) => {
  const t = token();
  await signIn(page, "Dee", `dee-${t}`, "/#/join/not-a-real-invitation");
  await expect(page.getByText("This invitation does not exist.")).toBeVisible();
});
