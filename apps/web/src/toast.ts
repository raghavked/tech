/**
 * A minimal toast store: short text, bottom-centre, auto-dismissed. No React in here so it can be
 * called from anywhere (websocket clients, clipboard helpers) and unit-tested without a DOM.
 * The `<Toasts />` component in ui.tsx renders it; `toast(text)` is re-exported from ui.tsx.
 */

export interface ToastItem {
  id: number;
  text: string;
}

export const TOAST_MS = 3200;
const MAX_SHOWN = 3;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit(): void {
  for (const fn of listeners) fn();
}

/** Show a short text toast; returns its id (0 when the text was empty or already showing). */
export function toast(text: string, ms: number = TOAST_MS): number {
  const t = text.trim();
  if (!t) return 0;
  if (items.some((x) => x.text === t)) return 0;
  const id = nextId++;
  const kept = items.slice(-(MAX_SHOWN - 1));
  for (const dropped of items.slice(0, items.length - kept.length)) {
    clearTimeout(timers.get(dropped.id));
    timers.delete(dropped.id);
  }
  items = [...kept, { id, text: t }];
  emit();
  try {
    timers.set(
      id,
      setTimeout(() => dismissToast(id), ms),
    );
  } catch {
    // no timers here (odd runtimes); the toast stays until dismissed
  }
  return id;
}

export function dismissToast(id: number): void {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
  if (!items.some((x) => x.id === id)) return;
  items = items.filter((x) => x.id !== id);
  emit();
}

export function subscribeToasts(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The current list; a stable reference until it changes, as useSyncExternalStore wants. */
export function getToasts(): ToastItem[] {
  return items;
}

/** Drop every toast at once (tests, sign-out). */
export function clearToasts(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  if (items.length === 0) return;
  items = [];
  emit();
}
