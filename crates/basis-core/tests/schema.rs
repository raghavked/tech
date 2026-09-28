//! The CSV header produced by each record type must equal `schemas/datasets.toml`.

use std::collections::BTreeMap;

use basis_core::keys::{ContractId, IndexId, Tenor};
use basis_core::types::*;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use time::macros::{date, datetime};

#[derive(Deserialize)]
struct Entry {
    columns: Vec<String>,
}

#[derive(Deserialize)]
struct Schema {
    raw: BTreeMap<String, Entry>,
    derived: BTreeMap<String, Entry>,
}

fn header<T: Serialize>(row: &T) -> Vec<String> {
    let mut w = csv::Writer::from_writer(Vec::new());
    w.serialize(row).unwrap();
    let text = String::from_utf8(w.into_inner().unwrap()).unwrap();
    text.lines()
        .next()
        .unwrap()
        .split(',')
        .map(str::to_string)
        .collect()
}

fn schema() -> Schema {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../schemas/datasets.toml");
    toml::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
}

#[test]
fn headers_match_schema() {
    let s = schema();
    let idx = IndexId::new("sdh100rt");
    let cid = ContractId::new(Exchange::Cme, &idx, Tenor::new(2026, 11));
    let d = date!(2026 - 09 - 25);
    let checks: Vec<(&str, &str, Vec<String>)> = vec![
        (
            "raw",
            "observations",
            header(&PriceObservation {
                obs_id: "x".into(),
                observed_at: datetime!(2026-09-25 00:00 UTC),
                source: "s".into(),
                provider: "p".into(),
                tier: ProviderTier::NeoCloud,
                gpu: GpuClass::H100,
                gpu_sku: None,
                gpu_count: 1,
                interconnect: Interconnect::Sxm,
                region: Region::UsEast,
                country: None,
                term: TermType::OnDemand,
                term_months: None,
                quantity_gpus: None,
                price: 1.0,
                currency: "USD".into(),
                unit: PriceUnit::GpuHour,
                listing_kind: ListingKind::List,
                raw_ref: "r".into(),
            }),
        ),
        (
            "raw",
            "power",
            header(&PowerPrice {
                date: d,
                hub: Hub::ErcotWest,
                price_usd_mwh: 1.0,
                capacity_usd_mw_day: None,
            }),
        ),
        (
            "raw",
            "futures",
            header(&FuturesQuote {
                date: d,
                exchange: Exchange::Cme,
                contract_id: cid.clone(),
                index_id: idx.clone(),
                gpu: GpuClass::H100,
                tenor: Tenor::new(2026, 11),
                settle: 1.0,
                bid: None,
                ask: None,
                volume: None,
                open_interest: None,
            }),
        ),
        (
            "raw",
            "index_prints",
            header(&IndexPrint {
                date: d,
                index_id: idx.clone(),
                gpu: GpuClass::H100,
                value: 1.0,
                source: "s".into(),
            }),
        ),
        (
            "raw",
            "aws_pricelist",
            header(&AwsPriceRow {
                publication_date: d,
                region: "us-east-1".into(),
                instance_type: "p5.48xlarge".into(),
                gpu: GpuClass::H100,
                gpu_count: 8,
                usd_per_hour: 11.0,
                usd_per_gpu_hour: 1.375,
                rate_code: "r".into(),
            }),
        ),
        (
            "raw",
            "fleet_cohorts",
            header(&FleetCohort {
                gpu: GpuClass::H100,
                region: Region::UsEast,
                ship_month: Tenor::new(2024, 1),
                units: 1.0,
                sellable_share: 0.3,
            }),
        ),
        (
            "raw",
            "pipeline",
            header(&PipelineProject {
                project: "p".into(),
                gpu: GpuClass::B200,
                region: Region::UsCentral,
                hub: Hub::ErcotWest,
                mw: 100.0,
                online_month: Tenor::new(2027, 1),
                delay_mean_months: 2.0,
                delay_sd_months: 3.0,
                prob_complete: 0.8,
            }),
        ),
        (
            "raw",
            "demand",
            header(&DemandAssumption {
                gpu: GpuClass::H100,
                d0_gpu_hours_per_day: 1.0,
                ref_price: 2.6,
                growth_per_year: 0.3,
                elasticity: 0.6,
            }),
        ),
        (
            "raw",
            "perf",
            header(&PerfRatio {
                gpu: GpuClass::B200,
                inference_vs_h100: 2.25,
                training_vs_h100: 1.8,
            }),
        ),
        (
            "derived",
            "standardized",
            header(&StandardizedObservation {
                obs_id: "x".into(),
                date: d,
                index_id: idx.clone(),
                gpu: GpuClass::H100,
                price_raw: 1.0,
                price_std: 1.0,
                adj_interconnect: 0.0,
                adj_term: 0.0,
                adj_region: 0.0,
                weight: 1.0,
                provider: "p".into(),
                tier: ProviderTier::NeoCloud,
                flags: String::new(),
            }),
        ),
        (
            "derived",
            "estimates",
            header(&IndexEstimate {
                date: d,
                index_id: idx.clone(),
                gpu: GpuClass::H100,
                estimate: 1.0,
                se: 0.1,
                ci_low: 0.9,
                ci_high: 1.1,
                n_obs: 1,
                n_used: 1,
                n_providers: 1,
                method: "m".into(),
                composite_raw: 1.0,
                composite_median: 1.0,
                calib_alpha: 0.0,
                calib_beta: 1.0,
            }),
        ),
        (
            "derived",
            "settlements",
            header(&SettlementEstimate {
                as_of: d,
                contract_id: cid.clone(),
                index_id: idx.clone(),
                gpu: GpuClass::H100,
                style: SettlementStyle::FinalDay,
                window_start: d,
                window_end: d,
                realized_days: 0,
                remaining_days: 1,
                estimate: 1.0,
                se: 0.1,
            }),
        ),
        (
            "derived",
            "curve",
            header(&ForwardCurvePoint {
                as_of: d,
                gpu: GpuClass::H100,
                tenor: Tenor::new(2026, 11),
                fair_value: 1.0,
                srmc_floor: 0.1,
                lrmc_ceiling: 2.0,
                supply_gpu_hours: 1.0,
                demand_gpu_hours: 1.0,
                utilization: 0.5,
            }),
        ),
        (
            "derived",
            "spreads",
            header(&Spread {
                date: d,
                spread_id: "s".into(),
                kind: SpreadKind::Basis,
                gpu: GpuClass::H100,
                leg_a: "a".into(),
                leg_b: "b".into(),
                value: 0.0,
                fair_value: 0.0,
                z: None,
                inputs: "{}".into(),
            }),
        ),
        (
            "derived",
            "signals",
            header(&Signal {
                date: d,
                strategy: "s".into(),
                spread_id: "x".into(),
                contract_id: cid.clone(),
                side: Side::Buy,
                qty: 1,
                intent: IntentKind::Enter,
                z: 2.0,
                reason: "r".into(),
            }),
        ),
        (
            "derived",
            "positions",
            header(&Position {
                date: d,
                strategy: "s".into(),
                contract_id: cid.clone(),
                qty: 1,
                avg_price: Decimal::ONE,
                mark: Decimal::ONE,
                unrealized_pnl: Decimal::ZERO,
                notional: Decimal::ONE,
            }),
        ),
        (
            "derived",
            "ledger",
            header(&LedgerEntry {
                seq: 1,
                date: d,
                strategy: "s".into(),
                contract_id: "c".into(),
                kind: LedgerKind::Fill,
                qty: 1,
                price: Decimal::ONE,
                cash_delta: Decimal::ZERO,
                fee: Decimal::ZERO,
                position_after: 1,
                cash_after: Decimal::ONE,
                equity_after: Decimal::ONE,
                note: String::new(),
            }),
        ),
        (
            "derived",
            "equity",
            header(&DailyEquity {
                date: d,
                cash: Decimal::ONE,
                unrealized: Decimal::ZERO,
                equity: Decimal::ONE,
                daily_pnl: Decimal::ZERO,
                gross_notional: Decimal::ZERO,
                open_positions: 0,
            }),
        ),
    ];
    for (group, name, actual) in checks {
        let expected = match group {
            "raw" => &s.raw[name].columns,
            _ => &s.derived[name].columns,
        };
        assert_eq!(&actual, expected, "header mismatch for {group}.{name}");
    }
}
