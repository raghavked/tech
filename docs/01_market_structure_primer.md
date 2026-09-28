# Market structure primer: GPU compute as a commodity

*Founder notes, September 2026. Contract details marked TO VERIFY are placeholders in
`config/contracts.toml` until checked against the exchange rulebooks.*

## The underlying: a GPU-hour

The unit is one hour of one accelerator (H100, H200, B200, later B300/GB200) with an
implicit bundle: interconnect (PCIe vs SXM/NVLink), host CPU and memory, storage,
networking, region, term (on-demand, spot, reserved), provider tier and reliability. Two
"H100-hours" can differ by 20x in price because the bundle differs; standardization is
the first job of any index or nowcast.

Compute has no storage and no carry: an idle GPU-hour is lost. That makes it closer to
electricity than to oil. Supply is quasi-fixed in the short run (installed fleet), slow to
add (power interconnection, delivery lead times), and depreciates on a 4-6 year curve.

## Indices

| Index | Publisher | Method (as understood) | Settles |
|---|---|---|---|
| SDH100RT, SDB200RT | Silicon Data | Daily standardized like-for-like rate from ~3.5M observations across neo-clouds, hyperscalers, colocation and private rentals; outliers removed; separate neo-cloud and hyperscaler readings; on Bloomberg | CME futures |
| OCPI (H100, H200, B200, RTX 5090) | Ornn | Built from printed transactions rather than quotes; real-time per-hour rates; published methodology | ICE futures |

Structural facts that matter for trading:

- SD-style indices blend list prices (including hyperscaler list prices several times the
  neo-cloud level); OCPI-style indices use transactions. Their gap is a methodology spread,
  not an arbitrage, and it moves when the tier mix moves.
- Composition changes (which providers quote today) can move a naive composite by percent
  points with no change in the market. Provider-effect models are essential.
- Index publishers are conflicted as settlement agents and will not sell forecasts.

## Contracts (TO VERIFY)

| Exchange | Contract | Settlement | Notes |
|---|---|---|---|
| CME | Silicon Data H100 Rental Index futures | cash; final index value (assumed) | launch 5 Oct 2026 pending review |
| CME | Silicon Data B200 Rental Index futures | cash; final index value (assumed) | same |
| ICE | Ornn Compute Price Index futures | cash; **Asian-style** average of daily index values over the tenor | USD; H100 first |
| Architect | compute futures | announced | new US exchange |

Placeholders in `config/contracts.toml`: multiplier 1,000 GPU-hours, tick 0.001, fee $1.50,
six listed months. Asian settlement changes everything about hedging and nowcasting: the
settlement value is known progressively, so the forecast variance shrinks through the month
(see `05_model_methodology.md`).

## Spot venues

- Hyperscalers (AWS, Azure, GCP, OCI): list prices, rarely transacted at list for scale
  buyers; AWS publishes a machine-readable price list (the one live source this repo uses).
- Neo-clouds (CoreWeave, Lambda, Crusoe, Nebius, Together, Fluidstack): list and contract.
- Marketplaces (SF Compute, Vast.ai, RunPod, Akash, Compute Exchange, Shadeform): the
  price-discovery layer, thin and noisy, 21x intraday dispersion observed.
- Colocation and private brokers: transaction-level, opaque, large.

## Price history (founder notes)

H100: ~$8 per hour in early 2024, $1.96 late 2025, $2.64 April 2026, ~$2.74 August 2026 on
the Ornn composite. Blackwell (B200): $2.75 to $4.08 between mid-February and mid-April 2026
(+48%). AWS raised H100 instance prices 15% in 2026. Polymarket runs markets on H100 rental
prices.

## Who hedges, who speculates

- Natural shorts: neo-clouds and colocation operators with rental revenue and fixed capex;
  GPU lessors and lenders with residual-value exposure.
- Natural longs: AI labs and inference businesses with compute cost; enterprises with
  committed AI budgets.
- Speculators: commodity funds, power traders (the spark-spread crowd), crypto-native
  market makers.

## The power link

Per GPU-hour: `kWh = TDP_kW x server overhead x PUE`; power cost = kWh x $/MWh / 1000;
capacity cost = kWh x $/MW-day / 24 / 1000. H100 at 700 W with 1.35 overhead and PUE 1.2
draws 1.134 kWh per GPU-hour: $0.05 at $45/MWh, $0.12 at $110/MWh. Today power is 2-5% of
the H100-hour price and the spread is capex-dominated; it becomes decisive at the bottom of
the cycle (shutdown threshold) and for 1.4 kW-class parts in $100+/MWh hubs with capacity
charges. That is exactly where supply-side signals will come from.
