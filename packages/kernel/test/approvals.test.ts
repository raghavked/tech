import { describe, expect, it } from "vitest";
import { describeRule, evaluate } from "../src/approvals.js";

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
