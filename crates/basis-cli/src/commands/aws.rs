use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use basis_connectors::aws::{to_observations, AwsPriceListSource, ParsedPriceList};
use basis_core::store::AppendOutcome;
use clap::{Args, Subcommand};

use super::Ctx;

#[derive(Args, Debug)]
pub struct AwsArgs {
    #[command(subcommand)]
    pub cmd: AwsCmd,
}

#[derive(Subcommand, Debug)]
pub enum AwsCmd {
    /// Stream the regional EC2 price list and print GPU instance prices.
    Fetch {
        /// AWS region code.
        #[arg(long, default_value = "us-east-1")]
        region: String,
        /// Byte cap for the download (the us-east-1 document is ~480 MB).
        #[arg(long, default_value_t = 1_073_741_824)]
        max_bytes: u64,
        /// Parse a previously downloaded document instead of fetching.
        #[arg(long)]
        from_file: Option<PathBuf>,
        /// Write the rows to a CSV file.
        #[arg(long)]
        out: Option<PathBuf>,
        /// Also append the rows and derived observations to the store.
        #[arg(long)]
        ingest: bool,
    },
}

fn load(region: &str, file: Option<&Path>, max_bytes: u64) -> Result<ParsedPriceList> {
    let mut src = AwsPriceListSource::new(region);
    src.max_bytes = max_bytes;
    match file {
        Some(p) => src
            .parse_file(p)
            .with_context(|| format!("parsing {}", p.display())),
        None => {
            eprintln!(
                "streaming {} (cap {} MB) ...",
                basis_connectors::aws::price_list_url(region),
                max_bytes >> 20
            );
            src.fetch_live().context("fetching the AWS price list")
        }
    }
}

fn print_rows(p: &ParsedPriceList) {
    let rows: Vec<Vec<String>> = p
        .rows
        .iter()
        .map(|r| {
            vec![
                r.instance_type.clone(),
                r.gpu.to_string(),
                r.gpu_count.to_string(),
                format!("{:.4}", r.usd_per_hour),
                format!("{:.4}", r.usd_per_gpu_hour),
                r.region.clone(),
                basis_core::date_serde::fmt(r.publication_date),
            ]
        })
        .collect();
    println!(
        "AWS price list {} published {}: {} GPU on-demand rows",
        p.region,
        p.publication_date.as_deref().unwrap_or("?"),
        p.rows.len()
    );
    print!(
        "{}",
        super::table(
            &[
                "instance",
                "gpu",
                "gpus",
                "$/instance-h",
                "$/GPU-h",
                "region",
                "published"
            ],
            &rows
        )
    );
}

fn store_rows(ctx: &Ctx, p: &ParsedPriceList) -> Result<()> {
    let a = ctx
        .store
        .append("aws_pricelist", &p.rows, "aws_pricelist")?;
    let obs = to_observations(p);
    let b = ctx.store.append("observations", &obs, "aws_pricelist")?;
    for (name, o) in [("aws_pricelist", a), ("observations", b)] {
        match o {
            AppendOutcome::Added(pi) => println!("{name}: added {} ({} rows)", pi.file, pi.rows),
            AppendOutcome::AlreadyPresent(pi) => println!("{name}: already present {}", pi.file),
            AppendOutcome::Empty => println!("{name}: nothing to add"),
        }
    }
    Ok(())
}

pub fn run(ctx: &Ctx, a: &AwsArgs) -> Result<()> {
    match &a.cmd {
        AwsCmd::Fetch {
            region,
            max_bytes,
            from_file,
            out,
            ingest,
        } => {
            let p = load(region, from_file.as_deref(), *max_bytes)?;
            print_rows(&p);
            if let Some(path) = out {
                let bytes = basis_core::store::to_csv_bytes(&p.rows)?;
                std::fs::write(path, bytes)?;
                println!("wrote {}", path.display());
            }
            if *ingest {
                store_rows(ctx, &p)?;
            }
            Ok(())
        }
    }
}

/// `basis ingest --source aws`.
pub fn ingest(ctx: &Ctx, region: &str, file: Option<&Path>, max_bytes: u64) -> Result<()> {
    let p = load(region, file, max_bytes)?;
    print_rows(&p);
    store_rows(ctx, &p)
}
