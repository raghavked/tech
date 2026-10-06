/** Recently opened sessions, remembered per browser; every storage call is guarded. */
import { useSyncExternalStore } from "react";

export interface Recent {
  projectId: string;
  sessionId: string;
  title: string;
}

const KEY = "henosis.recents";
const MAX = 12;
const listeners = new Set<() => void>();
let current: Recent[] = read();

function read(): Recent[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(v)) return [];
    return v.filter(
      (r): r is Recent =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as Recent).projectId === "string" &&
        typeof (r as Recent).sessionId === "string",
    );
  } catch {
    return [];
  }
}

export function rememberRecent(r: Recent): void {
  const same = (x: Recent) => x.projectId === r.projectId && x.sessionId === r.sessionId;
  const next = [r, ...current.filter((x) => !same(x))].slice(0, MAX);
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode: recents live for this page only
  }
  for (const fn of listeners) fn();
}

const EMPTY: Recent[] = [];

export function useRecents(): Recent[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => EMPTY,
  );
}
