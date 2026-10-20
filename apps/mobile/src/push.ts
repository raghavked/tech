/**
 * Native push for the Henosis mobile shell.
 *
 * Registers with APNs / FCM through @capacitor/push-notifications, posts the device token to
 * the Henosis server, routes a tapped notification to the session it is about, and keeps the
 * app badge at the one needs-you number.
 *
 * Server side: POST /api/push/subscribe with { userId, platform: "ios" | "android", token }
 * records the subscription in store/push.json (packages/server/src/notify.ts). Delivery to
 * APNs/FCM is an injectable Sender on the server; until one is configured the shell also
 * polls GET /api/notifications?user=<id>&unread=1 for its inbox.
 *
 * The needs-you figure (design/henosis SCREENS.md §21): every push payload carries `needsYou`,
 * the approvals this person can still vote on plus the handoffs offered to them, never
 * mentions, computed by the server's glance (GET /api/glance?user=<id>). The app badge and the
 * lock-screen line show that figure and no other, so they agree with the phone's Approvals tab
 * and the manager's sentence. `onBadge` receives it on every push and on every resume.
 */
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export interface PushOptions {
  /** Origin of the Henosis server, e.g. "https://henosis.example.com". */
  serverUrl: string;
  /** The identity chosen in the web client (localStorage "henosis.identity"). */
  userId: string;
  /** Called with a deep link such as henosis://p/<project>/s/<session> when a notification is tapped. */
  onOpen?: (link: string) => void;
  /**
   * Called with the needs-you number whenever it is known: from a push payload's `needsYou`
   * as it arrives, and from the glance when the app resumes. Wire it to the platform's badge
   * (`@capacitor/badge` or the native host).
   */
  onBadge?: (needsYou: number) => void;
}

/**
 * The needs-you figure in a push payload, or null when the payload carries none (an older
 * server, or a notification that is not Henosis's). Pure, for the tests.
 */
export function needsYouOf(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const raw = (data as { needsYou?: unknown }).needsYou;
  const n = typeof raw === "string" ? Number(raw) : raw;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** The glance for a person on a server: the same figure the push carries. */
export function glanceUrl(serverUrl: string, userId: string): string {
  return `${serverUrl}/api/glance?user=${encodeURIComponent(userId)}`;
}

export async function registerPush(opts: PushOptions): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt") perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;

  await PushNotifications.addListener("registration", async ({ value: token }) => {
    try {
      await fetch(`${opts.serverUrl}/api/push/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: opts.userId, platform, token }),
      });
    } catch {
      // The server is unreachable; the next launch registers again.
    }
  });
  await PushNotifications.addListener("registrationError", (err) => {
    console.warn("push registration failed", err);
  });
  // The badge follows the payload's figure, so the lock screen and the tab agree.
  await PushNotifications.addListener("pushNotificationReceived", ({ data }) => {
    const n = needsYouOf(data);
    if (n !== null) opts.onBadge?.(n);
  });
  await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const n = needsYouOf(notification.data);
    if (n !== null) opts.onBadge?.(n);
    const link = String(notification.data?.link ?? "");
    if (link) (opts.onOpen ?? openDeepLink)(link);
  });

  await PushNotifications.register();
  await refreshBadge(opts);
}

/** Read the glance and hand its needs-you number to `onBadge`; a failure keeps the old badge. */
export async function refreshBadge(opts: Pick<PushOptions, "serverUrl" | "userId" | "onBadge">) {
  if (!opts.onBadge) return;
  try {
    const res = await fetch(glanceUrl(opts.serverUrl, opts.userId), {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return;
    const n = needsYouOf(await res.json());
    if (n !== null) opts.onBadge(n);
  } catch {
    // Offline: the last badge stands until the next push or resume.
  }
}

/** henosis://p/<project>/s/<session> → the hash route of the web client. */
export function openDeepLink(link: string): void {
  const m = link.match(/^fold:\/\/(.*)$/);
  if (m) location.hash = `#/${m[1]}`;
}

/** Read the identity the web client stored, so the shell subscribes as the same person. */
export function storedUserId(): string | null {
  try {
    const raw = localStorage.getItem("henosis.identity");
    return raw ? ((JSON.parse(raw) as { userId?: string }).userId ?? null) : null;
  } catch {
    return null;
  }
}
