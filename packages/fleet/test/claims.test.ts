import { describe, expect, it } from "vitest";
import {
  type ClaimRecord,
  claimConflictId,
  conflictingClaims,
  holderOf,
  resourcesOverlap,
} from "../src/claims.js";

const claim = (
  id: string,
  sessionId: string,
  pattern: string,
  mode: "exclusive" | "shared" = "exclusive",
  seq = 0,
): ClaimRecord => ({
  id,
  sessionId,
  ownerId: `${sessionId}-owner`,
  resource: { type: "path", pattern },
  mode,
  reason: "",
  requestedSeq: seq,
  status: "active",
  lastTouchedTurn: 0,
});

describe("resource overlap", () => {
  it("paths overlap by containment, services and tickets by equality", () => {
    const p = (pattern: string) => ({ type: "path" as const, pattern });
    expect(resourcesOverlap(p("src/billing/"), p("src/billing/invoice.ts"))).toBe(true);
    expect(resourcesOverlap(p("src/billing/**"), p("src/billing/x/y.ts"))).toBe(true);
    expect(resourcesOverlap(p("src/billing"), p("src/billingx/a.ts"))).toBe(false);
    expect(resourcesOverlap(p("a.ts"), p("a.ts"))).toBe(true);
    expect(resourcesOverlap(p("a.ts"), p("b.ts"))).toBe(false);
    expect(
      resourcesOverlap({ type: "service", name: "stripe" }, { type: "service", name: "stripe" }),
    ).toBe(true);
    expect(
      resourcesOverlap({ type: "service", name: "stripe" }, { type: "ticket", key: "stripe" }),
    ).toBe(false);
  });

  it("exclusive conflicts with anything; shared tolerates shared", () => {
    const active = [
      claim("a", "s1", "src/", "exclusive", 1),
      claim("b", "s2", "docs/", "shared", 2),
    ];
    expect(
      conflictingClaims(
        { sessionId: "s3", resource: { type: "path", pattern: "src/x.ts" }, mode: "shared" },
        active,
      ).map((c) => c.id),
    ).toEqual(["a"]);
    expect(
      conflictingClaims(
        { sessionId: "s3", resource: { type: "path", pattern: "docs/a.md" }, mode: "shared" },
        active,
      ),
    ).toEqual([]);
    expect(
      conflictingClaims(
        { sessionId: "s3", resource: { type: "path", pattern: "docs/a.md" }, mode: "exclusive" },
        active,
      ).map((c) => c.id),
    ).toEqual(["b"]);
    expect(
      conflictingClaims(
        { sessionId: "s1", resource: { type: "path", pattern: "src/x.ts" }, mode: "exclusive" },
        active,
      ),
    ).toEqual([]);
    expect(holderOf("src/deep/file.ts", "s9", active)?.id).toBe("a");
    expect(holderOf("src/deep/file.ts", "s1", active)).toBeNull();
  });

  it("conflict ids are a function of the set, not the order", () => {
    const r = { type: "path" as const, pattern: "src/" };
    expect(claimConflictId(r, ["s2", "s1"])).toBe(claimConflictId(r, ["s1", "s2"]));
    expect(claimConflictId(r, ["s1", "s2"])).not.toBe(claimConflictId(r, ["s1", "s3"]));
  });
});
