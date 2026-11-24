/**
 * The spend ring (sig-token-art): the four states, the arcs it draws, and what a screen reader
 * hears. With no budget there is no percent anywhere; past the budget there is a second shape.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpendRing, spendPercent, spendSegments, spendTone } from "./SpendRing.js";

const ring = (props: Parameters<typeof SpendRing>[0]) =>
  renderToStaticMarkup(createElement(SpendRing, props));

describe("spendTone", () => {
  it("names the four states, amber from 80 % and over only past the budget", () => {
    expect(spendTone(12_400, null)).toBe("none");
    expect(spendTone(12_400, 0)).toBe("none");
    expect(spendTone(12_400, 20_000)).toBe("under");
    expect(spendTone(16_000, 20_000)).toBe("near");
    expect(spendTone(20_000, 20_000)).toBe("near");
    expect(spendTone(20_001, 20_000)).toBe("over");
  });
});

describe("spendSegments", () => {
  it("fills input then output against the budget, in hundredths of the ring", () => {
    const segs = spendSegments(9_870, 2_530, 20_000);
    expect(segs.map((s) => s.kind)).toEqual(["in", "out"]);
    expect(segs[0]?.to).toBeCloseTo(49.35);
    expect(segs[1]?.to).toBeCloseTo(62);
  });

  it("turns the share past 80 % amber and never draws past the seam", () => {
    const near = spendSegments(12_200, 5_000, 20_000);
    expect(near.map((s) => s.kind)).toEqual(["in", "out", "amber"]);
    expect(near[2]?.from).toBe(80);
    expect(near[2]?.to).toBeCloseTo(86);
    expect(spendSegments(40_000, 12_000, 20_000)).toEqual([
      { kind: "in", from: 0, to: 80 },
      { kind: "amber", from: 80, to: 100 },
    ]);
  });

  it("splits the spend alone when there is no budget, and draws nothing for nothing", () => {
    expect(spendSegments(8_000, 2_000, null)).toEqual([
      { kind: "in", from: 0, to: 80 },
      { kind: "out", from: 80, to: 100 },
    ]);
    expect(spendSegments(0, 0, null)).toEqual([]);
    expect(spendSegments(0, 0, 20_000)).toEqual([]);
  });
});

describe("SpendRing", () => {
  it("is a meter whose name says the numbers and whose text says the state", () => {
    const html = ring({ input: 9_870, output: 2_530, budget: 20_000, size: "card" });
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-label="12,400 of 20,000 tokens, 62 percent of the budget"');
    expect(html).toContain('aria-valuetext="under the budget, 7,600 left"');
    expect(html).toContain('aria-valuenow="12400"');
    expect(html).toContain('aria-valuemax="20000"');
    expect(html).toContain('data-tone="under"');
    expect(html).toContain(">62%<");
  });

  it("shows the spend alone with no budget: an image, no meter, no percent, no seam", () => {
    const html = ring({ input: 9_870, output: 2_530, budget: null, what: "Invoice PDF" });
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Invoice PDF: 12,400 tokens, no budget set"');
    expect(html).not.toContain("aria-valuenow");
    expect(html).not.toContain("%");
    expect(html).not.toContain("ring-seam");
    expect(html).not.toContain("ring-tick");
    expect(html).toContain(">12.4k<");
  });

  it("says near and over in words, and draws the lap only past the budget", () => {
    const near = ring({ input: 12_200, output: 5_000, budget: 20_000 });
    expect(near).toContain('aria-valuetext="near the budget, 2,800 left"');
    expect(near).toContain("ring-amber");
    expect(near).not.toContain("ring-lap");
    const over = ring({ input: 17_400, output: 5_000, budget: 20_000 });
    expect(over).toContain('aria-valuetext="over the budget by 2,400"');
    expect(over).toContain('aria-valuenow="20000"');
    expect(over).toContain("ring-lap");
    expect(over).toContain('data-tone="over"');
    const row = ring({ input: 17_400, output: 5_000, budget: 20_000, size: "row" });
    expect(row).toContain("ring-past");
    expect(row).not.toContain("ring-mid");
  });

  it("draws cache read beside the budget and says it is not counted; the ember only while live", () => {
    const html = ring({ input: 6_000, output: 500, cacheRead: 2_000, budget: 20_000 });
    expect(html).toContain("ring-cache");
    expect(html).toContain("2,000 cache read, not counted");
    expect(html).not.toContain("ring-ember");
    const live = ring({ input: 6_000, output: 500, budget: 20_000, live: true });
    expect(live).toContain("ring-ember");
    expect(live).toContain("spending now");
    expect(live).not.toContain("ring-cache");
  });

  it("keeps a runaway percent inside the ring", () => {
    expect(spendPercent(7_029, 600)).toBe(">999%");
    expect(spendPercent(12_400, 20_000)).toBe("62%");
  });
});
