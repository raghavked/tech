# Business model

## Revenue lines, in order of appearance

1. **Nowcast and curve subscriptions** (phase 1-2). Daily (later intraday) settlement
   nowcasts with intervals for every listed index, the fair-value curve, spread analytics
   and the desk report. Tiers: research (report + CSV), desk (API + intraday), enterprise
   (redistribution and custom cost stacks).
2. **Hedging analytics for neo-clouds and colocation operators** (phase 2). Revenue-at-risk,
   settlement estimates for the months they can hedge, spark-spread and breakeven
   utilization by site, power cross-hedge sizing. Priced per site or per MW under
   management.
3. **Proprietary trading** (phase 3). Basis, calendar and cross-index spreads on CME and ICE
   compute futures with the desk's own capital; later market making.

## Unit economics (placeholders to validate)

- A single scraper fleet and store serves every subscriber; marginal cost per subscriber is
  support and data licensing.
- Index data licences (Silicon Data, Ornn, Bloomberg) are the main variable cost of the
  analytics line if published prints are redistributed; derived estimates avoid it.
- The desk's edge is information cost: the analytics line pays for the data that the desk
  trades on.

## Go-to-market

Listing day is the wedge. Every neo-cloud CFO will be asked about hedging in October 2026
and none has a settlement forecast. Offer the desk report free to ten design partners for
the first sixty live days in exchange for feedback and, where possible, transaction data,
then convert to paid pilots.

## What we will not do

Publish an index (conflict with forecasting it), run a venue, or take client money before
the paper track record and counsel's opinion exist.
