/**
 * The breakpoints, written once (design/henosis SYSTEM.md §4, SCREENS.md §20, desktop-compact):
 *
 *   1440 full · 1180 the rail folds to 72 · 960 compact (the title truncates first; Team and
 *   Details become 34 px icon buttons) · 720 the drawer overlays at 300 px with a scrim ·
 *   480 phone (the rail is a 332 px sheet, overlays are bottom sheets).
 *
 * The column's 780 and its 24 px gutters are fixed; the rail and the drawer give way. The two
 * edges that move chrome around (the rail folding, the drawer overlaying) carry 40 px of
 * hysteresis so a window being resized across them does not flap, and `[` `]` pin the rail's
 * choice (Rail.tsx). styles.css reads the same numbers in its media queries; the test beside
 * this file checks that no other width is ever written there.
 */
import { useSyncExternalStore } from "react";

export const BREAKPOINTS = {
  /** Above this the rail is open at 296; at and below it folds to 72. */
  fold: 1180,
  /** At and below this the topbar drops words, not facts. */
  compact: 960,
  /** At and below this the drawer overlays the stream at 300 with a scrim. */
  overlay: 720,
  /** At and below this the frame is the phone's: a four-tab bar, sheets, the rail as a sheet. */
  phone: 480,
} as const;

/** How far past an edge the window must go back before the chrome returns. */
export const HYSTERESIS = 40;

/** Media queries for the two edges that need no hysteresis (nothing moves, words drop). */
export const PHONE_QUERY = `(max-width: ${BREAKPOINTS.phone}px)`;
export const COMPACT_QUERY = `(max-width: ${BREAKPOINTS.compact}px)`;

export type Frame = "full" | "folded" | "overlay" | "phone";

/**
 * The frame for a window width, given the frame it was in: the fold and overlay edges only
 * move once the width is 40 px past them in the other direction. The phone edge is exact,
 * because the phone's layout is a media query and the two must agree to the pixel.
 */
export function frameOf(width: number, prev: Frame | null = null): Frame {
  if (width <= BREAKPOINTS.phone) return "phone";
  // a narrower frame opens as soon as the edge is crossed; a wider one needs the hysteresis
  // (the first measurement, with no frame before, reads the plain edge)
  const foldOpen =
    prev === null || prev === "full"
      ? width > BREAKPOINTS.fold
      : width > BREAKPOINTS.fold + HYSTERESIS;
  if (foldOpen) return "full";
  const beside =
    prev === null || prev === "folded" || prev === "full"
      ? width > BREAKPOINTS.overlay
      : width > BREAKPOINTS.overlay + HYSTERESIS;
  return beside ? "folded" : "overlay";
}

let current: Frame | null = null;
const listeners = new Set<() => void>();
let watching = false;

function measure(): Frame {
  try {
    current = frameOf(innerWidth, current);
  } catch {
    current = "full";
  }
  return current;
}

function watch(): void {
  if (watching) return;
  watching = true;
  try {
    addEventListener("resize", () => {
      const before = current;
      if (measure() !== before) for (const fn of listeners) fn();
    });
  } catch {
    // no window
  }
}

function read(): Frame {
  return current ?? measure();
}

/** The window's frame, with hysteresis; re-renders only when the frame changes. */
export function useFrame(): Frame {
  return useSyncExternalStore(
    (fn) => {
      watch();
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    read,
    () => "full",
  );
}
