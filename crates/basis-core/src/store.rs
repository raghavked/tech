//! Append-only, content-addressed CSV store.
//!
//! ```text
//! store/
//!   manifest.json                     datasets -> immutable parts (sha256, rows, date range)
//!   raw/<dataset>/part-<sha12>.csv    one part per ingest; identical content -> same name -> skipped
//!   derived/<name>.csv                overwritten per run
//!   reports/<date>/...
//! ```

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use time::OffsetDateTime;

use crate::error::{CoreError, Result};

pub const MANIFEST_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PartInfo {
    pub file: String,
    pub sha256: String,
    pub rows: u64,
    pub source: String,
    pub ingested_at: String,
    pub min_date: Option<String>,
    pub max_date: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DatasetInfo {
    pub parts: Vec<PartInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub version: u32,
    pub datasets: BTreeMap<String, DatasetInfo>,
}

impl Default for Manifest {
    fn default() -> Self {
        Manifest {
            version: MANIFEST_VERSION,
            datasets: BTreeMap::new(),
        }
    }
}

/// Outcome of an append.
#[derive(Debug, Clone, PartialEq)]
pub enum AppendOutcome {
    Added(PartInfo),
    AlreadyPresent(PartInfo),
    Empty,
}

impl AppendOutcome {
    pub fn rows(&self) -> u64 {
        match self {
            AppendOutcome::Added(p) | AppendOutcome::AlreadyPresent(p) => p.rows,
            AppendOutcome::Empty => 0,
        }
    }
}

/// Anything with a date column, so parts can record their range.
pub trait Dated {
    fn date_key(&self) -> Option<String>;
}

#[derive(Debug, Clone)]
pub struct Store {
    root: PathBuf,
}

impl Store {
    pub fn open(root: impl Into<PathBuf>) -> Result<Self> {
        let root = root.into();
        fs::create_dir_all(root.join("raw"))?;
        fs::create_dir_all(root.join("derived"))?;
        fs::create_dir_all(root.join("reports"))?;
        let s = Store { root };
        if !s.manifest_path().exists() {
            s.write_manifest(&Manifest::default())?;
        }
        Ok(s)
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn manifest_path(&self) -> PathBuf {
        self.root.join("manifest.json")
    }

    pub fn derived_path(&self, name: &str) -> PathBuf {
        self.root.join("derived").join(format!("{name}.csv"))
    }

    pub fn reports_dir(&self) -> PathBuf {
        self.root.join("reports")
    }

    pub fn manifest(&self) -> Result<Manifest> {
        let text = fs::read_to_string(self.manifest_path())?;
        Ok(serde_json::from_str(&text)?)
    }

    fn write_manifest(&self, m: &Manifest) -> Result<()> {
        let tmp = self.root.join("manifest.json.tmp");
        fs::write(&tmp, serde_json::to_string_pretty(m)?)?;
        fs::rename(tmp, self.manifest_path())?;
        Ok(())
    }

    /// Serialize rows to CSV, hash the bytes, and store as an immutable part.
    pub fn append<T: Serialize + Dated>(
        &self,
        dataset: &str,
        rows: &[T],
        source: &str,
    ) -> Result<AppendOutcome> {
        if rows.is_empty() {
            return Ok(AppendOutcome::Empty);
        }
        let bytes = to_csv_bytes(rows)?;
        let sha = hex::encode(Sha256::digest(&bytes));
        let file = format!("part-{}.csv", &sha[..12]);
        let dir = self.root.join("raw").join(dataset);
        fs::create_dir_all(&dir)?;
        let mut manifest = self.manifest()?;
        let ds = manifest.datasets.entry(dataset.to_string()).or_default();
        if let Some(existing) = ds.parts.iter().find(|p| p.sha256 == sha) {
            return Ok(AppendOutcome::AlreadyPresent(existing.clone()));
        }
        fs::write(dir.join(&file), &bytes)?;
        let mut dates: Vec<String> = rows.iter().filter_map(|r| r.date_key()).collect();
        dates.sort();
        let info = PartInfo {
            file,
            sha256: sha,
            rows: rows.len() as u64,
            source: source.to_string(),
            ingested_at: OffsetDateTime::now_utc()
                .format(&time::format_description::well_known::Rfc3339)
                .unwrap_or_default(),
            min_date: dates.first().cloned(),
            max_date: dates.last().cloned(),
        };
        ds.parts.push(info.clone());
        self.write_manifest(&manifest)?;
        Ok(AppendOutcome::Added(info))
    }

    /// Read every part of a raw dataset in ingestion order.
    pub fn read_all<T: DeserializeOwned>(&self, dataset: &str) -> Result<Vec<T>> {
        let manifest = self.manifest()?;
        let mut out = Vec::new();
        if let Some(ds) = manifest.datasets.get(dataset) {
            for p in &ds.parts {
                let path = self.root.join("raw").join(dataset).join(&p.file);
                let bytes = fs::read(&path)?;
                let actual = hex::encode(Sha256::digest(&bytes));
                if actual != p.sha256 {
                    return Err(CoreError::Data(format!(
                        "part {} of {dataset} is corrupt: sha256 {actual} != {}",
                        p.file, p.sha256
                    )));
                }
                let mut rdr = csv::Reader::from_reader(bytes.as_slice());
                for rec in rdr.deserialize() {
                    out.push(rec?);
                }
            }
        }
        Ok(out)
    }

    pub fn has_dataset(&self, dataset: &str) -> Result<bool> {
        Ok(self
            .manifest()?
            .datasets
            .get(dataset)
            .map(|d| !d.parts.is_empty())
            .unwrap_or(false))
    }

    /// Overwrite a derived dataset.
    pub fn write_derived<T: Serialize>(&self, name: &str, rows: &[T]) -> Result<PathBuf> {
        let path = self.derived_path(name);
        let bytes = to_csv_bytes(rows)?;
        fs::write(&path, bytes)?;
        Ok(path)
    }

    pub fn read_derived<T: DeserializeOwned>(&self, name: &str) -> Result<Vec<T>> {
        let path = self.derived_path(name);
        if !path.exists() {
            return Err(CoreError::Data(format!(
                "derived dataset `{name}` not found; run the producing step first"
            )));
        }
        let mut rdr = csv::Reader::from_path(&path)?;
        let mut out = Vec::new();
        for rec in rdr.deserialize() {
            out.push(rec?);
        }
        Ok(out)
    }

    pub fn write_json<T: Serialize>(&self, rel: &str, v: &T) -> Result<PathBuf> {
        let path = self.root.join(rel);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&path, serde_json::to_string_pretty(v)?)?;
        Ok(path)
    }

    /// Verify every part's hash; returns (dataset, file, ok).
    pub fn verify(&self) -> Result<Vec<(String, String, bool)>> {
        let manifest = self.manifest()?;
        let mut out = Vec::new();
        for (name, ds) in &manifest.datasets {
            for p in &ds.parts {
                let path = self.root.join("raw").join(name).join(&p.file);
                let ok = fs::read(&path)
                    .map(|b| hex::encode(Sha256::digest(&b)) == p.sha256)
                    .unwrap_or(false);
                out.push((name.clone(), p.file.clone(), ok));
            }
        }
        Ok(out)
    }
}

/// Serialize rows as CSV with a header (empty rows -> header-only is not possible
/// with serde, so callers should avoid writing empty derived sets when a header matters).
pub fn to_csv_bytes<T: Serialize>(rows: &[T]) -> Result<Vec<u8>> {
    let mut w = csv::Writer::from_writer(Vec::new());
    for r in rows {
        w.serialize(r)?;
    }
    w.flush()?;
    w.into_inner().map_err(|e| CoreError::Data(e.to_string()))
}

/// Header-only CSV for an empty typed dataset, using the column list from the schema file.
pub fn header_only_csv(columns: &[&str]) -> Vec<u8> {
    let mut s = columns.join(",");
    s.push('\n');
    s.into_bytes()
}

mod dated_impls {
    use super::Dated;
    use crate::date_serde;
    use crate::types::*;

    impl Dated for PriceObservation {
        fn date_key(&self) -> Option<String> {
            Some(date_serde::fmt(self.observed_at.date()))
        }
    }
    impl Dated for PowerPrice {
        fn date_key(&self) -> Option<String> {
            Some(date_serde::fmt(self.date))
        }
    }
    impl Dated for FuturesQuote {
        fn date_key(&self) -> Option<String> {
            Some(date_serde::fmt(self.date))
        }
    }
    impl Dated for IndexPrint {
        fn date_key(&self) -> Option<String> {
            Some(date_serde::fmt(self.date))
        }
    }
    impl Dated for AwsPriceRow {
        fn date_key(&self) -> Option<String> {
            Some(date_serde::fmt(self.publication_date))
        }
    }
    impl Dated for FleetCohort {
        fn date_key(&self) -> Option<String> {
            Some(self.ship_month.to_string())
        }
    }
    impl Dated for PipelineProject {
        fn date_key(&self) -> Option<String> {
            Some(self.online_month.to_string())
        }
    }
    impl Dated for DemandAssumption {
        fn date_key(&self) -> Option<String> {
            None
        }
    }
    impl Dated for PerfRatio {
        fn date_key(&self) -> Option<String> {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::date_serde;
    use crate::types::{Hub, PowerPrice};

    fn rows() -> Vec<PowerPrice> {
        vec![
            PowerPrice {
                date: date_serde::parse("2026-09-01").unwrap(),
                hub: Hub::ErcotWest,
                price_usd_mwh: 45.0,
                capacity_usd_mw_day: Some(10.0),
            },
            PowerPrice {
                date: date_serde::parse("2026-09-02").unwrap(),
                hub: Hub::PjmDominion,
                price_usd_mwh: 110.0,
                capacity_usd_mw_day: None,
            },
        ]
    }

    #[test]
    fn append_is_idempotent_and_readable() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(dir.path().join("store")).unwrap();
        let a = store.append("power", &rows(), "test").unwrap();
        let b = store.append("power", &rows(), "test").unwrap();
        assert!(matches!(a, AppendOutcome::Added(_)));
        assert!(matches!(b, AppendOutcome::AlreadyPresent(_)));
        let m = store.manifest().unwrap();
        assert_eq!(m.datasets["power"].parts.len(), 1);
        assert_eq!(
            m.datasets["power"].parts[0].min_date.as_deref(),
            Some("2026-09-01")
        );
        let back: Vec<PowerPrice> = store.read_all("power").unwrap();
        assert_eq!(back, rows());
        assert!(store.verify().unwrap().iter().all(|r| r.2));
    }

    #[test]
    fn corruption_is_detected() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(dir.path()).unwrap();
        let out = store.append("power", &rows(), "test").unwrap();
        let AppendOutcome::Added(p) = out else {
            panic!()
        };
        let path = dir.path().join("raw/power").join(&p.file);
        fs::write(
            &path,
            b"date,hub,price_usd_mwh,capacity_usd_mw_day\n2026-09-01,ercot_west,1.0,\n",
        )
        .unwrap();
        assert!(store.read_all::<PowerPrice>("power").is_err());
        assert!(!store.verify().unwrap()[0].2);
    }

    #[test]
    fn derived_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(dir.path()).unwrap();
        store.write_derived("power_copy", &rows()).unwrap();
        let back: Vec<PowerPrice> = store.read_derived("power_copy").unwrap();
        assert_eq!(back, rows());
        assert!(store.read_derived::<PowerPrice>("missing").is_err());
    }
}
