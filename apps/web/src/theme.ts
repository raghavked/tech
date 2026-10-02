/** Light / dark / system, remembered per browser. The tokens read `data-theme` on <html>. */
import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";
const KEY = "fold.theme";
const listeners = new Set<() => void>();
let current: Theme = readStored();

function readStored(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  if (t === "system") delete root.dataset.theme;
  else root.dataset.theme = t;
}

export function setTheme(t: Theme): void {
  current = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // ignore
  }
  applyTheme(t);
  for (const fn of listeners) fn();
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => "system" as Theme,
  );
  useEffect(() => applyTheme(current), []);
  const set = useCallback((t: Theme) => setTheme(t), []);
  return [theme, set];
}
