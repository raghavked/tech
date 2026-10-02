/**
 * A windowed column: only the rows near the viewport are mounted, the rest is two spacers.
 *
 * Rows are measured once mounted (ResizeObserver) and estimated before that. When a row above
 * the viewport turns out taller or shorter than its estimate, the scroll offset shifts by the
 * difference so what the reader is looking at stays put. While the reader is at the end, the
 * list follows new rows; once they scroll up it stops following and offers "Jump to latest".
 *
 * The scroll container is the nearest `.scroll` ancestor (the Shell's), so the list itself has
 * no fixed height and sits in the normal column flow with whatever follows it.
 */
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ICONS, Icon } from "../ui.js";
import { atBottom, bottomOf, type Layout, layoutOf, type Range, rangeOf } from "./window.js";

export interface VirtualListProps<T> {
  items: readonly T[];
  /** Bump when `items` changed in place (the array may keep its identity for cheapness). */
  version: number;
  keyOf: (item: T) => string;
  estimate: (item: T) => number;
  render: (item: T, index: number) => ReactNode;
  /** Extra px of rows mounted beyond each edge of the viewport. */
  overscan?: number;
  /** Label of the affordance shown when scrolled up; `unseen` rows arrived meanwhile. */
  jumpLabel?: (unseen: number) => string;
}

interface View {
  top: number;
  height: number;
}

const SLACK = 48;

export function VirtualList<T>({
  items,
  version,
  keyOf,
  estimate,
  render,
  overscan = 600,
  jumpLabel = (n) => (n > 0 ? `${n} new · Jump to latest` : "Jump to latest"),
}: VirtualListProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const heights = useRef(new Map<string, number>());
  const [measured, setMeasured] = useState(0);
  const [range, setRange] = useState<Range>({ start: 0, end: 0 });
  const [stuck, setStuck] = useState(true);
  const stuckRef = useRef(true);
  const viewRef = useRef<View>({ top: 0, height: 800 });
  const [seen, setSeen] = useState(items.length);
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const props = useRef({ items, keyOf, estimate });
  props.current = { items, keyOf, estimate };

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` says `items` changed in place; `measured` that a height did
  const layout: Layout = useMemo(
    () => layoutOf(items.length, (i) => heightAt(items, i, keyOf, estimate, heights.current)),
    [items, version, measured],
  );
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const scrollerOf = useCallback((): HTMLElement | null => {
    const root = rootRef.current;
    if (!root) return null;
    return (root.closest(".scroll") as HTMLElement | null) ?? root.parentElement;
  }, []);

  /** Where the viewport is in list coordinates, read from the DOM. */
  const readView = useCallback((): View | null => {
    const root = rootRef.current;
    const scroller = scrollerOf();
    if (!root || !scroller) return null;
    const listTop =
      root.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const v = { top: scroller.scrollTop - listTop, height: scroller.clientHeight };
    viewRef.current = v;
    return v;
  }, [scrollerOf]);

  /** Recompute the mounted range and whether we are at the end; sets state only on change. */
  const measure = useCallback(() => {
    const v = readView();
    if (!v) return;
    const l = layoutRef.current;
    const next = rangeOf(l, v.top, v.height, overscan);
    const cur = rangeRef.current;
    if (next.start !== cur.start || next.end !== cur.end) setRange(next);
    const nowStuck = atBottom(l, v.top, v.height, SLACK);
    if (nowStuck !== stuckRef.current) {
      stuckRef.current = nowStuck;
      setStuck(nowStuck);
    }
    if (nowStuck) setSeen(props.current.items.length);
  }, [readView, overscan]);

  // Scroll and resize drive the window.
  useEffect(() => {
    const scroller = scrollerOf();
    if (!scroller) return;
    const onScroll = () => measure();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onScroll);
    ro?.observe(scroller);
    measure();
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      ro?.disconnect();
    };
  }, [scrollerOf, measure]);

  // New rows, or new heights, while at the end: keep the end in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when rows or heights change
  useLayoutEffect(() => {
    if (!stuckRef.current) return;
    const scroller = scrollerOf();
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
    measure();
  }, [version, measured, scrollerOf, measure]);

  // One observer measures every mounted row; a change above the viewport shifts the view.
  const observer = useMemo(() => {
    if (typeof ResizeObserver === "undefined") return null;
    return new ResizeObserver((entries) => {
      const { items, keyOf, estimate } = props.current;
      const v = viewRef.current;
      const l = layoutRef.current;
      const r = rangeRef.current;
      let shift = 0;
      let changed = false;
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const key = el.dataset.key;
        if (!key || !el.isConnected) continue;
        const h = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight);
        if (h <= 0) continue;
        const prev = heights.current.get(key);
        if (prev === h) continue;
        heights.current.set(key, h);
        changed = true;
        // Only mounted rows are observed, so the index is within the current range.
        let idx = -1;
        for (let i = r.start; i < r.end; i++) {
          const it = items[i];
          if (it !== undefined && keyOf(it) === key) {
            idx = i;
            break;
          }
        }
        const it = idx >= 0 ? items[idx] : undefined;
        const before = prev ?? (it !== undefined ? estimate(it) : h);
        if (idx >= 0 && (l.tops[idx] ?? 0) < v.top) shift += h - before;
      }
      if (!changed) return;
      if (shift !== 0 && !stuckRef.current) {
        const scroller = scrollerOf();
        if (scroller) scroller.scrollTop += shift;
      }
      setMeasured((n) => n + 1);
    });
  }, [scrollerOf]);
  useEffect(() => () => observer?.disconnect(), [observer]);

  const observe = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || !observer) return undefined;
      observer.observe(el);
      return () => observer.unobserve(el);
    },
    [observer],
  );

  // While following the end, the window is derived from the end of the layout rather than from
  // a scroll offset that is about to change, so the newest rows mount in the same render.
  const shown: Range = stuck
    ? rangeOf(layout, bottomOf(layout, viewRef.current.height), viewRef.current.height, overscan)
    : range;
  const topPad = layout.tops[shown.start] ?? 0;
  const bottomPad =
    shown.end < items.length ? layout.total - (layout.tops[shown.end] ?? layout.total) : 0;
  const unseen = Math.max(0, items.length - seen);

  const jump = () => {
    const scroller = scrollerOf();
    if (!scroller) return;
    stuckRef.current = true;
    setStuck(true);
    setSeen(items.length);
    scroller.scrollTop = scroller.scrollHeight;
    measure();
  };

  const rows: ReactNode[] = [];
  for (let i = shown.start; i < shown.end; i++) {
    const item = items[i];
    if (item === undefined) continue;
    const key = keyOf(item);
    rows.push(
      <Row key={key} rowKey={key} item={item} index={i} render={render} observe={observe} />,
    );
  }

  return (
    <div className="vlist" ref={rootRef}>
      <div style={{ height: topPad }} aria-hidden="true" />
      {rows}
      <div style={{ height: bottomPad }} aria-hidden="true" />
      {!stuck && items.length > 0 && (
        <div className="jump-wrap">
          <button type="button" className="btn sm jump" onClick={jump}>
            <Icon d={ICONS.down} size={14} />
            {jumpLabel(unseen)}
          </button>
        </div>
      )}
    </div>
  );
}

function heightAt<T>(
  items: readonly T[],
  i: number,
  keyOf: (item: T) => string,
  estimate: (item: T) => number,
  heights: Map<string, number>,
): number {
  const it = items[i];
  if (it === undefined) return 0;
  return heights.get(keyOf(it)) ?? estimate(it);
}

interface RowProps<T> {
  rowKey: string;
  item: T;
  index: number;
  render: (item: T, index: number) => ReactNode;
  observe: (el: HTMLDivElement | null) => (() => void) | undefined;
}

const Row = memo(function Row<T>({ rowKey, item, index, render, observe }: RowProps<T>) {
  return (
    <div className="vrow" data-key={rowKey} ref={observe}>
      {render(item, index)}
    </div>
  );
}) as <T>(props: RowProps<T>) => ReactNode;
