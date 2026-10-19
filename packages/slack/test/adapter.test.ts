import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_RATING } from "@henosis/protocol";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { HenosisServer } from "@henosis/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SlackAdapter } from "../src/adapter.js";
import { FakeSlackClient } from "../src/client.js";

type ButtonEl = { action_id: string; value?: string; style?: string; text: { text: string } };
function buttons(
  post: { blocks?: { type: string; elements?: unknown }[] } | undefined,
): ButtonEl[] {
  const actions = post?.blocks?.find((b) => b.type === "actions");
  return (actions?.elements as ButtonEl[] | undefined) ?? [];
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("slack adapter", () => {
  let root: string;
  let server: HenosisServer;
  let slack: FakeSlackClient;
  let adapter: SlackAdapter;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "henosis-slack-"));
    writeFileSync(
      join(root, "orgs.json"),
      JSON.stringify({
        orgs: [
          {
            id: "nw",
            name: "Northwind",
            teams: [
              { id: "pay", name: "Payments", projects: [{ id: "billing", name: "Billing" }] },
            ],
          },
        ],
      }),
    );
    writeFileSync(
      join(root, "users.json"),
      JSON.stringify({
        users: [
          { id: "dee", name: "Dee", slackId: "U_DEE", teams: [{ teamId: "pay", role: "lead" }] },
          { id: "ana", name: "Ana", projects: [{ projectId: "billing", role: "member" }] },
          { id: "bo", name: "Bo", projects: [{ projectId: "billing", role: "member" }] },
        ],
      }),
    );
    server = new HenosisServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    slack = new FakeSlackClient();
    adapter = new SlackAdapter({
      server,
      client: slack,
      map: {
        teams: { pay: "C_TEAM" },
        projects: { billing: "C_PROJ" },
        management: "C_MGMT",
        users: { U_DEE: "dee", U_BO: "bo", U_ANA: "ana" },
      },
      coalesceMs: 0,
      appBaseUrl: "https://henosis.example.com/",
      now: () => new Date("2026-10-13T08:00:00Z"),
    });
    adapter.watchProject("billing");
    const host = server.project("billing");
    host.project.join("dee", "Dee", "lead");
    host.project.join("bo", "Bo", "member");
  });
  afterAll(async () => {
    // Let the server's debounced memory write (20ms) land before the store directory goes.
    await wait(60);
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("threads a session, posts approvals as buttons, votes from a click, steers from a reply, escalates contentions and memory conflicts", async () => {
    const host = server.project("billing");
    const a = host.session("s-ana", { title: "Doubling helper", ownerId: "ana" });
    a.session.join("main", { id: "ana", kind: "human", name: "Ana" }, "owner");
    await wait(20);
    const root = slack.posts.find((p) => p.channel === "C_PROJ" && !p.threadTs);
    expect(root?.text).toContain("*Ana's agent* started _Doubling helper_ in Billing.");
    // The thread root links into the app: the session's hash route under appBaseUrl, last.
    expect(
      root?.text?.endsWith("<https://henosis.example.com/#/p/billing/s/s-ana|Open in Henosis>"),
    ).toBe(true);
    // The five-part anatomy: the sentence, then the context line.
    expect(root?.blocks?.map((b) => b.type)).toEqual(["section", "context"]);

    // Steering from a thread reply as Bo (contributor via users.json).
    await slack.reply(
      "C_PROJ",
      root?.ts ?? "",
      "U_BO",
      "[goal] Build a doubling helper and deploy it",
    );
    await wait(300);
    const st = a.session.state();
    expect(st.intent.goal?.text).toBe("Build a doubling helper and deploy it");
    expect(st.participants.bo?.role).toBe("contributor");
    // The agent asked for an exec approval: Approve (primary) and Deny (danger), nothing more.
    const approval = slack.posts.find(
      (p) => p.threadTs === root?.ts && (p.blocks ?? []).some((b) => b.type === "actions"),
    );
    expect(approval?.text).toContain("*Approval needed* in Ana's session");
    expect(approval?.text).toContain(
      "<https://henosis.example.com/#/p/billing/s/s-ana|Review in Henosis>",
    );
    const plain = buttons(approval);
    expect(plain.map((b) => b.text.text)).toEqual(["Approve", "Deny"]);
    expect(plain.map((b) => b.style)).toEqual(["primary", "danger"]);
    await slack.click(String(plain[0]?.action_id), "U_BO");
    await wait(400);
    const granted = Object.values(a.session.state().approvals).find((x) => x.call.risk === "exec");
    expect(granted?.status).toBe("granted");
    expect(granted?.votes.bo).toBe("approve");
    // A plain Approve under a plain rule carries no rating, as the app's does not.
    expect(granted?.ballots.bo?.rating).toBeNull();
    const decided = slack.updates.find((u) => u.text.includes("granted"));
    expect(decided?.text).toContain("*granted* · Bo _(edited)_");
    expect(decided?.blocks?.some((b) => b.type === "actions")).toBe(false);

    // Deploy is a release gate (two raters at 4+): five stars with the rating in the value, Deny
    // in danger, no star primary; broadcast to the channel.
    const deploy = [...slack.posts]
      .reverse()
      .find((p) => p.text.includes("deploy") && (p.blocks ?? []).some((b) => b.type === "actions"));
    expect(deploy?.broadcast).toBe(true);
    expect(deploy?.text).toContain("Needs 2 contributors or above rating it 4+ of 5 on average.");
    const stars = buttons(deploy);
    expect(stars.map((b) => b.text.text)).toEqual(["1★", "2★", "3★", "4★", "5★", "Deny"]);
    expect(stars.slice(0, 5).map((b) => b.value)).toEqual(["1", "2", "3", "4", "5"]);
    expect(stars.slice(0, 5).every((b) => b.style === undefined)).toBe(true);
    expect(stars[5]?.style).toBe("danger");
    const route = String(stars[0]?.action_id).replace(/:approve:1$/, "");
    expect(stars.slice(0, 5).every((b) => b.action_id.startsWith(`${route}:approve`))).toBe(true);
    expect(stars[5]?.action_id).toBe(`${route}:deny`);
    const ctx = deploy?.blocks?.find((b) => b.type === "context") as
      | { elements: { text: string }[] }
      | undefined;
    expect(ctx?.elements[0]?.text).toContain(`${DEFAULT_RATING}★ is what a plain Approve sends`);
    // Ana rates 4: the message edits in place while pending, naming her.
    await slack.click(String(stars[3]?.action_id), "U_ANA");
    await wait(100);
    const pendingUpdate = [...slack.updates].reverse().find((u) => u.text.includes("deploy"));
    const pendingCtx = pendingUpdate?.blocks?.find((b) => b.type === "context") as
      | { elements: { text: string }[] }
      | undefined;
    expect(pendingCtx?.elements[0]?.text).toContain("Ana rated 4");
    expect(pendingUpdate?.blocks?.some((b) => b.type === "actions")).toBe(true);
    await slack.click(String(stars[4]?.action_id), "U_DEE");
    await wait(500);
    const deployed = Object.values(a.session.state().approvals).find(
      (x) => x.call.risk === "irreversible",
    );
    expect(deployed?.status).toBe("granted");
    expect(Object.keys(deployed?.votes ?? {}).sort()).toEqual(["ana", "dee"]);
    expect(deployed?.ballots.ana?.rating).toBe(4);
    expect(deployed?.ballots.dee?.rating).toBe(5);
    const result = [...slack.updates].reverse().find((u) => u.text.includes("`deploy` *granted*"));
    expect(result?.text).toBe(
      ":white_check_mark: `deploy` *granted* · Ana 4, Dee 5 · average 4.5 of 4 needed _(edited)_",
    );
    await adapter.flushAll();
    const thread = slack.posts
      .filter((p) => p.threadTs === root?.ts)
      .map((p) => p.text)
      .join("\n");
    expect(thread).toContain("Bo* [steer/goal]");
    expect(thread).toContain("turn 1");
    expect(thread).toContain("*Ana's agent* joins the circle.");

    // Fleet contention: Bo's session claims what Ana's holds; management gets both sides as
    // fields and "X wins" buttons, none primary; Dee resolves from Slack and the message edits.
    const b = host.session("s-bo", { title: "Tax lines", ownerId: "bo" });
    b.session.join("main", { id: "bo", kind: "human", name: "Bo" }, "owner");
    const verdict = host.project.claim(
      "s-bo",
      { type: "path", pattern: "PLAN.md" },
      "exclusive",
      "want it",
    );
    expect(verdict.granted).toBe(false);
    await wait(20);
    const mgmt = slack.posts.find((p) => p.channel === "C_MGMT" && p.text.includes("*Contention*"));
    expect(mgmt).toBeDefined();
    expect(mgmt?.text).toContain("between *Ana* and *Bo*");
    expect(mgmt?.text).toContain("<https://henosis.example.com/#/p/billing|Open the project>");
    const sides = mgmt?.blocks?.find((bl) => Array.isArray(bl.fields)) as
      | { fields: { text: string }[] }
      | undefined;
    expect(sides?.fields.map((f) => f.text.split("\n")[0])).toEqual([
      "*Ana · Doubling helper*",
      "*Bo · Tax lines*",
    ]);
    expect(buttons(mgmt).every((e) => e.style === undefined)).toBe(true);
    const resolveId = String(buttons(mgmt).find((e) => e.value === "s-bo")?.action_id);
    await slack.click(resolveId, "U_DEE");
    expect(host.state().contentions[verdict.contentionId ?? ""]?.resolved).toBe(true);
    expect(host.state().contentions[verdict.contentionId ?? ""]?.winnerSessionId).toBe("s-bo");
    const resolved = slack.updates.find((u) => u.ts === mgmt?.ts);
    expect(resolved?.text).toContain(
      "*Dee* resolved it: *Bo wins*. Ana's claims on `path:PLAN.md` release.",
    );
    expect(resolved?.text).toContain("_(edited)_");

    // Memory conflict between two engineers reaches management with "X is right" buttons.
    const memory = server.memory("nw");
    memory.remember({
      scope: { orgId: "nw" },
      key: "db",
      content: "Postgres",
      attribution: { userId: "ana", userName: "Ana" },
    });
    const r = memory.remember({
      scope: { orgId: "nw" },
      key: "db",
      content: "Cockroach",
      attribution: { userId: "bo", userName: "Bo" },
    });
    await wait(20);
    const mc = slack.posts.find(
      (p) => p.channel === "C_MGMT" && p.text.includes("Team memory disagrees"),
    );
    expect(mc?.text).toContain("*Ana* says");
    const winId = String(buttons(mc).find((e) => e.text.text.startsWith("Ana"))?.action_id);
    await slack.click(winId, "U_DEE");
    expect(memory.state().conflicts[r.conflictId ?? ""]?.winnerId).toBeDefined();
    expect(memory.state().conflicts[r.conflictId ?? ""]?.resolved).toBe(true);
    const settled = slack.updates.find((u) => u.ts === mc?.ts);
    expect(settled?.text).toContain("*Dee* settled `db`: *Ana* is right. _(edited)_");

    // Slash commands: the brief opens with the "now" sentence, then the fleet brief.
    const brief = await slack.slash("/henosis", "brief billing", "U_DEE", "C_MGMT");
    expect(brief[0]).toMatch(/^\*Billing, now\.\* 2 sessions open/);
    expect(brief[0]).toContain("Fleet brief");
    const sessions = await slack.slash("/henosis", "sessions billing", "U_DEE", "C_MGMT");
    expect(sessions[0]).toContain("Ana: Doubling helper");
    expect(sessions[0]).toContain("<https://henosis.example.com/#/p/billing/s/s-ana|open>");
  });

  it("a bare Approve under a release gate sends DEFAULT_RATING, the same vote the app sends", async () => {
    const host = server.project("billing");
    const s = host.session("s-rate", { title: "Rate me", ownerId: "ana" });
    s.session.join("main", { id: "ana", kind: "human", name: "Ana" }, "owner");
    s.session.join("main", { id: "bo", kind: "human", name: "Bo" }, "contributor");
    s.session.directive("main", "ana", { text: "Build a tiny helper and deploy it" });
    void s.drive("main");
    for (let i = 0; i < 100 && !Object.values(s.session.state().approvals).length; i++)
      await wait(50);
    const exec = Object.values(s.session.state().approvals).find((x) => x.status === "pending");
    expect(exec?.call.risk).toBe("exec");
    s.session.vote("main", "bo", exec?.id ?? "", "approve");
    void s.drive("main");
    for (
      let i = 0;
      i < 100 &&
      !Object.values(s.session.state().approvals).some(
        (x) => x.call.risk === "irreversible" && x.status === "pending",
      );
      i++
    )
      await wait(50);
    const gate = Object.values(s.session.state().approvals).find(
      (x) => x.call.risk === "irreversible",
    );
    expect(gate?.status).toBe("pending");
    // A press from an older Approve/Deny message carries no value: the adapter sends 4.
    await slack.press(`vote:billing:s-rate:${gate?.id}:approve`, "", "U_ANA");
    expect(s.session.state().approvals[gate?.id ?? ""]?.ballots.ana?.rating).toBe(DEFAULT_RATING);
    expect(DEFAULT_RATING).toBe(4);
    // A star carries its number in the value; the sixth segment of the action_id is not read.
    await slack.press(`vote:billing:s-rate:${gate?.id}:approve:1`, "5", "U_BO");
    expect(s.session.state().approvals[gate?.id ?? ""]?.ballots.bo?.rating).toBe(5);
    expect(s.session.state().approvals[gate?.id ?? ""]?.status).toBe("granted");
  });

  it("a plan waits for a rating with five stars; a star approves it and the message edits in place", async () => {
    const host = server.project("billing");
    const s = host.session("s-plan", {
      title: "Plan first",
      ownerId: "ana",
      policy: { planFirst: true },
    });
    s.session.join("main", { id: "ana", kind: "human", name: "Ana" }, "owner");
    s.session.directive("main", "ana", { text: "Build a ledger" });
    void s.drive("main");
    for (let i = 0; i < 100 && !s.session.state().activePlanId; i++) await wait(50);
    await wait(50);
    const planId = s.session.state().activePlanId ?? "";
    const post = slack.posts.find((p) => p.text.includes("*A plan waits for your rating*"));
    expect(post?.text).toContain("in Ana's session: 2 steps");
    const stars = slack.buttonsOf(`plan:billing:s-plan:${planId}`);
    expect(stars.map((b) => b.text)).toEqual(["1★", "2★", "3★", "4★", "5★"]);
    expect(stars.map((b) => b.value)).toEqual(["1", "2", "3", "4", "5"]);
    await slack.click(String(stars[3]?.actionId), "U_ANA");
    for (let i = 0; i < 100 && s.session.state().plans[planId]?.status === "proposed"; i++)
      await wait(50);
    expect(s.session.state().plans[planId]?.ratings.ana?.rating).toBe(4);
    expect(s.session.state().plans[planId]?.status).toBe("approved");
    const edited = [...slack.updates].reverse().find((u) => u.ts === post?.ts);
    expect(edited?.text).toBe(":white_check_mark: The plan is *approved* (Ana 4). _(edited)_");
    expect(edited?.blocks?.some((b) => b.type === "actions")).toBe(false);
  });

  it("answers a mention in the team channel as the owner's agent, edited into the answer, with Remember for the team", async () => {
    // Ana's newest session that can answer (idle or running; not one parked at an approval).
    const host = server.project("billing");
    const s = host.session("s-chat", { title: "Chat helper", ownerId: "ana" });
    s.session.join("main", { id: "ana", kind: "human", name: "Ana" }, "owner");
    s.session.directive("main", "ana", { text: "Build a doubling helper" });
    void s.drive("main");
    for (let i = 0; i < 100 && !Object.values(s.session.state().approvals).length; i++)
      await wait(50);
    const exec = Object.values(s.session.state().approvals)[0];
    s.session.vote("main", "ana", exec?.id ?? "", "approve");
    void s.drive("main");
    for (let i = 0; i < 100 && s.session.state().status !== "idle"; i++) await wait(50);
    const ts = await slack.say("C_TEAM", "U_BO", "@Ana's agent what is the goal?");
    const placeholder = slack.posts.find((p) => p.channel === "C_TEAM" && p.threadTs === ts);
    expect(placeholder?.as).toBe("Ana's agent");
    // The fake edits posts in place, as Slack does: the placeholder is gone once answered.
    for (let i = 0; i < 100 && !slack.updates.some((u) => u.ts === placeholder?.ts); i++)
      await wait(50);
    const answer = slack.updates.find((u) => u.ts === placeholder?.ts);
    expect(answer?.text).toMatch(/^\*Ana's agent\* answered Bo in <#C_TEAM>: /);
    const remember = (answer?.blocks ?? [])
      .filter((b) => b.type === "actions")
      .flatMap((b) => b.elements as ButtonEl[])
      .find((b) => b.text.text === "Remember for the team");
    expect(remember?.action_id).toBe(`memory.add:${placeholder?.ts}`);
    await adapter.flushAll();
    const rootTs = slack.posts.find(
      (p) => p.channel === "C_PROJ" && !p.threadTs && p.text.includes("_Chat helper_"),
    )?.ts;
    expect(
      slack.posts.some(
        (p) => p.threadTs === rootTs && p.text.includes("*Ana's agent* answered Bo in <#C_TEAM>."),
      ),
    ).toBe(true);
    await slack.click(String(remember?.action_id), "U_BO");
    const kept = Object.values(server.memory("nw").state().entries).find((e) =>
      e.tags.includes("slack"),
    );
    expect(kept?.attribution.userId).toBe("bo");
    expect(kept?.scope.projectId).toBe("billing");
    // Nobody home: the thread says so.
    const none = await slack.say("C_TEAM", "U_BO", "@Zed's agent anyone?");
    expect(slack.posts.find((p) => p.threadTs === none)?.text).toBe(
      "No session of Zed's is running.",
    );
  });

  it("renders the daily brief from the ledger and posts it to management", async () => {
    const r = adapter.renderBrief("billing");
    expect(r.blocks[0]).toEqual({
      type: "header",
      text: { type: "plain_text", text: "Billing · Tuesday" },
    });
    expect(r.text).toMatch(/^\*Billing · Tuesday\* · \d open sessions across 1 project/);
    const texts = r.blocks.map((b) => JSON.stringify(b));
    expect(texts.some((t) => t.includes("*Needs you*"))).toBe(true);
    expect(
      texts.some((t) => t.includes("*Sessions*") && t.includes("*Ana* · _Doubling helper_")),
    ).toBe(true);
    const fieldsBlock = r.blocks.find((b) => Array.isArray(b.fields)) as {
      fields: { text: string }[];
    };
    expect(fieldsBlock.fields.map((f) => f.text.split("\n")[0])).toEqual([
      "*Tokens*",
      "*Plans*",
      "*Release gates*",
      "*Crews*",
    ]);
    const actions = buttons(r);
    expect(actions[0]?.text.text).toBe("Open the overview");
    expect(actions[0]?.style).toBe("primary");
    expect((actions[0] as { url?: string }).url).toBe("https://henosis.example.com/#/p/billing");
    const input = adapter.briefInput("billing");
    expect(actions.slice(1).map((b) => b.text.text)).toEqual([
      `Approvals · ${input.approvalsWaiting}`,
      `Contentions · ${input.contentionsOpen}`,
    ]);
    const posted = await adapter.postBrief("billing");
    expect(posted?.channel).toBe("C_MGMT");
    expect(slack.posts.find((p) => p.ts === posted?.ts)?.text).toBe(r.text);
  });
});
