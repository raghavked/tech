import { describe, expect, it } from "vitest";
import {
  barWidth,
  changesOf,
  checksOf,
  contrast,
  DEFAULTS,
  draftOf,
  fixFor,
  lowOf,
  nearestPassing,
  ratioText,
  themeOf,
} from "./look.js";
import { TEAM_PRESETS } from "./theme.js";

describe("team look checks", () => {
  it("computes every ratio; the judged draft's arcs print 2.6 : 1 low, never 4.2 fine", () => {
    // The board hand-typed 4.2 : 1 for #A8623F against #E4B98C; the real value is 2.6 : 1.
    expect(ratioText(contrast("#A8623F", "#E4B98C"))).toBe("2.6");
    const draft = { ...DEFAULTS, accent: "#A8623F", highlight: "#E4B98C" };
    const checks = checksOf(draft);
    const arcs = checks.find((c) => c.id === "arcs");
    expect(arcs?.cream.ok).toBe(false);
    expect(ratioText(arcs?.cream.ratio ?? 0)).toBe("2.6");
    // Three low checks on the judged draft: the hand as text on cream, text on the hand, the arcs.
    const low = lowOf(checks);
    expect(low.map((l) => `${l.check.id}/${l.canvas}`)).toEqual([
      "hand-text/cream",
      "text-on-hand/cream",
      "arcs/cream",
      "arcs/dark",
    ]);
    // The word and the count follow the same `ok`, so 4.4 can never read "fine" beside >= 4.5.
    for (const c of checks) {
      expect(c.cream.ok).toBe(c.cream.ratio >= c.min);
      expect(c.dark.ok).toBe(c.dark.ratio >= c.min);
    }
  });

  it("the palette passes everything on both canvases, and so do the three presets", () => {
    for (const p of TEAM_PRESETS) {
      const d = draftOf(p.theme);
      expect(lowOf(checksOf(d)).map((l) => `${p.id}:${l.check.id}/${l.canvas}`)).toEqual([]);
    }
    expect(lowOf(checksOf(DEFAULTS))).toEqual([]);
  });

  it("on the dark canvas the highlight is the hand, so the dark column differs from cream", () => {
    const checks = checksOf(DEFAULTS);
    const hand = checks.find((c) => c.id === "hand-text");
    expect(hand?.cream.pair).toEqual(["#56352D", "#FBF7F1"]);
    expect(hand?.dark.pair).toEqual(["#E2C4A6", "#1A202C"]);
    const onHand = checks.find((c) => c.id === "text-on-hand");
    expect(onHand?.dark.pair).toEqual(["#E2C4A6", "#2A3244"]);
  });

  it("names the nearest passing colour and offers it for the first low cell", () => {
    const draft = { ...DEFAULTS, accent: "#A8623F", highlight: "#E4B98C" };
    const fix = fixFor(draft, checksOf(draft));
    expect(fix?.key).toBe("accent");
    expect(fix?.from).toBe("#A8623F");
    // A shade deeper than the terracotta, and it clears cream and the hand's text.
    expect(fix?.to).not.toBe("#A8623F");
    expect(contrast(fix?.to ?? "", "#FBF7F1")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(fix?.to ?? "", "#FFF8F0")).toBeGreaterThanOrEqual(4.5);
    // Using it clears the accent's rows; only the arcs remain low.
    const after = { ...draft, accent: fix?.to ?? draft.accent };
    expect(lowOf(checksOf(after)).map((l) => l.check.id)).toEqual(["arcs", "arcs"]);
    expect(nearestPassing("#56352D", ["#FBF7F1"], 4.5)).toBe("#56352D");
    expect(nearestPassing("zzz", ["#FBF7F1"], 4.5)).toBeNull();
    expect(fixFor(DEFAULTS, checksOf(DEFAULTS))).toBeNull();
  });

  it("bars, changes and the theme that is sent", () => {
    expect(barWidth(1)).toBe(0);
    expect(barWidth(21)).toBe(1);
    expect(barWidth(11)).toBeCloseTo(0.5);
    const draft = { ...DEFAULTS, accent: "#A8623F", highlight: "#E4B98C", emblem: "Pa" };
    expect(changesOf(draft, null)).toEqual(["accent", "highlight", "emblem"]);
    expect(changesOf(draft, { accent: "#a8623f", highlight: "#E4B98C", emblem: "Pa" })).toEqual([]);
    expect(themeOf(draft)).toEqual({ accent: "#A8623F", highlight: "#E4B98C", emblem: "Pa" });
    expect(themeOf(DEFAULTS)).toBeNull();
  });
});
