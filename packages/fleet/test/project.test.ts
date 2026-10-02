import { Session } from "@tiller/kernel";
import { type Actor, DEFAULT_APPROVAL_POLICY, LEAD_RANK, MAIN_BRANCH } from "@tiller/protocol";
import { describe, expect, it } from "vitest";
import { fleetBrief } from "../src/brief.js";
import { detectFleetContentions } from "../src/contention.js";
import { deriveSessionRole, type User } from "../src/identity.js";
import { Project } from "../src/project.js";
import { propagateDirective, syncDirectives, withdrawPropagated } from "../src/propagate.js";
import { renderFleetContext } from "../src/render.js";
import { foldProject } from "../src/state.js";

const policy = { approvals: DEFAULT_APPROVAL_POLICY, contention: "block" as const, maxTurns: 50 };
const M = MAIN_BRANCH;

function setup() {
  const p = Project.create("billing", "northwind", "payments", "Billing page", {
    autoClaimOnWrite: true,
    claimTtlTurns: 0,
  });
  p.join("dee", "Dee", "lead");
  p.join("ana", "Ana", "member");
  p.join("bo", "Bo", "member");
  p.registerSession("s-ana", "ana", "Invoice PDF");
  p.registerSession("s-bo", "bo", "Tax lines");
  return p;
}

describe("project ledger and claims", () => {
  it("grants the first claim, denies the overlapping one and opens a contention the lead resolves", () => {
    const p = setup();
    const a = p.claim(
      "s-ana",
      { type: "path", pattern: "src/billing/" },
      "exclusive",
      "invoice work",
    );
    expect(a.granted).toBe(true);
    const b = p.claim(
      "s-bo",
      { type: "path", pattern: "src/billing/tax.ts" },
      "exclusive",
      "tax lines",
    );
    expect(b.granted).toBe(false);
    expect(b.holders.map((h) => h.id)).toEqual([a.claimId]);
    const st = p.state();
    expect(st.claims[b.claimId]?.status).toBe("denied");
    const ctn = Object.values(st.contentions).find((c) => !c.resolved);
    expect(ctn?.kind).toBe("claim");
    expect(ctn?.sessionIds).toEqual(["s-ana", "s-bo"]);
    expect(p.checkWrite("s-bo", "src/billing/tax.ts")).toMatchObject({ ok: false });
    expect(p.checkWrite("s-ana", "src/billing/tax.ts")).toEqual({ ok: true });
    expect(() => p.resolveContention("ana", ctn?.id ?? "", "s-bo")).toThrow(/lead/);
    p.resolveContention("dee", ctn?.id ?? "", "s-bo", "Bo owns tax this week");
    expect(p.state().claims[a.claimId]?.status).toBe("released");
    expect(
      p.claim("s-bo", { type: "path", pattern: "src/billing/tax.ts" }, "exclusive", "tax").granted,
    ).toBe(true);
    expect(p.ledger.verify()).toEqual({ ok: true });
    expect(JSON.stringify(Project.fromSerialized(p.ledger.serialize()).state())).toBe(
      JSON.stringify(p.state()),
    );
  });

  it("the verdict does not depend on who asks second", () => {
    const run = (first: string, second: string) => {
      const p = setup();
      p.claim(first, { type: "service", name: "stripe" }, "exclusive", "x");
      const v = p.claim(second, { type: "service", name: "stripe" }, "exclusive", "y");
      return { granted: v.granted, contention: Object.keys(p.state().contentions)[0] };
    };
    const ab = run("s-ana", "s-bo");
    const ba = run("s-bo", "s-ana");
    expect(ab.granted).toBe(false);
    expect(ba.granted).toBe(false);
    expect(ab.contention).toBe(ba.contention);
  });

  it("expires claims by turn ttl and releases on close", () => {
    const p = Project.create("x", "o", "t", "X", { autoClaimOnWrite: true, claimTtlTurns: 2 });
    p.join("ana", "Ana", "member");
    p.registerSession("s", "ana", "S");
    p.reportStatus({
      sessionId: "s",
      status: "idle",
      goal: null,
      turn: 1,
      summary: "",
      activePaths: [],
      pendingApprovals: 0,
    });
    const v = p.claim("s", { type: "ticket", key: "BIL-1" }, "exclusive", "");
    expect(p.expireStale()).toEqual([]);
    p.reportStatus({
      sessionId: "s",
      status: "idle",
      goal: null,
      turn: 3,
      summary: "",
      activePaths: [],
      pendingApprovals: 0,
    });
    // the report touches the claim, so it is fresh again
    expect(p.expireStale()).toEqual([]);
    p.registerSession("s2", "ana", "S2");
    p.claim("s2", { type: "ticket", key: "BIL-2" }, "exclusive", "");
    p.reportStatus({
      sessionId: "s2",
      status: "idle",
      goal: null,
      turn: 10,
      summary: "",
      activePaths: [],
      pendingApprovals: 0,
    });
    p.closeSession("s");
    expect(p.state().claims[v.claimId]?.status).toBe("released");
  });
});

describe("project directives propagate into sessions", () => {
  const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
  it("a lead's steer outranks the owner's in the same scope; withdrawal restores it", () => {
    const p = setup();
    const s = Session.create("s-ana", "Invoice PDF", policy, {
      projectId: "billing",
      ownerId: "ana",
    });
    s.join(M, ana, "owner");
    s.directive(M, "ana", { text: "Use Stripe tax API", scope: "tax" });
    expect(() => p.directive("ana", { text: "x" })).toThrow(/lead/);
    const ev = p.directive("dee", { text: "Use local tax tables until Thursday", scope: "tax" });
    const d = Object.values(p.state().directives)[0];
    propagateDirective(p.state(), d as NonNullable<typeof d>, "s-ana", s);
    let st = s.state();
    expect(st.intent.steers.tax?.text).toBe("Use local tax tables until Thursday");
    expect(st.intent.steers.tax?.origin).toBe("project");
    const projectRecord = Object.values(st.directives).find((x) => x.origin === "project");
    expect(projectRecord?.rank).toBe(LEAD_RANK);
    expect(Object.values(st.directives).find((x) => x.author === "ana")?.status).toBe("shadowed");
    // Idempotent re-sync, then withdrawal.
    syncDirectives(p.state(), "s-ana", s);
    expect(Object.values(s.state().directives).filter((x) => x.origin === "project")).toHaveLength(
      1,
    );
    expect(ev.kind).toBe("project.directive.submitted");
    p.withdrawDirective("dee", d?.id ?? "");
    withdrawPropagated(d as NonNullable<typeof d>, s);
    st = s.state();
    expect(st.intent.steers.tax?.text).toBe("Use Stripe tax API");
    expect(st.intent.steers.tax?.origin).toBe("session");
  });

  it("constraints from the project stack with session constraints and reach forks", () => {
    const p = setup();
    const s = Session.create("s-ana", "Invoice PDF", policy, {
      projectId: "billing",
      ownerId: "ana",
    });
    s.join(M, ana, "owner");
    s.directive(M, "ana", { text: "goal" });
    s.directive(M, "ana", { text: "no new deps", mode: "constrain" });
    s.fork(M, "ana", "spike");
    p.directive("dee", { text: "schema freeze until Thursday", mode: "constrain" });
    syncDirectives(p.state(), "s-ana", s);
    for (const b of [M, "spike"]) {
      expect(s.state(b).intent.constraints.map((c) => c.text)).toEqual([
        "no new deps",
        "schema freeze until Thursday",
      ]);
    }
  });
});

describe("fleet contention detection, brief, identity, rendering", () => {
  it("flags two sessions writing the same unclaimed path, and merge conflicts on claimed paths", () => {
    const p = setup();
    const mk = (id: string, owner: string) => {
      const s = Session.create(id, id, policy, { projectId: "billing", ownerId: owner });
      s.join(M, { id: owner, kind: "human", name: owner }, "owner");
      s.join(M, { id: "agent", kind: "agent", name: "Agent" }, "contributor");
      s.directive(M, owner, { text: "go" });
      return s;
    };
    const a = mk("s-ana", "ana");
    const b = mk("s-bo", "bo");
    for (const s of [a, b]) {
      s.turnStarted(M, "agent");
      s.modelCompleted(
        M,
        "agent",
        "",
        [
          {
            id: "c",
            name: "workspace.write",
            args: { path: "src/shared.ts", content: "" },
            risk: "write",
          },
        ],
        "m",
      );
      s.writeFile(M, "agent", "src/shared.ts", s === a ? "a" : "b");
      s.turnEnded(M, "agent", "done", "wrote");
    }
    const found = detectFleetContentions(p.state(), { "s-ana": a.state(), "s-bo": b.state() });
    expect(found).toEqual([
      {
        kind: "path-overlap",
        sessionIds: ["s-ana", "s-bo"],
        resource: "path:src/shared.ts",
        detail: "both sessions wrote src/shared.ts without a claim",
      },
    ]);
    const id = p.openContention(
      found[0]?.kind ?? "path-overlap",
      found[0]?.sessionIds ?? [],
      found[0]?.resource ?? "",
      found[0]?.detail ?? "",
    );
    expect(p.openContention("path-overlap", ["s-bo", "s-ana"], "path:src/shared.ts", "dup")).toBe(
      id,
    );
    // Claimed path + merge conflict in the other session.
    p.claim("s-ana", { type: "path", pattern: "src/conf.ts" }, "exclusive", "mine");
    b.fork(M, "bo", "alt");
    b.writeFile(M, "agent", "src/conf.ts", "1\n2");
    b.writeFile("alt", "agent", "src/conf.ts", "1\n3");
    b.writeFile(M, "agent", "src/conf.ts", "1\n4");
    b.merge(M, "bo", "alt");
    expect(b.state().openConflicts).toEqual(["src/conf.ts"]);
    const again = detectFleetContentions(p.state(), { "s-ana": a.state(), "s-bo": b.state() });
    expect(again.some((c) => c.kind === "merge-conflict" && c.sessionIds.includes("s-ana"))).toBe(
      true,
    );
    const brief = fleetBrief(p.state(), { sessions: { "s-ana": a.state(), "s-bo": b.state() } });
    expect(brief).toContain("Contention (path-overlap)");
    expect(brief).toContain("path:src/conf.ts (exclusive) held by Ana's session");
    expect(brief).toContain("Bo's session is blocked");
    const ctx = renderFleetContext(p.state(), "s-bo");
    expect(ctx).toContain("Ana's agent");
    expect(ctx).toContain("fleet contention");
    expect(renderFleetContext(p.state(), "nobody")).toContain("OTHER AGENTS");
  });

  it("derives session roles from memberships", () => {
    const ref = { orgId: "northwind", teamId: "payments", projectId: "billing" };
    const lead: User = {
      id: "dee",
      name: "Dee",
      orgs: [],
      teams: [{ teamId: "payments", role: "lead" }],
      projects: [],
    };
    const member: User = {
      id: "bo",
      name: "Bo",
      orgs: [],
      teams: [],
      projects: [{ projectId: "billing", role: "member" }],
    };
    const outsider: User = {
      id: "zed",
      name: "Zed",
      orgs: [{ orgId: "other", role: "admin" }],
      teams: [],
      projects: [],
    };
    expect(deriveSessionRole(lead, ref, "ana")).toBe("owner");
    expect(deriveSessionRole(member, ref, "ana")).toBe("contributor");
    expect(deriveSessionRole(member, ref, "bo")).toBe("owner");
    expect(deriveSessionRole(outsider, ref, "ana")).toBe("observer");
  });

  it("folds the ledger deterministically", () => {
    const p = setup();
    p.claim("s-ana", { type: "path", pattern: "a/" }, "exclusive", "");
    p.note("dee", "hello");
    expect(JSON.stringify(foldProject(p.events()))).toBe(JSON.stringify(p.state()));
  });
});
