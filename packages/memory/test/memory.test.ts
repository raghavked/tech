import { describe, expect, it } from "vitest";
import { Curator } from "../src/curator.js";
import { scopeChain, scopeCovers } from "../src/events.js";
import { foldMemory } from "../src/state.js";
import { MemoryStore } from "../src/store.js";

const org = { orgId: "northwind" };
const team = { orgId: "northwind", teamId: "payments" };
const project = { orgId: "northwind", teamId: "payments", projectId: "billing" };
const ana = { userId: "ana", userName: "Ana", sessionId: "s-ana", agentId: "agent" };
const bo = { userId: "bo", userName: "Bo", sessionId: "s-bo", agentId: "agent" };
const dee = { userId: "dee", userName: "Dee", commitSha: "9f3c1a2b" };

describe("scopes", () => {
  it("chain is narrowest first and coverage is ancestor-or-equal", () => {
    expect(
      scopeChain({ ...project, path: "src/billing/" }).map(
        (s) => s.path ?? s.projectId ?? s.teamId ?? s.orgId,
      ),
    ).toEqual(["src/billing/", "billing", "payments", "northwind"]);
    expect(scopeCovers(org, project)).toBe(true);
    expect(scopeCovers(project, org)).toBe(false);
    expect(
      scopeCovers({ ...project, path: "src/billing/" }, { ...project, path: "src/billing/tax.ts" }),
    ).toBe(true);
    expect(
      scopeCovers({ ...project, path: "src/billing/" }, { ...project, path: "src/other.ts" }),
    ).toBe(false);
  });
});

describe("memory store", () => {
  it("attributes entries, supersedes an author's own update, and surfaces cross-author conflicts", () => {
    const m = MemoryStore.create("northwind");
    const a1 = m.remember({
      scope: project,
      key: "db.engine",
      content: "We use Postgres 16 for billing",
      attribution: ana,
    });
    expect(a1.entry.trust).toBe("agent");
    expect(a1.conflictId).toBeNull();
    const a2 = m.remember({
      scope: project,
      key: "db.engine",
      content: "We use Postgres 16; pgbouncer in front",
      attribution: ana,
    });
    expect(a2.superseded).toEqual([a1.entry.id]);
    expect(m.state().entries[a1.entry.id]?.status).toBe("superseded");
    const b1 = m.remember({
      scope: project,
      key: "db.engine",
      content: "Billing moved to CockroachDB",
      attribution: bo,
    });
    expect(b1.conflictId).not.toBeNull();
    const ctx = m.contextFor(project, "s-cy");
    expect(ctx).toContain("TEAM MEMORY CONFLICTS");
    expect(ctx).toContain("Postgres 16; pgbouncer in front (Ana, via agent, session s-ana)");
    expect(ctx).toContain("CockroachDB (Bo, via agent, session s-bo)");
    m.resolveConflict("dee", b1.conflictId ?? "", a2.entry.id, "Cockroach was a spike");
    expect(m.state().entries[b1.entry.id]?.status).toBe("superseded");
    const ctx2 = m.contextFor(project, "s-cy");
    expect(ctx2).not.toContain("CONFLICTS");
    expect(ctx2).toContain("pgbouncer");
    expect(ctx2).not.toContain("Cockroach");
  });

  it("narrower scope wins on the same key; retraction is an authored tombstone; redaction keeps the trail", () => {
    const m = MemoryStore.create("northwind");
    const o = m.remember({
      scope: org,
      key: "api.style",
      content: "REST everywhere",
      attribution: dee,
    });
    expect(o.entry.trust).toBe("commit");
    m.remember({
      scope: project,
      key: "api.style",
      content: "GraphQL for billing only",
      attribution: ana,
    });
    const ctx = m.contextFor(project, "x");
    expect(ctx).toContain("GraphQL for billing only");
    expect(ctx).not.toContain("REST everywhere");
    expect(m.contextFor(team, "x")).toContain("REST everywhere (Dee, commit 9f3c1a2)");
    const t = m.retract(ana, o.entry.id, "we moved to GraphQL org-wide");
    expect(t.retracts).toBe(o.entry.id);
    expect(m.state().entries[o.entry.id]?.status).toBe("retracted");
    expect(m.contextFor(team, "x")).not.toContain("REST everywhere");
    m.redact("dee", t.id);
    expect(m.state().entries[t.id]?.content).toBe("[redacted]");
    expect(m.state().entries[t.id]?.attribution.userId).toBe("ana");
    expect(m.ledger.verify()).toEqual({ ok: true });
    expect(JSON.stringify(foldMemory(m.ledger.eventsOf("main")))).toBe(JSON.stringify(m.state()));
    expect(JSON.stringify(MemoryStore.fromSerialized(m.ledger.serialize()).state())).toBe(
      JSON.stringify(m.state()),
    );
  });

  it("compaction folds a level into an attributed summary and the curator triggers it", () => {
    const m = MemoryStore.create("northwind", {
      coreBudgetBytes: 24_000,
      compactAfter: 3,
      staleAfter: 5,
    });
    for (let i = 0; i < 5; i++)
      m.remember({
        scope: project,
        key: `fact.${i}`,
        content: `fact number ${i}`,
        attribution: i % 2 ? ana : bo,
        trust: i === 4 ? "human" : undefined,
      });
    const open = m.remember({ scope: project, key: "x", content: "A", attribution: ana });
    m.remember({ scope: project, key: "x", content: "B", attribution: bo });
    const curator = new Curator(m);
    const r1 = curator.tick();
    expect(r1.compacted).toHaveLength(1);
    expect(r1.conflicts).toHaveLength(1);
    const summary = m.state().entries[r1.compacted[0]?.summaryId ?? ""];
    expect(summary?.level).toBe(1);
    expect(summary?.derivedFrom).toHaveLength(5);
    expect(summary?.trust).toBe("human");
    expect(summary?.tags).toEqual(expect.arrayContaining(["by:ana", "by:bo"]));
    expect(summary?.content).toContain("fact number 4 (Bo, human)");
    // Conflicting entries are never folded.
    expect(summary?.derivedFrom).not.toContain(open.entry.id);
    for (const id of summary?.derivedFrom ?? [])
      expect(m.state().entries[id]?.status).toBe("folded");
    const ctx = m.contextFor(project, "reader");
    expect(ctx).toContain("Level 1 summary");
    expect(ctx).toContain("(Curator)");
    // Stale detection: agent-written entries unread for longer than the policy.
    const m2 = MemoryStore.create("northwind", {
      coreBudgetBytes: 24_000,
      compactAfter: 100,
      staleAfter: 2,
    });
    const e = m2.remember({ scope: org, key: "k", content: "old", attribution: ana });
    for (let i = 0; i < 4; i++)
      m2.remember({ scope: org, key: `n${i}`, content: `new ${i}`, attribution: dee });
    const r2 = new Curator(m2).tick();
    expect(r2.stale.map((s) => s.id)).toContain(e.entry.id);
    expect(r2.proposedRetractions[0]?.id).toBe(e.entry.id);
    expect(r2.stale.some((s) => s.author === "dee")).toBe(false);
  });

  it("recall and knows search the covering scopes; context honours the budget", () => {
    const m = MemoryStore.create("northwind", {
      coreBudgetBytes: 160,
      compactAfter: 100,
      staleAfter: 100,
    });
    m.remember({
      scope: org,
      key: "auth",
      content: "SSO through Okta",
      attribution: dee,
      tags: ["security"],
    });
    m.remember({
      scope: project,
      content: "Invoices are generated nightly at 02:00 UTC",
      attribution: ana,
    });
    expect(m.knows(project, "auth")).toBe(true);
    expect(m.knows(org, "invoices")).toBe(false);
    expect(m.recall(project, "okta").map((e) => e.key)).toEqual(["auth"]);
    expect(m.recall(project, "security")).toHaveLength(1);
    const ctx = m.contextFor(project, "r");
    expect(ctx.length).toBeLessThanOrEqual(170);
    expect(
      m.state().entries[m.recall(project, "nightly")[0]?.id ?? ""]?.reads,
    ).toBeGreaterThanOrEqual(0);
  });
});
