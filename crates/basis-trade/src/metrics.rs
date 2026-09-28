//! Performance metrics from the equity path and ledger.

use std::collections::BTreeMap;

use basis_core::stats;
use basis_core::types::*;
use rust_decimal::prelude::ToPrimitive;

#[derive(Debug, Clone, Default)]
pub struct StrategyMetrics {
    pub realized_pnl: f64,
    pub fees: f64,
    pub fills: usize,
    pub wins: usize,
    pub losses: usize,
}

#[derive(Debug, Clone, Default)]
pub struct Metrics {
    pub days: usize,
    pub starting_equity: f64,
    pub final_equity: f64,
    pub total_pnl: f64,
    pub total_return: f64,
    pub annualized_return: f64,
    pub sharpe: f64,
    pub max_drawdown: f64,
    pub hit_rate: f64,
    pub turnover_contracts_per_day: f64,
    pub fees_paid: f64,
    pub risk_events: usize,
    pub stop_events: usize,
    pub per_strategy: BTreeMap<String, StrategyMetrics>,
}

pub fn compute(equity: &[DailyEquity], ledger: &[LedgerEntry]) -> Metrics {
    let mut m = Metrics::default();
    if equity.is_empty() {
        return m;
    }
    let path: Vec<f64> = equity
        .iter()
        .map(|e| e.equity.to_f64().unwrap_or(0.0))
        .collect();
    m.days = path.len();
    m.starting_equity = ledger
        .iter()
        .find(|e| e.kind == LedgerKind::Deposit)
        .map(|e| e.cash_delta.to_f64().unwrap_or(0.0))
        .unwrap_or(path[0]);
    m.final_equity = *path.last().unwrap();
    m.total_pnl = m.final_equity - m.starting_equity;
    m.total_return = if m.starting_equity > 0.0 {
        m.total_pnl / m.starting_equity
    } else {
        0.0
    };
    let years = m.days as f64 / 252.0;
    m.annualized_return = if years > 0.0 && m.starting_equity > 0.0 {
        (m.final_equity / m.starting_equity).powf(1.0 / years) - 1.0
    } else {
        0.0
    };
    let rets: Vec<f64> = path
        .windows(2)
        .map(|w| if w[0] > 0.0 { w[1] / w[0] - 1.0 } else { 0.0 })
        .collect();
    let sd = stats::sd(&rets);
    m.sharpe = if sd.is_finite() && sd > 0.0 {
        stats::mean(&rets) / sd * 252f64.sqrt()
    } else {
        0.0
    };
    m.max_drawdown = stats::max_drawdown(&path);
    let mut contracts_traded = 0u64;
    for e in ledger {
        match e.kind {
            LedgerKind::Fill => {
                contracts_traded += e.qty.unsigned_abs() as u64;
                let s = m.per_strategy.entry(e.strategy.clone()).or_default();
                s.fills += 1;
                let realized = (e.cash_delta + e.fee).to_f64().unwrap_or(0.0);
                s.realized_pnl += realized;
                s.fees += e.fee.to_f64().unwrap_or(0.0);
                m.fees_paid += e.fee.to_f64().unwrap_or(0.0);
                if realized > 0.0 {
                    s.wins += 1;
                } else if realized < 0.0 {
                    s.losses += 1;
                }
            }
            LedgerKind::Settlement => {
                let s = m.per_strategy.entry(e.strategy.clone()).or_default();
                let realized = e.cash_delta.to_f64().unwrap_or(0.0);
                s.realized_pnl += realized;
                if realized > 0.0 {
                    s.wins += 1;
                } else if realized < 0.0 {
                    s.losses += 1;
                }
            }
            LedgerKind::RiskEvent => {
                m.risk_events += 1;
                if e.note.contains("daily loss stop") {
                    m.stop_events += 1;
                }
            }
            _ => {}
        }
    }
    let (w, l): (usize, usize) = m
        .per_strategy
        .values()
        .fold((0, 0), |a, s| (a.0 + s.wins, a.1 + s.losses));
    m.hit_rate = if w + l > 0 {
        w as f64 / (w + l) as f64
    } else {
        0.0
    };
    m.turnover_contracts_per_day = contracts_traded as f64 / m.days as f64;
    m
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec as d;
    use time::macros::date;

    #[test]
    fn hand_built_path() {
        let mut equity = Vec::new();
        let mut d0 = date!(2026 - 01 - 01);
        let vals = [100.0, 110.0, 99.0, 120.0, 90.0];
        let mut prev = 100.0;
        for v in vals {
            equity.push(DailyEquity {
                date: d0,
                cash: d!(0),
                unrealized: d!(0),
                equity: crate::ledger::dec(v),
                daily_pnl: crate::ledger::dec(v - prev),
                gross_notional: d!(0),
                open_positions: 0,
            });
            prev = v;
            d0 = d0.next_day().unwrap();
        }
        let ledger = vec![LedgerEntry {
            seq: 1,
            date: date!(2026 - 01 - 01),
            strategy: "book".into(),
            contract_id: String::new(),
            kind: LedgerKind::Deposit,
            qty: 0,
            price: d!(0),
            cash_delta: d!(100),
            fee: d!(0),
            position_after: 0,
            cash_after: d!(100),
            equity_after: d!(100),
            note: String::new(),
        }];
        let m = compute(&equity, &ledger);
        assert_eq!(m.days, 5);
        assert!((m.total_pnl + 10.0).abs() < 1e-9);
        assert!((m.max_drawdown - 0.25).abs() < 1e-9);
        assert!(m.sharpe < 0.0);
    }
}
