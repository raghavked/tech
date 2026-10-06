/**
 * Light / dark / system, remembered per browser; the tokens read `data-theme` on <html>.
 *
 * team-theme: a team's look (docs/12_brand.md, "Team customisation") is fetched once per team
 * from GET /api/teams/:id/theme and applied as the `--team-*` custom properties on <html>
 * whenever the current route belongs to that team. tokens.css registers those properties, so
 * entering a team crossfades the colours. `data-motion="calm"` turns the motion off for a team
 * that asked for calm, and `useMotion()` tells components whether motion plays right now.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api, type TeamTheme } from "./api.js";

export type Theme = "system" | "light" | "dark";
const KEY = "henosis.theme";
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

// ---- team theme ------------------------------------------------------------------------------

/** The Henosis palette, which every team starts from. */
export const PALETTE = {
  fondant: "#56352D",
  apricot: "#E2C4A6",
  blues: "#2A3244",
  cream: "#FBF7F1",
  night: "#1C2130",
} as const;

/** Three looks made only of the palette: which colour leads. */
export const TEAM_PRESETS: { id: string; label: string; theme: TeamTheme }[] = [
  {
    id: "fondant",
    label: "Fondant",
    theme: { accent: "#56352D", highlight: "#E2C4A6", surface: "#2A3244", glow: "#E2C4A6" },
  },
  {
    id: "apricot",
    label: "Apricot",
    theme: { accent: "#2A3244", highlight: "#E2C4A6", surface: "#56352D", glow: "#E2C4A6" },
  },
  {
    id: "blues",
    label: "Blues",
    theme: { accent: "#2A3244", highlight: "#E2C4A6", surface: "#1B2130", glow: "#F0DCC4" },
  },
];

/** The custom properties a theme sets on <html>; absent fields fall back to tokens.css. */
export const THEME_VARS: Record<"accent" | "highlight" | "surface" | "glow", string> = {
  accent: "--team-accent",
  highlight: "--team-highlight",
  surface: "--team-surface",
  glow: "--team-glow",
};

const themes = new Map<string, TeamTheme | null>();
const pending = new Map<string, Promise<TeamTheme | null>>();
const themeListeners = new Set<() => void>();
let applied: string | null = null;

function emit(): void {
  for (const fn of themeListeners) fn();
}

/** The theme of a team as last fetched or saved; undefined until known. */
export function teamThemeOf(teamId: string | null): TeamTheme | null | undefined {
  return teamId ? themes.get(teamId) : null;
}

/** Fetch a team's theme once; failures read as "no theme" so the page keeps the palette. */
export function loadTeamTheme(teamId: string): Promise<TeamTheme | null> {
  const known = themes.get(teamId);
  if (known !== undefined) return Promise.resolve(known);
  let p = pending.get(teamId);
  if (p) return p;
  p = api
    .teamTheme(teamId)
    .then((r) => r.theme)
    .catch(() => null)
    .then((t) => {
      themes.set(teamId, t);
      pending.delete(teamId);
      emit();
      return t;
    });
  pending.set(teamId, p);
  return p;
}

/** Remember a theme just saved from Settings, so the page shows it at once. */
export function rememberTeamTheme(teamId: string, theme: TeamTheme | null): void {
  themes.set(teamId, theme);
  emit();
  if (applied === teamId) applyTeamTheme(teamId, theme);
}

/** Set (or, with null, clear) the `--team-*` properties and the motion level on <html>. */
export function applyTeamTheme(teamId: string | null, theme: TeamTheme | null): void {
  const root = document.documentElement;
  applied = teamId;
  for (const [key, cssVar] of Object.entries(THEME_VARS) as [keyof typeof THEME_VARS, string][]) {
    const v = theme?.[key];
    if (v) root.style.setProperty(cssVar, v);
    else root.style.removeProperty(cssVar);
  }
  if (theme?.motion === "calm") root.dataset.motion = "calm";
  else delete root.dataset.motion;
  if (teamId && theme) root.dataset.team = teamId;
  else delete root.dataset.team;
  for (const fn of motionListeners) fn();
}

/** A team's theme as the store knows it, fetched on first use; null until known or when unset. */
export function useTeamThemeValue(teamId: string | null): TeamTheme | null {
  const theme = useSyncExternalStore(
    (fn) => {
      themeListeners.add(fn);
      return () => themeListeners.delete(fn);
    },
    () => (teamId ? (themes.get(teamId) ?? null) : null),
    () => null,
  );
  useEffect(() => {
    if (teamId) void loadTeamTheme(teamId);
  }, [teamId]);
  return theme;
}

/**
 * Subscribe to a team's theme: fetches it on first use, applies it to the page while this hook
 * is mounted with that team, and clears it when the team changes to none.
 */
export function useTeamTheme(teamId: string | null): TeamTheme | null {
  const theme = useTeamThemeValue(teamId);
  useEffect(() => {
    if (!teamId) {
      applyTeamTheme(null, null);
      return;
    }
    let alive = true;
    loadTeamTheme(teamId).then((t) => alive && applyTeamTheme(teamId, t));
    return () => {
      alive = false;
    };
  }, [teamId]);
  // A theme saved while on the team's page lands through `rememberTeamTheme`.
  useEffect(() => {
    if (teamId && theme) applyTeamTheme(teamId, theme);
  }, [teamId, theme]);
  return theme;
}

// ---- motion ------------------------------------------------------------------------------------

export type Motion = "full" | "calm";
const motionListeners = new Set<() => void>();

/** What tokens.css decides: calm when the system asks for less motion or the team chose calm. */
export function motionNow(): Motion {
  try {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return "calm";
    return document.documentElement.dataset.motion === "calm" ? "calm" : "full";
  } catch {
    return "full";
  }
}

/** The motion level in effect; components that time something to an animation read it. */
export function useMotion(): Motion {
  return useSyncExternalStore(
    (fn) => {
      motionListeners.add(fn);
      let mq: MediaQueryList | null = null;
      try {
        mq = matchMedia("(prefers-reduced-motion: reduce)");
        mq.addEventListener("change", fn);
      } catch {
        mq = null;
      }
      return () => {
        motionListeners.delete(fn);
        mq?.removeEventListener("change", fn);
      };
    },
    motionNow,
    () => "full" as Motion,
  );
}
