//! Exact-arithmetic paper ledger: cash, positions, marks and equity in `Decimal`.

use std::collections::BTreeMap;

use basis_core::keys::ContractId;
use basis_core::types::*;
use rust_decimal::prelude::FromPrimitive;
use rust_decimal::Decimal;
use time::Date;

use crate::error::{Result, TradeError};

#[derive(Debug, Clone)]
pub struct Lot {
    pub qty: i32,
    pub avg_price: Decimal,
    pub mark: Decimal,
    pub multiplier: Decimal,
}

impl Lot {
    pub fn unrealized(&self) -> Decimal {
        (self.mark - self.avg_price) * Decimal::from(self.qty) * self.multiplier
    }
    pub fn notional(&self) -> Decimal {
        (self.mark * Decimal::from(self.qty) * self.multiplier).abs()
    }
}

/// The paper book: cash, open lots per (strategy, contract), ledger rows and equity path.
#[derive(Debug, Clone)]
pub struct Book {
    pub cash: Decimal,
    pub lots: BTreeMap<(String, ContractId), Lot>,
    pub ledger: Vec<LedgerEntry>,
    pub equity_path: Vec<DailyEquity>,
    pub realized_pnl: Decimal,
    pub fees_paid: Decimal,
    seq: u64,
    start_of_day_equity: Decimal,
}

/// Convert an f64 to `Decimal` using the shortest round-trip representation, then
/// limit to 10 decimal places so binary noise never enters the ledger.
pub fn dec(x: f64) -> Decimal {
    Decimal::from_f64(x)
        .unwrap_or(Decimal::ZERO)
        .round_dp(10)
        .normalize()
}

/// Round a price to the contract tick.
pub fn round_to_tick(price: f64, tick: f64) -> Decimal {
    let t = dec(tick);
    if t.is_zero() {
        return dec(price).round_dp(6);
    }
    let p = dec(price);
    let steps = (p / t).round();
    (steps * t).normalize()
}

impl Book {
    pub fn new(starting_cash: Decimal, date: Date) -> Self {
        let mut b = Book {
            cash: Decimal::ZERO,
            lots: BTreeMap::new(),
            ledger: Vec::new(),
            equity_path: Vec::new(),
            realized_pnl: Decimal::ZERO,
            fees_paid: Decimal::ZERO,
            seq: 0,
            start_of_day_equity: starting_cash,
        };
        b.cash = starting_cash;
        b.push(
            date,
            "book",
            "",
            LedgerKind::Deposit,
            0,
            Decimal::ZERO,
            starting_cash,
            Decimal::ZERO,
            0,
            "starting equity",
        );
        b
    }

    pub fn unrealized(&self) -> Decimal {
        self.lots.values().map(Lot::unrealized).sum()
    }

    pub fn equity(&self) -> Decimal {
        self.cash + self.unrealized()
    }

    pub fn gross_notional(&self) -> Decimal {
        self.lots.values().map(Lot::notional).sum()
    }

    pub fn position(&self, strategy: &str, contract: &ContractId) -> i32 {
        self.lots
            .get(&(strategy.to_string(), contract.clone()))
            .map(|l| l.qty)
            .unwrap_or(0)
    }

    pub fn start_of_day_equity(&self) -> Decimal {
        self.start_of_day_equity
    }

    #[allow(clippy::too_many_arguments)]
    fn push(
        &mut self,
        date: Date,
        strategy: &str,
        contract: &str,
        kind: LedgerKind,
        qty: i32,
        price: Decimal,
        cash_delta: Decimal,
        fee: Decimal,
        position_after: i32,
        note: &str,
    ) {
        self.seq += 1;
        self.ledger.push(LedgerEntry {
            seq: self.seq,
            date,
            strategy: strategy.to_string(),
            contract_id: contract.to_string(),
            kind,
            qty,
            price,
            cash_delta,
            fee,
            position_after,
            cash_after: self.cash,
            equity_after: self.equity(),
            note: note.to_string(),
        });
    }

    /// Apply a fill. `signed_qty` > 0 buys, < 0 sells. Realized P&L on reducing trades
    /// is booked to cash; the fee is deducted from cash.
    #[allow(clippy::too_many_arguments)]
    pub fn fill(
        &mut self,
        date: Date,
        strategy: &str,
        contract: &ContractId,
        signed_qty: i32,
        price: Decimal,
        multiplier: Decimal,
        fee: Decimal,
        note: &str,
    ) -> Result<()> {
        if signed_qty == 0 {
            return Err(TradeError::Invalid("zero-quantity fill".into()));
        }
        let key = (strategy.to_string(), contract.clone());
        let lot = self.lots.entry(key.clone()).or_insert(Lot {
            qty: 0,
            avg_price: price,
            mark: price,
            multiplier,
        });
        let old_qty = lot.qty;
        let new_qty = old_qty + signed_qty;
        let mut realized = Decimal::ZERO;
        if old_qty == 0 || (old_qty > 0) == (signed_qty > 0) {
            // opening or adding: weighted average entry
            let total = Decimal::from(old_qty.abs()) + Decimal::from(signed_qty.abs());
            lot.avg_price = (lot.avg_price * Decimal::from(old_qty.abs())
                + price * Decimal::from(signed_qty.abs()))
                / total;
        } else {
            // reducing or flipping
            let closed = old_qty.abs().min(signed_qty.abs());
            let sign = if old_qty > 0 {
                Decimal::ONE
            } else {
                -Decimal::ONE
            };
            realized = (price - lot.avg_price) * Decimal::from(closed) * multiplier * sign;
            if new_qty != 0 && (new_qty > 0) != (old_qty > 0) {
                lot.avg_price = price; // flipped: remainder opened at this price
            }
        }
        lot.qty = new_qty;
        lot.mark = price;
        lot.multiplier = multiplier;
        self.cash += realized - fee;
        self.realized_pnl += realized;
        self.fees_paid += fee;
        if new_qty == 0 {
            self.lots.remove(&key);
        }
        let cash_delta = realized - fee;
        self.push(
            date,
            strategy,
            contract.as_str(),
            LedgerKind::Fill,
            signed_qty,
            price,
            cash_delta,
            fee,
            new_qty,
            note,
        );
        Ok(())
    }

    /// Mark every open lot at its settle price.
    pub fn mark_to_market(&mut self, date: Date, settles: &BTreeMap<ContractId, Decimal>) {
        let keys: Vec<(String, ContractId)> = self.lots.keys().cloned().collect();
        for key in keys {
            if let Some(px) = settles.get(&key.1) {
                let (qty, mult) = {
                    let lot = self.lots.get_mut(&key).unwrap();
                    lot.mark = *px;
                    (lot.qty, lot.multiplier)
                };
                let _ = mult;
                self.push(
                    date,
                    &key.0,
                    key.1.as_str(),
                    LedgerKind::MarkToMarket,
                    0,
                    *px,
                    Decimal::ZERO,
                    Decimal::ZERO,
                    qty,
                    "mark",
                );
            }
        }
    }

    /// Cash-settle an expiring lot at the final settlement value.
    pub fn settle(
        &mut self,
        date: Date,
        strategy: &str,
        contract: &ContractId,
        final_value: Decimal,
    ) -> Result<()> {
        let key = (strategy.to_string(), contract.clone());
        let Some(lot) = self.lots.remove(&key) else {
            return Ok(());
        };
        let pnl = (final_value - lot.avg_price) * Decimal::from(lot.qty) * lot.multiplier;
        self.cash += pnl;
        self.realized_pnl += pnl;
        self.push(
            date,
            strategy,
            contract.as_str(),
            LedgerKind::Settlement,
            -lot.qty,
            final_value,
            pnl,
            Decimal::ZERO,
            0,
            "cash settlement at expiry",
        );
        Ok(())
    }

    pub fn risk_event(&mut self, date: Date, strategy: &str, contract: &ContractId, note: &str) {
        let pos = self.position(strategy, contract);
        self.push(
            date,
            strategy,
            contract.as_str(),
            LedgerKind::RiskEvent,
            0,
            Decimal::ZERO,
            Decimal::ZERO,
            Decimal::ZERO,
            pos,
            note,
        );
    }

    /// Close the day: record equity and reset the daily P&L anchor.
    pub fn end_of_day(&mut self, date: Date) -> DailyEquity {
        let equity = self.equity();
        let row = DailyEquity {
            date,
            cash: self.cash,
            unrealized: self.unrealized(),
            equity,
            daily_pnl: equity - self.start_of_day_equity,
            gross_notional: self.gross_notional(),
            open_positions: self.lots.len() as u32,
        };
        self.equity_path.push(row.clone());
        self.start_of_day_equity = equity;
        row
    }

    pub fn positions(&self, date: Date) -> Vec<Position> {
        self.lots
            .iter()
            .map(|((s, c), l)| Position {
                date,
                strategy: s.clone(),
                contract_id: c.clone(),
                qty: l.qty,
                avg_price: l.avg_price,
                mark: l.mark,
                unrealized_pnl: l.unrealized(),
                notional: l.notional(),
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use basis_core::keys::{IndexId, Tenor};
    use rust_decimal_macros::dec as d;
    use time::macros::date;

    fn cid() -> ContractId {
        ContractId::new(
            Exchange::Cme,
            &IndexId::new("sdh100rt"),
            Tenor::new(2026, 12),
        )
    }

    #[test]
    fn fill_mark_settle_roundtrip() {
        let mut b = Book::new(d!(1000000), date!(2026 - 10 - 01));
        let c = cid();
        let m = d!(1000);
        b.fill(
            date!(2026 - 10 - 01),
            "s",
            &c,
            5,
            d!(2.500),
            m,
            d!(7.5),
            "enter",
        )
        .unwrap();
        assert_eq!(b.cash, d!(999992.5));
        assert_eq!(b.position("s", &c), 5);
        let mut settles = BTreeMap::new();
        settles.insert(c.clone(), d!(2.600));
        b.mark_to_market(date!(2026 - 10 - 02), &settles);
        assert_eq!(b.unrealized(), d!(500)); // 0.1 * 5 * 1000
        assert_eq!(b.equity(), d!(1000492.5));
        // reduce 2 at 2.7: realized 0.2 * 2 * 1000 = 400
        b.fill(
            date!(2026 - 10 - 03),
            "s",
            &c,
            -2,
            d!(2.700),
            m,
            d!(3),
            "reduce",
        )
        .unwrap();
        assert_eq!(b.realized_pnl, d!(400));
        assert_eq!(b.position("s", &c), 3);
        // flip: sell 5 at 2.4 -> close 3 (realized -0.1*3*1000 = -300), open -2 at 2.4
        b.fill(
            date!(2026 - 10 - 04),
            "s",
            &c,
            -5,
            d!(2.400),
            m,
            d!(7.5),
            "flip",
        )
        .unwrap();
        assert_eq!(b.position("s", &c), -2);
        assert_eq!(b.realized_pnl, d!(100));
        assert_eq!(b.lots[&("s".to_string(), c.clone())].avg_price, d!(2.400));
        // settle at 2.3: short 2 gains 0.1*2*1000 = 200
        b.settle(date!(2026 - 10 - 31), "s", &c, d!(2.300)).unwrap();
        assert_eq!(b.realized_pnl, d!(300));
        assert!(b.lots.is_empty());
        assert_eq!(b.equity(), d!(1000000) + d!(300) - d!(18));
        // ledger invariant
        for e in &b.ledger {
            assert!(e.equity_after >= d!(999000));
        }
        let eod = b.end_of_day(date!(2026 - 10 - 31));
        assert_eq!(eod.equity, b.equity());
    }

    #[test]
    fn tick_rounding() {
        assert_eq!(round_to_tick(2.5004, 0.001), d!(2.5));
        assert_eq!(round_to_tick(2.5006, 0.001), d!(2.501));
        assert_eq!(round_to_tick(2.5, 0.0), d!(2.5));
    }
}
