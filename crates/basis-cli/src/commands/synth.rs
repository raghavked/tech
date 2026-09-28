use anyhow::{Context, Result};
use basis_connectors::synth::{generate, parse_date, SynthConfig};
use basis_core::store::AppendOutcome;
use clap::Args;

use super::Ctx;

#[derive(Args, Debug)]
pub struct SynthArgs {
    /// Number of days to generate.
    #[arg(long, default_value_t = 400)]
    pub days: u32,
    /// First day (YYYY-MM-DD).
    #[arg(long, default_value = "2025-09-01")]
    pub start: String,
    /// Providers per tier.
    #[arg(long, default_value_t = 6)]
    pub providers_per_tier: usize,
    /// Small configuration for fixtures and quick tests (45 days, 2 providers per tier).
    #[arg(long)]
    pub tiny: bool,
}

fn line(name: &str, o: &AppendOutcome) -> Vec<String> {
    let (status, part) = match o {
        AppendOutcome::Added(p) => ("added", p.file.clone()),
        AppendOutcome::AlreadyPresent(p) => ("present", p.file.clone()),
        AppendOutcome::Empty => ("empty", String::new()),
    };
    vec![
        name.to_string(),
        status.to_string(),
        part,
        o.rows().to_string(),
    ]
}

pub fn run(ctx: &Ctx, a: &SynthArgs) -> Result<()> {
    let start = parse_date(&a.start)?;
    let cfg = if a.tiny {
        SynthConfig::tiny(ctx.seed, start)
    } else {
        SynthConfig {
            providers_per_tier: a.providers_per_tier,
            ..SynthConfig::new(ctx.seed, start, a.days)
        }
    };
    let out = generate(&cfg).context("generating synthetic data")?;
    let s = &ctx.store;
    let rows = vec![
        line(
            "observations",
            &s.append("observations", &out.observations, "synth")?,
        ),
        line(
            "index_prints",
            &s.append("index_prints", &out.index_prints, "synth")?,
        ),
        line("power", &s.append("power", &out.power, "synth")?),
        line("futures", &s.append("futures", &out.futures, "synth")?),
    ];
    println!(
        "synthetic world: seed={} start={} days={} providers/tier={}",
        cfg.seed, cfg.start, cfg.days, cfg.providers_per_tier
    );
    print!(
        "{}",
        super::table(&["dataset", "status", "part", "rows"], &rows)
    );
    Ok(())
}
