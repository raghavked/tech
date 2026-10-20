# How collaboration tools roll out from startups to large companies

*Research memo, 20 October 2026. Slack, Linear, Figma, Notion and Cursor; seat and usage
pricing, SSO and audit, self-hosting; implications for Henosis editions. Vendor domains are
blocked by the egress proxy, so vendor-page claims come through search excerpts and are
marked UNVERIFIED; secondary pages are named as such.*

## Why it matters for Henosis

`docs/18_editions.md` promises one kernel in three editions (Starter, Team, Enterprise) and
says what changes is where state lives, who answers "who is this person", and what auditors
can export. The five tools below all went from a product one team adopted on its own to one
a company bought for everyone. Their history shows what a company asks of a tool at a
thousand people, and which of those asks are priced, gated, or refused.

## What is established

**The path is bottom-up, then an admin layer.** Figma's Organization plan (January 2019) was
built with Rakuten, Square, Volvo and Uber after teams there had already adopted the product;
its launch copy sells unified billing, audit reports, SSO deactivation of leavers and
org-wide design systems to admins, and nothing new to designers (figma.com/blog, 2019;
UNVERIFIED, consistent across two excerpts). Slack's Enterprise Grid (January 2017) existed
because large companies ran several unconnected workspaces; Grid put one org layer over them
with shared channels and per-workspace admin (VentureBeat, 2017). Slack's engineering post on
Grid migrations says the original schema hashed all data by a per-team id, and the hard part
was deciding where cross-team channels live and migrating legacy data without downtime
(slack.engineering, undated, via excerpt). Analysts describe the same motion at Notion:
individuals first, then IT standardising once enough of the company was inside (Sacra, 2025,
secondary).

**Procurement features cluster into two bands.** SAML SSO sits one tier below the top: Slack
Business+ (slack.com help, UNVERIFIED), Notion Business (2026 pricing guides, secondary),
Cursor Teams with SAML/OIDC (cursor.com docs via excerpt, UNVERIFIED), Figma Organization.
SCIM, audit logs, invoice/PO billing and custom retention sit at the top tier everywhere:
Linear Enterprise (linear.app/docs/saml-and-access-control, /scim, /audit-log, via excerpt
2026-10-20: SAML "available to workspaces on our Enterprise plan"; SCIM needs SAML first;
the audit log covers 90 days and only workspace owners see it); Notion Enterprise (audit log
for organisation owners, SCIM for users and groups; notion.com help, UNVERIFIED); Cursor
Enterprise (audit logs for admins, SIEM streaming to Splunk, Datadog, S3 or webhooks on
request; cursor.com/docs/enterprise, UNVERIFIED); Slack Enterprise Grid (the Audit Logs API
is installed by an org owner, is read-only, spans the org, filters by actor, entity and
action, and never exposes message content; docs.slack.dev, 2026-10-20). Linear gates SAML at
Enterprise too. The gate is the norm: Toolradar's August 2026 snapshot found 61% of 1,112
tools with SSO put it only in the top tier; a June 2026 check of 28 B2B tools found 57%
(both secondary).

**Seats are priced by what a person may do, and viewers are free or nearly so.** Figma has
one seat per person in four kinds since 11 March 2025: View (free), Collab ($3/$5/$5 on
Professional/Organization/Enterprise), Dev ($12/$25/$35), Full ($16/$55/$90), annual-only
above Professional (Wise table dated 2025-04-15, secondary; help.figma.com article
27468498501527, UNVERIFIED). Admins choose per seat type whether upgrades need approval,
are auto-approved when a seat is free (the default), or always auto-purchased; SCIM-set
seats bypass approval; new seats are prorated and Enterprise invoices quarterly
(help.figma.com excerpts, UNVERIFIED). Notion guests do not consume seats and are capped per
tier (10/100/250/custom; 2026 guides, secondary). Linear has no read-only seat: guests exist
only on Business and bill as members (`pricing-packaging.md`, 2026-10-02). Slack credits
back members unused for 28 days (Fair Billing Policy, excerpt 2026-10-20).

**Usage sits on top of seats, and the pool is the enterprise unit.** Cursor Teams charges
Standard $40 and Premium $120 per user per month (5x usage), with pooled usage, invoicing,
SCIM and audit logs reserved for Enterprise (cursor.com/docs/account/teams/pricing via
excerpt, UNVERIFIED; one page variant shows $32 and no Premium seat). Third-party model
calls bill at provider rates plus a $0.25 per million token Cursor rate (nops.io, 2026,
secondary). Linear bundles agents into per-seat tiers with no meter, and keeps a human
assignee accountable while the agent is a delegate (linear.app/blog, "Our approach to
building the agent interaction SDK", and linear.app/docs/agents-in-linear, 2025, excerpts).

**Self-hosting is refused by all five.** Slack is cloud-only (its comparison page against
Mattermost; UNVERIFIED). Cursor runs on AWS with no on-prem, VPC or hybrid option; its answer
is Privacy Mode, which enforces zero-data-retention terms with model providers and which
admins can lock on org-wide, except when customers bring their own API keys (cursor.com/help
privacy page via excerpt, UNVERIFIED; third-party reviews 2026). Self-hosting in this market
comes from developer-infrastructure vendors: GitLab sells the same tiers Self-Managed and
SaaS and adds Dedicated, a single-tenant instance on AWS in a region the customer picks
(docs.gitlab.com 17.x, 2026-10-20); Mattermost runs on the customer's infrastructure
(Slack comparison page, vendor-sourced).

## What is our inference

1. The admin layer is bought by someone who never uses the product daily. Figma's and Slack's
   enterprise launches added nothing for the maker; the second buyer wants deactivation on
   leaving, scope for contractors, and a report. For Henosis that buyer is the platform or
   security team, and the audit view is their product.
2. SSO has moved down a tier (Slack, Notion, Cursor) while SCIM and audit export stay up.
   Gating SSO at the top reads as an SSO tax; giving SCIM away loses the enterprise handle.
3. Per-seat pricing by capability survives because admins approve each promotion and SCIM
   can set the seat. The approval is the control point, not the price.
4. Usage pools are how enterprises accept metered agents: one pool, one invoice, model cost
   passed through at list. Opaque units are retreating to Enterprise contracts.
5. "No self-hosting" is survivable for a chat or design tool whose data is the company's own
   prose. For an agent holding repository access and credentials it is a harder sell; the
   analogues that offer it (GitLab, Mattermost) are the ones that touch source and secrets.
   Starter is already a self-hosted folder, unusual among the five and worth keeping at the
   top too.
6. Linear's "human assignee, agent delegate" matches the council's rule that the chair's model
   does not vote and every step has a member owner (`docs/19_council.md`). The market is
   converging on this accountability shape; Henosis should say so in its own words.

## What this changes for Henosis

- **Audit view in Team, audit export in Enterprise, shaped like Slack's Audit Logs API.**
  `docs/18_editions.md` puts "the audit view" in Team and PROV/in-toto in Enterprise; add a
  filtered feed (actor, entity, action, time window, org scope, no message content) served
  from `packages/server/src/export.ts` beside `exportSessionMarkdown`, installable only by
  an org owner. SIEM streaming is the Enterprise add, as at Cursor.
- **OIDC in Team; SAML, SCIM and device trust in Enterprise; say so in the table.**
  `packages/server/src/auth.ts` already drives OIDC from `HENOSIS_OIDC_ISSUER` with the `sso`
  mapping in `orgs.json`, and `18_editions.md` lists OIDC under Team, the right band. In
  `apps/web/src/views/Team.tsx`, SCIM-managed fields become read-only ("managed by your
  directory"), as Linear and Notion refuse to let the UI fight the IdP.
- **Price the approver seat, not the viewer, and gate promotion like a Figma seat request.**
  The vote and the plan gate are the billable acts: `planApprovalMet` in
  `packages/kernel/src/plans.ts` counts raters and `gateForCall` refuses writes until the bar
  is met. A `role.changed` to driver or owner, or a first plan rating, raises a seat request
  an org admin approves in `apps/web/src/views/Settings.tsx`, with Figma's three modes
  (always approve, approve unless a seat is free, auto-buy) and SCIM-set roles bypassing
  it. Observers, contributors and members who only instruct their own agent stay free.
- **Bill council and session usage from one pooled meter with model cost passed through.**
  `council.said.usage` already rolls into the usage API as a `council` row per person
  (`docs/19_council.md`); the budget and pace types in `packages/protocol` give the pool.
  Show the pool, not opaque units, in `apps/web/src/views/Project.tsx` and the glance, and
  let Enterprise pin a per-org pool with a Cursor-style per-token platform rate above
  provider list price.
- **Keep self-hosting in every edition and make it the Enterprise differentiator.** The
  Starter folder store and `henosis serve --store postgres` (`18_editions.md`) are a
  self-managed path none of the five offers. Add a "Dedicated" row to the editions table
  (single-tenant, customer-chosen region, GitLab's shape), and note in
  `docs/13_fleet_collaboration.md` that the Slack adapter's socket mode needs no public URL,
  which is what a deployment behind a corporate firewall needs.

## Sources

- Figma Organization launch: https://www.figma.com/blog/figma-organization/ (2019; UNVERIFIED page, via excerpt 2026-10-20); TechCrunch coverage: https://techcrunch.com/2019/01/29/figmas-design-and-prototyping-tool-gets-new-enterprise-collaboration-features (2019-01-29)
- Figma seats and billing changes: https://help.figma.com/hc/en-us/articles/27468498501527 (effective 2025-03-11; UNVERIFIED); seat approval settings: https://help.figma.com/hc/en-us/articles/4414038570007 ; billing on Organization and Enterprise: https://help.figma.com/hc/en-us/articles/360040328293 (excerpts 2026-10-20, UNVERIFIED)
- Figma 2025 seat prices (secondary): https://wise.com/sg/blog/figma-pricing (table dated 2025-04-15)
- Slack Enterprise Grid launch: https://venturebeat.com/ai/slack-expands-beyond-teams-to-entire-organizations-with-enterprise-grid (2017-01); Grid migrations: https://slack.engineering/maximum-warp-building-migrations-for-slack-enterprise-grid/ (undated, via excerpt)
- Slack subscriptions and features: https://slack.com/help/articles/115003205446-Slack-subscriptions-and-features (UNVERIFIED); Fair Billing Policy: https://slack.com/help/articles/218915077 (excerpt 2026-10-20); Audit Logs API: https://docs.slack.dev/admins/audit-logs-api/ (excerpt 2026-10-20); audit logs and anomalies: https://slack.engineering/slack-audit-logs-and-anomalies/
- Slack vs Mattermost deployment: https://slack.com/blog/compare/slack-vs-mattermost (vendor comparison, UNVERIFIED)
- Linear SAML, SCIM, audit log: https://linear.app/docs/saml-and-access-control ; https://linear.app/docs/scim ; https://linear.app/docs/audit-log (excerpts 2026-10-20, UNVERIFIED); agents: https://linear.app/blog/our-approach-to-building-the-agent-interaction-sdk ; https://linear.app/docs/agents-in-linear (2025); pricing: https://linear.app/pricing (see `pricing-packaging.md`, 2026-10-02)
- Notion managed users and identity settings: https://www.notion.com/en-gb/help/managed-users-dashboard (excerpt 2026-10-20, UNVERIFIED); plan features and guest limits (secondary, 2026): https://www.gend.co/blog/notion-pricing ; https://saascrmreview.com/notion-pricing/ ; growth analysis (secondary): https://sacra.com/research/notion
- Cursor Teams and Enterprise pricing: https://cursor.com/docs/account/teams/pricing ; https://cursor.com/pricing (UNVERIFIED); enterprise compliance and monitoring: https://cursor.com/docs/enterprise/compliance-and-monitoring ; privacy mode: https://cursor.com/help/security-and-privacy/privacy.md (UNVERIFIED); token rate (secondary): https://www.nops.io/blog/cursor-cost-management/ ; no on-prem (secondary, 2026): https://aireiter.com/blog/cursor-self-hosted-machines-privacy-review
- SSO tax prevalence (secondary): https://toolradar.com/reports/saas-feature-paywall-2026 (snapshot 2026-08); https://dev.to/topickz/the-sso-tax-report-2026-dfk (2026-06); https://sso.tax/
- GitLab Dedicated and data residency: https://docs.gitlab.com/17.2/ee/subscriptions/gitlab_dedicated (accessed 2026-10-20)
- Repo: `docs/18_editions.md`, `docs/19_council.md`, `docs/13_fleet_collaboration.md`, `packages/kernel/src/plans.ts`, `packages/server/src/auth.ts`, `packages/server/src/export.ts`, `apps/web/src/views/{Settings,Team,Project}.tsx`; earlier memos `docs/research/pricing-packaging.md` and `docs/research/identity-sso-device-trust.md` (both 2026-10-02)
