/**
 * Hooks for the native shells, every call guarded so a plain browser never notices them.
 * Desktop (Tauri, `withGlobalTauri`): the tray's "Pending approvals" item reads the count the
 * client reports; `deep-link` carries a hash route from fold://p/<project>/s/<session>.
 */
interface TauriGlobal {
  core?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> };
  event?: {
    listen: (name: string, cb: (e: { payload: unknown }) => void) => Promise<() => void>;
  };
}

function tauri(): TauriGlobal | undefined {
  try {
    return (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;
  } catch {
    return undefined;
  }
}

let lastPending = -1;

export function reportPendingApprovals(count: number): void {
  if (count === lastPending) return;
  lastPending = count;
  try {
    tauri()
      ?.core?.invoke("set_pending", { count })
      .catch(() => undefined);
  } catch {
    // not in the desktop shell
  }
}

export function connectShell(): void {
  const t = tauri();
  if (!t?.event) return;
  try {
    t.event
      .listen("deep-link", (e) => {
        if (typeof e.payload === "string" && e.payload.startsWith("#/")) location.hash = e.payload;
      })
      .catch(() => undefined);
    t.event
      .listen("tray:pending", () => {
        // The session view lists approvals in its inspector; the home page is the fallback.
        if (!location.hash.includes("/s/")) location.hash = "#/";
      })
      .catch(() => undefined);
  } catch {
    // ignore
  }
}
