//! Nowcast: robust aggregation of standardized observations into a daily estimate of
//! each settlement index, calibration against published prints, bootstrap uncertainty,
//! and settlement-window forecasts for listed contracts.

use std::collections::{BTreeMap, BTreeSet};

use basis_core::config::{ContractsConfig, IndexSpec, IndicesConfig};
use basis_core::keys::{ContractId, IndexId, Tenor};
use basis_core::rng::Rng;
use basis_core::stats;
use basis_core::types::*;
use time::{Date, Duration};

use crate::config::NowcastParams;
use crate::error::{ModelError, Result};

/// Result of the robust aggregation of one (index, gpu, date) group.
#[derive(Debug, Clone)]
pub struct Aggregation {
    pub composite_mean: f64,
    pub composite_median: f64,
    pub n_obs: u32,
    pub n_used: u32,
    pub n_providers: u32,
    /// Final weight per input row (0 for dropped rows).
    pub weights: Vec<f64>,
    /// Winsorized standardized price per input row.
    pub prices: Vec<f64>,
    pub flags: Vec<Vec<&'static str>>,
}

fn apply_caps(
    providers: &[&str],
    tiers: &[ProviderTier],
    weights: &mut [f64],
    spec: &IndexSpec,
    flags: Option<&mut Vec<Vec<&'static str>>>,
) {
    let mut capped: BTreeSet<usize> = BTreeSet::new();
    for _ in 0..10 {
        let total: f64 = weights.iter().sum();
        if total <= 0.0 {
            break;
        }
        let mut changed = false;
        // provider cap
        let mut by_provider: BTreeMap<&str, f64> = BTreeMap::new();
        for (i, p) in providers.iter().enumerate() {
            *by_provider.entry(p).or_insert(0.0) += weights[i];
        }
        for (p, sum) in &by_provider {
            let cap = spec.provider_cap * total;
            if *sum > cap + 1e-12 {
                let scale = cap / sum;
                for (i, q) in providers.iter().enumerate() {
                    if q == p && weights[i] > 0.0 {
                        weights[i] *= scale;
                        capped.insert(i);
                    }
                }
                changed = true;
            }
        }
        // tier caps
        let total: f64 = weights.iter().sum();
        let mut by_tier: BTreeMap<ProviderTier, f64> = BTreeMap::new();
        for (i, t) in tiers.iter().enumerate() {
            *by_tier.entry(*t).or_insert(0.0) += weights[i];
        }
        for (t, cap_share) in &spec.tier_weight_cap {
            if let Some(sum) = by_tier.get(t) {
                let cap = cap_share * total;
                if *sum > cap + 1e-12 {
                    let scale = cap / sum;
                    for (i, tt) in tiers.iter().enumerate() {
                        if tt == t && weights[i] > 0.0 {
                            weights[i] *= scale;
                            capped.insert(i);
                        }
                    }
                    changed = true;
                }
            }
        }
        if !changed {
            break;
        }
    }
    if let Some(flags) = flags {
        for i in capped {
            flags[i].push("capped");
        }
    }
}

/// Robust aggregation: MAD trim in log space, winsorize, provider and tier caps,
/// weighted arithmetic mean.
pub fn aggregate(rows: &[StandardizedObservation], spec: &IndexSpec) -> Aggregation {
    let n = rows.len();
    let mut flags: Vec<Vec<&'static str>> = vec![Vec::new(); n];
    let mut weights: Vec<f64> = rows.iter().map(|r| r.weight.max(0.0)).collect();
    let logs: Vec<f64> = rows.iter().map(|r| r.price_std.ln()).collect();

    // 1. MAD trim.
    let m = stats::weighted_median(&logs, &weights);
    let s = (1.4826 * stats::weighted_mad(&logs, &weights, m)).max(0.05);
    for i in 0..n {
        if (logs[i] - m).abs() > spec.mad_k * s {
            weights[i] = 0.0;
            flags[i].push("outlier");
        }
    }

    // 2. Winsorize survivors at weighted quantiles.
    let surv_idx: Vec<usize> = (0..n).filter(|&i| weights[i] > 0.0).collect();
    let surv_logs: Vec<f64> = surv_idx.iter().map(|&i| logs[i]).collect();
    let surv_w: Vec<f64> = surv_idx.iter().map(|&i| weights[i]).collect();
    let mut prices: Vec<f64> = rows.iter().map(|r| r.price_std).collect();
    if !surv_idx.is_empty() {
        let lo = stats::weighted_quantile(&surv_logs, &surv_w, spec.winsor[0]);
        let hi = stats::weighted_quantile(&surv_logs, &surv_w, spec.winsor[1]);
        for &i in &surv_idx {
            let clamped = logs[i].clamp(lo, hi);
            if (clamped - logs[i]).abs() > 1e-12 {
                flags[i].push("winsorized");
                prices[i] = clamped.exp();
            }
        }
    }

    // 3. Caps.
    let providers: Vec<&str> = rows.iter().map(|r| r.provider.as_str()).collect();
    let tiers: Vec<ProviderTier> = rows.iter().map(|r| r.tier).collect();
    apply_caps(&providers, &tiers, &mut weights, spec, Some(&mut flags));

    // 4. Composite.
    let used: Vec<usize> = (0..n).filter(|&i| weights[i] > 0.0).collect();
    let used_p: Vec<f64> = used.iter().map(|&i| prices[i]).collect();
    let used_w: Vec<f64> = used.iter().map(|&i| weights[i]).collect();
    let composite_mean = if used.is_empty() {
        f64::NAN
    } else {
        stats::weighted_mean(&used_p, &used_w)
    };
    let composite_median = if used.is_empty() {
        f64::NAN
    } else {
        stats::weighted_median(&used_p, &used_w)
    };
    let n_providers = used
        .iter()
        .map(|&i| providers[i])
        .collect::<BTreeSet<_>>()
        .len() as u32;

    Aggregation {
        composite_mean,
        composite_median,
        n_obs: n as u32,
        n_used: used.len() as u32,
        n_providers,
        weights,
        prices,
        flags,
    }
}

/// Provider-cluster bootstrap of the composite mean. Returns (se, ci_low, ci_high) in
/// composite units, computed from `reps` replicates.
pub fn bootstrap_se(
    rows: &[StandardizedObservation],
    agg: &Aggregation,
    spec: &IndexSpec,
    reps: usize,
    ci_level: f64,
    rng: &mut Rng,
) -> Option<(f64, f64, f64)> {
    let used: Vec<usize> = (0..rows.len()).filter(|&i| agg.weights[i] > 0.0).collect();
    if used.len() < 2 || reps == 0 {
        return None;
    }
    let mut by_provider: BTreeMap<&str, Vec<usize>> = BTreeMap::new();
    for &i in &used {
        by_provider
            .entry(rows[i].provider.as_str())
            .or_default()
            .push(i);
    }
    let clusters: Vec<&Vec<usize>> = by_provider.values().collect();
    if clusters.len() < 2 {
        return None;
    }
    let mut reps_vals = Vec::with_capacity(reps);
    for _ in 0..reps {
        let mut idx: Vec<usize> = Vec::with_capacity(used.len());
        for _ in 0..clusters.len() {
            idx.extend_from_slice(clusters[rng.below(clusters.len())]);
        }
        let providers: Vec<&str> = idx.iter().map(|&i| rows[i].provider.as_str()).collect();
        let tiers: Vec<ProviderTier> = idx.iter().map(|&i| rows[i].tier).collect();
        let mut w: Vec<f64> = idx.iter().map(|&i| rows[i].weight.max(0.0)).collect();
        apply_caps(&providers, &tiers, &mut w, spec, None);
        let p: Vec<f64> = idx.iter().map(|&i| agg.prices[i]).collect();
        let m = stats::weighted_mean(&p, &w);
        if m.is_finite() {
            reps_vals.push(m);
        }
    }
    if reps_vals.len() < 10 {
        return None;
    }
    let se = stats::sd(&reps_vals);
    let ones = vec![1.0; reps_vals.len()];
    let a = (1.0 - ci_level) / 2.0;
    let lo = stats::weighted_quantile(&reps_vals, &ones, a);
    let hi = stats::weighted_quantile(&reps_vals, &ones, 1.0 - a);
    Some((se, lo, hi))
}

/// Analytic fallback standard error of the weighted mean.
pub fn analytic_se(agg: &Aggregation) -> f64 {
    let total: f64 = agg.weights.iter().sum();
    if total <= 0.0 {
        return f64::NAN;
    }
    let m = agg.composite_mean;
    let var: f64 = agg
        .weights
        .iter()
        .zip(&agg.prices)
        .map(|(w, p)| (w / total).powi(2) * (p - m).powi(2))
        .sum();
    var.sqrt()
}

#[derive(Debug, Clone, Copy)]
pub struct Calibration {
    pub alpha: f64,
    pub beta: f64,
    pub resid_sd: f64,
    pub n: usize,
}

impl Calibration {
    pub fn identity() -> Self {
        Calibration {
            alpha: 0.0,
            beta: 1.0,
            resid_sd: 0.0,
            n: 0,
        }
    }
    pub fn apply(&self, c: f64) -> f64 {
        self.alpha + self.beta * c
    }
}

/// OLS of published prints on composites over the trailing window ending at `as_of`.
pub fn calibrate(
    composites: &BTreeMap<Date, f64>,
    prints: &BTreeMap<Date, f64>,
    as_of: Date,
    window_days: usize,
    min_points: usize,
) -> Calibration {
    let mut xs = Vec::new();
    let mut ys = Vec::new();
    let start = as_of - Duration::days(window_days as i64);
    for (d, c) in composites.range(start..=as_of) {
        if let Some(p) = prints.get(d) {
            if c.is_finite() && p.is_finite() {
                xs.push(*c);
                ys.push(*p);
            }
        }
    }
    if xs.len() < min_points {
        return Calibration::identity();
    }
    match stats::ols1(&xs, &ys) {
        // guard against degenerate fits; a slope far from 1 means composition drift
        Some((a, b, r)) if b.is_finite() && b > 0.2 && b < 5.0 => Calibration {
            alpha: a,
            beta: b,
            resid_sd: r,
            n: xs.len(),
        },
        _ => Calibration::identity(),
    }
}

fn group_key_seed(seed: u64, index: &IndexId, gpu: GpuClass, date: Date) -> u64 {
    let mut h: u64 = seed ^ 0x9E37_79B9_7F4A_7C15;
    for b in index.as_str().bytes().chain(gpu.as_str().bytes()) {
        h ^= u64::from(b);
        h = h.wrapping_mul(0x0000_0100_0000_01B3);
    }
    h ^ (date.to_julian_day() as u64).wrapping_mul(0x2545_F491_4F6C_DD1D)
}

/// Online provider-effects estimator (two-way fixed effects, no look-ahead).
///
/// `ln p_{i,t} = a_t + b_i + e`. Each day the composite `a_t` is computed from prices
/// with the provider effect `b_i` (known before day t) removed; afterwards `b_i` is
/// updated by an exponentially weighted mean of `ln p_{i,t} - a_t`. Providers seen for
/// the first time only initialize their effect and do not enter that day's composite,
/// so a hyperscaler list price appearing at 3x the market cannot move the index.
#[derive(Debug, Clone, Default)]
pub struct ProviderEffects {
    pub bias: BTreeMap<String, f64>,
    pub gamma: f64,
    pub max_abs: f64,
}

impl ProviderEffects {
    pub fn new(gamma: f64) -> Self {
        ProviderEffects {
            bias: BTreeMap::new(),
            gamma,
            max_abs: 10f64.ln(),
        }
    }

    /// Rows adjusted for known effects; new providers get weight 0 and a flag.
    pub fn adjust(
        &self,
        rows: &[StandardizedObservation],
    ) -> (Vec<StandardizedObservation>, Vec<bool>) {
        let cold = self.bias.is_empty();
        let mut out = Vec::with_capacity(rows.len());
        let mut is_new = Vec::with_capacity(rows.len());
        for r in rows {
            let mut r2 = r.clone();
            match self.bias.get(&r.provider) {
                Some(b) => r2.price_std = (r.price_std.ln() - b).exp(),
                None if cold => {}
                None => r2.weight = 0.0,
            }
            is_new.push(!cold && !self.bias.contains_key(&r.provider));
            out.push(r2);
        }
        (out, is_new)
    }

    /// Update effects after the day's composite `a_t` (in price units) is known.
    pub fn update(&mut self, rows: &[StandardizedObservation], a_t: f64, outlier: &[bool]) {
        if !(a_t.is_finite() && a_t > 0.0) {
            return;
        }
        let la = a_t.ln();
        let mut day: BTreeMap<&str, (f64, f64)> = BTreeMap::new();
        for (i, r) in rows.iter().enumerate() {
            if outlier[i] || (r.weight <= 0.0 && self.bias.contains_key(&r.provider)) {
                continue;
            }
            let e = day.entry(r.provider.as_str()).or_insert((0.0, 0.0));
            e.0 += r.weight.max(1e-6) * (r.price_std.ln() - la);
            e.1 += r.weight.max(1e-6);
        }
        for (p, (sum, w)) in day {
            let obs = (sum / w).clamp(-self.max_abs, self.max_abs);
            let b = self.bias.entry(p.to_string()).or_insert(obs);
            *b = (1.0 - self.gamma) * *b + self.gamma * obs;
        }
    }
}

/// Output of `nowcast_all`: estimates plus the per-row flags for the standardized set.
#[derive(Debug, Clone, Default)]
pub struct NowcastResult {
    pub estimates: Vec<IndexEstimate>,
    pub flags: BTreeMap<String, String>,
}

/// Nowcast every (index, gpu, date) group present in `rows`, in date order per index,
/// maintaining provider effects and calibrating against prints strictly before each day.
pub fn nowcast_all(
    rows: &[StandardizedObservation],
    prints: &[IndexPrint],
    indices: &IndicesConfig,
    params: &NowcastParams,
    min_observations: usize,
    seed: u64,
) -> Result<NowcastResult> {
    let mut groups: BTreeMap<(IndexId, Date), Vec<usize>> = BTreeMap::new();
    for (i, r) in rows.iter().enumerate() {
        groups
            .entry((r.index_id.clone(), r.date))
            .or_default()
            .push(i);
    }
    let mut prints_by: BTreeMap<IndexId, BTreeMap<Date, f64>> = BTreeMap::new();
    for p in prints {
        prints_by
            .entry(p.index_id.clone())
            .or_default()
            .insert(p.date, p.value);
    }
    let mut by_index: BTreeMap<IndexId, Vec<(Date, &Vec<usize>)>> = BTreeMap::new();
    for ((idx, date), members) in &groups {
        by_index
            .entry(idx.clone())
            .or_default()
            .push((*date, members));
    }

    let mut estimates = Vec::new();
    let mut flags: BTreeMap<String, String> = BTreeMap::new();
    let z = stats::inv_norm(1.0 - (1.0 - params.ci_level) / 2.0);
    for (idx, days) in &by_index {
        let spec = indices
            .get(idx)
            .ok_or_else(|| ModelError::Input(format!("no index spec for {idx}")))?;
        let empty = BTreeMap::new();
        let pr = prints_by.get(idx).unwrap_or(&empty);
        let mut effects = ProviderEffects::new(params.provider_effect_gamma);
        let mut comp_vals: BTreeMap<Date, f64> = BTreeMap::new();
        for (date, members) in days {
            let raw: Vec<StandardizedObservation> =
                members.iter().map(|&i| rows[i].clone()).collect();
            let (adj, is_new) = effects.adjust(&raw);
            let agg = aggregate(&adj, spec);
            let outlier: Vec<bool> = agg.flags.iter().map(|f| f.contains(&"outlier")).collect();
            for (k, &i) in members.iter().enumerate() {
                let mut f = agg.flags[k].clone();
                if is_new[k] {
                    f.push("new_provider");
                }
                let f = f.join("|");
                if !f.is_empty() {
                    flags.insert(rows[i].obs_id.clone(), f);
                }
            }
            if !((agg.n_used as usize) >= min_observations && agg.composite_mean.is_finite()) {
                // still learn effects from a thin day if a level is known
                if let Some((_, last)) = comp_vals.iter().next_back() {
                    let last = *last;
                    effects.update(&raw, last, &outlier);
                }
                continue;
            }
            comp_vals.insert(*date, agg.composite_mean);
            effects.update(&raw, agg.composite_mean, &outlier);

            let prev = *date - Duration::days(1);
            let cal = calibrate(
                &comp_vals,
                pr,
                prev,
                spec.calibration_days,
                params.min_calibration_points,
            );
            let mut rng = Rng::seed_from_u64(group_key_seed(seed, idx, spec.gpu, *date));
            let (se_c, lo_c, hi_c, method) = match bootstrap_se(
                &adj,
                &agg,
                spec,
                params.bootstrap_reps,
                params.ci_level,
                &mut rng,
            ) {
                Some((se, lo, hi)) => (se, lo, hi, "cluster_bootstrap"),
                None => {
                    let se = analytic_se(&agg);
                    (
                        se,
                        agg.composite_mean - z * se,
                        agg.composite_mean + z * se,
                        "analytic",
                    )
                }
            };
            let estimate = cal.apply(agg.composite_mean);
            let se = ((cal.beta * se_c).powi(2) + cal.resid_sd.powi(2)).sqrt();
            let half_boot_lo = cal.beta * (agg.composite_mean - lo_c);
            let half_boot_hi = cal.beta * (hi_c - agg.composite_mean);
            let ci_low = estimate - (half_boot_lo.powi(2) + (z * cal.resid_sd).powi(2)).sqrt();
            let ci_high = estimate + (half_boot_hi.powi(2) + (z * cal.resid_sd).powi(2)).sqrt();
            estimates.push(IndexEstimate {
                date: *date,
                index_id: idx.clone(),
                gpu: spec.gpu,
                estimate,
                se,
                ci_low,
                ci_high,
                n_obs: agg.n_obs,
                n_used: agg.n_used,
                n_providers: agg.n_providers,
                method: method.to_string(),
                composite_raw: agg.composite_mean,
                composite_median: agg.composite_median,
                calib_alpha: cal.alpha,
                calib_beta: cal.beta,
            });
        }
    }
    estimates.sort_by(|a, b| (a.date, &a.index_id).cmp(&(b.date, &b.index_id)));
    Ok(NowcastResult { estimates, flags })
}

/// Forecast variance of a mean-reverting (OU) process after `h` days, per unit
/// daily innovation variance: `(1 - e^{-2 lambda h}) / (2 lambda)`.
pub fn ou_variance(lambda: f64, h: f64) -> f64 {
    if h <= 0.0 {
        return 0.0;
    }
    if lambda <= 1e-9 {
        return h;
    }
    (1.0 - (-2.0 * lambda * h).exp()) / (2.0 * lambda)
}

/// Variance of the sum of the OU forecast errors at horizons `first..first+m`, per unit
/// daily innovation variance: `sum_i sum_j e^{-lambda |i-j|} (1 - e^{-2 lambda min(i,j)}) / (2 lambda)`.
pub fn ou_sum_covariance(lambda: f64, first: usize, m: usize) -> f64 {
    let mut total = 0.0;
    for i in 0..m {
        for j in 0..m {
            let hi = (first + i) as f64;
            let hj = (first + j) as f64;
            total += (-lambda * (hi - hj).abs()).exp() * ou_variance(lambda, hi.min(hj));
        }
    }
    total
}

/// Daily volatility (in price units) of an estimate series over a trailing window.
pub fn trailing_sigma(series: &BTreeMap<Date, f64>, as_of: Date, lookback: usize) -> f64 {
    let start = as_of - Duration::days(lookback as i64);
    let vals: Vec<(Date, f64)> = series
        .range(start..=as_of)
        .map(|(d, v)| (*d, *v))
        .filter(|(_, v)| *v > 0.0)
        .collect();
    if vals.len() < 5 {
        return f64::NAN;
    }
    let rets: Vec<f64> = vals.windows(2).map(|w| (w[1].1 / w[0].1).ln()).collect();
    let level = vals.last().unwrap().1;
    stats::sd(&rets) * level
}

/// Settlement forecasts for every listed contract of every index as of `as_of`.
///
/// Daily forecast mean-reverts from today's estimate toward the curve fair value with
/// `half_life_days`; Asian-average and final-day variances follow the plan's formulas.
#[allow(clippy::too_many_arguments)]
pub fn settlement_estimates(
    estimates: &[IndexEstimate],
    prints: &[IndexPrint],
    curve: &[ForwardCurvePoint],
    indices: &IndicesConfig,
    contracts: &ContractsConfig,
    params: &NowcastParams,
    as_of: Date,
    listed_months: u32,
) -> Vec<SettlementEstimate> {
    let mut est_by: BTreeMap<IndexId, BTreeMap<Date, IndexEstimate>> = BTreeMap::new();
    for e in estimates {
        est_by
            .entry(e.index_id.clone())
            .or_default()
            .insert(e.date, e.clone());
    }
    let mut prints_by: BTreeMap<IndexId, BTreeMap<Date, f64>> = BTreeMap::new();
    for p in prints {
        prints_by
            .entry(p.index_id.clone())
            .or_default()
            .insert(p.date, p.value);
    }
    let mut fv: BTreeMap<(GpuClass, Tenor), f64> = BTreeMap::new();
    for c in curve {
        if c.as_of <= as_of {
            fv.insert((c.gpu, c.tenor), c.fair_value);
        }
    }
    let lambda = std::f64::consts::LN_2 / params.half_life_days.max(1.0);
    let mut out = Vec::new();
    for spec in &indices.indices {
        let Some(series) = est_by.get(&spec.id) else {
            continue;
        };
        let Some((&last_date, today)) = series.range(..=as_of).next_back() else {
            continue;
        };
        let level_series: BTreeMap<Date, f64> =
            series.iter().map(|(d, e)| (*d, e.estimate)).collect();
        let empty = BTreeMap::new();
        let pr = prints_by.get(&spec.id).unwrap_or(&empty);
        // published prints are what settles; use their volatility when there is history
        let sigma_eps = {
            let from_prints = trailing_sigma(pr, last_date, params.vol_lookback_days);
            let s = if from_prints.is_finite() {
                from_prints
            } else {
                trailing_sigma(&level_series, last_date, params.vol_lookback_days)
            };
            if s.is_finite() {
                s
            } else {
                today.estimate * 0.02
            }
        };
        let style = contracts
            .get(spec.exchange, &spec.id)
            .map(|c| c.settlement)
            .unwrap_or(spec.settlement);
        let current = Tenor::from_date(as_of);
        for k in 0..=listed_months {
            let tenor = current.add_months(k as i32);
            let start = tenor.first_day();
            let end = tenor.last_day();
            if end < as_of {
                continue;
            }
            let n = f64::from(tenor.days_in_month());
            let fair = fv
                .get(&(spec.gpu, tenor))
                .copied()
                .unwrap_or(today.estimate);
            let mut realized_sum = 0.0;
            let mut realized_days = 0u16;
            let mut forecast_sum = 0.0;
            let mut remaining = 0u16;
            let mut d = start;
            while d <= end {
                if d <= as_of {
                    let v = pr
                        .get(&d)
                        .copied()
                        .or_else(|| series.get(&d).map(|e| e.estimate));
                    if let Some(v) = v {
                        realized_sum += v;
                        realized_days += 1;
                    } else {
                        // gap inside the realized window: treat as today's level
                        realized_sum += today.estimate;
                        realized_days += 1;
                    }
                } else {
                    let h = (d - as_of).whole_days() as f64;
                    let decay = (-lambda * h).exp();
                    forecast_sum += today.estimate * decay + fair * (1.0 - decay);
                    remaining += 1;
                }
                d = d.next_day().unwrap();
            }
            let m = f64::from(remaining);
            // horizon offsets (days after as_of) of the remaining window days
            let first_h =
                ((start.max(as_of.next_day().unwrap()) - as_of).whole_days()).max(1) as usize;
            let (estimate, var) = match style {
                SettlementStyle::AsianAverage => {
                    let est = (realized_sum + forecast_sum) / n;
                    // today's estimation error is perfectly correlated across the m days;
                    // the daily innovations follow the mean-reverting process.
                    let var = (m.powi(2) * today.se.powi(2)
                        + sigma_eps.powi(2)
                            * ou_sum_covariance(lambda, first_h, remaining as usize))
                        / n.powi(2);
                    (est, var)
                }
                SettlementStyle::FinalDay => {
                    let h = (end - as_of).whole_days().max(0) as f64;
                    let decay = (-lambda * h).exp();
                    let est = if h == 0.0 {
                        pr.get(&end).copied().unwrap_or(today.estimate)
                    } else {
                        today.estimate * decay + fair * (1.0 - decay)
                    };
                    (
                        est,
                        today.se.powi(2) + sigma_eps.powi(2) * ou_variance(lambda, h),
                    )
                }
            };
            out.push(SettlementEstimate {
                as_of,
                contract_id: ContractId::new(spec.exchange, &spec.id, tenor),
                index_id: spec.id.clone(),
                gpu: spec.gpu,
                style,
                window_start: start,
                window_end: end,
                realized_days,
                remaining_days: remaining,
                estimate,
                se: var.max(0.0).sqrt(),
            });
        }
    }
    out
}

#[derive(Debug, Clone)]
pub struct EvalRow {
    pub index_id: IndexId,
    pub n: usize,
    pub mae: f64,
    pub rmse: f64,
    pub mape: f64,
    pub coverage: f64,
}

/// Compare estimates with published prints on matching dates.
pub fn evaluate(estimates: &[IndexEstimate], prints: &[IndexPrint]) -> Vec<EvalRow> {
    let mut prints_by: BTreeMap<(IndexId, Date), f64> = BTreeMap::new();
    for p in prints {
        prints_by.insert((p.index_id.clone(), p.date), p.value);
    }
    let mut acc: BTreeMap<IndexId, (usize, f64, f64, f64, usize)> = BTreeMap::new();
    for e in estimates {
        if let Some(p) = prints_by.get(&(e.index_id.clone(), e.date)) {
            let a = acc
                .entry(e.index_id.clone())
                .or_insert((0, 0.0, 0.0, 0.0, 0));
            let err = e.estimate - p;
            a.0 += 1;
            a.1 += err.abs();
            a.2 += err * err;
            a.3 += (err / p).abs();
            if *p >= e.ci_low && *p <= e.ci_high {
                a.4 += 1;
            }
        }
    }
    acc.into_iter()
        .map(|(idx, (n, sae, sse, sape, cov))| EvalRow {
            index_id: idx,
            n,
            mae: sae / n as f64,
            rmse: (sse / n as f64).sqrt(),
            mape: sape / n as f64,
            coverage: cov as f64 / n as f64,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use basis_core::config::ReferenceSpec;
    use time::macros::date;

    fn spec() -> IndexSpec {
        IndexSpec {
            id: IndexId::new("t"),
            gpu: GpuClass::H100,
            exchange: Exchange::Cme,
            reference: ReferenceSpec {
                interconnect: Interconnect::Sxm,
                term: TermType::OnDemand,
                region: Region::UsEast,
            },
            tiers: ProviderTier::ALL.to_vec(),
            listing_kinds: ListingKind::ALL.to_vec(),
            tier_weight_cap: [(ProviderTier::Hyperscaler, 0.10)].into_iter().collect(),
            provider_cap: 0.15,
            mad_k: 3.0,
            winsor: [0.05, 0.95],
            settlement: SettlementStyle::FinalDay,
            calibration_days: 60,
        }
    }

    fn row(
        id: &str,
        provider: &str,
        tier: ProviderTier,
        price: f64,
        w: f64,
    ) -> StandardizedObservation {
        StandardizedObservation {
            obs_id: id.into(),
            date: date!(2026 - 09 - 10),
            index_id: IndexId::new("t"),
            gpu: GpuClass::H100,
            price_raw: price,
            price_std: price,
            adj_interconnect: 0.0,
            adj_term: 0.0,
            adj_region: 0.0,
            weight: w,
            provider: provider.into(),
            tier,
            flags: String::new(),
        }
    }

    #[test]
    fn planted_outlier_is_removed() {
        let mut rows: Vec<StandardizedObservation> = (0..20)
            .map(|i| {
                row(
                    &format!("o{i}"),
                    &format!("p{i}"),
                    ProviderTier::NeoCloud,
                    2.6 + 0.01 * i as f64,
                    1.0,
                )
            })
            .collect();
        rows.push(row("bad", "p99", ProviderTier::NeoCloud, 2.6 * 21.0, 1.0));
        let agg = aggregate(&rows, &spec());
        assert_eq!(agg.n_used, 20);
        assert!(agg.flags[20].contains(&"outlier"));
        assert!(
            agg.composite_mean > 2.6 && agg.composite_mean < 2.8,
            "{}",
            agg.composite_mean
        );
    }

    #[test]
    fn provider_and_tier_caps_converge() {
        let mut rows = Vec::new();
        for i in 0..10 {
            rows.push(row(
                &format!("a{i}"),
                "aws",
                ProviderTier::Hyperscaler,
                3.0,
                1.0,
            ));
        }
        for i in 0..10 {
            rows.push(row(
                &format!("n{i}"),
                &format!("neo{i}"),
                ProviderTier::NeoCloud,
                2.6,
                1.0,
            ));
        }
        let agg = aggregate(&rows, &spec());
        let total: f64 = agg.weights.iter().sum();
        let aws: f64 = agg.weights[..10].iter().sum();
        assert!(aws / total <= 0.10 + 1e-9, "aws share {}", aws / total);
        // hyperscaler list prices no longer dominate: composite near the neo-cloud level
        assert!(agg.composite_mean < 2.7, "{}", agg.composite_mean);
        assert!(agg.flags[0].contains(&"capped"));
    }

    #[test]
    fn bootstrap_is_deterministic_and_close_to_analytic() {
        let rows: Vec<StandardizedObservation> = (0..40)
            .map(|i| {
                row(
                    &format!("o{i}"),
                    &format!("p{}", i % 12),
                    ProviderTier::NeoCloud,
                    2.6 + 0.1 * ((i * 7) % 5) as f64,
                    1.0,
                )
            })
            .collect();
        let s = spec();
        let agg = aggregate(&rows, &s);
        let mut r1 = Rng::seed_from_u64(5);
        let mut r2 = Rng::seed_from_u64(5);
        let a = bootstrap_se(&rows, &agg, &s, 300, 0.9, &mut r1).unwrap();
        let b = bootstrap_se(&rows, &agg, &s, 300, 0.9, &mut r2).unwrap();
        assert_eq!(a.0, b.0);
        let an = analytic_se(&agg);
        assert!(a.0 > 0.0 && an > 0.0);
        assert!((a.0 / an - 1.0).abs() < 0.6, "boot {} analytic {an}", a.0);
        assert!(a.1 < agg.composite_mean && a.2 > agg.composite_mean);
    }

    #[test]
    fn provider_effects_remove_persistent_bias() {
        let s = spec();
        let mut fx = ProviderEffects::new(0.5);
        // day 1: cold start, everyone enters raw
        let day1: Vec<StandardizedObservation> = (0..8)
            .map(|i| {
                row(
                    &format!("d1_{i}"),
                    &format!("p{i}"),
                    ProviderTier::NeoCloud,
                    2.6,
                    1.0,
                )
            })
            .collect();
        let (adj, is_new) = fx.adjust(&day1);
        assert!(is_new.iter().all(|n| !n));
        let agg = aggregate(&adj, &s);
        fx.update(&day1, agg.composite_mean, &[false; 8]);
        // day 2: a persistent 3x quoter appears; it must not move the composite
        let mut day2 = day1.clone();
        day2.push(row("big", "hyper", ProviderTier::Hyperscaler, 7.8, 1.0));
        let (adj, is_new) = fx.adjust(&day2);
        assert!(is_new[8] && adj[8].weight == 0.0);
        let agg2 = aggregate(&adj, &s);
        assert!((agg2.composite_mean - 2.6).abs() < 1e-9);
        fx.update(&day2, agg2.composite_mean, &[false; 9]);
        assert!((fx.bias["hyper"] - 3.0f64.ln()).abs() < 1e-9);
        // day 3: the quoter's effect is removed, so it now contributes at market level
        let (adj, _) = fx.adjust(&day2);
        assert!((adj[8].price_std - 2.6).abs() < 1e-9 && adj[8].weight > 0.0);
    }

    #[test]
    fn calibration_recovers_line_and_guards() {
        let mut comps = BTreeMap::new();
        let mut prints = BTreeMap::new();
        let mut d = date!(2026 - 07 - 01);
        for i in 0..40 {
            let c = 2.0 + 0.02 * i as f64;
            comps.insert(d, c);
            prints.insert(d, 0.1 + 1.05 * c);
            d = d.next_day().unwrap();
        }
        let cal = calibrate(&comps, &prints, d, 60, 20);
        assert!((cal.alpha - 0.1).abs() < 1e-9 && (cal.beta - 1.05).abs() < 1e-9);
        let few = calibrate(&comps, &prints, date!(2026 - 07 - 05), 60, 20);
        assert_eq!(few.beta, 1.0);
    }

    #[test]
    fn asian_variance_matches_monte_carlo() {
        // Random walk with daily sd sigma over m remaining days, averaged over n days with
        // today's level known exactly (se = 0): Var = sigma^2 m(m+1)(2m+1)/6 / n^2.
        let n = 30.0;
        let m = 20u32;
        let sigma = 0.05;
        let mf = m as f64;
        let analytic = sigma * sigma * mf * (mf + 1.0) * (2.0 * mf + 1.0) / 6.0 / (n * n);
        let mut rng = Rng::seed_from_u64(11);
        let paths = 4000;
        let mut avgs = Vec::with_capacity(paths);
        for _ in 0..paths {
            let mut x = 2.6;
            let mut sum = 0.0;
            for _ in 0..m {
                x += sigma * rng.normal();
                sum += x;
            }
            avgs.push(sum / n);
        }
        let mc = stats::sd(&avgs).powi(2);
        assert!(
            (mc / analytic - 1.0).abs() < 0.10,
            "mc {mc} analytic {analytic}"
        );
        let ou = sigma * sigma * ou_sum_covariance(0.0, 1, m as usize) / (n * n);
        assert!((ou / analytic - 1.0).abs() < 1e-9);
        // with mean reversion the variance is strictly smaller
        assert!(ou_sum_covariance(0.05, 1, m as usize) < ou_sum_covariance(0.0, 1, m as usize));
        assert!((ou_variance(0.0, 5.0) - 5.0).abs() < 1e-12);
    }
}
