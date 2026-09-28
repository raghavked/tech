# Regulatory notes

**This document is not legal advice.** It lists the questions to put to counsel before each
phase. Nothing in this repository sends orders, holds client money, or advises anyone.

## Phase 0 (now): paper trading and internal research

- No customer funds, no advice to third parties, no orders. No registration trigger is
  expected, but confirm with counsel that internal paper results are not "performance
  advertising".
- Any attested backtest shown to a prospect is marketing. In the US, the SEC Marketing Rule
  (206(4)-1) conditions apply to hypothetical performance shown by investment advisers, and
  CFTC Rule 4.41 requires the hypothetical-results disclaimer for commodity trading
  advisers; the CLI and report print a hypothetical-performance line for that reason.

## Phase 1-2: selling analytics

- Selling nowcasts, curves and reports is data and analytics, not advice, if it is
  impersonal and not tailored to a client's positions. Tailored hedge recommendations on
  commodity futures may make Basis a commodity trading adviser (CTA) under the Commodity
  Exchange Act, subject to CFTC registration and NFA membership unless an exemption applies.
- Index data licensing: redistributing Silicon Data, Ornn or Bloomberg values requires
  licences; store and publish derived estimates, not licensed prints, unless licensed.
- Scraped marketplace data: respect terms of service and robots directives; prefer official
  APIs; keep provenance (the store records source and raw reference per row).

## Phase 3: trading proprietary capital

- Proprietary trading of listed futures needs a futures commission merchant relationship,
  exchange market data agreements, and position-limit and large-trader reporting awareness.
- If outside capital is pooled, commodity pool operator (CPO) rules apply.
- EU/UK: MiFID II and MiCA do not obviously apply to cash-settled compute futures traded on
  US exchanges, but any European client-facing analytics or hedging advice should be
  reviewed under local rules.

## Phase 4: market making and power

- Market-maker programs carry exchange obligations; hedging clients' compute revenue with
  power products adds FERC/ERCOT market participation questions.

## Data and model governance

- Keep an audit trail of every nowcast (the store already does) so a published estimate
  can be reproduced from the parts that fed it.
- Document methodology changes and their effective dates; settlement-relevant estimates
  should never be revised silently.
