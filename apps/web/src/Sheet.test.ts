import { describe, expect, it } from "vitest";
import { SHEET_CLOSE_PX, SHEET_LIFT_PX, settleDrag } from "./Sheet.js";

describe("the one bottom sheet's detents", () => {
  it("settles where it started on a short drag", () => {
    expect(settleDrag("half", 20)).toBe("half");
    expect(settleDrag("half", -20)).toBe("half");
    expect(settleDrag("full", 40)).toBe("full");
  });

  it("pulled down past the threshold: full drops to half, half closes", () => {
    expect(settleDrag("full", SHEET_CLOSE_PX + 1)).toBe("half");
    expect(settleDrag("half", SHEET_CLOSE_PX + 1)).toBe("closed");
    expect(settleDrag("half", SHEET_CLOSE_PX)).toBe("half");
  });

  it("lifted past the threshold from half goes full; full has nowhere to go", () => {
    expect(settleDrag("half", -(SHEET_LIFT_PX + 1))).toBe("full");
    expect(settleDrag("full", -(SHEET_LIFT_PX + 1))).toBe("full");
  });
});
