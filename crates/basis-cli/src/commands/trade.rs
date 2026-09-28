use anyhow::{Context, Result};
use basis_core::types::*;
use basis_trade::backtest::{run, BacktestInputs};
use basis_trade::metrics;
use basis_trade::report::{build, ReportInputs};
use basis_trade::risk::{RiskEngine, RiskParams};
use basis_trade::strategies::{self, StrategiesConfig};
use clap::Args;

use super::model::parse_date;
use super::Ctx;

#[derive(Args, Debug)]
pub struct BacktestArgs {
    /// Comma-separated strategy ids (basis_mr, cross_index).
    #[arg(long, default_value = "basis_mr,cross_index", value_delimiter = ',')]
    pub strategies: Vec<String>,
    /// First date (YYYY-MM-DD).
    #[arg(long)]
    pub from: Option<String>,
    /// Last date (YYYY-MM-DD).
    #[arg(long)]
    pub to: Option<String>,
}

#[derive(Args, Debug)]
pub struct LedgerArgs {
    /// Restrict to one strategy.
    #[arg(long)]
    pub strategy: Option<String>,
    /// Show only the last N rows.
    #[arg(long, default_value_t = 30)]
    pub tail: usize,
}

#[derive(Args, Debug)]
pub struct ReportArgs {
    /// Report date (default: last date with estimates).
    #[arg(long)]
    pub date: Option<String>,
}

/// True when any futures part in the store came from the synthetic generator.
fn futures_are_synthetic(ctx: &Ctx) -> bool {
    ctx.store
        .manifest()
        .ok()
        .and_then(|m| {
            m.datasets
                .get("futures")
                .map(|d| d.parts.iter().any(|p| p.source == "synth"))
        })
        .unwrap_or(false)
}

pub fn backtest(ctx: &Ctx, a: &BacktestArgs) -> Result<()> {
    let futures: Vec<FuturesQuote> = ctx.store.read_all("futures")?;
    let spreads: Vec<Spread> = ctx
        .store
        .read_derived("spreads")
        .context("run `basis spreads` first")?;
    let estimates: Vec<IndexEstimate> = ctx
        .store
        .read_derived("estimates")
        .context("run `basis nowcast` first")?;
    let prints: Vec<IndexPrint> = ctx.store.read_all("index_prints").unwrap_or_default();
    let contracts = ctx.config.contracts()?;
    let risk_params: RiskParams = ctx.config.load("risk.toml").context("loading risk.toml")?;
    let scfg: StrategiesConfig = ctx
        .config
        .load("strategies.toml")
        .context("loading strategies.toml")?;
    let mut strats = strategies::build(
        &a.strategies,
        &scfg,
        risk_params.kappa_equity_per_sigma,
        risk_params.exit_days_before_expiry,
    )
    .map_err(|e| anyhow::anyhow!(e))?;
    let synthetic = futures_are_synthetic(ctx);
    let inp = BacktestInputs {
        futures: &futures,
        spreads: &spreads,
        estimates: &estimates,
        prints: &prints,
        contracts: &contracts,
        from: a.from.as_deref().map(parse_date).transpose()?,
        to: a.to.as_deref().map(parse_date).transpose()?,
        futures_source: if synthetic {
            "synth".into()
        } else {
            "store".into()
        },
    };
    let mut risk = RiskEngine::new(risk_params.clone());
    let out = run(&inp, &mut strats, &mut risk)?;
    ctx.store.write_derived("ledger", &out.ledger)?;
    ctx.store.write_derived("equity", &out.equity)?;
    ctx.store.write_derived("signals", &out.signals)?;
    ctx.store.write_derived("positions", &out.positions)?;
    let m = metrics::compute(&out.equity, &out.ledger);
    if synthetic {
        println!("NOTE: futures in this store are synthetic (basis synth); results validate plumbing, not alpha.");
    }
    println!("HYPOTHETICAL PERFORMANCE: paper trading on modelled fills; no orders are sent to any venue.");
    let rows = vec![
        vec!["days".into(), m.days.to_string()],
        vec![
            "starting equity".into(),
            format!("{:.2}", m.starting_equity),
        ],
        vec!["final equity".into(), format!("{:.2}", m.final_equity)],
        vec!["total P&L".into(), format!("{:.2}", m.total_pnl)],
        vec![
            "total return".into(),
            format!("{:.2}%", m.total_return * 100.0),
        ],
        vec![
            "annualized return".into(),
            format!("{:.2}%", m.annualized_return * 100.0),
        ],
        vec!["Sharpe (daily, 252)".into(), format!("{:.2}", m.sharpe)],
        vec![
            "max drawdown".into(),
            format!("{:.2}%", m.max_drawdown * 100.0),
        ],
        vec!["hit rate".into(), format!("{:.0}%", m.hit_rate * 100.0)],
        vec![
            "turnover (contracts/day)".into(),
            format!("{:.2}", m.turnover_contracts_per_day),
        ],
        vec!["fees paid".into(), format!("{:.2}", m.fees_paid)],
        vec![
            "risk events / stops".into(),
            format!("{} / {}", m.risk_events, m.stop_events),
        ],
        vec!["signals".into(), out.signals.len().to_string()],
    ];
    print!("{}", super::table(&["metric", "value"], &rows));
    let srows: Vec<Vec<String>> = m
        .per_strategy
        .iter()
        .map(|(k, s)| {
            vec![
                k.clone(),
                format!("{:.2}", s.realized_pnl),
                format!("{:.2}", s.fees),
                s.fills.to_string(),
                format!("{}/{}", s.wins, s.losses),
            ]
        })
        .collect();
    print!(
        "{}",
        super::table(
            &["strategy", "realized P&L", "fees", "fills", "wins/losses"],
            &srows
        )
    );
    println!("wrote derived/{{ledger,equity,signals,positions}}.csv");
    Ok(())
}

pub fn ledger(ctx: &Ctx, a: &LedgerArgs) -> Result<()> {
    let rows: Vec<LedgerEntry> = ctx
        .store
        .read_derived("ledger")
        .context("run `basis backtest` first")?;
    let rows: Vec<&LedgerEntry> = rows
        .iter()
        .filter(|r| {
            a.strategy
                .as_ref()
                .map(|s| &r.strategy == s)
                .unwrap_or(true)
        })
        .collect();
    let start = rows.len().saturating_sub(a.tail);
    let t: Vec<Vec<String>> = rows[start..]
        .iter()
        .map(|r| {
            vec![
                r.seq.to_string(),
                basis_core::date_serde::fmt(r.date),
                r.strategy.clone(),
                r.contract_id.clone(),
                r.kind.to_string(),
                r.qty.to_string(),
                r.price.to_string(),
                r.cash_delta.round_dp(2).to_string(),
                r.position_after.to_string(),
                r.equity_after.round_dp(2).to_string(),
                r.note.clone(),
            ]
        })
        .collect();
    print!(
        "{}",
        super::table(
            &[
                "seq", "date", "strategy", "contract", "kind", "qty", "price", "cash Δ", "pos",
                "equity", "note"
            ],
            &t
        )
    );
    Ok(())
}

pub fn report(ctx: &Ctx, a: &ReportArgs) -> Result<()> {
    let estimates: Vec<IndexEstimate> = ctx
        .store
        .read_derived("estimates")
        .context("run `basis nowcast` first")?;
    let date = match &a.date {
        Some(s) => parse_date(s)?,
        None => estimates
            .iter()
            .map(|e| e.date)
            .max()
            .context("no estimates")?,
    };
    let settlements: Vec<SettlementEstimate> =
        ctx.store.read_derived("settlements").unwrap_or_default();
    let curve: Vec<ForwardCurvePoint> = ctx.store.read_derived("curve").unwrap_or_default();
    let spreads: Vec<Spread> = ctx.store.read_derived("spreads").unwrap_or_default();
    let positions: Vec<Position> = ctx.store.read_derived("positions").unwrap_or_default();
    let equity: Vec<DailyEquity> = ctx.store.read_derived("equity").unwrap_or_default();
    let ledger: Vec<LedgerEntry> = ctx.store.read_derived("ledger").unwrap_or_default();
    let signals: Vec<Signal> = ctx.store.read_derived("signals").unwrap_or_default();
    let standardized: Vec<StandardizedObservation> =
        ctx.store.read_derived("standardized").unwrap_or_default();
    let observations: Vec<PriceObservation> = ctx.store.read_all("observations")?;
    let risk_params: Option<RiskParams> = ctx.config.load("risk.toml").ok();
    let m = if equity.is_empty() {
        None
    } else {
        Some(metrics::compute(&equity, &ledger))
    };
    let rep = build(&ReportInputs {
        date,
        estimates: &estimates,
        settlements: &settlements,
        curve: &curve,
        spreads: &spreads,
        positions: &positions,
        equity: &equity,
        signals: &signals,
        standardized: &standardized,
        observations: &observations,
        metrics: m.as_ref(),
        synthetic_markets: futures_are_synthetic(ctx),
        risk_limits: risk_params
            .map(|r| (r.max_gross_notional_usd, r.max_net_gpu_hours_per_family)),
    });
    let dir = ctx
        .store
        .reports_dir()
        .join(basis_core::date_serde::fmt(date));
    std::fs::create_dir_all(&dir)?;
    std::fs::write(dir.join("desk_report.md"), &rep.markdown)?;
    let mut w = csv::Writer::from_path(dir.join("summary.csv"))?;
    w.write_record(["metric", "value"])?;
    for (k, v) in &rep.summary {
        w.write_record([k, v])?;
    }
    w.flush()?;
    let mut w = csv::Writer::from_path(dir.join("data_quality.csv"))?;
    w.write_record(["check", "scope", "value"])?;
    for r in &rep.data_quality {
        w.write_record(r)?;
    }
    w.flush()?;
    let today_pos: Vec<&Position> = positions.iter().collect();
    let mut w = csv::Writer::from_path(dir.join("positions.csv"))?;
    for p in &today_pos {
        w.serialize(p)?;
    }
    w.flush()?;
    let today_sig: Vec<&Signal> = signals.iter().filter(|s| s.date == date).collect();
    let mut w = csv::Writer::from_path(dir.join("signals.csv"))?;
    for s in &today_sig {
        w.serialize(s)?;
    }
    w.flush()?;
    println!("wrote {}", dir.join("desk_report.md").display());
    Ok(())
}
