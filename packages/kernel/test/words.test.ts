import { describe, expect, it } from "vitest";
import { describeEstimate, shortHash, starGlyphs, starsWithNumber } from "../src/words.js";

describe("words shared by the surfaces outside the window", () => {
  it("draws a rating as five glyphs plus the number", () => {
    expect(starGlyphs(4)).toBe("★★★★☆");
    expect(starGlyphs(5)).toBe("★★★★★");
    expect(starGlyphs(0)).toBe("☆☆☆☆☆");
    expect(starGlyphs(9)).toBe("★★★★★");
    expect(starsWithNumber(4)).toBe("★★★★☆ 4");
    expect(starsWithNumber(4.5)).toBe("★★★★★ 4.5");
  });

  it("says estimate → actual one way: over in percent, under in a word, nothing yet as the estimate", () => {
    expect(describeEstimate(44_000, 61_000)).toEqual({
      text: "est 44k → 61k, +38%",
      tone: "over",
      pct: 38,
    });
    expect(describeEstimate(22_000, 19_000)).toEqual({
      text: "est 22k → 19k, under",
      tone: "under",
      pct: -13,
    });
    expect(describeEstimate(18_000, null)).toEqual({ text: "est 18k", tone: "none", pct: null });
    expect(describeEstimate(18_000, 0).tone).toBe("none");
    expect(describeEstimate(0, 500)).toEqual({ text: "est 0 → 500", tone: "over", pct: null });
  });

  it("shortens a hash to its ends", () => {
    expect(shortHash("3f9a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2")).toBe("3f9a…b1c2");
    expect(shortHash("abcd")).toBe("abcd");
    expect(shortHash(null)).toBe("—");
  });
});
