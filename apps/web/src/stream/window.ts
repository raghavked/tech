/**
 * Windowing math for a long column, with no DOM in it so it can be measured in a node test.
 *
 * A layout is the top offset of every row plus the total height; a range is the slice of rows
 * that intersects the viewport plus an overscan on each side. Rows have variable heights: an
 * estimate until the row has been mounted and measured.
 */

export interface Layout {
  /** Top of row i, in px from the top of the list. */
  tops: Float64Array;
  /** Height of the whole list. */
  total: number;
}

export interface Range {
  /** First mounted row. */
  start: number;
  /** One past the last mounted row. */
  end: number;
}

/** Prefix sums over `heightOf(i)`; O(n), run only when a height or the row count changes. */
export function layoutOf(count: number, heightOf: (i: number) => number): Layout {
  const tops = new Float64Array(count);
  let y = 0;
  for (let i = 0; i < count; i++) {
    tops[i] = y;
    y += heightOf(i);
  }
  return { tops, total: y };
}

/** Index of the last row whose top is <= y (binary search); 0 when y is above the first row. */
export function rowAt(layout: Layout, y: number): number {
  const { tops } = layout;
  let lo = 0;
  let hi = tops.length - 1;
  if (hi < 0) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((tops[mid] ?? 0) <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Rows to mount for a viewport [viewTop, viewTop + viewHeight) in list coordinates, with
 * `overscan` px of extra rows on each side. Always a non-empty range when there are rows.
 */
export function rangeOf(
  layout: Layout,
  viewTop: number,
  viewHeight: number,
  overscan = 600,
): Range {
  const n = layout.tops.length;
  if (n === 0) return { start: 0, end: 0 };
  const start = rowAt(layout, Math.max(0, viewTop - overscan));
  const last = rowAt(layout, viewTop + viewHeight + overscan);
  return { start, end: Math.min(n, last + 1) };
}

/** The scroll offset that puts the end of the list at the bottom of the viewport. */
export function bottomOf(layout: Layout, viewHeight: number): number {
  return Math.max(0, layout.total - viewHeight);
}

/** True when the viewport is within `slack` px of the end of the list. */
export function atBottom(layout: Layout, viewTop: number, viewHeight: number, slack = 48): boolean {
  return viewTop + viewHeight >= layout.total - slack;
}

/** Whether a changed height belongs to a row above the viewport, so the view must shift by it. */
export function shiftsView(layout: Layout, row: number, viewTop: number): boolean {
  return (layout.tops[row] ?? 0) < viewTop;
}
