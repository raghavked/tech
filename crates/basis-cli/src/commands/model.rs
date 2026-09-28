use anyhow::Result;
use clap::Args;

use super::Ctx;

#[derive(Args, Debug)]
pub struct StandardizeArgs {}
#[derive(Args, Debug)]
pub struct NowcastArgs {}
#[derive(Args, Debug)]
pub struct CurveArgs {}
#[derive(Args, Debug)]
pub struct SpreadsArgs {}

pub fn standardize(_ctx: &Ctx, _a: &StandardizeArgs) -> Result<()> {
    anyhow::bail!("not implemented yet (milestone M3)")
}
pub fn nowcast(_ctx: &Ctx, _a: &NowcastArgs) -> Result<()> {
    anyhow::bail!("not implemented yet (milestone M3)")
}
pub fn curve(_ctx: &Ctx, _a: &CurveArgs) -> Result<()> {
    anyhow::bail!("not implemented yet (milestone M4)")
}
pub fn spreads(_ctx: &Ctx, _a: &SpreadsArgs) -> Result<()> {
    anyhow::bail!("not implemented yet (milestone M5)")
}
