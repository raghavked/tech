# Competitive landscape

*Founder notes, September 2026; claims about third parties are from public reporting and
must be re-verified before external use.*

| Who | What they do | What they verify or model | Holds capital? | Gap for Basis |
|---|---|---|---|---|
| Silicon Data | Daily GPU rental indices (SDH100RT, SDB200RT), on Bloomberg; CME settlement agent | Standardized prices from ~3.5M observations | No | Publishes prices, not supply/demand; cannot forecast or trade its own settlement |
| Ornn | Compute Price Index from printed transactions; ICE settlement agent; $5.7M seed (Oct 2025) | Transaction prices, methodology published | No | Same conflict; index is the product, not the model |
| SF Compute | Spot exchange for compute, unbundled from software | Order book | No | Venue, not analytics |
| Compute Exchange | Secondary GPU marketplace (H100/A100 demand) | Listings | No | Venue |
| Vast.ai, RunPod, Akash, Shadeform | Marketplaces and aggregators | Listings | No | Data sources for Basis |
| Exponential Industry style forecasters | Narrative H100 price outlooks | Trend commentary | No | No settlement nowcast, no cost stack, no uncertainty |
| Polymarket | Event contracts on H100 rental price levels | Crowd probability | Traders | Signal source and a venue for the same edge |
| Energy analogs: Genscape, Kpler, Yes Energy, EnAppSys | Physical intelligence and analytics for power, gas, oil, shipping | Supply, flows, outages, curves | No (some prop desks grew from them) | The playbook Basis copies for a new commodity |
| Commodity trading houses and power desks | Will eventually trade compute futures | Their own models, later | Yes | They are the future customers and the eventual competition; they are not here in 2026 |

## Positioning

Basis is the neutral intelligence layer that owns neither an index nor a venue. It sells
what index publishers cannot (forecasts of their own settlement), what venues do not have
(the supply stack), and what forecasters lack (calibrated uncertainty and a link to power).
The paper desk is the proof that the models are tradable; real capital follows the track
record, not the other way round.

## Defensibility over time

1. Year one: data assembly and provider-effect history nobody else has collected daily.
2. Year two: a public track record of settlement nowcasts against real prints, sold to
   hedgers and market makers.
3. Year three: the desk, with a cost of information far below any newcomer's.

What is not defensible: the formulas. They are standard energy-market methods; the docs say
so. The moat is the data and the record.
