use anyhow::Result;
use clap::Args;

use super::Ctx;

#[derive(Args, Debug)]
pub struct BacktestArgs {}
#[derive(Args, Debug)]
pub struct LedgerArgs {}
#[derive(Args, Debug)]
pub struct ReportArgs {}

pub fn backtest(_ctx: &Ctx, _a: &BacktestArgs) -> Result<()> {
    anyhow::bail!("not implemented yet (milestone M6)")
}
pub fn ledger(_ctx: &Ctx, _a: &LedgerArgs) -> Result<()> {
    anyhow::bail!("not implemented yet (milestone M6)")
}
pub fn report(_ctx: &Ctx, _a: &ReportArgs) -> Result<()> {
    anyhow::bail!("not implemented yet (milestone M6)")
}
