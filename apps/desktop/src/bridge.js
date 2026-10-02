// Fold desktop bridge. main.rs injects this into the main window before the web client loads,
// so `window.__FOLD_DESKTOP__` is the only thing apps/web/src/shell.ts has to know about the
// shell; nothing in apps/web imports @tauri-apps/*. Every method returns a promise and every
// listener returns a promise of an unlisten function.
(() => {
  if (window.__FOLD_DESKTOP__) return;
  const invoke = (cmd, args) => {
    const t = window.__TAURI_INTERNALS__;
    if (!t || typeof t.invoke !== "function")
      return Promise.reject(new Error("Fold desktop: Tauri IPC is not available"));
    return t.invoke(cmd, args || {});
  };
  const listen = (name, cb) => {
    const ev = window.__TAURI__?.event;
    if (!ev || typeof ev.listen !== "function") return Promise.resolve(() => {});
    return ev.listen(name, (e) => cb(e.payload));
  };
  window.__FOLD_DESKTOP__ = {
    /** Shell version, platform ("macos" | "windows" | "linux"), server URL and a launch route. */
    info: () => invoke("shell_info"),
    /** Native notification. One button: clicking brings Fold forward where the OS does that. */
    notify: (n) => invoke("notify", { title: n.title, body: n.body, tag: n.tag || null }),
    /** Whom to poll /api/notifications for; null clears the tray and badge. */
    setIdentity: (serverUrl, userId) => invoke("set_identity", { serverUrl, userId }),
    /** The session on screen; its inbox items count as read while the window is focused. */
    setRoute: (projectId, sessionId) => invoke("set_route", { projectId, sessionId }),
    /** The open session's live pending count; the shell re-polls so the tray catches up. */
    setPending: (count) => invoke("set_pending", { count }),
    refreshInbox: () => invoke("refresh_inbox"),
    openExternal: (url) => invoke("plugin:opener|open_url", { url }),
    /** "#/p/<project>/s/<session>" from a fold:// link. */
    onDeepLink: (cb) => listen("deep-link", cb),
    /** "pending" or "open" from the tray menu. */
    onTray: (cb) => listen("tray", cb),
    /** { approvals, handoffs, items } after every poll. */
    onInbox: (cb) => listen("inbox", cb),
  };
})();
