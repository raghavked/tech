import { compactTokens } from "@henosis/kernel";
import { type GlanceGate, type GlanceReport, usageTotal } from "@henosis/protocol";
import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api.js";
import { copy } from "./copy.js";
import { type PauseSpan, pauseEndOf } from "./prefs.js";
import type { Route } from "./router.js";

/**
 * The glance (design/henosis SCREENS.md §21, BACKLOG.md L3): one needs-you number for the
 * signed-in person. `GET /api/glance?user=` counts the approvals they can still vote on plus the
 * handoffs offered to them, never mentions, and the same figure rides in every push payload. The
 * phone's Approvals tab, the manager's sentence and the app badge read this store and no other, so
 * the three can never disagree. Polled quietly while any component holds it, like the inbox.
 *
 * The pure helpers at the end (the tab of a route, the phone subtitles, the folded sentence) are
 * tested in glance.test.ts.
 */

export interface GlanceSnapshot {
  userId: string | null;
  report: GlanceReport | null;
  error: string | null;
  loaded: boolean;
}

const EMPTY: GlanceSnapshot = { userId: null, report: null, error: null, loaded: false };
const EVERY_MS = 10_000;

let current: GlanceSnapshot = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let interest = 0;

function set(patch: Partial<GlanceSnapshot>): void {
  current = { ...current, ...patch };
  for (const fn of listeners) fn();
}

/** Read the glance now; a failure keeps the last report and records the error. */
export function refreshGlance(): void {
  const userId = current.userId;
  if (!userId) return;
  api
    .glance(userId)
    .then((report) => {
      if (current.userId !== userId) return;
      // The tab bar and the rail are memoised on this snapshot: a new one only when it changed.
      if (current.loaded && JSON.stringify(report) === JSON.stringify(current.report)) return;
      set({ report, error: null, loaded: true });
    })
    .catch((e: unknown) => {
      if (current.userId !== userId) return;
      set({ error: e instanceof Error ? e.message : String(e), loaded: true });
    });
}

function start(userId: string): void {
  if (current.userId !== userId) {
    current = { ...EMPTY, userId };
    for (const fn of listeners) fn();
  }
  refreshGlance();
  if (timer) return;
  timer = setInterval(refreshGlance, EVERY_MS);
  addEventListener("focus", refreshGlance);
  // A vote, a handoff or a new approval anywhere in the app says so on these events.
  addEventListener("henosis:fleet", refreshGlance);
  addEventListener("henosis:inbox", refreshGlance);
}

function stop(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  removeEventListener("focus", refreshGlance);
  removeEventListener("henosis:fleet", refreshGlance);
  removeEventListener("henosis:inbox", refreshGlance);
}

/** The glance for `userId`, polled while any component holds it. */
export function useGlance(userId: string | null): GlanceSnapshot {
  const snap = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => EMPTY,
  );
  useEffect(() => {
    if (!userId) return;
    interest += 1;
    start(userId);
    return () => {
      interest -= 1;
      if (interest === 0) stop();
    };
  }, [userId]);
  return userId && snap.userId === userId ? snap : EMPTY;
}

/** Test seam: forget the store between tests. */
export function resetGlance(): void {
  stop();
  current = EMPTY;
  interest = 0;
}

// ---- the pure parts ----------------------------------------------------------------------------

/** The needs-you figure a surface may show: null until the server has answered once. */
export function needsYouOf(snap: Pick<GlanceSnapshot, "report">): number | null {
  return snap.report ? snap.report.needsYou : null;
}

export type Tab = "sessions" | "chats" | "approvals" | "me";

/** Which of the four tabs a route sits under; the inbox, memory and search are under Sessions. */
export function tabOf(route: Route): Tab {
  switch (route.name) {
    case "chat":
      return "chats";
    case "approvals":
      return "approvals";
    case "settings":
      return "me";
    default:
      return "sessions";
  }
}

/**
 * The approvals page's phone subtitle: "2 need you · 4 waiting · Payments". With one project its
 * name; with more, their count. Nothing waiting reads "Nothing waiting".
 */
export function approvalsSubtitle(
  needYou: number,
  waiting: number,
  projectNames: string[],
): string {
  const where =
    projectNames.length === 1
      ? (projectNames[0] ?? "")
      : projectNames.length > 1
        ? `${projectNames.length} projects`
        : "";
  if (waiting === 0) return ["Nothing waiting", where].filter(Boolean).join(" · ");
  return [`${needYou} need${needYou === 1 ? "s" : ""} you`, `${waiting} waiting`, where]
    .filter(Boolean)
    .join(" · ");
}

/** The manager's sentence folded to the subtitle on scroll: "4 open · 3 need you · 212k this week". */
export function foldedSentence(open: number, needs: number, tokens: number, range: string): string {
  return [
    `${open} open`,
    needs === 0 ? "nothing needs you" : `${needs} need${needs === 1 ? "s" : ""} you`,
    tokens > 0 ? `${compactTokens(tokens)} ${range}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The glance's pure half (widgets, mobile-rail): what a widget, the lock screen and the
 * menu-bar panel say from one `GlanceReport`. No React and no DOM, so it is unit-tested
 * directly; the panel itself is views/Glance.tsx.
 *
 * The rules the widgets fixed: every figure in mono (the view's job; the strings here carry the
 * short forms), the one needs-you number counts decisions only, the over-budget line turns red
 * and its "· nothing stops" moves to the foot, and a stale widget says "as of" and never guesses.
 */

/** The one state a widget is in; "live" is the ordinary one. */
export type WidgetState = "live" | "empty" | "stale" | "paused";

export function widgetState(p: {
  report: GlanceReport | null;
  /** The last fetch failed after an earlier one succeeded, or nothing has loaded yet. */
  stale: boolean;
  paused: boolean;
}): WidgetState {
  if (p.paused) return "paused";
  if (p.stale || !p.report) return "stale";
  return p.report.needsYou === 0 ? "empty" : "live";
}

/** Input and output only: the budget counts what a turn spends; cache never moves the bar. */
export function usedToday(report: GlanceReport): number {
  return usageTotal(report.tokensToday);
}

/**
 * The small Tokens widget's lines: the figure, "of 200k · 57.4k left" under it, the meter's
 * fill, and when over the budget the number and the meter turn red, the detail says only
 * "Over the budget", and "nothing stops" moves to the foot.
 */
export function tokensLine(
  used: number,
  budget: number | null,
): { figure: string; detail: string; fraction: number | null; over: boolean; foot: string | null } {
  const figure = compactTokens(used);
  if (budget === null || budget <= 0)
    return { figure, detail: copy.glance.noBudget, fraction: null, over: false, foot: null };
  const over = used > budget;
  return {
    figure,
    detail: over
      ? copy.glance.over
      : `${copy.glance.of(compactTokens(budget))} · ${copy.glance.left(compactTokens(budget - used))}`,
    fraction: Math.min(1, used / budget),
    over,
    foot: over ? copy.glance.nothingStops : null,
  };
}

/** The quorum's segments: filled where a vote counts, the next one outlined, the rest empty. */
export function segmentsOf(votes: number, needed: number): ("on" | "next" | "")[] {
  return Array.from({ length: Math.max(0, needed) }, (_, i) =>
    i < votes ? "on" : i === votes ? "next" : "",
  );
}

/** The Needs-you row in the toast's grammar: who's agent · session, "wants to" and the call. */
export function gateLine(gate: GlanceGate): { who: string; session: string; call: string } {
  return { who: copy.glance.whoseAgent(gate.owner), session: gate.title, call: gate.call.name };
}

/** What the Approve button reads: "Approve · 4" under a release gate, "Approve" elsewhere. */
export function approveLabel(gate: GlanceGate, defaultRating: number): string {
  return gate.ratings ? copy.glance.approveWith(defaultRating) : copy.glance.approve;
}

/** The lock screen's one line above the clock: "2 approvals · 3 running · 142.6k". */
export function glanceLine(report: GlanceReport): string {
  return copy.glance.line(
    report.approvals,
    report.agents.running,
    compactTokens(usedToday(report)),
  );
}

/** "09:26" in the viewer's locale: the "as of" time of the last answer the widget got. */
export function asOfText(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** How a pause reads in the head: "until 10:30", "until tomorrow", "until you say". */
export function pauseText(until: number, now: number = Date.now()): string {
  if (!Number.isFinite(until)) return copy.glance.pausedAlways;
  if (until >= pauseEndOf("tomorrow", now)) return copy.glance.pausedTomorrow;
  return copy.glance.pausedUntil(asOfText(until));
}

export const PAUSE_SPANS: { span: PauseSpan; label: string }[] = [
  { span: "hour", label: copy.glance.pauseHour },
  { span: "tomorrow", label: copy.glance.pauseTomorrow },
  { span: "always", label: copy.glance.pauseAlways },
];

/** The ballot's outcome line, shown for a minute after a vote from the widget. */
export function outcomeText(o: {
  outcome: "granted" | "denied" | "pending";
  rating: number | null;
  votes: number;
  needed: number;
}): string {
  if (o.outcome === "granted") return copy.glance.granted(o.rating);
  if (o.outcome === "denied") return copy.glance.denied;
  return copy.glance.heard(o.rating, o.votes, o.needed);
}

/** How long a just-decided row stays before the widget moves on. */
export const OUTCOME_STAYS_MS = 60_000;
