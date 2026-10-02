/** Browser notifications, every call guarded: unsupported browsers and denied permission are no-ops. */

export type NotifyPermission = NotificationPermission | "unsupported";

export function notifyPermission(): NotifyPermission {
  try {
    return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  } catch {
    return "unsupported";
  }
}

export async function requestNotifications(): Promise<NotifyPermission> {
  try {
    if (typeof Notification === "undefined") return "unsupported";
    return await Notification.requestPermission();
  } catch {
    return "unsupported";
  }
}

/** Show a notification only when the tab is hidden and permission was granted. */
export function notifyIfHidden(title: string, body: string, tag?: string): void {
  try {
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
