# Identity for Henosis: SSO, SCIM, device trust, passkeys, per-event signatures

*2 October 2026. Vendor and standards domains are blocked by the egress proxy; claims from search snippets alone are marked UNVERIFIED.*

## Why it matters for Henosis

Henosis's whole pitch is that authority is explicit: observer < contributor < driver < owner, approvals bound to the hash of the exact call, quorum for irreversible tools, a lead's directive above owner rank. Every one of those guarantees is only as strong as the answer to "who is this actor?" Today that answer is a shared websocket token plus a client-asserted `userId` looked up in `users.json` (`packages/server/src/server.ts`, `packages/server/src/orgs.ts`, `packages/fleet/src/identity.ts`). Anyone with the token can claim to be the lead; the hash chain proves the log was not rewritten, not *who* appended an approval. `docs/07_security_and_compliance.md` names the phase-1 fix (OIDC/SAML, per-participant signatures, server-assigned actor ids). This memo says how, under the constraint that the Tauri shell and the web client share one auth story and mobile inherits it.

Three questions are specific to Henosis:

1. **Role derivation.** Session roles are computed from org/team/project memberships (`deriveSessionRole`). Those memberships must come from the customer's directory, not a hand-edited file, and a change must reach a running session.
2. **Non-repudiable approvals.** "Two people approving two different realities cannot happen because the thing approved is the hash" is a strong claim; it needs a signature from the approver, not a server note that someone with the token voted.
3. **Device, not just person.** An approval of an irreversible deploy from an unmanaged laptop with a stolen cookie is exactly the threat teams buy device trust for.

## Prior art

1. **Linear members and roles / SCIM** (https://linear.app/docs/members-roles, https://linear.app/docs/scim, accessed 2026-10-02, UNVERIFIED via snippet). Workspace roles are Owner, Admin, Member, Guest; Guests see only the teams they are invited to. SCIM provisions everyone as Member by default; IdP push groups named `linear-owners`, `linear-admins`, `linear-guests` set workspace role, and while that link is active roles cannot be edited by hand. Those groups deliberately do *not* create or sync teams. Lesson: one authoritative source per attribute, and the product refuses manual edits while the IdP owns the field.
2. **Figma admins and permission layers** (https://help.figma.com/hc/en-us/articles/4420557724439-Admins-in-Figma, accessed 2026-10-02, UNVERIFIED). Four admin kinds (organization, workspace, team, plus file owners). Permissions resolve across organization, team, project and file, and explicit permission beats inherited: edit on the team but view-only on a project yields view. SCIM requires SAML first; Enterprise sets seat type via SCIM. Lesson: a precedence rule for inherited vs explicit grants, stated once.
3. **Slack role types** (https://slack.com/help/articles/201912948, accessed 2026-10-02, UNVERIFIED). Org Primary Owner (single, can transfer ownership), Org Owners, Org Admins, then Workspace Owners/Admins, Members, Guests (single- and multi-channel), and Channel Managers scoped to a channel. SCIM on Grid creates and deletes IdP groups and syncs membership; Audit Logs API is org-admin only. Lesson: a *single* transferable primary-owner token, and channel-scoped managers, which map almost one-to-one onto Henosis's driver seat and project lead.
4. **RFC 8252, OAuth 2.0 for Native Apps** (https://datatracker.ietf.org/doc/html/rfc8252, accessed 2026-10-02; content known, page blocked). Native apps must use the system browser, never an embedded webview, must use PKCE, and may redirect to a loopback interface (`http://127.0.0.1:<any port>`) or a private-use scheme. Tauri practice matches: system browser, one-shot loopback listener, tokens in the OS keychain (https://dev.to/datner/tauri-oauth2-5f1h, https://developer.nylas.com/docs/cookbook/use-cases/build/desktop-oauth/, accessed 2026-10-02).
5. **SCIM 2.0** (RFC 7643/7644, accessed via https://clerk.com/articles/scim-2-0-explained-a-practical-guide-for-saas-auth-4.md and https://ssojet.com/blog/scim-provisioning-saas, 2026-10-02). `/Users` and `/Groups` with GET/POST/PUT/PATCH/DELETE; deprovisioning is a PATCH `active:false`, almost never DELETE, and it must revoke sessions immediately; role mapping is either group-to-role or a custom attribute, chosen once because remapping live customers is painful.
6. **Device Bound Session Credentials** (https://blog.google/security/protecting-cookies-with-device-bound-session-credentials/, https://www.helpnetsecurity.com/2026/04/10/google-chrome-device-bound-session-credentials, accessed 2026-10-02, UNVERIFIED). Chrome 146 ships DBSC on Windows, macOS to follow; the browser holds a TPM/Secure Enclave key and the server issues short-lived cookies only after a proof of possession, so exfiltrated cookies die fast. A W3C WebAppSec work item with Microsoft.
7. **Passkeys: BE/BS flags and enterprise attestation** (https://pages.nist.gov/800-63-4/sp800-63b/syncable, https://fidoalliance.org/white-paper-high-assurance-enterprise-fido-authentication/, accessed 2026-10-02). The Backup Eligible flag is fixed for the credential's life and lets a verifier distinguish device-bound from synced passkeys; NIST says verifiers MAY restrict syncable authenticators, and enterprise attestation can identify the authenticator model.
8. **Sigstore gitsign** (https://docs.sigstore.dev/cosign/signing/gitsign, accessed 2026-10-02). Keyless signing: OIDC login, Fulcio issues a minutes-long certificate binding identity to an ephemeral key, Rekor records the signature so it verifies after expiry. The model Henosis wants for events: identity from the IdP, no long-lived user keys to manage.

## What to borrow

- **Linear's IdP-owned fields.** When SCIM is connected, `users.json`-style manual edits are refused; the UI shows "managed by Okta" instead of a dropdown.
- **Figma's precedence rule.** Explicit project grant beats inherited team or org grant. `deriveProjectRole` already checks project, then team, then org; make the order a documented invariant and test it.
- **Slack's single primary owner and channel manager.** Henosis's driver seat is already a single transferable token; the project lead is a channel manager. Keep the vocabulary small.
- **RFC 8252 shape for the desktop shell.** System browser, PKCE, loopback redirect, keychain storage. Web uses the same authorization server with a normal redirect.
- **SCIM `active:false` as a kernel event.** Deprovisioning must evict the actor from live sessions, drop them from quorum counts and release their claims.
- **Sigstore's keyless signing for events.** Per-event signatures without asking engineers to manage keys.
- **DBSC and BE flag as a risk-class input.** Not "device trust" as a login gate, but as a condition on who may approve `irreversible`.

## What is unsolved

- **Signing from the web client.** A keyless, Fulcio-style flow needs a key per login that the browser can hold. WebCrypto non-extractable keys work per origin but die with the tab; DBSC keys are not exposed to JavaScript. Realistic phase-1: the server signs on the user's behalf after verifying a fresh ID token, and the desktop shell signs locally with a keychain key. Mixed-assurance logs need a visible marker.
- **Lead rank with no customer directory concept of "lead".** IdPs have groups, not team leads. Henosis needs a group naming convention (Linear's `linear-admins` trick) or a SCIM custom attribute, and it has to pick one before the first enterprise customer.
- **Quorum under deprovisioning.** If one of two approvers is deactivated mid-vote, is the approval void? The approvals module binds votes to a hash but not to a membership epoch.
- **Agent identity.** Agents are actors too. Whether an agent carries a workload identity (SPIFFE-style) or acts under the session owner's delegated token changes audit meaning; nothing in prior art settles it for long-running agents.
- **Mobile.** Approvals on the go are the likeliest mobile action, and a synced passkey on a phone fails a "device-bound only" policy. Needs a policy knob, not a hard rule.

## Concrete recommendations for Henosis

1. **Introduce `packages/identity`** with an OIDC relying-party (Authorization Code + PKCE, discovery, JWKS caching) and a SAML bridge via the IdP's OIDC facade where possible. `henosis serve --auth oidc --issuer <url>` replaces `--token`. Server assigns `actorId` from `sub` + issuer; the client's `userId` field in `packages/protocol/src/index.ts` `Hello` becomes advisory and is dropped in phase 2.
2. **Desktop login per RFC 8252** in the Tauri shell: open system browser, loopback listener on an ephemeral port, exchange code in the Rust side, store refresh token in the OS keychain (`tauri-plugin-stronghold` or keyring), never in the webview. Register `henosis://` only as a fallback for IdPs that reject loopback.
3. **SCIM 2.0 server in `packages/server/src/scim.ts`**: `/Users`, `/Groups`, PATCH, `active:false`. Groups map to memberships by convention: `fold-org-admins`, `fold-team-<id>-leads`, `fold-project-<id>-members`. `OrgRegistry` becomes a live store; a membership change emits `membership.changed` and the project host recomputes `deriveSessionRole` for connected participants and journals `role.changed` with `by: "scim"`. Deactivation emits `participant.left`, releases fleet claims and withdraws pending votes.
4. **Per-event signatures in `packages/kernel/src/log.ts`**: add an optional `sig` envelope `{keyId, alg, signature, assurance: "server" | "device"}` over the entry id. Desktop signs with an Ed25519 key held in the keychain, registered once via a `key.registered` event bound to the OIDC session; web entries are server-signed after ID-token verification. `henosis verify` checks signatures and prints assurance per branch.
5. **Device posture as an approval input**: extend `ApprovalRule` in `packages/protocol` with `requires: { deviceBound?: boolean; managed?: boolean }`. Desktop reports a keychain-backed key (device-bound by construction); web reports the WebAuthn BE flag from the passkey used at login and, when available, DBSC status as read from the session. Default policy: `irreversible` requires two owners/drivers of whom at least one is device-bound.
6. **Passkeys as first-party login** for teams without an IdP (RP in `packages/identity`); store BE/BS flags and attestation format per credential and show "synced" vs "this device" quietly in the account sheet.
7. **Lock manual edits when IdP owns a field**: if SCIM is connected, `users.json` edits and in-app role changes for org and team roles return a refusal the UI renders as a single-line notice, "Roles are managed in Okta," in the same register as a claim denial.
8. **Document the precedence rule** in `docs/13_fleet_collaboration.md`: explicit project grant > team > org, session owner > derived role only for the starter, lead directive > owner. Add a table-driven test in `packages/fleet/test`.

## Sources

- https://linear.app/docs/members-roles (2026-10-02, UNVERIFIED)
- https://linear.app/docs/scim (2026-10-02, UNVERIFIED)
- https://help.figma.com/hc/en-us/articles/4420557724439-Admins-in-Figma (2026-10-02, UNVERIFIED)
- https://slack.com/help/articles/201912948 (2026-10-02, UNVERIFIED)
- https://datatracker.ietf.org/doc/html/rfc8252 (2026-10-02, blocked)
- https://dev.to/datner/tauri-oauth2-5f1h (2026-10-02)
- https://developer.nylas.com/docs/cookbook/use-cases/build/desktop-oauth/ (2026-10-02)
- https://clerk.com/articles/scim-2-0-explained-a-practical-guide-for-saas-auth-4.md (2026-10-02)
- https://ssojet.com/blog/scim-provisioning-saas (2026-10-02)
- https://blog.google/security/protecting-cookies-with-device-bound-session-credentials/ (2026-10-02, UNVERIFIED)
- https://www.helpnetsecurity.com/2026/04/10/google-chrome-device-bound-session-credentials (2026-10-02)
- https://pages.nist.gov/800-63-4/sp800-63b/syncable (2026-10-02)
- https://fidoalliance.org/white-paper-high-assurance-enterprise-fido-authentication/ (2026-10-02)
- https://docs.sigstore.dev/cosign/signing/gitsign (2026-10-02)
- https://www.okta.com/blog/product-innovation/zero-trust-device-posture-sensor-mode/ (2026-10-02)
