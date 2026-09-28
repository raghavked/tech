# Basis: the quant desk for GPU compute as a commodity

*One-pager. Working codename "Basis" (as in futures basis). Market facts are founder notes
gathered 25-28 September 2026 and must be re-verified before external use; see
`10_data_sources.md` for sources.*

## The thesis in one line

GPU compute is becoming a listed commodity in October 2026. Nobody has the fundamental
supply/demand model, the real-time settlement nowcast, or the link to power markets that
every other financialized commodity eventually got. Basis builds that intelligence layer
first and trades on it second.

## What just changed

- **CME Group lists compute futures on 5 October 2026**: Silicon Data H100 Rental Index
  futures and B200 Rental Index futures, cash-settled on daily indices built from millions
  of rental observations. **ICE lists futures on the Ornn Compute Price Index** (printed
  transactions, Asian-style settlement). A third venue (Architect) is announced.
- **Spot is chaotic.** H100 quotes ranged from $0.72 to $15.14 per GPU-hour across 24
  marketplaces in a single day. Hyperscaler on-demand is $6.88 per H100-hour on AWS today
  (p5.48xlarge, live price list) while boutique clouds quote $1.4-2.9. Two rival indices
  will settle two rival contracts on the same physical market.
- **The physical link to power is direct.** A GPU-hour costs `TDP x overhead x PUE x $/kWh`
  in electricity plus depreciation, colocation and opex. PJM capacity prices went from
  $28.92 to $333.44 per MW-day; ERCOT large-load requests exceed 230 GW, most of it data
  centers. No product computes the resulting **compute spark spread**.

## The insight

When power, gas and oil were financialized, the durable businesses were the ones that
built physical intelligence (Genscape, Kpler, Yes Energy) and the trading desks that used
it. Index providers publish prices; they do not model supply and demand, and as settlement
agents they cannot trade. The gap is the same here, and it is open for roughly one year
before incumbents notice.

## The product, three pillars

1. **Supply stack.** A bottom-up model of GPU-hour supply (installed fleet by class and
   region, pipeline additions timed by interconnect delays, cash-cost and reservation-price
   sellers) and demand (H100-equivalent work with growth and elasticity), cleared monthly
   into a fair-value forward curve with a cash-cost floor and a scarcity ceiling.
2. **Nowcast.** Every marketplace, cloud and colocation quote standardized onto each index's
   reference spec, cleaned (MAD trim, winsorization, provider and tier caps), corrected for
   persistent provider effects, calibrated to published prints without look-ahead, with
   bootstrap uncertainty and settlement-window forecasts for Asian and final-day contracts.
3. **Spread engine and paper desk.** Basis, calendar, cross-index (Silicon Data vs Ornn),
   performance-adjusted cross-GPU (B200 vs H100), the compute spark spread by power hub, and
   cross-hub spark spreads; two mean-reversion strategies run under hard risk limits in a
   paper book with an exact ledger and a daily desk report.

## Why now and why us

The contracts list in days; the data is public but ugly; the models are energy-market
methods applied to a market that has no energy-market veterans yet. This repository is a
runnable vertical slice of all three pillars with tests and CI.

## Who pays

- Neo-clouds and colocation operators hedging rental revenue (need settlement nowcasts and
  spark-spread analytics).
- AI labs and inference companies hedging compute cost (need the forward curve).
- Futures market makers and prop desks (need the nowcast feed and cross-index gap).
- Later: the desk itself, trading basis and cross-index spreads with proprietary capital.

## Twelve-month goal

Three live data sources beyond AWS, a nowcast that covers 85%+ of published prints inside
its 90% interval over 60 live days, two paying analytics pilots, and six months of paper
trading with a Sharpe above 1 net of modelled fills before any real capital.

## Moat

Data assembly (dozens of scrapers with provider-effect history), the calibrated cost stack,
and the track record of settlement nowcasts against real prints. None of it is a secret;
all of it takes a year of daily grind that starts on listing day.
