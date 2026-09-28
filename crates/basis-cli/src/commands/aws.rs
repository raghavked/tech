use std::path::Path;

use anyhow::Result;
use clap::Args;

use super::Ctx;

#[derive(Args, Debug)]
pub struct AwsArgs {}

pub fn run(_ctx: &Ctx, _a: &AwsArgs) -> Result<()> {
    anyhow::bail!("not implemented yet (milestone M7)")
}

pub fn ingest(_ctx: &Ctx, _region: &str, _file: Option<&Path>, _max_bytes: u64) -> Result<()> {
    anyhow::bail!("not implemented yet (milestone M7)")
}
