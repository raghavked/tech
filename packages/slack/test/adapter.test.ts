import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultTools, ScriptedModel } from "@tiller/runner";
import { TillerServer } from "@tiller/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SlackAdapter } from "../src/adapter.js";
import { FakeSlackClient } from "../src/client.js";

type ButtonEl = { action_id: string; value?: string; text: { text: string } };
function buttons(
  post: { blocks?: { type: string; elements?: unknown }[] } | undefined,
): ButtonEl[] {
  const actions = post?.blocks?.find((b) => b.type === "actions");
  return (actions?.elements as ButtonEl[] | undefined) ?? [];
}

describe("slack adapter", () => {
  let root: string;
  let server: TillerServer;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "tiller-slack-"));
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
    server = new TillerServer({ root, model: new ScriptedModel(), tools: defaultTools() });
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("threads a session, posts approvals as buttons, votes from a click, steers from a reply, escalates contentions and memory conflicts", async () => {
    const slack = new FakeSlackClient();
    const adapter = new SlackAdapter({
      server,
      client: slack,
      map: {
        teams: { pay: "C_TEAM" },
        projects: { billing: "C_PROJ" },
        management: "C_MGMT",
        users: { U_DEE: "dee", U_BO: "bo", U_ANA: "ana" },
      },
      coalesceMs: 0,
    });
    adapter.watchProject("billing");
    const host = server.project("billing");
    host.project.join("dee", "Dee", "lead");
    host.project.join("bo", "Bo", "member");
    const a = host.session("s-ana", { title: "Doubling helper", ownerId: "ana" });
    a.session.join("main", { id: "ana", kind: "human", name: "Ana" }, "owner");
    await new Promise((r) => setTimeout(r, 20));
    const root = slack.posts.find((p) => p.channel === "C_PROJ" && !p.threadTs);
    expect(root?.text).toContain("Ana's agent");

    // Steering from a thread reply as Bo (contributor via users.json).
    await slack.reply(
      "C_PROJ",
      root?.ts ?? "",
      "U_BO",
      "[goal] Build a doubling helper and deploy it",
    );
    await new Promise((r) => setTimeout(r, 300));
    const st = a.session.state();
    expect(st.intent.goal?.text).toBe("Build a doubling helper and deploy it");
    expect(st.participants.bo?.role).toBe("contributor");
    // The agent asked for an exec approval: a button message in the thread.
    const approval = slack.posts.find(
      (p) => p.threadTs === root?.ts && (p.blocks ?? []).some((b) => b.type === "actions"),
    );
    expect(approval?.text).toContain("Approval needed");
    const approveId = String(buttons(approval)[0]?.action_id);
    await slack.click(approveId, "U_BO");
    await new Promise((r) => setTimeout(r, 400));
    const granted = Object.values(a.session.state().approvals).find((x) => x.call.risk === "exec");
    expect(granted?.status).toBe("granted");
    expect(granted?.votes.bo).toBe("approve");
    expect(slack.updates.some((u) => u.text.includes("granted"))).toBe(true);
    // Deploy needs two drivers; it is broadcast to the channel, and Ana (owner) plus Dee (lead) approve from Slack.
    const deploy = [...slack.posts]
      .reverse()
      .find((p) => p.text.includes("deploy") && (p.blocks ?? []).some((b) => b.type === "actions"));
    expect(deploy?.broadcast).toBe(true);
    const deployApprove = String(buttons(deploy)[0]?.action_id);
    await slack.click(deployApprove, "U_ANA");
    await slack.click(deployApprove, "U_DEE");
    await new Promise((r) => setTimeout(r, 500));
    const deployed = Object.values(a.session.state().approvals).find(
      (x) => x.call.risk === "irreversible",
    );
    expect(deployed?.status).toBe("granted");
    expect(Object.keys(deployed?.votes ?? {}).sort()).toEqual(["ana", "dee"]);
    await adapter.flushAll();
    const thread = slack.posts
      .filter((p) => p.threadTs === root?.ts)
      .map((p) => p.text)
      .join("\n");
    expect(thread).toContain("Bo* [steer/goal]");
    expect(thread).toContain("turn 1");

    // Fleet contention: Bo's session claims what Ana's holds; management gets buttons; Dee resolves from Slack.
    const b = host.session("s-bo", { title: "Tax lines", ownerId: "bo" });
    b.session.join("main", { id: "bo", kind: "human", name: "Bo" }, "owner");
    const verdict = host.project.claim(
      "s-bo",
      { type: "path", pattern: "PLAN.md" },
      "exclusive",
      "want it",
    );
    expect(verdict.granted).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    const mgmt = slack.posts.find(
      (p) => p.channel === "C_MGMT" && p.text.includes("Fleet contention"),
    );
    expect(mgmt).toBeDefined();
    const resolveId = String(buttons(mgmt).find((e) => e.value === "s-bo")?.action_id);
    await slack.click(resolveId, "U_DEE");
    expect(host.state().contentions[verdict.contentionId ?? ""]?.resolved).toBe(true);
    expect(host.state().contentions[verdict.contentionId ?? ""]?.winnerSessionId).toBe("s-bo");

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
    await new Promise((res) => setTimeout(res, 20));
    const mc = slack.posts.find(
      (p) => p.channel === "C_MGMT" && p.text.includes("memory conflict"),
    );
    expect(mc?.text).toContain("Ana says");
    const winId = String(buttons(mc).find((e) => e.text.text.startsWith("Ana"))?.action_id);
    await slack.click(winId, "U_DEE");
    expect(memory.state().conflicts[r.conflictId ?? ""]?.winnerId).toBeDefined();
    expect(memory.state().conflicts[r.conflictId ?? ""]?.resolved).toBe(true);

    // Slash commands.
    const brief = await slack.slash("/tiller", "brief billing", "U_DEE", "C_MGMT");
    expect(brief[0]).toContain("Fleet brief");
    const sessions = await slack.slash("/tiller", "sessions billing", "U_DEE", "C_MGMT");
    expect(sessions[0]).toContain("Ana: Doubling helper");
  });
});
