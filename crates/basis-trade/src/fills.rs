//! Fill model for a thin, newly listed market: half-spread plus linear impact, rounded
//! to tick, with an optional participation cap against reported volume.

use basis_core::types::*;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::ledger::{dec, round_to_tick};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FillParams {
    pub half_spread_bps: f64,
    pub impact_bps_per_contract: f64,
    pub impact_cap_bps: f64,
    pub volume_participation: f64,
}

impl Default for FillParams {
    fn default() -> Self {
        FillParams {
            half_spread_bps: 40.0,
            impact_bps_per_contract: 2.0,
            impact_cap_bps: 100.0,
            volume_participation: 0.10,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Fill {
    pub qty: u32,
    pub price: Decimal,
    pub fee: Decimal,
    pub slippage_bps: f64,
}

/// Fill `qty` contracts at the quote's settle with spread and impact; the quantity may
/// be capped by participation in reported volume (at least one contract).
pub fn fill(
    params: &FillParams,
    quote: &FuturesQuote,
    side: Side,
    qty: u32,
    tick: f64,
    fee_per_contract: f64,
) -> Option<Fill> {
    if qty == 0 {
        return None;
    }
    let mut q = qty;
    if let Some(v) = quote.volume {
        let cap = ((v as f64) * params.volume_participation).floor() as u32;
        q = q.min(cap.max(1));
    }
    let impact = (params.impact_bps_per_contract * q as f64).min(params.impact_cap_bps);
    let bps = params.half_spread_bps + impact;
    let raw = match side {
        Side::Buy => quote.settle * (1.0 + bps / 1e4),
        Side::Sell => quote.settle * (1.0 - bps / 1e4),
    };
    let price = round_to_tick(raw, tick);
    Some(Fill {
        qty: q,
        price,
        fee: dec(fee_per_contract) * Decimal::from(q),
        slippage_bps: bps,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use basis_core::keys::{ContractId, IndexId, Tenor};
    use rust_decimal_macros::dec as d;
    use time::macros::date;

    fn quote(volume: Option<u32>) -> FuturesQuote {
        let idx = IndexId::new("sdh100rt");
        FuturesQuote {
            date: date!(2026 - 10 - 05),
            exchange: Exchange::Cme,
            contract_id: ContractId::new(Exchange::Cme, &idx, Tenor::new(2026, 12)),
            index_id: idx,
            gpu: GpuClass::H100,
            tenor: Tenor::new(2026, 12),
            settle: 2.5,
            bid: None,
            ask: None,
            volume,
            open_interest: None,
        }
    }

    #[test]
    fn buy_pays_up_sell_hits_down_and_caps() {
        let p = FillParams::default();
        let b = fill(&p, &quote(None), Side::Buy, 10, 0.001, 1.5).unwrap();
        // 40 + 20 bps = 60 bps -> 2.5 * 1.006 = 2.515
        assert_eq!(b.price, d!(2.515));
        assert_eq!(b.fee, d!(15));
        let s = fill(&p, &quote(None), Side::Sell, 10, 0.001, 1.5).unwrap();
        assert_eq!(s.price, d!(2.485));
        // impact capped at 100 bps: 40 + 100 = 140 bps
        let big = fill(&p, &quote(None), Side::Buy, 200, 0.001, 1.5).unwrap();
        assert_eq!(big.price, d!(2.535));
        // participation: 10% of 30 = 3 contracts
        let capped = fill(&p, &quote(Some(30)), Side::Buy, 10, 0.001, 1.5).unwrap();
        assert_eq!(capped.qty, 3);
        // never below one contract when volume is tiny
        let tiny = fill(&p, &quote(Some(2)), Side::Buy, 10, 0.001, 1.5).unwrap();
        assert_eq!(tiny.qty, 1);
        assert!(fill(&p, &quote(None), Side::Buy, 0, 0.001, 1.5).is_none());
    }
}
