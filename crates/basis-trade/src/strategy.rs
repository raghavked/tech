//! Strategy interface and the daily market snapshot it sees.

use std::collections::BTreeMap;

use basis_core::config::ContractsConfig;
use basis_core::keys::{ContractId, IndexId};
use basis_core::types::*;
use time::Date;

use crate::ledger::Book;

/// Everything a strategy may look at on one day (no look-ahead: only today's data).
pub struct MarketSnapshot<'a> {
    pub date: Date,
    pub quotes: &'a BTreeMap<ContractId, FuturesQuote>,
    pub spreads: &'a [Spread],
    pub estimates: &'a BTreeMap<IndexId, IndexEstimate>,
    pub contracts: &'a ContractsConfig,
}

impl MarketSnapshot<'_> {
    pub fn multiplier(&self, contract: &ContractId) -> f64 {
        contract
            .parts()
            .and_then(|(ex, idx, _)| self.contracts.get(ex, &idx))
            .map(|c| c.multiplier_gpu_hours)
            .unwrap_or(1000.0)
    }

    /// Calendar days from `date` to the contract's last day.
    pub fn days_to_expiry(&self, contract: &ContractId) -> i64 {
        contract
            .tenor()
            .map(|t| (t.last_day() - self.date).whole_days())
            .unwrap_or(0)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct OrderIntent {
    pub strategy: String,
    pub contract_id: ContractId,
    pub side: Side,
    pub qty: u32,
    pub kind: IntentKind,
    pub spread_id: String,
    pub z: f64,
    pub reason: String,
}

pub trait Strategy {
    fn id(&self) -> &str;
    fn on_day(&mut self, snap: &MarketSnapshot, book: &Book) -> Vec<OrderIntent>;
}

/// Contracts sized so a one-sigma move in the signal costs `kappa` of equity.
pub fn size_from_sigma(equity: f64, sigma_price: f64, multiplier: f64, kappa: f64) -> u32 {
    if !(sigma_price.is_finite() && sigma_price > 0.0 && multiplier > 0.0 && equity > 0.0) {
        return 0;
    }
    (kappa * equity / (sigma_price * multiplier))
        .floor()
        .max(0.0) as u32
}

/// Parse the `inputs` JSON column of a spread row.
pub fn spread_inputs(s: &Spread) -> BTreeMap<String, f64> {
    serde_json::from_str::<BTreeMap<String, Option<f64>>>(&s.inputs)
        .map(|m| {
            m.into_iter()
                .filter_map(|(k, v)| v.map(|v| (k, v)))
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sizing() {
        assert_eq!(size_from_sigma(5_000_000.0, 0.25, 1000.0, 0.01), 200);
        assert_eq!(size_from_sigma(5_000_000.0, 0.0, 1000.0, 0.01), 0);
        assert_eq!(size_from_sigma(5_000_000.0, f64::NAN, 1000.0, 0.01), 0);
    }
}
