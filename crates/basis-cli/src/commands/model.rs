use anyhow::{Context, Result};
use basis_core::config::IndicesConfig;
use basis_core::types::*;
use basis_model::config::{NowcastSection, StandardizationConfig};
use basis_model::nowcast;
use basis_model::standardize::standardize as standardize_rows;
use clap::Args;
use time::Date;

use super::Ctx;

#[derive(Args, Debug)]
pub struct StandardizeArgs {
    /// Restrict to one index id (default: all configured indices).
    #[arg(long)]
    pub index: Option<String>,
}

#[derive(Args, Debug)]
pub struct NowcastArgs {
    /// Restrict to one index id.
    #[arg(long)]
    pub index: Option<String>,
    /// Nowcast date for settlement estimates (default: last date with an estimate).
    #[arg(long)]
    pub as_of: Option<String>,
    /// Bootstrap replicates (0 = analytic standard errors).
    #[arg(long)]
    pub boot: Option<usize>,
    /// Compare estimates with published prints and print MAE / RMSE / CI coverage.
    #[arg(long)]
    pub evaluate: bool,
}

#[derive(Args, Debug)]
pub struct CurveArgs {
    /// Curve date (default: last observation date).
    #[arg(long)]
    pub as_of: Option<String>,
    /// Number of monthly tenors.
    #[arg(long)]
    pub tenors: Option<u32>,
}

#[derive(Args, Debug)]
pub struct SpreadsArgs {
    /// Restrict to one date (default: every date with estimates and futures).
    #[arg(long)]
    pub as_of: Option<String>,
}

fn load_std_cfg(ctx: &Ctx) -> Result<StandardizationConfig> {
    ctx.config
        .load("standardization.toml")
        .context("loading standardization.toml")
}

fn selected_indices(ctx: &Ctx, only: &Option<String>) -> Result<IndicesConfig> {
    let mut cfg = ctx.config.indices().context("loading indices.toml")?;
    if let Some(id) = only {
        cfg.indices.retain(|i| i.id.as_str() == id);
        if cfg.indices.is_empty() {
            anyhow::bail!("unknown index `{id}`");
        }
    }
    Ok(cfg)
}

pub fn parse_date(s: &str) -> Result<Date> {
    basis_core::date_serde::parse(s).with_context(|| format!("bad date `{s}`"))
}

/// Standardize + flag; returns rows and writes `derived/standardized.csv`.
pub fn run_standardize(ctx: &Ctx, only: &Option<String>) -> Result<Vec<StandardizedObservation>> {
    let obs: Vec<PriceObservation> = ctx.store.read_all("observations")?;
    if obs.is_empty() {
        anyhow::bail!("no observations in store; run `basis ingest` or `basis synth` first");
    }
    let indices = selected_indices(ctx, only)?;
    let cfg = load_std_cfg(ctx)?;
    let mut rows = Vec::new();
    for spec in &indices.indices {
        rows.extend(standardize_rows(&obs, spec, &cfg));
    }
    // flag pass (cheap): aggregate each group so standardized.csv carries the flags
    let params = nowcast_params(ctx)?;
    let quick = basis_model::config::NowcastParams {
        bootstrap_reps: 0,
        ..params
    };
    let res = nowcast::nowcast_all(
        &rows,
        &[],
        &indices,
        &quick,
        cfg.weights.min_observations,
        ctx.seed,
    )?;
    for r in rows.iter_mut() {
        if let Some(f) = res.flags.get(&r.obs_id) {
            r.flags = f.clone();
        }
    }
    rows.sort_by(|a, b| (a.date, &a.index_id, &a.obs_id).cmp(&(b.date, &b.index_id, &b.obs_id)));
    ctx.store.write_derived("standardized", &rows)?;
    Ok(rows)
}

fn nowcast_params(ctx: &Ctx) -> Result<basis_model::config::NowcastParams> {
    let sec: NowcastSection = ctx
        .config
        .load("strategies.toml")
        .context("loading strategies.toml")?;
    Ok(sec.nowcast)
}

pub fn standardize_cmd(ctx: &Ctx, a: &StandardizeArgs) -> Result<()> {
    let rows = run_standardize(ctx, &a.index)?;
    let mut by_index: std::collections::BTreeMap<String, (usize, usize, usize)> =
        Default::default();
    for r in &rows {
        let e = by_index.entry(r.index_id.to_string()).or_default();
        e.0 += 1;
        if r.flags.contains("outlier") {
            e.1 += 1;
        }
        if r.flags.contains("capped") {
            e.2 += 1;
        }
    }
    let table_rows: Vec<Vec<String>> = by_index
        .iter()
        .map(|(k, v)| vec![k.clone(), v.0.to_string(), v.1.to_string(), v.2.to_string()])
        .collect();
    print!(
        "{}",
        super::table(&["index", "rows", "outliers", "capped"], &table_rows)
    );
    println!("wrote {}", ctx.store.derived_path("standardized").display());
    Ok(())
}

pub fn nowcast_cmd(ctx: &Ctx, a: &NowcastArgs) -> Result<()> {
    let rows: Vec<StandardizedObservation> = match ctx.store.read_derived("standardized") {
        Ok(r) => r,
        Err(_) => run_standardize(ctx, &a.index)?,
    };
    let rows: Vec<StandardizedObservation> = match &a.index {
        Some(id) => rows
            .into_iter()
            .filter(|r| r.index_id.as_str() == id)
            .collect(),
        None => rows,
    };
    let indices = selected_indices(ctx, &a.index)?;
    let cfg = load_std_cfg(ctx)?;
    let mut params = nowcast_params(ctx)?;
    if let Some(b) = a.boot {
        params.bootstrap_reps = b;
    }
    let prints: Vec<IndexPrint> = ctx.store.read_all("index_prints").unwrap_or_default();
    let res = nowcast::nowcast_all(
        &rows,
        &prints,
        &indices,
        &params,
        cfg.weights.min_observations,
        ctx.seed,
    )?;
    if res.estimates.is_empty() {
        anyhow::bail!("no estimates produced (too few observations per day?)");
    }
    ctx.store.write_derived("estimates", &res.estimates)?;

    let as_of = match &a.as_of {
        Some(s) => parse_date(s)?,
        None => res.estimates.iter().map(|e| e.date).max().unwrap(),
    };
    let curve: Vec<ForwardCurvePoint> = ctx.store.read_derived("curve").unwrap_or_default();
    let contracts = ctx.config.contracts().context("loading contracts.toml")?;
    let listed = contracts
        .contracts
        .iter()
        .map(|c| c.listed_months)
        .max()
        .unwrap_or(6);
    let settles = nowcast::settlement_estimates(
        &res.estimates,
        &prints,
        &curve,
        &indices,
        &contracts,
        &params,
        as_of,
        listed,
    );
    ctx.store.write_derived("settlements", &settles)?;

    // latest estimate per index
    let mut latest: std::collections::BTreeMap<String, &IndexEstimate> = Default::default();
    for e in &res.estimates {
        latest.insert(e.index_id.to_string(), e);
    }
    let table_rows: Vec<Vec<String>> = latest
        .values()
        .map(|e| {
            vec![
                basis_core::date_serde::fmt(e.date),
                e.index_id.to_string(),
                format!("{:.4}", e.estimate),
                format!("{:.4}", e.se),
                format!("[{:.3}, {:.3}]", e.ci_low, e.ci_high),
                format!("{}/{}", e.n_used, e.n_obs),
                e.n_providers.to_string(),
                format!("{:.3}+{:.3}c", e.calib_alpha, e.calib_beta),
                e.method.clone(),
            ]
        })
        .collect();
    println!(
        "latest nowcasts ({} estimate rows written, curve {})",
        res.estimates.len(),
        if curve.is_empty() {
            "absent: settlement forecasts use today's level"
        } else {
            "used"
        }
    );
    print!(
        "{}",
        super::table(
            &["date", "index", "estimate", "se", "ci90", "used/obs", "prov", "calib", "method"],
            &table_rows
        )
    );
    let srows: Vec<Vec<String>> = settles
        .iter()
        .map(|s| {
            vec![
                s.contract_id.to_string(),
                s.style.to_string(),
                format!("{}/{}", s.realized_days, s.realized_days + s.remaining_days),
                format!("{:.4}", s.estimate),
                format!("{:.4}", s.se),
            ]
        })
        .collect();
    println!(
        "settlement estimates as of {}",
        basis_core::date_serde::fmt(as_of)
    );
    print!(
        "{}",
        super::table(
            &["contract", "style", "realized/total", "estimate", "se"],
            &srows
        )
    );

    if a.evaluate {
        let ev = nowcast::evaluate(&res.estimates, &prints);
        if ev.is_empty() {
            println!("evaluate: no published prints overlap the estimates");
        } else {
            let erows: Vec<Vec<String>> = ev
                .iter()
                .map(|r| {
                    vec![
                        r.index_id.to_string(),
                        r.n.to_string(),
                        format!("{:.4}", r.mae),
                        format!("{:.4}", r.rmse),
                        format!("{:.2}%", r.mape * 100.0),
                        format!("{:.1}%", r.coverage * 100.0),
                    ]
                })
                .collect();
            println!("evaluation vs published prints (90% CI coverage target ~90%)");
            print!(
                "{}",
                super::table(&["index", "n", "mae", "rmse", "mape", "coverage"], &erows)
            );
        }
    }
    Ok(())
}

pub fn standardize(ctx: &Ctx, a: &StandardizeArgs) -> Result<()> {
    standardize_cmd(ctx, a)
}
pub fn nowcast(ctx: &Ctx, a: &NowcastArgs) -> Result<()> {
    nowcast_cmd(ctx, a)
}
pub fn curve(_ctx: &Ctx, _a: &CurveArgs) -> Result<()> {
    anyhow::bail!("not implemented yet (milestone M4)")
}
pub fn spreads(_ctx: &Ctx, _a: &SpreadsArgs) -> Result<()> {
    anyhow::bail!("not implemented yet (milestone M5)")
}
