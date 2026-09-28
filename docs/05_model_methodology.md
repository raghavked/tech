# Model methodology

Formulas as implemented in `crates/basis-model`. Parameters live in `config/`.

## 1. Standardization (`standardize.rs`)

Each observation is moved onto the index's reference specification with log-premium
tables (`config/standardization.toml`, values are `ln(price_config / price_reference)`):

```
ln p_std = ln p_raw - (prem[obs] - prem[ref])      for interconnect, term, region
```

Priors: PCIe -11% vs SXM, NVLink pods +5%; spot -20% vs on-demand; reserved 1/3/6/12/36
months at 0.92/0.87/0.82/0.75/0.65 of on-demand, interpolated in ln(months); regions
relative to US East (EU West +6%, APAC +8%). Reliability weight
`w = w_source x w_kind (transaction 1, list 0.6, bid/ask 0.4) x w_qty (min(q,64)/64, unknown 0.5) x w_interconnect`.
Observations outside an index's allowed tiers or listing kinds are dropped for that index.

## 2. Robust aggregation (`nowcast::aggregate`)

Per (index, date), in log space: weighted median `m`, `s = max(1.4826 x MAD, 0.05)`, drop
`|x - m| > k s` (k = 3, flag `outlier`); winsorize survivors at weighted 5th/95th
percentiles (flag `winsorized`); iterative provider cap (15-20% of weight) and tier caps
(hyperscaler 10%), flag `capped`; composite = weighted arithmetic mean of prices; weighted
median stored as a diagnostic.

## 3. Provider effects (`nowcast::ProviderEffects`)

Two-way fixed effects `ln p_{i,t} = a_t + b_i + e` estimated online without look-ahead:
prices enter day t's composite with `b_i` (known before t) removed; after the composite
`a_t` is known, `b_i <- (1 - gamma) b_i + gamma (ln p_{i,t} - a_t)` (gamma 0.2). A
provider seen for the first time initializes its effect and gets zero weight that day
(flag `new_provider`), so a hyperscaler list price at three times the market cannot move
the index on arrival. On synthetic data this took the nowcast from 15-23% MAPE and 40-66%
interval coverage to 4-6% MAPE and 82-85% coverage of the 90% interval.

## 4. Calibration and uncertainty

`I_hat = alpha + beta x composite`, OLS on the trailing 60 days of published prints strictly
before the nowcast day (identity if fewer than 20 points; slope guarded to (0.2, 5)).
Uncertainty by provider-cluster bootstrap (400 replicates, seeded per group) with the
calibration residual added in quadrature; analytic fallback when fewer than two providers.

## 5. Settlement forecasts (`nowcast::settlement_estimates`)

Daily forecast mean-reverts to the curve fair value: `I(d) = I_t e^{-lambda h} + FV (1 - e^{-lambda h})`,
`lambda = ln 2 / 30 days`. Daily volatility `sigma_eps` from published prints (60-day
trailing) or the estimate series.

- Final-day contract: `S = I(T)`, `Var = se_t^2 + sigma^2 (1 - e^{-2 lambda h}) / (2 lambda)`.
- Asian contract over N days with m remaining:
  `S = (sum realized + sum forecast) / N`,
  `Var = (m^2 se_t^2 + sigma^2 sum_i sum_j e^{-lambda |i-j|} (1 - e^{-2 lambda min(i,j)}) / (2 lambda)) / N^2`.
  With lambda -> 0 this is the random-walk result `sigma^2 m(m+1)(2m+1)/6 / N^2`, which a
  Monte Carlo test checks.

## 6. Supply stack (`supply.rs`)

Monthly. Fleet from shipment cohorts with 60-month life times sellable share; pipeline
additions `units = MW x 1000 / (TDP x overhead x PUE)` scaled by
`prob_complete x Phi((t - online - delay_mean) / delay_sd)`. Supply per (region -> hub, tier)
is split into cash-cost sellers (offered once price covers SRMC) and reservation-price
sellers (offered as `Phi((ln P - ln LRMC) / 0.5)`). Costs:

```
kWh/GPU-h    = TDP_kW x overhead x PUE
SRMC         = power + capacity                     (cash cost)
LRMC         = SRMC + capex/(life x 8760 x target util) + colo + opex
```

Demand `D = D0 x e^{g t/12} x (P / P0)^{-eps}` in H100-equivalent work (B200 at 2.25x
inference). Clearing by bisection; scarcity capped at 3x the ceiling. Outputs fair value,
cash floor, scarcity ceiling, supply, demand and utilization for 12 tenors. With the sample
assumptions: H100 front month $2.44-2.49 at 92-96% utilization against a $2.64 market; B200
$4.05-4.27 rising with demand growth. Documented limits: single elasticity, no cross-price
terms, no financing constraints.

## 7. Spreads (`spreads.rs`)

1. Basis: `F(T) - S_hat(T)`, z by settlement standard error.
2. Calendar: adjacent tenors vs curve differences; z on a 20-day window.
3. Cross-index: `F_CME - F_ICE - gap`, gap = trailing 60-day mean nowcast difference.
4. Cross-GPU: `F_B200 / 2.25 - F_H100` vs curve; founder numbers give
   `4.08 / 2.25 - 2.64 = -0.83` (B200 cheap per unit of work).
5. **Compute spark spread** per GPU class and hub:
   `full = P - power - capacity - (depreciation + colo + opex)`, `cash = P - power - capacity`,
   breakeven utilization `capex / (life x 8760 x (P - power - capacity - colo - opex))`.
   Worked example (unit test): H100 at $2.64, 700 W, 1.35 overhead, PUE 1.2 (1.134 kWh):
   $45/MWh hub full spread $1.248, $110/MWh hub $1.174, cross-hub $0.074; PJM capacity at
   $333.44/MW-day adds $0.016 per GPU-hour; breakeven utilization 32%. B200 at $4.08:
   $1.966 and $1.860.
6. Cross-hub spark: differences of full spreads between configured hub pairs.

## 8. Paper desk (`basis-trade`)

Sizing `qty = floor(0.01 x equity / (sigma x multiplier))`; entries at |z| > 2, exits at
|z| < 0.5 or three days before expiry; fills at settle plus 40 bps half-spread plus 2 bps
impact per contract (cap 100 bps), tick-rounded; volume participation 10%. Limits: 50
contracts per contract, $2M gross notional, 200k net GPU-hours per family, 2% daily loss
stop. Metrics: return, Sharpe (daily, 252), max drawdown, hit rate, turnover, fees, risk
events. On 400 synthetic days both strategies together are roughly flat after fees, which is
the expected outcome of plumbing validation on a synthetic world.
