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
import { compactTokens } from "@henosis/kernel";
import { useEffect, useSyncExternalStore } from "react";
import { api, type GlanceReport } from "./api.js";
import type { Route } from "./router.js";

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
