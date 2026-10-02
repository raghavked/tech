import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryStore } from "@fold/memory";
import { defaultTools, ScriptedModel } from "@fold/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entryMatches, memoryFeed, memoryQueryOf } from "../src/memoryQuery.js";
import { FoldServer } from "../src/server.js";

const org = { orgId: "northwind" };
const team = { orgId: "northwind", teamId: "payments" };
const project = { orgId: "northwind", teamId: "payments", projectId: "billing" };
const other = { orgId: "northwind", teamId: "growth", projectId: "onboarding" };
const ana = { userId: "ana", userName: "Ana", sessionId: "s-ana", agentId: "agent" };
const bo = { userId: "bo", userName: "Bo", sessionId: "s-bo", agentId: "agent" };
const dee = { userId: "dee", userName: "Dee", commitSha: "9f3c1a2b" };

function seeded(): MemoryStore {
  const m = MemoryStore.create("northwind");
  m.remember({ scope: org, key: "api.style", content: "REST with JSON bodies", attribution: dee });
  m.remember({
    scope: team,
    key: "ci.runner",
    content: "CI runs on the shared pool",
    attribution: ana,
  });
  const a = m.remember({
    scope: project,
    key: "db.engine",
    content: "We use Postgres 16 for billing",
    attribution: ana,
  });
  m.remember({
    scope: project,
    key: "db.engine",
    content: "Billing moved to CockroachDB",
    attribution: bo,
  });
  const gone = m.remember({
    scope: project,
    key: "tax.rounding",
    content: "Round tax to the cent after summing",
    attribution: ana,
  });
  m.retract(bo, gone.entry.id, "wrong since v2");
  m.remember({ scope: other, key: "signup.flow", content: "Magic links only", attribution: bo });
  expect(a.conflictId).toBeNull();
  return m;
}

describe("memory feed filters", () => {
  it("parses only the query parameters it knows", () => {
    expect(memoryQueryOf(new URLSearchParams("level=team&team=payments&q=%20postgres%20"))).toEqual(
      { level: "team", team: "payments", q: "postgres" },
    );
    expect(
      memoryQueryOf(new URLSearchParams("level=galaxy&status=active,bogus,retracted")),
    ).toEqual({ status: ["active", "retracted"] });
    expect(memoryQueryOf(new URLSearchParams(""))).toEqual({});
  });

  it("filters by level, team, project, status and text, keeping conflicts whose sides survive", () => {
    const st = seeded().state();
    const all = memoryFeed(st);
    expect(all.entries).toHaveLength(Object.keys(st.entries).length);
    expect(all.conflicts).toHaveLength(1);

    expect(memoryFeed(st, { level: "org" }).entries.map((e) => e.key)).toEqual(["api.style"]);
    expect(memoryFeed(st, { level: "team" }).entries.map((e) => e.key)).toEqual(["ci.runner"]);
    const proj = memoryFeed(st, { level: "project" });
    expect(proj.entries.every((e) => e.scope.projectId)).toBe(true);
    expect(proj.entries.some((e) => e.scope.projectId === "onboarding")).toBe(true);

    const payments = memoryFeed(st, { team: "payments" });
    expect(payments.entries.every((e) => e.scope.teamId === "payments")).toBe(true);
    expect(payments.entries.some((e) => e.key === "ci.runner")).toBe(true);
    expect(payments.conflicts).toHaveLength(1);

    const billing = memoryFeed(st, { project: "billing" });
    expect(billing.entries.every((e) => e.scope.projectId === "billing")).toBe(true);
    expect(billing.conflicts[0]?.key).toBe("db.engine");

    const onboarding = memoryFeed(st, { project: "onboarding" });
    expect(onboarding.entries.map((e) => e.key)).toEqual(["signup.flow"]);
    expect(onboarding.conflicts).toEqual([]);

    const retracted = memoryFeed(st, { status: ["retracted"] });
    expect(retracted.entries.map((e) => e.key)).toEqual(["tax.rounding"]);
    expect(retracted.entries[0]?.status).toBe("retracted");

    expect(memoryFeed(st, { q: "cockroach" }).entries.map((e) => e.attribution.userId)).toEqual([
      "bo",
    ]);
    expect(memoryFeed(st, { q: "9f3c1a" }).entries.map((e) => e.key)).toEqual(["api.style"]);
    expect(memoryFeed(st, { q: "s-ana", status: ["active"] }).entries.length).toBeGreaterThan(0);
    expect(memoryFeed(st, { q: "nothing-like-this" }).entries).toEqual([]);
    const e = Object.values(st.entries).find((x) => x.key === "signup.flow");
    expect(e && entryMatches(e, { team: "growth", q: "Bo" })).toBe(true);
    expect(e && entryMatches(e, { team: "payments" })).toBe(false);
  });
});

describe("GET /api/memory/:org with filters", () => {
  let root: string;
  let server: FoldServer;
  let base: string;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "fold-memq-"));
    server = new FoldServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    const port = await server.listen(0);
    base = `http://127.0.0.1:${port}`;
    const m = server.memory("northwind");
    m.remember({
      scope: team,
      key: "ci.runner",
      content: "CI runs on the shared pool",
      attribution: ana,
    });
    m.remember({ scope: project, key: "db.engine", content: "Postgres 16", attribution: ana });
    m.remember({ scope: project, key: "db.engine", content: "CockroachDB", attribution: bo });
    m.remember({ scope: other, key: "signup.flow", content: "Magic links only", attribution: bo });
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  const get = async (path: string) => {
    const res = await fetch(base + path);
    expect(res.status).toBe(200);
    return (await res.json()) as ReturnType<typeof memoryFeed>;
  };

  it("returns the whole feed without filters and a narrowed one with them", async () => {
    const all = await get("/api/memory/northwind");
    expect(all.orgId).toBe("northwind");
    expect(all.entries).toHaveLength(4);
    expect(all.conflicts).toHaveLength(1);
    const billing = await get("/api/memory/northwind?project=billing");
    expect(billing.entries.map((e) => e.key)).toEqual(["db.engine", "db.engine"]);
    expect(billing.conflicts).toHaveLength(1);
    const growth = await get("/api/memory/northwind?team=growth&q=magic");
    expect(growth.entries.map((e) => e.key)).toEqual(["signup.flow"]);
    expect(growth.conflicts).toEqual([]);
    const none = await get("/api/memory/northwind?level=org");
    expect(none.entries).toEqual([]);
    // The curator route still answers beside the filtered feed.
    const res = await fetch(`${base}/api/memory/northwind/curate`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { conflicts: unknown[] }).conflicts).toHaveLength(1);
  });
});
