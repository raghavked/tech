/**
 * Two idioms every surface outside the window shares (surfaces panel, carry-forward 5 and 6):
 * a rating as glyph stars plus the number where the host cannot draw ours, and an estimate
 * against what was actually spent as one mono phrase, so the digest, the PR comment and the
 * app's plan rows all say `est 44k → 61k, +38%` or `19k, under` the same way.
 */
import { compactTokens } from "./usage.js";

/** "★★★★☆" for 4: five glyphs, the lit ones first. A rating outside 1..5 is clamped. */
export function starGlyphs(rating: number): string {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

/** "★★★★☆ 4": the glyphs with the number beside them. */
export function starsWithNumber(rating: number): string {
  return `${starGlyphs(rating)} ${Math.round(rating * 10) / 10}`;
}

export interface EstimateReading {
  /** `est 44k → 61k, +38%`, `est 22k → 19k, under`, or `est 18k` while nothing is spent. */
  text: string;
  /** Over the estimate (amber), under or on it (green), or not yet spent (quiet). */
  tone: "over" | "under" | "none";
  /** Percent over the estimate (positive) or under it (negative); null before anything is spent. */
  pct: number | null;
}

/** The estimate → actual idiom. `actual` null or 0 means nothing has been spent yet. */
export function describeEstimate(est: number, actual: number | null): EstimateReading {
  if (!actual) return { text: `est ${compactTokens(est)}`, tone: "none", pct: null };
  const pct = est > 0 ? Math.trunc(((actual - est) / est) * 100) : null;
  if (actual > est)
    return {
      text: `est ${compactTokens(est)} → ${compactTokens(actual)}${pct !== null ? `, +${pct}%` : ""}`,
      tone: "over",
      pct,
    };
  return {
    text: `est ${compactTokens(est)} → ${compactTokens(actual)}, under`,
    tone: "under",
    pct,
  };
}

/** "3f9a…c21e": a hash shortened to its ends, for a footer or a chip. */
export function shortHash(hash: string | null, ends = 4): string {
  if (!hash) return "—";
  return hash.length <= ends * 2 + 1 ? hash : `${hash.slice(0, ends)}…${hash.slice(-ends)}`;
}
