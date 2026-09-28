//! Cross-index spread: long the cheap index future, short the rich one (same GPU class
//! and tenor) when the CME-minus-ICE spread deviates from the nowcast gap.

use basis_core::keys::ContractId;
use basis_core::types::*;
use rust_decimal::prelude::ToPrimitive;

use super::CrossIndexParams;
use crate::ledger::Book;
use crate::strategy::{size_from_sigma, MarketSnapshot, OrderIntent, Strategy};

pub struct CrossIndexSpread {
    params: CrossIndexParams,
    kappa: f64,
    exit_days: i64,
}

impl CrossIndexSpread {
    pub fn new(params: CrossIndexParams, kappa: f64, exit_days: i64) -> Self {
        CrossIndexSpread {
            params,
            kappa,
            exit_days,
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn leg(
        &self,
        contract: ContractId,
        side: Side,
        qty: u32,
        kind: IntentKind,
        s: &Spread,
        z: f64,
        reason: &str,
    ) -> OrderIntent {
        OrderIntent {
            strategy: self.id().into(),
            contract_id: contract,
            side,
            qty,
            kind,
            spread_id: s.spread_id.clone(),
            z,
            reason: reason.into(),
        }
    }
}

impl Strategy for CrossIndexSpread {
    fn id(&self) -> &str {
        "cross_index"
    }

    fn on_day(&mut self, snap: &MarketSnapshot, book: &Book) -> Vec<OrderIntent> {
        let mut out = Vec::new();
        let equity = book.equity().to_f64().unwrap_or(0.0);
        for s in snap
            .spreads
            .iter()
            .filter(|s| s.kind == SpreadKind::CrossIndex)
        {
            let Some(z) = s.z else { continue };
            let a = ContractId(s.leg_a.clone());
            let b = ContractId(s.leg_b.clone());
            let pos_a = book.position(self.id(), &a);
            let pos_b = book.position(self.id(), &b);
            let days = snap.days_to_expiry(&a).min(snap.days_to_expiry(&b));
            if pos_a == 0 && pos_b == 0 {
                if z.abs() < self.params.enter_z || days <= self.exit_days {
                    continue;
                }
                // sd of the residual recovered from the z-score
                let sd = ((s.value - s.fair_value) / z).abs();
                let qty = size_from_sigma(equity, sd, snap.multiplier(&a), self.kappa);
                if qty == 0 {
                    continue;
                }
                let (side_a, side_b) = if z > 0.0 {
                    (Side::Sell, Side::Buy)
                } else {
                    (Side::Buy, Side::Sell)
                };
                let reason = format!(
                    "cross-index {:.3} vs gap {:.3}, z={z:.2}",
                    s.value, s.fair_value
                );
                out.push(self.leg(a, side_a, qty, IntentKind::Enter, s, z, &reason));
                out.push(self.leg(b, side_b, qty, IntentKind::Enter, s, z, &reason));
            } else if z.abs() < self.params.exit_z || days <= self.exit_days {
                let reason = if days <= self.exit_days {
                    "exit before expiry".to_string()
                } else {
                    format!("spread normalized, z={z:.2}")
                };
                if pos_a != 0 {
                    let side = if pos_a > 0 { Side::Sell } else { Side::Buy };
                    out.push(self.leg(
                        a.clone(),
                        side,
                        pos_a.unsigned_abs(),
                        IntentKind::Exit,
                        s,
                        z,
                        &reason,
                    ));
                }
                if pos_b != 0 {
                    let side = if pos_b > 0 { Side::Sell } else { Side::Buy };
                    out.push(self.leg(
                        b.clone(),
                        side,
                        pos_b.unsigned_abs(),
                        IntentKind::Exit,
                        s,
                        z,
                        &reason,
                    ));
                }
            }
        }
        out
    }
}
