# Desktop shell choice in 2026: Tauri 2 vs Electron for Henosis

Slug: tauri-vs-electron-2026. Researched 2026-10-02. Several vendor pages (v2.tauri.app, codenote.net) are blocked by the egress proxy; where a claim rests on a search snippet rather than a fetched page it is marked UNVERIFIED.

## Why it matters for Henosis

Henosis's README and `docs/04_technical_architecture.md` already commit to a position: the web app is the product, and the desktop shell is a thin Tauri wrapper that adds a tray, native notifications and `henosis://p/<project>/s/<session>` deep links. `apps/desktop/src-tauri/tauri.conf.json` exists with a tray icon, a `deep-link` plugin entry, `csp: null` and `targets: "all"`. So the real question is not "which framework" in the abstract but: does Tauri 2 carry the specific native surface Henosis needs (tray, notifications, deep links, updater, signing, Windows and Linux packaging) without pulling product work into the shell, and where is the exit ramp if it does not.

The shape of Henosis's desktop use matters. A session page is open for hours or days, in the background, while an engineer works elsewhere. The shell's job is to wake them: an approval needed, a contention raised, a handoff brief ready. That rewards low idle memory, a reliable tray, actionable notifications and a deep link that lands on the exact session, far more than it rewards Chromium-exact rendering.

## Prior art

1. **Claude Desktop (Anthropic)**: Electron, reported at Electron 41.1.0 with 42 detected dependencies; Boris Cherny has said the team chose Electron because engineers knew it and it keeps web and desktop features identical. https://desktopinsights.com/apps/claude-desktop (accessed 2026-10-02; version figure UNVERIFIED, snippet only).
2. **ChatGPT desktop (OpenAI)**: native Swift on macOS; an Electron wrapper on Windows at roughly 260 MB, next to Microsoft Copilot's WebView2 build under 600 KB. https://www.windowslatest.com/2024/10/18/i-tried-the-official-chatgpt-app-for-windows-11-its-just-an-electron-based-chrome-wrapper/ (accessed 2026-10-02).
3. **Linear**: Electron 39.3.0, 308 MB on Apple Silicon, signed and notarised, uses electron-updater and electron-log; last updated 2026-03-19. https://desktopinsights.com/apps/linear (accessed 2026-10-02; UNVERIFIED, snippet only).
4. **Cursor**: a VS Code fork on Electron; forum threads document renderer processes above 4 GB and Windows heap-fragmentation crashes. https://forum.cursor.com/t/cursor-crashes-frequently-on-windows-renderer-process-exceeds-4gb-memory-possible-memory-leak/147231 (accessed 2026-10-02).
5. **Tauri 2 Linux graphics guidance**: official page on WebKitGTK blank-window and resize crashes on NVIDIA and Wayland, with the `__NV_DISABLE_EXPLICIT_SYNC`, `WEBKIT_DISABLE_DMABUF_RENDERER` and `WEBKIT_DISABLE_COMPOSITING_MODE` ladder. https://v2.tauri.app/develop/debug/linux-graphics/ (accessed 2026-10-02 via snippet; page blocked). Yaak, a Tauri app, documents the same for its users: https://yaak.app/docs/getting-started/linux-graphics-issues.
6. **Tauri 2 Windows installer**: NSIS and MSI targets, WebView2 install modes (`downloadBootstrapper` default, `embedBootstrapper` +1.8 MB, `offlineInstaller` +127 MB, `fixedVersion`). https://v2.tauri.app/distribute/windows-installer/ (accessed 2026-10-02 via snippet; page blocked).
7. **electron-builder MSIX**: MSIX target is beta, shares `makeappx.exe` and manifest with AppX, recommended for Store, Intune sideloading and Windows SE. https://www.electron.build/docs/msix/ (accessed 2026-10-02 via snippet).

Benchmark figures circulating in 2026 comparisons (Tauri hello-world 3.2 MB vs Electron 34 at 85 MB; idle memory 42 MB vs 168 MB; cold start 380 ms vs 1,420 ms) come from vendor-adjacent blogs and are UNVERIFIED, but the order of magnitude is consistent across every source and matches Henosis's own expectations: a Tauri shell ships in single-digit megabytes because it borrows WebView2, WKWebView or WebKitGTK from the OS. Electron 40 (Chromium 144, January 2026), 41 (March) and 42 (May) are on an eight-week cadence, so an Electron app must take a Chromium bump every two months to stay patched. https://www.electronjs.org/blog/electron-40-0

## What to borrow

- **From Claude Desktop and Linear**: the one-web-client rule. Neither builds features in the shell; the shell is transport. Henosis's `apps/web` must stay the only place product logic lives, and the shell's native surface must sit behind a small adapter so the shell can be swapped.
- **From ChatGPT**: per-platform pragmatism. OpenAI went native where the platform rewards it (macOS) and web-wrapped where it does not (Windows). Henosis does not need Swift, but it should accept that macOS and Linux will not have identical polish and budget accordingly.
- **From Tauri's deep-link plugin**: the `single-instance` integration. On Windows and Linux a deep link spawns a new process with the URL as an argument; without the single-instance plugin Henosis would open a second window per notification click. https://v2.tauri.app/plugin/deep-linking/
- **From Yaak**: ship the Linux graphics workarounds in the app, not in a support article. Detect NVIDIA or a Wayland Error 71 and set the env var before the webview starts.
- **From Electron's updater ecosystem**: the discipline, not the code. Signed manifests, staged rollout, a kill switch. The Tauri updater signs each artifact with a minisign key, but a 2026 advisory snippet (CVE-2026-95625, UNVERIFIED) says the manifest itself is only TLS-protected and the version check is the only anti-rollback guard. Henosis should serve its manifest from infrastructure it controls and pin minimum versions server-side.

## What is unsolved

- **Three rendering engines.** WebKitGTK on Linux lags Chromium and WebKit on macOS; the DMABUF and Wayland crashes are real and hardware-dependent. Henosis's interface is deliberately plain (one 760px column, hairlines, no shadows, `design/tokens.css`), which keeps it inside the safe subset, but any future canvas, WebGPU or heavy animation work must be tested on all three.
- **Windows MSIX.** Tauri's bundler produces NSIS and MSI, not MSIX; Store and Intune distribution would need a post-build `makeappx` step or Microsoft's `winapp` CLI, neither first-class (UNVERIFIED that no community plugin covers it). electron-builder's MSIX target is itself beta.
- **Linux tray.** Both frameworks depend on StatusNotifierItem via libayatana-appindicator; GNOME needs a Shell extension, Debian 11 lacks libayatana, and there are 2026 reports of SNI objects going dead in both Electron (Obsidian on Electron 43.3) and tray-icon. The tray cannot be Henosis's only wake-up path on Linux.
- **Notifications with actions.** Tauri's notification plugin covers all five platforms and action buttons, but "Approve" from a notification is an authority-bearing act in Henosis's kernel; it needs the same identity and quorum checks as the web composer, and a notification click is not a signed approval.
- **Updater trust model.** Minisign on artifacts is good; the unsigned manifest and version-only rollback check are not good enough for a product whose threat model (`docs/09_threat_model.md`) includes a tampered shell approving tool calls.

## Concrete recommendations for Henosis

1. **Stay on Tauri 2 for the shell; keep an Electron exit ramp by contract, not by code.** Create `apps/web/src/shell/adapter.ts` with an interface (`notify`, `setBadge`, `onDeepLink`, `openExternal`, `isDesktop`) implemented once for Tauri (`window.__TAURI__`) and once as a no-op for the browser. Nothing in `apps/web` imports `@tauri-apps/*` directly.
2. **Add the single-instance plugin with the `deep-link` feature** to `apps/desktop/src-tauri/Cargo.toml` and `src-tauri/src/lib.rs`, so `henosis://p/<project>/s/<session>` always lands in the running window; register the scheme in `Info.plist` for macOS (the plugin's `register()` is unsupported there) and keep the existing `plugins.deep-link.desktop.schemes` in `tauri.conf.json`.
3. **Replace `csp: null`** in `apps/desktop/src-tauri/tauri.conf.json` with a real policy (`default-src 'self'; connect-src https://*.henosis.team wss://*.henosis.team`) and set `withGlobalTauri: false` once the adapter in (1) uses the npm API. A shell that approves tool calls must not run with a null CSP.
4. **Updater and signing.** Add `tauri-plugin-updater`; put the minisign public key under `plugins.updater.pubkey` and serve the manifest from Henosis's own API (`packages/server`, route `/desktop/updates/{target}/{arch}/{version}`) so the server, not the manifest, enforces a minimum version and a kill switch. Sign macOS with Developer ID plus notarytool and Windows with Azure Trusted Signing in a new `.github/workflows/desktop-release.yml` using `tauri-apps/tauri-action`.
5. **Windows packaging.** Set `bundle.targets` to `["nsis", "dmg", "appimage", "deb"]` (drop `"all"` and MSI), `bundle.windows.webviewInstallMode` to `embedBootstrapper`, and defer MSIX to a Phase 1 ticket that evaluates a `makeappx` post-step; document in `apps/desktop/README.md` that Store distribution is not in Phase 0.
6. **Linux resilience.** In `src-tauri/src/main.rs`, before building the app, detect an NVIDIA driver (`/proc/driver/nvidia/version`) or `HENOSIS_SAFE_GRAPHICS=1` and set `WEBKIT_DISABLE_DMABUF_RENDERER=1`; ship a `fold --safe-graphics` flag. Treat the tray as optional on Linux: notifications and the dock badge are the wake-up path, and `apps/desktop/README.md` lists `libayatana-appindicator3` and the GNOME extension.
7. **Notifications as pointers, never as approvals.** Use `tauri-plugin-notification` with a single action, "Open", that fires the deep link. Approval, quorum votes and contention resolution stay in the composer and the approval notice, where the kernel's authority checks run. Record this in `docs/07_security_and_compliance.md`.

## Sources

- https://desktopinsights.com/apps/claude-desktop (2026-10-02, UNVERIFIED)
- https://desktopinsights.com/apps/linear (2026-10-02, UNVERIFIED)
- https://www.windowslatest.com/2024/10/18/i-tried-the-official-chatgpt-app-for-windows-11-its-just-an-electron-based-chrome-wrapper/ (2026-10-02)
- https://forum.cursor.com/t/cursor-crashes-frequently-on-windows-renderer-process-exceeds-4gb-memory-possible-memory-leak/147231 (2026-10-02)
- https://v2.tauri.app/develop/debug/linux-graphics/ (2026-10-02, blocked; snippet)
- https://yaak.app/docs/getting-started/linux-graphics-issues (2026-10-02)
- https://v2.tauri.app/distribute/windows-installer/ (2026-10-02, blocked; snippet)
- https://v2.tauri.app/plugin/deep-linking/ (2026-10-02, blocked; snippet)
- https://www.electron.build/docs/msix/ (2026-10-02, snippet)
- https://www.electronjs.org/blog/electron-40-0 (2026-10-02, snippet)
- https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/updater (2026-10-02)
- https://security-tracker.debian.org/tracker/CVE-2026-95625 (2026-10-02, UNVERIFIED)
- https://forum.obsidian.md/t/linux-tray-icon-is-a-dead-placeholder-obsidian-1-13-7-bundles-electron-43-3-0-fixed-upstream-in-43-4-1/117750 (2026-10-02)
- https://betterstack.com/community/guides/scaling-nodejs/tauri-vs-electron-vs-deno-vs-electrobun/ (2026-10-02, benchmark figures UNVERIFIED)
