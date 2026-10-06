/**
 * Native push for the Henosis mobile shell.
 *
 * Registers with APNs / FCM through @capacitor/push-notifications, posts the device token to
 * the Henosis server, and routes a tapped notification to the session it is about.
 *
 * Server side: POST /api/push/subscribe with { userId, platform: "ios" | "android", token }
 * records the subscription in store/push.json (packages/server/src/notify.ts). Delivery to
 * APNs/FCM is an injectable Sender on the server; until one is configured the shell also
 * polls GET /api/notifications?user=<id>&unread=1 for its inbox.
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
  await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const link = String(notification.data?.link ?? "");
    if (link) (opts.onOpen ?? openDeepLink)(link);
  });

  await PushNotifications.register();
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
