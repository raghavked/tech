# Threat model

Assets: the session log (integrity, attribution), the workspace, the credentials tools use,
the model key each company connects, the line between one company's workspace and the next
on a shared server, the model context (confidentiality across participants), and the team's
time.

## Adversaries

1. **Malicious or careless participant.** Has a seat. Wants to steer the agent to a harmful
   action, bury a teammate's instruction, or get an irreversible action approved alone.
2. **Compromised client.** Steals a websocket session or token.
3. **Prompt injection via the workspace or tool output.** Content the agent reads tries to
   issue directives or approve itself.
4. **Insider with server access.** Wants to edit history.
5. **Vendor model drift.** A replay under a new model would produce different actions.
6. **Another tenant.** A signed-in person on the hosted service who belongs to a different
   workspace, or to none. Wants to read or join a workspace that is not theirs, or to run on
   its key.
7. **A reader of the database.** Has a dump or a backup of the store, not the server's
   environment. Wants the model keys and a way in.

## Controls as built

| Threat | Control | Where |
|---|---|---|
| Observer steers | Rank check at submission; reducer shadows on replay | `Session.directive`, `arbitrate` |
| Peer buries a peer's directive | Same-rank concurrent directives become a contention, visible to all | `arbitrate` rule 4 |
| One person approves an irreversible action | Release gate by default: two distinct contributors rating 4 or more on average, any deny denies; the agent cannot vote | `approvals.evaluate`, `Session.vote` |
| Approval reused for a different action | Approval id derived from the call's content hash | `Session.requestApproval` |
| Injected text claims authority | Only logged `directive.submitted` events from ranked participants affect intent; tool output is data in a `ToolResult` | runner, reducer |
| Edit history | Hash chain; `verify` in CLI and CI; atomic writes | `SessionLog.verify` |
| Replay reproduces different actions | Model and tool outputs are journaled; replay never calls them | runner, `replay.ts` |
| Path escape by a tool | `safePath` rejects absolute and parent paths; shell is allow-listed, time-limited, scratch-copied | `tools.ts` |
| Stuck session when the driver vanishes | Owner reassigns the driver token; brief for the newcomer | `Session.setRole`, `handoffBrief` |
| A person reads or joins another company's workspace | On a server of workspaces every HTTP route and every websocket join and subscription checks membership; outside a workspace the answer is 404, as if it did not exist; a session id that lives in another project is refused; `/api/health` lists no sessions or projects; every route but `/api/auth` and health needs a signed-in person | `HenosisServer.route`, `admit`, `orgOfRoute`; `workspaceApi.ts` |
| A workspace runs on someone else's model key | The hosted server has no key of its own and reads none from the environment; a workspace's work runs on the key it connected or on the scripted demo model, never on another workspace's | `models.ts`, `api/server.ts` (`envKey: false`) |
| Model keys stolen at rest (a database dump without the secret) | Each key is sealed with AES-256-GCM under a key derived with HKDF-SHA256 from `HENOSIS_KEYS_SECRET`, which is not in the store, and the workspace id; the workspace id and provider are associated data, so a sealed key moved under another workspace does not open. The dump shows the last four characters, who connected the key and when | `keys.ts` |
| A leaked secret | Rotate `HENOSIS_KEYS_SECRET`: every sealed key stops opening and each workspace connects its key again; the keys' owners revoke them at Anthropic | `keys.ts`, `07`, "Tenancy and model keys" |
| A stolen invitation link | The token is stored as a SHA-256 hash, so a database dump yields no usable link; a link expires after 14 days; addressed to an email it works once and only for a person signed in with that address; an admin sees every invitation and withdraws it, and removes a person who should not have joined | `OrgRegistry.createInvite`, `acceptInvite`, `revokeInvite` |
| A member reads or replaces the workspace's key | No route answers the key to anyone, an admin included: the API shows the last four characters, who connected it and when. Connecting, replacing, checking and disconnecting the key, picking the model and listing the models the key can use need an admin; a member is answered 403. The server log names who connected or disconnected a key | `workspaceApi.ts` |

## Gaps to close (phase 1)

- In dev mode identity is asserted by the client; a stolen token impersonates anyone. The
  Team edition verifies OIDC ID tokens on every request (`07`, "Identity"). Still to do:
  per-event signatures.
- Tool credentials are not per-participant. Fix: server-side credential broker keyed by the
  approver, so an action runs with the authority of the humans who approved it.
- No rate limits, no quotas: a participant can spam directives or forks.
- Model context is shared across participants; private information one person pastes is
  visible to the model for everyone. This is by design for a shared session but needs a
  stated policy and redaction tools.
- The shell runs in-process. Fix: per-session container with no network by default.
- The server that seals the model keys also holds the secret and opens them in memory. A
  person who controls the running server, or has both the database and the secret, reads
  every workspace's key. With a folder store the generated secret (`keys.secret`) sits
  beside the sealed keys, so a copy of the folder carries both. Fix: the credential broker,
  or a key service the server asks to unseal.
- An invitation link that is not addressed to an email admits anyone who holds it until it
  expires or is withdrawn. Address the link when the channel it travels over is not trusted.
- A workspace's key is shared by all of its agents: any member who can steer spends on it,
  and budgets are soft. Connecting a key and accepting an invitation are not rate limited.
