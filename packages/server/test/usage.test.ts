import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Actor,
  addUsage,
  MAIN_BRANCH,
  SessionPolicy,
  type Usage,
  type UsageReport,
  usageTotal,
  ZERO_USAGE,
} from "@henosis/protocol";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HenosisServer } from "../src/server.js";
import { computeUsage } from "../src/usageApi.js";

const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const bo: Actor = { id: "bo", kind: "human", name: "Bo" };
const none = { read: "none", write: "none", exec: "none", external: "none", irreversible: "none" };
const policy = SessionPolicy.parse({ approvals: none, tokenBudget: 50_000 });
const M = MAIN_BRANCH;

/** The sum of every `agent.model.completed.usage` on every branch of a live session. */
function summed(server: HenosisServer, sessionId: string): { usage: Usage; turns: number } {
  const s = server.host(sessionId).session;
  let usage: Usage = { ...ZERO_USAGE };
  let turns = 0;
  for (const b of s.branches())
    for (const e of s.log.ownEvents(b)) {
      if (e.kind === "agent.model.completed") usage = addUsage(usage, e.payload.usage);
      if (e.kind === "agent.turn.ended") turns++;
    }
  return { usage, turns };
}

describe("GET /api/usage", () => {
  let root: string;
  let server: HenosisServer;
  let base: string;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-usage-"));
    server = new HenosisServer({
      root,
      model: new ScriptedModel(),
      tools: defaultTools(),
      defaultPolicy: policy,
    });
    base = `http://127.0.0.1:${await server.listen(0)}`;
    const a = server.host("s-ana", "Build a doubling helper", "default", "ana");
    a.session.join(M, ana, "owner");
    a.session.directive(M, "ana", { text: "Build a doubling helper" });
    await a.drive();
    const b = server.host("s-bo", "Write a greeter", "default", "bo");
    b.session.join(M, bo, "owner");
    b.session.directive(M, "bo", { text: "Write a greeter" });
    await b.drive();
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("totals match the usage summed from the session events", async () => {
    const r = (await (await fetch(`${base}/api/usage`)).json()) as UsageReport;
    const a = summed(server, "s-ana");
    const b = summed(server, "s-bo");
    expect(usageTotal(a.usage)).toBeGreaterThan(0);
    expect(r.totals).toEqual(addUsage(a.usage, b.usage));
    expect(r.clock).toBe("logical");
    const rowA = r.bySession.find((x) => x.sessionId === "s-ana");
    expect(rowA).toMatchObject({
      projectId: "default",
      title: "Build a doubling helper",
      ownerId: "ana",
      usage: a.usage,
      turns: a.turns,
      budget: 50_000,
    });
    expect(rowA?.turns).toBe(server.host("s-ana").session.state().turns.length);
    expect(r.byUser.map((u) => [u.userId, u.name, u.usage])).toEqual(
      expect.arrayContaining([
        ["ana", "Ana", a.usage],
        ["bo", "Bo", b.usage],
      ]),
    );
    expect(r.byProject.map((p) => [p.projectId, p.usage])).toEqual([["default", r.totals]]);
    expect(r.byProject[0]?.name).toBe(server.orgs.project("default")?.name);
    // The turn series partitions the same total.
    const series = r.byTurnBucket.reduce((t, x) => addUsage(t, x.usage), { ...ZERO_USAGE });
    expect(series).toEqual(r.totals);
    expect(r.byTurnBucket[0]).toMatchObject({ from: 1, to: 10 });
    // Every model call in the log carried usage, and the state folded it the same way.
    const st = server.host("s-ana").session.state();
    expect(st.usage).toEqual(a.usage);
    expect(st.turns.reduce((t, x) => addUsage(t, x.usage), { ...ZERO_USAGE })).toEqual(a.usage);
  });

  it("the status reporter put the same usage on the project ledger", () => {
    const report = server.project("default").state().sessions["s-ana"]?.report;
    expect(report?.usage).toEqual(summed(server, "s-ana").usage);
  });

  it("filters by user and project; an ISO since is named, not applied", async () => {
    const mine = (await (await fetch(`${base}/api/usage?user=ana`)).json()) as UsageReport;
    expect(mine.bySession.map((x) => x.sessionId)).toEqual(["s-ana"]);
    expect(mine.totals).toEqual(summed(server, "s-ana").usage);
    expect(mine.byUser.map((u) => u.userId)).toEqual(["ana"]);
    const none = (await (await fetch(`${base}/api/usage?project=nope`)).json()) as UsageReport;
    expect(none.bySession).toEqual([]);
    expect(none.totals).toEqual(ZERO_USAGE);
    const org = (await (await fetch(`${base}/api/usage?org=default`)).json()) as UsageReport;
    expect(org.bySession.length).toBe(2);
    const otherOrg = (await (await fetch(`${base}/api/usage?org=acme`)).json()) as UsageReport;
    expect(otherOrg.bySession).toEqual([]);
    const iso = (await (
      await fetch(`${base}/api/usage?since=2026-01-01T00:00:00Z`)
    ).json()) as UsageReport;
    expect(iso.since).toBeNull();
    expect(iso.warnings[0]).toContain("logical clock");
    expect(iso.totals).toEqual(org.totals);
  });

  it("since=<seq> counts only the events after it", async () => {
    const s = server.host("s-ana").session;
    const head = s.state().seq;
    const after = (await (
      await fetch(`${base}/api/usage?user=ana&since=${head}`)
    ).json()) as UsageReport;
    expect(after.since).toBe(head);
    expect(after.totals).toEqual(ZERO_USAGE);
    expect(after.bySession[0]?.turns).toBe(0);
    const firstCall = s.events().find((e) => e.kind === "agent.model.completed");
    expect(firstCall).toBeDefined();
    const fromFirst = (await (
      await fetch(`${base}/api/usage?user=ana&since=${firstCall?.seq ?? 0}`)
    ).json()) as UsageReport;
    const firstUsage = firstCall?.kind === "agent.model.completed" ? firstCall.payload.usage : null;
    expect(firstUsage).toBeTruthy();
    expect(usageTotal(fromFirst.totals)).toBe(
      usageTotal(summed(server, "s-ana").usage) - usageTotal(firstUsage ?? undefined),
    );
  });

  it("turns=N counts the last N turns of every session; cache, forecast and budgets ride along", async () => {
    const all = (await (await fetch(`${base}/api/usage?user=ana`)).json()) as UsageReport;
    const s = server.host("s-ana").session.state();
    expect(all.turns).toBeNull();
    // Every row keeps its in/out split; cache is reported beside the budget, never in it.
    expect(all.bySession[0]?.usage.input).toBeGreaterThan(0);
    expect(all.cache).toEqual({
      read: all.totals.cacheRead,
      write: all.totals.cacheWrite,
      shareOfInput: all.totals.cacheRead / (all.totals.input + all.totals.cacheRead) || 0,
    });
    // Decision 8: no project budget on the ledger, so the project's is the sum of its open
    // sessions' budgets (both at 50k), whoever the report is filtered to.
    const proj = all.byProject.find((p) => p.projectId === "default");
    expect(proj).toMatchObject({ budget: 100_000, budgetSource: "sessions" });
    // The forecast reads the pace per turn against that budget.
    const spent = usageTotal(all.totals);
    expect(all.forecast.budget).toBe(100_000);
    expect(all.forecast.spent).toBe(spent);
    expect(all.forecast.turns).toBe(s.turns.length);
    expect(all.forecast.perTurn).toBe(Math.round(spent / s.turns.length));
    expect(all.forecast.turnsToBudget).toBe(
      Math.max(0, Math.ceil((100_000 - spent) / (spent / s.turns.length))),
    );
    expect(all.forecast.turnsToWarn).toBeLessThanOrEqual(all.forecast.turnsToBudget ?? 0);
    expect(all.forecast.method).toContain("nothing stops");
    // The last turn only: the usage of the model calls in that turn, one turn ended.
    const last = (await (await fetch(`${base}/api/usage?user=ana&turns=1`)).json()) as UsageReport;
    expect(last.turns).toBe(1);
    expect(last.bySession[0]?.turns).toBe(1);
    const lastTurn = s.turns[s.turns.length - 1];
    expect(last.totals).toEqual(lastTurn?.usage);
    // More turns than the session has: everything, same as no range.
    const wide = (await (
      await fetch(`${base}/api/usage?user=ana&turns=999`)
    ).json()) as UsageReport;
    expect(wide.totals).toEqual(all.totals);
    const bad = (await (await fetch(`${base}/api/usage?turns=soon`)).json()) as UsageReport;
    expect(bad.turns).toBeNull();
    expect(bad.warnings[0]).toContain("turns=soon");
    // A lead's project budget replaces the sum.
    const ledger = server.project("default").project;
    ledger.join("lee", "Lee", "lead");
    ledger.setPolicy("lee", { tokenBudget: 1_000_000 });
    const set = (await (await fetch(`${base}/api/usage`)).json()) as UsageReport;
    expect(set.byProject[0]).toMatchObject({ budget: 1_000_000, budgetSource: "project" });
    expect(set.forecast.budget).toBe(1_000_000);
    ledger.setPolicy("lee", { tokenBudget: null });
  });

  it("reads sessions and ledgers from disk when nothing is hosted", async () => {
    const live = (await (await fetch(`${base}/api/usage`)).json()) as UsageReport;
    await server.close();
    const cold = new HenosisServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    expect(cold.projects.size).toBe(0);
    const fromDisk = computeUsage({ root, projects: cold.projects, orgs: cold.orgs });
    expect(fromDisk.totals).toEqual(live.totals);
    expect(fromDisk.bySession).toEqual(live.bySession);
    expect(fromDisk.byUser).toEqual(live.byUser);
    await cold.close();
    // Reopen for afterAll's close.
    server = new HenosisServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    base = `http://127.0.0.1:${await server.listen(0)}`;
  });
});
