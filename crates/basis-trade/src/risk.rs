//! Risk engine: position, notional and GPU-hour limits, expiry exits and the daily
//! loss stop. Intents are shrunk to fit a limit when possible, else rejected.

use std::collections::BTreeMap;

use basis_core::keys::ContractId;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};
use time::Date;

use crate::fills::FillParams;
use crate::ledger::Book;
use crate::strategy::{MarketSnapshot, OrderIntent};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskParams {
    pub starting_equity_usd: f64,
    pub max_contracts_per_contract: u32,
    pub max_gross_notional_usd: f64,
    pub max_net_gpu_hours_per_family: f64,
    pub daily_loss_stop_pct: f64,
    pub exit_days_before_expiry: i64,
    pub kappa_equity_per_sigma: f64,
    #[serde(default)]
    pub fills: FillParams,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RiskEvent {
    pub strategy: String,
    pub contract_id: ContractId,
    pub note: String,
}

pub struct RiskEngine {
    pub params: RiskParams,
    /// Entries are blocked on this date after a daily loss stop.
    pub halted_on: Option<Date>,
}

impl RiskEngine {
    pub fn new(params: RiskParams) -> Self {
        RiskEngine {
            params,
            halted_on: None,
        }
    }

    /// Family used for the net GPU-hour limit: the GPU class of the contract.
    fn family(contract: &ContractId) -> String {
        contract
            .index_id()
            .map(|i| {
                if i.as_str().contains("b200") {
                    "b200".to_string()
                } else {
                    "h100".to_string()
                }
            })
            .unwrap_or_else(|| "other".into())
    }

    /// Check yesterday's P&L against the daily loss stop; returns true if trading halts today.
    pub fn check_daily_stop(&mut self, today: Date, book: &Book) -> bool {
        if let Some(last) = book.equity_path.last() {
            let start = last.equity - last.daily_pnl;
            let limit = -(self.params.daily_loss_stop_pct) * start.to_f64().unwrap_or(0.0);
            if last.daily_pnl.to_f64().unwrap_or(0.0) < limit {
                self.halted_on = Some(today);
                return true;
            }
        }
        false
    }

    /// Apply limits to a batch of intents in order; later intents see earlier approvals.
    pub fn filter(
        &self,
        intents: Vec<OrderIntent>,
        book: &Book,
        snap: &MarketSnapshot,
    ) -> (Vec<OrderIntent>, Vec<RiskEvent>) {
        let mut approved = Vec::new();
        let mut events = Vec::new();
        let mut positions: BTreeMap<(String, ContractId), i32> =
            book.lots.iter().map(|(k, l)| (k.clone(), l.qty)).collect();
        let mut gross = book.gross_notional().to_f64().unwrap_or(0.0);
        let mut net_hours: BTreeMap<String, f64> = BTreeMap::new();
        for (k, l) in &book.lots {
            *net_hours.entry(Self::family(&k.1)).or_insert(0.0) +=
                f64::from(l.qty) * l.multiplier.to_f64().unwrap_or(1000.0);
        }
        for mut it in intents {
            let key = (it.strategy.clone(), it.contract_id.clone());
            let pos = positions.get(&key).copied().unwrap_or(0);
            let sign = it.side.sign();
            let mult = snap.multiplier(&it.contract_id);
            let price = snap
                .quotes
                .get(&it.contract_id)
                .map(|q| q.settle)
                .unwrap_or(0.0);
            let reducing = pos != 0 && (pos > 0) != (sign > 0) && it.qty as i32 <= pos.abs();

            if self.halted_on == Some(snap.date) && !reducing {
                events.push(RiskEvent {
                    strategy: it.strategy.clone(),
                    contract_id: it.contract_id.clone(),
                    note: "rejected: daily loss stop active".into(),
                });
                continue;
            }
            if snap.quotes.get(&it.contract_id).is_none() {
                events.push(RiskEvent {
                    strategy: it.strategy.clone(),
                    contract_id: it.contract_id.clone(),
                    note: "rejected: no quote".into(),
                });
                continue;
            }
            if !reducing {
                // position limit
                let projected = (pos + sign * it.qty as i32).abs();
                if projected > self.params.max_contracts_per_contract as i32 {
                    let allowed =
                        (self.params.max_contracts_per_contract as i32 - pos.abs()).max(0) as u32;
                    if allowed == 0 {
                        events.push(RiskEvent {
                            strategy: it.strategy.clone(),
                            contract_id: it.contract_id.clone(),
                            note: format!(
                                "rejected: position limit {}",
                                self.params.max_contracts_per_contract
                            ),
                        });
                        continue;
                    }
                    events.push(RiskEvent {
                        strategy: it.strategy.clone(),
                        contract_id: it.contract_id.clone(),
                        note: format!("shrunk {} -> {} by position limit", it.qty, allowed),
                    });
                    it.qty = allowed;
                }
                // gross notional
                let add = it.qty as f64 * price * mult;
                if gross + add > self.params.max_gross_notional_usd {
                    let room = (self.params.max_gross_notional_usd - gross).max(0.0);
                    let allowed = (room / (price * mult)).floor() as u32;
                    if allowed == 0 {
                        events.push(RiskEvent {
                            strategy: it.strategy.clone(),
                            contract_id: it.contract_id.clone(),
                            note: "rejected: gross notional limit".into(),
                        });
                        continue;
                    }
                    events.push(RiskEvent {
                        strategy: it.strategy.clone(),
                        contract_id: it.contract_id.clone(),
                        note: format!("shrunk {} -> {} by gross notional limit", it.qty, allowed),
                    });
                    it.qty = allowed;
                }
                // net GPU-hours per family
                let fam = Self::family(&it.contract_id);
                let cur = net_hours.get(&fam).copied().unwrap_or(0.0);
                let proposed = cur + f64::from(sign) * it.qty as f64 * mult;
                if proposed.abs() > self.params.max_net_gpu_hours_per_family {
                    let room = self.params.max_net_gpu_hours_per_family
                        - cur.abs().min(self.params.max_net_gpu_hours_per_family);
                    let same_direction = (cur >= 0.0) == (sign > 0) || cur == 0.0;
                    let allowed = if same_direction {
                        (room / mult).floor() as u32
                    } else {
                        it.qty
                    };
                    if allowed == 0 {
                        events.push(RiskEvent {
                            strategy: it.strategy.clone(),
                            contract_id: it.contract_id.clone(),
                            note: "rejected: net GPU-hour limit".into(),
                        });
                        continue;
                    }
                    if allowed < it.qty {
                        events.push(RiskEvent {
                            strategy: it.strategy.clone(),
                            contract_id: it.contract_id.clone(),
                            note: format!("shrunk {} -> {} by net GPU-hour limit", it.qty, allowed),
                        });
                        it.qty = allowed;
                    }
                }
            }
            // book the projected effect
            let delta = sign * it.qty as i32;
            positions.insert(key, pos + delta);
            let fam = Self::family(&it.contract_id);
            *net_hours.entry(fam).or_insert(0.0) += f64::from(delta) * mult;
            gross += if reducing {
                -(it.qty as f64) * price * mult
            } else {
                it.qty as f64 * price * mult
            };
            approved.push(it);
        }
        (approved, events)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use basis_core::config::{ContractSpec, ContractsConfig};
    use basis_core::keys::{IndexId, Tenor};
    use basis_core::types::*;
    use rust_decimal_macros::dec as d;
    use time::macros::date;

    fn params() -> RiskParams {
        RiskParams {
            starting_equity_usd: 5_000_000.0,
            max_contracts_per_contract: 50,
            max_gross_notional_usd: 2_000_000.0,
            max_net_gpu_hours_per_family: 200_000.0,
            daily_loss_stop_pct: 0.02,
            exit_days_before_expiry: 3,
            kappa_equity_per_sigma: 0.01,
            fills: FillParams::default(),
        }
    }

    fn contracts() -> ContractsConfig {
        ContractsConfig {
            contracts: vec![ContractSpec {
                exchange: Exchange::Cme,
                index_id: IndexId::new("sdh100rt"),
                multiplier_gpu_hours: 1000.0,
                tick: 0.001,
                fee_per_contract: 1.5,
                settlement: SettlementStyle::FinalDay,
                listed_months: 6,
                to_verify: true,
            }],
        }
    }

    fn cid() -> ContractId {
        ContractId::new(
            Exchange::Cme,
            &IndexId::new("sdh100rt"),
            Tenor::new(2026, 12),
        )
    }

    fn intent(side: Side, qty: u32) -> OrderIntent {
        OrderIntent {
            strategy: "s".into(),
            contract_id: cid(),
            side,
            qty,
            kind: IntentKind::Enter,
            spread_id: "x".into(),
            z: 2.5,
            reason: "t".into(),
        }
    }

    #[test]
    fn limits_shrink_and_reject() {
        let p = params();
        let engine = RiskEngine::new(p);
        let book = Book::new(d!(5000000), date!(2026 - 10 - 01));
        let mut quotes = BTreeMap::new();
        let idx = IndexId::new("sdh100rt");
        quotes.insert(
            cid(),
            FuturesQuote {
                date: date!(2026 - 10 - 05),
                exchange: Exchange::Cme,
                contract_id: cid(),
                index_id: idx,
                gpu: GpuClass::H100,
                tenor: Tenor::new(2026, 12),
                settle: 2.5,
                bid: None,
                ask: None,
                volume: None,
                open_interest: None,
            },
        );
        let estimates = BTreeMap::new();
        let c = contracts();
        let snap = MarketSnapshot {
            date: date!(2026 - 10 - 05),
            quotes: &quotes,
            spreads: &[],
            estimates: &estimates,
            contracts: &c,
        };
        // 500 contracts -> shrunk to 50 by the position limit
        let (ok, ev) = engine.filter(vec![intent(Side::Buy, 500)], &book, &snap);
        assert_eq!(ok[0].qty, 50);
        assert!(ev[0].note.contains("position limit"));
        // second batch: 50 more would breach the limit -> rejected (position limit hit)
        let mut book2 = book.clone();
        book2
            .fill(
                date!(2026 - 10 - 05),
                "s",
                &cid(),
                50,
                d!(2.5),
                d!(1000),
                d!(75),
                "x",
            )
            .unwrap();
        let (ok2, ev2) = engine.filter(vec![intent(Side::Buy, 10)], &book2, &snap);
        assert!(ok2.is_empty() && ev2[0].note.contains("rejected: position limit"));
        // reducing trades always pass
        let (ok3, _) = engine.filter(vec![intent(Side::Sell, 50)], &book2, &snap);
        assert_eq!(ok3[0].qty, 50);
        // gross notional: 2.5 * 1000 * 50 = 125k per contract; other contracts fill the budget
        let mut engine2 = RiskEngine::new(params());
        engine2.params.max_gross_notional_usd = 100_000.0;
        let (ok4, ev4) = engine2.filter(vec![intent(Side::Buy, 50)], &book, &snap);
        assert_eq!(ok4[0].qty, 40);
        assert!(ev4[0].note.contains("gross notional"));
        // daily loss stop blocks entries but not exits
        let mut engine3 = RiskEngine::new(params());
        let mut book3 = book2.clone();
        let mut settles = BTreeMap::new();
        settles.insert(cid(), d!(0.5));
        book3.mark_to_market(date!(2026 - 10 - 05), &settles);
        book3.end_of_day(date!(2026 - 10 - 05));
        assert!(engine3.check_daily_stop(date!(2026 - 10 - 06), &book3));
        let snap6 = MarketSnapshot {
            date: date!(2026 - 10 - 06),
            quotes: &quotes,
            spreads: &[],
            estimates: &estimates,
            contracts: &c,
        };
        let (ok5, ev5) = engine3.filter(
            vec![intent(Side::Buy, 1), intent(Side::Sell, 50)],
            &book3,
            &snap6,
        );
        assert_eq!(ok5.len(), 1);
        assert_eq!(ok5[0].side, Side::Sell);
        assert!(ev5[0].note.contains("daily loss stop"));
    }
}
