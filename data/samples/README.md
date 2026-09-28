# Sample datasets

Everything in this directory is **synthetic**, generated deterministically by
`scripts/gen_samples.py` (seed 20260925) and pinned by `manifest.json`. Price levels are
anchored to public September 2026 reports (see `docs/10_data_sources.md`) but no row is a
real quote. They exist so the pipeline, tests and CI run with no network access.

| Path | Rows | Purpose |
|---|---|---|
| `observations/obs_2026-09.csv` | ~600 | 24 providers, 5 GPU classes, 6 regions, 1-25 Sep 2026 |
| `index_prints/prints.csv` | 100 | stand-ins for published SDH100RT / SDB200RT / OCPI prints |
| `power/hub_prices.csv` | 100 | daily $/MWh (+ capacity $/MW-day) for four hubs |
| `futures/curve.csv` | 400 | daily settles, 2 exchanges x 2 GPU classes x 4 tenors |
| `assumptions/*.csv` | small | supply-stack v0 priors (fleet cohorts, pipeline, demand, perf) |

Regenerate with `python3 scripts/gen_samples.py`; the Rust test `sample_manifest_pins`
fails if the committed files drift from the manifest.
