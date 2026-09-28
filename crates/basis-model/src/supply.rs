//! Supply stack v0: fleet cohorts, pipeline additions, a cost stack per (tier, hub), a
//! short-run supply curve stepping at cash cost, isoelastic demand in H100-equivalent
//! work, and market clearing by bisection.

use std::collections::BTreeMap;

use basis_core::config::CostStackConfig;
use basis_core::keys::Tenor;
use basis_core::stats::norm_cdf;
use basis_core::types::*;
use serde::{Deserialize, Serialize};

use crate::error::{ModelError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplyParams {
    pub life_months: u32,
    pub availability: f64,
    pub hours_per_month: f64,
    pub scarcity_multiplier: f64,
    pub bisection_iters: u32,
    pub tenors: u32,
    #[serde(default = "default_power_lookback")]
    pub power_lookback_days: u32,
    #[serde(default)]
    pub tier_share: BTreeMap<ProviderTier, f64>,
    #[serde(default)]
    pub region_hub: BTreeMap<Region, Hub>,
    /// Fraction of each tier's supply offered at cash cost; the remainder is withheld
    /// unless price covers long-run cost (reservation-price sellers).
    #[serde(default)]
    pub srmc_share: BTreeMap<ProviderTier, f64>,
    /// Log-price dispersion of reservation prices around LRMC: the withheld share is
    /// offered as `Phi((ln P - ln LRMC) / reservation_sigma)`.
    #[serde(default = "default_reservation_sigma")]
    pub reservation_sigma: f64,
}

fn default_reservation_sigma() -> f64 {
    0.5
}

fn default_power_lookback() -> u32 {
    30
}

/// Per-GPU-hour physical costs derived from the cost stack.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct UnitCosts {
    pub kwh_per_gpu_hour: f64,
    pub power_cost: f64,
    pub capacity_cost: f64,
    pub depreciation: f64,
    pub colo: f64,
    pub opex: f64,
}

impl UnitCosts {
    /// Short-run marginal (cash) cost: power plus capacity charges.
    pub fn srmc(&self) -> f64 {
        self.power_cost + self.capacity_cost
    }
    /// Long-run marginal cost: cash cost plus depreciation, colo and opex.
    pub fn lrmc(&self) -> f64 {
        self.srmc() + self.depreciation + self.colo + self.opex
    }
    pub fn fixed(&self) -> f64 {
        self.depreciation + self.colo + self.opex
    }
}

/// Explicit-parameter cost calculation (used by tests and the spark spread).
#[allow(clippy::too_many_arguments)]
pub fn unit_costs(
    tdp_kw: f64,
    server_overhead: f64,
    pue: f64,
    power_usd_mwh: f64,
    capacity_usd_mw_day: f64,
    capex_usd: f64,
    life_years: f64,
    target_util: f64,
    colo_usd_per_kw_month: f64,
    opex_usd_per_hour: f64,
) -> UnitCosts {
    let kwh = tdp_kw * server_overhead * pue;
    UnitCosts {
        kwh_per_gpu_hour: kwh,
        power_cost: kwh * power_usd_mwh / 1000.0,
        capacity_cost: kwh * capacity_usd_mw_day / 24.0 / 1000.0,
        depreciation: capex_usd / (life_years * 8760.0 * target_util),
        colo: kwh * colo_usd_per_kw_month / 730.0,
        opex: opex_usd_per_hour,
    }
}

/// Cost stack lookups bound to the loaded configuration.
pub struct CostStack<'a> {
    pub cfg: &'a CostStackConfig,
}

impl<'a> CostStack<'a> {
    pub fn new(cfg: &'a CostStackConfig) -> Self {
        CostStack { cfg }
    }

    pub fn costs(
        &self,
        gpu: GpuClass,
        tier: ProviderTier,
        hub: Hub,
        power_usd_mwh: Option<f64>,
        capacity_usd_mw_day: Option<f64>,
    ) -> Result<UnitCosts> {
        let g = self
            .cfg
            .gpu
            .get(&gpu)
            .ok_or_else(|| ModelError::Input(format!("cost_stack.toml has no [gpu.{gpu}]")))?;
        let t =
            self.cfg.tier.get(&tier).ok_or_else(|| {
                ModelError::Input(format!("cost_stack.toml has no [tier.{tier}]"))
            })?;
        let h = self
            .cfg
            .hub
            .get(&hub)
            .ok_or_else(|| ModelError::Input(format!("cost_stack.toml has no [hub.{hub}]")))?;
        Ok(unit_costs(
            g.tdp_kw,
            self.cfg.server_overhead,
            t.pue,
            power_usd_mwh.unwrap_or(h.default_power_usd_mwh),
            capacity_usd_mw_day.unwrap_or(h.capacity_usd_mw_day),
            g.capex_usd,
            g.life_years,
            g.target_util,
            h.colo_usd_per_kw_month,
            g.opex_usd_per_hour,
        ))
    }
}

/// A segment of the short-run supply curve.
#[derive(Debug, Clone)]
pub struct SupplyStep {
    pub tier: ProviderTier,
    pub hub: Hub,
    pub gpu_hours: f64,
    pub srmc: f64,
    pub lrmc: f64,
    /// Cash-cost sellers offer everything once price covers SRMC; reservation-price
    /// sellers ramp in smoothly around LRMC.
    pub reservation: bool,
}

impl SupplyStep {
    pub fn offered_at(&self, price: f64, sigma: f64) -> f64 {
        if self.reservation {
            if price <= 0.0 || self.lrmc <= 0.0 {
                return 0.0;
            }
            self.gpu_hours * norm_cdf((price.ln() - self.lrmc.ln()) / sigma.max(1e-6))
        } else if price >= self.srmc {
            self.gpu_hours
        } else {
            0.0
        }
    }
}

#[derive(Debug, Clone)]
pub struct Clearing {
    pub price: f64,
    pub supply_gpu_hours: f64,
    pub demand_gpu_hours: f64,
    pub utilization: f64,
    pub srmc_floor: f64,
    pub lrmc_ceiling: f64,
}

pub struct SupplyModel<'a> {
    pub params: &'a SupplyParams,
    pub cost: CostStack<'a>,
    pub cohorts: &'a [FleetCohort],
    pub pipeline: &'a [PipelineProject],
    pub demand: &'a [DemandAssumption],
    pub perf: &'a [PerfRatio],
    /// Hub power price ($/MWh) and capacity ($/MW-day) used for the curve date.
    pub power: BTreeMap<Hub, (f64, Option<f64>)>,
}

impl<'a> SupplyModel<'a> {
    fn perf_ratio(&self, gpu: GpuClass) -> f64 {
        self.perf
            .iter()
            .find(|p| p.gpu == gpu)
            .map(|p| p.inference_vs_h100)
            .unwrap_or(1.0)
    }

    /// Installed units of `gpu` at `tenor`, by region.
    pub fn fleet_by_region(&self, gpu: GpuClass, tenor: Tenor) -> BTreeMap<Region, f64> {
        let mut out = BTreeMap::new();
        for c in self.cohorts.iter().filter(|c| c.gpu == gpu) {
            let age = c.ship_month.months_until(tenor);
            if age >= 0 && (age as u32) < self.params.life_months {
                *out.entry(c.region).or_insert(0.0) += c.units * c.sellable_share;
            }
        }
        out
    }

    /// Expected units from the pipeline that are online by `tenor`, by region.
    pub fn pipeline_by_region(&self, gpu: GpuClass, tenor: Tenor) -> Result<BTreeMap<Region, f64>> {
        let mut out = BTreeMap::new();
        for p in self.pipeline.iter().filter(|p| p.gpu == gpu) {
            let g =
                self.cost.cfg.gpu.get(&gpu).ok_or_else(|| {
                    ModelError::Input(format!("cost_stack.toml has no [gpu.{gpu}]"))
                })?;
            let pue = self
                .cost
                .cfg
                .tier
                .get(&ProviderTier::NeoCloud)
                .map(|t| t.pue)
                .unwrap_or(1.2);
            let units = p.mw * 1000.0 / (g.tdp_kw * self.cost.cfg.server_overhead * pue);
            let months_after = p.online_month.months_until(tenor) as f64;
            let share = p.prob_complete
                * norm_cdf((months_after - p.delay_mean_months) / p.delay_sd_months.max(0.1));
            // pipeline capacity is assumed sellable at the same share as the installed fleet
            let sellable = self
                .cohorts
                .iter()
                .filter(|c| c.gpu == gpu)
                .map(|c| c.sellable_share)
                .fold(0.0, f64::max)
                .max(0.1);
            *out.entry(p.region).or_insert(0.0) += units * share * sellable;
        }
        Ok(out)
    }

    /// Supply curve steps for `gpu` at `tenor` (GPU-hours per month, sorted by SRMC).
    pub fn supply_curve(&self, gpu: GpuClass, tenor: Tenor) -> Result<Vec<SupplyStep>> {
        let mut by_region = self.fleet_by_region(gpu, tenor);
        for (r, u) in self.pipeline_by_region(gpu, tenor)? {
            *by_region.entry(r).or_insert(0.0) += u;
        }
        let hours = self.params.hours_per_month * self.params.availability;
        let mut steps = Vec::new();
        for (region, units) in by_region {
            let hub = self
                .params
                .region_hub
                .get(&region)
                .copied()
                .unwrap_or(Hub::MisoNorth);
            let (pw, cap) = self.power.get(&hub).copied().unwrap_or((f64::NAN, None));
            let pw = if pw.is_finite() { Some(pw) } else { None };
            for (tier, share) in &self.params.tier_share {
                let c = self.cost.costs(gpu, *tier, hub, pw, cap)?;
                let cash_share = self
                    .params
                    .srmc_share
                    .get(tier)
                    .copied()
                    .unwrap_or(1.0)
                    .clamp(0.0, 1.0);
                let total = units * share * hours;
                if cash_share > 0.0 {
                    steps.push(SupplyStep {
                        tier: *tier,
                        hub,
                        gpu_hours: total * cash_share,
                        srmc: c.srmc(),
                        lrmc: c.lrmc(),
                        reservation: false,
                    });
                }
                if cash_share < 1.0 {
                    steps.push(SupplyStep {
                        tier: *tier,
                        hub,
                        gpu_hours: total * (1.0 - cash_share),
                        srmc: c.srmc(),
                        lrmc: c.lrmc(),
                        reservation: true,
                    });
                }
            }
        }
        steps.sort_by(|a, b| a.srmc.partial_cmp(&b.srmc).unwrap());
        Ok(steps)
    }

    /// Demand in GPU-hours per month at `price` for `gpu`, `months_ahead` from the anchor.
    pub fn demand_at(&self, gpu: GpuClass, price: f64, months_ahead: f64) -> Result<f64> {
        let d = self
            .demand
            .iter()
            .find(|d| d.gpu == gpu)
            .ok_or_else(|| ModelError::Input(format!("no demand assumption for {gpu}")))?;
        let rho = self.perf_ratio(gpu).max(1e-9);
        let rel = (price / rho) / (d.ref_price / rho);
        let monthly = d.d0_gpu_hours_per_day * 30.4;
        Ok(monthly * (d.growth_per_year * months_ahead / 12.0).exp() * rel.powf(-d.elasticity))
    }

    /// Clear the market for `gpu` at `tenor`.
    pub fn clear(&self, gpu: GpuClass, tenor: Tenor, months_ahead: f64) -> Result<Clearing> {
        let steps = self.supply_curve(gpu, tenor)?;
        if steps.is_empty() {
            return Err(ModelError::Input(format!("no supply for {gpu} at {tenor}")));
        }
        let total: f64 = steps.iter().map(|s| s.gpu_hours).sum();
        let sigma = self.params.reservation_sigma;
        // floor: cheapest cash cost; ceiling: price at which ~98% of reservation sellers offer
        let floor = steps.iter().map(|s| s.srmc).fold(f64::INFINITY, f64::min);
        let ceiling = steps.iter().map(|s| s.lrmc).fold(0.0, f64::max) * (2.0 * sigma).exp();
        let supply_at = |p: f64| -> f64 { steps.iter().map(|s| s.offered_at(p, sigma)).sum() };
        let lo0 = (0.5 * floor).max(0.01);
        let hi0 = ceiling * self.params.scarcity_multiplier;
        let d_hi = self.demand_at(gpu, hi0, months_ahead)?;
        let (price, demand) = if d_hi > supply_at(hi0) {
            // scarcity: every unit sells; price capped at the scarcity ceiling
            (hi0, d_hi)
        } else {
            let mut lo = lo0;
            let mut hi = hi0;
            for _ in 0..self.params.bisection_iters {
                let mid = 0.5 * (lo + hi);
                let excess = supply_at(mid) - self.demand_at(gpu, mid, months_ahead)?;
                if excess > 0.0 {
                    hi = mid;
                } else {
                    lo = mid;
                }
            }
            let p = 0.5 * (lo + hi);
            (p, self.demand_at(gpu, p, months_ahead)?)
        };
        let utilization = (demand / total).min(1.0);
        Ok(Clearing {
            price,
            supply_gpu_hours: total,
            demand_gpu_hours: demand,
            utilization,
            srmc_floor: floor,
            lrmc_ceiling: ceiling,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unit_costs_worked_example() {
        // H100, 700 W, overhead 1.35, PUE 1.2, hub A $45/MWh, capex 32k, 5y, 70% util,
        // colo $140/kW-month, opex $0.08/h.
        let c = unit_costs(0.7, 1.35, 1.2, 45.0, 0.0, 32000.0, 5.0, 0.7, 140.0, 0.08);
        assert!((c.kwh_per_gpu_hour - 1.134).abs() < 1e-9);
        assert!((c.power_cost - 0.05103).abs() < 1e-5);
        assert!((c.fixed() - 1.3412).abs() < 1e-3, "{}", c.fixed());
        let b = unit_costs(
            0.7, 1.35, 1.2, 110.0, 333.44, 32000.0, 5.0, 0.7, 140.0, 0.08,
        );
        assert!((b.power_cost - 0.12474).abs() < 1e-5);
        assert!((b.capacity_cost - 0.01576).abs() < 1e-5);
    }
}
