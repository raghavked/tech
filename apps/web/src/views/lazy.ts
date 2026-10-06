/**
 * The views behind the first paint, loaded on demand. Home ships with the entry chunk because it
 * is the first thing a new browser renders; the session, project and team views (and with them
 * the kernel, the fleet reducer and zod) arrive as separate chunks the first time a route needs
 * them. `warmViews` fetches them once the page is idle so the first navigation does not wait.
 */
import { lazy } from "react";

export const Project = lazy(() => import("./Project.js").then((m) => ({ default: m.Project })));
export const SessionView = lazy(() =>
  import("./SessionView.js").then((m) => ({ default: m.SessionView })),
);
export const Team = lazy(() => import("./Team.js").then((m) => ({ default: m.Team })));
export const Inbox = lazy(() => import("./Inbox.js").then((m) => ({ default: m.Inbox })));
export const Memory = lazy(() => import("./Memory.js").then((m) => ({ default: m.Memory })));
export const Settings = lazy(() => import("./Settings.js").then((m) => ({ default: m.Settings })));
export const Approvals = lazy(() =>
  import("./Approvals.js").then((m) => ({ default: m.Approvals })),
);
export const ChatView = lazy(() => import("./ChatView.js").then((m) => ({ default: m.ChatView })));

let warmed = false;
export function warmViews(): void {
  if (warmed) return;
  warmed = true;
  const go = () => {
    for (const load of [
      () => import("./SessionView.js"),
      () => import("./Project.js"),
      () => import("./Team.js"),
    ])
      load().catch(() => undefined);
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1500);
}
