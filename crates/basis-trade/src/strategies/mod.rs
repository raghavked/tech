//! Concrete strategies. Both are z-score mean-reversion rules on spreads the engine
//! computes; on synthetic data they validate plumbing, not alpha.

pub mod basis_mr;
pub mod cross_index;

use serde::Deserialize;

use crate::strategy::Strategy;

#[derive(Debug, Clone, Deserialize)]
pub struct BasisMrParams {
    pub enter_z: f64,
    pub exit_z: f64,
    pub min_remaining_days: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CrossIndexParams {
    pub enter_z: f64,
    pub exit_z: f64,
    pub lookback_days: usize,
    pub min_history_days: usize,
    pub gap_lookback_days: usize,
}

/// The `[basis_mr]` and `[cross_index]` tables of `strategies.toml`.
#[derive(Debug, Clone, Deserialize)]
pub struct StrategiesConfig {
    pub basis_mr: BasisMrParams,
    pub cross_index: CrossIndexParams,
}

/// Build strategies by id.
pub fn build(
    ids: &[String],
    cfg: &StrategiesConfig,
    kappa: f64,
    exit_days_before_expiry: i64,
) -> Result<Vec<Box<dyn Strategy>>, String> {
    let mut out: Vec<Box<dyn Strategy>> = Vec::new();
    for id in ids {
        match id.as_str() {
            "basis_mr" => out.push(Box::new(basis_mr::BasisMeanReversion::new(
                cfg.basis_mr.clone(),
                kappa,
                exit_days_before_expiry,
            ))),
            "cross_index" => out.push(Box::new(cross_index::CrossIndexSpread::new(
                cfg.cross_index.clone(),
                kappa,
                exit_days_before_expiry,
            ))),
            other => {
                return Err(format!(
                    "unknown strategy `{other}` (known: basis_mr, cross_index)"
                ))
            }
        }
    }
    Ok(out)
}
