# Threat model

Assets: the session log (integrity, attribution), the workspace, the credentials tools use,
the model context (confidentiality across participants), and the team's time.

## Adversaries

1. **Malicious or careless participant.** Has a seat. Wants to steer the agent to a harmful
   action, bury a teammate's instruction, or get an irreversible action approved alone.
2. **Compromised client.** Steals a websocket session or token.
3. **Prompt injection via the workspace or tool output.** Content the agent reads tries to
   issue directives or approve itself.
4. **Insider with server access.** Wants to edit history.
5. **Vendor model drift.** A replay under a new model would produce different actions.

## Controls as built

| Threat | Control | Where |
|---|---|---|
| Observer steers | Rank check at submission; reducer shadows on replay | `Session.directive`, `arbitrate` |
| Peer buries a peer's directive | Same-rank concurrent directives become a contention, visible to all | `arbitrate` rule 4 |
| One person approves an irreversible action | Fold rule: two distinct drivers or owners by default; agent cannot vote | `approvals.evaluate`, `Session.vote` |
| Approval reused for a different action | Approval id derived from the call's content hash | `Session.requestApproval` |
| Injected text claims authority | Only logged `directive.submitted` events from ranked participants affect intent; tool output is data in a `ToolResult` | runner, reducer |
| Edit history | Hash chain; `verify` in CLI and CI; atomic writes | `SessionLog.verify` |
| Replay reproduces different actions | Model and tool outputs are journaled; replay never calls them | runner, `replay.ts` |
| Path escape by a tool | `safePath` rejects absolute and parent paths; shell is allow-listed, time-limited, scratch-copied | `tools.ts` |
| Stuck session when the driver vanishes | Owner reassigns the driver token; brief for the newcomer | `Session.setRole`, `handoffBrief` |

## Gaps to close (phase 1)

- Identity is asserted by the client; a stolen token impersonates anyone. Fix: server-issued
  identities and per-event signatures.
- Tool credentials are not per-participant. Fix: server-side credential broker keyed by the
  approver, so an action runs with the authority of the humans who approved it.
- No rate limits, no quotas: a participant can spam directives or forks.
- Model context is shared across participants; private information one person pastes is
  visible to the model for everyone. This is by design for a shared session but needs a
  stated policy and redaction tools.
- The shell runs in-process. Fix: per-session container with no network by default.
