//! Spread engine: basis, calendar, cross-index, cross-GPU, compute spark spread and
//! cross-hub spark spread, computed for every date with the needed inputs.

use std::collections::BTreeMap;

use basis_core::config::{ContractsConfig, CostStackConfig, IndicesConfig};
use basis_core::keys::{ContractId, IndexId, Tenor};
use basis_core::stats;
use basis_core::types::*;
use serde::{Deserialize, Serialize};
use time::Date;

use crate::config::NowcastParams;
use crate::error::Result;
use crate::nowcast::settlement_estimates;
use crate::supply::CostStack;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpreadParams {
    #[serde(default = "default_z_lookback")]
    pub z_lookback_days: usize,
    #[serde(default = "default_gap_lookback")]
    pub gap_lookback_days: usize,
    #[serde(default = "default_min_history")]
    pub min_history_days: usize,
    /// Hub pairs for the cross-hub spark spread.
    #[serde(default = "default_hub_pairs")]
    pub hub_pairs: Vec<(Hub, Hub)>,
}

fn default_z_lookback() -> usize {
    20
}
fn default_gap_lookback() -> usize {
    60
}
fn default_min_history() -> usize {
    15
}
fn default_hub_pairs() -> Vec<(Hub, Hub)> {
    vec![
        (Hub::PjmDominion, Hub::ErcotWest),
        (Hub::ErcotNorth, Hub::MisoNorth),
    ]
}

impl Default for SpreadParams {
    fn default() -> Self {
        SpreadParams {
            z_lookback_days: default_z_lookback(),
            gap_lookback_days: default_gap_lookback(),
            min_history_days: default_min_history(),
            hub_pairs: default_hub_pairs(),
        }
    }
}

/// Wrapper to read `[spreads]` from `strategies.toml`.
#[derive(Debug, Clone, Deserialize)]
pub struct SpreadsSection {
    #[serde(default)]
    pub spreads: SpreadParams,
}

/// Everything the spread engine needs, indexed for lookup.
pub struct SpreadInputs<'a> {
    pub estimates: &'a [IndexEstimate],
    pub prints: &'a [IndexPrint],
    pub futures: &'a [FuturesQuote],
    pub curve: &'a [ForwardCurvePoint],
    pub power: &'a [PowerPrice],
    pub perf: &'a [PerfRatio],
    pub cost: &'a CostStackConfig,
    pub indices: &'a IndicesConfig,
    pub contracts: &'a ContractsConfig,
    pub nowcast: &'a NowcastParams,
    pub params: &'a SpreadParams,
}

fn json(pairs: &[(&str, f64)]) -> String {
    let mut s = String::from("{");
    for (i, (k, v)) in pairs.iter().enumerate() {
        if i > 0 {
            s.push(',');
        }
        s.push_str(&format!(
            "\"{k}\":{}",
            if v.is_finite() {
                format!("{v:.6}")
            } else {
                "null".into()
            }
        ));
    }
    s.push('}');
    s
}

/// Trailing z-score helper over a history of residuals (value - fair).
struct History {
    lookback: usize,
    min: usize,
    data: BTreeMap<String, Vec<f64>>,
}

impl History {
    fn push_and_z(&mut self, key: &str, resid: f64) -> Option<f64> {
        let h = self.data.entry(key.to_string()).or_default();
        let z = if h.len() >= self.min {
            let start = h.len().saturating_sub(self.lookback);
            let window = &h[start..];
            let sd = stats::sd(window);
            if sd.is_finite() && sd > 1e-9 {
                Some((resid - stats::mean(window)) / sd)
            } else {
                None
            }
        } else {
            None
        };
        h.push(resid);
        z
    }
}

/// Compute-spark-spread components for one (gpu, hub) at a price.
#[derive(Debug, Clone, Copy)]
pub struct SparkSpread {
    pub price: f64,
    pub power_cost: f64,
    pub capacity_cost: f64,
    pub fixed_cost: f64,
    pub full: f64,
    pub cash: f64,
    pub breakeven_utilization: f64,
}

pub fn spark_spread(
    cost: &CostStack,
    gpu: GpuClass,
    tier: ProviderTier,
    hub: Hub,
    price: f64,
    power_usd_mwh: Option<f64>,
    capacity_usd_mw_day: Option<f64>,
) -> Result<SparkSpread> {
    let c = cost.costs(gpu, tier, hub, power_usd_mwh, capacity_usd_mw_day)?;
    let g = &cost.cfg.gpu[&gpu];
    let full = price - c.power_cost - c.capacity_cost - c.fixed();
    let cash = price - c.power_cost - c.capacity_cost;
    let margin_ex_capex = price - c.power_cost - c.capacity_cost - c.colo - c.opex;
    let breakeven = if margin_ex_capex > 0.0 {
        g.capex_usd / (g.life_years * 8760.0 * margin_ex_capex)
    } else {
        f64::INFINITY
    };
    Ok(SparkSpread {
        price,
        power_cost: c.power_cost,
        capacity_cost: c.capacity_cost,
        fixed_cost: c.fixed(),
        full,
        cash,
        breakeven_utilization: breakeven,
    })
}

/// Compute every spread for every date that has both an estimate and futures quotes.
pub fn compute_all(inp: &SpreadInputs) -> Result<Vec<Spread>> {
    let cost = CostStack::new(inp.cost);
    let mut est_by: BTreeMap<(IndexId, Date), &IndexEstimate> = BTreeMap::new();
    let mut est_series: BTreeMap<IndexId, BTreeMap<Date, f64>> = BTreeMap::new();
    for e in inp.estimates {
        est_by.insert((e.index_id.clone(), e.date), e);
        est_series
            .entry(e.index_id.clone())
            .or_default()
            .insert(e.date, e.estimate);
    }
    let mut fut_by_date: BTreeMap<Date, Vec<&FuturesQuote>> = BTreeMap::new();
    for f in inp.futures {
        fut_by_date.entry(f.date).or_default().push(f);
    }
    let mut power_by: BTreeMap<(Hub, Date), &PowerPrice> = BTreeMap::new();
    for p in inp.power {
        power_by.insert((p.hub, p.date), p);
    }
    let mut curve_dates: BTreeMap<Date, Vec<&ForwardCurvePoint>> = BTreeMap::new();
    for c in inp.curve {
        curve_dates.entry(c.as_of).or_default().push(c);
    }
    let perf: BTreeMap<GpuClass, f64> = inp
        .perf
        .iter()
        .map(|p| (p.gpu, p.inference_vs_h100))
        .collect();
    let listed = inp
        .contracts
        .contracts
        .iter()
        .map(|c| c.listed_months)
        .max()
        .unwrap_or(6);

    let mut hist = History {
        lookback: inp.params.z_lookback_days,
        min: inp.params.min_history_days,
        data: BTreeMap::new(),
    };
    let mut out = Vec::new();

    let dates: Vec<Date> = est_by
        .keys()
        .map(|k| k.1)
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .collect();
    for date in dates {
        let Some(futs) = fut_by_date.get(&date) else {
            continue;
        };
        // curve as of the latest curve date <= date
        let curve_today: Vec<ForwardCurvePoint> = curve_dates
            .range(..=date)
            .next_back()
            .map(|(_, v)| v.iter().map(|c| (*c).clone()).collect())
            .unwrap_or_default();
        let fv: BTreeMap<(GpuClass, Tenor), f64> = curve_today
            .iter()
            .map(|c| ((c.gpu, c.tenor), c.fair_value))
            .collect();
        let settles = settlement_estimates(
            inp.estimates,
            inp.prints,
            &curve_today,
            inp.indices,
            inp.contracts,
            inp.nowcast,
            date,
            listed,
        );
        let settle_by: BTreeMap<&ContractId, &SettlementEstimate> =
            settles.iter().map(|s| (&s.contract_id, s)).collect();
        let fut_by_contract: BTreeMap<&ContractId, &FuturesQuote> =
            futs.iter().map(|f| (&f.contract_id, *f)).collect();

        // 1. Basis
        for f in futs {
            if let Some(s) = settle_by.get(&f.contract_id) {
                if s.remaining_days == 0 {
                    continue;
                }
                let value = f.settle - s.estimate;
                let z = if s.se > 1e-9 {
                    Some(value / s.se)
                } else {
                    None
                };
                out.push(Spread {
                    date,
                    spread_id: format!("basis:{}", f.contract_id),
                    kind: SpreadKind::Basis,
                    gpu: f.gpu,
                    leg_a: f.contract_id.to_string(),
                    leg_b: "nowcast".into(),
                    value,
                    fair_value: 0.0,
                    z,
                    inputs: json(&[
                        ("futures", f.settle),
                        ("settle_est", s.estimate),
                        ("settle_se", s.se),
                        ("remaining_days", f64::from(s.remaining_days)),
                    ]),
                });
            }
        }

        // 2. Calendar: adjacent tenors per index
        let mut by_index: BTreeMap<&IndexId, Vec<&FuturesQuote>> = BTreeMap::new();
        for f in futs {
            by_index.entry(&f.index_id).or_default().push(f);
        }
        for (idx, fs) in &by_index {
            let mut fs = fs.clone();
            fs.sort_by_key(|f| f.tenor);
            for w in fs.windows(2) {
                let (a, b) = (w[0], w[1]);
                let value = b.settle - a.settle;
                let fair = match (fv.get(&(a.gpu, a.tenor)), fv.get(&(b.gpu, b.tenor))) {
                    (Some(x), Some(y)) => y - x,
                    _ => 0.0,
                };
                let id = format!("calendar:{}:{}-{}", idx, a.tenor, b.tenor);
                let z = hist.push_and_z(&id, value - fair);
                out.push(Spread {
                    date,
                    spread_id: id,
                    kind: SpreadKind::Calendar,
                    gpu: a.gpu,
                    leg_a: a.contract_id.to_string(),
                    leg_b: b.contract_id.to_string(),
                    value,
                    fair_value: fair,
                    z,
                    inputs: json(&[("front", a.settle), ("back", b.settle)]),
                });
            }
        }

        // 3. Cross-index: CME (Silicon Data style) vs ICE (OCPI style), same gpu and tenor
        for spec_a in &inp.indices.indices {
            if spec_a.exchange != Exchange::Cme {
                continue;
            }
            for spec_b in &inp.indices.indices {
                if spec_b.exchange != Exchange::Ice || spec_b.gpu != spec_a.gpu {
                    continue;
                }
                // trailing gap between the two nowcasts
                let gap = {
                    let sa = est_series.get(&spec_a.id);
                    let sb = est_series.get(&spec_b.id);
                    match (sa, sb) {
                        (Some(sa), Some(sb)) => {
                            let start =
                                date - time::Duration::days(inp.params.gap_lookback_days as i64);
                            let diffs: Vec<f64> = sa
                                .range(start..=date)
                                .filter_map(|(d, a)| sb.get(d).map(|b| a - b))
                                .collect();
                            if diffs.is_empty() {
                                0.0
                            } else {
                                stats::mean(&diffs)
                            }
                        }
                        _ => 0.0,
                    }
                };
                for f in futs.iter().filter(|f| f.index_id == spec_a.id) {
                    let cid_b = ContractId::new(Exchange::Ice, &spec_b.id, f.tenor);
                    if let Some(g) = fut_by_contract.get(&cid_b) {
                        let value = f.settle - g.settle;
                        let id = format!("cross_index:{}-{}:{}", spec_a.id, spec_b.id, f.tenor);
                        let z = hist.push_and_z(&id, value - gap);
                        out.push(Spread {
                            date,
                            spread_id: id,
                            kind: SpreadKind::CrossIndex,
                            gpu: f.gpu,
                            leg_a: f.contract_id.to_string(),
                            leg_b: cid_b.to_string(),
                            value,
                            fair_value: gap,
                            z,
                            inputs: json(&[
                                ("cme", f.settle),
                                ("ice", g.settle),
                                ("nowcast_gap", gap),
                            ]),
                        });
                    }
                }
            }
        }

        // 4. Cross-GPU (performance adjusted) on the front tenor per exchange
        for ex in Exchange::ALL {
            let h100 = inp
                .indices
                .indices
                .iter()
                .find(|s| s.exchange == *ex && s.gpu == GpuClass::H100);
            let b200 = inp
                .indices
                .indices
                .iter()
                .find(|s| s.exchange == *ex && s.gpu == GpuClass::B200);
            let (Some(h), Some(b)) = (h100, b200) else {
                continue;
            };
            let rho = perf.get(&GpuClass::B200).copied().unwrap_or(2.25);
            let front: Option<Tenor> = futs
                .iter()
                .filter(|f| f.index_id == h.id)
                .map(|f| f.tenor)
                .min();
            let Some(t) = front else { continue };
            let fh = fut_by_contract.get(&ContractId::new(*ex, &h.id, t));
            let fb = fut_by_contract.get(&ContractId::new(*ex, &b.id, t));
            let (Some(fh), Some(fb)) = (fh, fb) else {
                continue;
            };
            let value = fb.settle / rho - fh.settle;
            let fair = match (fv.get(&(GpuClass::B200, t)), fv.get(&(GpuClass::H100, t))) {
                (Some(x), Some(y)) => x / rho - y,
                _ => 0.0,
            };
            let id = format!("cross_gpu:{}:b200-h100:{}", ex, t);
            let z = hist.push_and_z(&id, value - fair);
            out.push(Spread {
                date,
                spread_id: id,
                kind: SpreadKind::CrossGpu,
                gpu: GpuClass::B200,
                leg_a: fb.contract_id.to_string(),
                leg_b: fh.contract_id.to_string(),
                value,
                fair_value: fair,
                z,
                inputs: json(&[
                    ("b200", fb.settle),
                    ("h100", fh.settle),
                    ("perf_ratio", rho),
                ]),
            });
        }

        // 5. Compute spark spread per (CME index, hub) at today's nowcast
        let mut css_by: BTreeMap<(GpuClass, Hub), f64> = BTreeMap::new();
        for spec in inp
            .indices
            .indices
            .iter()
            .filter(|s| s.exchange == Exchange::Cme)
        {
            let Some(e) = est_by.get(&(spec.id.clone(), date)) else {
                continue;
            };
            if !inp.cost.gpu.contains_key(&spec.gpu) {
                continue;
            }
            for hub in Hub::ALL {
                let pw = power_by.get(&(*hub, date));
                let ss = spark_spread(
                    &cost,
                    spec.gpu,
                    ProviderTier::NeoCloud,
                    *hub,
                    e.estimate,
                    pw.map(|p| p.price_usd_mwh),
                    pw.and_then(|p| p.capacity_usd_mw_day),
                )?;
                css_by.insert((spec.gpu, *hub), ss.full);
                out.push(Spread {
                    date,
                    spread_id: format!("spark:{}:{}", spec.id, hub),
                    kind: SpreadKind::SparkSpread,
                    gpu: spec.gpu,
                    leg_a: spec.id.to_string(),
                    leg_b: hub.to_string(),
                    value: ss.full,
                    fair_value: ss.cash,
                    z: None,
                    inputs: json(&[
                        ("price", ss.price),
                        (
                            "power_usd_mwh",
                            pw.map(|p| p.price_usd_mwh).unwrap_or(f64::NAN),
                        ),
                        ("power_cost", ss.power_cost),
                        ("capacity_cost", ss.capacity_cost),
                        ("fixed_cost", ss.fixed_cost),
                        ("cash_spread", ss.cash),
                        ("breakeven_utilization", ss.breakeven_utilization),
                    ]),
                });
            }
        }

        // 6. Cross-hub spark spread
        for (a, b) in &inp.params.hub_pairs {
            for gpu in [GpuClass::H100, GpuClass::B200] {
                if let (Some(x), Some(y)) = (css_by.get(&(gpu, *a)), css_by.get(&(gpu, *b))) {
                    let id = format!("cross_hub:{}:{}-{}", gpu, a, b);
                    let value = x - y;
                    let z = hist.push_and_z(&id, value);
                    out.push(Spread {
                        date,
                        spread_id: id,
                        kind: SpreadKind::CrossHubSpark,
                        gpu,
                        leg_a: a.to_string(),
                        leg_b: b.to_string(),
                        value,
                        fair_value: 0.0,
                        z,
                        inputs: json(&[("css_a", *x), ("css_b", *y)]),
                    });
                }
            }
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use basis_core::config::{CostStackConfig, GpuCost, HubCost, TierCost};

    fn cfg() -> CostStackConfig {
        CostStackConfig {
            server_overhead: 1.35,
            gpu: [
                (
                    GpuClass::H100,
                    GpuCost {
                        tdp_kw: 0.7,
                        capex_usd: 32000.0,
                        life_years: 5.0,
                        target_util: 0.7,
                        opex_usd_per_hour: 0.08,
                    },
                ),
                (
                    GpuClass::B200,
                    GpuCost {
                        tdp_kw: 1.0,
                        capex_usd: 50000.0,
                        life_years: 5.0,
                        target_util: 0.7,
                        opex_usd_per_hour: 0.10,
                    },
                ),
            ]
            .into_iter()
            .collect(),
            tier: [(ProviderTier::NeoCloud, TierCost { pue: 1.2 })]
                .into_iter()
                .collect(),
            hub: [
                (
                    Hub::ErcotWest,
                    HubCost {
                        default_power_usd_mwh: 45.0,
                        capacity_usd_mw_day: 0.0,
                        colo_usd_per_kw_month: 140.0,
                    },
                ),
                (
                    Hub::PjmDominion,
                    HubCost {
                        default_power_usd_mwh: 110.0,
                        capacity_usd_mw_day: 333.44,
                        colo_usd_per_kw_month: 140.0,
                    },
                ),
            ]
            .into_iter()
            .collect(),
        }
    }

    #[test]
    fn spark_spread_worked_example() {
        let c = cfg();
        let cost = CostStack::new(&c);
        // hub A: $45/MWh, no capacity charge
        let a = spark_spread(
            &cost,
            GpuClass::H100,
            ProviderTier::NeoCloud,
            Hub::ErcotWest,
            2.64,
            None,
            Some(0.0),
        )
        .unwrap();
        assert!((a.power_cost - 0.0510).abs() < 1e-3);
        assert!((a.fixed_cost - 1.3412).abs() < 1e-3);
        assert!((a.full - 1.248).abs() < 1e-3, "{}", a.full);
        assert!((a.cash - 2.589).abs() < 1e-3, "{}", a.cash);
        assert!(
            (a.breakeven_utilization - 0.319).abs() < 2e-3,
            "{}",
            a.breakeven_utilization
        );
        // hub B: $110/MWh, no capacity charge -> 1.174; with PJM capacity -> 1.158
        let b = spark_spread(
            &cost,
            GpuClass::H100,
            ProviderTier::NeoCloud,
            Hub::PjmDominion,
            2.64,
            None,
            Some(0.0),
        )
        .unwrap();
        assert!((b.full - 1.174).abs() < 1e-3, "{}", b.full);
        assert!((a.full - b.full - 0.074).abs() < 1e-3);
        let b_cap = spark_spread(
            &cost,
            GpuClass::H100,
            ProviderTier::NeoCloud,
            Hub::PjmDominion,
            2.64,
            None,
            None,
        )
        .unwrap();
        assert!((b_cap.capacity_cost - 0.0158).abs() < 1e-3);
        assert!((b_cap.full - 1.158).abs() < 1e-3, "{}", b_cap.full);
        // B200 at $4.08
        let bb = spark_spread(
            &cost,
            GpuClass::B200,
            ProviderTier::NeoCloud,
            Hub::ErcotWest,
            4.08,
            None,
            Some(0.0),
        )
        .unwrap();
        assert!((bb.full - 1.966).abs() < 1e-3, "{}", bb.full);
        let bb2 = spark_spread(
            &cost,
            GpuClass::B200,
            ProviderTier::NeoCloud,
            Hub::PjmDominion,
            4.08,
            None,
            Some(0.0),
        )
        .unwrap();
        assert!((bb2.full - 1.860).abs() < 1e-3, "{}", bb2.full);
    }

    #[test]
    fn cross_gpu_sign_from_founder_numbers() {
        // B200 at $4.08 / 2.25 = 1.813 H100-equivalent vs H100 at $2.64 -> -0.827
        let v: f64 = 4.08 / 2.25 - 2.64;
        assert!((v + 0.827).abs() < 1e-3);
    }

    #[test]
    fn history_z_scores() {
        let mut h = History {
            lookback: 5,
            min: 3,
            data: BTreeMap::new(),
        };
        assert!(h.push_and_z("k", 1.0).is_none());
        assert!(h.push_and_z("k", 2.0).is_none());
        assert!(h.push_and_z("k", 3.0).is_none());
        let z = h.push_and_z("k", 5.0).unwrap();
        assert!((z - 3.0).abs() < 1e-9);
    }
}
