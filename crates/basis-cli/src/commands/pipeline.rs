use anyhow::Result;
use clap::Args;

use super::Ctx;

#[derive(Args, Debug)]
pub struct PipelineArgs {}

pub fn run(_ctx: &Ctx, _a: &PipelineArgs) -> Result<()> {
    anyhow::bail!("not implemented yet (milestone M8)")
}
