//! `basis`: the command-line interface for the compute-commodity desk.

mod commands;

use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};

/// Exit codes: 0 ok, 2 config error, 3 data error, 4 network/blocked.
pub const EXIT_CONFIG: u8 = 2;
pub const EXIT_DATA: u8 = 3;
pub const EXIT_NETWORK: u8 = 4;

#[derive(Parser, Debug)]
#[command(
    name = "basis",
    version,
    about = "Quant desk for GPU compute as a commodity"
)]
pub struct Cli {
    /// Store directory (raw parts, derived datasets, reports).
    #[arg(long, global = true, env = "BASIS_STORE", default_value = "./store")]
    pub store: PathBuf,
    /// Configuration directory.
    #[arg(long, global = true, env = "BASIS_CONFIG", default_value = "./config")]
    pub config: PathBuf,
    /// Seed for every deterministic step.
    #[arg(long, global = true, env = "BASIS_SEED", default_value_t = 42)]
    pub seed: u64,
    /// Verbose logging (-v info, -vv debug).
    #[arg(short, long, global = true, action = clap::ArgAction::Count)]
    pub verbose: u8,
    #[command(subcommand)]
    pub cmd: Command,
}

#[derive(Subcommand, Debug)]
pub enum Command {
    /// Ingest raw data from a source into the store.
    Ingest(commands::ingest::IngestArgs),
    /// Generate synthetic market data into the store.
    Synth(commands::synth::SynthArgs),
    /// Standardize observations onto each index's reference specification.
    Standardize(commands::model::StandardizeArgs),
    /// Nowcast each settlement index and the listed contracts' settlements.
    Nowcast(commands::model::NowcastArgs),
    /// Build the fair-value forward curve from the supply stack.
    Curve(commands::model::CurveArgs),
    /// Compute basis, calendar, cross-index, cross-GPU and compute spark spreads.
    Spreads(commands::model::SpreadsArgs),
    /// Run the paper-trading backtest.
    Backtest(commands::trade::BacktestArgs),
    /// Show the paper ledger.
    Ledger(commands::trade::LedgerArgs),
    /// Write the daily desk report.
    Report(commands::trade::ReportArgs),
    /// AWS public price-list utilities.
    Aws(commands::aws::AwsArgs),
    /// Inspect the store.
    Store(commands::store::StoreArgs),
    /// Run every step end to end.
    Pipeline(commands::pipeline::PipelineArgs),
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let level = match cli.verbose {
        0 => "warn",
        1 => "info",
        _ => "debug",
    };
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or(level))
        .format_timestamp(None)
        .init();
    match commands::run(&cli) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e:#}");
            ExitCode::from(commands::exit_code(&e))
        }
    }
}
