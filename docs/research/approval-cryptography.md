# Approval cryptography: binding approvals to actions in Henosis

Research memo, 2026-10-02. Items marked UNVERIFIED rest on search snippets; the primary page was blocked by the egress proxy.

## Why it matters for Henosis

Henosis already has the right shape: a tool call carries a risk class, a policy maps it to a rule (`none`, one role, or `{quorum, of}`), only humans vote, any eligible deny denies, and the approval id is derived from the exact call (`packages/kernel/src/session.ts`, `requestApproval`: `shortId("apr", branch, seq+1, call)`; `packages/kernel/src/approvals.ts`, `evaluate`). The threat model (`docs/09_threat_model.md`) is honest about the gap: identity is client-asserted, so "two distinct drivers" is two distinct strings, and a stolen shared token can cast both. `docs/07_security_and_compliance.md` promises per-participant signatures in phase 1, and `docs/11_open_questions.md` item 7 leaves approval validity across forks open.

For an irreversible action (`git push --force`, `DROP TABLE`, a payment) the quorum is the product's safety claim. It needs to be a cryptographic claim: each vote must be a signature by a distinct human-held key over the exact action, verifiable offline from the log by `henosis verify`, with a bounded lifetime, and with a defined answer for "this approval exists on `main`, the branch reached the same call".

## Prior art

1. **EP-QUORUM, draft-schrock-ep-quorum-03** (IETF Internet-Draft, 19 July 2026). https://datatracker.ietf.org/doc/draft-schrock-ep-quorum/ (accessed 2026-10-02; page blocked, snippet only, UNVERIFIED). A multi-party profile over an "authorization receipt": each quorum member is an unmodified single-approver signoff over the same action hash, so a single approver is the degenerate 1-of-1 case. The predicate is fail-closed and enumerated: all signatures valid, each bound to the exact action, approvers pairwise distinct, each admitted by role, threshold met, declared order respected, all signatures within a bounded time window. It specifies incremental server-side admission (reject a non-conforming signer before it joins the trail) and cross-language conformance vectors that JS, Python and Go verifiers must agree on.
2. **WebAuthn used for signing** (Yubico developer concepts; W3C webauthn list thread on a `sign` extension). https://developers.yubico.com/WebAuthn/Concepts/Using_WebAuthn_for_Signing.html and https://lists.w3.org/Archives/Public/public-webauthn/2024May/0127.html (accessed 2026-10-02; Yubico page blocked, UNVERIFIED). An authenticator never signs an arbitrary hash; it signs `authenticatorData || SHA-256(clientDataJSON)`, and intent enters only through the `challenge` inside `clientDataJSON`. The practical pattern: canonicalize the intent (JCS), use those bytes or their hash as the challenge, verify origin and rpId on the server. The proposed `sign`/previewSign extension would add a separate key that signs arbitrary data; it is not shipped. Desktop apps go through platform APIs (Apple AuthenticationServices, Windows Hello), not `navigator.credentials`.
3. **Teleport Dual Authorization and Access Requests.** https://goteleport.com/docs/ver/17.x/zero-trust-access/access-controls/guides/dual-authz/ (accessed 2026-10-02; blocked, UNVERIFIED). Roles declare `review_requests` with approve/deny thresholds; a request is a backend resource with a TTL; reviews are recorded in the audit log; two reviewers satisfy FedRAMP AC-3 dual authorization. Plugins relay the request to chat and link back; the auth service, not the chat, counts.
4. **HashiCorp Vault control groups.** https://developer.hashicorp.com/vault/tutorials/enterprise/control-groups (accessed 2026-10-02; blocked, UNVERIFIED). An ACL path declares a `control_group` with factors `{group_names, approvals}`; the request returns a wrapped response plus an accessor, and nothing is released until authorizers hit `sys/control-group/authorize`. Mixed-group rules ("one DBA and one from security") are composed by stacking factors.
5. **TwoKeys** (All Things Agentic hackathon) and **SLB, Simultaneous Launch Button**. https://devpost.com/software/twokeys and https://smithery.ai/skills/dicklesworthstone/slb (accessed 2026-10-02). TwoKeys: "if the proposal changes, consent resets; permission exists once, for that exact version, then spends itself." SLB: a Go CLI for two-person approval of destructive agent commands where the daemon is "a notary, not an executor", and the command runs in the requester's own shell.
6. **DSSE envelope and in-toto threshold layouts.** https://in-toto.readthedocs.io/en/latest/model.html (accessed 2026-10-02). A DSSE envelope is a payload plus N signatures over the pre-authentication encoding of (type, payload); layouts are signed by several keys to a threshold. This is the mature multi-signature container for one canonical payload.
7. **UCAN delegation and invocation.** https://github.com/ucan-wg/invocation (accessed 2026-10-02). Capabilities as (subject, command, policy) with `iss`, `aud`, `nonce`, `exp`, `nbf`; a token without `exp` is invalid by definition; the nonce guarantees uniqueness but is explicitly not replay prevention, which belongs to the verifier's window.

## What to borrow

- **The signoff is the unit; quorum is a set of identical-payload signoffs** (EP-QUORUM, DSSE). Henosis's vote event already carries `approvalId`; make the payload a signature over the same bytes every voter sees.
- **The predicate as a checklist, fail-closed** (EP-QUORUM). `evaluate` should return `pending` for anything it cannot positively verify, never `granted` by default.
- **Distinctness by key, not by name** (EP-QUORUM, Teleport). "Two drivers" means two distinct credential ids bound to two distinct server-issued actor ids.
- **Consent spends itself; a changed proposal resets consent** (TwoKeys). Henosis does this with the hash; add single-use and expiry.
- **Challenge = action digest** (WebAuthn). The passkey assertion's challenge is the approval digest; the server verifies `clientDataJSON.challenge`, `origin` and `rpIdHash`.
- **Notary, not executor** (SLB, Vault). The server verifies and records; the runner executes only against a `granted` record whose bundle verifies.
- **Explicit `exp`, `nbf`, nonce** (UCAN, EP-QUORUM time window).

## What is unsolved

- **What you see is what you sign.** No passkey platform shows the signed payload; the OS dialog says "Sign in to Henosis". The human reads the call in Henosis's UI and trusts the client to feed the same digest into the challenge. A compromised web client can present `rm -rf build/` and sign `rm -rf /`. Mitigation is a server-rendered summary hashed into the digest plus the audit trail; a real fix needs the unshipped `sign` extension or hardware with a display.
- **Desktop passkeys in Tauri.** There is no first-party Tauri WebAuthn plugin; the WebView's `navigator.credentials` works on macOS WebKit and WebView2 for `https` origins, but the rpId must be a real domain, which a `tauri://` origin is not. Needs testing per platform (UNVERIFIED).
- **Approval under fork.** Open question 7. Hash equality of the call is not enough: the same `rm -rf build/` on a branch whose tree differs is a different act.
- **Clock skew and liveness.** A time window needs a trusted clock; the log has sequence numbers, not time. Expiry in log terms (seq or checkpoint distance) is replayable; wall-clock expiry is not.
- **Key loss and recovery.** Passkeys sync via platform accounts; an org must decide whether a synced passkey counts as "the human" for a two-person rule.

## Concrete recommendations for Henosis

1. **Define the approval digest** in `packages/kernel/src/hash.ts` as `approvalDigest = sha256(canonicalJson({v:1, sessionId, branch, baseTree, policyHash, call, nonce, exp}))` where `baseTree` is the workspace manifest hash at request time and `policyHash` the hash of the approval policy in force. `requestApproval` in `packages/kernel/src/session.ts` emits this digest and the fields in `approval.requested`; the digest is the approval id (drop the `seq`-derived short id or keep it as a display alias).
2. **Signed vote event** in `packages/protocol/src/index.ts`: extend `approval.voted` with `signoff: { digest, vote, actorId, credentialId, alg: "webauthn-es256" | "ed25519", signature, clientDataJSON?, authenticatorData?, signedAt }`. For WebAuthn the server verifies `challenge == base64url(sha256(digest || vote))`, `origin`, `rpIdHash`, and the counter; for ed25519 (CLI, device-bound fallback key) it verifies over the DSSE PAE of the same bytes.
3. **Fail-closed predicate** in `packages/kernel/src/approvals.ts`: `evaluate` takes verified signoffs and checks, in order, digest equality, signature validity, distinct `credentialId` and distinct `actorId`, rank at vote time, `exp` not passed (in log terms: `seq <= requestedSeq + policy.approvalWindowEvents`), threshold. Any failure keeps `pending`; a valid deny gives `denied`. Record the verdict as an `approval.granted` event carrying the full signoff bundle so `henosis verify` re-verifies signatures offline, EP-QUORUM style, and add conformance vectors under `packages/kernel/test/approval-vectors.json`.
4. **Single use and fork rule.** A granted digest is consumed by exactly one `tool.started`; a second attempt re-requests. Because `branch` and `baseTree` are in the digest, an approval on `main` never verifies on a fork; on merge, `packages/kernel/src/merge.ts` carries over pending requests as new requests (same call, new digest) and lists them in the brief. For `write` and `exec` the policy may set `inheritOnFork: true` to copy the grant when `baseTree` is unchanged; `external` and `irreversible` never inherit.
5. **Passkey ceremony on web and desktop.** `apps/web`: `navigator.credentials.get({ challenge, rpId: "henosis.app", userVerification: "required" })` when the user presses Approve in the quiet notice; the notice shows the call line and the first eight hex of the digest so what is signed is visible in the 760px column. `apps/desktop`: route the same call through the Tauri WebView against the hosted origin, and ship a device-bound ed25519 key in the OS keychain (`tauri-plugin-stronghold` or keychain crate) as the fallback signer with the same signoff schema; `packages/cli` uses the same ed25519 path. Key registration is an `actor.key.added` event signed by the server so the log carries its own verification material.
6. **Server as notary.** `packages/server` verifies signoffs on arrival and refuses to append a malformed vote (incremental admission); `packages/runner` executes a gated call only when the kernel state holds a `granted` record for that exact digest and the runner's own check of the bundle passes. Slack votes (`packages/slack`) remain allowed only for rules at or below `exec`; `external` and `irreversible` require a signoff from a registered key, which the Slack message links to by deep link.

## Sources
All accessed 2026-10-02; pages marked blocked above were read from search snippets only.


- https://datatracker.ietf.org/doc/draft-schrock-ep-quorum/
- https://developers.yubico.com/WebAuthn/Concepts/Using_WebAuthn_for_Signing.html
- https://lists.w3.org/Archives/Public/public-webauthn/2024May/0127.html
- https://goteleport.com/docs/ver/17.x/zero-trust-access/access-controls/guides/dual-authz/
- https://developer.hashicorp.com/vault/tutorials/enterprise/control-groups
- https://devpost.com/software/twokeys
- https://smithery.ai/skills/dicklesworthstone/slb
- https://in-toto.readthedocs.io/en/latest/model.html
- https://github.com/ucan-wg/invocation
- https://arxiv.org/abs/2603.18829
