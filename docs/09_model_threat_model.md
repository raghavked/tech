# Model threat model

What can make the nowcast, curve or desk wrong, and what the code does about it.

| Threat | Effect | Mitigation in phase 0 | Still open |
|---|---|---|---|
| Index methodology change (tier weights, term normalization, publication calendar) | Calibration drifts; settlement forecasts biased | Rolling 60-day calibration with slope guard; `--evaluate` coverage tracking; methodology fields in config | Alerting on coverage breaks; per-index methodology version tags |
| Composition shifts (providers appearing or disappearing) | Composite jumps without market change | Online provider effects; new providers excluded on first day; provider and tier caps | Effects decay for providers absent for long periods |
| Marketplace data poisoning (fake listings, wash quotes) | Level and dispersion distorted | Weights by listing kind and quantity; MAD trim; winsorization; provider cap 15-20%; concentration in the data-quality section | Cross-source corroboration; reputation scores per provider |
| Single-source dominance (today: AWS is the only live source) | Nowcast reflects one tier | Hyperscaler tier cap 10%; report flags top-provider weight | More sources (phase 1) |
| Stale or missing sources | Silent degradation | Data-quality section lists stale sources; minimum observations per day | Automated freshness alerts |
| Regime shifts (Blackwell transition, hyperscaler repricing) | Mean-reversion strategies lose | Calendar and cross-GPU spreads carry curve fair values; daily loss stop; sizing by uncertainty | Regime detection; parameter re-estimation cadence |
| Cost-stack input error | Spark-spread levels wrong | Inputs are explicit config with a worked-example test; documented as priors | Vendor quotes and colo contracts as inputs |
| Look-ahead bias in research | Overstated skill | Calibration and effects use strictly prior data; strategies see one-day snapshots; expiries settle on prints | Time-travel tests on real data |
| Synthetic-data overfitting | False confidence | Scripted mispricings documented; every output labels synthetic markets | Live evaluation is the only cure |
| Contract spec mismatch (multiplier, settlement rule, calendar) | Wrong sizing and P&L | `to_verify = true` flags in config; report banner | Verify against rulebooks before any real order |
| Reproducibility | Cannot audit an estimate | Content-addressed parts; seeded PRNG streams; `basis store verify` | Signed manifests (optional, phase 4) |
