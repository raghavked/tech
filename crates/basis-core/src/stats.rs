//! Hand-rolled statistics used by the nowcast and the backtester.

/// Weighted quantile (`q` in [0,1]) using the cumulative-weight midpoint rule.
pub fn weighted_quantile(values: &[f64], weights: &[f64], q: f64) -> f64 {
    assert_eq!(values.len(), weights.len());
    if values.is_empty() {
        return f64::NAN;
    }
    let mut idx: Vec<usize> = (0..values.len()).collect();
    idx.sort_by(|&a, &b| {
        values[a]
            .partial_cmp(&values[b])
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let total: f64 = weights.iter().sum();
    if total <= 0.0 {
        return values[idx[idx.len() / 2]];
    }
    let target = q.clamp(0.0, 1.0) * total;
    let mut cum = 0.0;
    for &i in &idx {
        cum += weights[i];
        if cum >= target {
            return values[i];
        }
    }
    values[*idx.last().unwrap()]
}

pub fn weighted_median(values: &[f64], weights: &[f64]) -> f64 {
    weighted_quantile(values, weights, 0.5)
}

pub fn weighted_mean(values: &[f64], weights: &[f64]) -> f64 {
    let total: f64 = weights.iter().sum();
    if total <= 0.0 {
        return f64::NAN;
    }
    values.iter().zip(weights).map(|(v, w)| v * w).sum::<f64>() / total
}

/// Weighted median absolute deviation around `center`.
pub fn weighted_mad(values: &[f64], weights: &[f64], center: f64) -> f64 {
    let dev: Vec<f64> = values.iter().map(|v| (v - center).abs()).collect();
    weighted_median(&dev, weights)
}

pub fn mean(xs: &[f64]) -> f64 {
    if xs.is_empty() {
        return f64::NAN;
    }
    xs.iter().sum::<f64>() / xs.len() as f64
}

/// Sample standard deviation (n-1).
pub fn sd(xs: &[f64]) -> f64 {
    if xs.len() < 2 {
        return f64::NAN;
    }
    let m = mean(xs);
    (xs.iter().map(|x| (x - m).powi(2)).sum::<f64>() / (xs.len() - 1) as f64).sqrt()
}

pub fn clamp_winsor(x: f64, lo: f64, hi: f64) -> f64 {
    x.clamp(lo, hi)
}

/// Ordinary least squares `y = alpha + beta x`. Returns (alpha, beta, residual sd).
pub fn ols1(x: &[f64], y: &[f64]) -> Option<(f64, f64, f64)> {
    let n = x.len();
    if n < 3 || n != y.len() {
        return None;
    }
    let mx = mean(x);
    let my = mean(y);
    let sxx: f64 = x.iter().map(|v| (v - mx).powi(2)).sum();
    if sxx <= 1e-12 {
        return None;
    }
    let sxy: f64 = x.iter().zip(y).map(|(a, b)| (a - mx) * (b - my)).sum();
    let beta = sxy / sxx;
    let alpha = my - beta * mx;
    let resid: Vec<f64> = x.iter().zip(y).map(|(a, b)| b - alpha - beta * a).collect();
    let rsd = (resid.iter().map(|r| r * r).sum::<f64>() / (n - 2) as f64).sqrt();
    Some((alpha, beta, rsd))
}

/// Standard normal CDF (Abramowitz & Stegun 7.1.26, |err| < 1.5e-7).
pub fn norm_cdf(x: f64) -> f64 {
    let t = 1.0 / (1.0 + 0.3275911 * x.abs() / std::f64::consts::SQRT_2);
    let poly = t
        * (0.254829592
            + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    let erf = 1.0 - poly * (-(x * x) / 2.0).exp();
    0.5 * (1.0 + if x >= 0.0 { erf } else { -erf })
}

/// Inverse standard normal CDF (Acklam's algorithm, relative error ~1e-9).
pub fn inv_norm(p: f64) -> f64 {
    assert!(p > 0.0 && p < 1.0, "p must be in (0,1)");
    const A: [f64; 6] = [
        -3.969683028665376e+01,
        2.209460984245205e+02,
        -2.759285104469687e+02,
        1.38357751867269e+02,
        -3.066479806614716e+01,
        2.506628277459239e+00,
    ];
    const B: [f64; 5] = [
        -5.447609879822406e+01,
        1.615858368580409e+02,
        -1.556989798598866e+02,
        6.680131188771972e+01,
        -1.328068155288572e+01,
    ];
    const C: [f64; 6] = [
        -7.784894002430293e-03,
        -3.223964580411365e-01,
        -2.400758277161838e+00,
        -2.549732539343734e+00,
        4.374664141464968e+00,
        2.938163982698783e+00,
    ];
    const D: [f64; 4] = [
        7.784695709041462e-03,
        3.224671290700398e-01,
        2.445134137142996e+00,
        3.754408661907416e+00,
    ];
    let plow = 0.02425;
    let phigh = 1.0 - plow;
    if p < plow {
        let q = (-2.0 * p.ln()).sqrt();
        (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5])
            / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1.0)
    } else if p <= phigh {
        let q = p - 0.5;
        let r = q * q;
        (((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q
            / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1.0)
    } else {
        let q = (-2.0 * (1.0 - p).ln()).sqrt();
        -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5])
            / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1.0)
    }
}

/// Maximum drawdown (as a fraction of the running peak) of an equity path.
pub fn max_drawdown(equity: &[f64]) -> f64 {
    let mut peak = f64::MIN;
    let mut mdd = 0.0;
    for &e in equity {
        if e > peak {
            peak = e;
        }
        if peak > 0.0 {
            let dd = (peak - e) / peak;
            if dd > mdd {
                mdd = dd;
            }
        }
    }
    mdd
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quantiles() {
        let v = [1.0, 2.0, 3.0, 4.0, 100.0];
        let w = [1.0; 5];
        assert_eq!(weighted_median(&v, &w), 3.0);
        assert_eq!(weighted_quantile(&v, &w, 0.0), 1.0);
        assert_eq!(weighted_quantile(&v, &w, 1.0), 100.0);
        let w2 = [0.0, 0.0, 0.0, 0.0, 10.0];
        assert_eq!(weighted_median(&v, &w2), 100.0);
        assert!((weighted_mad(&v, &w, 3.0) - 1.0).abs() < 1e-12);
    }

    #[test]
    fn ols_recovers_line() {
        let x: Vec<f64> = (0..50).map(|i| i as f64).collect();
        let y: Vec<f64> = x.iter().map(|v| 2.0 + 0.5 * v).collect();
        let (a, b, r) = ols1(&x, &y).unwrap();
        assert!((a - 2.0).abs() < 1e-9 && (b - 0.5).abs() < 1e-9 && r < 1e-9);
    }

    #[test]
    fn normal_functions() {
        assert!((inv_norm(0.95) - 1.6449).abs() < 1e-3);
        assert!((inv_norm(0.05) + 1.6449).abs() < 1e-3);
        assert!((norm_cdf(1.6449) - 0.95).abs() < 1e-4);
        assert!((norm_cdf(0.0) - 0.5).abs() < 1e-9);
    }

    #[test]
    fn drawdown() {
        assert!((max_drawdown(&[100.0, 120.0, 90.0, 130.0, 65.0]) - 0.5).abs() < 1e-12);
        assert_eq!(max_drawdown(&[1.0, 2.0, 3.0]), 0.0);
    }
}
