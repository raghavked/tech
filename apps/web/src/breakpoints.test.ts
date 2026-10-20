import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BREAKPOINTS, COMPACT_QUERY, frameOf, HYSTERESIS, PHONE_QUERY } from "./breakpoints.js";

describe("breakpoints, written once (desktop-compact)", () => {
  it("1180 folds the rail, 720 overlays the drawer, 480 is the phone", () => {
    expect(frameOf(1440)).toBe("full");
    expect(frameOf(1181)).toBe("full");
    expect(frameOf(1180)).toBe("folded");
    expect(frameOf(960)).toBe("folded");
    expect(frameOf(721)).toBe("folded");
    expect(frameOf(720)).toBe("overlay");
    expect(frameOf(481)).toBe("overlay");
    expect(frameOf(480)).toBe("phone");
    expect(frameOf(390)).toBe("phone");
  });

  it("gives the rail 40 px of hysteresis so it does not flap while a window is resized", () => {
    // narrowing: the rail folds the moment the edge is crossed
    expect(frameOf(1180, "full")).toBe("folded");
    // widening: it stays folded until 40 px past the edge
    expect(frameOf(1181, "folded")).toBe("folded");
    expect(frameOf(1180 + HYSTERESIS, "folded")).toBe("folded");
    expect(frameOf(1180 + HYSTERESIS + 1, "folded")).toBe("full");
    // and once open, the same width keeps it open
    expect(frameOf(1181, "full")).toBe("full");
  });

  it("gives the drawer the same hysteresis, and the phone edge none (its layout is a media query)", () => {
    expect(frameOf(720, "folded")).toBe("overlay");
    expect(frameOf(721, "overlay")).toBe("overlay");
    expect(frameOf(760, "overlay")).toBe("overlay");
    expect(frameOf(761, "overlay")).toBe("folded");
    expect(frameOf(481, "phone")).toBe("overlay");
    expect(frameOf(480, "overlay")).toBe("phone");
    // a big jump lands where the width says, whatever the frame before
    expect(frameOf(1400, "phone")).toBe("full");
    expect(frameOf(390, "full")).toBe("phone");
  });

  it("styles.css writes no width that is not one of these", () => {
    const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");
    const widths = new Set<number>();
    // media queries only: a container query (the scrubber's step spans) measures its own box
    for (const q of css.matchAll(/@media([^{]*)\{/g))
      for (const m of (q[1] ?? "").matchAll(/\((?:min|max)-width:\s*(\d+)px\)/g))
        widths.add(Number(m[1]));
    const allowed = new Set<number>();
    for (const bp of Object.values(BREAKPOINTS)) {
      allowed.add(bp);
      allowed.add(bp + 1);
    }
    const stray = [...widths].filter((w) => !allowed.has(w)).sort((a, b) => a - b);
    expect(stray, "media-query widths outside breakpoints.ts").toEqual([]);
    expect(PHONE_QUERY).toBe("(max-width: 480px)");
    expect(COMPACT_QUERY).toBe("(max-width: 960px)");
  });
});
