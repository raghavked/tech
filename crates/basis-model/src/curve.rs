//! Fair-value forward curve from the supply stack.

use std::collections::BTreeMap;

use basis_core::keys::Tenor;
use basis_core::types::*;
use time::{Date, Duration};

use crate::error::Result;
use crate::supply::{SupplyModel, SupplyParams};

/// Trailing-mean hub power prices ending at `as_of`.
pub fn trailing_power(
    power: &[PowerPrice],
    as_of: Date,
    lookback_days: u32,
) -> BTreeMap<Hub, (f64, Option<f64>)> {
    let start = as_of - Duration::days(i64::from(lookback_days));
    let mut acc: BTreeMap<Hub, (f64, usize, Option<f64>)> = BTreeMap::new();
    for p in power.iter().filter(|p| p.date >= start && p.date <= as_of) {
        let e = acc.entry(p.hub).or_insert((0.0, 0, None));
        e.0 += p.price_usd_mwh;
        e.1 += 1;
        if p.capacity_usd_mw_day.is_some() {
            e.2 = p.capacity_usd_mw_day;
        }
    }
    acc.into_iter()
        .map(|(h, (s, n, c))| (h, (s / n as f64, c)))
        .collect()
}

/// Build the curve as of `as_of` for every GPU class with demand assumptions.
pub fn build_curve(
    model: &SupplyModel,
    params: &SupplyParams,
    as_of: Date,
) -> Result<Vec<ForwardCurvePoint>> {
    let mut out = Vec::new();
    let current = Tenor::from_date(as_of);
    for d in model.demand {
        for k in 0..params.tenors {
            let tenor = current.add_months(k as i32);
            let months_ahead = f64::from(k) + 0.5;
            let c = model.clear(d.gpu, tenor, months_ahead)?;
            out.push(ForwardCurvePoint {
                as_of,
                gpu: d.gpu,
                tenor,
                fair_value: c.price,
                srmc_floor: c.srmc_floor,
                lrmc_ceiling: c.lrmc_ceiling,
                supply_gpu_hours: c.supply_gpu_hours,
                demand_gpu_hours: c.demand_gpu_hours,
                utilization: c.utilization,
            });
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::supply::CostStack;
    use basis_core::config::CostStackConfig;
    use time::macros::date;

    fn cost() -> CostStackConfig {
        basis_core::config::load_toml(std::path::Path::new(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../config/cost_stack.toml"
        )))
        .unwrap()
    }

    fn params() -> SupplyParams {
        basis_core::config::load_toml(std::path::Path::new(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../config/supply.toml"
        )))
        .unwrap()
    }

    fn cohorts() -> Vec<FleetCohort> {
        (0..24)
            .map(|i| FleetCohort {
                gpu: GpuClass::H100,
                region: if i % 2 == 0 {
                    Region::UsEast
                } else {
                    Region::UsCentral
                },
                ship_month: Tenor::new(2024, 1).add_months(i),
                units: 100_000.0,
                sellable_share: 0.35,
            })
            .collect()
    }

    fn demand(d0: f64) -> Vec<DemandAssumption> {
        vec![DemandAssumption {
            gpu: GpuClass::H100,
            d0_gpu_hours_per_day: d0,
            ref_price: 2.6,
            growth_per_year: 0.3,
            elasticity: 0.6,
        }]
    }

    #[test]
    fn clearing_is_monotone_in_demand_and_supply() {
        let cost = cost();
        let p = params();
        let base_cohorts = cohorts();
        let perf = vec![PerfRatio {
            gpu: GpuClass::H100,
            inference_vs_h100: 1.0,
            training_vs_h100: 1.0,
        }];
        let d_lo = demand(15_000_000.0);
        let d_hi = demand(25_000_000.0);
        let mk = |c: &'static [FleetCohort], d: &'static [DemandAssumption]| SupplyModel {
            params: Box::leak(Box::new(params())),
            cost: CostStack::new(Box::leak(Box::new(cost.clone()))),
            cohorts: c,
            pipeline: &[],
            demand: d,
            perf: Box::leak(Box::new(perf.clone())),
            power: BTreeMap::new(),
        };
        let c_static: &'static [FleetCohort] = Box::leak(base_cohorts.clone().into_boxed_slice());
        let lo: &'static [DemandAssumption] = Box::leak(d_lo.into_boxed_slice());
        let hi: &'static [DemandAssumption] = Box::leak(d_hi.into_boxed_slice());
        let t = Tenor::new(2026, 11);
        let a = mk(c_static, lo).clear(GpuClass::H100, t, 0.5).unwrap();
        let b = mk(c_static, hi).clear(GpuClass::H100, t, 0.5).unwrap();
        assert!(
            b.price >= a.price,
            "more demand -> higher price: {} vs {}",
            a.price,
            b.price
        );
        assert!(
            a.srmc_floor <= a.price && a.price <= a.lrmc_ceiling * p.scarcity_multiplier + 1e-9
        );
        // more supply (pipeline) -> lower or equal price
        let pipe = vec![PipelineProject {
            project: "x".into(),
            gpu: GpuClass::H100,
            region: Region::UsCentral,
            hub: Hub::ErcotWest,
            mw: 2000.0,
            online_month: Tenor::new(2026, 1),
            delay_mean_months: 0.0,
            delay_sd_months: 1.0,
            prob_complete: 1.0,
        }];
        let mut with_pipe = mk(c_static, hi);
        with_pipe.pipeline = Box::leak(pipe.into_boxed_slice());
        let c = with_pipe.clear(GpuClass::H100, t, 0.5).unwrap();
        assert!(c.price <= b.price + 1e-9);
        assert!(c.supply_gpu_hours > b.supply_gpu_hours);
        let curve = build_curve(&with_pipe, &p, date!(2026 - 10 - 05)).unwrap();
        assert_eq!(curve.len(), p.tenors as usize);
        assert!(curve
            .iter()
            .all(|c| c.utilization > 0.0 && c.utilization <= 1.0));
    }
}
