//! Daily paper-trading loop: settle expiries, apply the daily loss stop, collect
//! strategy intents, filter through risk, fill, mark to market, close the day.

use std::collections::{BTreeMap, BTreeSet};

use basis_core::config::ContractsConfig;
use basis_core::keys::{ContractId, IndexId};
use basis_core::types::*;
use rust_decimal::Decimal;
use time::Date;

use crate::error::{Result, TradeError};
use crate::fills::fill;
use crate::ledger::{dec, Book};
use crate::risk::RiskEngine;
use crate::strategy::{MarketSnapshot, OrderIntent, Strategy};

pub struct BacktestInputs<'a> {
    pub futures: &'a [FuturesQuote],
    pub spreads: &'a [Spread],
    pub estimates: &'a [IndexEstimate],
    pub prints: &'a [IndexPrint],
    pub contracts: &'a ContractsConfig,
    pub from: Option<Date>,
    pub to: Option<Date>,
    /// Label of the futures source, so reports can flag synthetic markets.
    pub futures_source: String,
}

#[derive(Debug, Clone)]
pub struct BacktestOutput {
    pub ledger: Vec<LedgerEntry>,
    pub equity: Vec<DailyEquity>,
    pub positions: Vec<Position>,
    pub signals: Vec<Signal>,
    pub risk_events: Vec<(Date, String, String, String)>,
    pub last_date: Option<Date>,
}

/// Final settlement value of a contract from published prints (average over the
/// tenor for Asian contracts, last print for final-day), falling back to the last
/// futures settle when prints are missing.
pub fn final_settlement(
    contract: &ContractId,
    contracts: &ContractsConfig,
    prints: &BTreeMap<IndexId, BTreeMap<Date, f64>>,
    last_settle: Option<f64>,
) -> Option<f64> {
    let (ex, idx, tenor) = contract.parts()?;
    let style = contracts
        .get(ex, &idx)
        .map(|c| c.settlement)
        .unwrap_or(SettlementStyle::FinalDay);
    let series = prints.get(&idx);
    let from_prints = series.and_then(|s| match style {
        SettlementStyle::FinalDay => s
            .range(..=tenor.last_day())
            .next_back()
            .filter(|(d, _)| **d >= tenor.first_day())
            .map(|(_, v)| *v),
        SettlementStyle::AsianAverage => {
            let vals: Vec<f64> = s
                .range(tenor.first_day()..=tenor.last_day())
                .map(|(_, v)| *v)
                .collect();
            if vals.is_empty() {
                None
            } else {
                Some(vals.iter().sum::<f64>() / vals.len() as f64)
            }
        }
    });
    from_prints.or(last_settle)
}

pub fn run(
    inp: &BacktestInputs,
    strategies: &mut [Box<dyn Strategy>],
    risk: &mut RiskEngine,
) -> Result<BacktestOutput> {
    let mut fut_by_date: BTreeMap<Date, BTreeMap<ContractId, FuturesQuote>> = BTreeMap::new();
    for f in inp.futures {
        fut_by_date
            .entry(f.date)
            .or_default()
            .insert(f.contract_id.clone(), f.clone());
    }
    let mut spreads_by_date: BTreeMap<Date, Vec<Spread>> = BTreeMap::new();
    for s in inp.spreads {
        spreads_by_date.entry(s.date).or_default().push(s.clone());
    }
    let mut est_by_date: BTreeMap<Date, BTreeMap<IndexId, IndexEstimate>> = BTreeMap::new();
    for e in inp.estimates {
        est_by_date
            .entry(e.date)
            .or_default()
            .insert(e.index_id.clone(), e.clone());
    }
    let mut prints: BTreeMap<IndexId, BTreeMap<Date, f64>> = BTreeMap::new();
    for p in inp.prints {
        prints
            .entry(p.index_id.clone())
            .or_default()
            .insert(p.date, p.value);
    }
    let dates: Vec<Date> = fut_by_date
        .keys()
        .copied()
        .filter(|d| {
            inp.from.map(|f| *d >= f).unwrap_or(true) && inp.to.map(|t| *d <= t).unwrap_or(true)
        })
        .collect();
    let first = *dates
        .first()
        .ok_or_else(|| TradeError::Invalid("no futures dates in range".into()))?;
    let mut book = Book::new(dec(risk.params.starting_equity_usd), first);
    let mut signals = Vec::new();
    let mut risk_events = Vec::new();
    let mut last_settles: BTreeMap<ContractId, f64> = BTreeMap::new();
    let empty_spreads: Vec<Spread> = Vec::new();
    let empty_est: BTreeMap<IndexId, IndexEstimate> = BTreeMap::new();

    for date in &dates {
        let quotes = &fut_by_date[date];
        for (c, q) in quotes {
            last_settles.insert(c.clone(), q.settle);
        }
        // 1. settle contracts whose tenor has ended
        let expired: Vec<(String, ContractId)> = book
            .lots
            .keys()
            .filter(|(_, c)| c.tenor().map(|t| t.last_day() < *date).unwrap_or(false))
            .cloned()
            .collect();
        for (strategy, c) in expired {
            let v = final_settlement(&c, inp.contracts, &prints, last_settles.get(&c).copied())
                .ok_or_else(|| TradeError::Invalid(format!("no settlement value for {c}")))?;
            book.settle(*date, &strategy, &c, dec(v))?;
        }
        // 2. daily loss stop: flatten everything and block entries today
        let halted = risk.check_daily_stop(*date, &book);
        let snap = MarketSnapshot {
            date: *date,
            quotes,
            spreads: spreads_by_date.get(date).unwrap_or(&empty_spreads),
            estimates: est_by_date.get(date).unwrap_or(&empty_est),
            contracts: inp.contracts,
        };
        let mut intents: Vec<OrderIntent> = Vec::new();
        if halted {
            for ((strategy, c), lot) in &book.lots {
                if quotes.contains_key(c) {
                    intents.push(OrderIntent {
                        strategy: strategy.clone(),
                        contract_id: c.clone(),
                        side: if lot.qty > 0 { Side::Sell } else { Side::Buy },
                        qty: lot.qty.unsigned_abs(),
                        kind: IntentKind::Flatten,
                        spread_id: "risk".into(),
                        z: 0.0,
                        reason: "daily loss stop: flatten".into(),
                    });
                }
            }
            for (strategy, c) in book.lots.keys() {
                risk_events.push((
                    *date,
                    strategy.clone(),
                    c.to_string(),
                    "daily loss stop triggered".into(),
                ));
            }
        }
        // 3. forced exits near expiry, then strategy intents
        let exit_days = risk.params.exit_days_before_expiry;
        for ((strategy, c), lot) in &book.lots {
            if snap.days_to_expiry(c) <= exit_days && quotes.contains_key(c) && !halted {
                intents.push(OrderIntent {
                    strategy: strategy.clone(),
                    contract_id: c.clone(),
                    side: if lot.qty > 0 { Side::Sell } else { Side::Buy },
                    qty: lot.qty.unsigned_abs(),
                    kind: IntentKind::Roll,
                    spread_id: "expiry".into(),
                    z: 0.0,
                    reason: "exit before expiry".into(),
                });
            }
        }
        let forced: BTreeSet<(String, ContractId)> = intents
            .iter()
            .map(|i| (i.strategy.clone(), i.contract_id.clone()))
            .collect();
        if !halted {
            for s in strategies.iter_mut() {
                for it in s.on_day(&snap, &book) {
                    if !forced.contains(&(it.strategy.clone(), it.contract_id.clone())) {
                        intents.push(it);
                    }
                }
            }
        }
        // 4. risk filter and fills
        let (approved, events) = risk.filter(intents, &book, &snap);
        for e in events {
            book.risk_event(*date, &e.strategy, &e.contract_id, &e.note);
            risk_events.push((*date, e.strategy, e.contract_id.to_string(), e.note));
        }
        for it in approved {
            let q = &quotes[&it.contract_id];
            let (ex, idx, _) = it.contract_id.parts().ok_or_else(|| {
                TradeError::Invalid(format!("bad contract id {}", it.contract_id))
            })?;
            let spec = inp
                .contracts
                .get(ex, &idx)
                .ok_or_else(|| TradeError::Config(format!("no contract spec for {ex}:{idx}")))?;
            let Some(f) = fill(
                &risk.params.fills,
                q,
                it.side,
                it.qty,
                spec.tick,
                spec.fee_per_contract,
            ) else {
                continue;
            };
            let signed = it.side.sign() * f.qty as i32;
            book.fill(
                *date,
                &it.strategy,
                &it.contract_id,
                signed,
                f.price,
                dec(spec.multiplier_gpu_hours),
                f.fee,
                &it.reason,
            )?;
            signals.push(Signal {
                date: *date,
                strategy: it.strategy.clone(),
                spread_id: it.spread_id.clone(),
                contract_id: it.contract_id.clone(),
                side: it.side,
                qty: f.qty,
                intent: it.kind,
                z: it.z,
                reason: it.reason.clone(),
            });
        }
        // 5. mark to market at today's settles, close the day
        let settles: BTreeMap<ContractId, Decimal> = quotes
            .iter()
            .map(|(c, q)| (c.clone(), dec(q.settle)))
            .collect();
        book.mark_to_market(*date, &settles);
        book.end_of_day(*date);
    }
    let last = dates.last().copied();
    Ok(BacktestOutput {
        positions: last.map(|d| book.positions(d)).unwrap_or_default(),
        ledger: book.ledger,
        equity: book.equity_path,
        signals,
        risk_events,
        last_date: last,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use basis_core::config::ContractSpec;
    use basis_core::keys::Tenor;
    use time::macros::date;

    fn contracts() -> ContractsConfig {
        ContractsConfig {
            contracts: vec![
                ContractSpec {
                    exchange: Exchange::Cme,
                    index_id: IndexId::new("sdh100rt"),
                    multiplier_gpu_hours: 1000.0,
                    tick: 0.001,
                    fee_per_contract: 1.5,
                    settlement: SettlementStyle::FinalDay,
                    listed_months: 6,
                    to_verify: true,
                },
                ContractSpec {
                    exchange: Exchange::Ice,
                    index_id: IndexId::new("ocpi_h100"),
                    multiplier_gpu_hours: 1000.0,
                    tick: 0.001,
                    fee_per_contract: 1.5,
                    settlement: SettlementStyle::AsianAverage,
                    listed_months: 6,
                    to_verify: true,
                },
            ],
        }
    }

    #[test]
    fn final_settlement_styles() {
        let c = contracts();
        let mut prints = BTreeMap::new();
        let mut s = BTreeMap::new();
        s.insert(date!(2026 - 11 - 01), 2.0);
        s.insert(date!(2026 - 11 - 15), 3.0);
        s.insert(date!(2026 - 11 - 30), 4.0);
        prints.insert(IndexId::new("sdh100rt"), s.clone());
        prints.insert(IndexId::new("ocpi_h100"), s);
        let cme = ContractId::new(
            Exchange::Cme,
            &IndexId::new("sdh100rt"),
            Tenor::new(2026, 11),
        );
        let ice = ContractId::new(
            Exchange::Ice,
            &IndexId::new("ocpi_h100"),
            Tenor::new(2026, 11),
        );
        assert_eq!(final_settlement(&cme, &c, &prints, None), Some(4.0));
        assert_eq!(final_settlement(&ice, &c, &prints, None), Some(3.0));
        let dec_ = ContractId::new(
            Exchange::Cme,
            &IndexId::new("sdh100rt"),
            Tenor::new(2026, 12),
        );
        assert_eq!(final_settlement(&dec_, &c, &prints, Some(9.0)), Some(9.0));
    }
}
