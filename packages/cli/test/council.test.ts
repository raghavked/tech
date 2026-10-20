import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Chat, type ChatDirectory, type CouncilMember } from "@henosis/chat";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  councilSection,
  isChatLog,
  loadChat,
  renderChatReport,
  renderCouncil,
  renderCouncilList,
} from "../src/council.js";

const people: Record<string, string> = { ana: "Ana", bo: "Bo", dee: "Dee" };
const profiles: Record<string, { name: string; ownerId: string | null }> = {
  "agent:ana": { name: "Ana's agent", ownerId: "ana" },
  "agent:bo": { name: "Bo's agent", ownerId: "bo" },
  "agent:dee": { name: "Dee's agent", ownerId: "dee" },
};
const directory: ChatDirectory = {
  person: (id) => (people[id] ? { id, name: people[id] as string } : null),
  agent: () => null,
  isLead: () => false,
  profile: (id) =>
    profiles[id] ? { id, ...(profiles[id] as { name: string; ownerId: string | null }) } : null,
};
const model = (profileId: string): CouncilMember => ({
  kind: "agent",
  userId: profiles[profileId]?.ownerId ?? null,
  profileId,
  name: profiles[profileId]?.name ?? profileId,
});
const usage = (n: number) => ({ input: n, output: n, cacheRead: 0, cacheWrite: 0 });

describe("henosis council and the report's Council section", () => {
  let root: string;
  let councilId: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "henosis-cli-council-"));
    let clock = 1_700_000_000_000;
    const chat = Chat.create("northwind", { directory, now: () => (clock += 60_000) });
    const g = chat.createGroup("dee", {
      name: "Invoice rollout",
      scope: { projectId: "billing" },
      members: [
        { kind: "human", userId: "ana" },
        { kind: "human", userId: "bo" },
      ],
    });
    const c = chat.convene("dee", g.id, {
      task: "Ship PDF invoices by Friday",
      members: [model("agent:dee"), model("agent:ana"), model("agent:bo")],
      budget: 50_000,
    });
    councilId = c.id;
    const individual = { round: "individual" as const, index: 0 };
    chat.startRound(c.id, individual);
    chat.said(c.id, individual, "agent:ana", {
      text: "Render from a template.",
      usage: usage(600),
    });
    chat.instruct("dee", c.id, "agent:bo", "Push for a batch job.");
    chat.said(c.id, individual, "agent:bo", {
      text: "A nightly batch job.",
      usage: usage(400),
      cites: [{ kind: "instruction", by: "dee" }],
    });
    chat.said(c.id, individual, "agent:dee", { text: "Measure first.", usage: usage(300) });
    const discussion = { round: "discussion" as const, index: 0 };
    chat.startRound(c.id, discussion);
    chat.said(c.id, discussion, "agent:bo", {
      text: "DIFFER. Inline rendering blocks the request.",
      stance: "differ",
      usage: usage(200),
    });
    const synthesis = { round: "synthesis" as const, index: 0 };
    chat.startRound(c.id, synthesis);
    chat.said(c.id, synthesis, "agent:dee", { text: "Two steps, one each.", usage: usage(500) });
    chat.synthesise(
      c.id,
      "pln_1",
      [
        {
          id: "s1",
          title: "Render the PDF",
          detail: "",
          estTokens: 2000,
          risk: "write",
          owner: model("agent:ana"),
        },
        {
          id: "s2",
          title: "Batch it nightly",
          detail: "",
          estTokens: 1500,
          risk: "exec",
          owner: model("agent:bo"),
        },
      ],
      [{ member: model("agent:bo"), text: "Rendering inline at all is the mistake." }],
    );
    chat.startRound(c.id, { round: "vote", index: 0 });
    chat.assign(c.id, "s1", "billing", "s-ana");
    chat.assign(c.id, "s2", "billing", "s-bo");
    chat.report(c.id, "s1", "done", "Rendered with the invoice template.", usage(900));
    chat.report(c.id, "s2", "blocked", "No cron on the box.", usage(100));
    chat.conclude(c.id, "done", "One step shipped, one waits on the box.");
    mkdirSync(join(root, "chat"), { recursive: true });
    writeFileSync(join(root, "chat", "northwind.json"), JSON.stringify(chat.log.serialize()));
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("prints a council's rounds, plan, work and conclusion with the dissent from the log", () => {
    const chat = loadChat(root, "northwind");
    const st = chat.state();
    const c = st.councils[councilId];
    if (!c) throw new Error("the council did not fold");
    const text = renderCouncil(st, c);
    expect(text).toContain("# Council: Ship PDF invoices by Friday");
    expect(text).toContain(
      "convened by Dee in Invoice rollout · chair Dee's agent · 3 models · rounds: individual, discussion, synthesis, vote · budget 50k tokens",
    );
    expect(text).toContain("status: concluded: done · 6k tokens");
    expect(text).toContain("- Dee's agent (dee's model, agent:dee) · chair");
    expect(text).toContain("- Dee to Bo's agent: Push for a batch job.");
    expect(text).toContain("## Round 1 · individual");
    expect(text).toContain("- Bo's agent: A nightly batch job. (800 tokens · instructed by Dee)");
    expect(text).toContain("## Round 2 · discussion 1 of 1");
    expect(text).toContain(
      "- Bo's agent [differ]: DIFFER. Inline rendering blocks the request. (400 tokens)",
    );
    expect(text).toContain("## Round 3 · synthesis");
    expect(text).toContain("### Plan pln_1");
    expect(text).toContain("1. Render the PDF — Ana's agent (write, ~2k tokens)");
    expect(text).toContain("- Bo's agent: Rendering inline at all is the mistake.");
    expect(text).toContain("## Round 4 · vote");
    expect(text).toContain(
      "- s1 Render the PDF → Ana's agent in billing/s-ana: done — Rendered with the invoice template. (1.8k tokens)",
    );
    expect(text).toContain(
      "- s2 Batch it nightly → Bo's agent in billing/s-bo: blocked — No cron on the box. (200 tokens)",
    );
    expect(text).toContain(
      "## Conclusion\n\ndone: One step shipped, one waits on the box.\n\nDissent on the record:\n\n- Bo's agent: Rendering inline at all is the mistake.\n6k tokens in all.",
    );
  });

  it("lists councils, reports a chat log, and gives a session report its Council section", () => {
    const chat = loadChat(root, "northwind");
    const st = chat.state();
    const list = renderCouncilList(st);
    expect(list).toContain(councilId);
    expect(list).toContain("concluded: done");
    expect(list).toContain("Invoice rollout · Ship PDF invoices by Friday · 3 models · 6k tokens");

    expect(isChatLog(chat.log.serialize())).toBe(true);
    expect(
      isChatLog({ version: 1, branches: [], events: { main: [{ kind: "session.created" }] } }),
    ).toBe(false);
    const report = renderChatReport(chat);
    expect(report).toContain("# Chat report: northwind");
    expect(report).toContain("- Invoice rollout: 3 members, 0 messages");
    expect(report).toContain("1 group · 1 council");
    expect(report).toContain("## Council");
    expect(report).toContain("### Ship PDF invoices by Friday");
    expect(report).toContain("- individual: Ana's agent, Bo's agent, Dee's agent");
    expect(report).toContain("- discussion 1 of 1: Bo's agent [differ]");
    expect(report).toContain(
      "- plan pln_1: Render the PDF (Ana's agent); Batch it nightly (Bo's agent)",
    );
    expect(report).toContain("- dissent, Bo's agent: Rendering inline at all is the mistake.");
    expect(report).toContain("- concluded: done — One step shipped, one waits on the box.");

    // A session's report carries only the councils whose work ran in it.
    expect(councilSection(st, "s-ana")).toContain("### Ship PDF invoices by Friday");
    expect(councilSection(st, "s-nobody")).toBe("");
  });
});
