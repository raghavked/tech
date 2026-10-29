import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrast } from "./look.js";

/**
 * The token sheet's leftovers (design/henosis/BACKLOG.md L7): the app's tokens are the
 * design's tokens byte for byte; every keyframe set declared is played by some rule (an
 * orphan is a vocabulary word nobody says); the hand as text in dark reads on both dark
 * grounds and is never the apricot pulse; Calm reaches the root element, so nothing
 * declared on :root can cross over while a team asked for no motion.
 */
const here = import.meta.dirname ?? __dirname;
const web = join(here, "..", "..", "..");
const tokens = readFileSync(join(here, "tokens.css"), "utf8");
const styles = readFileSync(join(here, "styles.css"), "utf8");
const print = readFileSync(join(here, "print.css"), "utf8");

/** The value of a custom property inside one block of the sheet, as the sheet writes it. */
function tokenIn(block: string, name: string): string {
  const m = new RegExp(`${name.replace(/-/g, "\\-")}:\\s*(#[0-9A-Fa-f]{6})`).exec(block);
  if (!m?.[1]) throw new Error(`${name} not found`);
  return m[1].toUpperCase();
}

/** The dark block: from the dark media query to the next top-level rule. */
const dark = tokens.slice(tokens.indexOf('[data-theme="dark"]'));

describe("tokens.css", () => {
  it("is the design's token sheet, byte for byte", () => {
    expect(tokens).toBe(readFileSync(join(web, "design", "tokens.css"), "utf8"));
  });

  it("plays every keyframe set it declares (no orphan vocabulary)", () => {
    const declared = new Set(
      [...`${tokens}\n${styles}\n${print}`.matchAll(/@keyframes\s+([a-z0-9-]+)/g)].map(
        (m) => m[1] ?? "",
      ),
    );
    const played = new Set<string>();
    for (const m of `${tokens}\n${styles}\n${print}`.matchAll(/animation(?:-name)?:\s*([^;}]+)/g))
      for (const word of m[1]?.split(/[\s,]+/) ?? []) if (declared.has(word)) played.add(word);
    const orphans = [...declared].filter((k) => !played.has(k));
    expect(orphans).toEqual([]);
    // ring-draw in particular: the tour's five-segment ring draws each segment with `draw`.
    expect(declared.has("ring-draw")).toBe(false);
    expect(styles).toMatch(/\.tour-ring \.seg\.now\s*\{[^}]*animation:\s*draw/);
  });

  it("gives the hand's text in dark a colour that reads on the canvas and the surface and is not the pulse", () => {
    const ink = tokenIn(dark, "--accent-ink");
    const canvas = tokenIn(dark, "--canvas");
    const surface = tokenIn(dark, "--surface");
    const apricot = tokenIn(tokens, "--apricot");
    expect(ink).toBe("#CAA49B");
    // Confirmed on the session page in dark (scripts/perf-l7.mjs): 7.2 : 1 and 6.2 : 1.
    expect(contrast(ink, canvas)).toBeGreaterThanOrEqual(7);
    expect(contrast(ink, surface)).toBeGreaterThanOrEqual(6);
    // The hand itself would be 2.3 : 1 as text; that is why the text takes chocolate 300.
    expect(contrast(tokenIn(dark, "--accent"), canvas)).toBeLessThan(4.5);
    // Darker than the apricot pulse beside it, so a label never reads as a live dot.
    expect(ink).not.toBe(apricot);
    expect(contrast(apricot, canvas)).toBeGreaterThan(contrast(ink, canvas));
  });

  it("sets the team colours at once: no transition of --team-* on :root, and Calm covers :root", () => {
    expect(tokens).not.toMatch(/transition:\s*--team-/);
    expect(tokens).toMatch(/:root\[data-motion="calm"\],\s*:root\[data-motion="calm"\] \*/);
  });
});
