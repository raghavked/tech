import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { HenosisServer } from "@henosis/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GitHubAdapter, GitHubConfig, joinNames, waitsOn } from "../src/adapter.js";
import { FakeGitHubClient } from "../src/client.js";
import { sessionOfMarker } from "../src/comment.js";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PR = { owner: "northwind", repo: "billing", number: 418 };

describe("github adapter", () => {
  let root: string;
  let server: HenosisServer;
  let github: FakeGitHubClient;
  let adapter: GitHubAdapter;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "henosis-github-"));
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
          { id: "dee", name: "Dee", teams: [{ teamId: "pay", role: "lead" }] },
          { id: "ana", name: "Ana", projects: [{ projectId: "billing", role: "member" }] },
          { id: "bo", name: "Bo", projects: [{ projectId: "billing", role: "member" }] },
        ],
      }),
    );
    server = new HenosisServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    github = new FakeGitHubClient();
    adapter = new GitHubAdapter({
      server,
      client: github,
      prs: { "s-pdf": "northwind/billing#418" },
      coalesceMs: 0,
      appBaseUrl: "https://henosis.example.com/",
      apiBaseUrl: "https://henosis.example.com",
    });
    adapter.watchProject("billing");
  });
  afterAll(async () => {
    await wait(60);
    adapter.stop();
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("keeps one comment per session, edited in place through the plan, the ratings, the steps and the gate", async () => {
    const host = server.project("billing");
    // Somebody else's comment is already on the PR; the adapter must not mistake it for its own.
    github.seed(PR, "Looks good to me");
    const s = host.session("s-pdf", {
      title: "Invoice PDF",
      ownerId: "ana",
      policy: { planFirst: true, tokenBudget: 80_000 },
    });
    s.session.join("main", { id: "ana", kind: "human", name: "Ana" }, "owner");
    s.session.join("main", { id: "bo", kind: "human", name: "Bo" }, "contributor");
    await adapter.flushAll();
    const mine = github.commentsOf(PR).filter((c) => sessionOfMarker(c.body) === "s-pdf");
    expect(mine).toHaveLength(1);
    expect(github.created).toHaveLength(1);
    const id = mine[0]?.id ?? 0;
    const first = mine[0]?.body ?? "";
    expect(first.split("\n")[0]).toBe("<!-- henosis:session=s-pdf -->");
    expect(first.split("\n")[1]).toBe(
      "**Ana's agent** · Team with Bo · the Payments team · [Open the session](https://henosis.example.com/#/p/billing/s/s-pdf)",
    );
    expect(first).toContain("**Waiting for a goal.**");
    expect(first).toContain("### Tokens — 0 of 80k");

    // The goal lands and the agent proposes a plan: the comment says the plan waits.
    s.session.directive("main", "ana", { text: "Build a doubling helper and deploy it" });
    void s.drive("main");
    for (let i = 0; i < 100 && !s.session.state().activePlanId; i++) await wait(50);
    await wait(50);
    await adapter.flushAll();
    const planId = s.session.state().activePlanId ?? "";
    let body = github.commentsOf(PR).find((c) => c.id === id)?.body ?? "";
    expect(body).toContain("**The plan waits for one rating.**");
    expect(body).toContain("### The plan — waits for one rating · 0 of 3 steps done");
    expect(body).toContain("| 3 | Deploy to production | 300 | — |  |");
    expect(body).toContain("⏳ No rating yet · policy: one rating at 3+");
    expect(body).toContain("Build a doubling helper and deploy it");
    expect(github.commentsOf(PR).filter((c) => sessionOfMarker(c.body) === "s-pdf")).toHaveLength(
      1,
    );

    // Bo rates 4 with a note: the fold approves the plan; the rating is a row, the verdict computed.
    s.session.ratePlan("main", "bo", planId, 4, "Small steps, tests first.");
    void s.drive("main");
    for (let i = 0; i < 100 && !Object.values(s.session.state().approvals).length; i++)
      await wait(50);
    await adapter.flushAll();
    body = github.commentsOf(PR).find((c) => c.id === id)?.body ?? "";
    expect(body).toContain("- **Bo** contributor · ★★★★☆ 4 · _“Small steps, tests first.”_");
    expect(body).toContain(
      "✓ Plan approved · 1 rating · 4 average · policy: one rating at 3+ · decided in the fold",
    );
    // The exec approval (the test run) is the gate the comment shows while it is pending.
    const exec = Object.values(s.session.state().approvals).find((a) => a.status === "pending");
    expect(exec?.call.risk).toBe("exec");
    expect(body).toMatch(/^\*\*.+ waits on one more contributor or above\.\*\*$/m);
    expect(body).toContain("### Release gate — waits on one more contributor or above");
    expect(body).toContain("· exec · one contributor or above");
    expect(body).toMatch(/^`node --test [^`]+` · exec/m);

    // Ana approves the test run; the agent goes on to the deploy, a release gate at two 4+.
    s.session.vote("main", "ana", exec?.id ?? "", "approve");
    void s.drive("main");
    for (
      let i = 0;
      i < 100 &&
      !Object.values(s.session.state().approvals).some(
        (a) => a.call.risk === "irreversible" && a.status === "pending",
      );
      i++
    )
      await wait(50);
    await adapter.flushAll();
    body = github.commentsOf(PR).find((c) => c.id === id)?.body ?? "";
    expect(body).toContain(
      "**`deploy to production` waits on 2 more contributors at 4 or above.**",
    );
    expect(body).toContain("### Release gate — waits on 2 more contributors at 4 or above");
    expect(body).toContain("| 1 | Write src/build_a_doubling_helper_.mjs |");
    expect(body).toMatch(/\| ✓ \|/);
    const gate = Object.values(s.session.state().approvals).find(
      (a) => a.call.risk === "irreversible",
    );
    // Ana rates 4, Bo rates 5: the gate is granted and the comment says so with the average.
    s.session.vote("main", "ana", gate?.id ?? "", "approve", 4, "Ship it.");
    await adapter.flushAll();
    body = github.commentsOf(PR).find((c) => c.id === id)?.body ?? "";
    expect(body).toContain(
      "**`deploy to production` waits on one more contributor at 4 or above.**",
    );
    expect(body).toContain("- **Ana** owner · ★★★★☆ 4 · _“Ship it.”_");
    expect(body).toContain("⏳ Waits on one more contributor at 4 or above · 1 of 2 · 4 average");
    s.session.vote("main", "bo", gate?.id ?? "", "approve", 5);
    void s.drive("main");
    for (let i = 0; i < 100 && s.session.state().status !== "idle"; i++) await wait(50);
    await adapter.flushAll();
    body = github.commentsOf(PR).find((c) => c.id === id)?.body ?? "";
    expect(body).toContain("### Release gate — granted");
    expect(body).toContain("✓ Gate granted · 2 of 2 · 4.5 average");
    expect(body).toContain("**Done · 3 of 3 steps.**");
    expect(body).toContain("### The plan — done · 3 of 3 steps done");
    expect(body).toMatch(/est \d[\d.]*k? → \d[\d.]*k?, (under|\+\d+%)/);
    expect(body).toMatch(/replays to `[0-9a-f]{4}…[0-9a-f]{4}`$/m);
    expect(body).toContain(
      "[Audit record](https://henosis.example.com/api/sessions/s-pdf/export.md)",
    );

    // Still one comment of ours, edited every time, and the stranger's comment untouched.
    const all = github.commentsOf(PR);
    expect(all.filter((c) => sessionOfMarker(c.body) === "s-pdf")).toHaveLength(1);
    expect(all.find((c) => c.body === "Looks good to me")).toBeDefined();
    expect(github.created).toHaveLength(1);
    expect(github.updated.length).toBeGreaterThanOrEqual(4);
    expect(github.updated.every((u) => u.id === id)).toBe(true);
  });

  it("a restarted adapter finds the comment by its marker and never posts a second one", async () => {
    const again = new GitHubAdapter({ server, client: github, coalesceMs: 0 });
    again.attach("s-pdf", "https://github.com/northwind/billing/pull/418");
    await again.flushAll();
    expect(github.created).toHaveLength(1);
    expect(github.commentsOf(PR).filter((c) => sessionOfMarker(c.body) === "s-pdf")).toHaveLength(
      1,
    );
    // Without an app URL the identity line ends without a link and the footer keeps the hash.
    const body = again.render("billing", "s-pdf") ?? "";
    expect(body.split("\n")[1]).toBe("**Ana's agent** · Team with Bo · the Payments team");
    expect(body).toMatch(/^Session · replays to `/m);
    // The same body is not sent twice.
    const edits = github.updated.length;
    await again.sync("s-pdf");
    expect(github.updated.length).toBe(edits);
    again.stop();
  });

  it("a session without a pull request is left alone", async () => {
    const host = server.project("billing");
    const s = host.session("s-solo", { title: "Solo", ownerId: "bo" });
    s.session.join("main", { id: "bo", kind: "human", name: "Bo" }, "owner");
    await adapter.flushAll();
    expect(github.created).toHaveLength(1);
    expect(adapter.prOf("s-solo")).toBeNull();
  });

  it("reads github.json and says what a gate waits on", () => {
    const cfg = GitHubConfig.parse({
      prs: { "s-pdf": "northwind/billing#418" },
      projects: ["billing"],
    });
    expect(cfg.prs["s-pdf"]).toBe("northwind/billing#418");
    expect(cfg.token).toBeUndefined();
    expect(waitsOn(1, "contributor", 4, null)).toBe("waits on one more contributor at 4 or above");
    expect(waitsOn(2, "contributor", 4, null)).toBe("waits on 2 more contributors at 4 or above");
    expect(waitsOn(1, "owner", null, null)).toBe("waits on one more owner or above");
    expect(waitsOn(0, "contributor", 4, 3.5)).toBe("waits for an average of 4 or above (now 3.5)");
    expect(waitsOn(0, "contributor", null, null)).toBe("waits for the fold");
    expect(joinNames(["Bo", "Cy", "Dee"])).toBe("Bo, Cy and Dee");
    expect(joinNames(["Bo"])).toBe("Bo");
  });
});
