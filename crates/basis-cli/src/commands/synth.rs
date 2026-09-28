use anyhow::Result;
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
    /// Small configuration for fixtures and quick tests.
    #[arg(long)]
    pub tiny: bool,
}

pub fn run(_ctx: &Ctx, _a: &SynthArgs) -> Result<()> {
    anyhow::bail!("synth: not implemented yet (milestone M2)")
}
