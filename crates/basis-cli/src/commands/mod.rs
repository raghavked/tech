pub mod aws;
pub mod ingest;
pub mod model;
pub mod pipeline;
pub mod store;
pub mod synth;
pub mod trade;

use anyhow::Result;
use basis_core::config::ConfigDir;
use basis_core::Store;

use crate::{Cli, Command, EXIT_CONFIG, EXIT_DATA, EXIT_NETWORK};

/// Shared handles for every command.
#[allow(dead_code)] // config and seed are consumed from milestone M2 onward
pub struct Ctx {
    pub store: Store,
    pub config: ConfigDir,
    pub seed: u64,
}

impl Ctx {
    pub fn from_cli(cli: &Cli) -> Result<Self> {
        let store = Store::open(&cli.store)?;
        Ok(Ctx {
            store,
            config: ConfigDir::new(&cli.config),
            seed: cli.seed,
        })
    }
}

pub fn run(cli: &Cli) -> Result<()> {
    let ctx = Ctx::from_cli(cli)?;
    match &cli.cmd {
        Command::Ingest(a) => ingest::run(&ctx, a),
        Command::Synth(a) => synth::run(&ctx, a),
        Command::Standardize(a) => model::standardize(&ctx, a),
        Command::Nowcast(a) => model::nowcast(&ctx, a),
        Command::Curve(a) => model::curve(&ctx, a),
        Command::Spreads(a) => model::spreads(&ctx, a),
        Command::Backtest(a) => trade::backtest(&ctx, a),
        Command::Ledger(a) => trade::ledger(&ctx, a),
        Command::Report(a) => trade::report(&ctx, a),
        Command::Aws(a) => aws::run(&ctx, a),
        Command::Store(a) => store::run(&ctx, a),
        Command::Pipeline(a) => pipeline::run(&ctx, a),
    }
}

/// Map an error chain to the documented exit codes.
pub fn exit_code(e: &anyhow::Error) -> u8 {
    for cause in e.chain() {
        if let Some(c) = cause.downcast_ref::<basis_core::CoreError>() {
            return match c {
                basis_core::CoreError::Config(_) | basis_core::CoreError::Toml(_) => EXIT_CONFIG,
                _ => EXIT_DATA,
            };
        }
        if let Some(c) = cause.downcast_ref::<basis_connectors::ConnectorError>() {
            return match c {
                basis_connectors::ConnectorError::Blocked(_)
                | basis_connectors::ConnectorError::Http(_) => EXIT_NETWORK,
                basis_connectors::ConnectorError::Core(basis_core::CoreError::Config(_)) => {
                    EXIT_CONFIG
                }
                _ => EXIT_DATA,
            };
        }
    }
    EXIT_DATA
}

/// Render rows as a fixed-width text table.
pub fn table(headers: &[&str], rows: &[Vec<String>]) -> String {
    let mut widths: Vec<usize> = headers.iter().map(|h| h.len()).collect();
    for r in rows {
        for (i, c) in r.iter().enumerate() {
            if i < widths.len() {
                widths[i] = widths[i].max(c.len());
            }
        }
    }
    let line = |cells: Vec<String>| -> String {
        cells
            .iter()
            .enumerate()
            .map(|(i, c)| format!("{:<w$}", c, w = widths.get(i).copied().unwrap_or(0)))
            .collect::<Vec<_>>()
            .join("  ")
            .trim_end()
            .to_string()
    };
    let mut out = line(headers.iter().map(|h| h.to_string()).collect());
    out.push('\n');
    out.push_str(
        &widths
            .iter()
            .map(|w| "-".repeat(*w))
            .collect::<Vec<_>>()
            .join("  "),
    );
    out.push('\n');
    for r in rows {
        out.push_str(&line(r.clone()));
        out.push('\n');
    }
    out
}
