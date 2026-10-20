# Editions: the same product from two people to a company of thousands

Henosis is one kernel and one product. What changes with the size of the organisation is
where the state lives, who answers "who is this person", how many sessions one process can
hold, and what the people who audit the company need to export. This document names three
editions, what each turns on, and what the repository already does versus what the roadmap
owes. Nothing in the kernel differs between them: a session log written by a startup's
single server folds to the same state in an enterprise's sharded cluster, and `henosis
verify` proves it in both.

## The three editions

| | Starter | Team | Enterprise |
|---|---|---|---|
| Who | A founding team, a lab, one squad | A company with several teams and projects | A company with many orgs, compliance and a platform team |
| Server | One `henosis serve` process, a folder as the store | One process per org, `henosis serve --store postgres` with the same logs in a database (`docs/04_technical_architecture.md`, "Storage"); `henosis migrate` moves a folder in and proves the copy by head hash | Sharded session actors, a database and an object store, a control plane |
| Identity | `users.json`, dev tokens | OIDC single sign-on, roles from the directory (`07_security_and_compliance.md`, "Identity") | SSO (OIDC or SAML), SCIM provisioning, device trust, per-event signatures |
| Policy | Per project, set by its lead | Per team with project overrides | Org policy packs with team and project overrides; approval rules as code |
| Models | The scripted model, one Claude key | Soft budgets per project and session (built); a key per team (owed) | A credential broker, per-participant grants, model routing and spend limits |
| Memory | One org store, the curator on a timer | One store per org, scoped to teams and projects | Tiered storage, retention rules, legal hold |
| Surfaces | Web, CLI, desktop | Web, CLI, desktop, mobile, Slack | All, plus the PR adapter and a harness SDK |
| Evidence | `henosis report`, exports as markdown | Session exports from the app (built); the audit view (owed) | PROV and in-toto exports, SIEM streams, data residency |
| Price | Free, self-hosted | Per active session-hour plus approver seats | Platform fee plus usage; a signed agreement |

## What scales, and how

**State.** A session is a hash-chained log; a project is a ledger; an org has a chat log and a
memory store. Starter keeps each as a JSON file under the store root (`FileStore` in
`packages/server/src/store/`). Team and Enterprise keep the same documents in a database
(`PostgresStore`: one row per event, one table each for events, branches and documents) with
the same reducers folding them; the `Store` interface is the seam
(`docs/04_technical_architecture.md`, "Storage"), and the logs' hash chains make migration
verifiable: `henosis migrate` folds the old file and the new rows and compares the head hash
of every log before it finishes. The research memos on compaction and snapshots
(`docs/research/log-compaction-snapshots.md`) and on fan-out
(`docs/research/realtime-fanout-scaling.md`) are the design for week-long sessions and
thousands of observers.

**Identity.** `users.json` names people, their orgs, teams and projects (`packages/fleet/src/identity.ts`).
Team maps the same shape onto an OIDC provider: the directory's groups become teams, the
token's subject becomes the user id, roles stay in Henosis (`packages/server/src/auth.ts`,
`HENOSIS_OIDC_ISSUER`; the modes, claims and the `sso` mapping in `orgs.json` are in
`07_security_and_compliance.md`, "Identity"). Enterprise adds SCIM so joining
the company joins the circle on day one, device trust for the desktop, and per-participant
signatures on approvals so a release gate is a cryptographic claim
(`docs/research/identity-sso-device-trust.md`, `docs/research/approval-cryptography.md`).

**Policy.** Today a session is created with a policy (plan first, ratings, budgets, approval
rules) derived from its project. Team edition sets the policy per team with project
overrides; Enterprise ships policy packs (which risk classes need which raters, which tools
exist, which paths are protected) that a platform team versions as code, and the kernel's
approval evaluator stays the single enforcement point.

**Models and credentials.** Starter runs one key. Team gives each team a key and each project
a budget, which the usage API already reports. Enterprise puts a credential broker between
the runner and every provider so an agent acts with the authority of the person who steered
it and no secret ever reaches a session (`docs/research/credential-broker.md`), and sandboxes
tools per session (`docs/research/tool-sandboxing.md`).

**Scale of people.** The rail, the manager's view and the inbox are built from the project
ledgers, so a company with a hundred projects reads the same screens; the server's usage and
glance endpoints aggregate on the server, not in the browser. Observers get Merkle
consistency proofs on resume so a thousand viewers cost a few hundred bytes each
(`docs/research/merkle-proofs-observers.md`).

**Evidence.** Every edition has the log. Team adds session exports
(`GET /api/sessions/:id/export.md` and the share sheet, today) and an audit view (who planned,
rated, approved what; owed). Enterprise exports provenance in standard shapes (PROV,
in-toto attestations per commit), streams events to a SIEM, and keeps data in the region the
customer names (`docs/research/compliance-evidence-export.md`,
`docs/research/provenance-standards.md`).

## What the repository does today

Starter, in full: the kernel, fleet, memory, chat, Slack, notifications, the web app, CLI,
desktop and mobile shells, the scripted model for offline work and the Claude adapter, all
tested offline. Team, in part: orgs, teams and projects from `orgs.json`, roles from
`users.json`, OIDC single sign-on with groups mapped to teams (dev tokens stay the
default), `henosis serve --store postgres` and `henosis migrate`, per-project policy on
session creation, soft budgets and the usage API, session exports, the team look. Not yet
in Team: a key per team, policy per team with project overrides, the audit view, the mobile
shell in the stores. Enterprise: the designs and the research are in `docs/research/`; the
roadmap (`docs/06_roadmap.md`) puts per-event signatures, the credential broker and
sandboxing in phase 1, policy packs and hosting on sharded session actors in phase 2, and
the audit exports in phase 3.

## Why one product and not three

The pitch is unity. A startup that grows into a company should not change tools when it
adds its first compliance officer, and a company's platform team should be able to try
Henosis on one squad with one server before it signs anything. The kernel is the same
object in every edition, the logs it writes are portable between them, and the only things
that change are the services around it.
