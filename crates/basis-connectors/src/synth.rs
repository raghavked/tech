//! Deterministic synthetic market generator.
//!
//! Produces a coherent world: a latent daily log-price per GPU class driven by a
//! regime-switching Ornstein-Uhlenbeck process with jumps, many providers quoting
//! around it with tier multipliers, sticky quotes, noise and planted outliers, two
//! styles of published index prints, hub power prices and futures settles with a few
//! scripted mispricing episodes. The episodes exist so the backtester has something
//! to catch; they are plumbing, not alpha, and every consumer says so.

use std::collections::BTreeMap;

use basis_core::keys::{ContractId, IndexId, Tenor};
use basis_core::rng::Rng;
use basis_core::types::*;
use time::{Date, Duration, Month, OffsetDateTime, Time};

use crate::error::{ConnectorError, Result};

#[derive(Debug, Clone)]
pub struct SynthConfig {
    pub seed: u64,
    pub start: Date,
    pub days: u32,
    pub gpus: Vec<GpuClass>,
    pub providers_per_tier: usize,
    pub listed_months: u32,
}

impl SynthConfig {
    pub fn new(seed: u64, start: Date, days: u32) -> Self {
        SynthConfig {
            seed,
            start,
            days,
            gpus: vec![GpuClass::H100, GpuClass::B200],
            providers_per_tier: 6,
            listed_months: 6,
        }
    }

    pub fn tiny(seed: u64, start: Date) -> Self {
        SynthConfig {
            providers_per_tier: 2,
            days: 45,
            ..Self::new(seed, start, 45)
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct SynthOutput {
    pub observations: Vec<PriceObservation>,
    pub index_prints: Vec<IndexPrint>,
    pub power: Vec<PowerPrice>,
    pub futures: Vec<FuturesQuote>,
    /// Latent "true" price per GPU per day, for evaluation only (not stored).
    pub latent: BTreeMap<(GpuClass, Date), f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Regime {
    Glut,
    Balanced,
    Squeeze,
}

fn regime_means(gpu: GpuClass) -> [f64; 3] {
    match gpu {
        GpuClass::H100 => [1.9, 2.6, 3.8],
        GpuClass::H200 => [2.5, 3.3, 4.6],
        GpuClass::B200 => [3.0, 4.1, 5.6],
        GpuClass::B300 => [3.8, 5.0, 6.8],
        GpuClass::A100_80 => [0.9, 1.3, 1.9],
        GpuClass::RTX5090 => [0.45, 0.65, 0.95],
        _ => [1.0, 1.5, 2.2],
    }
}

/// Daily regime transition probabilities (rows: from, cols: to).
const TRANSITION: [[f64; 3]; 3] = [
    [0.985, 0.014, 0.001],
    [0.008, 0.984, 0.008],
    [0.001, 0.014, 0.985],
];

const THETA: f64 = 0.05;
const SIGMA: f64 = 0.02;
const JUMP_P: f64 = 0.01;
const JUMP_SD: f64 = 0.15;

struct Provider {
    name: String,
    tier: ProviderTier,
    mult: f64,
    bias: f64,
    stickiness: f64,
    noise: f64,
    transaction_p: f64,
    regions: Vec<Region>,
    interconnect: Interconnect,
    source_kind: &'static str,
    last_quote: BTreeMap<GpuClass, f64>,
}

fn tier_params(t: ProviderTier) -> (f64, f64, f64, f64, &'static str) {
    // (multiplier, stickiness, noise, transaction probability, source label)
    match t {
        ProviderTier::Hyperscaler => (2.8, 0.95, 0.01, 0.0, "hyperscaler_list"),
        ProviderTier::NeoCloud => (1.0, 0.7, 0.04, 0.4, "neo_cloud"),
        ProviderTier::Marketplace => (0.85, 0.5, 0.08, 0.5, "marketplace"),
        ProviderTier::Colo => (1.05, 0.8, 0.03, 0.9, "colo"),
        ProviderTier::Private => (0.95, 0.6, 0.05, 0.9, "private"),
    }
}

fn hub_mean(h: Hub) -> (f64, Option<f64>) {
    match h {
        Hub::PjmDominion => (110.0, Some(333.44)),
        Hub::ErcotWest => (45.0, None),
        Hub::ErcotNorth => (60.0, None),
        Hub::MisoNorth => (38.0, Some(30.0)),
    }
}

/// Index styles generated: (id, gpu, exchange, level multiplier vs latent, print noise).
fn index_styles(gpus: &[GpuClass]) -> Vec<(IndexId, GpuClass, Exchange, f64, f64)> {
    let mut v = Vec::new();
    for g in gpus {
        let (sd, ocpi) = match g {
            GpuClass::H100 => ("sdh100rt", "ocpi_h100"),
            GpuClass::B200 => ("sdb200rt", "ocpi_b200"),
            _ => continue,
        };
        v.push((IndexId::new(sd), *g, Exchange::Cme, 1.03, 0.010));
        v.push((IndexId::new(ocpi), *g, Exchange::Ice, 0.97, 0.008));
    }
    v
}

pub fn generate(cfg: &SynthConfig) -> Result<SynthOutput> {
    if cfg.days == 0 {
        return Err(ConnectorError::Parse("days must be > 0".into()));
    }
    let root = Rng::seed_from_u64(cfg.seed);
    let mut out = SynthOutput::default();

    // 1. Latent paths.
    let mut latent: BTreeMap<GpuClass, Vec<f64>> = BTreeMap::new();
    for g in &cfg.gpus {
        let mut r = root.derive(&format!("latent:{g}"));
        let means = regime_means(*g);
        let mut regime = Regime::Balanced;
        let mut x = means[1].ln();
        let mut path = Vec::with_capacity(cfg.days as usize);
        for _ in 0..cfg.days {
            let row = TRANSITION[regime as usize];
            regime = match r.weighted_index(&row) {
                0 => Regime::Glut,
                1 => Regime::Balanced,
                _ => Regime::Squeeze,
            };
            let mu = means[regime as usize].ln();
            x += THETA * (mu - x) + SIGMA * r.normal();
            if r.bernoulli(JUMP_P) {
                x += JUMP_SD * r.normal();
            }
            path.push(x);
        }
        latent.insert(*g, path);
    }

    // 2. Providers.
    let mut providers: Vec<Provider> = Vec::new();
    {
        let mut r = root.derive("providers");
        let all_regions = Region::ALL;
        for tier in ProviderTier::ALL {
            let (mult, stick, noise, tp, label) = tier_params(*tier);
            for i in 0..cfg.providers_per_tier {
                let n_regions = 1 + r.below(3);
                let mut regions = Vec::new();
                for _ in 0..n_regions {
                    regions.push(all_regions[r.below(all_regions.len())]);
                }
                let interconnect = if *tier == ProviderTier::Marketplace && r.bernoulli(0.4) {
                    Interconnect::Pcie
                } else {
                    Interconnect::Sxm
                };
                providers.push(Provider {
                    name: format!("{}_{:02}", tier.as_str(), i + 1),
                    tier: *tier,
                    mult: mult * r.lognormal(0.0, 0.25),
                    bias: r.lognormal(0.0, 0.08),
                    stickiness: stick,
                    noise,
                    transaction_p: tp,
                    regions,
                    interconnect,
                    source_kind: label,
                    last_quote: BTreeMap::new(),
                });
            }
        }
    }

    // 3. Observations, prints, power per day.
    let styles = index_styles(&cfg.gpus);
    let mut obs_rng = root.derive("observations");
    let mut print_rng = root.derive("prints");
    let mut power_rng = root.derive("power");
    let mut power_state: BTreeMap<Hub, f64> =
        Hub::ALL.iter().map(|h| (*h, hub_mean(*h).0.ln())).collect();

    for d in 0..cfg.days {
        let date = cfg.start + Duration::days(i64::from(d));
        for (gi, g) in cfg.gpus.iter().enumerate() {
            let lat = latent[g][d as usize].exp();
            out.latent.insert((*g, date), lat);
            for p in providers.iter_mut() {
                if !obs_rng.bernoulli(0.8) {
                    continue;
                }
                let target = lat * p.mult * p.bias;
                let sticky = p.last_quote.get(g).copied();
                let mut price = match sticky {
                    Some(prev) if obs_rng.bernoulli(p.stickiness) => prev,
                    _ => target * obs_rng.lognormal(0.0, p.noise),
                };
                p.last_quote.insert(*g, price);
                let region = p.regions[obs_rng.below(p.regions.len())];
                let region_adj: f64 = match region {
                    Region::UsEast => 0.0,
                    Region::UsCentral => -0.02,
                    Region::UsWest => 0.02,
                    Region::EuWest => 0.06,
                    Region::EuCentral => 0.05,
                    Region::Apac => 0.08,
                    Region::Other => 0.05,
                };
                price *= region_adj.exp();
                if p.interconnect == Interconnect::Pcie {
                    price /= 1.12;
                }
                let (term, term_months) = {
                    let u = obs_rng.uniform();
                    if u < 0.12 {
                        let m = [1u16, 3, 6, 12][obs_rng.below(4)];
                        let ratio = match m {
                            1 => 0.92,
                            3 => 0.87,
                            6 => 0.82,
                            _ => 0.75,
                        };
                        price *= ratio;
                        (TermType::Reserved, Some(m))
                    } else if u < 0.18 && p.tier == ProviderTier::Marketplace {
                        price /= 1.25;
                        (TermType::Spot, None)
                    } else {
                        (TermType::OnDemand, None)
                    }
                };
                if obs_rng.bernoulli(0.02) {
                    price *= obs_rng.uniform_range(0.3, 6.0);
                }
                let listing_kind = if obs_rng.bernoulli(p.transaction_p) {
                    ListingKind::Transaction
                } else {
                    ListingKind::List
                };
                let quantity = if obs_rng.bernoulli(0.7) {
                    Some(obs_rng.lognormal(3.0, 1.0).round())
                } else {
                    None
                };
                let hour = obs_rng.below(24) as u8;
                let observed_at =
                    OffsetDateTime::new_utc(date, Time::from_hms(hour, 0, 0).unwrap());
                let raw_ref = format!("{}-{}-{}-{}", p.name, g, d, gi);
                out.observations.push(PriceObservation {
                    obs_id: PriceObservation::compute_id("synth", &p.name, &raw_ref, observed_at),
                    observed_at,
                    source: "synth".into(),
                    provider: p.name.clone(),
                    tier: p.tier,
                    gpu: *g,
                    gpu_sku: Some(format!("{} {}", g.as_str().to_uppercase(), p.source_kind)),
                    gpu_count: 1,
                    interconnect: p.interconnect,
                    region,
                    country: None,
                    term,
                    term_months,
                    quantity_gpus: quantity,
                    price: (price * 10_000.0).round() / 10_000.0,
                    currency: "USD".into(),
                    unit: PriceUnit::GpuHour,
                    listing_kind,
                    raw_ref,
                });
            }
        }
        for (id, g, _ex, mult, noise) in &styles {
            let lat = out.latent[&(*g, date)];
            let v = lat * mult * print_rng.lognormal(0.0, *noise);
            out.index_prints.push(IndexPrint {
                date,
                index_id: id.clone(),
                gpu: *g,
                value: (v * 10_000.0).round() / 10_000.0,
                source: "synth".into(),
            });
        }
        for h in Hub::ALL {
            let (mean, cap) = hub_mean(*h);
            let x = power_state.get_mut(h).unwrap();
            let weekly = 0.06 * (2.0 * std::f64::consts::PI * f64::from(d) / 7.0).sin();
            *x += 0.15 * (mean.ln() - *x) + 0.10 * power_rng.normal();
            let mut price = (*x + weekly).exp();
            if power_rng.bernoulli(0.02) {
                price *= 3.0;
            }
            out.power.push(PowerPrice {
                date,
                hub: *h,
                price_usd_mwh: (price * 100.0).round() / 100.0,
                capacity_usd_mw_day: cap,
            });
        }
    }

    // 4. Futures: expectation of settlement under the latent dynamics plus scripted episodes.
    let mut fut_rng = root.derive("futures");
    let episodes: Vec<(u32, u32, f64)> = {
        // three 10-day windows with +/- 8% distortions, spread across the sample
        let span = cfg.days.max(30);
        vec![
            (span / 5, span / 5 + 10, 0.08),
            (span / 2, span / 2 + 10, -0.08),
            (span * 4 / 5, span * 4 / 5 + 10, 0.06),
        ]
    };
    for d in 0..cfg.days {
        let date = cfg.start + Duration::days(i64::from(d));
        let current = Tenor::from_date(date);
        for (id, g, ex, mult, _noise) in &styles {
            let lat = out.latent[&(*g, date)];
            let means = regime_means(*g);
            let long_run = means[1] * mult;
            let spot = lat * mult;
            for k in 1..=cfg.listed_months {
                let tenor = current.add_months(k as i32);
                let mid = tenor.first_day() + Duration::days(14);
                let days_ahead = (mid - date).whole_days().max(1) as f64;
                let decay = (-THETA * days_ahead / 3.0).exp(); // regimes persist: slower pull
                let mut expected = spot * decay + long_run * (1.0 - decay);
                for (a, b, dist) in &episodes {
                    if d >= *a && d < *b && k <= 2 {
                        expected *= 1.0 + dist;
                    }
                }
                let settle = expected * fut_rng.lognormal(0.0, 0.01);
                let half = settle * 0.004;
                out.futures.push(FuturesQuote {
                    date,
                    exchange: *ex,
                    contract_id: ContractId::new(*ex, id, tenor),
                    index_id: id.clone(),
                    gpu: *g,
                    tenor,
                    settle: (settle * 10_000.0).round() / 10_000.0,
                    bid: Some(((settle - half) * 10_000.0).round() / 10_000.0),
                    ask: Some(((settle + half) * 10_000.0).round() / 10_000.0),
                    volume: Some(5 + fut_rng.below(120) as u32),
                    open_interest: Some(50 + fut_rng.below(600) as u32),
                });
            }
        }
    }
    Ok(out)
}

/// Helper for CLI/date parsing without pulling `date_serde` into callers.
pub fn parse_date(s: &str) -> Result<Date> {
    basis_core::date_serde::parse(s)
        .map_err(|e| ConnectorError::Parse(format!("bad date `{s}`: {e}")))
}

/// Convenience: the first of a month as a `Date`.
pub fn first_of(year: i32, month: u8) -> Date {
    Date::from_calendar_date(year, Month::try_from(month).unwrap(), 1).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;
    use basis_core::store::to_csv_bytes;
    use sha2::{Digest, Sha256};

    fn digest(out: &SynthOutput) -> String {
        let mut h = Sha256::new();
        h.update(to_csv_bytes(&out.observations).unwrap());
        h.update(to_csv_bytes(&out.index_prints).unwrap());
        h.update(to_csv_bytes(&out.power).unwrap());
        h.update(to_csv_bytes(&out.futures).unwrap());
        hex::encode(h.finalize())
    }

    #[test]
    fn deterministic_for_seed() {
        let cfg = SynthConfig::tiny(7, first_of(2026, 1));
        let a = generate(&cfg).unwrap();
        let b = generate(&cfg).unwrap();
        assert_eq!(digest(&a), digest(&b));
        let c = generate(&SynthConfig::tiny(8, first_of(2026, 1))).unwrap();
        assert_ne!(digest(&a), digest(&c));
    }

    #[test]
    fn shapes_are_coherent() {
        let cfg = SynthConfig::new(42, first_of(2025, 9), 120);
        let out = generate(&cfg).unwrap();
        assert_eq!(out.power.len(), 120 * 4);
        assert_eq!(out.index_prints.len(), 120 * 4);
        assert_eq!(out.futures.len(), 120 * 4 * 6);
        assert!(out.observations.len() > 120 * 30 * 2 / 2);
        // prints track the latent within a few percent on average
        let mut err = 0.0;
        let mut n = 0;
        for p in &out.index_prints {
            let lat = out.latent[&(p.gpu, p.date)];
            let mult = if p.index_id.as_str().starts_with("sd") {
                1.03
            } else {
                0.97
            };
            err += (p.value / (lat * mult)).ln().abs();
            n += 1;
        }
        assert!(err / (n as f64) < 0.02);
        // transaction-only tiers exist so OCPI-style indices have data
        assert!(out
            .observations
            .iter()
            .any(|o| o.listing_kind == ListingKind::Transaction && o.tier == ProviderTier::Colo));
        // prices are positive and sane
        assert!(out
            .observations
            .iter()
            .all(|o| o.price > 0.05 && o.price < 100.0));
    }
}
