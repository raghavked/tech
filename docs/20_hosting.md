# Hosting: one Vercel deployment

One Vercel project is the whole product: the landing page at `/`, the web app at `/app/`,
and the Henosis server running as a Vercel Function with its store on Supabase Postgres and
sign-in through Supabase Auth. Each company that signs in makes its own workspace and brings
its own model key ("Workspaces and keys" below). The same code runs locally exactly as before
(`henosis serve` on files, the dev token, the scripted model, one company's server); the
deployment only wires it differently.

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
connections pinned to the instance), with `export const config = { maxDuration: 300 }` so a
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
| `HENOSIS_TENANCY` | optional, `workspaces` by default under `HENOSIS_AUTH=supabase` (`shared` otherwise) | `workspaces`: each company makes its own workspace and sees only that. `shared`: the one-company server `henosis serve` is by default |
| `HENOSIS_KEYS_SECRET` | a long random string, 16 characters or more (`openssl rand -hex 32`) | seals the model key each workspace connects; without it no key can be connected and every workspace stays on the demo model. Keep it out of the database and its backups |
| `HENOSIS_AUTO_JOIN` | optional, `shared` tenancy only; `default:default:default:contributor` by default | where a verified person users.json does not know is placed (`org:team:project:role`, comma-separated); the org, team and project are created on first use. A server of workspaces ignores it: nobody is placed, people make or join a workspace |
| `HENOSIS_OFFLINE` | not set; `1` blocks every provider call | with it on, workspace keys are kept but not called, and every workspace runs the demo model. `0`, `false` and `no` mean off |
| `HENOSIS_TOKEN` | not set | the dev-mode shared token; only meaningful without `HENOSIS_AUTH=supabase` |

The function reads no provider key. `ANTHROPIC_API_KEY` in the project's environment does
nothing here (`envKey: false` in `api/server.ts`); remove it if an earlier deployment set it.
The models a workspace runs on come from the key that workspace connected, and from nowhere
else.

`GET /api/health` reports what is active: `{ ok, model: "scripted" | "claude", store: "file" |
"postgres", auth: "dev" | "oidc" | "supabase", tenancy: "shared" | "workspaces", keys: true |
false, sessions, projects }`, so a deployment can be checked from outside. `model` is the
server's own model, which is what a workspace without a key runs on: `scripted` for the
hosted function. `keys` says whether workspaces can connect a key here (the server has a
secret to seal them with). A server of workspaces lists no `sessions` and no `projects`: both
are empty arrays, since the route is open to anyone.

## Workspaces and keys

**Making a workspace.** A person signs in with the emailed code and, being in no workspace
yet, is asked for one: a name for their company. The server makes an org with that name, a
first team called General and a first project called Main, and the person is its admin. Ids
are made from the name and are unique on the server. One person can make five workspaces.

**Bringing people in.** An admin makes an invitation link in Settings, Workspace, and sends
it themselves; the link is `/app/#/join/<token>`. The token is shown once, when the link is
made, and only its SHA-256 hash is stored. A link works for 14 days. Addressed to an email,
it works once and only for a person signed in with that address; left open, anyone who has it
can join until it expires or the admin withdraws it. The person who opens it sees which
workspace it leads to and who invited them, and joins on one press. Admins change a person's
role (admin or member), remove people, and add teams and projects; a member can leave; a
workspace keeps at least one admin.

**Isolation.** Membership decides everything a person can see. Every HTTP route and every
websocket join and subscription checks it, and a workspace answers anyone outside it with 404,
as if it did not exist. A session is opened by its id, so a session id that already lives in
another project is refused. Every route except `/api/auth` and `/api/health` needs a signed-in
person. The rules are listed in `07_security_and_compliance.md`, "Tenancy and model keys".

**Connecting the key.** The hosted service has no provider key of its own. In Settings,
Workspace, an admin pastes the workspace's Anthropic API key. The server then:

1. checks it with Anthropic by listing models with it, which spends no tokens; a key
   Anthropic refuses is not stored, and neither is one that could not be checked because
   Anthropic could not be reached;
2. seals it with AES-256-GCM under a key derived with HKDF-SHA256 from `HENOSIS_KEYS_SECRET`
   and the workspace id, with the workspace id and the provider bound in as associated data,
   so one workspace's sealed key does not open as another's;
3. writes the sealed key to the `keys` document of the store (the `docs` table in Postgres,
   `keys.json` in a folder store), beside its last four characters, who connected it and
   when;
4. never answers it again. `GET /api/workspaces/:org/model` and every other route show the
   last four characters, who connected it, when, and whether Anthropic last accepted it.

**Running on it.** From the next turn the workspace's session agents and the member models
of its councils run on that key. The admin picks the workspace's default model from the
models the key can use; a member model whose profile names another model runs on that one,
on the same key. Usage is billed by Anthropic to the key's owner, not by Henosis. A workspace
without a key runs the scripted demo model, which only acts out a session, and the app says
so in a line under the top row, with "Connect your key" for an admin.

**When the key stops working.** If Anthropic refuses the key in the middle of a turn, the
server remembers it, Settings shows "Refused by Anthropic", and the turn ends with a sentence
the team can act on: an admin can replace the key in Settings, Workspace. An admin can check
the key again, replace it, or disconnect it; disconnecting returns the workspace to the demo
model.

**The secret.** The sealed keys are in the database; `HENOSIS_KEYS_SECRET` is in the Vercel
project's environment and nowhere else. A copy of the database without the secret opens no
key. Rotating the secret means every workspace connects its key again: a key sealed under the
old secret no longer opens, and its workspace runs the demo model until an admin replaces it.

**Self-hosted.** `henosis serve` is a `shared` server unless `HENOSIS_TENANCY=workspaces` says
otherwise: it makes no workspaces, and its org, teams and projects are set by whoever runs it.
The org admin in `users.json` connects a key in Settings the same way. When
`HENOSIS_KEYS_SECRET` is unset and the store is a folder, the server keeps a random secret
beside it in `keys.secret` (mode 600); with `--store postgres` the variable must be set.
`--model claude` with the operator's own `ANTHROPIC_API_KEY` still works there, and is what a
workspace without a key of its own then runs on.

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
   `SUPABASE_ANON_KEY` (project settings, API), and `HENOSIS_KEYS_SECRET` to a long random
   string so workspaces can connect their keys. No provider key is set here.
4. In Supabase Auth, enable the email provider; magic links and codes are on by default. The
   app sends a six-digit code and the person types it in; the link in the same mail works
   too and comes back to `/app/`. Add the deployment's `https://<host>/app/` to the Auth
   redirect allow-list.
5. Redeploy. `GET /api/health` should say `store: "postgres", auth: "supabase", tenancy:
   "workspaces", keys: true`. A new sign-up is in no workspace, so the app asks them to make
   one; they become its admin, its first project runs the demo model, and they connect the
   workspace's key in Settings, Workspace, when real sessions should run.

Locally the same works with `HENOSIS_AUTH=supabase SUPABASE_URL=… SUPABASE_ANON_KEY=… pnpm
serve` (and `--store postgres`), which is `henosis serve` with the supabase identity mode.
That server is `shared` by default, so a new sign-up is placed by `HENOSIS_AUTO_JOIN`; add
`HENOSIS_TENANCY=workspaces` for the hosted behaviour.

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
`sub`, the name `user_metadata.full_name`, then `.name`, then the email. On a server of
workspaces a person the server does not know is placed nowhere: they make a workspace or
open an invitation. On a `shared` server such a person is given the memberships
`HENOSIS_AUTO_JOIN` names (reusing `mergeSsoUser`), so a new sign-up lands in a working team
with a demo project; a person users.json knows keeps what the file says.

## Known limits (a demo-grade deployment)

- **One instance per live session.** A `HenosisServer` folds every log in memory and writes
  through to Postgres; that is sound when one process owns the store. Vercel pins a
  websocket to the instance that upgraded it, but a second instance (a cold start beside a
  busy one, another region) folds from Postgres independently and the two do not see each
  other's live events; writes from both reach the database, so a reload shows the union.
  What several instances do share is the documents: orgs, users, agents, invitations and the
  sealed keys are read again from the database before every write, on a websocket join or
  subscription, and on the reads a person makes right after making or joining a workspace
  (`MirrorStore.refreshDocs`; other reads answer from a copy at most two seconds old). So a
  workspace made on one instance, a person who joined on another and a key connected on a
  third are seen by all of them without a restart. Session logs are not shared that way: a
  log is still owned by the instance that folds it, and no lease stops two instances from
  folding the same one. The production shape is one long-lived `henosis serve --store
  postgres` process; the Vercel function is fine for a small team and for demos.
- **Blobs are ephemeral.** Blobs, the usage days file and saved searches live under
  `HENOSIS_DIR` (`/tmp`), which does not survive an instance; the logs and documents are in
  Postgres. A `blobs` table is the next step (docs/04, "Storage").
- **Function duration.** A session's socket closes when the function's `maxDuration` (300 s)
  runs out; the client re-dials and rejoins from the last event it holds (`sinceSeq`), as it
  does on any drop. Long agent turns keep running only while something keeps the instance
  alive.
- **Cold starts.** The first request after an idle period loads every log from Postgres
  (`MirrorStore.open`); the function answers once that is done.
- **Magic links.** The link in the email returns to `/app/` with the session in the URL
  fragment, which supabase-js reads before the router does; the code is the primary path
  because the link opens in whatever browser the mail client picks.

## Proving the deployment

Every CI run proves the hosted deployment is wired front to back (`.github/workflows/ci.yml`,
job `live`, after the `browser` job; `HENOSIS_LIVE_URL` names the deployment):

- `scripts/live-check.mjs` (Node, `ws` only) checks `GET /api/health` reports `ok`, `store`
  and `auth`; `GET /api/auth` says `supabase` with a project `url` and `anonKey` (or `dev`
  with `tokenRequired`, for a local pair); `GET /app/` is the app shell with its scripts
  under `/app/assets/`; `GET /` is the landing page with its hero sentence; and a websocket
  `join` on `/ws` with no token is answered with the `unauthorized…` error the web client
  treats as final, which proves the rewrite, the function and the websocket upgrade in one
  go. One line per check; any failure exits non-zero with a `FAIL` line.
- `apps/web/test/live.spec.ts` (`pnpm --filter @henosis/web run smoke:live`, config
  `apps/web/playwright.live.config.ts`, no local servers) loads `/app/` in Chromium, waits
  for the sign-in card the backend's `/api/auth` asks for (the email field and "Send a
  code"; the dev form for a local pair), asserts the console logged no errors while the app
  loaded, and loads `/` for the hero sentence. Without `HENOSIS_LIVE_URL` the spec skips
  itself, and the ordinary smoke config ignores it.

Both run against a local pair too: `henosis serve` on one port and `out/` (built with
`HENOSIS_BASE=/app/ bash scripts/vercel-build.sh`) served with `vercel.json`'s rewrites in
front of it, then `HENOSIS_LIVE_URL=http://127.0.0.1:<port>`.
