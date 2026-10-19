import { DEFAULT_RATING } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import {
  approvalDecided,
  approvalRequested,
  contentionOpened,
  type DailyBriefInput,
  dailyBrief,
  joinLine,
  mentionPlaceholder,
  mentionReply,
  planProposed,
  sessionStarted,
  teamSummary,
} from "../src/templates.js";

type Btn = {
  action_id: string;
  value?: string;
  style?: string;
  url?: string;
  text: { text: string };
};
const buttonsOf = (blocks: { type: string; elements?: unknown }[]) =>
  blocks.filter((b) => b.type === "actions").flatMap((b) => b.elements as Btn[]);

const gate = { ratings: { min: 2, average: 4, of: "contributor" as const } };
const base = {
  projectId: "payments",
  sessionId: "s_7f2",
  approvalId: "ap_19",
  owner: "Ana",
  call: { name: "git push", risk: "irreversible" as const, args: { remote: "origin pdf-layout" } },
  url: "https://henosis.example.com/#/p/payments/s/s_7f2",
};

describe("slack templates", () => {
  it("01 · the session root is the sentence, the context line and the link last", () => {
    const r = sessionStarted({
      owner: "Ana",
      title: "Invoice PDF: tax lines and proration",
      project: "Payments",
      url: "https://henosis.example.com/#/p/payments/s/s_7f2",
      planFirst: true,
      crew: "Invoice rollout",
      driver: "Ana",
      budget: 600_000,
    });
    expect(r.text).toBe(
      ":henosis: *Ana's agent* started _Invoice PDF: tax lines and proration_ in Payments. Reply in this thread to steer it. <https://henosis.example.com/#/p/payments/s/s_7f2|Open in Henosis>",
    );
    expect(r.blocks.map((b) => b.type)).toEqual(["section", "context"]);
    expect(JSON.stringify(r.blocks[1])).toContain(
      "plan first · crew _Invoice rollout_ · Ana has the baton · budget 600k",
    );
    expect(joinLine("Dee", true)).toBe(":henosis: *Dee's agent* joins the circle.");
    expect(joinLine("Bo", false)).toBe("*Bo* joins the circle.");
  });

  it("02 · a release gate is five stars with the rating in the value, none primary, Deny in danger", () => {
    const r = approvalRequested({ ...base, rule: gate });
    expect(r.text).toBe(
      ":raised_hand: *Approval needed* in Ana's session: `git push` [irreversible] origin pdf-layout. Needs 2 contributors or above rating it 4+ of 5 on average. <https://henosis.example.com/#/p/payments/s/s_7f2|Review in Henosis>",
    );
    const b = buttonsOf(r.blocks);
    expect(b.map((x) => x.text.text)).toEqual(["1★", "2★", "3★", "4★", "5★", "Deny"]);
    expect(b.map((x) => x.value)).toEqual(["1", "2", "3", "4", "5", ""]);
    expect(b.map((x) => x.style)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "danger",
    ]);
    // One route under every star; the trailing segment only keeps Slack's action_ids unique.
    expect(b.slice(0, 5).map((x) => x.action_id)).toEqual(
      [1, 2, 3, 4, 5].map((n) => `vote:payments:s_7f2:ap_19:approve:${n}`),
    );
    expect(new Set(b.map((x) => x.action_id)).size).toBe(6);
    expect(JSON.stringify(r.blocks[1])).toContain(
      `${DEFAULT_RATING}★ is what a plain Approve sends`,
    );
    // Votes so far ride in the context line while the gate is pending.
    const pending = approvalRequested({
      ...base,
      rule: gate,
      ballots: [{ name: "Bo", vote: "approve", rating: 4, note: "" }],
    });
    expect(JSON.stringify(pending.blocks[1])).toContain("Bo rated 4");
  });

  it("02 · a plain rule shows Approve and Deny, nothing more", () => {
    const r = approvalRequested({
      ...base,
      call: { name: "rm -rf dist/", risk: "exec", args: {} },
      rule: "contributor",
    });
    const b = buttonsOf(r.blocks);
    expect(b.map((x) => [x.text.text, x.style, x.value])).toEqual([
      ["Approve", "primary", ""],
      ["Deny", "danger", ""],
    ]);
    expect(b[0]?.action_id).toBe("vote:payments:s_7f2:ap_19:approve");
  });

  it("02 · the decision edits the message: raters, ratings, the average and the bar, (edited)", () => {
    const granted = approvalDecided({
      call: { name: "git push" },
      status: "granted",
      rule: gate,
      ballots: [
        { name: "Bo", vote: "approve", rating: 4, note: "" },
        { name: "Cy", vote: "approve", rating: 5, note: "" },
      ],
      url: base.url,
    });
    expect(granted.text).toBe(
      ":white_check_mark: `git push` *granted* · Bo 4, Cy 5 · average 4.5 of 4 needed _(edited)_",
    );
    expect(buttonsOf(granted.blocks)).toEqual([]);
    const denied = approvalDecided({
      call: { name: "git push" },
      status: "denied",
      rule: gate,
      ballots: [
        { name: "Dee", vote: "deny", rating: null, note: "Not before the tax lines ship." },
      ],
      url: null,
    });
    expect(denied.text).toBe(
      ':x: `git push` *denied* · Dee: "Not before the tax lines ship." · The agent waits for a steer. _(edited)_',
    );
  });

  it("02b · a plan is rated with the same five stars", () => {
    const r = planProposed({
      projectId: "payments",
      sessionId: "s_7f2",
      planId: "plan_1",
      owner: "Ana",
      goal: "Invoice PDF",
      steps: [
        { title: "Write invoice.ts", risk: "write", estTokens: 600 },
        { title: "Run the tests", risk: "exec", estTokens: 900 },
      ],
      estTokens: 1500,
      min: 1,
      average: 3,
      url: null,
    });
    expect(r.text).toBe(
      ":clipboard: *A plan waits for your rating* in Ana's session: 2 steps, about 1.5k tokens, for _Invoice PDF_.",
    );
    expect(buttonsOf(r.blocks).map((b) => [b.action_id, b.value])).toEqual(
      [1, 2, 3, 4, 5].map((n) => [`plan:payments:s_7f2:plan_1:${n}`, String(n)]),
    );
  });

  it("03 · a contention has both sides as fields and no primary button", () => {
    const r = contentionOpened({
      projectId: "payments",
      contentionId: "ct_8",
      kind: "claim",
      resource: "path:apps/web/src/views/Billing.tsx",
      detail: "Both sessions edit the Billing page.",
      sides: [
        {
          sessionId: "s_7f2",
          owner: "Ana",
          title: "Invoice PDF",
          status: "running",
          turn: 3,
          tokens: 112_000,
          holds: ["Billing.tsx"],
        },
        {
          sessionId: "s_9c1",
          owner: "Bo",
          title: "Invoice history",
          status: "blocked",
          turn: 2,
          tokens: 61_000,
          holds: [],
        },
      ],
      waitsOn: "a lead",
      url: "https://henosis.example.com/#/p/payments",
    });
    expect(r.text).toBe(
      ":warning: *Contention* (claim) on `path:apps/web/src/views/Billing.tsx` between *Ana* and *Bo*. Both sessions edit the Billing page. <https://henosis.example.com/#/p/payments|Open the project>",
    );
    const fields = (r.blocks[1] as { fields: { text: string }[] }).fields;
    expect(fields[0]?.text).toBe(
      "*Ana · Invoice PDF*\nrunning · turn 3 · 112k tokens · holds `Billing.tsx`",
    );
    const b = buttonsOf(r.blocks);
    expect(b.map((x) => [x.text.text, x.action_id, x.style])).toEqual([
      ["Ana wins", "resolve:payments:ct_8:s_7f2", undefined],
      ["Bo wins", "resolve:payments:ct_8:s_9c1", undefined],
    ]);
  });

  it("04 · a mention reply speaks as the owner's agent with the cost in the context line", () => {
    expect(mentionPlaceholder("Ana").text).toBe("_Reading…_ *Ana's agent* is looking.");
    const r = mentionReply({
      owner: "Ana",
      title: "Invoice PDF",
      asker: "Cy",
      channel: "#billing",
      answer: "Proration credits the old plan's unused days as a line.",
      tokens: 1200,
      url: null,
      rememberActionId: "memory.add:1.2",
      rememberValue: "1.2",
    });
    expect(r.text).toBe(
      "*Ana's agent* answered Cy in #billing: Proration credits the old plan's unused days as a line.",
    );
    expect(JSON.stringify(r.blocks[1])).toContain(
      "from _Invoice PDF_ · steered as `chat` · 1.2k tokens",
    );
    expect(buttonsOf(r.blocks).map((b) => b.text.text)).toEqual(["Remember for the team"]);
  });

  it("05 · the brief opens with the team sentence; a quiet morning is one line and no buttons", () => {
    expect(teamSummary(3, 2, "2 running, 1 awaiting approval", 2)).toBe(
      "3 open sessions across 2 projects: 2 running, 1 awaiting approval. 2 things need you.",
    );
    expect(teamSummary(0, 1, "", 0)).toBe(
      "0 open sessions across 1 project. Nothing needs you right now.",
    );
    const quiet: DailyBriefInput = {
      projectId: "payments",
      project: "Payments",
      weekday: "Tuesday",
      seq: 41,
      open: 2,
      counts: "2 paused",
      needs: [],
      sessions: [
        { owner: "Bo", title: "History", status: "paused", turn: 3, tokens: 61_000, crew: null },
        { owner: "Cy", title: "Checkout", status: "paused", turn: 5, tokens: 93_000, crew: null },
      ],
      tokens: 154_000,
      budget: null,
      plans: { approved: 1, waiting: 0, average: 4 },
      gates: { granted: 0, waiting: 0 },
      crews: [],
      direction: null,
      approvalsWaiting: 0,
      contentionsOpen: 0,
      url: "https://henosis.example.com/#/p/payments",
    };
    const r = dailyBrief(quiet);
    expect(r.blocks).toHaveLength(1);
    expect(r.text).toBe(
      "*Payments · Tuesday* · 2 open sessions across 1 project: 2 paused. Nothing needs you right now. 154k tokens so far.",
    );
    const busy = dailyBrief({
      ...quiet,
      needs: [
        {
          line: "`git push` in *Ana*'s session waits for one rating at 4+",
          url: quiet.url,
          action: "Rate it",
        },
      ],
      approvalsWaiting: 1,
    });
    expect(busy.blocks.map((b) => b.type)).toEqual([
      "header",
      "section",
      "section",
      "section",
      "section",
      "context",
      "actions",
    ]);
    expect(JSON.stringify(busy.blocks[2])).toContain(
      "• `git push` in *Ana*'s session waits for one rating at 4+ · <https://henosis.example.com/#/p/payments|Rate it>",
    );
    expect(buttonsOf(busy.blocks).map((b) => b.text.text)).toEqual([
      "Open the overview",
      "Approvals · 1",
      "Contentions · 0",
    ]);
  });
});
