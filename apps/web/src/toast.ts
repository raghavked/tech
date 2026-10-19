/**
 * Two toast stores, no React in here so they can be called from anywhere (websocket clients,
 * the inbox poll, clipboard helpers) and unit-tested without a DOM.
 *
 * The plain text toast ("Link copied") stays as it was: bottom-centre, 3 s, nothing to click;
 * `<Toasts />` in ui.tsx renders it. The typed notice is one sentence at three distances (the
 * toast, the OS banner, the inbox row): a 340 px card bottom-right above the composer with a
 * crease by kind. Decisions stay until answered; news drains over NOTICE_MS along a life line
 * that pauses on hover. Three show and the rest fold into a navy tail that counts what waits
 * in the inbox. The same id twice updates in place; `<TypedToasts />` in notify.tsx renders it.
 */

export interface ToastItem {
  id: number;
  text: string;
}

export const TOAST_MS = 3200;
export const MAX_SHOWN = 3;

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

// ---- typed notices: one sentence at three distances ----------------------------------------

export type NoticeKind =
  | "approval"
  | "gate"
  | "plan"
  | "handoff"
  | "mention"
  | "joined"
  | "done"
  | "blocked"
  | "contention"
  | "search";

/** The kinds that stop something until you act: they stay, carry `y` / `n`, and badge. */
export const DECISION_KINDS: ReadonlySet<NoticeKind> = new Set<NoticeKind>([
  "approval",
  "gate",
  "plan",
  "handoff",
  "blocked",
  "contention",
]);

export interface NoticeOutcome {
  busy?: boolean;
  /** The green outcome word ("Approved · ★ 4"), or the refusal in red when `error`. */
  word?: string;
  error?: string;
}

export interface Notice {
  /** The notification's id: the same id twice updates in place. */
  id: string;
  kind: NoticeKind;
  /** who · verb · what; `code` is the mono part of `what`. */
  who: string;
  verb: string;
  what: string;
  code?: string;
  /** Where, then what it means for you ("Invoice PDF", "You can approve, Ana"). */
  where: string;
  forYou?: string;
  /** A mention's words, under the sentence. */
  quote?: string;
  route: string;
  /** Decisions never time out; news drains over NOTICE_MS. */
  sticky: boolean;
  /** Under a ratings rule the approve opens the notice instead of voting blind. */
  ratings?: boolean;
  /** What acting on it needs: the session and the thing behind the item. */
  ref?: string;
  projectId?: string;
  sessionId?: string;
  at: number;
  outcome?: NoticeOutcome;
}

export const NOTICE_MS = 8000;

let notices: Notice[] = [];
const noticeListeners = new Set<() => void>();
const noticeTimers = new Map<string, { timer: ReturnType<typeof setTimeout>; due: number }>();
const paused = new Map<string, number>();

function emitNotices(): void {
  for (const fn of noticeListeners) fn();
}

function arm(id: string, ms: number): void {
  const have = noticeTimers.get(id);
  if (have) clearTimeout(have.timer);
  try {
    noticeTimers.set(id, { timer: setTimeout(() => dismissNotice(id), ms), due: Date.now() + ms });
  } catch {
    // no timers here; the notice stays until dismissed
  }
}

/** Show or update a typed notice. The same id replaces in place and restarts a news drain. */
export function notice(n: Notice, ms: number = NOTICE_MS): void {
  const at = notices.findIndex((x) => x.id === n.id);
  if (at >= 0) notices = notices.map((x, i) => (i === at ? n : x));
  else notices = [...notices, n];
  paused.delete(n.id);
  if (n.sticky) {
    const have = noticeTimers.get(n.id);
    if (have) clearTimeout(have.timer);
    noticeTimers.delete(n.id);
  } else arm(n.id, ms);
  emitNotices();
}

export function dismissNotice(id: string): void {
  const have = noticeTimers.get(id);
  if (have) {
    clearTimeout(have.timer);
    noticeTimers.delete(id);
  }
  paused.delete(id);
  if (!notices.some((x) => x.id === id)) return;
  notices = notices.filter((x) => x.id !== id);
  emitNotices();
}

/** Hovering a news toast holds its life line; leaving lets the rest of it drain. */
export function pauseNotice(id: string): void {
  const have = noticeTimers.get(id);
  if (!have) return;
  clearTimeout(have.timer);
  noticeTimers.delete(id);
  paused.set(id, Math.max(500, have.due - Date.now()));
  emitNotices();
}

export function resumeNotice(id: string): void {
  const left = paused.get(id);
  if (left === undefined) return;
  paused.delete(id);
  arm(id, left);
  emitNotices();
}

export function isPaused(id: string): boolean {
  return paused.has(id);
}

/** Record what pressing the toast did: Joining…, the outcome word, or the refusal. */
export function setNoticeOutcome(id: string, outcome: NoticeOutcome | undefined): void {
  if (!notices.some((x) => x.id === id)) return;
  notices = notices.map((x) => (x.id === id ? (outcome ? { ...x, outcome } : stripOutcome(x)) : x));
  emitNotices();
}

function stripOutcome(n: Notice): Notice {
  const { outcome: _, ...rest } = n;
  return rest;
}

export function subscribeNotices(fn: () => void): () => void {
  noticeListeners.add(fn);
  return () => {
    noticeListeners.delete(fn);
  };
}

/** Every notice, oldest first; a stable reference until something changes. */
export function getNotices(): Notice[] {
  return notices;
}

/**
 * What the corner shows: at most MAX_SHOWN, newest nearest the corner (last), decisions
 * outranking news when there are too many; `tail` counts the rest, which wait in the inbox.
 */
export function shownNotices(all: Notice[] = notices): { shown: Notice[]; tail: number } {
  if (all.length <= MAX_SHOWN) return { shown: all, tail: 0 };
  const ranked = [...all].sort((a, b) => Number(b.sticky) - Number(a.sticky) || b.at - a.at);
  const keep = new Set(ranked.slice(0, MAX_SHOWN).map((n) => n.id));
  return { shown: all.filter((n) => keep.has(n.id)), tail: all.length - MAX_SHOWN };
}

/** The newest decision, the one `y` / `n` act on. */
export function decisionNotice(all: Notice[] = notices): Notice | null {
  for (let i = all.length - 1; i >= 0; i--) {
    const n = all[i];
    if (n && n.sticky && !n.outcome) return n;
  }
  return null;
}

export function clearNotices(): void {
  for (const t of noticeTimers.values()) clearTimeout(t.timer);
  noticeTimers.clear();
  paused.clear();
  if (notices.length === 0) return;
  notices = [];
  emitNotices();
}
