/**
 * settings-page: which kinds of notification this browser wants, remembered in localStorage.
 * Every storage call is guarded; the default is everything on. `notifyIfHidden` consults
 * `wantsNotify` when a caller names the kind, and `isNotifyPaused` for the pause the tray and
 * the menu-bar panel offer (widgets, desktop-tray): an hour, until tomorrow, until you say.
 * Mentions still come through a pause.
 */
import { useSyncExternalStore } from "react";
import type { Notification } from "./api.js";

/** The server's notification kinds plus "team", the client-side kind for team chat. */
export type NotifyKind = Notification["kind"] | "team";

export const NOTIFY_KINDS: { kind: NotifyKind; label: string; detail: string }[] = [
  {
    kind: "approval",
    label: "Approvals",
    detail: "The agent wants to do something that needs a vote",
  },
  { kind: "handoff", label: "Handoffs", detail: "Someone offers you the baton" },
  { kind: "contention", label: "Contentions", detail: "Two steers collide, or two sessions do" },
  { kind: "blocked", label: "Blocked", detail: "An agent cannot continue without a person" },
  { kind: "done", label: "Done", detail: "An agent finishes what it was asked" },
  { kind: "team", label: "Team chat", detail: "Someone says something to the people in a session" },
  { kind: "mention", label: "Mentions", detail: "Someone mentions you in a group chat" },
];

export type NotifyPrefs = Record<NotifyKind, boolean>;

const KEY = "henosis.notify";
const listeners = new Set<() => void>();
let current: NotifyPrefs = read();

function allOn(): NotifyPrefs {
  return Object.fromEntries(NOTIFY_KINDS.map((k) => [k.kind, true])) as NotifyPrefs;
}

function read(): NotifyPrefs {
  const out = allOn();
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    if (v && typeof v === "object")
      for (const k of NOTIFY_KINDS)
        if ((v as Record<string, unknown>)[k.kind] === false) out[k.kind] = false;
  } catch {
    // private mode or blocked storage: everything stays on
  }
  return out;
}

export function wantsNotify(kind: NotifyKind): boolean {
  return current[kind] !== false;
}

export function setNotify(kind: NotifyKind, on: boolean): void {
  current = { ...current, [kind]: on };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
  for (const fn of listeners) fn();
}

export function useNotifyPrefs(): [NotifyPrefs, (kind: NotifyKind, on: boolean) => void] {
  const prefs = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => current,
  );
  return [prefs, setNotify];
}

// ---- Pause notifications ----------------------------------------------------------------

/** How long a pause lasts: an hour, until tomorrow (the next local midnight), or until you say. */
export type PauseSpan = "hour" | "tomorrow" | "always";

const PAUSE_KEY = "henosis.notify.paused";
/** The pause's end in ms since the epoch, `Infinity` for "until you say", null when not paused. */
let pausedUntil: number | null = readPause();
const pauseListeners = new Set<() => void>();

function readPause(): number | null {
  try {
    const raw = localStorage.getItem(PAUSE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { until?: number | "always" };
    if (v.until === "always") return Number.POSITIVE_INFINITY;
    return typeof v.until === "number" && v.until > Date.now() ? v.until : null;
  } catch {
    return null;
  }
}

function writePause(until: number | null): void {
  pausedUntil = until;
  try {
    if (until === null) localStorage.removeItem(PAUSE_KEY);
    else
      localStorage.setItem(
        PAUSE_KEY,
        JSON.stringify({ until: until === Number.POSITIVE_INFINITY ? "always" : until }),
      );
  } catch {
    // ignore
  }
  for (const fn of pauseListeners) fn();
}

/** When a pause started now would end: an hour on, the next local midnight, or never. */
export function pauseEndOf(span: PauseSpan, now: number = Date.now()): number {
  if (span === "always") return Number.POSITIVE_INFINITY;
  if (span === "hour") return now + 60 * 60 * 1000;
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

export function pauseNotifications(span: PauseSpan, now: number = Date.now()): void {
  writePause(pauseEndOf(span, now));
}

export function resumeNotifications(): void {
  writePause(null);
}

/** The pause's end, or null once it has lapsed or was never set. */
export function notifyPausedUntil(now: number = Date.now()): number | null {
  if (pausedUntil !== null && pausedUntil <= now) writePause(null);
  return pausedUntil;
}

/** True while paused, except for a mention: those still come through. */
export function isNotifyPaused(kind?: NotifyKind, now: number = Date.now()): boolean {
  if (kind === "mention") return false;
  return notifyPausedUntil(now) !== null;
}

export function useNotifyPause(): number | null {
  return useSyncExternalStore(
    (fn) => {
      pauseListeners.add(fn);
      return () => pauseListeners.delete(fn);
    },
    () => notifyPausedUntil(),
    () => null,
  );
}
