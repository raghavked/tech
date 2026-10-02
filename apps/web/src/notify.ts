/**
 * Browser notifications, every call guarded: unsupported browsers and denied permission are
 * no-ops. In the desktop shell they are native: webviews have no Notification API, so the
 * shell shows them (apps/desktop) and the OS holds the permission.
 */
import { type NotifyKind, wantsNotify } from "./prefs.js";
import { desktop } from "./shell.js";

export type NotifyPermission = NotificationPermission | "unsupported";

export function notifyPermission(): NotifyPermission {
  try {
    if (desktop()) return "granted";
    return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  } catch {
    return "unsupported";
  }
}

export async function requestNotifications(): Promise<NotifyPermission> {
  try {
    if (desktop()) return "granted";
    if (typeof Notification === "undefined") return "unsupported";
    return await Notification.requestPermission();
  } catch {
    return "unsupported";
  }
}

/**
 * Show a notification only when the tab is hidden and permission was granted. A `kind` lets
 * the person turn that kind off on the Settings page (settings-page). In the desktop shell:
 * only when the window is not focused, as a native notification. The shell's own inbox poll
 * covers approvals and handoffs in every other session, so nothing is missed or shown twice.
 */
export function notifyIfHidden(title: string, body: string, tag?: string, kind?: NotifyKind): void {
  try {
    if (kind && !wantsNotify(kind)) return;
    const d = desktop();
    if (d) {
      if (typeof document !== "undefined" && document.hasFocus()) return;
      d.notify({ title, body, ...(tag ? { tag } : {}) }).catch(() => undefined);
      return;
    }
    if (typeof document === "undefined" || !document.hidden) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const n = new Notification(title, { body, icon: "/favicon.svg", ...(tag ? { tag } : {}) });
    n.onclick = () => {
      try {
        window.focus();
        n.close();
      } catch {
        // ignore
      }
    };
  } catch {
    // Notification constructors throw on some mobile browsers; nothing to do.
  }
}
