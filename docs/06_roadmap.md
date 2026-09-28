# Roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Offline vertical slice** (this repository) | Store, samples, synthetic world, standardization, nowcast with provider effects, supply stack and curve, six spread families, paper desk, desk report, Python SDK, CI | Everything runs offline in CI; e2e test green; live AWS connector demonstrated |
| **1. Live nowcast** (listing day onward) | Daily scrapes of 3+ real sources beyond AWS (SF Compute, Vast, RunPod, Lambda, Shadeform); real published prints once available; calibration on real data; intraday refresh; hosted store | 60 live days with 90% interval coverage >= 0.85 and MAPE < 6% on at least one settlement index; nowcast feed delivered to two design partners |
| **2. Analytics business** | Nowcast and curve API, desk report subscription, hedging analytics for neo-clouds (settlement estimate + spark spread + power hedge sizing); Parquet output and pyo3 bindings if latency demands; TypeScript dashboard | Two paying pilots; cost-stack inputs replaced by vendor quotes and colo contracts; contract specs verified |
| **3. Proprietary desk** | Real capital in CME/ICE compute futures, clearing relationship, execution and risk infrastructure, CTA/CPO analysis complete | Six months of paper Sharpe > 1 net of fills; risk committee sign-off; counsel opinion on registration |
| **4. Market making and power** | Two-sided quoting on compute futures; cross-hedging compute revenue with power at data-center hubs; optional public anchoring of nowcast history for auditability | Sustained share of open interest; hedging book with neo-cloud clients |

## Hiring

Phase 1: one data engineer (scrapers, store, scheduling), one quant (calibration, provider
effects, evaluation). Phase 2: one product engineer (API and dashboard), one energy-market
analyst (cost stack, power hubs). Phase 3: a trader with commodity futures experience and
a compliance lead.

## Model backlog (ordered)

1. Real-print calibration and evaluation dashboards.
2. Cross-price elasticities between GPU classes in the supply stack.
3. Financing constraints and residual-value curves for the fleet.
4. Intraday nowcast with recency weights (already parameterized).
5. Options and volatility surface once listed.
