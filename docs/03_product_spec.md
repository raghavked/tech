# Product specification (phase 0)

## Personas

- **Hedger** (neo-cloud CFO, colocation operator, AI lab infra lead): wants tomorrow's and
  this month's settlement value with an interval, and the forward curve to price a hedge.
- **Trader** (futures market maker, commodity fund, prop desk): wants the nowcast feed, the
  cross-index gap, the basis z-scores and the spark spreads, daily and eventually intraday.
- **Analyst** (internal, later customers' quants): wants the raw and standardized data, the
  model outputs and the paper ledger in pandas.

## User journeys

1. Morning desk run: `basis pipeline` (or the individual steps) ingests overnight data,
   standardizes, rebuilds the curve, nowcasts every index, computes spreads, advances the
   paper book and writes `reports/<date>/desk_report.md`.
2. Hedge pricing: read section 2 (settlement estimates) and section 3 (curve vs fair
   value) of the report; the analyst pulls `Store(...).settlements()` for the interval.
3. Research: `from basis_research import Store` in a notebook; every dataset is a typed
   DataFrame with the same column contract the Rust code enforces.

## The three pillars, as shipped in this repository

| Pillar | Command | Output |
|---|---|---|
| Supply stack and forward curve | `basis curve` | `derived/curve.csv`: fair value, cash floor, scarcity ceiling, supply, demand, utilization per GPU class and monthly tenor |
| Nowcast | `basis standardize`, `basis nowcast [--evaluate]` | `derived/standardized.csv`, `derived/estimates.csv`, `derived/settlements.csv`; MAE/RMSE/coverage vs prints |
| Spreads and paper desk | `basis spreads`, `basis backtest`, `basis ledger`, `basis report` | `derived/spreads.csv`, `derived/{signals,positions,ledger,equity}.csv`, `reports/<date>/` |

Data: `basis ingest --source sample` (committed synthetic samples), `basis synth`
(deterministic synthetic world), `basis aws fetch` / `basis ingest --source aws` (live AWS
price list, the only live source reachable in the development sandbox).

## Mandate language for the desk (risk.toml)

Starting equity, per-contract position cap, gross notional cap, net GPU-hours per GPU
family, daily loss stop (flatten next day, block entries), forced exit N days before expiry,
sizing constant kappa (equity fraction per one-sigma move). All enforced by the risk engine
before any fill; every shrink or rejection is a ledger row.

## Report and ledger semantics

- The ledger is exact (`Decimal`); `cash_after + unrealized == equity_after` on every row.
- Fills carry modelled slippage (half-spread plus impact, tick-rounded) and fees.
- Expiring contracts cash-settle at the final index value from prints (average over the
  tenor for Asian contracts), with the last futures settle as fallback.
- Every report and backtest output states that results are hypothetical and, when futures
  come from `basis synth`, that they validate plumbing rather than alpha.

## Non-goals for phase 0

Real orders, exchange connectivity, client money, intraday nowcasts, options, a web
dashboard, WASM or sandboxed strategy hosting, on-chain anything.

## CLI reference

See `README.md` for the quickstart and `basis --help` for every flag. Exit codes: 0 ok,
2 configuration error, 3 data error, 4 network blocked or HTTP failure.
