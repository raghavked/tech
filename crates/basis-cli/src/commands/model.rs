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
fn load_supply_model_inputs(
    ctx: &Ctx,
) -> Result<(
    Vec<FleetCohort>,
    Vec<PipelineProject>,
    Vec<DemandAssumption>,
    Vec<PerfRatio>,
)> {
    let cohorts: Vec<FleetCohort> = ctx.store.read_all("fleet_cohorts")?;
    let pipeline: Vec<PipelineProject> = ctx.store.read_all("pipeline")?;
    let demand: Vec<DemandAssumption> = ctx.store.read_all("demand")?;
    let perf: Vec<PerfRatio> = ctx.store.read_all("perf")?;
    if cohorts.is_empty() || demand.is_empty() {
        anyhow::bail!("supply-stack assumptions missing; run `basis ingest --source sample` first");
    }
    Ok((cohorts, pipeline, demand, perf))
}

/// Dates for which the curve is (re)built: every estimate date, else every futures date.
fn curve_dates(ctx: &Ctx, as_of: &Option<String>) -> Result<Vec<Date>> {
    if let Some(s) = as_of {
        return Ok(vec![parse_date(s)?]);
    }
    let mut dates: std::collections::BTreeSet<Date> = Default::default();
    if let Ok(est) = ctx.store.read_derived::<IndexEstimate>("estimates") {
        dates.extend(est.iter().map(|e| e.date));
    }
    if dates.is_empty() {
        let fut: Vec<FuturesQuote> = ctx.store.read_all("futures")?;
        dates.extend(fut.iter().map(|f| f.date));
    }
    if dates.is_empty() {
        let obs: Vec<PriceObservation> = ctx.store.read_all("observations")?;
        dates.extend(obs.iter().map(|o| o.date()));
    }
    if dates.is_empty() {
        anyhow::bail!("no dates found in the store");
    }
    Ok(dates.into_iter().collect())
}

pub fn curve(ctx: &Ctx, a: &CurveArgs) -> Result<()> {
    use basis_model::curve::{build_curve, trailing_power};
    use basis_model::supply::{CostStack, SupplyModel, SupplyParams};
    let mut params: SupplyParams = ctx
        .config
        .load("supply.toml")
        .context("loading supply.toml")?;
    if let Some(t) = a.tenors {
        params.tenors = t;
    }
    let cost = ctx.config.cost_stack().context("loading cost_stack.toml")?;
    let (cohorts, pipeline, demand, perf) = load_supply_model_inputs(ctx)?;
    let power: Vec<PowerPrice> = ctx.store.read_all("power").unwrap_or_default();
    let dates = curve_dates(ctx, &a.as_of)?;
    let mut out = Vec::new();
    for d in &dates {
        let model = SupplyModel {
            params: &params,
            cost: CostStack::new(&cost),
            cohorts: &cohorts,
            pipeline: &pipeline,
            demand: &demand,
            perf: &perf,
            power: trailing_power(&power, *d, params.power_lookback_days),
        };
        out.extend(build_curve(&model, &params, *d)?);
    }
    ctx.store.write_derived("curve", &out)?;
    let last = *dates.last().unwrap();
    let rows: Vec<Vec<String>> = out
        .iter()
        .filter(|c| c.as_of == last)
        .map(|c| {
            vec![
                c.gpu.to_string(),
                c.tenor.to_string(),
                format!("{:.4}", c.fair_value),
                format!("{:.3}", c.srmc_floor),
                format!("{:.3}", c.lrmc_ceiling),
                format!("{:.1}M", c.supply_gpu_hours / 1e6),
                format!("{:.1}M", c.demand_gpu_hours / 1e6),
                format!("{:.1}%", c.utilization * 100.0),
            ]
        })
        .collect();
    println!(
        "forward curve as of {} ({} dates, {} rows written)",
        basis_core::date_serde::fmt(last),
        dates.len(),
        out.len()
    );
    print!(
        "{}",
        super::table(
            &[
                "gpu",
                "tenor",
                "fair",
                "srmc_floor",
                "lrmc_ceil",
                "supply/mo",
                "demand/mo",
                "util"
            ],
            &rows
        )
    );
    Ok(())
}

pub fn spreads(ctx: &Ctx, a: &SpreadsArgs) -> Result<()> {
    use basis_model::spreads::{compute_all, SpreadInputs, SpreadsSection};
    let estimates: Vec<IndexEstimate> = ctx
        .store
        .read_derived("estimates")
        .context("run `basis nowcast` first")?;
    let prints: Vec<IndexPrint> = ctx.store.read_all("index_prints").unwrap_or_default();
    let futures: Vec<FuturesQuote> = ctx.store.read_all("futures")?;
    let curve: Vec<ForwardCurvePoint> = ctx.store.read_derived("curve").unwrap_or_default();
    let power: Vec<PowerPrice> = ctx.store.read_all("power").unwrap_or_default();
    let perf: Vec<PerfRatio> = ctx.store.read_all("perf").unwrap_or_default();
    let cost = ctx.config.cost_stack()?;
    let indices = ctx.config.indices()?;
    let contracts = ctx.config.contracts()?;
    let nowcast_p = nowcast_params(ctx)?;
    let sec: SpreadsSection = ctx.config.load("strategies.toml")?;
    let estimates: Vec<IndexEstimate> = match &a.as_of {
        Some(s) => {
            let d = parse_date(s)?;
            estimates.into_iter().filter(|e| e.date <= d).collect()
        }
        None => estimates,
    };
    let inp = SpreadInputs {
        estimates: &estimates,
        prints: &prints,
        futures: &futures,
        curve: &curve,
        power: &power,
        perf: &perf,
        cost: &cost,
        indices: &indices,
        contracts: &contracts,
        nowcast: &nowcast_p,
        params: &sec.spreads,
    };
    let mut out = compute_all(&inp)?;
    if let Some(s) = &a.as_of {
        let d = parse_date(s)?;
        out.retain(|r| r.date == d);
    }
    if out.is_empty() {
        anyhow::bail!("no spreads computed: need estimates and futures on common dates");
    }
    ctx.store.write_derived("spreads", &out)?;
    let last = out.iter().map(|s| s.date).max().unwrap();
    let rows: Vec<Vec<String>> = out
        .iter()
        .filter(|s| s.date == last)
        .map(|s| {
            vec![
                s.kind.to_string(),
                s.spread_id.clone(),
                format!("{:.4}", s.value),
                format!("{:.4}", s.fair_value),
                s.z.map(|z| format!("{z:.2}")).unwrap_or_else(|| "-".into()),
            ]
        })
        .collect();
    println!(
        "spreads as of {} ({} rows written over {} dates)",
        basis_core::date_serde::fmt(last),
        out.len(),
        out.iter()
            .map(|s| s.date)
            .collect::<std::collections::BTreeSet<_>>()
            .len()
    );
    print!(
        "{}",
        super::table(&["kind", "spread", "value", "fair", "z"], &rows)
    );
    Ok(())
}
