# Synthesis: desktop-platform

Lead architect synthesis, 2026-10-02, from ten research memos (cited by slug) plus `docs/04_technical_architecture.md` and `docs/06_roadmap.md`.

Framing. Fold is desktop-and-web first, mobile second. `apps/web` is the product; the Tauri shell adds what wakes an engineer during a multi-day session: tray, badge, notifications, deep links, keychain, updater. One principle runs through the memos: the shell is transport, the kernel is authority, and every native surface that could *look* like authority (toast, tray count, deep link, update) must bind back to the hash-chained log.

## Decisions

**1. Stay on Tauri 2; hide it behind a shell adapter.**
Evidence: tauri-vs-electron-2026 (single-digit MB, OS webview; Claude Desktop and Linear keep product logic out of the shell).
Changes: new `apps/web/src/shell/adapter.ts` (`notify`, `setBadge`, `onDeepLink`, `openExternal`, `secretGet/Set`, `isDesktop`) with Tauri and browser implementations; `shell.ts` stops reading `window.__TAURI__`; `withGlobalTauri: false`.
Phase: now.
Risk: three rendering engines; ship the WebKitGTK DMABUF workaround in `main.rs`; the Linux tray is optional.

**2. Close the Phase-0 shell holes before any design partner installs it.**
Evidence: desktop-security-threats (`csp: null`, bearer token in `localStorage`, deep link forwarded unvalidated), identity-sso-device-trust (RFC 8252 keychain storage).
Changes: real CSP in `tauri.conf.json`; single-instance plugin and strict `fold://` parsing in `src-tauri/src/main.rs`; `keyring` behind `secret_get/secret_set` commands in `capabilities/default.json`; `apps/web/src/identity.ts` branches on `isDesktop()`; web moves to an HttpOnly cookie from `packages/server`.
Phase: now.
Risk: small and mechanical; skipping it means the hosted product inherits every hole.

**3. Signed, attested releases with server-side staged rollout and a minimum client version.**
Evidence: auto-update-release-pipeline (Tauri updater has no rollout, rollback or "busy user" notion), desktop-security-threats (the updater is the most direct attack on the approval prompt), tauri-vs-electron-2026 (manifest only TLS-protected).
Changes: `tauri-plugin-updater` in `Cargo.toml`; `bundle.targets: ["app","dmg","nsis","appimage"]`; `.github/workflows/release-desktop.yml` on `tauri-action` with notarytool, Azure Trusted Signing and build provenance; `packages/server/src/releases.ts` serves the manifest, buckets installs against `rollout_percent`, sends `minClientVersion` in hello; `apps/web` relaunches only when the actor holds no driver seat and no open approval. Key policy in `docs/07`, compromised-key adversary in `docs/09`.
Phase: now for signing and the workflow; next quarter for rollout and `minClientVersion`.
Risk: one minisign key, no threshold signing; SmartScreen warnings until reputation accrues.

**4. Notifications are pointers; urgency and audience are computed in the server inbox.**
Evidence: desktop-notifications-tray (Apple passive/active/time-sensitive; GitHub Desktop notifies only the person whose action unblocks; NIST AUT-1 lock-screen leakage), tauri-vs-electron-2026, desktop-security-threats (tray counts are client-supplied strings).
Changes: `packages/server/src/notify.ts` gains `urgency` and writes only eligible voters and named handoff recipients; `set_pending` becomes `set_attention` fed from a server-pushed count, with badge and "Awaiting you · N"; deep link extended to `/a/<approvalId>` in `main.rs` and `App.tsx`; bodies redacted to `<call> [<risk>] in <session>`; quiet hours and escalation budget journaled.
Phase: now.
Risk: Tauri desktop action buttons are unreliable, so the toast is one button; background "Approve" never for quorum classes.

**5. Resume-from-seq, a held prefix and backpressure in the wire protocol.**
Evidence: realtime-fanout-scaling (a join replays the whole branch, 20-50 MB for a week-long session; no reconnect; unbounded buffering), local-first-offline-desktop (`afterSeq` plus head hash is also the offline foundation).
Changes: `join { afterSeq, headId }` and `resync` in `packages/protocol`; `eventsAfter` in `packages/kernel/src/log.ts`; JSONL per branch and periodic snapshots in `packages/server/src/storage.ts`; per-client outbox with `bufferedAmount` high-water marks in `server.ts`; `apps/web/src/client.ts` reconnects with backoff, verifies `prev` before folding, persists the prefix (IndexedDB on web, app-data dir on desktop).
Phase: now.
Risk: a verifying late joiner still wants a Merkle proof, which stays on the roadmap.

**6. Local-first means a durable outbox and an explicit offline policy, not a CRDT.**
Evidence: local-first-offline-desktop (Replicache, Electric's txid handshake, Linear's idempotency hole; a CRDT merge would silently resolve what Fold deliberately surfaces as a contention).
Changes: `clientRef` on client messages, echoed on events and deduped in `packages/server/src/host.ts`; `apps/web/src/outbox.ts` (IndexedDB, `tauri-plugin-sql` on desktop); `packages/kernel/src/offline.ts` with `canQueueOffline`; `stale` directive status in `intent.ts`; `observedHead` and `expiresAfterTurns` in `approvals.ts`; provisional rows in `SessionView.tsx`; partition scenarios in the arbitration property test.
Phase: next quarter.
Risk: the stale-epoch rule has no prior art, since no sync engine has an autonomous actor advancing state while you are away; `approve` on `external`/`irreversible` stays online-only.

**7. Identity: OIDC with PKCE via the system browser, server-assigned actor ids, signed events with a visible assurance level.**
Evidence: identity-sso-device-trust (RFC 8252, Sigstore keyless shape, DBSC and passkey BE flag as approval inputs), credential-broker.
Changes: new `packages/identity` (OIDC and passkey RP); `fold serve --auth oidc`; loopback listener and code exchange in `main.rs`, refresh token in the keychain; optional `sig { keyId, alg, signature, assurance }` on entries in `packages/kernel/src/log.ts` (desktop signs with a keychain key, web entries are server-signed); `ApprovalRule.requires { deviceBound, managed }`; `fold verify` prints assurance. SCIM in `packages/server/src/scim.ts` follows.
Phase: next quarter for OIDC and signatures; later for SCIM.
Risk: mixed-assurance logs need honest UI.

**8. A `packages/sandbox` boundary that is part of what gets approved.**
Evidence: tool-sandboxing (srt: deny-by-default, no network namespace, sentinel secrets; sandboxed auto-approves, unsandboxed needs the permission flow), desktop-security-threats (lethal trifecta per turn).
Changes: `packages/sandbox` wrapping `@anthropic-experimental/sandbox-runtime` with `bwrap`, `seatbelt` and `none` backends; `packages/runner/src/tools.ts` replaces `spawnSync` with `ctx.sandbox.exec`; `sandboxProfileHash` on `ToolCall` and in the approval id; `session.policy.network` event; boundary recorded on `agent.tool.completed`; desktop denies `~/.ssh`, `~/.aws`, rc files; native Windows reports `unsandboxed: true` with a standing notice.
Phase: next quarter (container plus bwrap on the server); later for Firecracker in the hosted fleet.
Risk: bubblewrap needs unprivileged user namespaces, which many containers deny; allowlists are not exfiltration control.

**9. Credential broker: delegation, not impersonation; secrets never cross the socket or enter the log.**
Evidence: credential-broker (RFC 8693 `act` chains, Arcade's opaque handles, Vault control groups as quorum unwrap), tool-sandboxing (scrub before append).
Changes: `ToolSpec.credential` and `credential.issued|used|refused` events in `packages/protocol`; `packages/server/src/broker.ts` mints per granted `ApprovalRecord` with short TTL and single audience; `CredentialResolver` on `ToolContext` in `packages/runner`, output scrubbed before `ToolResult`; "as Ana · approved by Ana, Bo" on the collapsed tool line in `apps/web`; desktop local mode may keep grants in the keychain, shared sessions always use the server broker.
Phase: next quarter.
Risk: composite principals have no token shape; no in-flight revocation.

**10. Telemetry is a tap on the log, never instrumentation in the runner or the clients.**
Evidence: observability-otel-genai (a pure fold makes export idempotent across crash and replay; `gen_ai.*` is the dialect every backend reads; `response.usage` is discarded today).
Changes: `usage`, `latencyMs`, `stopReason` on `agent.model.completed` (`packages/protocol`, `packages/runner/src/claude.ts`); new `packages/telemetry` (one trace per turn, ids derived from event hashes, versioned pricing table); cost in the `packages/fleet` ledger and brief; `FOLD_OTEL_CONTENT=none` default; `fold export --otlp`.
Phase: next quarter for usage in the event; later for the exporter.
Risk: conventions still "Development"; no standard cost attribute; `fold.*` is proprietary by necessity.

**11. Extract the actor contract before choosing a hosted substrate.**
Evidence: realtime-fanout-scaling (Durable Objects, PartyKit and the Agents SDK share one shape: tiny socket attachment, state in storage; a hot runner cannot hibernate), `docs/04`.
Changes: `packages/server/src/actor.ts` with `SessionActorPort { storage, now, fanout, wake }`; `SessionHost` takes the port; `projectHost.ts` subscribers declare kinds; the runner stays outside.
Phase: later (Phase 2 entry criterion).
Risk: branches have no vendor analogue; socket ownership across fork is undecided.

**12. Mobile inherits; it gets no kernel or protocol work of its own.**
Evidence: identity-sso-device-trust and local-first-offline-desktop both single out the phone as the likeliest approval surface and the weakest assurance.
Changes: `apps/mobile` consumes the adapter (1), the inbox (4) and the offline matrix (6); `deny` always works offline, `approve` on `irreversible` needs a live socket and a policy-permitted authenticator.
Phase: later.
Risk: a device-bound policy can lock out the one person who could unblock the agent at 11pm.

## What we still do not know

1. Whether bubblewrap works nested inside the containers design partners will run `fold serve` in, or whether phase 1 is effectively `none` on day one.
2. How to represent a two-owner quorum as one provider principal without lying in GitHub's audit log.
3. Whether Tauri notification actions are usable on Windows (AUMID, COM activation) and Linux at all.
4. The correct arbitration outcome for a steer composed at epoch 7 and delivered at epoch 12.
5. Whether a quorum vote is void when one approver is deprovisioned mid-vote.
6. How a web client can sign events with device assurance before DBSC keys are exposed, if ever.
7. Real idle memory and cold-start numbers for the shell on WebKitGTK versus WebView2.
8. Whether Tauri's `version_comparator` makes true rollback safe, or rollback stays "publish older as newer".
9. How backends dedupe identical spans re-exported on replay.
10. Whether design partners value live steering or replay and audit more, which decides whether notifications or telemetry gets the next quarter.
