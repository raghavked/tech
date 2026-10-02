# Tool sandboxing for Fold: per-session boundaries on server and desktop

Research memo, 2026-10-02. Topic: per-session sandboxes for agent tools (Firecracker, gVisor, containers, macOS Seatbelt, Windows AppContainer), egress policy, secrets outside the context, what Claude Code, Codex and Devin do, and a phase-1 recommendation.

## Why it matters for Fold

Fold's own docs name the gap: `shell.run` is allow-listed and runs in a scratch copy with a timeout, "but in the server's process and user" (`docs/07_security_and_compliance.md`), and the threat model lists "the shell runs in-process; fix: per-session container with no network by default" (`docs/09_threat_model.md`). Two properties of Fold make this sharper than for a single-user CLI:

- **The log is permanent and shared.** Every `agent.tool.completed` result is appended to a hash-chained, replayable log that the whole team (and the fleet brief, and organisation memory) can read. A secret that leaks into a tool result once is leaked to everyone, forever, and cannot be rewritten without breaking the chain. Scrubbing must happen before the event is appended, not in the UI.
- **One agent, many humans.** Approvals are bound to the hash of the exact call. That binding is only meaningful if the *boundary* the call runs inside is also part of what was approved; otherwise two drivers approve the same command under different sandboxes.

Branches have their own runner (`docs/05_kernel_design.md` §4), so a sandbox is naturally per-branch-per-session, materialised from a checkpoint and thrown away after merge.

## Prior art

1. **Claude Code sandboxed Bash** (https://code.claude.com/docs/en/sandboxing, accessed 2026-10-02). OS-enforced boundary around shell commands only: Seatbelt on macOS, `bubblewrap` + `socat` on Linux/WSL2; native Windows runs unsandboxed. Network has "no direct route out"; connections go through a local proxy that checks each host against an allowlist that "starts empty". Sandboxed commands auto-approve; anything outside (file tools, MCP servers, hooks, `excludedCommands`) goes through the permission flow. There is an explicit "unsandboxed retry escape hatch", disable-able by admins, after which "the sandbox becomes admin-required". Credentials: `sandbox.credentials` entries `deny` file reads or env vars, or `mask` them: the command sees a per-session sentinel and "the sandbox proxy substitutes the real value on outbound requests to hosts you allow", which requires `tlsTerminate` and an `injectHosts` list.
2. **Anthropic `sandbox-runtime` (srt)** (https://github.com/anthropic-experimental/sandbox-runtime, accessed 2026-10-02, Apache-2.0). The library behind the above: `sandbox-exec` with generated Seatbelt profiles; `bubblewrap` with the network namespace removed plus seccomp-BPF blocking `AF_UNIX`; a Windows alpha using a dedicated local user, WFP egress filters and NTFS ACLs. Dual proxies (HTTP for HTTP/S, SOCKS5 for other TCP), deny-by-default, resolved-address checks against loopback/link-local/cloud-metadata ranges. The README states the limit plainly: filtering "does not otherwise inspect the traffic"; allowing github.com is an exfiltration channel; the Docker-nested mode "considerably weakens security".
3. **OpenAI Codex CLI sandbox** (https://developers.openai.com/codex/security, UNVERIFIED: domain blocked, from search snippets). Seatbelt on macOS; Landlock for filesystem plus seccomp to block network syscalls on Linux; "network access disabled" and writes restricted to the workspace by default; sandboxing "may not work" inside containers lacking Landlock/seccomp.
4. **OpenAI, "Building the Codex Windows sandbox"** (https://openai.com/index/building-codex-windows-sandbox/, UNVERIFIED: blocked). AppContainer's default-deny for filesystem reads was "impractical without punching so many holes that the boundary became meaningless"; they instead built restricted tokens derived from an AppContainer profile, capability SIDs for requested paths, and disabled egress by overriding proxy env vars and stubbing network binaries.
5. **Devin / Cognition** (https://docs.devin.ai/enterprise/vpc/overview, UNVERIFIED: blocked). Stateless "Brain" in Cognition's cloud, a fresh VM ("Devbox") or customer-hosted "Outpost" per session; secrets are decrypted at session start into env vars inside the VM and shown to the frontend as `[REDACTED SECRET]`; the VM is recycled at session end.
6. **Fly.io, "Firecracker vs gVisor"** (https://fly.io/learn/firecracker-vs-gvisor/, UNVERIFIED: blocked). Firecracker puts a separate guest kernel behind KVM (cold boot under ~125 ms, ~5 MiB overhead, snapshot restore tens of ms; needs KVM, so nested virt in cloud VMs); gVisor is a userspace kernel in a process (instant start, pays per syscall, runs anywhere, used by Cloud Run and reportedly by claude.ai code execution).

## What to borrow

- **The srt shape, verbatim.** Deny-by-default writes, deny-then-allow reads, mandatory deny of rc files and `.git*` config, no network namespace plus a loopback proxy pair. Apache-2.0 TypeScript; depend on it rather than re-deriving Seatbelt profiles.
- **Boundary-aware auto-approval.** Claude Code's rule "sandboxed means no prompt, unsandboxed means the permission flow" maps directly onto Fold's risk classes: a command inside the boundary can stay `exec` (one contributor); the same command unsandboxed is `external` or `irreversible`.
- **Sentinel-and-substitute secrets.** The model and the log only ever see a per-session placeholder; the proxy injects the real token on allow-listed hosts. This is the only design that satisfies "credentials never enter the model context" (`docs/07`) and the per-participant broker in `docs/09` at once.
- **Named denied host in the tool result.** Claude Code returns the blocked domain in the command's result so the model can ask for it. Fold should turn that into a `contention`-style notice the driver can approve, not a silent failure.

## What is unsolved

- **Allowlists are not exfiltration control.** Any allowed host with write semantics (github.com, npm, a package registry) is a channel; neither srt nor Codex inspects content.
- **Nested sandboxing.** bubblewrap needs unprivileged user namespaces, which Ubuntu 24.04 AppArmor and most CI containers deny; Landlock needs a recent kernel. A Fold server deployed in a container will hit this on day one.
- **Native Windows.** No open, reusable primitive exists; Claude Code punts to WSL2 and OpenAI built bespoke token plumbing. Fold's Tauri desktop must either require WSL2 or mark runs unsandboxed.
- **What is outside the boundary.** File tools, MCP servers and the model client itself run unsandboxed in every product surveyed.
- **Whose credentials.** With many approvers, "run with the authority of the humans who approved it" has no precedent in the surveyed products; it needs a broker keyed by approval id, not by session.
- **Hardware isolation cost.** Firecracker needs KVM and is Linux-only; it fits a hosted phase-2 fleet, not a laptop.

## Concrete recommendations for Fold

1. **New package `packages/sandbox`** exporting `interface Sandbox { prepare(sessionId, branch, snapshot): Handle; exec(handle, argv, profile): Promise<ExecResult>; destroy(handle) }` with backends `bwrap` (Linux server and desktop), `seatbelt` (macOS desktop) and `none` (native Windows, reports `unsandboxed: true`). Wrap `@anthropic-experimental/sandbox-runtime`. Replace the `spawnSync` scratch-copy path in `packages/runner/src/tools.ts` with `ctx.sandbox.exec`.
2. **Phase-1 server boundary: rootless Podman/Docker container per session as the outer wall, bubblewrap profile per branch inside it**, started with `--userns=keep-id` and seccomp permitting user namespaces so srt works nested. Defer Firecracker to the hosted fleet in phase 2; document the KVM requirement in `docs/04_technical_architecture.md`.
3. **Make the boundary part of the approved hash.** Add `sandboxProfileHash` to `ToolCall` in `packages/protocol/src/index.ts` and fold it into the approval id computed in `packages/kernel/src/approvals.ts`. A call executed `unsandboxed` is re-classed to `external` by `ToolRegistry.call` so it needs the driver; the "retry outside the sandbox" escape hatch requires an owner and is itself a logged event.
4. **Egress policy as a session event.** Add `session.policy.network { allowedDomains, injectHosts }` to the protocol; the proxy in `packages/sandbox/src/proxy.ts` reads it from state. Default allowlist is empty; a blocked host comes back in the tool result and the runner raises a quiet notice with a one-tap "allow github.com for this session" that is an `external`-class approval.
5. **Credential broker in `packages/server/src/secrets.ts`.** Secrets are stored per participant and keyed to the approving human; the sandbox receives sentinels; the proxy terminates TLS and substitutes on `injectHosts` only. Before `agent.tool.completed` is appended (`packages/kernel/src/log.ts`), scrub every known secret and sentinel from `ToolResult.output`; add a `fold verify` check that no stored secret appears anywhere in a log.
6. **Desktop (Tauri) policy in `apps/desktop/src-tauri/capabilities`.** The shell spawns the local runner with the `seatbelt` or `bwrap` backend, workspace writable, `~/.ssh`, `~/.aws`, `~/.config/gh` and shell rc files denied, no Apple Events, Docker socket never allowed. On native Windows require WSL2 or run with `unsandboxed: true` and show the standing notice in the session header, in the same quiet register as a contention.
7. **Record the boundary for replay.** Each `agent.tool.completed` event carries `{ backend, profileHash, imageDigest }` so `packages/kernel/src/replay.ts` can state whether a replayed result was produced under the same boundary;the brief lists every unsandboxed or egress-widening approval.

## Sources

- https://code.claude.com/docs/en/sandboxing (accessed 2026-10-02)
- https://github.com/anthropic-experimental/sandbox-runtime (accessed 2026-10-02)
- https://developers.openai.com/codex/security (UNVERIFIED, blocked; search snippets 2026-10-02)
- https://openai.com/index/building-codex-windows-sandbox/ (UNVERIFIED, blocked; snippets 2026-10-02)
- https://docs.devin.ai/enterprise/vpc/overview (UNVERIFIED, blocked; snippets 2026-10-02)
- https://fly.io/learn/firecracker-vs-gvisor/ (UNVERIFIED, blocked; snippets 2026-10-02)
- Repo: `docs/05_kernel_design.md`, `docs/07_security_and_compliance.md`, `docs/09_threat_model.md`, `packages/runner/src/tools.ts`, `packages/protocol/src/index.ts`
