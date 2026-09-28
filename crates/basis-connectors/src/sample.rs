//! Loader for the committed sample datasets under `data/samples`.

use std::path::{Path, PathBuf};

use basis_core::types::*;
use serde::de::DeserializeOwned;

use crate::error::{ConnectorError, Result};
use crate::source::{FetchRequest, RawPayload, Source};

/// All sample datasets, read from a `data/samples` directory.
#[derive(Debug, Clone)]
pub struct SampleBundle {
    pub observations: Vec<PriceObservation>,
    pub power: Vec<PowerPrice>,
    pub futures: Vec<FuturesQuote>,
    pub index_prints: Vec<IndexPrint>,
    pub fleet_cohorts: Vec<FleetCohort>,
    pub pipeline: Vec<PipelineProject>,
    pub demand: Vec<DemandAssumption>,
    pub perf: Vec<PerfRatio>,
}

fn read_csv<T: DeserializeOwned>(path: &Path) -> Result<Vec<T>> {
    let mut rdr = csv::Reader::from_path(path)
        .map_err(|e| ConnectorError::Parse(format!("{}: {e}", path.display())))?;
    let mut out = Vec::new();
    for rec in rdr.deserialize() {
        out.push(rec.map_err(|e| ConnectorError::Parse(format!("{}: {e}", path.display())))?);
    }
    Ok(out)
}

fn read_dir_csv<T: DeserializeOwned>(dir: &Path) -> Result<Vec<T>> {
    let mut files: Vec<PathBuf> = std::fs::read_dir(dir)?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().map(|x| x == "csv").unwrap_or(false))
        .collect();
    files.sort();
    let mut out = Vec::new();
    for f in files {
        out.extend(read_csv::<T>(&f)?);
    }
    Ok(out)
}

impl SampleBundle {
    pub fn load(root: &Path) -> Result<Self> {
        Ok(SampleBundle {
            observations: read_dir_csv(&root.join("observations"))?,
            power: read_csv(&root.join("power/hub_prices.csv"))?,
            futures: read_csv(&root.join("futures/curve.csv"))?,
            index_prints: read_csv(&root.join("index_prints/prints.csv"))?,
            fleet_cohorts: read_csv(&root.join("assumptions/fleet_cohorts.csv"))?,
            pipeline: read_csv(&root.join("assumptions/pipeline.csv"))?,
            demand: read_csv(&root.join("assumptions/demand.csv"))?,
            perf: read_csv(&root.join("assumptions/perf.csv"))?,
        })
    }

    /// Default location relative to the repository root.
    pub fn default_root() -> PathBuf {
        PathBuf::from("data/samples")
    }
}

/// `Source` view over the sample observations only.
pub struct SampleSource {
    pub root: PathBuf,
}

impl Source for SampleSource {
    fn id(&self) -> &'static str {
        "sample"
    }
    fn is_live(&self) -> bool {
        false
    }
    fn fetch(&self, _req: &FetchRequest) -> Result<RawPayload> {
        let dir = self.root.join("observations");
        let mut files: Vec<PathBuf> = std::fs::read_dir(&dir)?
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.extension().map(|x| x == "csv").unwrap_or(false))
            .collect();
        files.sort();
        let mut bytes = Vec::new();
        for (i, f) in files.iter().enumerate() {
            let content = std::fs::read(f)?;
            if i == 0 {
                bytes.extend_from_slice(&content);
            } else if let Some(pos) = content.iter().position(|&b| b == b'\n') {
                bytes.extend_from_slice(&content[pos + 1..]);
            }
        }
        Ok(RawPayload::in_memory(
            "sample",
            &dir.display().to_string(),
            "text/csv",
            bytes,
        ))
    }
    fn parse(&self, raw: &RawPayload) -> Result<Vec<PriceObservation>> {
        let mut rdr = csv::Reader::from_reader(raw.bytes.as_slice());
        let mut out = Vec::new();
        for rec in rdr.deserialize() {
            out.push(rec?);
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Digest, Sha256};
    use std::collections::BTreeMap;

    fn root() -> PathBuf {
        PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/../../data/samples"))
    }

    #[test]
    fn bundle_loads() {
        let b = SampleBundle::load(&root()).unwrap();
        assert!(b.observations.len() > 500, "{}", b.observations.len());
        assert_eq!(b.power.len(), 100);
        assert_eq!(b.futures.len(), 400);
        assert_eq!(b.index_prints.len(), 100);
        assert!(b.fleet_cohorts.len() > 100);
        assert_eq!(b.demand.len(), 2);
        let providers: std::collections::BTreeSet<_> =
            b.observations.iter().map(|o| o.provider.as_str()).collect();
        assert!(providers.len() >= 20);
        let src = SampleSource { root: root() };
        let raw = src.fetch(&FetchRequest::new()).unwrap();
        assert_eq!(src.parse(&raw).unwrap().len(), b.observations.len());
    }

    #[derive(serde::Deserialize)]
    struct Pin {
        sha256: String,
        rows: u64,
    }

    #[test]
    fn sample_manifest_pins() {
        let text = std::fs::read_to_string(root().join("manifest.json")).unwrap();
        let pins: BTreeMap<String, Pin> = serde_json::from_str(&text).unwrap();
        assert!(!pins.is_empty());
        for (rel, pin) in pins {
            let bytes = std::fs::read(root().join(&rel)).unwrap();
            assert_eq!(
                hex::encode(Sha256::digest(&bytes)),
                pin.sha256,
                "{rel} drifted from manifest"
            );
            let rows = bytes.iter().filter(|&&b| b == b'\n').count() as u64 - 1;
            assert_eq!(rows, pin.rows, "{rel} row count");
        }
    }
}
