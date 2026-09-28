//! Domain records. Every struct here is the CSV column contract mirrored in
//! `schemas/datasets.toml`; keep field order stable.

use std::fmt;
use std::str::FromStr;

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use time::{Date, OffsetDateTime};

use crate::date_serde;
use crate::keys::{ContractId, IndexId, Tenor};

/// Defines a closed string enum with snake_case serde names, `as_str` and `FromStr`.
macro_rules! str_enum {
    ($(#[$meta:meta])* $name:ident { $($variant:ident => $s:literal),+ $(,)? }) => {
        $(#[$meta])*
        #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
        pub enum $name {
            $(#[serde(rename = $s)] $variant),+
        }

        impl $name {
            pub const ALL: &'static [$name] = &[$($name::$variant),+];

            pub fn as_str(&self) -> &'static str {
                match self { $($name::$variant => $s),+ }
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str(self.as_str())
            }
        }

        impl FromStr for $name {
            type Err = String;
            fn from_str(s: &str) -> Result<Self, Self::Err> {
                let lower = s.trim().to_ascii_lowercase().replace('-', "_");
                match lower.as_str() {
                    $($s => Ok($name::$variant),)+
                    _ => Err(format!("unknown {} `{}`", stringify!($name), s)),
                }
            }
        }
    };
}

str_enum!(
    /// GPU accelerator class.
    GpuClass {
        A100_40 => "a100_40",
        A100_80 => "a100_80",
        H100 => "h100",
        H200 => "h200",
        B200 => "b200",
        B300 => "b300",
        GB200 => "gb200",
        L40S => "l40s",
        RTX4090 => "rtx4090",
        RTX5090 => "rtx5090",
        Other => "other",
    }
);

str_enum!(
    Interconnect {
        Pcie => "pcie",
        Sxm => "sxm",
        Nvl => "nvl",
        Unknown => "unknown",
    }
);

str_enum!(
    ProviderTier {
        Hyperscaler => "hyperscaler",
        NeoCloud => "neo_cloud",
        Marketplace => "marketplace",
        Colo => "colo",
        Private => "private",
    }
);

str_enum!(
    TermType {
        OnDemand => "on_demand",
        Spot => "spot",
        Reserved => "reserved",
        Contract => "contract",
    }
);

str_enum!(
    Region {
        UsEast => "us_east",
        UsCentral => "us_central",
        UsWest => "us_west",
        EuWest => "eu_west",
        EuCentral => "eu_central",
        Apac => "apac",
        Other => "other",
    }
);

str_enum!(
    PriceUnit {
        GpuHour => "gpu_hour",
        InstanceHour => "instance_hour",
    }
);

str_enum!(
    ListingKind {
        List => "list",
        Transaction => "transaction",
        Bid => "bid",
        Ask => "ask",
    }
);

str_enum!(
    /// Power-market hubs near data-center clusters.
    Hub {
        PjmDominion => "pjm_dominion",
        ErcotWest => "ercot_west",
        ErcotNorth => "ercot_north",
        MisoNorth => "miso_north",
    }
);

str_enum!(
    Exchange {
        Cme => "cme",
        Ice => "ice",
    }
);

str_enum!(
    SettlementStyle {
        FinalDay => "final_day",
        AsianAverage => "asian_average",
    }
);

str_enum!(
    Side {
        Buy => "buy",
        Sell => "sell",
    }
);

str_enum!(
    SpreadKind {
        Basis => "basis",
        Calendar => "calendar",
        CrossIndex => "cross_index",
        CrossGpu => "cross_gpu",
        SparkSpread => "spark_spread",
        CrossHubSpark => "cross_hub_spark",
    }
);

str_enum!(
    LedgerKind {
        Deposit => "deposit",
        Fill => "fill",
        Fee => "fee",
        MarkToMarket => "mark_to_market",
        Settlement => "settlement",
        RiskEvent => "risk_event",
    }
);

str_enum!(
    IntentKind {
        Enter => "enter",
        Exit => "exit",
        Roll => "roll",
        Flatten => "flatten",
    }
);

impl Side {
    pub fn sign(self) -> i32 {
        match self {
            Side::Buy => 1,
            Side::Sell => -1,
        }
    }
    pub fn opposite(self) -> Side {
        match self {
            Side::Buy => Side::Sell,
            Side::Sell => Side::Buy,
        }
    }
}

/// A raw price observation from any source, normalized to one record shape.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PriceObservation {
    pub obs_id: String,
    #[serde(with = "time::serde::rfc3339")]
    pub observed_at: OffsetDateTime,
    pub source: String,
    pub provider: String,
    pub tier: ProviderTier,
    pub gpu: GpuClass,
    pub gpu_sku: Option<String>,
    pub gpu_count: u16,
    pub interconnect: Interconnect,
    pub region: Region,
    pub country: Option<String>,
    pub term: TermType,
    pub term_months: Option<u16>,
    pub quantity_gpus: Option<f64>,
    pub price: f64,
    pub currency: String,
    pub unit: PriceUnit,
    pub listing_kind: ListingKind,
    pub raw_ref: String,
}

impl PriceObservation {
    /// Deterministic observation id from the identifying fields.
    pub fn compute_id(
        source: &str,
        provider: &str,
        raw_ref: &str,
        observed_at: OffsetDateTime,
    ) -> String {
        let mut h = Sha256::new();
        h.update(source.as_bytes());
        h.update(b"|");
        h.update(provider.as_bytes());
        h.update(b"|");
        h.update(raw_ref.as_bytes());
        h.update(b"|");
        h.update(observed_at.unix_timestamp().to_string().as_bytes());
        hex::encode(&h.finalize()[..8])
    }

    /// Price expressed per GPU-hour.
    pub fn price_per_gpu_hour(&self) -> f64 {
        match self.unit {
            PriceUnit::GpuHour => self.price,
            PriceUnit::InstanceHour => self.price / f64::from(self.gpu_count.max(1)),
        }
    }

    pub fn date(&self) -> Date {
        self.observed_at.date()
    }
}

/// An observation after adjustment to an index's reference specification.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StandardizedObservation {
    pub obs_id: String,
    #[serde(with = "date_serde")]
    pub date: Date,
    pub index_id: IndexId,
    pub gpu: GpuClass,
    pub price_raw: f64,
    pub price_std: f64,
    pub adj_interconnect: f64,
    pub adj_term: f64,
    pub adj_region: f64,
    pub weight: f64,
    pub provider: String,
    pub tier: ProviderTier,
    /// Pipe-separated flags: `outlier|winsorized|stale|capped`.
    pub flags: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IndexEstimate {
    #[serde(with = "date_serde")]
    pub date: Date,
    pub index_id: IndexId,
    pub gpu: GpuClass,
    pub estimate: f64,
    pub se: f64,
    pub ci_low: f64,
    pub ci_high: f64,
    pub n_obs: u32,
    pub n_used: u32,
    pub n_providers: u32,
    pub method: String,
    pub composite_raw: f64,
    pub composite_median: f64,
    pub calib_alpha: f64,
    pub calib_beta: f64,
}

/// Forecast of a contract's final settlement value as of a nowcast date.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SettlementEstimate {
    #[serde(with = "date_serde")]
    pub as_of: Date,
    pub contract_id: ContractId,
    pub index_id: IndexId,
    pub gpu: GpuClass,
    pub style: SettlementStyle,
    #[serde(with = "date_serde")]
    pub window_start: Date,
    #[serde(with = "date_serde")]
    pub window_end: Date,
    pub realized_days: u16,
    pub remaining_days: u16,
    pub estimate: f64,
    pub se: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ForwardCurvePoint {
    #[serde(with = "date_serde")]
    pub as_of: Date,
    pub gpu: GpuClass,
    pub tenor: Tenor,
    pub fair_value: f64,
    pub srmc_floor: f64,
    pub lrmc_ceiling: f64,
    pub supply_gpu_hours: f64,
    pub demand_gpu_hours: f64,
    pub utilization: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PowerPrice {
    #[serde(with = "date_serde")]
    pub date: Date,
    pub hub: Hub,
    pub price_usd_mwh: f64,
    pub capacity_usd_mw_day: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FuturesQuote {
    #[serde(with = "date_serde")]
    pub date: Date,
    pub exchange: Exchange,
    pub contract_id: ContractId,
    pub index_id: IndexId,
    pub gpu: GpuClass,
    pub tenor: Tenor,
    pub settle: f64,
    pub bid: Option<f64>,
    pub ask: Option<f64>,
    pub volume: Option<u32>,
    pub open_interest: Option<u32>,
}

/// A published (or synthetic stand-in for a published) index value.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IndexPrint {
    #[serde(with = "date_serde")]
    pub date: Date,
    pub index_id: IndexId,
    pub gpu: GpuClass,
    pub value: f64,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Spread {
    #[serde(with = "date_serde")]
    pub date: Date,
    pub spread_id: String,
    pub kind: SpreadKind,
    pub gpu: GpuClass,
    pub leg_a: String,
    pub leg_b: String,
    pub value: f64,
    pub fair_value: f64,
    pub z: Option<f64>,
    /// JSON object of named inputs used to compute the spread.
    pub inputs: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Signal {
    #[serde(with = "date_serde")]
    pub date: Date,
    pub strategy: String,
    pub spread_id: String,
    pub contract_id: ContractId,
    pub side: Side,
    pub qty: u32,
    pub intent: IntentKind,
    pub z: f64,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Position {
    #[serde(with = "date_serde")]
    pub date: Date,
    pub strategy: String,
    pub contract_id: ContractId,
    pub qty: i32,
    pub avg_price: Decimal,
    pub mark: Decimal,
    pub unrealized_pnl: Decimal,
    pub notional: Decimal,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LedgerEntry {
    pub seq: u64,
    #[serde(with = "date_serde")]
    pub date: Date,
    pub strategy: String,
    pub contract_id: String,
    pub kind: LedgerKind,
    pub qty: i32,
    pub price: Decimal,
    pub cash_delta: Decimal,
    pub fee: Decimal,
    pub position_after: i32,
    pub cash_after: Decimal,
    pub equity_after: Decimal,
    pub note: String,
}

/// Daily equity snapshot of the whole book.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DailyEquity {
    #[serde(with = "date_serde")]
    pub date: Date,
    pub cash: Decimal,
    pub unrealized: Decimal,
    pub equity: Decimal,
    pub daily_pnl: Decimal,
    pub gross_notional: Decimal,
    pub open_positions: u32,
}

/// Compact row from the AWS price list, kept alongside the derived observations.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AwsPriceRow {
    #[serde(with = "date_serde")]
    pub publication_date: Date,
    pub region: String,
    pub instance_type: String,
    pub gpu: GpuClass,
    pub gpu_count: u16,
    pub usd_per_hour: f64,
    pub usd_per_gpu_hour: f64,
    pub rate_code: String,
}

/// Supply-stack assumption rows (committed under `data/samples/assumptions`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FleetCohort {
    pub gpu: GpuClass,
    pub region: Region,
    pub ship_month: Tenor,
    pub units: f64,
    pub sellable_share: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PipelineProject {
    pub project: String,
    pub gpu: GpuClass,
    pub region: Region,
    pub hub: Hub,
    pub mw: f64,
    pub online_month: Tenor,
    pub delay_mean_months: f64,
    pub delay_sd_months: f64,
    pub prob_complete: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DemandAssumption {
    pub gpu: GpuClass,
    pub d0_gpu_hours_per_day: f64,
    pub ref_price: f64,
    pub growth_per_year: f64,
    pub elasticity: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PerfRatio {
    pub gpu: GpuClass,
    pub inference_vs_h100: f64,
    pub training_vs_h100: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use time::macros::datetime;

    #[test]
    fn enum_parse_roundtrip() {
        for g in GpuClass::ALL {
            assert_eq!(g.as_str().parse::<GpuClass>().unwrap(), *g);
        }
        assert_eq!(
            "NEO-CLOUD".parse::<ProviderTier>().unwrap(),
            ProviderTier::NeoCloud
        );
        assert!("h1000".parse::<GpuClass>().is_err());
    }

    #[test]
    fn per_gpu_hour_conversion() {
        let mut o = PriceObservation {
            obs_id: String::new(),
            observed_at: datetime!(2026-09-25 12:00 UTC),
            source: "t".into(),
            provider: "aws".into(),
            tier: ProviderTier::Hyperscaler,
            gpu: GpuClass::H100,
            gpu_sku: None,
            gpu_count: 8,
            interconnect: Interconnect::Sxm,
            region: Region::UsEast,
            country: None,
            term: TermType::OnDemand,
            term_months: None,
            quantity_gpus: None,
            price: 11.008,
            currency: "USD".into(),
            unit: PriceUnit::InstanceHour,
            listing_kind: ListingKind::List,
            raw_ref: "r".into(),
        };
        assert!((o.price_per_gpu_hour() - 1.376).abs() < 1e-9);
        o.unit = PriceUnit::GpuHour;
        assert_eq!(o.price_per_gpu_hour(), 11.008);
        let id = PriceObservation::compute_id("t", "aws", "r", o.observed_at);
        assert_eq!(id.len(), 16);
        assert_eq!(
            id,
            PriceObservation::compute_id("t", "aws", "r", o.observed_at)
        );
    }

    #[test]
    fn csv_roundtrip_with_options() {
        let row = PowerPrice {
            date: date_serde::parse("2026-09-01").unwrap(),
            hub: Hub::ErcotWest,
            price_usd_mwh: 45.0,
            capacity_usd_mw_day: None,
        };
        let mut w = csv::Writer::from_writer(vec![]);
        w.serialize(&row).unwrap();
        let bytes = w.into_inner().unwrap();
        let text = String::from_utf8(bytes).unwrap();
        assert_eq!(
            text,
            "date,hub,price_usd_mwh,capacity_usd_mw_day\n2026-09-01,ercot_west,45.0,\n"
        );
        let mut r = csv::Reader::from_reader(text.as_bytes());
        let back: PowerPrice = r.deserialize().next().unwrap().unwrap();
        assert_eq!(back, row);
    }
}
