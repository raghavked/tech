# Desktop security threats for Henosis

Memo, 2026-10-02. Repo state read: `apps/desktop/src-tauri/*`, `apps/web/src/{shell,router,identity}.ts`, `packages/runner/src/tools.ts`, `docs/09_threat_model.md`. The egress proxy blocked every vendor domain, so prior art is cited from memory and marked UNVERIFIED.

## Why it matters for Henosis

Henosis makes the session a shared object: many humans, one agent, one hash-chained log. Every security property of a single-user agent therefore becomes a group property. An injection planted in one participant's workspace is read by an agent many people trust; a spoofable approval surface defeats quorum; a deep link that opens the wrong session can lead an owner to approve an irreversible call in the wrong place. The desktop shell adds native surfaces the web client lacks: a registered `henosis://` scheme, a tray with approval counts, OS notifications, an installer run with user privileges, and local storage of the identifying token. Today the shell ships `"csp": null`, `withGlobalTauri: true`, a deep-link handler that forwards any `henosis://` URL into `location.hash`, no updater or signing configuration, and a bearer token in `localStorage`. Harmless in Phase 0; each is a hole the hosted product inherits.

## Prior art

1. **Tauri v2 security model** (capabilities, permissions, CSP, isolation pattern). https://v2.tauri.app/security/ , accessed 2026-10-02, UNVERIFIED (fetch blocked). The webview is untrusted; the Rust core exposes only commands a per-window capability grants; CSP should never be null in production; the isolation pattern adds a sandboxed iframe that validates every IPC message.
2. **Tauri updater plugin** with minisign-signed manifests and a public key baked into the config. https://v2.tauri.app/plugin/updater/ , accessed 2026-10-02, UNVERIFIED.
3. **Pillar Security, "Rules File Backdoor"** (March 2025): hidden Unicode and zero-width characters in `.cursorrules` / Copilot instruction files make an agent emit malicious code while the rendered file looks benign; the payload propagates through forks and shared repos. https://www.pillar.security/blog/new-vulnerability-in-github-copilot-and-cursor-how-hackers-can-weaponize-code-agents-via-rules-file-backdoor , accessed 2026-10-02, UNVERIFIED.
4. **Invariant Labs, "MCP tool poisoning attacks"** (April 2025): instructions hidden in tool descriptions, "rug pulls" where a tool's description changes after approval, and cross-server shadowing where one server's description rewrites how the agent uses another's tool. Mitigations: show full descriptions, pin description hashes, isolate servers. https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks , accessed 2026-10-02, UNVERIFIED.
5. **Simon Willison, "The lethal trifecta"** (June 2025): private data + exposure to untrusted content + an exfiltration channel is the combination that must never co-exist in one agent turn. https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ , accessed 2026-10-02, UNVERIFIED.
6. **Claude Code security documentation**: folder trust dialog on first open, per-tool permission allow/deny lists, command injection detection, read-only by default, "treat content read from files as data". https://docs.anthropic.com/en/docs/claude-code/security , accessed 2026-10-02, UNVERIFIED.
7. **SLSA v1.0 build levels** and GitHub artifact attestations: L2 requires provenance signed by a hosted build platform; L3 requires a hardened, isolated builder. https://slsa.dev/spec/v1.0/levels , accessed 2026-10-02, UNVERIFIED.

## What to borrow

- From Tauri: treat the web client as hostile. Capabilities already exist in `capabilities/default.json` and are tight (notification, deep-link, opener, show/focus); keep that discipline, add a CSP, and drop `withGlobalTauri` once `shell.ts` imports `@tauri-apps/api` directly.
- From Pillar and Claude Code: a *workspace trust* event. Henosis already has the right primitive, the hash-chained log with ranked actors; the missing piece is that files the agent reads are unranked data and must be rendered as such, with Unicode-hidden content surfaced rather than silently passed to the model.
- From Invariant: pin what the agent sees. Henosis binds approvals to the hash of the exact call (`Session.requestApproval`); extend the same idea to tool *definitions* and to memory entries so a definition that changes after a quorum voted invalidates the vote.
- From Willison: name the trifecta per tool call. Henosis's risk classes (`read`, `write`, `exec`, irreversible) map onto it; the dangerous combination is a turn that has read untrusted content *and* calls a tool with a network or exfiltration side effect.
- From SLSA and the Tauri updater: reproducible, attested, signed builds with the public key in the binary. Users on a team will install from a link someone pasted in Slack; the installer is the supply chain.

## What is unsolved

- **Injection through teammates.** A shared session has no "untrusted" participant by design, but a contributor's pasted log or a repo they cloned can carry instructions. Rank checks stop injected text from *claiming* authority, yet nothing stops the agent from being *persuaded* by it. No one has a reliable detector; the best known mitigation is structural (least privilege per turn, quorum on side effects), which Henosis partly has.
- **Memory as a long-lived injection channel.** Attributed team memory (docs/14) means a poisoned fact persists across sessions with a real engineer's name on it. Attribution helps forensics, not prevention.
- **Per-participant credentials.** docs/09 already lists this gap. On desktop the natural fix (OS keychain per user) makes the local machine the authority, which conflicts with server-issued identity.
- **Approval spoofing in a native shell.** Tray counts and notifications are OS-rendered from client-supplied strings; a compromised webview can show "2 pending" for a call the user never saw.
- **Malicious forks.** Directive carry-over on merge becomes a contention (good), but tool results journaled on a hostile branch replay as truth.

## Concrete recommendations for Henosis

1. **Set a real CSP and remove the global.** In `apps/desktop/src-tauri/tauri.conf.json` replace `"csp": null` with `default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; style-src 'self' 'unsafe-inline'` (tighten once fonts/images are inlined) and set `withGlobalTauri: false`; change `apps/web/src/shell.ts` to import `@tauri-apps/api/core` and `@tauri-apps/api/event` instead of reading `window.__TAURI__`.
2. **Validate deep links in Rust, not in the client.** In `apps/desktop/src-tauri/src/main.rs` parse `henosis://p/<project>/s/<session>` with a strict regex on both ids (`[A-Za-z0-9_-]{1,64}`), reject anything else, and emit a typed struct `{project, session}` rather than a string route. Keep the check in `shell.ts` (`startsWith("#/")`) as defence in depth. Never let a deep link carry an approval id, a token or a `?token=` query; the client must always re-check the user's rank server-side before showing a vote control.
3. **Move the token out of localStorage.** Add `tauri-plugin-stronghold` or `keyring` behind two commands `secret_set(key, value)` / `secret_get(key)` in `main.rs`, granted only to the `main` window in `capabilities/default.json`; in `apps/web/src/identity.ts` branch on `isTauri()` so the desktop stores the token in Keychain / Credential Manager / Secret Service and the web keeps a session cookie set by `packages/server` (HttpOnly, SameSite=Strict) instead of a bearer token in JS. Rotate tokens on handoff (`Session.setRole`).
4. **Label untrusted content at the protocol layer.** Add `trust: "ranked" | "workspace" | "tool" | "memory"` to the `ToolResult` and memory-entry schemas in `packages/protocol`, set it in `packages/runner/src/tools.ts` and `packages/memory/src/store.ts`, and have `packages/runner/src/model.ts` wrap untrusted spans in explicit delimiters the system prompt names as data. Strip or flag bidi and zero-width code points (`U+200B..U+200F`, `U+202A..U+202E`, `U+2066..U+2069`, `U+FEFF`) in `read_file`, `grep` and memory writes before they reach the model, and show a quiet notice in the session column when a file was flagged.
5. **Block the lethal trifecta per turn in the kernel.** In `packages/kernel` approvals, raise any `exec` or network-capable call to quorum when the current turn has consumed a `workspace` or `tool` trust result that contains an instruction-like pattern, and record the reason in the approval event so the approver sees "this call follows content from `README.md` that the model did not write". Keep the shell allowlist in `tools.ts` and move toward the per-session container with no network that docs/09 already names.
6. **Pin tool definitions and memory entries by hash.** Compute a hash over each tool's name, description and schema at session start, log it as `tools.registered`, and have `Session.requestApproval` include it in the approval id so a definition change after a vote invalidates the vote (Invariant's rug-pull fix). Do the same for memory entries injected into context: the brief should name the entry id and author.
7. **Sign and attest the desktop build.** Add `tauri-plugin-updater` with a minisign public key committed in `tauri.conf.json`, keep the private key in CI secrets only, enable macOS notarisation and Windows Authenticode in the bundle config, and add a GitHub Actions workflow in `.github/workflows/desktop-release.yml` that builds on a hosted runner, publishes SLSA provenance via `actions/attest-build-provenance`, and verifies `pnpm-lock.yaml` with `--frozen-lockfile`. Pin all Tauri plugins to exact versions in `Cargo.toml` and commit `Cargo.lock`.
8. **Make the tray honest.** Compute the pending count in `packages/server` and push it as a signed event; `set_pending` in `main.rs` accepts only that value, and notifications name session, call-hash prefix and requester so approvers can match them to the session column.
9. **Extend `docs/09_threat_model.md`** with adversaries 6 (malicious shared session or fork) and 7 (compromised build or deep-link caller), and state that workspace, tool output and memory are never ranked actors.

## Sources

- https://v2.tauri.app/security/ (UNVERIFIED, blocked 2026-10-02)
- https://v2.tauri.app/plugin/updater/ (UNVERIFIED, blocked 2026-10-02)
- https://www.pillar.security/blog/new-vulnerability-in-github-copilot-and-cursor-how-hackers-can-weaponize-code-agents-via-rules-file-backdoor (UNVERIFIED)
- https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks (UNVERIFIED)
- https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ (UNVERIFIED)
- https://docs.anthropic.com/en/docs/claude-code/security (UNVERIFIED)
- https://slsa.dev/spec/v1.0/levels (UNVERIFIED)
