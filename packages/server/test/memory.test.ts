import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryStore } from "@fold/memory";
import { defaultTools, ScriptedModel } from "@fold/runner";
import { describe, expect, it } from "vitest";
import { ProjectHost } from "../src/projectHost.js";

const sessionPolicy = {
  approvals: {
    read: "none",
    write: "none",
    exec: "none",
    external: "none",
    irreversible: "none",
  } as const,
  contention: "block" as const,
  maxTurns: 40,
};

describe("organisation memory through the project host", () => {
  it("an agent's memory write is attributed to its engineer and reaches the next engineer's agent", async () => {
    const root = mkdtempSync(join(tmpdir(), "fold-mem-"));
    const memory = MemoryStore.create("northwind");
    const host = new ProjectHost({
      root,
      projectId: "billing",
      orgId: "northwind",
      teamId: "payments",
      name: "Billing",
      model: new ScriptedModel(),
      tools: defaultTools(),
      sessionPolicy,
      memory,
    });
    host.project.join("ana", "Ana", "member");
    host.project.join("bo", "Bo", "member");
    const a = host.session("s-ana", { title: "Helper", ownerId: "ana" });
    a.session.join("main", { id: "ana", kind: "human", name: "Ana" }, "owner");
    a.session.directive("main", "ana", { text: "Build a doubling helper" });
    await a.drive("main");
    const entries = Object.values(memory.state().entries);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.attribution).toMatchObject({
      userId: "ana",
      userName: "Ana",
      agentId: "agent",
      sessionId: "s-ana",
    });
    expect(entries[0]?.key).toBe("module.build_a_doubling_helper");
    expect(entries[0]?.scope).toEqual({
      orgId: "northwind",
      teamId: "payments",
      projectId: "billing",
    });
    const written = a.session
      .state()
      .turns.flatMap((t) => t.toolResults)
      .find((r) => r.output.startsWith("remembered"));
    expect(written?.output).toContain("as Ana");

    // Bo's agent, in a different project of the same team, sees the team-level context only if scoped so;
    // in the same project it sees Ana's entry with attribution.
    const b = host.session("s-bo", { title: "Something else", ownerId: "bo" });
    b.session.join("main", { id: "bo", kind: "human", name: "Bo" }, "owner");
    b.session.directive("main", "bo", { text: "Build a tripling helper" });
    await b.drive("main");
    const ctx = memory.contextFor(
      { orgId: "northwind", teamId: "payments", projectId: "billing" },
      "test",
    );
    expect(ctx).toContain("build_a_doubling_helper lives in src/build_a_doubling_helper.mjs");
    expect(ctx).toContain("(Ana, via agent, session s-ana)");
    expect(memory.state().entries[entries[0]?.id ?? ""]?.reads).toBeGreaterThan(0);
    // Bo's own fact is attributed to Bo, under a different key: no conflict.
    const bos = Object.values(memory.state().entries).find((e) => e.attribution.userId === "bo");
    expect(bos?.key).toBe("module.build_a_tripling_helper");
    expect(Object.keys(memory.state().conflicts)).toHaveLength(0);
    expect(memory.ledger.verify()).toEqual({ ok: true });
    host.close();
    rmSync(root, { recursive: true, force: true });
  });
});
