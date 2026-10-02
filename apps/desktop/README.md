# Fold desktop

A Tauri v2 shell around the web client in `apps/web`: the same product in a native window,
a tray item that counts the approvals and handoffs awaiting you, a badge on the Dock or
launcher, native notifications, and `fold://` links that open the right session. Desktop,
web and mobile are one client, the way Claude on the web, Claude Desktop and Claude mobile
are one product.

This directory is excluded from the pnpm workspace (`"fold:excluded": true` here and
`!apps/desktop` in `pnpm-workspace.yaml`) so the monorepo install never needs a Rust
toolchain, and CI does not build it. Install its dependencies here, with npm, when you build
the app.

```
apps/desktop
├── package.json              npm scripts (dev, build, build:mac, build:win, build:linux, icons)
├── scripts/make-icons.mjs    draws the icon set from the brand mark, Node only
├── src/bridge.js             window.__FOLD_DESKTOP__, injected before the client loads
└── src-tauri
    ├── tauri.conf.json       window, fold:// scheme, bundle and signing settings
    ├── capabilities/         what the window may call
    ├── entitlements.plist    macOS hardened runtime
    ├── icons/                icon.png, .ico, .icns (committed) and the fuller generated set
    └── src/main.rs           window, tray, badge, inbox poll, notifications, deep links
```

## How it fits the web client

- `apps/web/src/shell.ts` is the only place the client knows about the shell. It detects the
  desktop (`isDesktop()`), reads the bridge (`desktop()`), and tells the shell who is signed
  in (`setIdentity`) and which session is on screen (`setRoute`).
- The bundled client is served from `tauri://localhost` (macOS, Linux) or
  `http://tauri.localhost` (Windows), so `/api` and `/ws` cannot be relative. `apiBase()` in
  `shell.ts` prefixes them with the server URL the shell reports; `api.ts` and `client.ts`
  go through it. In a browser, and under `tauri dev` (the Vite dev server proxies both),
  it is empty and nothing changes.
- The server URL is `FOLD_URL` in the environment, else the one-line `server` file in the
  app's config directory (`~/Library/Application Support/studio.fold.desktop/server`,
  `%APPDATA%\studio.fold.desktop\server`, `~/.config/studio.fold.desktop/server`), else
  `http://127.0.0.1:7700`, which is `fold serve` without flags.
- `notify.ts` sends native notifications through the bridge when the window is not focused;
  webviews have no Notification API of their own.

### The bridge

`src/bridge.js` defines `window.__FOLD_DESKTOP__`. Every method returns a promise; every
listener resolves to an unlisten function.

| Method | Purpose |
|---|---|
| `info()` | `{ version, platform, serverUrl, launchRoute, pollSeconds }` |
| `notify({ title, body, tag })` | native notification; `tag` makes it idempotent |
| `setIdentity(serverUrl, userId)` | whom to poll the inbox for; `null` clears tray and badge |
| `setRoute(projectId, sessionId)` | the session on screen; its items read while focused |
| `setPending(count)` | the open session's live count changed: poll now |
| `refreshInbox()` | poll now |
| `openExternal(url)` | open in the system browser |
| `onDeepLink(cb)` | `"#/p/<project>/s/<session>"` from a `fold://` link or the tray |
| `onTray(cb)` | `"pending"` or `"open"` |
| `onInbox(cb)` | `{ approvals, handoffs }` after every poll |

## Tray, badge and notifications

Every 15 seconds, on focus, and whenever the client reports a change, the shell reads
`GET /api/notifications?user=<id>&unread=1` on the Fold server (`packages/server/src/notify.ts`
writes that inbox from session events). Unread `approval` and `handoff` items are what
await you:

- The tray menu reads **Pending approvals · N**, with **Handoffs offered · N** beneath it when
  there are any, then **Open Fold** and **Quit Fold**. The first two open the first item's
  session. The tray icon gains a dot when N is above zero, and the Dock or launcher badge shows
  the total (macOS and Linux; Tauri has no badge count on Windows, where the tray carries it).
- A new item becomes one native notification, unless its session is on screen: the client
  shows those itself from live events, so nothing is shown twice. The first poll after
  sign-in shows one summary line instead of a toast per item. More than three at once
  collapse into a summary.
- Items of the session on screen are marked read (`POST /api/notifications`) while the
  window is focused, so the badge drops as you look.
- Notifications are one button: clicking brings Fold forward where the OS does that for
  bundled apps (macOS, Windows). Open the session from the tray or the client when it does
  not. Bodies name the tool and risk class, never the arguments.

## Deep links

`fold://p/<project>/s/<session>` (and `fold://m/<team>`) become the client's hash route.
macOS registers the scheme from the bundle's `Info.plist`; Windows and Linux register it at
install and again at launch so `tauri dev` answers links too. The single-instance plugin
forwards a link from a second launch to the running window. A link the app was launched
with reaches the client through `info().launchRoute`.

## Build

Prerequisites once: the Rust toolchain (https://rustup.rs) and Tauri's per-OS prerequisites
(https://v2.tauri.app/start/prerequisites/). Then:

```bash
cd apps/desktop
npm install                 # @tauri-apps/cli
npm run icons               # icon.png, .ico, .icns from the brand mark (committed; optional)
npm run check               # cargo check of src-tauri, no bundling
npm run dev                 # Vite dev server with its /api and /ws proxy, then the window
npm run build               # builds the client, then every bundle this OS can make
```

`npm run icons:full` runs `tauri icon` for the complete platform set. Repeat
`pnpm --filter @fold/web build` after client changes; `tauri build` does it for you.

### macOS
## Release and auto-update

Tagging `desktop-v<version>` runs `.github/workflows/desktop-release.yml`, which builds,
signs and notarizes bundles for macOS, Windows and Linux and attaches them with `latest.json`
to a draft GitHub release; publishing the draft is what installed shells pick up. The shell
checks that manifest after launch and every six hours, downloads quietly, and shows one
"Restart to update" row in the sidebar; it never relaunches on its own. The public key in
`tauri.conf.json` is a placeholder until a key is generated. Everything, including the
secrets and the changelog convention, is in `docs/16_desktop_release.md`.

## Tray

```bash
npm run build:mac                       # .app and .dmg for this architecture
npm run build:mac:universal             # needs: rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

Signing and notarization, with a Developer ID Application certificate in the keychain:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"   # appleid.apple.com → App-Specific Passwords
export APPLE_TEAM_ID="TEAMID"
npm run build:mac
```

Tauri signs with the hardened runtime and `src-tauri/entitlements.plist`, submits the
bundle to the notary service and staples the ticket. `bundle.macOS.signingIdentity` in
`tauri.conf.json` is `null` so an unsigned local build works without any of this; set it, or
the environment variable, for a release. The minimum system is macOS 12 (`set_badge_count`
and the notification interruption levels it will grow into).

### Windows

```bash
npm run build:win                       # NSIS installer and MSI
```

Signing with a code-signing certificate (EV or standard, `.pfx` or in the store):

```bash
# in tauri.conf.json: bundle.windows.certificateThumbprint = "<sha1 thumbprint>"
#                     (digestAlgorithm sha256 and timestampUrl are already set)
# or, for a certificate file:
set TAURI_SIGNING_PRIVATE_KEY=...        # only for the updater; not needed here
signtool sign /fd sha256 /tr http://timestamp.digicert.com /td sha256 /f cert.pfx /p <password> src-tauri\target\release\bundle\nsis\*.exe
```

Tauri runs `signtool` itself when `certificateThumbprint` is set. `webviewInstallMode` is
`downloadBootstrapper`: the installer fetches WebView2 when Windows lacks it. The installer
registers `fold://` for the current user.

### Linux

```bash
npm run build:linux                     # .deb, .rpm and AppImage
```

Build machines need `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`,
`librsvg2-dev` and `libssl-dev` (Debian and Ubuntu names; Fedora and Arch in Tauri's
prerequisites page). The `.deb` depends on `libwebkit2gtk-4.1-0` and
`libayatana-appindicator3-1`; the tray needs an app-indicator host (GNOME: the AppIndicator
extension). Sign packages after the build: `dpkg-sig --sign builder *.deb`,
`rpm --addsign *.rpm`, and `gpg --detach-sign *.AppImage` with the key your repository
publishes. The `.deb` and `.rpm` install the `.desktop` file that registers `fold://`;
AppImage users register it at first launch (`register_all` in `main.rs`).

## Releasing

Each `tauri build` writes to `src-tauri/target/release/bundle/`. Bump `version` in
`package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` together; the shell
reports it through `info().version`. An auto-updater is a later step
(`docs/research/auto-update-release-pipeline.md`): never relaunch under a driver.
