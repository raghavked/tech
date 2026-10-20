# Hosting: one Vercel deployment

One Vercel project is the whole product: the landing page at `/`, the web app at `/app/`,
and the Henosis server running as a Vercel Function with its store on Supabase Postgres and
sign-in through Supabase Auth. The same code runs locally exactly as before (`henosis serve`
on files, the dev token, the scripted model); the deployment only wires it differently.

## What runs where

| Path | What | Where it comes from |
| --- | --- | --- |
| `/` and the other files in `site/` | the landing page | `site/` copied to `out/` by `scripts/vercel-build.sh` |
| `/app/` | the web app (hash routes under it: `/app/#/p/…`) | `apps/web/dist` built with `HENOSIS_BASE=/app/`, copied to `out/app/` |
| `/ws` | the session websocket | rewritten to the function |
| `/api/*` | every JSON route (`/api/auth`, `/api/me`, `/api/health`, …) | rewritten to the function |
| `/api/server` | the function itself (`api/server.ts`) | Vercel's Node runtime |

`api/server.ts` at the repo root is the function: a module whose default export is a
`node:http` Server with a `ws` WebSocketServer attached (Vercel keeps the upgraded
connections pinned to the instance), with `export const config = { maxDuration: 800 }` so a
session's socket can stay open. It builds one `HenosisServer` per function instance, lazily
on the first request, and mounts it with `HenosisServer.attach(http, { wsPath: null,
apiPrefix: "/api/server" })`: the websocket is accepted on whatever path the rewrite
delivered, and the `/api/server` prefix is stripped before routing. `HenosisServer.listen`
(what `henosis serve` calls) is the same `attach` on a server of its own.

`vercel.json` holds the rewrites. `/ws` and `/api/:path*` go to `/api/server` with the
original path carried in a `__path` query parameter, which the function reads when the
runtime shows it only the destination and drops otherwise; `/api/server` itself is excluded
from the pattern, so it never rewrites to itself. `/app` redirects to `/app/`. The build
command is `scripts/vercel-build.sh`: `pnpm build` with `HENOSIS_BASE=/app/`, then `out/`
assembled from `site/` and `apps/web/dist`. The output directory is `out`.

**The app under a base.** Vite's `base` is `HENOSIS_BASE` (`/` by default, so the dev server,
`pnpm e2e` and the Playwright smoke are unchanged). The service worker is registered at
`${BASE_URL}sw.js` and caches the shell relative to its own location; the manifest's
`start_url`, `scope` and icons are relative; the favicon and manifest links in `index.html`
are rewritten by Vite. The hash router does not change: `/app/#/p/billing/s/x` is the same
route as `/#/p/billing/s/x`. The app keeps calling `/ws` and `/api/...` on its own origin,
which is where the rewrites are.

## Environment variables

Set these on the Vercel project (Production, and Preview if previews should work):

| Variable | Value | Why |
| --- | --- | --- |
| `HENOSIS_STORE` | `postgres` | the store; unset or `file` keeps a file store under `HENOSIS_DIR` |
| `HENOSIS_DATABASE_URL` | the session pooler URL (see below) | `openLiveStore("postgres", …)` |
| `HENOSIS_DIR` | optional, `/tmp/henosis-store` by default | where blobs (and the usage and saved-search files) live |
| `HENOSIS_AUTH` | `supabase` | sign-in through Supabase Auth |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | the project; its JWKS is `<url>/auth/v1/.well-known/jwks.json` and its issuer `<url>/auth/v1` |
| `SUPABASE_ANON_KEY` | the project's anon (publishable) key | handed to the browser by `GET /api/auth` |
| `SUPABASE_JWT_SECRET` | optional | only for a project whose Auth still signs HS256 tokens with a shared secret; current projects sign ES256 and the JWKS is enough |
| `HENOSIS_AUTO_JOIN` | optional, `default:default:default:contributor` by default | where a verified person users.json does not know is placed (`org:team:project:role`, comma-separated); the org, team and project are created on first use |
| `ANTHROPIC_API_KEY` | the key | the Claude model, exactly as `henosis serve --model claude`; without it (or with `HENOSIS_OFFLINE=1`) the scripted model runs |
| `HENOSIS_OFFLINE` | `1` to force the scripted model | |
| `HENOSIS_TOKEN` | not set | the dev-mode shared token; only meaningful without `HENOSIS_AUTH=supabase` |

`GET /api/health` reports what is active: `{ ok, model: "scripted" | "claude", store: "file" |
"postgres", auth: "dev" | "oidc" | "supabase", sessions, projects }`, so a deployment can be
checked from outside.

## Pointing the deployment at a fresh Supabase project

1. In the project's SQL editor, run `scripts/supabase-setup.sql` with `:password` replaced by
   the password the server will connect with. It creates the `henosis` schema, the three
   store tables (`branches`, `events`, `docs`, exactly as `PostgresStore.ensureSchema()`
   creates them), and the login role `henosis_app` with `search_path = henosis, public` and
   grants on the schema and its present and future tables. The store's table names are
   unqualified, so the search path is what puts them in that schema; `ensureSchema()` runs
   `create table if not exists` on every start and creates no schema and no extension.
2. Set `HENOSIS_DATABASE_URL` to the session pooler URL from the project's connection
   settings, with that role: `postgresql://henosis_app.<ref>:<password>@<pooler-host>:5432/postgres`
   (the pooler's session mode; the server holds one pool and runs transactions on it).
3. Set `HENOSIS_STORE=postgres`, `HENOSIS_AUTH=supabase`, `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` (project settings, API). Add `ANTHROPIC_API_KEY` when real sessions
   should run.
4. In Supabase Auth, enable the email provider; magic links and codes are on by default. The
   app sends a six-digit code and the person types it in; the link in the same mail works
   too and comes back to `/app/`. Add the deployment's `https://<host>/app/` to the Auth
   redirect allow-list.
5. Redeploy. `GET /api/health` should say `store: "postgres", auth: "supabase"`, and the first
   sign-in lands in the default project (`HENOSIS_AUTO_JOIN`).

Locally the same works with `HENOSIS_AUTH=supabase SUPABASE_URL=… SUPABASE_ANON_KEY=… pnpm
serve` (and `--store postgres`), which is `henosis serve` with the supabase identity mode.

## Sign-in

`packages/server/src/auth.ts`, mode `supabase`: the web app (`apps/web/src/supabase.ts`,
`views/SupabaseSignIn.tsx`) creates a supabase-js client from what `/api/auth` says, sends a
one-time code with `signInWithOtp`, verifies it with `verifyOtp`, and keeps the access token
as the identity (provider `supabase`, expiry from the JWT), the way the ID token is kept in
oidc mode: sent on every websocket `join` and HTTP request. supabase-js refreshes the token
and reports through `onAuthStateChange`; Sign out calls `signOut`. The library is imported
lazily, so a dev-mode server's bundle does not carry it. The server verifies the token with
jose against the project's JWKS (ES256), or against `SUPABASE_JWT_SECRET` when the token says
HS256 and a secret is set; issuer `<url>/auth/v1`, audience `authenticated`. The user id is
`sub`, the name `user_metadata.full_name`, then `.name`, then the email. A person users.json
does not know is given the memberships `HENOSIS_AUTO_JOIN` names (reusing `mergeSsoUser`),
so a new sign-up lands in a working team with a demo project; a person users.json knows
keeps what the file says.

## Known limits (a demo-grade deployment)

- **One instance holds the folded state.** A `HenosisServer` folds every log in memory and
  writes through to Postgres; that is sound when one process owns the store. Vercel pins a
  websocket to the instance that upgraded it, but a second instance (a cold start beside a
  busy one, another region) would fold from Postgres independently and the two would not see
  each other's live events; writes from both reach the database, so a reload shows the
  union. Until a sticky single instance or a lease on the store is added, treat this as one
  team at a time.
- **Blobs are ephemeral.** Blobs, the usage days file and saved searches live under
  `HENOSIS_DIR` (`/tmp`), which does not survive an instance; the logs and documents are in
  Postgres. A `blobs` table is the next step (docs/04, "Storage").
- **Function duration.** A session's socket closes when the function's `maxDuration` (800 s)
  runs out; the client re-dials and rejoins from the last event it holds (`sinceSeq`), as it
  does on any drop. Long agent turns keep running only while something keeps the instance
  alive.
- **Cold starts.** The first request after an idle period loads every log from Postgres
  (`MirrorStore.open`); the function answers once that is done.
- **Magic links.** The link in the email returns to `/app/` with the session in the URL
  fragment, which supabase-js reads before the router does; the code is the primary path
  because the link opens in whatever browser the mail client picks.
