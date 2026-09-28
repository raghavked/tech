use std::path::PathBuf;

use anyhow::{Context, Result};
use basis_connectors::sample::SampleBundle;
use basis_core::store::AppendOutcome;
use clap::Args;

use super::Ctx;

#[derive(Args, Debug)]
pub struct IngestArgs {
    /// Source id: `sample` or `aws`.
    #[arg(long)]
    pub source: String,
    /// Directory of the committed samples (for `--source sample`).
    #[arg(long, default_value = "data/samples")]
    pub from: PathBuf,
    /// AWS region (for `--source aws`).
    #[arg(long, default_value = "us-east-1")]
    pub region: String,
    /// Parse a previously downloaded AWS price-list file instead of fetching.
    #[arg(long)]
    pub from_file: Option<PathBuf>,
    /// Byte cap for the AWS download.
    #[arg(long, default_value_t = 1_073_741_824)]
    pub max_bytes: u64,
}

fn describe(name: &str, out: &AppendOutcome) -> Vec<String> {
    match out {
        AppendOutcome::Added(p) => vec![
            name.into(),
            "added".into(),
            p.file.clone(),
            p.rows.to_string(),
        ],
        AppendOutcome::AlreadyPresent(p) => {
            vec![
                name.into(),
                "present".into(),
                p.file.clone(),
                p.rows.to_string(),
            ]
        }
        AppendOutcome::Empty => vec![name.into(), "empty".into(), String::new(), "0".into()],
    }
}

pub fn run(ctx: &Ctx, a: &IngestArgs) -> Result<()> {
    match a.source.as_str() {
        "sample" => {
            let b = SampleBundle::load(&a.from)
                .with_context(|| format!("loading samples from {}", a.from.display()))?;
            let s = &ctx.store;
            let rows = vec![
                describe(
                    "observations",
                    &s.append("observations", &b.observations, "sample")?,
                ),
                describe("power", &s.append("power", &b.power, "sample")?),
                describe("futures", &s.append("futures", &b.futures, "sample")?),
                describe(
                    "index_prints",
                    &s.append("index_prints", &b.index_prints, "sample")?,
                ),
                describe(
                    "fleet_cohorts",
                    &s.append("fleet_cohorts", &b.fleet_cohorts, "sample")?,
                ),
                describe("pipeline", &s.append("pipeline", &b.pipeline, "sample")?),
                describe("demand", &s.append("demand", &b.demand, "sample")?),
                describe("perf", &s.append("perf", &b.perf, "sample")?),
            ];
            print!(
                "{}",
                super::table(&["dataset", "status", "part", "rows"], &rows)
            );
            Ok(())
        }
        "aws" => super::aws::ingest(ctx, &a.region, a.from_file.as_deref(), a.max_bytes),
        other => Err(basis_connectors::ConnectorError::UnknownSource(other.to_string()).into()),
    }
}
