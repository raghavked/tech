/**
 * Matching for the palette and the search page, pure. A query is a subsequence of the label;
 * a contiguous run, a word start and a short label score higher. `matchSpans` says which
 * letters matched so a row can draw them in weight and ink (`Ap<b>pro</b>ve`), never eating
 * a letter and never with a background.
 */

const BOUNDARY = /\s|[./:_#@-]/;

/**
 * Subsequence match, scored: 0 when `needle` is not in `hay` in order; higher for a
 * contiguous run, a match at a word start, and a short haystack.
 */
export function fuzzyScore(needle: string, hay: string): number {
  const n = needle.trim().toLowerCase();
  if (!n) return 1;
  const h = hay.toLowerCase();
  const at = h.indexOf(n);
  if (at >= 0) return 100 + (at === 0 || BOUNDARY.test(h[at - 1] ?? "") ? 20 : 0) - at / 50;
  let score = 0;
  let i = 0;
  let last = -2;
  for (let j = 0; j < h.length && i < n.length; j++) {
    if (h[j] !== n[i]) continue;
    score += 1;
    if (j === last + 1) score += 2;
    if (j === 0 || BOUNDARY.test(h[j - 1] ?? "")) score += 3;
    last = j;
    i += 1;
  }
  if (i < n.length) return 0;
  return score + Math.max(0, 20 - h.length / 10);
}

export interface Span {
  text: string;
  /** The letters the query matched. */
  match: boolean;
}

/**
 * The label cut into matched and unmatched runs. A contiguous match wins over a scattered
 * one; a query that is not in the label returns the label as one unmatched span.
 */
export function matchSpans(needle: string, hay: string): Span[] {
  const n = needle.trim().toLowerCase();
  if (!n || !hay) return [{ text: hay, match: false }];
  const h = hay.toLowerCase();
  const flags = new Array<boolean>(hay.length).fill(false);
  const at = h.indexOf(n);
  if (at >= 0) for (let k = 0; k < n.length; k++) flags[at + k] = true;
  // A scattered match ranks the row but is not drawn: lit single letters read as noise.
  else return [{ text: hay, match: false }];
  const out: Span[] = [];
  let start = 0;
  for (let k = 1; k <= hay.length; k++) {
    if (k === hay.length || flags[k] !== flags[start]) {
      out.push({ text: hay.slice(start, k), match: Boolean(flags[start]) });
      start = k;
    }
  }
  return out;
}

/** `Ap<b>pro</b>ve` as a string, for tests and plain-text contexts. */
export function markup(needle: string, hay: string): string {
  return matchSpans(needle, hay)
    .map((s) => (s.match ? `<b>${s.text}</b>` : s.text))
    .join("");
}
