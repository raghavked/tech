# Synthesis: business and compliance

Theme: `business-and-compliance`. Lead architect note, 2026-10-02, from five research memos (cited by slug below), `docs/04_technical_architecture.md` and `docs/06_roadmap.md`.

Fold's commercial and compliance stories are one story: the hash-chained log (`docs/04`) is both the meter and the evidence, and no competitor has it. The roadmap parks audit export in Phase 3 and names "partners value replay and audit" as a plan-changing milestone. These decisions treat it as triggered: evidence becomes a Phase 1 deliverable and billing is a fold over the same log. Desktop and web carry both; mobile gets the links second.

## Decisions

**1. Free observers and contributors; driver and owner are the billable "approver" seat.**
Evidence: `pricing-packaging` (Figma's free View seat, Claude's $20 identity seat, Linear's missing read-only seat as the cautionary tale). Taxing observers collapses Fold to one person babysitting an agent.
Changes: `packages/protocol/src/index.ts` adds `Plan`, `SeatClass = 'approver'` and `seat.granted` / `seat.released`, derived from `role.changed` when the new role is driver or owner; `docs/03_product_spec.md` roles table states free versus seat.
Phase: now. Risk: managers who read fleet briefs without a driver seat are unpriced; a lead seat may be needed.

**2. Four tiers, procurement bundle at Enterprise only.**
Evidence: `pricing-packaging` (vendors converged on standard plus premium seat; SSO is mid tier; SCIM, audit export and custom retention stay at Enterprise). Free: 3 approver seats, 20 pooled hours, 30-day retention, BYO key. Team: $30/seat annual, 40 hours per seat, SSO, Slack, 1-year retention. Business: $75/seat, fleet, memory curator, audit export, 3-year retention. Enterprise: invoice/PO, SCIM, compliance API, self-hosted runner, Merkle-proof export, fee per harness adapter.
Changes: replace "Pricing (working hypothesis)" in `docs/08_business_model.md`; list the bundle in `docs/07_security_and_compliance.md`.
Phase: now (documents), next quarter (enforcement). Risk: no price point has met a design partner; the Managed Agents anchor was a 404 today.

**3. Meter active hours from the log, not the clock; invoice in dollars with a visible pool.**
Evidence: `pricing-packaging` (Cursor ended flat-rate Auto, Devin retired ACUs from self-serve; opaque units are a procurement objection). Active is turn start to turn end, excluding spans blocked on `approval.requested`, quorum or contention, so governance is never billed.
Changes: new `packages/server/src/metering.ts` folding session events into intervals; `usage.metered` hourly into the org log in `packages/server/src/orgs.ts`; forked branches meter independently; the merge event closes the branch meter.
Phase: next quarter. Risk: runner cost accrues during waits; a fork doubles hours, and no comparator has priced that.

**4. Bind approvals to the policy as well as the call.**
Evidence: `compliance-evidence-export` (a policy edit between request and vote is invisible today; Art. 14 wants the reason behind an override). Cheapest decision here, and it changes the approval id, so it must land before partners write real logs.
Changes: `packages/protocol/src/index.ts` adds `policyHash` on `approval.requested`, a `policy.changed` event and `reason` on `approval.voted`; `packages/kernel/src/approvals.ts` computes `ruleFor` against that policy.
Phase: now. Risk: breaks replay of Phase 0 logs; needs a schema version in `packages/kernel/src/replay.ts`.

**5. Ship the three-question evidence export in Phase 1, not Phase 3.**
Evidence: `compliance-evidence-export` (auditors ask who caused, who authorised, under which rule; NovaFabric's bundle shape with a separate redaction attestation and in-toto/DSSE statements; OCSF as a projection); Art. 26(6) deployer retention applies from 2 August 2026.
Changes: `packages/kernel/src/evidence.ts` with `actionRecords(state)`, a pure fold tested like `brief.ts`; `fold export-evidence` in `packages/cli/src/main.ts` beside `verify`, producing a manifest, action records, the byte-equal event slice, policies, participants, verify result, OCSF projection and DSSE attestations; `GET /sessions/:id/evidence` in `packages/server/src/server.ts`; one "Export evidence" entry in the session menu in `apps/web/src/views`; mirrored on `packages/fleet/src/ledger.ts` and `packages/memory/src/store.ts`.
Phase: `evidence.ts` now; bundle, attestations and web entry next quarter. Risk: the export must never claim conformity; redaction of secrets must itself be attested or the chain does not verify.

**6. Session logs are append-only with a retention floor independent of memory compaction.**
Evidence: `compliance-evidence-export` (six months is a floor; memory compacts, the session log must not); `pricing-packaging` (retention is a tier lever).
Changes: `packages/server/src/storage.ts` gets a configurable minimum, default six months, never below; Phase 1 compaction must keep the whole chain.
Phase: next quarter. Risk: blob growth; a floor on Free conflicts with its 30-day tier unless Free logs are kept but not served.

**7. Oversight is visible in place and exported with the same weight as approvals; approvals never expire, scoped grants are narrow.**
Evidence: `compliance-evidence-export` (Art. 14(4)(e): pauses, cancels, denies and shadowed directives are oversight events, not failures); `competitor-claude-code-desktop` (permission prompts never expire, other dialogs do); `competitor-codex-cursor-devin-zed` (Codex `acceptedForSession`, which must not become an unbounded grant).
Changes: `apps/web/src/ui.tsx` adds a muted "approved by Ana, Ben" trailer on an approved irreversible call's tool line, no dashboard; `packages/kernel/src/approvals.ts` keeps requests open until resolved or superseded by a new call hash, TTL only on informational prompts; later, an `approval.scope` event in `packages/protocol` with a command pattern and `turns`, voted like any approval and recorded as the `rule`.
Phase: trailer and non-expiry now; scoped approvals later. Risk: scoped grants are where auditors look first for over-broad authority.

**8. Admin-approved paid seats, spend caps that pause rather than fail, and a signed entitlement cache in the desktop shell.**
Evidence: `pricing-packaging` (Figma's admin-approved, prorated seats); `competitor-claude-code-desktop` (Trusted Devices as the desktop trust pattern).
Changes: `packages/server/src/orgs.ts` holds a promotion that would exceed the plan's seats until an admin approves; a monthly hour cap pauses the agent with a one-line composer notice in `apps/web`, logged as a governance event; `apps/desktop/src-tauri/src/main.rs` keeps a signed entitlement cache so an expired token degrades to observer rather than locking the window; the sidebar settings panel shows seats, hours and next invoice.
Phase: next quarter. Risk: the cache is a tamper target; it must grant nothing above observer without a fresh signature.

**9. Chat is a hand-off and voting surface, never a second product; chat votes are hash-checked and idempotent.**
Evidence: `slack-and-chat-ops-integration` (Claude Code's four-button hand-off, Copilot's write-access gate, GitHub's stale-reply failures, Slack Code APIs partner-only); `compliance-evidence-export` (a shared identity is not attribution).
Changes: `packages/protocol/src/index.ts` tags directives and actions with `surface: 'chat' | 'app'`; `packages/slack/src/adapter.ts` adds `handoffBlocks` ("Open in Fold" via `fold://`, "Brief", "Open the call") and on `onAction` verifies the approval is pending and the button value equals the call hash, else marks the message superseded; unmapped users are observers with no vote; per-channel token bucket in `packages/slack/src/client.ts`; `fold://` registered in `apps/desktop` via the Tauri deep-link plugin.
Phase: now; a transport-neutral `packages/chatops` with a Teams adapter next quarter; Discord later. Risk: a 30-session fleet saturates one channel at 1 message/s; Teams' 1800/hour per thread is tight.

**10. Identity precedes evidence: OIDC login and server-issued actor ids are a compliance prerequisite.**
Evidence: `compliance-evidence-export` ("approved by whom" is only as good as the provider behind `actorId`; Phase 0 is a shared token); `pricing-packaging` (SSO at Team tier); `slack-and-chat-ops-integration` (three id spaces to bridge). Already Phase 1 in the roadmap; this sequences it ahead of the evidence bundle.
Changes: `packages/server/src/orgs.ts` and `store/users.json` replaced by OIDC-issued identities; `participant.joined` carries the issuer.
Phase: now. Risk: scope creep into SCIM, which belongs to Enterprise and later.

**11. Position on two verifiable gaps: a shared link that updates with a seat, and a record a third party can verify.**
Evidence: `competitor-claude-code-desktop` (sharing is a read-only snapshot, limits are advisory, Projects exclude Team and Enterprise); `competitor-codex-cursor-devin-zed` (no arbitration, quorum or replay anywhere). Both verifiable from vendor docs.
Changes: `docs/12_brand.md`, `docs/00_thesis_one_pager.md`, `docs/02_competitive_landscape.md` (Codex and Cursor rows); `docs/06_roadmap.md` moves audit export to Phase 1.
Phase: now. Risk: the claim ages the day Anthropic or Zed ships multi-user steering; tie it to what the log proves, not to what competitors lack.

## What we still do not know

1. What an "active" hour is for one agent with many humans, and whether partners accept a meter that excludes governance wait.
2. Whether a 40-engineer team lands at $300 to $750 a month, or approver seats cluster at two per team.
3. Whether a lead seat for managers is a third weight or a Business-tier feature.
4. Whether any design partner sits inside an Annex III high-risk use case, which decides if Art. 12 retention sells.
5. How to redact secrets and PII in tool I/O so the export verifies and still satisfies an auditor.
6. Whether any regulator Fold will meet requires an external timestamp over the chain head.
7. Whether SOC 2 auditors accept a DSSE-signed action record as enforcement proof or also want gateway configuration.
8. The real per-active-hour runner cost once sandboxing and harness adapters land, which sets the overage price.
9. Whether Slack Code's partner-only channel API opens, which decides if the hand-off block is emulation or permanent.
10. How soon Anthropic or Zed ship multi-user live sessions, which sets the shelf life of decision 11.
