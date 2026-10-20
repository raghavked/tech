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

// Under a release gate the primary reads "Approve with N" (N the rating it sends).
const approve = (page: Page) => page.getByRole("button", { name: /^Approve( with \d)?$/ });
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
  await expect(conversation(ana)).toContainText("Cy joins the circle");

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
  await branches.getByRole("button", { name: "More for try/idea" }).click();
  await branches.getByRole("button", { name: "Unite into main" }).click();
  await expect(conversation(page)).toContainText("United try/idea into main");
  await expect(conversation(page)).toContainText(/\d+ conflicts?/);
  await expect(branches).toContainText("conflict");
  // The file list is folded by default; the files line opens it.
  await branches.getByRole("button", { name: /files/ }).click();
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

  // The session's memory panel (folded by default in Details) lists it with Ana's name and the
  // session it came from.
  await openDetails(page);
  const memory = details(page).getByRole("region", { name: "Memory" });
  await memory.getByRole("button", { name: /Memory/ }).click();
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
  await plan.getByRole("radio", { name: "5 of 5, Ship it" }).click();
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
  await expect(conversation(ana)).toContainText("Cy joins the circle");

  // The test run needs one contributor; Ana approves it without a rating.
  await steer(ana, `Build a doubler ${t} and deploy it`);
  await expect(conversation(ana)).toContainText("The agent wants to run", { timeout: 15_000 });
  await approve(ana).click();
  await expect(conversation(ana)).toContainText("Approved: run", { timeout: 15_000 });

  // The deploy is a release gate: two contributors or above, rating it 4+ on average.
  await expect(conversation(bo)).toContainText("deploy to production", { timeout: 15_000 });
  await expect(conversation(bo)).toContainText("2 contributors or above rating it 4+ of 5");
  await expect(bo.getByRole("radio", { name: "3 of 5, Fine" })).toBeVisible();

  // Bo rates it 3 and approves: the button carries the number it sends; one rater, and the average is short.
  await bo.getByRole("radio", { name: "3 of 5, Fine" }).click();
  await bo.getByRole("button", { name: "Approve with 3" }).click();
  await expect(conversation(ana)).toContainText("Bo approved · 3 of 5");
  await expect(conversation(ana)).toContainText("1 of 2 raters · 3 average");
  await expect(conversation(ana)).not.toContainText("Deployed to production");

  // Cy rates it 5: two raters, an average of 4, the deploy goes.
  await cy.getByRole("radio", { name: "5 of 5, Ship it" }).click();
  await cy.getByRole("button", { name: "Approve with 5" }).click();
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
  await sheet.getByRole("radio", { name: "Project Chat" }).check();
  await sheet.getByRole("checkbox", { name: "Bo", exact: true }).check();
  await sheet.getByRole("checkbox", { name: session, exact: true }).check();
  await sheet.getByRole("button", { name: `Create #${groupName}` }).click();
  await expect(ana).toHaveURL(/#\/c\/default\/grp_/);
  await ana.getByRole("button", { name: "Members" }).click();
  const members = ana.getByRole("complementary", { name: "Members" });
  await expect(members).toContainText("Ana (you)");
  await expect(members).toContainText("Bo");
  await expect(members).toContainText(session);

  // Bo opens it from his list (the rail names it too: the list row carries the purpose) and
  // mentions the agent, picking it from the @ list.
  await bo.getByRole("link", { name: new RegExp(`#${groupName} ·`) }).click();
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

test("a council: Ana convenes four models, they answer and discuss, she rates the plan, the work is assigned and the council concludes", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const groupName = `Council ${token()}`;
  const task = `Ship the invoice rollout ${token()}`;

  // Bo shows up first so the server learns his name; his agent is in agents.json.
  const bo = await browser.newPage();
  await signIn(bo, "Bo", "bo");
  await bo.goto("/#/c/default");
  await expect(bo.getByRole("heading", { level: 1 })).toContainText("chats");

  // Ana starts a group in the Chat project with Bo.
  const ana = await browser.newPage();
  await signIn(ana, "Ana", "ana");
  await ana.goto("/#/c/default?new=1");
  const sheet = ana.getByRole("form", { name: "New group" });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Name").fill(groupName);
  await sheet.getByRole("radio", { name: "Project Chat" }).check();
  await sheet.getByRole("checkbox", { name: "Bo", exact: true }).check();
  await sheet.getByRole("button", { name: `Create #${groupName}` }).click();
  await expect(ana).toHaveURL(/#\/c\/default\/grp_/);

  // Convene: the task, four member models from the org's agent profiles, Ana's agent in the chair.
  await ana.getByRole("button", { name: "Convene a council" }).click();
  const convene = ana.getByRole("form", { name: "Convene a council" });
  await expect(convene).toBeVisible();
  await convene.getByLabel("Task").fill(task);
  await expect(convene.getByRole("checkbox", { name: "Ana's agent" })).toBeChecked();
  await convene.getByRole("checkbox", { name: "Bo's agent" }).check();
  await convene.getByRole("checkbox", { name: "Cy's agent" }).check();
  await convene.getByRole("checkbox", { name: "Chat team agent" }).check();
  await expect(convene.getByLabel("Chair", { exact: true })).toHaveValue("agent:ana");
  await convene.getByLabel("Token budget").fill("500000");
  await convene.getByRole("button", { name: "Convene", exact: true }).click();

  // The council room opens inside the group: the task on top, who convened it, the chair.
  await expect(ana).toHaveURL(/\/council\/cnc_/, { timeout: 15_000 });
  const room = ana.getByRole("region", { name: "Council room" });
  await expect(room).toContainText(task);
  await expect(room).toContainText("convened by Ana with 4 models");
  await expect(room).toContainText("chair Ana's agent");

  // The individual round: one answer card per model, with its owner and model named.
  const alone = room.getByRole("region", { name: "Each answers alone" });
  await expect(alone.getByRole("article")).toHaveCount(4, { timeout: 30_000 });
  await expect(alone).toContainText("Bo's model · scripted");
  await expect(alone).toContainText("shared agent");
  await expect(alone).toContainText("Main risk:");

  // The discussion: every reply opens with its stance as a word.
  const discussion = room.getByRole("region", { name: "Discussion" });
  await expect(discussion.locator(".stance")).toHaveCount(4, { timeout: 30_000 });
  await expect(discussion.locator(".stance").first()).toHaveText(/agrees|differs|adds/);

  // The rail shows the council as a card under its group.
  const rail = ana.getByRole("navigation", { name: "Sidebar" });
  await expect(rail).toContainText(/Council · 4 models · /, { timeout: 15_000 });

  // The synthesis: the chair's plan as the plan card with an owner per step; Ana rates it 5.
  const synthesis = room.getByRole("region", { name: "Synthesis" });
  const plan = synthesis.getByRole("region", { name: "Plan" });
  await expect(plan).toBeVisible({ timeout: 30_000 });
  await expect(plan).toContainText("Plan · 5 steps");
  await expect(plan).toContainText("owner Ana's agent");
  await expect(plan).toContainText("owner Chat team agent");
  const five = plan.getByRole("radio", { name: "5 of 5, Ship it" });
  await expect(five).toBeVisible({ timeout: 30_000 });
  await five.click();
  await expect(plan).toContainText("Ana rated it 5");
  await expect(plan).toContainText("approved");

  // The assignments: one agent card per step, owned by the model that proposed it, with its status.
  const assignments = room.getByRole("region", { name: "Assignments" });
  await expect(assignments).toBeVisible({ timeout: 30_000 });
  await expect(assignments).toContainText("assigned to Bo's agent");
  await expect(assignments.locator(".agent")).toHaveCount(5, { timeout: 30_000 });

  // The member sessions work under the project's policy: a test run is an exec, which waits for
  // the owner's word and reaches Ana as a decision toast. She approves her agent's runs (and only
  // those: the other flows' approvals stay waiting) until every step has reported back.
  const conclusion = room.getByRole("region", { name: "Conclusion" });
  await expect
    .poll(
      async () => {
        const mine = ana.getByRole("alert").filter({ hasText: task });
        const approveRun = mine.getByRole("button", { name: /^Approve/ }).first();
        if (await approveRun.isVisible().catch(() => false))
          await approveRun.click().catch(() => {});
        return (await conclusion.count()) > 0 ? ((await conclusion.textContent()) ?? "") : "";
      },
      { timeout: 90_000, intervals: [1_000] },
    )
    .toContain("Concluded · done");
  await expect(conclusion).toContainText(/dissents|No dissent recorded/);
  await expect(rail).toContainText("Council · 4 models · concluded: done");

  // The members panel lists every model with its owner, the chair marked, and an Instruct room each.
  // The corner first: the member sessions' path collisions reached Ana as decision toasts, which
  // sit over the top row until she dismisses them (dismissing is local to the page).
  await expect
    .poll(
      async () => {
        const x = ana.getByRole("alert").getByRole("button", { name: "Dismiss" }).first();
        if (await x.isVisible().catch(() => false)) await x.click().catch(() => {});
        return await ana.getByRole("alert").count();
      },
      { timeout: 30_000, intervals: [250] },
    )
    .toBe(0);
  await ana.getByRole("button", { name: "Members" }).click();
  const panel = ana.getByRole("complementary", { name: "Members" });
  await expect(panel).toContainText("Ana's agent");
  await expect(panel).toContainText("Chair");
  await panel.getByRole("link", { name: "Instruct Bo's agent" }).click();
  await expect(ana).toHaveURL(/\/instruct\/agent(:|%3A)bo$/);
  await expect(ana.getByRole("region", { name: "Instruct Bo's agent" })).toContainText(
    "Only Bo and the chair see it",
  );

  // Bo sees the same council from his side of the group.
  await bo
    .getByRole("navigation", { name: "Sidebar" })
    .getByRole("link", { name: `#${groupName}`, exact: true })
    .click();
  await bo.getByRole("region", { name: "Councils" }).getByRole("link", { name: task }).click();
  await expect(bo.getByRole("region", { name: "Council room" })).toContainText("Concluded · done");
});

test("welcome an agent: the arrival card, what it was told, and the tour from Settings", async ({
  page,
}) => {
  const session = `e2e-tour-${token()}`;
  await enter(page, "Ana", "ana", "e2e-tour", session);

  // A young session opens on its arrival card: the joining line, who it is, the facts, the rule.
  const arrival = page.getByRole("region", { name: `${session} has joined` });
  await expect(arrival).toBeVisible();
  await expect(arrival).toContainText("Ana's agent, joins the circle.");
  await expect(arrival).toContainText("Mentioned by");
  await expect(arrival).toContainText("hears only what mentions it");
  await expect(arrival).toContainText("Who it joined");
  await expect(arrival).toContainText("Ana");

  // "What it was told" opens the welcome brief: the paragraph, the ledger sections and the
  // mono fold with the text the ledger recorded for the agent.
  await arrival.getByRole("button", { name: "What it was told" }).click();
  const told = page.getByRole("complementary", { name: `What ${session} was told` });
  await expect(told).toBeVisible();
  await expect(told).toContainText(`You are Ana's agent on ${session}.`);
  await expect(told).toContainText("Written by the system from the ledger");
  await expect(told.getByRole("region", { name: "The circle" })).toContainText("Ana is your owner");
  await expect(told.getByRole("region", { name: "Manners" })).toContainText("Ask for risky calls.");
  await told.getByText("As the model reads it").click();
  await expect(told).toContainText("## Henosis · you have joined");

  // "Say hello" puts the person in the composer.
  await arrival.getByRole("button", { name: "Say hello" }).click();
  await expect(page.getByLabel("Directive", { exact: true })).toBeFocused();

  // Settings · Help · Take the tour replays it on the most recent session: five coach marks in
  // order, Back and Next, then "Close the ring" and the toast.
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "Take the tour" }).click();
  await expect(page).toHaveURL(new RegExp(`#/p/e2e-tour/s/${session}$`));
  const dialog = (n: number) => page.getByRole("dialog", { name: `Tour, step ${n} of 5` });
  await expect(dialog(1)).toBeVisible();
  await expect(dialog(1)).toContainText("The rail is the team.");
  await dialog(1).getByRole("button", { name: "Next · the stream" }).click();
  await expect(dialog(2)).toContainText("Everything is attributed.");
  await dialog(2).getByRole("button", { name: "Back" }).click();
  await expect(dialog(1)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await dialog(2).getByRole("button", { name: "Next · the plan" }).click();
  await expect(dialog(3)).toContainText("Plans come first.");
  await dialog(3).getByRole("button", { name: "Next · the release gate" }).click();
  await expect(dialog(4)).toContainText("held by the people who consume the code");
  await dialog(4).getByRole("button", { name: "Next · the composer" }).click();
  await expect(dialog(5)).toContainText("Agent, or Team.");
  await dialog(5).getByRole("button", { name: "Close the ring" }).click();
  await expect(page.getByRole("dialog", { name: /^Tour/ })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Ana is in the circle." })).toBeVisible();
});

test("print and export: the session on paper with the cream mark, the audit trail, the recorded act", async ({
  page,
}) => {
  const t = token();
  const session = `e2e-export-${t}`;
  // The print dialog cannot open headless: the flow stands in for it and counts the calls.
  await page.addInitScript(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => {
      (window as unknown as { printed: number }).printed += 1;
    };
  });
  await enter(page, "Ana", "ana", "e2e-export", session);
  await steer(page, `Build a greeter ${t}`);
  await expect(approve(page)).toBeVisible({ timeout: 15_000 });
  await approve(page).click();
  await expect(conversation(page)).toContainText("Done:", { timeout: 15_000 });

  // Export opens from the Share sheet; the column becomes the session as a document.
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByRole("button", { name: "Export or print…" }).click();
  const sheet = page.getByRole("complementary", { name: "Export" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("radio", { name: /Session as PDF/ })).toBeChecked();
  const paper = page.getByRole("article", { name: "Session export" });
  await expect(paper).toBeVisible();
  await expect(paper).toContainText(`Build a greeter ${t}`);
  await expect(paper).toContainText("Ana");
  await expect(paper).toContainText("owner");
  await expect(paper).toContainText("Approval granted");
  await expect(paper).toContainText("Replays to the same hash.");
  await expect(paper).toContainText(`henosis verify sessions/${session}/log.json`);
  await expect(paper).toContainText("Sealed by the log");
  await expect(paper).toContainText("tool steps folded to one line each");

  // Every mark on paper is the cream variant, coloured through custom properties: a cream disc,
  // a chocolate and a navy arc, an apricot centre. Never the navy coin with a black dot.
  const marks = await paper.locator("svg.mark").evaluateAll((els) =>
    els.map((el) => {
      const fill = (q: string) => getComputedStyle(el.querySelector(q) as Element).fill;
      const stroke = (q: string) => getComputedStyle(el.querySelector(q) as Element).stroke;
      return { disc: fill(".disc"), a: stroke(".arc.a"), b: stroke(".arc.b"), dot: fill(".dot") };
    }),
  );
  expect(marks.length).toBeGreaterThanOrEqual(2);
  for (const m of marks)
    expect(m).toEqual({
      disc: "rgb(251, 247, 241)",
      a: "rgb(86, 53, 45)",
      b: "rgb(42, 50, 68)",
      dot: "rgb(226, 196, 166)",
    });

  // The audit trail: one row per act, the kernel's decision in green with the rule inline.
  await sheet.getByRole("radio", { name: /Audit trail/ }).check();
  const audit = page.getByRole("article", { name: "Audit trail" });
  await expect(audit).toBeVisible();
  await expect(audit).toContainText("Who planned, rated and approved what");
  const kernel = audit.locator("tr.kernel").first();
  await expect(kernel).toContainText("Approval granted");
  await expect(kernel).toContainText("one contributor or above");
  await expect(kernel).toContainText("✓ fold");
  await expect(kernel.locator("td.a")).toHaveCSS("color", "rgb(62, 102, 57)");
  await expect(audit.locator("tr.exp")).toContainText("Printed the audit trail, this page");
  await expect(audit.locator("tr.exp")).toContainText("Ana");
  await expect(audit).toContainText("Replays to the same hash.");

  // In print the chrome leaves and the sheet stays: the composer is gone, the paper is white.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByLabel("Directive", { exact: true })).toBeHidden();
  await expect(audit).toBeVisible();
  await expect(audit).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.emulateMedia({ media: null });

  // Printing is itself an act: a row in the log, in the exporter's voice.
  await expect(sheet).toContainText('Recorded as an act: "Ana exported the audit trail."');
  await sheet.getByRole("button", { name: "Print or save as PDF" }).click();
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await sheet.getByRole("button", { name: "Close export" }).click();
  await expect(conversation(page)).toContainText("Ana exported the audit trail.");
});
