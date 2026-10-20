import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CouncilMember } from "@henosis/chat";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { HenosisServer } from "@henosis/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SlackAdapter } from "../src/adapter.js";
import { FakeSlackClient } from "../src/client.js";
import { councilRateRoute } from "../src/councilTemplates.js";

type ButtonEl = { action_id: string; value?: string; style?: string; text: { text: string } };
function buttons(
  post: { blocks?: { type: string; elements?: unknown }[] } | undefined,
): ButtonEl[] {
  const actions = post?.blocks?.find((b) => b.type === "actions");
  return (actions?.elements as ButtonEl[] | undefined) ?? [];
}
const sectionTexts = (
  post: { blocks?: { type: string; text?: { text?: string } }[] } | undefined,
) => (post?.blocks ?? []).filter((b) => b.type === "section").map((b) => b.text?.text ?? "");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const usage = (n: number) => ({ input: n, output: n, cacheRead: 0, cacheWrite: 0 });

describe("the council in Slack", () => {
  let root: string;
  let server: HenosisServer;
  let slack: FakeSlackClient;
  let adapter: SlackAdapter;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "henosis-slack-council-"));
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
          {
            id: "dee",
            name: "Dee",
            slackId: "U_DEE",
            teams: [{ teamId: "pay", role: "manager" }],
            agent: { provider: "scripted" },
          },
          { id: "ana", name: "Ana", projects: [{ projectId: "billing", role: "member" }] },
          {
            id: "bo",
            name: "Bo",
            projects: [{ projectId: "billing", role: "member" }],
            agent: { id: "bo-reviewer", name: "Bo's reviewer", provider: "scripted" },
          },
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
    });
    adapter.watchProject("billing");
    const host = server.project("billing");
    host.project.join("dee", "Dee", "lead");
    host.project.join("ana", "Ana", "member");
    host.project.join("bo", "Bo", "member");
  });
  afterAll(async () => {
    await wait(60);
    await adapter.stop();
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("convenes from /henosis council, posts every round into the group's thread with the member and model named, rates the chair's plan from a star, and concludes with the dissent", async () => {
    const chat = server.chat("nw").chat;
    // This test drives every round by hand to check what the bridge posts for each event; the
    // server's own council host stands down for this organisation, or it would run the council.
    server.council("nw").close();
    const group = chat.createGroup("dee", {
      name: "Invoice rollout",
      scope: { projectId: "billing" },
      members: [
        { kind: "human", userId: "ana" },
        { kind: "human", userId: "bo" },
      ],
    });

    // A group nobody knows is an error the asker sees; so is a convener outside the group.
    expect(await slack.slash("/henosis", "council nowhere Ship it", "U_DEE", "C_PROJ")).toEqual([
      "error: no group named nowhere",
    ]);
    expect(
      (await slack.slash("/henosis", "council invoice-rollout Ship it", "U_CY", "C_PROJ"))[0],
    ).toContain("is not a member of Invoice rollout");

    // The convener names the group by name (dashes for spaces) and the task is the rest.
    const out = await slack.slash(
      "/henosis",
      "council invoice-rollout Ship PDF invoices by Friday",
      "U_DEE",
      "C_PROJ",
    );
    expect(out).toEqual([
      "Convened a council in _Invoice rollout_: 3 models, *Dee's agent* chairs. It runs in <#C_PROJ>.",
    ]);
    const council = Object.values(chat.state().councils)[0];
    if (!council) throw new Error("no council in the log");
    expect(council.groupId).toBe(group.id);
    expect(council.members.map((m) => m.profileId).sort()).toEqual([
      "agent:ana",
      "agent:dee",
      "bo-reviewer",
    ]);
    const member = (profileId: string): CouncilMember => {
      const m = council.members.find((x) => x.profileId === profileId);
      if (!m) throw new Error(`no member ${profileId}`);
      return m;
    };
    await adapter.council.settle();

    // The root message in the group's channel: who convened what, the roster with models.
    const rootPost = slack.posts.find((p) => p.channel === "C_PROJ" && !p.threadTs);
    expect(rootPost?.text).toContain(
      "*Dee* convened a council in _Invoice rollout_: Ship PDF invoices by Friday 3 models deliberate; *Dee's agent* chairs.",
    );
    expect(sectionTexts(rootPost)[1]).toBe(
      "• *Dee's agent* (scripted)\n• *Ana's agent* (scripted)\n• *Bo's reviewer* (scripted)",
    );
    expect(rootPost?.blocks?.map((b) => b.type)).toEqual(["section", "section", "context"]);
    const inThread = () => slack.posts.filter((p) => p.threadTs === rootPost?.ts);

    // The individual round: each word posts as the model, with its owner's agent and model named.
    const individual = { round: "individual" as const, index: 0 };
    chat.startRound(council.id, individual);
    chat.said(council.id, individual, "agent:ana", {
      text: "Render with the invoice template; first step is a fixture.",
      usage: usage(600),
    });
    chat.said(council.id, individual, "bo-reviewer", {
      text: "A batch job at night, not inline.",
      usage: usage(400),
      cites: [{ kind: "instruction", by: "dee" }],
    });
    chat.said(council.id, individual, "agent:dee", {
      text: "Either; measure first.",
      usage: usage(300),
    });
    await adapter.council.settle();
    expect(inThread()[0]?.text).toBe(
      ":speech_balloon: *Round: individual* · each of 3 models answers alone.",
    );
    const anaSaid = inThread()[1];
    expect(anaSaid?.as).toBe("Ana's agent");
    expect(anaSaid?.text).toBe(
      "*Ana's agent* (scripted): Render with the invoice template; first step is a fixture.",
    );
    const boSaid = inThread()[2];
    expect(boSaid?.text).toBe("*Bo's reviewer* (scripted): A batch job at night, not inline.");
    expect(JSON.stringify(boSaid?.blocks)).toContain("individual · 800 tokens · instructed by Dee");

    // The discussion: the stance is a word after the name.
    const discussion = { round: "discussion" as const, index: 0 };
    chat.startRound(council.id, discussion);
    chat.said(council.id, discussion, "bo-reviewer", {
      text: "DIFFER. Inline rendering blocks the request.",
      stance: "differ",
      usage: usage(200),
    });
    await adapter.council.settle();
    expect(inThread()[4]?.text).toBe(
      ":speech_balloon: *Round: discussion 1 of 1* · each model reads the others and replies.",
    );
    expect(inThread()[5]?.text).toBe(
      "*Bo's reviewer* (scripted) differs: DIFFER. Inline rendering blocks the request.",
    );

    // The chair's plan is a real plan in the chair's council session; the synthesis posts it
    // with the owners, the dissent and the five stars, broadcast to the channel.
    const host = server.project("billing");
    const sh = host.session("s-council", {
      title: "Council: Ship PDF invoices by Friday",
      ownerId: "dee",
      policy: { planFirst: true },
    });
    sh.session.join(
      "main",
      { id: "model:agent:dee", kind: "agent", name: "Dee's agent" },
      "contributor",
    );
    const proposed = sh.session.proposePlan("main", "model:agent:dee", {
      goal: "Ship PDF invoices by Friday",
      steps: [
        { id: "s1", title: "Render the PDF", detail: "", estTokens: 2000, risk: "write" },
        { id: "s2", title: "Batch it nightly", detail: "", estTokens: 1500, risk: "exec" },
      ],
      rationale: "Both answers, in order.",
    });
    if (proposed.kind !== "plan.proposed") throw new Error("no plan");
    const planId = proposed.payload.planId;
    await wait(30);
    const synthesis = { round: "synthesis" as const, index: 0 };
    chat.startRound(council.id, synthesis);
    chat.said(council.id, synthesis, "agent:dee", {
      text: "Two steps, one each.",
      usage: usage(500),
    });
    chat.synthesise(
      council.id,
      planId,
      [
        {
          id: "s1",
          title: "Render the PDF",
          detail: "",
          estTokens: 2000,
          risk: "write",
          owner: member("agent:ana"),
        },
        {
          id: "s2",
          title: "Batch it nightly",
          detail: "",
          estTokens: 1500,
          risk: "exec",
          owner: member("bo-reviewer"),
        },
      ],
      [{ member: member("bo-reviewer"), text: "Rendering inline at all is the mistake." }],
    );
    await adapter.council.settle();
    const plan = inThread().find((p) => (p.blocks ?? []).some((b) => b.type === "actions"));
    expect(plan?.broadcast).toBe(true);
    expect(plan?.text).toContain(
      "*The chair's plan waits for your rating*: *Dee's agent* proposes 2 steps, about 3.5k tokens, for _Ship PDF invoices by Friday_.",
    );
    expect(
      plan?.text?.endsWith("<https://henosis.example.com/#/p/billing/s/s-council|Open in Henosis>"),
    ).toBe(true);
    const texts = sectionTexts(plan);
    expect(texts[1]).toBe(
      "1. Render the PDF — *Ana's agent* (scripted) (write, ~2k)\n2. Batch it nightly — *Bo's reviewer* (scripted) (exec, ~1.5k)",
    );
    expect(texts[2]).toBe(
      "*Dissent* · *Bo's reviewer* (scripted): Rendering inline at all is the mistake.",
    );
    expect(JSON.stringify(plan?.blocks)).toContain("needs 1 rating at 3+ on average");
    const stars = buttons(plan);
    const route = councilRateRoute({ orgId: "nw", councilId: council.id, planId });
    expect(stars.map((b) => b.text.text)).toEqual(["1★", "2★", "3★", "4★", "5★"]);
    expect(stars.map((b) => b.action_id)).toEqual([1, 2, 3, 4, 5].map((n) => `${route}:${n}`));
    expect(stars.every((b) => b.style === undefined)).toBe(true);

    // A star rates the plan in the chair's session; the policy approves it; the message edits
    // in place: buttons gone, the result line in their place.
    await slack.click(`${route}:4`, "U_BO", plan?.ts);
    await wait(100);
    const record = sh.session.state().plans[planId];
    expect(record?.ratings.bo?.rating).toBe(4);
    expect(record?.status).toBe("approved");
    const edited = slack.posts.find((p) => p.ts === plan?.ts);
    expect(edited?.text).toContain(
      "*The council's plan is approved*: 2 steps for _Ship PDF invoices by Friday_. _(edited)_",
    );
    expect(buttons(edited)).toEqual([]);
    expect(JSON.stringify(edited?.blocks)).toContain("Bo rated 4");

    // Assignments and reports are lines in the thread; the conclusion carries the dissent.
    chat.assign(council.id, "s1", "billing", "s-ana");
    chat.assign(council.id, "s2", "billing", "s-bo");
    chat.report(council.id, "s1", "done", "Rendered with the invoice template.", usage(900));
    chat.report(council.id, "s2", "blocked", "No cron on the box.", usage(100));
    chat.conclude(council.id, "done", "One step shipped, one waits on the box.");
    await adapter.council.settle();
    const lines = inThread().map((p) => p.text);
    expect(lines).toContain(
      ":bookmark_tabs: *Ana's agent* (scripted) takes _Render the PDF_. <https://henosis.example.com/#/p/billing/s/s-ana|Open the session>",
    );
    expect(lines).toContain(
      ":white_check_mark: *Ana's agent* (scripted) reports _Render the PDF_ done: Rendered with the invoice template.",
    );
    expect(lines).toContain(
      ":no_entry: *Bo's reviewer* (scripted) is blocked on _Batch it nightly_: No cron on the box.",
    );
    const concluded = inThread()[inThread().length - 1];
    expect(concluded?.broadcast).toBe(true);
    expect(concluded?.text).toContain(
      ":checkered_flag: *The council concluded: done* on _Ship PDF invoices by Friday_. One step shipped, one waits on the box.",
    );
    expect(sectionTexts(concluded)[1]).toBe(
      "*Dissent* · *Bo's reviewer* (scripted): Rendering inline at all is the mistake.",
    );
    expect(JSON.stringify(concluded?.blocks)).toContain("1 of 2 steps done · 6k tokens");
    // A private instruction never reaches the channel.
    expect(slack.posts.some((p) => p.text.includes("instruct me"))).toBe(false);
  });
});
