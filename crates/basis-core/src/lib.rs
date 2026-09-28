//! Basis core: domain types, the content-addressed CSV store, statistics helpers,
//! a deterministic PRNG and configuration loading shared by every other crate.

pub mod config;
pub mod error;
pub mod keys;
pub mod rng;
pub mod stats;
pub mod store;
pub mod types;

pub use error::CoreError;
pub use keys::{ContractId, IndexId, Tenor};
pub use store::Store;
pub use types::*;

/// Serde helpers for `time::Date` as ISO `YYYY-MM-DD` strings.
pub mod date_serde {
    use serde::{self, Deserialize, Deserializer, Serializer};
    use time::format_description::FormatItem;
    use time::macros::format_description;
    use time::Date;

    const FMT: &[FormatItem<'static>] = format_description!("[year]-[month]-[day]");

    pub fn serialize<S: Serializer>(d: &Date, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&d.format(FMT).map_err(serde::ser::Error::custom)?)
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Date, D::Error> {
        let s = String::deserialize(d)?;
        Date::parse(&s, FMT).map_err(serde::de::Error::custom)
    }

    /// Format a date as `YYYY-MM-DD`.
    pub fn fmt(d: Date) -> String {
        d.format(FMT).expect("date formatting cannot fail")
    }

    /// Parse a `YYYY-MM-DD` string.
    pub fn parse(s: &str) -> Result<Date, time::error::Parse> {
        Date::parse(s, FMT)
    }
}
