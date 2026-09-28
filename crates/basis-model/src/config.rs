//! Model configuration structures (`config/standardization.toml`, `[nowcast]` in
//! `config/strategies.toml`, `config/supply.toml`).

use std::collections::BTreeMap;

use basis_core::types::{Interconnect, Region};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TermPremiums {
    pub on_demand: f64,
    pub spot: f64,
    /// Reserved price as a ratio of on-demand, keyed by months (as strings in TOML).
    pub reserved_ratio: BTreeMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeightConfig {
    pub kind_transaction: f64,
    pub kind_list: f64,
    pub kind_bid: f64,
    pub kind_ask: f64,
    pub recency_tau_hours: f64,
    pub max_age_hours: f64,
    pub quantity_cap_gpus: f64,
    pub unknown_quantity_weight: f64,
    pub unknown_interconnect_penalty: f64,
    #[serde(default = "default_min_obs")]
    pub min_observations: usize,
    #[serde(default)]
    pub source: BTreeMap<String, f64>,
}

fn default_min_obs() -> usize {
    5
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StandardizationConfig {
    pub interconnect: BTreeMap<Interconnect, f64>,
    pub term: TermPremiums,
    pub region: BTreeMap<Region, f64>,
    pub weights: WeightConfig,
}

impl StandardizationConfig {
    /// ln(reserved / on-demand) for a term of `months`, interpolated in ln(months).
    pub fn reserved_log_premium(&self, months: f64) -> f64 {
        let mut pts: Vec<(f64, f64)> = self
            .term
            .reserved_ratio
            .iter()
            .filter_map(|(k, v)| k.parse::<f64>().ok().map(|m| (m.ln(), v.ln())))
            .collect();
        pts.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
        if pts.is_empty() {
            return 0.0;
        }
        let x = months.max(1.0).ln();
        if x <= pts[0].0 {
            return pts[0].1;
        }
        if x >= pts[pts.len() - 1].0 {
            return pts[pts.len() - 1].1;
        }
        for w in pts.windows(2) {
            let (x0, y0) = w[0];
            let (x1, y1) = w[1];
            if x >= x0 && x <= x1 {
                return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
            }
        }
        pts[pts.len() - 1].1
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NowcastParams {
    #[serde(default = "default_reps")]
    pub bootstrap_reps: usize,
    #[serde(default = "default_half_life")]
    pub half_life_days: f64,
    #[serde(default = "default_vol_lookback")]
    pub vol_lookback_days: usize,
    #[serde(default = "default_ci")]
    pub ci_level: f64,
    #[serde(default = "default_min_calib")]
    pub min_calibration_points: usize,
    /// EWMA weight for the online provider-effects update.
    #[serde(default = "default_gamma")]
    pub provider_effect_gamma: f64,
}

fn default_reps() -> usize {
    400
}
fn default_half_life() -> f64 {
    30.0
}
fn default_vol_lookback() -> usize {
    60
}
fn default_ci() -> f64 {
    0.90
}
fn default_min_calib() -> usize {
    20
}
fn default_gamma() -> f64 {
    0.2
}

impl Default for NowcastParams {
    fn default() -> Self {
        NowcastParams {
            bootstrap_reps: default_reps(),
            half_life_days: default_half_life(),
            vol_lookback_days: default_vol_lookback(),
            ci_level: default_ci(),
            min_calibration_points: default_min_calib(),
            provider_effect_gamma: default_gamma(),
        }
    }
}

/// Wrapper to read only the `[nowcast]` table from `strategies.toml`.
#[derive(Debug, Clone, Deserialize)]
pub struct NowcastSection {
    #[serde(default)]
    pub nowcast: NowcastParams,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplyParams {
    pub life_months: u32,
    pub availability: f64,
    pub hours_per_month: f64,
    pub scarcity_multiplier: f64,
    pub bisection_iters: u32,
    pub tenors: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg() -> StandardizationConfig {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../config/standardization.toml"
        );
        basis_core::config::load_toml(std::path::Path::new(path)).unwrap()
    }

    #[test]
    fn reserved_interpolation() {
        let c = cfg();
        assert!((c.reserved_log_premium(12.0) - 0.75f64.ln()).abs() < 1e-9);
        assert!((c.reserved_log_premium(1.0) - 0.92f64.ln()).abs() < 1e-9);
        let two = c.reserved_log_premium(2.0);
        assert!(two < 0.92f64.ln() && two > 0.87f64.ln());
        assert!((c.reserved_log_premium(60.0) - 0.65f64.ln()).abs() < 1e-9);
    }
}
