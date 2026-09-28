use std::path::PathBuf;
use std::time::Instant;

use anyhow::{Context, Result};
use clap::Args;

use super::{ingest, model, synth, trade, Ctx};

#[derive(Args, Debug)]
pub struct PipelineArgs {
    /// Days of synthetic market data to generate (0 = samples only).
    #[arg(long, default_value_t = 400)]
    pub synth_days: u32,
    /// First synthetic day.
    #[arg(long, default_value = "2025-09-01")]
    pub synth_start: String,
    /// Small run for fixtures and quick tests.
    #[arg(long)]
    pub tiny: bool,
    /// Directory of the committed samples.
    #[arg(long, default_value = "data/samples")]
    pub samples: PathBuf,
    /// Strategies for the backtest.
    #[arg(long, default_value = "basis_mr,cross_index", value_delimiter = ',')]
    pub strategies: Vec<String>,
    /// Skip the backtest and report steps.
    #[arg(long)]
    pub no_backtest: bool,
}

fn step<T>(name: &str, f: impl FnOnce() -> Result<T>) -> Result<T> {
    let t = Instant::now();
    println!("==> {name}");
    let r = f().with_context(|| format!("pipeline step `{name}` failed"))?;
    println!("<== {name} ({:.1}s)", t.elapsed().as_secs_f64());
    Ok(r)
}

pub fn run(ctx: &Ctx, a: &PipelineArgs) -> Result<()> {
    step("ingest samples", || {
        ingest::run(
            ctx,
            &ingest::IngestArgs {
                source: "sample".into(),
                from: a.samples.clone(),
                region: "us-east-1".into(),
                from_file: None,
                max_bytes: 0,
            },
        )
    })?;
    if a.synth_days > 0 || a.tiny {
        step("synthesize markets", || {
            synth::run(
                ctx,
                &synth::SynthArgs {
                    days: a.synth_days,
                    start: a.synth_start.clone(),
                    providers_per_tier: 6,
                    tiny: a.tiny,
                },
            )
        })?;
    }
    step("standardize", || {
        model::standardize(ctx, &model::StandardizeArgs { index: None })
    })?;
    step("curve", || {
        model::curve(
            ctx,
            &model::CurveArgs {
                as_of: None,
                tenors: None,
            },
        )
    })?;
    step("nowcast", || {
        model::nowcast(
            ctx,
            &model::NowcastArgs {
                index: None,
                as_of: None,
                boot: if a.tiny { Some(100) } else { None },
                evaluate: true,
            },
        )
    })?;
    step("spreads", || {
        model::spreads(ctx, &model::SpreadsArgs { as_of: None })
    })?;
    if !a.no_backtest {
        step("backtest", || {
            trade::backtest(
                ctx,
                &trade::BacktestArgs {
                    strategies: a.strategies.clone(),
                    from: None,
                    to: None,
                },
            )
        })?;
        step("report", || {
            trade::report(ctx, &trade::ReportArgs { date: None })
        })?;
    }
    println!("pipeline complete: store at {}", ctx.store.root().display());
    Ok(())
}
