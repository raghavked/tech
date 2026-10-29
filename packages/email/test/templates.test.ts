import { teamSummary as slackSummary } from "@henosis/slack";
import { describe, expect, it } from "vitest";
import {
  type DigestInput,
  digest,
  digestPreheader,
  digestSubject,
  gatesCount,
  invite,
  plansCount,
  teamSummary,
} from "../src/templates.js";

/** The email-digest board's Monday digest to Ana, lead of Payments, as data. */
const payments: DigestInput = {
  team: "Payments",
  lead: "Ana",
  range: "29 Sep – 5 Oct",
  cadence: "weekly",
  sentAt: "Mon 6 Oct, 08:00",
  summary: { open: 4, projects: 2, counts: "2 running, 1 awaiting approval, 1 blocked", needs: 3 },
  period: { tokens: 212_000, input: 148_000, output: 64_000, plansRated: 7, gates: 2 },
  needs: [
    {
      kind: "plan",
      label: "Plan · waiting on ratings",
      lead: "Bo's agent plans",
      thing: "Proration on plan change",
      tail: " in Billing page.",
      rule: "Policy: two ratings at 3+. Dee rated 4; one more voice and it starts. Est. 18k tokens.",
      votes: { have: ["Dee"], needed: 2 },
      age: null,
      action: {
        label: "Rate the plan",
        url: "https://app.example/#/p/billing/s/s1",
        primary: true,
      },
    },
    {
      kind: "gate",
      label: "Release gate · irreversible",
      lead: "Cy's agent wants to",
      thing: "publish the invoice PDF template",
      tail: " to production.",
      rule: "Rule 2 contributors at 4+. Dee approved with 4; waiting on a second vote.",
      votes: { have: ["Dee"], needed: 2 },
      age: null,
      action: { label: "Vote", url: "https://app.example/#/p/checkout/s/s2", primary: true },
    },
    {
      kind: "contention",
      label: "Contention · claim denied",
      lead: "Dee's agent and Cy's agent both claim",
      thing: "tax lines",
      tail: " in Checkout.",
      rule: "Both hold apps/checkout/tax.ts. Both owners were told; the lead resolves.",
      votes: null,
      age: "blocked 3 days",
      action: { label: "Resolve", url: "https://app.example/#/p/checkout", primary: false },
    },
  ],
  tokens: {
    againstPlans: -9,
    budget: { used: 74_000, budget: 100_000, label: "Checkout" },
    byProject: [
      { label: "Billing page", value: 138_000 },
      { label: "Checkout", value: 74_000, budget: 100_000 },
    ],
    byPerson: [
      { label: "Bo", sub: "2 agents", value: 86_000 },
      { label: "Cy", value: 58_000 },
      { label: "Dee", value: 41_000 },
      { label: "Ana", value: 27_000 },
    ],
    reading:
      "Billing page took two thirds of the week, most of it Invoice PDF layout (Bo's agent, 61k). Checkout is at 74% of its budget. Cache reads are not counted.",
  },
  plans: [
    {
      title: "Invoice PDF layout",
      context: "Bo's agent · Billing page",
      ratings: 3,
      average: 4.3,
      est: 44_000,
      actual: 61_000,
      status: "done",
    },
    {
      title: "Tax lines on the invoice",
      context: "Dee's agent · Checkout",
      ratings: 2,
      average: 4,
      est: 22_000,
      actual: 19_000,
      status: "approved",
    },
    {
      title: "Checkout tax rate lookup",
      context: "Cy's agent · Checkout",
      ratings: 2,
      average: 2.5,
      est: 30_000,
      actual: null,
      status: "revised",
      note: "asked to revise by Ana",
    },
    {
      title: "Proration on plan change",
      context: "Bo's agent · Billing page",
      ratings: 1,
      average: 4,
      est: 18_000,
      actual: null,
      status: "waiting",
    },
  ],
  gates: [
    {
      title: "United pdf-layout into main",
      context: "Bo's agent · rule 2 at 4+ · Dee 4, Cy 5",
      have: ["Dee", "Cy"],
      needed: 2,
      status: "granted",
    },
    {
      title: "Publish invoice PDF template",
      context: "Cy's agent · rule 2 at 4+ · Dee 4",
      have: ["Dee"],
      needed: 2,
      status: "waiting",
    },
  ],
  joined: ["Cy joined Invoice rollout with Cy's agent · crew Invoice rollout is Ana + Cy"],
  urls: {
    overview: "https://app.example/#/m/payments",
    queue: "https://app.example/#/approvals",
    usage: "https://app.example/#/m/payments",
    settings: "https://app.example/#/settings",
  },
};

describe("the digest", () => {
  it("opens with the team sentence, the same one Slack and the app say, with the week appended", () => {
    const r = digest(payments);
    const sentence =
      "4 open sessions across 2 projects: 2 running, 1 awaiting approval, 1 blocked. 3 things need you.";
    expect(teamSummary(4, 2, "2 running, 1 awaiting approval, 1 blocked", 3)).toBe(sentence);
    expect(slackSummary(4, 2, "2 running, 1 awaiting approval, 1 blocked", 3)).toBe(sentence);
    expect(r.text.split("\n")[2]).toBe(
      `${sentence} This week the team spent 212k tokens, rated 7 plans and held 2 release gates.`,
    );
    // The emblem · the product name · the team · the range, before the sentence.
    expect(r.text.split("\n")[0]).toBe("Henosis · Payments · 29 Sep – 5 Oct");
    expect(r.html).toContain("Nothing needs you right now.".slice(0, 0) + "3 things need you.");
    expect(r.html.indexOf("3 things need you.")).toBeLessThan(r.html.indexOf("Needs you"));
  });

  it("subject is the sentence's verdict and the preheader the four counts", () => {
    expect(digestSubject(payments)).toBe("Payments this week: 3 things need you");
    expect(digestPreheader(payments)).toBe(
      "4 open sessions · 212k tokens · 7 plans rated · 2 release gates",
    );
    expect(digestSubject({ ...payments, summary: { ...payments.summary, needs: 0 } })).toBe(
      "Payments this week: nothing needs you",
    );
    expect(digestSubject({ ...payments, cadence: "daily" })).toBe(
      "Payments today: 3 things need you",
    );
    const r = digest(payments);
    expect(r.subject).toBe("Payments this week: 3 things need you");
    expect(r.html).toContain("4 open sessions · 212k tokens · 7 plans rated · 2 release gates");
  });

  it("needs-you cards keep their order, a stripe by kind, the thing in italic, the missing voice and one button", () => {
    const r = digest(payments);
    const plan = r.html.indexOf("Plan · waiting on ratings");
    const gate = r.html.indexOf("Release gate · irreversible");
    const contention = r.html.indexOf("Contention · claim denied");
    expect(plan).toBeGreaterThan(0);
    expect(plan).toBeLessThan(gate);
    expect(gate).toBeLessThan(contention);
    // Apricot stripe for a plan, the navy→chocolate stripe for a gate, red for a contention.
    expect(r.html).toContain("background:#E2C4A6;");
    expect(r.html).toContain("linear-gradient(180deg,#2A3244,#56352D)");
    expect(r.html).toContain("background:#8A3A30;");
    expect(r.html).toContain("<i style=\"font-family:'Instrument Serif'");
    expect(r.html).toContain("Proration on plan change</i> in Billing page.");
    // One lit disc, one dashed empty disc, "1 of 2".
    expect(r.html).toContain("border:1px dashed");
    expect(r.html).toContain(">1 of 2<");
    expect(r.html).toContain(">Rate the plan<");
    expect(r.html).toContain('href="https://app.example/#/p/billing/s/s1"');
    // The text part says the same in lines.
    expect(r.text).toContain(
      '[Plan · waiting on ratings] Bo\'s agent plans "Proration on plan change" in Billing page.',
    );
    expect(r.text).toContain("1 of 2 (Dee) · Rate the plan: https://app.example/#/p/billing/s/s1");
    expect(r.text).toContain("blocked 3 days · Resolve: https://app.example/#/p/checkout");
  });

  it("says estimate → actual one way and counts gates as the judge asked", () => {
    const r = digest(payments);
    expect(r.html).toContain("est 44k → 61k, +38%");
    expect(r.html).toContain("est 22k → 19k, under");
    expect(r.text).toContain(
      "Invoice PDF layout · Bo's agent · Billing page · 3 ratings · ★★★★☆ 4.3 · est 44k → 61k, +38% · done",
    );
    expect(r.text).toContain("asked to revise by Ana");
    expect(gatesCount(payments.gates)).toBe("2 gates · 1 granted · 1 waiting");
    expect(plansCount(payments.plans)).toBe("4 rated · 2 approved · 1 revised · 1 waiting");
    expect(r.text).toContain("RELEASE GATES · 2 gates · 1 granted · 1 waiting");
    // Tokens: the three tiles, the bars with the value at the tip and the dashed budget tick.
    expect(r.html).toContain(">212k<");
    expect(r.html).toContain("148k in · 64k out");
    expect(r.html).toContain(">−9%<");
    expect(r.html).toContain(">74k / 100k<");
    expect(r.html).toContain("border-right:2px dashed #56352D");
  });

  it("carries the join moment and the footer that says why she gets it", () => {
    const r = digest(payments);
    expect(r.text).toContain(
      "Joined: Cy joined Invoice rollout with Cy's agent · crew Invoice rollout is Ana + Cy",
    );
    expect(r.html).toContain("<b>Joined.</b> Cy joined Invoice rollout");
    expect(r.text).toContain("You get this every Monday at 08:00 because you lead Payments.");
    expect(r.text).toContain("Open the overview: https://app.example/#/m/payments");
    expect(r.html).toContain(">Weekly<");
    expect(r.html.endsWith("</html>\n")).toBe(true);
  });

  it("is a self-contained e-mail: inline styles, font fallbacks, no scripts or remote assets", () => {
    const r = digest(payments);
    expect(r.html).not.toMatch(/<script|<link|<img|src=/i);
    expect(r.html).toContain("Georgia, serif");
    expect(r.html).toContain("Menlo, monospace");
    expect(r.html).toContain("system-ui, sans-serif");
    expect(r.html).toContain('<meta name="color-scheme" content="light">');
    expect(r.html).not.toContain("var(--");
    // Everything a lead reads in the HTML is in the text part too.
    for (const line of ["Needs you", "Tokens", "Plans", "Release gates"])
      expect(r.text.toUpperCase()).toContain(line.toUpperCase());
  });

  it("a quiet week is one sentence and empty sections, never a card", () => {
    const r = digest({
      ...payments,
      summary: { open: 2, projects: 1, counts: "2 paused", needs: 0 },
      period: { tokens: 0, input: 0, output: 0, plansRated: 0, gates: 0 },
      needs: [],
      plans: [],
      gates: [],
      joined: [],
      tokens: { againstPlans: null, budget: null, byProject: [], byPerson: [], reading: "" },
    });
    expect(r.subject).toBe("Payments this week: nothing needs you");
    expect(r.text).toContain(
      "2 open sessions across 1 project: 2 paused. Nothing needs you right now. This week the team spent 0 tokens, rated 0 plans and held 0 release gates.",
    );
    expect(r.text).toContain(
      "NEEDS YOU · 0 · Open the queue: https://app.example/#/approvals\nNothing needs you right now.",
    );
    expect(r.text).toContain("No plans in this range.");
    expect(r.html).not.toContain("border:1px dashed");
    expect(r.html).toContain(">—<");
  });

  it("escapes what people typed", () => {
    const r = digest({
      ...payments,
      needs: [
        {
          ...(payments.needs[0] as DigestInput["needs"][number]),
          thing: '<b>bold</b> & "quoted"',
        },
      ],
    });
    expect(r.html).toContain("&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;");
    expect(r.html).not.toContain("<b>bold</b>");
  });
});

describe("the invite", () => {
  it("is the join moment on paper: the sentence, one button, who is here, the manners and the agent's path", () => {
    const r = invite({
      invitee: "Cy",
      inviter: "Bo",
      inviterEmail: "bo@payments.example",
      team: "Payments",
      teamLine:
        "Payments is where Ana, Bo and Dee work with their agents on Billing page and Checkout.",
      role: "member",
      roleLine:
        "you can watch every session, steer the agents, rate plans and vote on release gates. Bo has the baton on Invoice PDF layout right now, and the team's rule is plan first.",
      url: "https://app.example/?invite=hj_7f2a",
      expires: "Link is good for 7 days · one use",
      people: { names: ["Ana", "Bo", "Dee"], line: "Ana leads. Bo and Dee are members." },
      agents: { count: 3, line: "3 live: two on Billing page, one on Checkout." },
      manners:
        "Your agent will plan before it works, and anything irreversible waits for two people at 4+. Your ratings count from the day you join.",
      join: {
        command: "henosis join s-invoice --as cy --url wss://app.example/ws --token hj_7f2a",
        note: "Run this where your harness lives. The token is one use, good for 15 minutes.",
      },
    });
    expect(r.subject).toBe("Bo invites you to Payments on Henosis");
    expect(r.text.split("\n")[0]).toBe("Cy, Bo invites you to the circle.");
    expect(r.text).toContain("Join the circle: https://app.example/?invite=hj_7f2a");
    expect(r.text).toContain("Same manners, same gate.");
    expect(r.text).toContain("  henosis join s-invoice --as cy");
    expect(r.text).toContain("nothing happens until you open the link.");
    expect(r.html).toContain(">Join the circle<");
    expect(r.html).toContain("linear-gradient(135deg,#2A3244,#56352D)");
    expect(r.html).toContain("Bringing an agent? It joins the same way.");
    expect(r.html).not.toMatch(/<script|<img|src=/i);
    const noAgent = invite({
      invitee: "Cy",
      inviter: "Bo",
      inviterEmail: null,
      team: "Payments",
      teamLine: "Payments.",
      role: "member",
      roleLine: "you can watch.",
      url: "https://app.example/?invite=x",
      expires: "7 days",
      people: { names: ["Ana"], line: "Ana leads." },
      agents: { count: 0, line: "none yet." },
      manners: "Plan first.",
      join: null,
    });
    expect(noAgent.text).not.toContain("Bringing an agent");
    expect(noAgent.text).toContain("Bo sent this from Henosis.");
  });
});
