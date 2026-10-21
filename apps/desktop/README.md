# Henosis desktop

A Tauri v2 shell around the web client in `apps/web`: the same product in a native window,
a tray item that counts the approvals and handoffs awaiting you, a badge on the Dock or
launcher, native notifications, and `henosis://` links that open the right session. Desktop,
web and mobile are one client, the way Claude on the web, Claude Desktop and Claude mobile
are one product.

This directory is excluded from the pnpm workspace (`"henosis:excluded": true` here and
`!apps/desktop` in `pnpm-workspace.yaml`) so the monorepo install never needs a Rust
toolchain, and CI does not build it. Install its dependencies here, with npm, when you build
the app.

```
apps/desktop
├── package.json              npm scripts (dev, build, build:mac, build:win, build:linux, icons)
├── scripts/make-icons.mjs    draws the icon set from the brand mark, Node only
├── src/bridge.js             window.__HENOSIS_DESKTOP__, injected before the client loads
└── src-tauri
    ├── tauri.conf.json       window, henosis:// scheme, bundle and signing settings
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
- The server URL is `HENOSIS_URL` in the environment, else the one-line `server` file in the
  app's config directory (`~/Library/Application Support/team.henosis.desktop/server`,
  `%APPDATA%\team.henosis.desktop\server`, `~/.config/team.henosis.desktop/server`), else
  `http://127.0.0.1:7700`, which is `henosis serve` without flags.
- `notify.ts` sends native notifications through the bridge when the window is not focused;
  webviews have no Notification API of their own.

### The bridge

`src/bridge.js` defines `window.__HENOSIS_DESKTOP__`. Every method returns a promise; every
listener resolves to an unlisten function.

| Method | Purpose |
|---|---|
| `info()` | `{ version, platform, serverUrl, launchRoute, pollSeconds }`; the client sets `:root[data-shell]` from `platform` |
| `notify({ title, body, tag })` | native notification in the one grammar; the same `tag` replaces, never doubles |
| `setIdentity(serverUrl, userId, name)` | whom to poll the inbox for (`null` clears tray and badge); `name` for "Nothing awaits you, Ana." |
| `setRoute(projectId, sessionId)` | the session on screen; its items read while focused |
| `setPending(count)` | the open session's live count changed: poll now |
| `refreshInbox()` | poll now |
| `openExternal(url)` | open in the system browser |
| `setRecents(items)` | the last sessions and rooms by name (`{ kind, title, route, at }`) for Quick open |
| `minimize()`, `toggleMaximize()`, `closeToTray()` | the Windows titlebar's caption buttons; close hides to the tray |
| `onDeepLink(cb)` | `"#/p/<project>/s/<session>"` from a `henosis://` link, a tray row or Quick open |
| `onTray(cb)` | `"open"`, `"pending"`, `"inbox"`, `"approvals"` or `"new"` |
| `onInbox(cb)` | `{ approvals, handoffs, mentions, items, paused }` after every poll |
| `onAction(cb)` | `{ tag, route }` when a notification is acted on; reserved until the notification plugin draws buttons on the desktop (today the click brings Henosis forward and the shell emits nothing) |

### The window

1280 × 840 by default (`tauri.conf.json`). The platform's chrome is set in `main.rs` because the
config cannot differ per platform: on macOS the titlebar is an overlay with the traffic lights
hiddenInset in the navy rail (the client drops its brand row 32 px and makes the session's title
row the drag region, `data-tauri-drag-region`, with its buttons left out of it); on Windows the
window is undecorated and the client draws a 36 px `--rail` titlebar with the mark, "Henosis"
and 46 × 36 caption buttons (`WinTitlebar` in `apps/web/src/App.tsx`). Closing hides to the
tray on both; Quit is in the tray menu. Linux keeps the window manager's decorations.

## Tray, badge and notifications

Every 15 seconds, on focus, and whenever the client reports a change, the shell reads
`GET /api/notifications?user=<id>&unread=1` on the Henosis server (`packages/server/src/notify.ts`
writes that inbox from session events). Unread `approval` and `handoff` items are what
await you:

- The tray menu lists items, not counts: section headers as disabled rows with the count at
  the right (**Pending approvals · 2**, **Handoffs offered · 1**, **Mentions · 2** only when
  there are any), one line per item (who · verb · what · age, from the server's grammar), five
  per section then "and N more… in the queue"; **Quick open** with the last five sessions and
  rooms by name (the client mirrors its recents through `setRecents`) plus Inbox, Approvals
  queue and New session…; **Pause notifications** for an hour, until tomorrow or until you say
  (the icon dims with a moon; approvals still badge); **Open Henosis** (⌥⇧H / Ctrl+Shift+H,
  a global shortcut) and **Quit Henosis**. "Nothing awaits you, Ana." when nothing does. Every
  row is a route into the client. The tray icon gains a dot when something awaits you, and the
  Dock or launcher badge counts approvals plus handoffs, never mentions (macOS and Linux; Tauri
  has no badge count on Windows, where the tray carries it). The OS keeps its own colours: menu
  highlights, notification buttons and the badge are the system's.
- A new item becomes one native notification (title who · verb · what, body where and what it
  means for you; the same tag replaces), unless its session is on screen: the client shows
  those itself from live events, so nothing is shown twice. Under a ratings rule the body says
  the notice opens to rate and approve; nothing approves blind from a banner. The first poll
  after sign-in shows one summary line instead of a toast per item. More than three at once
  collapse into a summary. The notification plugin draws no buttons on the desktop, so the
  one action is the click.
- Items of the session on screen are marked read (`POST /api/notifications`) while the
  window is focused, so the badge drops as you look.
- Notifications are one button: clicking brings Henosis forward where the OS does that for
  bundled apps (macOS, Windows). Open the session from the tray or the client when it does
  not. Bodies name the tool and risk class, never the arguments.

## Menu-bar panel

The client's `#/glance` route is the macOS menu-bar panel (widgets): a bare surface, no rail
and no top row, drawn from `GET /api/glance?user=<id>` on its own timeline (every 8 s, brisker
for half a minute after a vote). It answers the three questions a glance settles, in the
manager's order: Needs you (the one needs-you number in the head, the top gate with its quorum,
Approve · 4 or Approve and a quiet Deny through `POST /api/glance/vote`), Agents (running,
waiting on an approval, blocked), Tokens today (the figure in mono); then Inbox, Approvals,
Pause notifications (an hour, until tomorrow, until you say; the moon takes the count's place)
and Open Henosis. The shell opens it in a popover under the menu-bar item whose title is the
ring plus two numbers (decisions, running); that window and its item are native work in
`main.rs`, not yet built. Until then the panel is reachable from any window at `#/glance`.

## Deep links

`henosis://p/<project>/s/<session>` (and `henosis://m/<team>`) become the client's hash route.
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
`pnpm --filter @henosis/web build` after client changes; `tauri build` does it for you.

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
registers `henosis://` for the current user.

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
publishes. The `.deb` and `.rpm` install the `.desktop` file that registers `henosis://`;
AppImage users register it at first launch (`register_all` in `main.rs`).

## Releasing

Each `tauri build` writes to `src-tauri/target/release/bundle/`. Bump `version` in
`package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` together; the shell
reports it through `info().version`. An auto-updater is a later step
(`docs/research/auto-update-release-pipeline.md`): never relaunch under a driver.
