# Security, authority and compliance notes

## What the kernel guarantees

- **Attribution.** Every directive, vote, resolution, handoff and role change is an event
  signed by its actor id and chained by hash. "Who told the agent to do that" is a lookup.
- **Authorisation before the model.** Observers cannot steer; resume and cancel need the
  driver or an owner; merges and contention resolutions need the driver or an owner; roles
  are granted only by owners (drivers may grant up to driver). The checks live in one place,
  `Session`, and the reducer independently shadows under-ranked directives on replay.
- **Approvals bound to content.** An approval id is derived from the hash of the exact tool
  call; votes reference that id. Only humans vote; a deny by any eligible voter wins.
  Quorum rules require distinct voters at or above a role; a release gate adds ratings.
- **Replayable audit.** `henosis verify` checks every branch's chain and that replay from a
  snapshot equals full replay. `henosis report` renders the full who-did-what table.

## Identity

Who an actor is decides every rank check above, so the server answers it in one place,
`packages/server/src/auth.ts`, in one of three modes picked by configuration. `GET /api/auth`
tells a client which mode it is in and, under single sign-on, where to send the person.

**Modes.**

- `dev` (Starter, the default): an optional shared token (`--token` or `HENOSIS_TOKEN`) that
  every websocket `join` must carry, and a client-asserted user id that `users.json` may or
  may not know. Nothing is proven; a person the file does not know is first-in-owns in a
  session and sees every project. This is what the tests, the demo and `pnpm e2e` run.
- `oidc` (Team edition): `HENOSIS_OIDC_ISSUER` and `HENOSIS_OIDC_CLIENT_ID` (optionally
  `HENOSIS_OIDC_AUDIENCE`) name the organisation's OpenID Connect provider. The web app runs
  the authorization code flow with PKCE in the browser (`apps/web/src/auth.ts`): the person
  leaves for the provider, comes back with a code, and the browser exchanges it for an ID
  token directly with the provider; the Henosis server never sees the code or a client
  secret (there is none; the client is public). The ID token rides on every websocket
  `join`, `project.subscribe` and `chat.subscribe` (a `token` field, or the socket's
  `Authorization` header / `?token=`) and on every HTTP request as `Authorization: Bearer`.
  The server verifies it with `jose` against the provider's discovery document and JWKS:
  signature, issuer, audience (the client id unless `HENOSIS_OIDC_AUDIENCE` says otherwise)
  and expiry. The token is kept in memory and sessionStorage, never localStorage; a minute
  before it expires the app refreshes it through the provider when a refresh token was
  issued, otherwise the person signs in again and lands where they were.
- `supabase` (the hosted deployment, `20_hosting.md`): `HENOSIS_AUTH=supabase` with
  `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Supabase Auth signs the person in with an emailed
  one-time code (or the magic link in the same mail) through supabase-js in the browser; the
  access token it issues rides on every `join` and request as the ID token does under oidc,
  and the server verifies it with `jose` against the project's JWKS (`<url>/auth/v1/
  .well-known/jwks.json`, ES256; issuer `<url>/auth/v1`, audience `authenticated`), or
  against `SUPABASE_JWT_SECRET` for a project still signing HS256. The user id is `sub`, the
  name `user_metadata.full_name`, then `name`, then the email. On a server of workspaces
  (the hosted default, "Tenancy and model keys" below) a person the server does not know is
  placed nowhere: they make a workspace or open an invitation. On a `shared` server such a
  person is placed by `HENOSIS_AUTO_JOIN` (`org:team:project:role`, default
  `default:default:default:contributor`; the org, team and project are created on first
  use), so a new sign-up lands in a working team.

**Claims.** The user id is the token's `sub` (stable, opaque) or, when `orgs.json` sets
`sso.userIdClaim: "email"`, its `email` (readable, but a provider may let it change). The
display name is `name`, then `preferred_username`, then `email`; `users.json` wins for a
person it knows. In oidc mode a user id the client asserts beside the token (`userId`,
`actor.id`, `?user=`) must equal the token's, or the request is refused with
`unauthorized: the user id does not match the token`; an assertion without a token is
refused too; a request with neither is anonymous and reaches only public reads. The actor
recorded in the session log is the verified id, by the server's hand.

**Mapping.** Membership comes from the directory's groups through an `sso` block in
`orgs.json`, merged with `users.json`:

```json
{
  "sso": {
    "name": "Okta",
    "groupsClaim": "groups",
    "orgs": { "acme-everyone": "northwind", "acme-admins": { "orgId": "northwind", "role": "admin" } },
    "teams": { "acme-payments": "payments", "acme-payments-leads": { "teamId": "payments", "role": "lead" } },
    "projects": { "acme-onboarding": "onboarding" }
  },
  "orgs": [ ... ]
}
```

A plain id grants `member`; the object form carries a role (`admin` for an org, `lead` or
`manager` for a team, a project role for a project). Where the file and the directory name
the same org, team or project, `users.json` wins, so a lead can still raise someone by hand.
A person neither names is an observer everywhere until a lead adds them (`/api/me` lists no
projects for them, and the sign-in step says so). The merged user is recomputed on every
verified request and never written to disk, so a group change reaches the next join;
session roles then derive exactly as in dev mode (`deriveSessionRole` in
`packages/fleet/src/identity.ts`). Lead rank has no directory counterpart, which is why the
mapping carries roles: the convention is the customer's (`<org>-<team>-leads`), not ours.

**What SCIM will add** (Enterprise, `docs/research/identity-sso-device-trust.md`). The
mapping above is pull: memberships are read off the token at sign-in. SCIM is push: a
`/Users` and `/Groups` endpoint on the server through which the provider creates, changes
and deactivates people between sign-ins. Deactivation (`active: false`) becomes a kernel
event that evicts the actor from live sessions, releases their claims and withdraws their
votes; a group change recomputes roles for connected participants and journals
`role.changed` with `by: "scim"`; while the provider owns a field, `users.json` edits and
in-app role changes to it are refused ("Roles are managed in Okta"). After that come device
trust as an input to approval rules and per-participant signatures on approvals, so a
release gate is a cryptographic claim and not a server's note.

## Tenancy and model keys

One server holds organisations in one of two ways, set by `HENOSIS_TENANCY`
(`packages/server/src/orgs.ts`). `shared` is the one-company server: identity places people,
and a person placed nowhere still sees the organisation as an observer. It is what `henosis
serve` runs unless told otherwise. `workspaces` is the hosted service, and the default for
the hosted function under `HENOSIS_AUTH=supabase`: each company makes its own workspace (an
org), invites its people, and nothing of a workspace is visible to anyone outside it.

**Isolation on a server of workspaces.** Membership decides everything a person can see.

- Every route except `/api/auth` and `/api/health` needs a signed-in person; without one the
  answer is 401. Under Supabase or OIDC sign-in the person a request acts as is the one the
  verified token names, never one the client asserts beside it. A dev-mode server set to
  `workspaces` still takes the client's word for who it is; that pairing is for tests.
- A route that names an org, a team, a project or a session is answered only to members of
  the workspace it belongs to. Anyone else gets 404, the same answer as for a thing that was
  never there, so a workspace's existence is not disclosed.
- A websocket `join`, `project.subscribe` and `chat.subscribe` check membership the same way.
- A session is opened by its id. A session id that already lives in another project is
  refused, so one workspace cannot open another's session by learning its id.
- `/api/health` is open to anyone and lists no sessions and no projects.
- Usage and search read one workspace: the person's own. A council convenes only the member
  models of the workspace's own people and its own shared agents. A device subscribes to
  push only for the person signed in on it.
- `HENOSIS_AUTO_JOIN` places nobody. A person is in a workspace because they made it or
  accepted an invitation to it. One person can make five.

**Roles.** A workspace has admins and members. An admin manages the members, the
invitations, the model key, the teams and the projects; a member sees the people, the
projects and what the workspace runs on, and can leave. The person who
makes a workspace is its admin, and a workspace keeps at least one: the last admin cannot be
removed or made a member.

**Invitations.** An admin makes a link (`#/join/<token>`). The token is 24 random bytes, is
answered once, to the admin who made it, and is stored only as its SHA-256 hash; no route
shows the token or the hash again. A link works for 14 days. Addressed to an email, it is
accepted once and only by a person whose verified token carries that address. Left open, it
admits anyone who holds it until it expires or an admin withdraws it. An admin sees every
invitation of the workspace with its state (open, used, expired, withdrawn).

**The model key's lifecycle.** The hosted service has no provider key of its own and reads
none from the environment (`envKey: false` in `api/server.ts`). Each workspace brings its
own (`packages/server/src/keys.ts`, `models.ts`, `workspaceApi.ts`).

1. *Connect.* An admin pastes the workspace's Anthropic API key in Settings, Workspace. A
   member who tries is answered 403; a person outside the workspace, 404. The server checks
   the key with Anthropic by listing models with it, which spends no tokens. A key Anthropic
   refuses is not stored.
2. *Seal.* The key is encrypted with AES-256-GCM under a key derived with HKDF-SHA256 from
   `HENOSIS_KEYS_SECRET` and the workspace id, with a fresh random nonce each time. The
   workspace id and the provider are bound in as associated data, so a sealed key copied
   into another workspace's place does not open.
3. *Store.* The `keys` document of the store holds, per workspace: the nonce, the
   authentication tag and the ciphertext; the key's last four characters; who connected it
   and when; the workspace's default model; whether the provider last accepted it and when
   that was checked. Nothing else of the key is kept, and nothing in the clear.
4. *Use.* From the next turn the workspace's session agents and its council's member models
   run on the key. The server opens it in memory when a turn needs it and sends it to
   Anthropic and nowhere else. No route answers it again: the API shows the last four
   characters, who connected it and when. The session log records the model's name and the
   tokens it used, not the key.
5. *Refusal.* When Anthropic turns the key down in the middle of a turn, the server remembers
   it, Settings shows "Refused by Anthropic", and the turn ends with a sentence telling the
   team an admin can replace the key. An admin can check it again at any time.
6. *Replace and disconnect.* Replacing seals the new key over the old one. Disconnecting
   deletes the sealed key from the document and returns the workspace to the scripted demo
   model, which is also what a workspace without a key runs.
7. *Rotation.* Changing `HENOSIS_KEYS_SECRET` makes every sealed key unopenable; each
   workspace then connects its key again. This is the response to a leaked secret, together
   with each key's owner revoking it at Anthropic.

Usage is billed by Anthropic to the key's owner. `HENOSIS_OFFLINE=1` blocks every provider
call, a workspace's key included; the key is kept and not called.

**The secret.** `HENOSIS_KEYS_SECRET` (16 characters or more) lives in the server's
environment, not in the store. Without it the server keeps no keys and Settings says so.
`henosis serve` on a folder store, with the variable unset, keeps a random secret beside the
store in `keys.secret` (mode 600); that suits one machine, and it means a copy of the whole
folder carries both the sealed keys and the secret.

**What is logged.** The server's log says who connected a key and for which workspace, who
disconnected one, who made a workspace, and that the provider refused a workspace's key. It
never carries the key, its last four characters or the sealed bytes.

**What this does not do.** The server holds the secret and opens keys in its own memory, so
a person who controls the running server, or who has both the database and the secret, can
read them. A workspace's key is one credential that all of its agents use: any member who
can steer an agent spends on it, and budgets are soft. Per-participant credentials and a
broker that keeps secrets out of the server's process are phase 1.

## What phase 0 does not do

- **Authentication.** Dev mode is a shared token and client-asserted identity; Team edition
  verifies OIDC ID tokens (see "Identity" above). Still to come: SAML through the provider's
  OIDC facade, per-participant signatures on events, a device-flow sign-in for the CLI.
- **Tool sandboxing.** `shell.run` is allow-listed and runs in a scratch copy with a timeout,
  but in the server's process and user. Phase 1: per-session container.
- **Secrets.** One is handled: the model key a workspace connects, sealed as described
  above. Tool credentials are not. Phase 1: credentials never enter the model context;
  tools resolve them server-side per participant, so a follow-up by Bo cannot run under
  Ana's tokens (the Cursor Team Followups problem).
- **Encryption at rest and transport.** Apart from the sealed model keys, Henosis encrypts
  nothing itself: local disk and plain websockets, or whatever the database and the host in
  front of the server provide.

## Regulatory fit

- **EU AI Act, Articles 12 and 14.** Article 12 asks for logging built into the system;
  Article 14 asks for natural persons who can monitor, interpret and override. Henosis's log
  records, per effectful action, who requested it, who approved it, under which policy, and
  what happened: the per-action evidence oversight guidance asks for.
- **NIST AI RMF agentic profile.** Every agent action tied to an identified, accountable
  principal; autonomy tiers map to the risk classes and approval policy.
- **SOC 2.** Immutable logs, named ownership and evidence trails are the controls auditors
  ask about; the hash chain and report are the evidence.

## Threat notes specific to multiplayer

- A low-rank participant cannot override a higher one (shadowing), and a peer cannot
  silently override a peer within an epoch (contention). Social engineering must happen in
  the open, in the log.
- A merge cannot smuggle a steer past the target branch: carried steers on contested scopes
  re-enter arbitration as contentions.
- A disconnected driver does not stall the team: owners can reassign the driver token;
  the brief lets the newcomer act with full context.

See `09_threat_model.md` for the attack-oriented treatment.

## Desktop update signing

The desktop shell accepts only updates signed by the minisign key whose public half is in
`apps/desktop/src-tauri/tauri.conf.json`; the private key and the Apple and Azure signing
material live on the GitHub `release` environment behind required reviewers, and the shell
never relaunches without the person's click. Key generation, rotation and the compromise
response are in `16_desktop_release.md`.
