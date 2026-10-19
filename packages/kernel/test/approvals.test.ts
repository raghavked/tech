import { DEFAULT_APPROVAL_POLICY } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import { canOverride, describeRule, evaluate, ownerOverride } from "../src/approvals.js";

const rank = (id: string) =>
  ({ owner: 3, driver: 2, contrib: 1, obs: 0, contrib2: 1, driver2: 2 })[id] ?? -1;

describe("approvals", () => {
  it("single-role rules", () => {
    expect(evaluate("none", {}, rank)).toBe("granted");
    expect(evaluate("contributor", {}, rank)).toBe("pending");
    expect(evaluate("contributor", { obs: "approve" }, rank)).toBe("pending");
    expect(evaluate("contributor", { contrib: "approve" }, rank)).toBe("granted");
    expect(evaluate("driver", { contrib: "approve" }, rank)).toBe("pending");
    expect(evaluate("driver", { owner: "approve" }, rank)).toBe("granted");
    expect(evaluate("driver", { owner: "approve", driver: "deny" }, rank)).toBe("denied");
    expect(evaluate("owner", { driver: "deny" }, rank)).toBe("pending");
  });

  it("quorum rules need distinct eligible approvers", () => {
    const q = { quorum: 2, of: "driver" as const };
    expect(evaluate(q, { driver: "approve" }, rank)).toBe("pending");
    expect(evaluate(q, { driver: "approve", contrib: "approve" }, rank)).toBe("pending");
    expect(evaluate(q, { driver: "approve", driver2: "approve" }, rank)).toBe("granted");
    expect(evaluate(q, { driver: "approve", owner: "approve" }, rank)).toBe("granted");
    expect(evaluate(q, { driver: "approve", owner: "deny" }, rank)).toBe("denied");
    expect(describeRule(q)).toBe("2 distinct drivers or above");
  });
});

describe("owner override (Decision 3)", () => {
  const gate = { ratings: { min: 2, average: 4, of: "contributor" as const } };
  const quorum = { quorum: 2, of: "driver" as const };

  it("exists only where one owner's vote would not already grant the call", () => {
    expect(ownerOverride(DEFAULT_APPROVAL_POLICY, "irreversible")).toEqual({
      risk: "irreversible",
      rule: gate,
      requires: describeRule(gate),
    });
    expect(ownerOverride({ ...DEFAULT_APPROVAL_POLICY, exec: quorum }, "exec")?.requires).toBe(
      "2 distinct drivers or above",
    );
    // A single-role rule: the owner outranks it, so there is nothing to override.
    expect(ownerOverride(DEFAULT_APPROVAL_POLICY, "external")).toBeNull();
    expect(ownerOverride(DEFAULT_APPROVAL_POLICY, "read")).toBeNull();
    expect(
      ownerOverride({ ...DEFAULT_APPROVAL_POLICY, exec: { quorum: 1, of: "driver" } }, "exec"),
    ).toBeNull();
    expect(canOverride(3)).toBe(true);
    expect(canOverride(2)).toBe(false);
  });

  it("grants on an owner's override alone, never on a lesser rank's, and never over a deny", () => {
    const override = { vote: "approve" as const, rating: null, note: "", override: true };
    expect(evaluate(gate, { owner: override }, rank)).toBe("granted");
    expect(evaluate(quorum, { owner: override }, rank)).toBe("granted");
    // A plain owner approve under the gate is one voice, not the whole quorum.
    expect(evaluate(gate, { owner: { vote: "approve", rating: 5, note: "" } }, rank)).toBe(
      "pending",
    );
    expect(evaluate(gate, { driver: override }, rank)).toBe("pending");
    expect(evaluate(gate, { owner: override, contrib: "deny" }, rank)).toBe("denied");
  });
});
