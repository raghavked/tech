# Fold mobile

A Capacitor shell around the web client in `apps/web`, with native push. The shell loads
`../web/dist`, so the product is the same client as the web app and the desktop shell.

This directory is excluded from the pnpm workspace (`"fold:excluded": true` here and
`!apps/mobile` in `pnpm-workspace.yaml`) so the monorepo install never pulls the native
toolchains. Install its dependencies here, with npm, when you build the app.

## Build

```bash
pnpm --filter @fold/web build      # the client the shell wraps
cd apps/mobile
npm install
npx cap add ios                      # or: npx cap add android
npx cap sync
npx cap open ios                     # Xcode; or: npx cap open android
```

Repeat `pnpm --filter @fold/web build && npx cap sync` after every client change.

For development on a device, uncomment `server.url` in `capacitor.config.ts` and point it at
the Vite dev server (`pnpm --filter @fold/web dev`), which proxies `/ws` and `/api` to the
Fold server.

## Push

`src/push.ts` registers with APNs/FCM and posts the token to `POST /api/push/subscribe`
(`{ userId, platform, token }`), which the server records in `store/push.json`. Delivery is
an injectable sender on the server; the per-user inbox is also readable at
`GET /api/notifications?user=<id>`. A tapped notification carries a deep link
`fold://p/<project>/s/<session>` that the shell turns into the client's hash route.

Add `fold` as a URL scheme in the iOS target (Info → URL Types) and an intent filter in
`AndroidManifest.xml` so links open the app.
