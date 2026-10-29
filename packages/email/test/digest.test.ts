import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { HenosisServer } from "@henosis/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appUrl, EmailDigest, shortDate, stamp } from "../src/digest.js";
import { FakeMailer, FileMailer } from "../src/mailer.js";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MONDAY = new Date("2026-10-05T08:00:00Z");
const NEXT_MONDAY = new Date("2026-10-12T08:00:00Z");

describe("the email digest", () => {
  let root: string;
  let server: HenosisServer;
  let mailer: FakeMailer;
  let digests: EmailDigest;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "henosis-email-"));
    writeFileSync(
      join(root, "orgs.json"),
      JSON.stringify({
        orgs: [
          {
            id: "nw",
            name: "Northwind",
            teams: [
              {
                id: "pay",
                name: "Payments",
                projects: [
                  { id: "billing", name: "Billing" },
                  { id: "checkout", name: "Checkout" },
                ],
              },
              { id: "ops", name: "Ops", projects: [{ id: "infra", name: "Infra" }] },
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
            email: "dee@payments.example",
            teams: [
              { teamId: "pay", role: "lead" },
              { teamId: "ops", role: "manager" },
            ],
          },
          {
            id: "ana",
            name: "Ana",
            email: "ana@payments.example",
            projects: [{ projectId: "billing", role: "member" }],
          },
          { id: "bo", name: "Bo", teams: [{ teamId: "pay", role: "lead" }] },
        ],
      }),
    );
    server = new HenosisServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    mailer = new FakeMailer();
    digests = new EmailDigest({
      server,
      mailer,
      from: "Henosis <digest@henosis.app>",
      appBaseUrl: "https://henosis.example.com/",
      now: () => MONDAY,
    });
  });
  afterAll(async () => {
    await wait(60);
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("goes to every lead or manager with an address, once per team they lead", () => {
    expect(digests.recipients()).toEqual([
      {
        userId: "dee",
        name: "Dee",
        email: "dee@payments.example",
        teamId: "pay",
        teamName: "Payments",
      },
      { userId: "dee", name: "Dee", email: "dee@payments.example", teamId: "ops", teamName: "Ops" },
    ]);
  });

  it("opens with the team sentence and the figures since the sessions opened, then counts from the last digest", async () => {
    const host = server.project("billing");
    const s = host.session("s-plan", {
      title: "Invoice PDF",
      ownerId: "ana",
      policy: { planFirst: true, tokenBudget: 80_000 },
    });
    s.session.join("main", { id: "ana", kind: "human", name: "Ana" }, "owner");
    s.session.join("main", { id: "bo", kind: "human", name: "Bo" }, "contributor");
    s.session.directive("main", "ana", { text: "Build a doubling helper and deploy it" });
    void s.drive("main");
    for (let i = 0; i < 100 && !s.session.state().activePlanId; i++) await wait(50);
    await wait(50);
    // A second, solo session in the other project with a plain approval waiting.
    const c = server.project("checkout").session("s-exec", { title: "Tax lines", ownerId: "bo" });
    c.session.join("main", { id: "bo", kind: "human", name: "Bo" }, "owner");
    c.session.directive("main", "bo", { text: "Build a tiny helper" });
    void c.drive("main");
    for (let i = 0; i < 100 && !Object.values(c.session.state().approvals).length; i++)
      await wait(50);

    const first = digests.input("dee", "pay", MONDAY);
    expect(first.team).toBe("Payments");
    expect(first.lead).toBe("Dee");
    expect(first.range).toBe("since the sessions opened");
    expect(first.summary.open).toBe(2);
    expect(first.summary.projects).toBe(2);
    expect(first.summary.counts).toContain("awaiting approval");
    expect(first.summary.needs).toBe(2);
    expect(first.needs.map((n) => n.kind)).toEqual(["plan", "gate"]);
    const plan = first.needs[0];
    expect(plan?.label).toBe("Plan · waiting on ratings");
    expect(plan?.lead).toBe("Ana's agent plans");
    expect(plan?.thing).toBe("Build a doubling helper and deploy it");
    expect(plan?.tail).toBe(" in Billing.");
    expect(plan?.rule).toBe(
      "Policy: one rating at 3+. No rating yet; one more voice and it starts. Est. 1.8k tokens.",
    );
    expect(plan?.votes).toEqual({ have: [], needed: 1 });
    expect(plan?.action).toEqual({
      label: "Rate the plan",
      url: "https://henosis.example.com/#/p/billing/s/s-plan",
      primary: true,
    });
    const gate = first.needs[1];
    expect(gate?.label).toBe("Approval · exec");
    expect(gate?.lead).toBe("Bo's agent wants to");
    expect(gate?.thing).toMatch(/^run /);
    expect(gate?.rule).toBe("Rule: one contributor or above. waiting on one more vote.");
    expect(gate?.action.label).toBe("Vote");
    expect(first.period.tokens).toBeGreaterThan(0);
    expect(first.period.plansRated).toBe(0);
    expect(first.plans).toHaveLength(1);
    expect(first.plans[0]).toMatchObject({
      title: "Build a doubling helper and deploy it",
      context: "Ana's agent · Billing",
      ratings: 0,
      average: null,
      est: 1800,
      actual: null,
      status: "waiting",
    });
    expect(first.tokens.budget).toEqual({
      used: first.tokens.byProject.find((b) => b.label === "Billing")?.value,
      budget: 80_000,
      label: "Billing",
    });
    expect(first.tokens.byPerson.map((b) => b.label).sort()).toEqual(["Ana", "Bo"]);
    expect(first.tokens.reading).toMatch(
      /took \d+% of the tokens, most of it .* \(.*'s agent, [\d.]+k?\)\. Billing is at \d+% of its budget\. Cache reads are not counted\.$/,
    );
    // Bo joined Ana's session: the join moment.
    expect(first.joined).toEqual(["Bo joined Invoice PDF with Ana's agent"]);
    expect(first.urls.overview).toBe("https://henosis.example.com/#/m/pay");
    expect(first.urls.queue).toBe("https://henosis.example.com/#/approvals");

    // Sent: the sentence first, the subject as the verdict, the X-Henosis-Digest header.
    const sent = await digests.send(
      {
        userId: "dee",
        name: "Dee",
        email: "dee@payments.example",
        teamId: "pay",
        teamName: "Payments",
      },
      MONDAY,
    );
    expect(sent.id).toMatch(/^<fake-\d+@henosis.local>$/);
    const mail = mailer.last;
    expect(mail?.from).toBe("Henosis <digest@henosis.app>");
    expect(mail?.to).toEqual(["Dee <dee@payments.example>"]);
    expect(mail?.subject).toBe("Payments this week: 2 things need you");
    expect(mail?.headers).toEqual({ "X-Henosis-Digest": "pay; weekly" });
    expect(mail?.text.split("\n")[2]).toMatch(
      /^2 open sessions across 2 projects: .*\. 2 things need you\. This week the team spent [\d.]+k? tokens, rated 0 plans and held 0 release gates\.$/,
    );
    expect(mail?.text).toContain("Joined: Bo joined Invoice PDF with Ana's agent");
    expect(mail?.html).toContain("Rate the plan");

    // Bo rates the plan 4 after the digest: next Monday counts only what happened since.
    s.session.ratePlan("main", "bo", s.session.state().activePlanId ?? "", 4, "Fine.");
    const second = digests.input("dee", "pay", NEXT_MONDAY);
    expect(second.range).toBe("5 Oct – 12 Oct");
    expect(second.period.plansRated).toBe(1);
    expect(second.period.tokens).toBe(0);
    expect(second.joined).toEqual([]);
    expect(second.plans[0]).toMatchObject({ ratings: 1, average: 4, status: "approved" });
    expect(second.needs.map((n) => n.kind)).toEqual(["gate"]);
    const r = digests.render("dee", "pay", NEXT_MONDAY);
    expect(r.subject).toBe("Payments this week: 1 thing needs you");
    expect(r.text).toContain("★★★★☆ 4 · est 1.8k · approved");
    expect(r.text).toContain("Henosis · Payments · 5 Oct – 12 Oct");
  });

  it("sendAll sends one digest per lead per team and a quiet team gets one quiet sentence", async () => {
    mailer.sent.length = 0;
    const out = await digests.sendAll(NEXT_MONDAY);
    expect(out.map((o) => [o.recipient.teamId, o.sent !== null])).toEqual([
      ["pay", true],
      ["ops", true],
    ]);
    const ops = mailer.to("Dee <dee@payments.example>").find((m) => m.subject.startsWith("Ops"));
    expect(ops?.subject).toBe("Ops this week: nothing needs you");
    expect(ops?.text).toContain(
      "0 open sessions across 1 project. Nothing needs you right now. This week the team spent 0 tokens, rated 0 plans and held 0 release gates.",
    );
    expect(ops?.text).toContain("Nothing needs you right now.");
    expect(ops?.text).toContain("No plans in this range.");
    // The store remembers the cursor, so a new service instance counts from here too.
    const again = new EmailDigest({ server, mailer, from: "x@y", now: () => NEXT_MONDAY });
    expect(again.input("dee", "pay").range).toBe("12 Oct – 12 Oct");
    expect(again.input("dee", "pay").period.tokens).toBe(0);
  });

  it("a failed send is logged and does not stop the others", async () => {
    const lines: string[] = [];
    const flaky = new EmailDigest({
      server,
      mailer: {
        send: async (e) => {
          if (e.subject.startsWith("Payments")) throw new Error("mailbox full");
          return { id: "<ok>" };
        },
      },
      from: "x@y",
      now: () => NEXT_MONDAY,
      log: (l) => lines.push(l),
    });
    const out = await flaky.sendAll();
    expect(out.map((o) => o.sent?.id ?? null)).toEqual([null, "<ok>"]);
    expect(lines).toEqual(["digest to dee@payments.example failed: mailbox full"]);
  });

  it("the file mailer writes an .eml a mail client opens", async () => {
    const dir = join(root, "digests");
    const files = new FileMailer(dir, () => NEXT_MONDAY);
    const viaFile = new EmailDigest({
      server,
      mailer: files,
      from: "Henosis <digest@henosis.app>",
      now: () => NEXT_MONDAY,
    });
    const sent = await viaFile.send({
      userId: "dee",
      name: "Dee",
      email: "dee@payments.example",
      teamId: "pay",
      teamName: "Payments",
    });
    expect(sent.id).toMatch(/@henosis>$/);
    expect(files.written).toHaveLength(1);
    const path = files.written[0] ?? "";
    expect(path.endsWith("001-payments-this-week-1-thing-needs-you.eml")).toBe(true);
    expect(existsSync(path)).toBe(true);
    const eml = readFileSync(path, "utf8");
    expect(eml).toMatch(
      /^From: Henosis <digest@henosis.app>\r\nTo: Dee <dee@payments.example>\r\nSubject: Payments this week: 1 thing needs you\r\n/,
    );
    expect(eml).toContain("Content-Type: multipart/alternative;");
  });

  it("formats dates and app urls", () => {
    expect(shortDate(MONDAY)).toBe("5 Oct");
    expect(stamp(MONDAY)).toBe("Mon 5 Oct, 08:00");
    expect(appUrl("https://x.example/#/", "#/approvals")).toBe("https://x.example/#/approvals");
    expect(appUrl(undefined, "#/approvals")).toBeNull();
    expect(appUrl("", "#/approvals")).toBeNull();
  });
});
