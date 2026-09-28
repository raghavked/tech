# Basis

**The quant desk for GPU compute as a listed commodity.**

GPU compute futures list on CME (Silicon Data H100 and B200 rental indices) on 5 October
2026 and on ICE (Ornn Compute Price Index, Asian-style settlement). Spot is fragmented and
noisy, two rival indices will settle two rival contracts, and nobody has the fundamental
model. Basis is the intelligence layer for that market: a supply stack and fair-value
forward curve, a real-time settlement nowcast with calibrated uncertainty, a spread engine
including the **compute spark spread** against power costs at data-center hubs, and a paper
desk that trades the spreads under hard risk limits.

This repository is the phase-0 vertical slice: everything runs offline on committed
samples and a deterministic synthetic world, with one live connector (the AWS price list).
Docs are in [`docs/`](docs/), starting with the [one-pager](docs/00_thesis_one_pager.md).

> Paper trading only. Nothing here sends orders or holds money. Backtests on synthetic
> markets validate plumbing, not alpha. Contract specs are placeholders until verified.

## Quickstart (five minutes, no network)

```bash
cargo build --release -p basis-cli
export BASIS_OFFLINE=1
B=target/release/basis

$B --store ./store pipeline --synth-days 400      # ingest samples, synthesize a world, standardize,
                                                  # curve, nowcast (with evaluation), spreads, backtest, report
cat store/reports/*/desk_report.md                # eight sections: nowcasts, settlements, curve, spreads,
                                                  # spark spreads by hub, positions and P&L, signals, data quality
$B --store ./store ledger --tail 20
$B --store ./store store ls
```

Live AWS prices (needs egress to `pricing.us-east-1.amazonaws.com`; streams ~480 MB with
bounded memory):

```bash
unset BASIS_OFFLINE
$B aws fetch --region us-east-1 --out aws_gpu.csv     # p5.48xlarge $55.04/h = $6.88 per H100-hour on 2026-09-25
$B --store ./store ingest --source aws                # append the rows and derived observations
```

Python:

```bash
cd python && uv sync --all-extras --dev
uv run python -c "from basis_research import Store; s=Store('../store'); print(s.estimates().tail()); print(s.report()[:400])"
```

## Commands

| Command | Purpose |
|---|---|
| `basis ingest --source sample\|aws` | load committed samples or the AWS price list into the store |
| `basis synth [--days N] [--tiny]` | deterministic synthetic providers, prints, power and futures |
| `basis standardize` | move observations onto each index's reference spec, flag outliers |
| `basis curve` | supply stack to fair-value forward curve |
| `basis nowcast [--evaluate]` | index nowcasts with intervals, settlement forecasts, accuracy vs prints |
| `basis spreads` | basis, calendar, cross-index, cross-GPU, spark and cross-hub spark spreads |
| `basis backtest` | paper desk with risk limits, modelled fills and an exact ledger |
| `basis ledger`, `basis report` | inspect the book; write the desk report |
| `basis aws fetch`, `basis store ls\|verify`, `basis pipeline` | connector, store inspection, everything at once |

Global flags: `--store`, `--config`, `--seed`, `-v`. Exit codes: 0 ok, 2 config, 3 data,
4 network blocked. `BASIS_OFFLINE=1` blocks every live fetch.

## Repository map

```
crates/basis-core        types, content-addressed CSV store, stats, PRNG, config
crates/basis-connectors  sample loader, synthetic generator, streaming AWS parser, vendor stubs
crates/basis-model       standardization, nowcast, supply stack, curve, spreads
crates/basis-trade       strategies, risk, fills, Decimal ledger, backtest, metrics, report
crates/basis-cli         the `basis` binary
config/                  indices, contracts (TO VERIFY), cost stack, standardization, supply, risk, strategies
data/samples/            committed synthetic samples (pinned by manifest); data/fixtures/ connector fixtures
schemas/datasets.toml    column contract shared by Rust and Python tests
python/                  basis-research: pandas access to the store
scripts/                 gen_samples.py, e2e.sh, make_python_fixture.sh
docs/                    thesis, market primer, landscape, product spec, architecture, methodology,
                         roadmap, regulatory notes, business model, threat model, data sources, open questions
```

## Development

```bash
make ci        # fmt, clippy -D warnings, tests, python lint and tests, e2e
make demo      # full pipeline into ./store
```

Tests run offline; the one live test is `cargo test -p basis-connectors --features live -- --ignored aws_live`.

## Status and licence

Phase 0 complete (see `docs/06_roadmap.md`). Licence not yet chosen; all rights reserved
until the founder decides.
