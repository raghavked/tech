import { expect, type Page, test } from "@playwright/test";

/**
 * Flows beyond the smoke: project direction, peer contention, fork and fold, memory, inbox.
 * Each flow runs in its own project (see test/fixtures/orgs.json) because path claims are per
 * project and never expire: two sessions writing PLAN.md in one project would refuse each other.
 * Locators use roles and labels only, and every test stays under thirty seconds against the
 * scripted model.
 */
test.describe.configure({ timeout: 30_000 });

/** A short lowercase token so goals, memory keys and sessions never collide across runs. */
const token = () => Date.now().toString(36).slice(-4);

/** Pick an identity on the home page. */
async function signIn(page: Page, name: string, userId: string) {
  await page.goto("/");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("User id").fill(userId);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(`Signed in as ${name}`)).toBeVisible();
}

/** Sign in, then open `session` in `project` by its route and wait until joined. */
async function enter(page: Page, name: string, userId: string, project: string, session: string) {
  await signIn(page, name, userId);
  await page.goto(`/#/p/${project}/s/${session}`);
  await expect(page).toHaveURL(new RegExp(`#/p/${project}/s/${session}$`));
  await expect(page.getByLabel("Directive", { exact: true })).toBeVisible();
}

const conversation = (page: Page) => page.getByLabel("Conversation");
const details = (page: Page) => page.getByRole("complementary", { name: "Details" });

async function openDetails(page: Page) {
  if ((await details(page).count()) === 0)
    await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(details(page)).toBeVisible();
}

/** Send a directive from the composer, optionally on a named scope, and see it echoed. */
async function steer(page: Page, text: string, scope?: string) {
  if (scope) {
    const more = page.getByRole("button", { name: "Mode and scope" });
    if ((await more.getAttribute("aria-expanded")) !== "true") await more.click();
    await page.getByLabel("Scope", { exact: true }).fill(scope);
  }
  const box = page.getByLabel("Directive", { exact: true });
  await box.fill(text);
  await box.press("Enter");
  await expect(conversation(page)).toContainText(text);
}

const approve = (page: Page) => page.getByRole("button", { name: "Approve", exact: true });
const planCard = (page: Page) => page.getByRole("region", { name: "Plan" }).last();

test("a lead's project direction reaches a session and leaves when withdrawn", async ({
  browser,
}) => {
  const session = `e2e-dir-${token()}`;
  const text = `Keep every function pure ${token()}`;
  const ana = await browser.newPage();
  await enter(ana, "Ana", "ana", "e2e-direction", session);

  // Lee is a team lead in users.json; the project page is where direction is set.
  const lee = await browser.newPage();
  await signIn(lee, "Lee", "lee");
  await lee.goto("/#/p/e2e-direction");
  await expect(lee.getByRole("heading", { level: 1 })).toContainText("Direction");
  await lee.getByLabel("Project direction").fill(text);
  await lee.getByRole("button", { name: "Set direction" }).click();
  await expect(lee.getByRole("button", { name: `Withdraw: ${text}` })).toBeVisible();

  // The session sees the direction arrive as a quiet notice and as a standing constraint.
  await expect(conversation(ana)).toContainText(`set a project direction: ${text}`);
  await openDetails(ana);
  const intent = details(ana).getByRole("region", { name: "Intent" });
  await expect(intent).toContainText(text);
  await expect(intent).toContainText("project");

  // Withdrawing it on the project page withdraws it from the session too.
  await lee.getByRole("button", { name: `Withdraw: ${text}` }).click();
  await expect(lee.getByRole("button", { name: `Withdraw: ${text}` })).toHaveCount(0);
  await expect(intent).not.toContainText(text);
});

test("two peers steer one scope at once; the owner picks a direction", async ({ browser }) => {
  const session = `e2e-ctn-${token()}`;
  const ana = await browser.newPage();
  await enter(ana, "Ana", "ana", "e2e-contention", session);
  const bo = await browser.newPage();
  await enter(bo, "Bo", "bo", "e2e-contention", session);
  const cy = await browser.newPage();
  await enter(cy, "Cy", "cy", "e2e-contention", session);
  await expect(conversation(ana)).toContainText("Cy joined as contributor");

  // Two contributors disagree on `api` before the agent acts: a contention, not an override.
  await steer(bo, "Use REST", "api");
  await steer(cy, "Use GraphQL", "api");
  await expect(conversation(ana)).toContainText("Two directions for api");
  await expect(conversation(ana)).toContainText("until you pick one");
  await expect(conversation(bo)).toContainText("Ana picks one");
  await expect(bo.getByRole("button", { name: "Withdraw: Use REST" })).toBeVisible();
  await expect(bo.getByRole("button", { name: "Pick: Use REST" })).toHaveCount(0);

  // The owner picks; everyone sees the pick and the scope settles on the winner.
  await ana.getByRole("button", { name: "Pick: Use REST" }).click();
  await expect(conversation(bo)).toContainText("Ana picked a direction");
  await expect(conversation(bo)).not.toContainText("Two directions for api");
  await openDetails(cy);
  const intent = details(cy).getByRole("region", { name: "Intent" });
  await expect(intent).toContainText("Use REST");
  await expect(intent).not.toContainText("Use GraphQL");
});

test("fork, steer the branches apart, fold back with a conflict", async ({ page }) => {
  const session = `e2e-fork-${token()}`;
  await enter(page, "Ana", "ana", "e2e-fork", session);

  // One finished turn on main so the fork has a workspace to diverge from.
  await steer(page, `Build a greeter ${token()}`);
  await expect(approve(page)).toBeVisible({ timeout: 15_000 });
  await approve(page).click();
  await expect(conversation(page)).toContainText("Done:", { timeout: 15_000 });

  await openDetails(page);
  const branches = details(page).getByRole("region", { name: "Branches" });
  await branches.getByLabel("New branch name").fill("try/idea");
  await branches.getByRole("button", { name: "Fork" }).click();
  await expect(conversation(page)).toContainText("Branch try/idea forked from main");

  // On the branch the agent rewrites the plan one way...
  await branches.getByRole("button", { name: "Switch" }).click();
  await expect(branches).toContainText("try/idea · here");
  await steer(page, "Use arrow functions", "style");
  await expect(approve(page)).toBeVisible({ timeout: 15_000 });

  // ...and on main another way.
  await branches.getByRole("button", { name: "Switch" }).click();
  await expect(branches).toContainText("main · here");
  await steer(page, "Use classes", "style");
  await expect(approve(page)).toBeVisible({ timeout: 15_000 });

  // Folding the branch into main is a three-way merge: both sides changed PLAN.md.
  await branches.getByRole("button", { name: "Unite into main" }).click();
  await expect(conversation(page)).toContainText("United try/idea into main");
  await expect(conversation(page)).toContainText(/\d+ conflicts?/);
  await expect(branches).toContainText("conflict");
  await expect(branches).toContainText("PLAN.md · conflict");
});

test("the memory panel shows an entry attributed to the engineer", async ({ page }) => {
  const session = `e2e-mem-${token()}`;
  const t = token();
  const key = `module.build_a_widget_${t}`;
  await enter(page, "Ana", "ana", "e2e-memory", session);

  // The scripted agent remembers where the module lives as it writes the tests.
  await steer(page, `Build a widget ${t}`);
  await expect(conversation(page)).toContainText(`Remembered ${key}`, { timeout: 15_000 });

  // The session's memory panel lists it with Ana's name and the session it came from.
  await openDetails(page);
  const memory = details(page).getByRole("region", { name: "Memory" });
  await expect(memory).toContainText(key);
  await expect(memory).toContainText("Ana");
  await expect(memory).toContainText(`session ${session}`);

  // The project page carries the same attribution line.
  await page.goto("/#/p/e2e-memory");
  const team = page.getByRole("region", { name: "Team memory" });
  await expect(team).toContainText(key, { timeout: 15_000 });
  await expect(team).toContainText(`Ana · ${session}`);
});

test("plan first: the agent proposes, Ana rates it, the plan is approved and the agent proceeds", async ({
  page,
}) => {
  const t = token();
  const session = `e2e-plan-${t}`;
  await signIn(page, "Ana", "ana");

  // A new session from the project page: plan first is on by default.
  await page.goto("/#/p/e2e-plan");
  const agents = page.getByRole("region", { name: "Agents" });
  await agents.getByRole("button", { name: "New session" }).click();
  await expect(page.getByLabel("Plan first")).toBeChecked();
  await page.getByLabel("Token budget").fill("20000");
  await page.getByLabel("Title", { exact: true }).fill(`Plan ${t}`);
  await page.getByLabel("Session id", { exact: true }).fill(session);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#/p/e2e-plan/s/${session}`));
  await expect(page.getByLabel("Directive", { exact: true })).toBeVisible();

  // The goal brings a plan, not work: the card, the pill and the quiet line under the composer.
  await steer(page, `Build a widget ${t}`);
  const plan = planCard(page);
  await expect(plan).toBeVisible({ timeout: 15_000 });
  await expect(plan).toContainText("Plan · 2 steps");
  await expect(plan).toContainText("Waiting for ratings");
  await expect(plan).toContainText(`Write src/build_a_widget_${t}.mjs`);
  await expect(plan).toContainText("budget 20,000 tokens");
  await expect(page.getByText("The plan waits for ratings")).toBeVisible();
  await expect(page.getByText("Planning", { exact: true })).toBeVisible();
  await expect(conversation(page)).not.toContainText("Wrote src/");

  // Ana rates it 5: one rating at 3 or above is the default bar, so the plan is approved.
  await plan.getByRole("button", { name: "Rate 5 of 5" }).click();
  await expect(plan).toContainText("1 of 1 ratings · 5 average · approved");
  await expect(plan).toContainText("Ana rated it 5");
  await expect(page.getByText("The plan waits for ratings")).toHaveCount(0);

  // The agent proceeds through its steps and asks for the test run as usual.
  await expect(conversation(page)).toContainText(`Wrote src/build_a_widget_${t}.mjs`, {
    timeout: 15_000,
  });
  await expect(approve(page)).toBeVisible({ timeout: 15_000 });
  await approve(page).click();
  await expect(conversation(page)).toContainText("Done:", { timeout: 15_000 });
  await expect(plan).toContainText("Done");
  await expect(plan).toContainText(/\d+ used/);
});

test("a deploy waits until two contributors rate it 4 or better", async ({ browser }) => {
  const t = token();
  const session = `e2e-gate-${t}`;
  const ana = await browser.newPage();
  await enter(ana, "Ana", "ana", "e2e-gate", session);
  const bo = await browser.newPage();
  await enter(bo, "Bo", "bo", "e2e-gate", session);
  const cy = await browser.newPage();
  await enter(cy, "Cy", "cy", "e2e-gate", session);
  await expect(conversation(ana)).toContainText("Cy joined as contributor");

  // The test run needs one contributor; Ana approves it without a rating.
  await steer(ana, `Build a doubler ${t} and deploy it`);
  await expect(conversation(ana)).toContainText("The agent wants to run", { timeout: 15_000 });
  await approve(ana).click();
  await expect(conversation(ana)).toContainText("Approved: run", { timeout: 15_000 });

  // The deploy is a release gate: two contributors or above, rating it 4+ on average.
  await expect(conversation(bo)).toContainText("deploy to production", { timeout: 15_000 });
  await expect(conversation(bo)).toContainText("2 contributors or above rating it 4+ of 5");
  await expect(bo.getByRole("button", { name: "Rate 3 of 5" })).toBeVisible();

  // Bo rates it 3 and approves: one rater, and the average is short.
  await bo.getByRole("button", { name: "Rate 3 of 5" }).click();
  await approve(bo).click();
  await expect(conversation(ana)).toContainText("Bo approved · 3 of 5");
  await expect(conversation(ana)).toContainText("1 of 2 raters · 3 average");
  await expect(conversation(ana)).not.toContainText("Deployed to production");

  // Cy rates it 5: two raters, an average of 4, the deploy goes.
  await cy.getByRole("button", { name: "Rate 5 of 5" }).click();
  await approve(cy).click();
  await expect(conversation(ana)).toContainText("Approved: deploy to production");
  await expect(conversation(ana)).toContainText("Deployed to production", { timeout: 15_000 });
});

test("the inbox lists an approval waiting and opens the session to it", async ({ page }) => {
  const session = `e2e-inbox-${token()}`;
  await enter(page, "Ana", "ana", "e2e-inbox", session);
  await steer(page, `Build a counter ${token()}`);
  await expect(approve(page)).toBeVisible({ timeout: 15_000 });

  // The server's inbox for Ana holds the approval with a deep link to this session.
  const res = await page.request.get("/api/notifications?user=ana");
  const { notifications } = (await res.json()) as {
    notifications: { kind: string; link: string }[];
  };
  expect(
    notifications.some(
      (n) => n.kind === "approval" && n.link === `henosis://p/e2e-inbox/s/${session}`,
    ),
  ).toBe(true);

  // The team page's "Needs you" lists it; the row opens the session with the approval waiting.
  await page.goto("/#/m/default");
  const needs = page.getByRole("region", { name: "Needs you" });
  const row = needs.getByRole("link", { name: new RegExp(`1 approval waiting in ${session}`) });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await expect(page).toHaveURL(new RegExp(`#/p/e2e-inbox/s/${session}$`));
  await approve(page).click();
  await expect(conversation(page)).toContainText("Approved: run");
  await expect(conversation(page)).toContainText("Done:", { timeout: 15_000 });
});

test("a group of Ana, Bo and her agent: Bo's mention steers the agent and its reply lands in the chat", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const session = `e2e-chat-${token()}`;
  const groupName = `Rollout ${token()}`;
  const ask = "what is left to do?";
  const messages = (page: Page) => page.getByRole("region", { name: "Messages" });

  // Bo shows up first (the server learns his name), on the org's chat list.
  const bo = await browser.newPage();
  await signIn(bo, "Bo", "bo");
  await bo.goto("/#/c/default");
  await expect(bo.getByRole("heading", { level: 1 })).toContainText("chats");

  // Ana's agent: a goal and one finished turn, so a mention starts its next turn.
  const ana = await browser.newPage();
  await enter(ana, "Ana", "ana", "e2e-chat", session);
  await steer(ana, `Build a greeter ${token()}`);
  await expect(approve(ana)).toBeVisible({ timeout: 15_000 });
  await approve(ana).click();
  await expect(conversation(ana)).toContainText("Done:", { timeout: 15_000 });

  // Ana starts a group from the sidebar: Bo and her agent are the members.
  await ana
    .getByRole("navigation", { name: "Sidebar" })
    .getByRole("link", { name: "New group" })
    .click();
  const sheet = ana.getByRole("form", { name: "New group" });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Name").fill(groupName);
  await sheet.getByLabel("Purpose").fill("Greeter rollout");
  await sheet.getByLabel("Scope").selectOption({ label: "Project Chat" });
  await sheet.getByRole("checkbox", { name: "Bo", exact: true }).check();
  await sheet.getByRole("checkbox", { name: session, exact: true }).check();
  await sheet.getByRole("button", { name: "Create group" }).click();
  await expect(ana).toHaveURL(/#\/c\/default\/grp_/);
  await ana.getByRole("button", { name: "Members" }).click();
  const members = ana.getByRole("complementary", { name: "Members" });
  await expect(members).toContainText("Ana (you)");
  await expect(members).toContainText("Bo");
  await expect(members).toContainText(session);

  // Bo opens it from his list and mentions the agent, picking it from the @ list.
  await bo.getByRole("link", { name: new RegExp(groupName) }).click();
  await expect(bo).toHaveURL(/#\/c\/default\/grp_/);
  const box = bo.getByLabel("Message", { exact: true });
  await box.fill(`@${session.slice(0, 9)}`);
  await bo.getByRole("option", { name: new RegExp(session) }).click();
  await expect(box).toHaveValue(`@${session} `);
  await box.pressSequentially(ask);
  await box.press("Enter");
  await expect(messages(bo)).toContainText(`@${session} ${ask}`);
  await expect(messages(bo).locator("mark.mention")).toHaveText(`@${session}`);

  // The agent's next words come back into the group, under its session title, for everyone.
  await expect(messages(bo).locator(".msg.agent")).toContainText("to match the team's direction", {
    timeout: 20_000,
  });
  await expect(messages(ana).locator(".msg.agent")).toContainText(session);
  await expect(messages(ana).locator(".msg.agent")).toContainText("replied");

  // And in the session the mention is a directive from Bo, in the scope "chat".
  await ana.goto(`/#/p/e2e-chat/s/${session}`);
  await expect(conversation(ana)).toContainText(`Bo in #${groupName}: @${session} ${ask}`);
  await expect(conversation(ana)).toContainText("chat");
});
