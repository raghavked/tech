# Fold desktop

A Tauri v2 shell around the web client in `apps/web`: the built client in a native window,
a tray with a **Pending approvals** item, system notifications and `fold://` deep links.
The window shows the same product as the web app and the mobile shell.

This directory is excluded from the pnpm workspace (`"fold:excluded": true` here and
`!apps/desktop` in `pnpm-workspace.yaml`) so the monorepo install never needs a Rust
toolchain. Install its dependencies here, with npm, when you build the app.

## Build

```bash
# once: Rust toolchain (https://rustup.rs) and the Tauri prerequisites for your OS
cd apps/desktop
npm install
npx tauri icon src-tauri/icons/icon.svg     # platform icons from the favicon
npx tauri dev                               # runs the Vite dev server and opens the window
npx tauri build                             # builds the client, then the installer
```

`src-tauri/tauri.conf.json` points `frontendDist` at `../../web/dist` and runs
`pnpm --filter @fold/web build` before a build. The client talks to the Fold server
over `/ws` and `/api`; serve `dist` from the same origin as the server, or use the dev
server's proxy.

## Tray

The tray menu has three items:

- **Pending approvals · N** — the count the client reports through the `set_pending`
  command; clicking it focuses the window and emits `tray:pending`, which the client handles
  by opening the approvals it can vote on.
- **Open Fold** — shows and focuses the window.
- **Quit**.

## Deep links

Notifications carry `fold://p/<project>/s/<session>`. The shell registers the `fold`
scheme (tauri-plugin-deep-link), converts the URL to the client's hash route and emits
`deep-link`; the client sets `location.hash` from it.
