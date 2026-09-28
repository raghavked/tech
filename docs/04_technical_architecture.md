# Technical architecture

## Crates

```
basis-core        domain types (types.rs), ids (keys.rs), content-addressed CSV store (store.rs),
                  statistics (stats.rs), deterministic PRNG (rng.rs), TOML config (config.rs)
basis-connectors  Source trait (fetch/parse split); sample loader; synthetic generator;
                  streaming AWS price-list parser; vendor stubs (feature `vendors`); `live` feature
basis-model       standardize.rs, nowcast.rs (aggregation, provider effects, calibration,
                  bootstrap, settlement forecasts), supply.rs (cost stack, fleet, clearing),
                  curve.rs, spreads.rs
basis-trade       strategy.rs (Strategy trait, snapshot), strategies/{basis_mr,cross_index}.rs,
                  risk.rs, fills.rs, ledger.rs (Decimal book), backtest.rs, metrics.rs, report.rs
basis-cli         `basis` binary: ingest, synth, standardize, nowcast, curve, spreads, backtest,
                  ledger, report, aws, store, pipeline
python/           basis-research: pandas access to the store via the shared column contract
```

Dependency direction: `core <- connectors, model, trade <- cli`. Total direct dependencies
stay around fifteen; no async runtime except transitively behind the `live` feature.

## Data flow

```
data/samples ──ingest──┐
basis synth ───────────┼──> store/raw/<dataset>/part-<sha12>.csv  (immutable, hash-named)
AWS price list ─aws────┘              │
                                      ▼
                          standardize ──> derived/standardized.csv
                                      │
      supply assumptions + power ──> curve ──> derived/curve.csv
                                      │
                          nowcast ──> derived/estimates.csv, derived/settlements.csv
                                      │
      futures + power + cost stack ──> spreads ──> derived/spreads.csv
                                      │
                          backtest ──> derived/{signals,positions,ledger,equity}.csv
                                      │
                          report ──> reports/<date>/{desk_report.md, summary.csv, ...}
```

## The store

`store/manifest.json` lists datasets and parts with sha256, row counts and date ranges.
Appending identical content produces the same part name and is skipped, so re-ingesting is
idempotent and every raw input is reproducible by hash. Derived datasets are overwritten by
the producing step. `basis store verify` re-hashes every part.

## The column contract

`schemas/datasets.toml` names every column of every dataset. `crates/basis-core/tests/schema.rs`
serializes one record of each Rust type and asserts the CSV header equals the schema;
`python/tests/test_store.py` loads the schema and the fixture store. A column change must
touch both sides.

## Numerics

Model math is `f64`; cash, fees, P&L and notionals in the ledger are `rust_decimal::Decimal`.
Fill prices are tick-rounded Decimals. The PRNG is xoshiro256** seeded through SplitMix64
with labelled sub-streams, so any step is bit-reproducible for a seed and independent of
unrelated code paths.

## Trust boundaries and no-look-ahead

- The nowcast for day t uses observations of day t, provider effects learned from days
  before t, and calibration on prints strictly before t.
- The backtester hands each strategy a snapshot of day t only; fills use day t settles with
  modelled slippage; expiries settle on prints.
- Synthetic futures include scripted mispricings; every output labels synthetic markets.

## Live connectors

`basis-connectors::aws` streams the regional price list (hundreds of MB) through a serde
visitor with bounded memory and a byte cap, keeping only GPU instance products and their
on-demand terms. Vendor parsers are fixture-tested and marked `SHAPE_UNVERIFIED`;
`BASIS_OFFLINE=1` blocks every live fetch (set in CI).

## CI

`.github/workflows/ci.yml`: `rust` (fmt, clippy `-D warnings` with all features, tests),
`python` (uv sync, ruff, pytest), `e2e` (release build, `scripts/e2e.sh`, report artifact).
Everything runs offline on committed samples and synthetic data.
