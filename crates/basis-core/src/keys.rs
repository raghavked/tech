//! Identifier types shared across the workspace.

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use time::{Date, Month};

use crate::types::Exchange;

/// Identifier of a settlement index, e.g. `sdh100rt` or `ocpi_h100`.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct IndexId(pub String);

impl IndexId {
    pub fn new(s: impl Into<String>) -> Self {
        IndexId(s.into())
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for IndexId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl From<&str> for IndexId {
    fn from(s: &str) -> Self {
        IndexId(s.to_string())
    }
}

/// A delivery month, serialized as `YYYY-MM`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Tenor {
    pub year: i32,
    pub month: u8,
}

impl Tenor {
    pub fn new(year: i32, month: u8) -> Self {
        assert!((1..=12).contains(&month), "month out of range");
        Tenor { year, month }
    }

    pub fn from_date(d: Date) -> Self {
        Tenor {
            year: d.year(),
            month: d.month() as u8,
        }
    }

    /// Tenor `n` months after this one.
    pub fn add_months(self, n: i32) -> Self {
        let total = self.year * 12 + (self.month as i32 - 1) + n;
        Tenor {
            year: total.div_euclid(12),
            month: (total.rem_euclid(12) + 1) as u8,
        }
    }

    /// Whole months from `self` to `other` (positive if `other` is later).
    pub fn months_until(self, other: Tenor) -> i32 {
        (other.year * 12 + other.month as i32) - (self.year * 12 + self.month as i32)
    }

    pub fn first_day(self) -> Date {
        Date::from_calendar_date(self.year, Month::try_from(self.month).unwrap(), 1).unwrap()
    }

    pub fn last_day(self) -> Date {
        let next = self.add_months(1).first_day();
        next.previous_day().unwrap()
    }

    pub fn days_in_month(self) -> u16 {
        (self.last_day() - self.first_day()).whole_days() as u16 + 1
    }
}

impl fmt::Display for Tenor {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:04}-{:02}", self.year, self.month)
    }
}

impl FromStr for Tenor {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let (y, m) = s
            .split_once('-')
            .ok_or_else(|| format!("bad tenor `{s}`"))?;
        let year: i32 = y.parse().map_err(|_| format!("bad tenor year `{s}`"))?;
        let month: u8 = m.parse().map_err(|_| format!("bad tenor month `{s}`"))?;
        if !(1..=12).contains(&month) {
            return Err(format!("bad tenor month `{s}`"));
        }
        Ok(Tenor { year, month })
    }
}

impl Serialize for Tenor {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for Tenor {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let s = String::deserialize(d)?;
        s.parse().map_err(serde::de::Error::custom)
    }
}

/// `{exchange}:{index_id}:{YYYY-MM}`
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ContractId(pub String);

impl ContractId {
    pub fn new(exchange: Exchange, index_id: &IndexId, tenor: Tenor) -> Self {
        ContractId(format!("{}:{}:{}", exchange.as_str(), index_id, tenor))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn parts(&self) -> Option<(Exchange, IndexId, Tenor)> {
        let mut it = self.0.splitn(3, ':');
        let ex = it.next()?.parse::<Exchange>().ok()?;
        let idx = IndexId::new(it.next()?);
        let tenor = it.next()?.parse::<Tenor>().ok()?;
        Some((ex, idx, tenor))
    }

    pub fn tenor(&self) -> Option<Tenor> {
        self.parts().map(|p| p.2)
    }

    pub fn index_id(&self) -> Option<IndexId> {
        self.parts().map(|p| p.1)
    }

    pub fn exchange(&self) -> Option<Exchange> {
        self.parts().map(|p| p.0)
    }
}

impl fmt::Display for ContractId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tenor_arithmetic() {
        let t = Tenor::new(2026, 11);
        assert_eq!(t.add_months(2), Tenor::new(2027, 1));
        assert_eq!(t.add_months(-11), Tenor::new(2025, 12));
        assert_eq!(Tenor::new(2026, 1).months_until(Tenor::new(2026, 4)), 3);
        assert_eq!(t.days_in_month(), 30);
        assert_eq!(Tenor::new(2024, 2).days_in_month(), 29);
        assert_eq!(t.to_string(), "2026-11");
        assert_eq!("2026-11".parse::<Tenor>().unwrap(), t);
    }

    #[test]
    fn contract_id_roundtrip() {
        let id = ContractId::new(
            Exchange::Cme,
            &IndexId::new("sdh100rt"),
            Tenor::new(2026, 12),
        );
        assert_eq!(id.as_str(), "cme:sdh100rt:2026-12");
        let (ex, idx, t) = id.parts().unwrap();
        assert_eq!(ex, Exchange::Cme);
        assert_eq!(idx.as_str(), "sdh100rt");
        assert_eq!(t, Tenor::new(2026, 12));
    }
}
