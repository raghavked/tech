# Data sources

## Reachability from the development sandbox (probed 25-28 September 2026)

| Source | Type | Status here | Connector |
|---|---|---|---|
| AWS EC2 price list (`pricing.us-east-1.amazonaws.com`) | hyperscaler list prices, JSON, ~480 MB per region | **reachable**, streamed in ~7 s | `basis aws fetch`, `basis ingest --source aws` (live) |
| Silicon Data indices | published prints | blocked | fixture parser `SHAPE_UNVERIFIED` |
| Ornn OCPI | published prints | blocked | fixture parser `SHAPE_UNVERIFIED` |
| SF Compute | spot exchange | blocked | not started |
| Vast.ai bundles API | marketplace listings | blocked | fixture parser `SHAPE_UNVERIFIED` |
| RunPod GraphQL | cloud prices | blocked | fixture parser `SHAPE_UNVERIFIED` |
| Lambda instance types | neo-cloud prices | blocked | fixture parser `SHAPE_UNVERIFIED` |
| Akash, Shadeform, Compute Exchange | marketplaces | blocked | not started |
| Azure retail prices, GCP pricing | hyperscaler | blocked | not started |
| EIA, ERCOT, gridstatus | power prices | blocked | synthetic hub prices only |
| CME, ICE contract specs | rulebooks | blocked | placeholders in `config/contracts.toml` |

Committed samples under `data/samples/` are synthetic, anchored to public price levels;
`data/fixtures/` holds connector fixtures. Live AWS numbers on 2026-09-25 (us-east-1,
Linux, shared, on-demand): p4d.24xlarge $21.96/h ($2.74 per A100-40 hour), p4de.24xlarge
$27.45/h, p5.48xlarge $55.04/h ($6.88 per H100-hour), p5.4xlarge $6.88/h, p5en.48xlarge
$63.30/h ($7.91 per H200-hour), p6-b200.48xlarge $113.93/h ($14.24 per B200-hour).

## Public reporting used for the market facts (to re-verify)

- CME Group press releases, 12 May and 11 August 2026: compute futures with Silicon Data,
  launch 5 October 2026.
- Intercontinental Exchange press release, May 2026: GPU compute futures with Ornn;
  Markets Media, Investing.com and TheNextWeb coverage of the Asian-style settlement.
- Axios, 6 July 2026: Ornn and compute as a commodity. CNBC, 16 June 2026: "The new oil?".
- Silicon Data product pages and IEEE Spectrum on the daily GPU rental index.
- Dave Friedman, "Compute Derivatives Market Primer" (Substack).
- Compute Exchange, Spheron and DailyDropout coverage of GPU marketplaces and the 21x
  intraday dispersion.
- Exponential Industry, "NVIDIA H100 compute price forecast, August 2026".
- Goldman Sachs estimate of ~$7.6T compute/power/data-center investment 2026-2031.
- PJM capacity auction results and ERCOT large-load interconnection figures as reported in
  data-center power coverage (Texas Electric Broker, GPU Insights, ClusterBid).
- Bloomberg, 3 September 2026, on DeepMind's hourly weather model for power markets
  (context for the power link).

Every figure above is a founder note captured from search summaries and should be checked
against the primary document before it appears in external material.
