/**
 * Hooks for the native shells, every call guarded so a plain browser never notices them.
 *
 * Desktop (apps/desktop, Tauri v2): the shell injects `window.__HENOSIS_DESKTOP__` before the
 * client loads (apps/desktop/src/bridge.js). Through it the client tells the shell whom to poll
 * `/api/notifications` for and which session is on screen, asks for native notifications, and
 * receives `#/p/<project>/s/<session>` routes from henosis:// links and tray clicks. Nothing here
 * imports `@tauri-apps/*`; a shell built without the bridge still works through the global
 * Tauri object (`withGlobalTauri`).
 */
import { getIdentity, onIdentityChange } from "./identity.js";
import { LINK_EVENT } from "./links.js";
import { parseHash } from "./router.js";

export interface DesktopInfo {
  version: string;
  platform: "macos" | "windows" | "linux" | string;
  /** Origin the shell polls; the bundled client reaches /api and /ws there too. */
  serverUrl: string;
  /** The route of the henosis:// link the app was launched with, once. */
  launchRoute: string | null;
  pollSeconds: number;
}

export interface DesktopNotification {
  title: string;
  body: string;
  /** Idempotency key for the life of the shell process (an approval or handoff id). */
  tag?: string;
}

export interface HenosisDesktop {
  info: () => Promise<DesktopInfo>;
  notify: (n: DesktopNotification) => Promise<unknown>;
  setIdentity: (serverUrl: string | null, userId: string | null) => Promise<unknown>;
  setRoute: (projectId: string | null, sessionId: string | null) => Promise<unknown>;
  setPending: (count: number) => Promise<unknown>;
  refreshInbox: () => Promise<unknown>;
  openExternal: (url: string) => Promise<unknown>;
  onDeepLink: (cb: (route: unknown) => void) => Promise<() => void>;
  onTray: (cb: (item: unknown) => void) => Promise<() => void>;
  onInbox: (cb: (counts: unknown) => void) => Promise<() => void>;
}

/** Hand a henosis:// link or a hash route to the client's link handler (`connectLinks`). */
export function dispatchLink(link: string): void {
  try {
    dispatchEvent(new CustomEvent(LINK_EVENT, { detail: link }));
  } catch {
    // no window
  }
}

interface TauriGlobal {
  core?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> };
  event?: {
    listen: (name: string, cb: (e: { payload: unknown }) => void) => Promise<() => void>;
  };
  // tauri-plugin-updater and tauri-plugin-process, injected under withGlobalTauri.
  updater?: { check: () => Promise<TauriUpdate | null> };
  process?: { relaunch: () => Promise<void> };
}

interface TauriUpdate {
  version: string;
  currentVersion: string;
  body?: string | null;
  download?: () => Promise<void>;
  install?: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
}

/**
 * Auto-update (docs/16_desktop_release.md). The shell checks the signed manifest shortly
 * after launch and every six hours, downloads a newer build silently, and then waits: the
 * shell never relaunches on its own, because a session may be running for days under a
 * driver with an approval open. The sidebar shows one quiet row, "Restart to update", and the
 * person chooses when.
 */
export interface UpdateReady {
  version: string;
  downloaded: boolean;
}

let ready: UpdateReady | null = null;
let pending: TauriUpdate | null = null;
const listeners = new Set<(u: UpdateReady | null) => void>();

export function subscribeUpdate(cb: (u: UpdateReady | null) => void): () => void {
  listeners.add(cb);
  cb(ready);
  return () => {
    listeners.delete(cb);
  };
}

function setReady(u: UpdateReady | null): void {
  ready = u;
  for (const cb of listeners) cb(u);
}

const CHECK_DELAY_MS = 15_000;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

async function checkForUpdate(): Promise<void> {
  const t = tauri();
  if (!t?.updater || pending) return;
  try {
    const update = await t.updater.check();
    if (!update) return;
    pending = update;
    if (update.download) {
      await update.download();
      setReady({ version: update.version, downloaded: true });
    } else {
      setReady({ version: update.version, downloaded: false });
    }
  } catch {
    // offline, the manifest is unreachable, or the placeholder public key is still in place
    pending = null;
  }
}

/** Install the downloaded build and relaunch; only ever called from the person's click. */
export async function restartToUpdate(): Promise<void> {
  const t = tauri();
  const update = pending;
  if (!t || !update) return;
  try {
    if (update.install && ready?.downloaded) await update.install();
    else await update.downloadAndInstall();
    await t.process?.relaunch();
  } catch {
    // the installer itself reports failures; leave the row so the person can retry
  }
}

function scheduleUpdateChecks(): void {
  if (!tauri()?.updater) return;
  setTimeout(() => {
    void checkForUpdate();
    setInterval(() => void checkForUpdate(), CHECK_EVERY_MS);
  }, CHECK_DELAY_MS);
}

type Globals = { __HENOSIS_DESKTOP__?: HenosisDesktop; __TAURI__?: TauriGlobal };

/** The global Tauri API object (`withGlobalTauri`), or undefined in a browser. */
function tauri(): TauriGlobal | undefined {
  try {
    return (window as unknown as Globals).__TAURI__;
  } catch {
    return undefined;
  }
}

/** The bridge the shell injected, or one assembled from the global Tauri object, or nothing. */
export function desktop(): HenosisDesktop | undefined {
  try {
    const g = window as unknown as Globals;
    if (g.__HENOSIS_DESKTOP__) return g.__HENOSIS_DESKTOP__;
    const t = g.__TAURI__;
    if (!t?.core) return undefined;
    const invoke = t.core.invoke;
    const listen = <T>(name: string, cb: (p: T) => void) =>
      t.event ? t.event.listen(name, (e) => cb(e.payload as T)) : Promise.resolve(() => {});
    g.__HENOSIS_DESKTOP__ = {
      info: () => invoke("shell_info") as Promise<DesktopInfo>,
      notify: (n) => invoke("notify", { title: n.title, body: n.body, tag: n.tag ?? null }),
      setIdentity: (serverUrl, userId) => invoke("set_identity", { serverUrl, userId }),
      setRoute: (projectId, sessionId) => invoke("set_route", { projectId, sessionId }),
      setPending: (count) => invoke("set_pending", { count }),
      refreshInbox: () => invoke("refresh_inbox"),
      openExternal: (url) => invoke("plugin:opener|open_url", { url }),
      onDeepLink: (cb) => listen("deep-link", cb),
      onTray: (cb) => listen("tray", cb),
      onInbox: (cb) => listen("inbox", cb),
    };
    return g.__HENOSIS_DESKTOP__;
  } catch {
    return undefined;
  }
}

export function isDesktop(): boolean {
  return desktop() !== undefined;
}

const SERVER_KEY = "henosis.server";
const DEFAULT_SERVER = "http://127.0.0.1:7700";
let serverUrl = "";

function rememberServer(url: string): void {
  serverUrl = url.replace(/\/$/, "");
  try {
    localStorage.setItem(SERVER_KEY, serverUrl);
  } catch {
    // ignore
  }
}

/**
 * Where `/api` and `/ws` live. Empty (same origin) in a browser and under `tauri dev`, whose
 * Vite server proxies them; the shell's server URL when the client is the bundled build served
 * from `tauri://localhost` (macOS, Linux) or `http://tauri.localhost` (Windows). Until the
 * shell has answered `info()`, the URL remembered from the last launch, then `henosis serve`'s.
 */
export function apiBase(): string {
  try {
    const bundled =
      location.protocol === "tauri:" ||
      location.hostname === "tauri.localhost" ||
      location.protocol === "asset:";
    if (!bundled) return "";
    if (!serverUrl) serverUrl = localStorage.getItem(SERVER_KEY) || DEFAULT_SERVER;
    return serverUrl;
  } catch {
    return serverUrl || DEFAULT_SERVER;
  }
}

/** Prefix a same-origin path such as `/api/me` with `apiBase()`. */
export function apiUrl(path: string): string {
  return `${apiBase()}${path}`;
}

/** `/ws` next to `/api`, as a ws:// or wss:// URL. */
export function wsBase(): string | null {
  const base = apiBase();
  return base ? `${base.replace(/^http/, "ws")}/ws` : null;
}

let lastPending = -1;

/** The open session's live pending count; the shell re-polls the inbox so the tray catches up. */
export function reportPendingApprovals(count: number): void {
  if (count === lastPending) return;
  lastPending = count;
  try {
    desktop()
      ?.setPending(count)
      .catch(() => undefined);
  } catch {
    // not in the desktop shell
  }
}

const isRoute = (p: unknown): p is string => typeof p === "string" && p.startsWith("#/");

/**
 * Called once from main.tsx before the first render. Resolves at once outside the desktop
 * shell; inside it, when the shell has said where the server is (or after a short wait).
 */
export function connectShell(): Promise<void> {
  scheduleUpdateChecks();
  const d = desktop();
  if (!d) return Promise.resolve();
  try {
    const sendIdentity = () => {
      const id = getIdentity();
      d.setIdentity(apiBase() || location.origin, id?.userId ?? null).catch(() => undefined);
    };
    const sendRoute = () => {
      const r = parseHash(location.hash);
      const [p, s] = r.name === "session" ? [r.projectId, r.sessionId] : [null, null];
      d.setRoute(p, s).catch(() => undefined);
    };
    onIdentityChange(sendIdentity);
    addEventListener("hashchange", sendRoute);
    // Both land on the "henosis:link" DOM event that links.ts routes (hash routes and henosis:// alike).
    d.onDeepLink((route) => {
      if (typeof route === "string") dispatchLink(route);
    }).catch(() => undefined);
    d.onTray((item) => {
      // The session view lists approvals in its inspector; elsewhere the inbox has them.
      if (item === "pending" && !location.hash.includes("/s/")) dispatchLink("henosis://inbox");
    }).catch(() => undefined);
    const ready = d
      .info()
      .then((info) => {
        if (info.serverUrl) rememberServer(info.serverUrl);
        if (isRoute(info.launchRoute)) location.hash = info.launchRoute;
      })
      .catch(() => undefined)
      .then(() => {
        sendIdentity();
        sendRoute();
      });
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500));
    return Promise.race([ready, timeout]);
  } catch {
    return Promise.resolve();
  }
}
