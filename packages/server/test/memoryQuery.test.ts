import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryStore } from "@henosis/memory";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  entryMatches,
  LAST_HOUR_MS,
  memoryFeed,
  memoryQueryOf,
  memoryStats,
  STILL_READ_WINDOW_MS,
} from "../src/memoryQuery.js";
import { HenosisServer } from "../src/server.js";

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

  it("the aside's figures come from the read log: read in the last hour, oldest still read", () => {
    const m = seeded();
    const T = 1_700_000_000_000;
    let now = T - 3 * 24 * 3600_000;
    m.now = () => now;
    // Three days ago a session read the org and team entries; an hour ago another read the team's.
    m.contextFor(team, "s-old");
    now = T - LAST_HOUR_MS + 5_000;
    m.contextFor(team, "s-ana");
    now = T - 60_000;
    m.contextFor(project, "s-bo");
    const feed = memoryFeed(m.state(), {}, T);
    const st = feed.stats;
    expect(st.now).toBe(T);
    expect(st.openConflicts).toBe(1);
    expect(st.retracted).toBe(1);
    expect(st.entries).toBe(
      Object.values(m.state().entries).filter(
        (e) => e.status === "active" && e.kind !== "retraction",
      ).length,
    );
    // The org and team entries were read in the last hour, and so were both sides of the
    // project's open conflict (a reader sees them first). Readers: s-ana and s-bo, not s-old.
    expect(st.readInLastHour).toBe(4);
    expect(st.readersInLastHour).toBe(2);
    // The oldest entry still read within the window is the org's api.style.
    expect(st.oldestStillRead).toMatchObject({ key: "api.style", at: T - 60_000 });
    // A scope filter narrows the figures with the entries.
    const growth = memoryFeed(m.state(), { team: "growth" }, T).stats;
    expect(growth.readInLastHour).toBe(0);
    expect(growth.oldestStillRead).toBeNull();
    // Beyond the window nothing is "still read".
    expect(
      memoryStats(feed.entries, feed.conflicts, T + STILL_READ_WINDOW_MS + 1).oldestStillRead,
    ).toBeNull();
    // Entries folded before the read log existed have no log and count as never read.
    const bare = feed.entries.map((e) => ({ ...e, readLog: undefined, lastReadAt: null }));
    expect(memoryStats(bare as typeof feed.entries, feed.conflicts, T).readInLastHour).toBe(0);
  });
});

describe("GET /api/memory/:org with filters", () => {
  let root: string;
  let server: HenosisServer;
  let base: string;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-memq-"));
    writeFileSync(
      join(root, "users.json"),
      JSON.stringify({
        users: [
          { id: "ana", name: "Ana", orgs: [{ orgId: "northwind", role: "member" }] },
          // Dee is known but placed nowhere: an observer everywhere until a lead adds her.
          { id: "dee", name: "Dee" },
        ],
      }),
    );
    server = new HenosisServer({ root, model: new ScriptedModel(), tools: defaultTools() });
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
    expect(all.stats).toMatchObject({ openConflicts: 1, retracted: 0, readInLastHour: 0 });
  });

  it("a person keeps one side of a conflict or retracts an entry, in their name", async () => {
    const post = (path: string, body: unknown) =>
      fetch(base + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const before = await get("/api/memory/northwind?project=billing");
    const conflict = before.conflicts[0];
    const winner = before.entries.find((e) => e.attribution.userId === "ana")?.id;
    const loser = before.entries.find((e) => e.attribution.userId === "bo")?.id;
    expect(conflict && winner && loser).toBeTruthy();
    // Nobody signed in: refused. The curator never keeps or retracts.
    expect((await post("/api/memory/northwind/keep", { conflictId: conflict?.id })).status).toBe(
      403,
    );
    expect((await post("/api/memory/northwind/keep?user=curator", {})).status).toBe(403);
    // An observer may read the team's memory but not change it: a contributor keeps or retracts.
    const dee = await post("/api/memory/northwind/keep?user=dee&project=billing", {
      conflictId: conflict?.id,
      winnerId: winner,
    });
    expect(dee.status).toBe(403);
    expect(((await dee.json()) as { error: string }).error).toMatch(/contributor/);
    expect(
      (await post("/api/memory/northwind/retract?user=dee", { entryId: loser, reason: "no" }))
        .status,
    ).toBe(403);
    expect((await get("/api/memory/northwind?project=billing")).conflicts[0]?.resolved).toBeFalsy();
    // Ana, a person in users.json, keeps her side; the loser is retracted in her name.
    const who = "ana";
    const res = await post(`/api/memory/northwind/keep?user=${who}&project=billing`, {
      conflictId: conflict?.id,
      winnerId: winner,
      note: "pgbouncer is what runs",
    });
    expect(res.status).toBe(200);
    const after = (await res.json()) as ReturnType<typeof memoryFeed>;
    expect(after.conflicts[0]).toMatchObject({ resolved: true, winnerId: winner });
    const lost = after.entries.find((e) => e.id === loser);
    expect(lost?.status).toBe("retracted");
    const tombstone = after.entries.find((e) => e.kind === "retraction" && e.retracts === loser);
    expect(tombstone?.attribution.userId).toBe(who);
    expect(tombstone?.reason).toBe("pgbouncer is what runs");
    // A plain retraction, with a reason, in the person's name.
    const r2 = await post(`/api/memory/northwind/retract?user=${who}`, {
      entryId: winner,
      reason: "superseded by the runbook",
    });
    expect(r2.status).toBe(200);
    const feed2 = (await r2.json()) as ReturnType<typeof memoryFeed>;
    expect(feed2.entries.find((e) => e.id === winner)?.status).toBe("retracted");
    expect((await post(`/api/memory/northwind/retract?user=${who}`, {})).status).toBe(400);
  });
});
