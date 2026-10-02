# Business model

## What is sold

Quorum sells the shared session: the kernel, the hosted actor-per-session service, the
adapters that let any harness run inside it, and the audit that falls out of the log. It is
infrastructure with a product on top, in that order. The product (web, CLI, Slack) proves
the kernel; the kernel is what a platform team standardises on.

## Who buys, and why

| Buyer | Trigger | What they pay for |
|---|---|---|
| Engineering teams (bottom-up) | A multi-hour agent run that one person babysits while others wait for the diff | Live co-presence, approvals, handoff |
| Platform or developer-productivity teams | Three harnesses in use, no common record of what agents did or who approved it | One session layer across harnesses; replay; policy |
| Security and compliance | An agent took an irreversible action and nobody can say who authorised it | Quorum approvals, attributed logs, exportable evidence |
| Vertical teams (sales, support, legal, finance, marketing) | Several people already crowd one agent-driven task in a chat thread | Templates, roles, briefs, policy packs |

## Pricing (working hypothesis)

The product's premise is that anyone can drop in, so per-seat pricing fights the product.
The working model:

- **Per active session-hour** for the hosted service, with idle (waiting on humans) unbilled,
  matching how Claude Managed Agents and similar price compute.
- **Per approver seat** for people with driver or owner rights, since authority is what
  organisations control and count.
- **Platform tier** priced per harness adapter and per retained-log volume, for teams that
  run Quorum as their session layer.
- Open-source kernel and protocol; commercial hosting, adapters, policy packs, audit export.

Illustrative: a 40-engineer team with 10 approvers running 200 session-hours a month lands
in the low thousands of dollars per month, comparable to one seat of the agent spend it
governs.

## Why the kernel is defensible

- **Semantics are the moat, not the UI.** Arbitration, authority, fork and merge, and
  replay are specified and tested properties; a first-party harness can add a share link in
  a week but cannot add vendor-neutral, replayable multi-human semantics without rebuilding
  its session model.
- **Neutrality.** No first-party vendor has a reason to make its sessions portable to a
  rival's harness. Platform teams do. Slack Code shows the cross-vendor surface is wanted;
  Quorum is the state behind such a surface.
- **The log compounds.** Every session adds to an organisation's record of how its agents
  are steered and approved. Policy packs, briefs and analytics are built on it, and
  switching away means losing replayable history.

## Comparables

Figma made design multiplayer and the file format the moat. Liveblocks and PartyKit sell
the multiplayer substrate per connection-minute. Temporal sells durable execution and was
valued at $12.55B in September 2026. Quorum sits at the join: durable, replayable sessions
with multiplayer semantics, priced like the former and valued like the latter if it becomes
the record of agent work.

## Go to market

1. **Design partners** (phase 1): three engineering teams with weekly multi-hour runs,
   recruited through the open feature requests on first-party trackers and the teams using
   two or more harnesses.
2. **Slack adapter** as the distribution wedge: a thread becomes a governed session without
   anyone installing a client.
3. **Platform sale** once two or more teams in an organisation use it: the session layer,
   policy and audit.
4. **Vertical templates** with partners who already own the workflow (deal desks, support
   escalation, matter management), where Quorum is the session under their product.

## Risks

- First parties ship native multi-human sessions: compete on neutrality and audit, or
  become their cross-vendor layer.
- Teams want visibility and approvals, not steering: lead with briefs and audit; the kernel
  is still required for both.
- Long-running agents stay rare for another year: the product is still useful for
  hour-long runs, but the handoff story weakens. Watch the task-horizon data.
