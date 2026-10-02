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
  Quorum rules require distinct voters at or above a role.
- **Replayable audit.** `quorum verify` checks every branch's chain and that replay from a
  snapshot equals full replay. `quorum report` renders the full who-did-what table.

## What phase 0 does not do

- **Authentication.** A shared token and client-asserted identity. Phase 1: OIDC or SAML,
  per-participant signatures on events, server-assigned actor ids.
- **Tool sandboxing.** `shell.run` is allow-listed and runs in a scratch copy with a timeout,
  but in the server's process and user. Phase 1: per-session container.
- **Secrets.** None are handled. Phase 1: credentials never enter the model context;
  tools resolve them server-side per participant, so a follow-up by Bo cannot run under
  Ana's tokens (the Cursor Team Followups problem).
- **Encryption at rest and transport.** Local disk and plain websockets.

## Regulatory fit

- **EU AI Act, Articles 12 and 14.** Article 12 asks for logging built into the system;
  Article 14 asks for natural persons who can monitor, interpret and override. Quorum's log
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
