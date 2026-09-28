//! Basis mean reversion: fade the futures price against the nowcast settlement
//! estimate when the basis z-score is extreme; exit when it normalizes or near expiry.

use basis_core::keys::ContractId;
use basis_core::types::*;
use rust_decimal::prelude::ToPrimitive;

use super::BasisMrParams;
use crate::ledger::Book;
use crate::strategy::{size_from_sigma, spread_inputs, MarketSnapshot, OrderIntent, Strategy};

pub struct BasisMeanReversion {
    params: BasisMrParams,
    kappa: f64,
    exit_days: i64,
}

impl BasisMeanReversion {
    pub fn new(params: BasisMrParams, kappa: f64, exit_days: i64) -> Self {
        BasisMeanReversion {
            params,
            kappa,
            exit_days,
        }
    }
}

impl Strategy for BasisMeanReversion {
    fn id(&self) -> &str {
        "basis_mr"
    }

    fn on_day(&mut self, snap: &MarketSnapshot, book: &Book) -> Vec<OrderIntent> {
        let mut out = Vec::new();
        let equity = book.equity().to_f64().unwrap_or(0.0);
        for s in snap.spreads.iter().filter(|s| s.kind == SpreadKind::Basis) {
            let Some(z) = s.z else { continue };
            let contract = ContractId(s.leg_a.clone());
            let pos = book.position(self.id(), &contract);
            let days = snap.days_to_expiry(&contract);
            let inputs = spread_inputs(s);
            let se = inputs.get("settle_se").copied().unwrap_or(f64::NAN);
            if pos == 0 {
                if days < self.params.min_remaining_days || z.abs() < self.params.enter_z {
                    continue;
                }
                let qty = size_from_sigma(equity, se, snap.multiplier(&contract), self.kappa);
                if qty == 0 {
                    continue;
                }
                let side = if z > 0.0 { Side::Sell } else { Side::Buy };
                out.push(OrderIntent {
                    strategy: self.id().into(),
                    contract_id: contract,
                    side,
                    qty,
                    kind: IntentKind::Enter,
                    spread_id: s.spread_id.clone(),
                    z,
                    reason: format!("basis {:.3} vs nowcast, z={z:.2}", s.value),
                });
            } else if z.abs() < self.params.exit_z
                || days <= self.exit_days
                || (pos > 0) == (z > self.params.enter_z)
            {
                // exit on normalization, near expiry, or if the signal flipped against us
                let side = if pos > 0 { Side::Sell } else { Side::Buy };
                out.push(OrderIntent {
                    strategy: self.id().into(),
                    contract_id: contract,
                    side,
                    qty: pos.unsigned_abs(),
                    kind: IntentKind::Exit,
                    spread_id: s.spread_id.clone(),
                    z,
                    reason: if days <= self.exit_days {
                        "exit before expiry".into()
                    } else {
                        format!("basis normalized, z={z:.2}")
                    },
                });
            }
        }
        out
    }
}
