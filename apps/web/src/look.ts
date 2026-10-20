/**
 * The team look's arithmetic (views/TeamLook.tsx): contrast ratios, the checks table on both
 * canvases, the nearest passing colour, and what changed against the saved look. Nothing here
 * is typed by hand; the page derives every word, bar and count from these results.
 */
import type { TeamTheme } from "./api.js";
import { PALETTE } from "./theme.js";

export const HEX = /^#[0-9a-fA-F]{6}$/;

/** The dark canvas and the rail's text, the two grounds the checks run against beside cream. */
export const DARK_CANVAS = "#1A202C";
export const RAIL_TEXT = "#F6F0E7";
/** The text on a button in the hand, on cream. */
export const HAND_TEXT = "#FFF8F0";

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = [16, 8, 0].map((shift) => {
    const v = ((n >> shift) & 255) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG 2 contrast ratio between two #RRGGBB colours, 1 to 21; 1 when either is not a colour. */
export function contrast(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) return 1;
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** One decimal, the way the table prints it: 4.4, 11.3. */
export function ratioText(r: number): string {
  return (Math.round(r * 10) / 10).toFixed(1);
}

export type LookKey = "accent" | "highlight" | "surface" | "glow";

export interface Draft {
  accent: string;
  highlight: string;
  surface: string;
  glow: string;
  mark: NonNullable<TeamTheme["mark"]>;
  motion: NonNullable<TeamTheme["motion"]>;
  emblem: string;
}

export const DEFAULTS: Draft = {
  accent: PALETTE.fondant,
  highlight: PALETTE.apricot,
  surface: PALETTE.blues,
  glow: PALETTE.apricot,
  mark: "ring",
  motion: "full",
  emblem: "",
};

export function draftOf(theme: TeamTheme | null): Draft {
  return {
    accent: theme?.accent ?? DEFAULTS.accent,
    highlight: theme?.highlight ?? DEFAULTS.highlight,
    surface: theme?.surface ?? DEFAULTS.surface,
    glow: theme?.glow ?? DEFAULTS.glow,
    mark: theme?.mark ?? DEFAULTS.mark,
    motion: theme?.motion ?? DEFAULTS.motion,
    emblem: theme?.emblem ?? DEFAULTS.emblem,
  };
}

/** What goes to the server: only what differs from the palette, so a reset is an empty theme. */
export function themeOf(d: Draft): TeamTheme | null {
  const out: TeamTheme = {};
  if (d.accent.toUpperCase() !== DEFAULTS.accent) out.accent = d.accent;
  if (d.highlight.toUpperCase() !== DEFAULTS.highlight) out.highlight = d.highlight;
  if (d.surface.toUpperCase() !== DEFAULTS.surface) out.surface = d.surface;
  if (d.glow.toUpperCase() !== DEFAULTS.glow) out.glow = d.glow;
  if (d.mark !== DEFAULTS.mark) out.mark = d.mark;
  if (d.motion !== DEFAULTS.motion) out.motion = d.motion;
  if (d.emblem.trim()) out.emblem = d.emblem.trim();
  return Object.keys(out).length ? out : null;
}

/**
 * The hand rule: on cream the accent is the hand, on the dark canvas the highlight is, with
 * the surface as the text on it; team accents change glows and selection, never the mark.
 */
export function handOf(d: Pick<Draft, "accent" | "highlight" | "surface">, dark: boolean) {
  return dark ? { hand: d.highlight, handFg: d.surface } : { hand: d.accent, handFg: HAND_TEXT };
}

export type CheckId = "hand-text" | "text-on-hand" | "rail-text" | "highlight-on-surface" | "arcs";

export interface Cell {
  ratio: number;
  min: number;
  ok: boolean;
  /** The two colours the cell compared, for the fix line. */
  pair: [string, string];
}

export interface Check {
  id: CheckId;
  /** Which draft colour a low cell asks to change, and which column decides it. */
  fixes: LookKey;
  min: number;
  cream: Cell;
  dark: Cell;
}

const cell = (a: string, b: string, min: number): Cell => {
  const ratio = contrast(a, b);
  return { ratio, min, ok: ratio >= min, pair: [a, b] };
};

/** The five checks, each on cream and on the dark canvas; every ratio computed, never typed. */
export function checksOf(d: Pick<Draft, "accent" | "highlight" | "surface" | "glow">): Check[] {
  const cream = PALETTE.cream;
  const light = handOf(d, false);
  const dark = handOf(d, true);
  return [
    {
      id: "hand-text",
      fixes: "accent",
      min: 4.5,
      cream: cell(light.hand, cream, 4.5),
      dark: cell(dark.hand, DARK_CANVAS, 4.5),
    },
    {
      id: "text-on-hand",
      fixes: "accent",
      min: 4.5,
      cream: cell(light.hand, light.handFg, 4.5),
      dark: cell(dark.hand, dark.handFg, 4.5),
    },
    {
      id: "rail-text",
      fixes: "surface",
      min: 4.5,
      cream: cell(d.surface, RAIL_TEXT, 4.5),
      dark: cell(d.surface, RAIL_TEXT, 4.5),
    },
    {
      id: "highlight-on-surface",
      fixes: "highlight",
      min: 3,
      cream: cell(d.highlight, d.surface, 3),
      dark: cell(d.highlight, d.surface, 3),
    },
    {
      id: "arcs",
      fixes: "highlight",
      min: 3,
      cream: cell(d.accent, d.highlight, 3),
      dark: cell(d.accent, d.highlight, 3),
    },
  ];
}

/** The low cells, each named by its check and canvas, for the save bar and the fix line. */
export function lowOf(checks: Check[]): { check: Check; canvas: "cream" | "dark" }[] {
  const out: { check: Check; canvas: "cream" | "dark" }[] = [];
  for (const c of checks) {
    if (!c.cream.ok) out.push({ check: c, canvas: "cream" });
    if (!c.dark.ok) out.push({ check: c, canvas: "dark" });
  }
  return out;
}

/** The bar's fill as a share of the width: the ratio over 21, with 1 : 1 at the left edge. */
export function barWidth(ratio: number): number {
  return Math.max(0, Math.min(1, (ratio - 1) / 20));
}

function toHex(r: number, g: number, b: number): string {
  const h = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function mix(hex: string, towards: "black" | "white", t: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const target = towards === "black" ? 0 : 255;
  const ch = (shift: number) => ((n >> shift) & 255) * (1 - t) + target * t;
  return toHex(ch(16), ch(8), ch(0));
}

/**
 * The nearest colour to `hex` that clears `min` against every ground in `against`, found by
 * walking towards black and towards white in 1/96 steps and keeping the shorter walk; null when
 * neither direction gets there (a ground that is itself mid-grey).
 */
export function nearestPassing(hex: string, against: string[], min: number): string | null {
  if (!HEX.test(hex)) return null;
  const passes = (h: string) => against.every((g) => contrast(h, g) >= min);
  if (passes(hex)) return hex.toUpperCase();
  for (let i = 1; i <= 96; i++) {
    const t = i / 96;
    const darker = mix(hex, "black", t);
    if (passes(darker)) return darker;
    const lighter = mix(hex, "white", t);
    if (passes(lighter)) return lighter;
  }
  return null;
}

/** The one fix the page offers: the colour the first low cell asks for, moved until it passes. */
export function fixFor(
  d: Pick<Draft, "accent" | "highlight" | "surface" | "glow">,
  checks: Check[],
): { key: LookKey; from: string; to: string; canvas: "cream" | "dark" } | null {
  const low = lowOf(checks)[0];
  if (!low) return null;
  const key = low.check.fixes;
  const from = d[key];
  // The grounds this colour must clear: every low cell that the same key fixes.
  const grounds = lowOf(checks)
    .filter((l) => l.check.fixes === key)
    .map((l) => (l.canvas === "cream" ? l.check.cream : l.check.dark))
    .map((c) => (c.pair[0].toUpperCase() === from.toUpperCase() ? c.pair[1] : c.pair[0]));
  const min = Math.max(
    ...lowOf(checks)
      .filter((l) => l.check.fixes === key)
      .map((l) => l.check.min),
  );
  const to = nearestPassing(from, grounds, min);
  if (!to || to.toUpperCase() === from.toUpperCase()) return null;
  return { key, from, to, canvas: low.canvas };
}

export type ChangeKey = LookKey | "mark" | "motion" | "emblem";

/** Which rows differ from the saved look, in the order the page lists them. */
export function changesOf(draft: Draft, saved: TeamTheme | null): ChangeKey[] {
  const was = draftOf(saved);
  const out: ChangeKey[] = [];
  for (const k of ["accent", "highlight", "surface", "glow"] as const)
    if (draft[k].toUpperCase() !== was[k].toUpperCase()) out.push(k);
  if (draft.mark !== was.mark) out.push("mark");
  if (draft.motion !== was.motion) out.push("motion");
  if (draft.emblem.trim() !== was.emblem.trim()) out.push("emblem");
  return out;
}

/** A draft is a preset when its four colours are the preset's. */
export function isPreset(
  draft: Pick<Draft, "accent" | "highlight" | "surface" | "glow">,
  theme: TeamTheme,
): boolean {
  return (
    theme.accent?.toUpperCase() === draft.accent.toUpperCase() &&
    theme.highlight?.toUpperCase() === draft.highlight.toUpperCase() &&
    theme.surface?.toUpperCase() === draft.surface.toUpperCase() &&
    theme.glow?.toUpperCase() === draft.glow.toUpperCase()
  );
}
