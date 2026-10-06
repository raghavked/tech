/**
 * settings-page: which kinds of notification this browser wants, remembered in localStorage.
 * Every storage call is guarded; the default is everything on. `notifyIfHidden` consults
 * `wantsNotify` when a caller names the kind.
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
