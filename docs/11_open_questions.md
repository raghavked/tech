# Open questions

## Contract specifications (blocking before any real order)

- CME Silicon Data futures: contract multiplier, tick size, listed months, last trading day,
  final settlement rule (final daily index value or monthly average), publication calendar
  (calendar vs business days), time zone of the index day.
- ICE Ornn futures: same, plus the exact Asian averaging window and which OCPI series
  settles which contract.
- Fees, margin and position limits at both venues.

## Index methodology

- SDH100RT tier weights and term normalization; whether hyperscaler list prices enter at
  list or at negotiated levels; outlier rules; revision policy.
- OCPI transaction filters, volume weighting and revision policy.
- Availability and licensing of historical prints for calibration.

## Cost stack and supply assumptions

- Per-GPU server capex by class (currently $32k H100, $50k B200 placeholders), useful life,
  target utilization, colocation rates by hub, PUE by tier.
- Fleet cohorts and sellable shares (currently synthetic), pipeline projects and delays,
  demand levels, growth and elasticity (currently tuned so the sample curve sits near the
  market).

## Strategy and risk

- Whether rejected intents should be logged as signals; currently only fills become signals
  and rejections are risk events.
- Family definition for the net GPU-hour limit (currently by GPU class).
- Roll methodology near expiry (currently forced exit three days before).

## Data

- Which marketplace APIs are usable under their terms; whether SF Compute exposes prints.
- Power price sources per hub and whether capacity charges should be time-varying.

## Product

- Whether the first paid product is the report, the API, or hedging analytics.
- Licence for the repository (undecided; see README).
