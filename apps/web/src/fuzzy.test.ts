import { describe, expect, it } from "vitest";
import { fuzzyScore, markup, matchSpans } from "./fuzzy.js";

describe("fuzzy matching", () => {
  it("scores a contiguous run at a word start above a scattered one, and 0 for no match", () => {
    expect(fuzzyScore("pro", "Approve push origin main")).toBeGreaterThan(0);
    expect(fuzzyScore("pro", "Proration credits")).toBeGreaterThan(
      fuzzyScore("pro", "Approve push origin main"),
    );
    expect(fuzzyScore("apv", "Approve")).toBeGreaterThan(0);
    expect(fuzzyScore("xyz", "Approve")).toBe(0);
    expect(fuzzyScore("", "anything")).toBe(1);
  });

  it("marks the matched letters without eating one", () => {
    expect(markup("pro", "Approve push origin main")).toBe("Ap<b>pro</b>ve push origin main");
    expect(markup("pro", "Approvals queue")).toBe("Ap<b>pro</b>vals queue");
    expect(markup("pro", "Open project Billing page")).toBe("Open <b>pro</b>ject Billing page");
    expect(markup("Pro", "Proration credits")).toBe("<b>Pro</b>ration credits");
    // A scattered match ranks the row but is not drawn.
    expect(markup("apv", "Approve")).toBe("Approve");
    expect(
      matchSpans("apv", "Approve")
        .map((s) => s.text)
        .join(""),
    ).toBe("Approve");
    expect(matchSpans("zz", "Approve")).toEqual([{ text: "Approve", match: false }]);
    expect(matchSpans("", "Approve")).toEqual([{ text: "Approve", match: false }]);
  });
});
