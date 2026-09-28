//! Standardization: move every observation onto an index's reference specification and
//! assign a reliability weight.
//!
//! `ln p_std = ln p_raw - (premium[observed] - premium[reference])` for interconnect,
//! term and region, using the log-premium tables in `config/standardization.toml`.

use basis_core::config::IndexSpec;
use basis_core::types::*;

use crate::config::StandardizationConfig;

/// Standardize all observations that belong to `spec` (tier and listing-kind filters).
pub fn standardize(
    obs: &[PriceObservation],
    spec: &IndexSpec,
    cfg: &StandardizationConfig,
) -> Vec<StandardizedObservation> {
    obs.iter()
        .filter(|o| o.gpu == spec.gpu)
        .filter(|o| spec.tiers.contains(&o.tier))
        .filter(|o| spec.listing_kinds.contains(&o.listing_kind))
        .filter_map(|o| standardize_one(o, spec, cfg))
        .collect()
}

fn premium(table: &std::collections::BTreeMap<Interconnect, f64>, ic: Interconnect) -> f64 {
    table.get(&ic).copied().unwrap_or(0.0)
}

fn term_premium(cfg: &StandardizationConfig, term: TermType, months: Option<u16>) -> f64 {
    match term {
        TermType::OnDemand => cfg.term.on_demand,
        TermType::Spot => cfg.term.spot,
        TermType::Reserved | TermType::Contract => {
            cfg.reserved_log_premium(f64::from(months.unwrap_or(12)))
        }
    }
}

pub fn standardize_one(
    o: &PriceObservation,
    spec: &IndexSpec,
    cfg: &StandardizationConfig,
) -> Option<StandardizedObservation> {
    let raw = o.price_per_gpu_hour();
    if !(raw.is_finite() && raw > 0.0) {
        return None;
    }
    let r = &spec.reference;
    let adj_interconnect =
        -(premium(&cfg.interconnect, o.interconnect) - premium(&cfg.interconnect, r.interconnect));
    let adj_term = -(term_premium(cfg, o.term, o.term_months) - term_premium(cfg, r.term, None));
    let adj_region = -(cfg.region.get(&o.region).copied().unwrap_or(0.0)
        - cfg.region.get(&r.region).copied().unwrap_or(0.0));
    let price_std = (raw.ln() + adj_interconnect + adj_term + adj_region).exp();

    let w = &cfg.weights;
    let w_source = w.source.get(&o.source).copied().unwrap_or(0.8);
    let w_kind = match o.listing_kind {
        ListingKind::Transaction => w.kind_transaction,
        ListingKind::List => w.kind_list,
        ListingKind::Bid => w.kind_bid,
        ListingKind::Ask => w.kind_ask,
    };
    let w_qty = match o.quantity_gpus {
        Some(q) if q > 0.0 => (q.min(w.quantity_cap_gpus) / w.quantity_cap_gpus).max(0.05),
        _ => w.unknown_quantity_weight,
    };
    let w_ic = if o.interconnect == Interconnect::Unknown {
        w.unknown_interconnect_penalty
    } else {
        1.0
    };
    let weight = w_source * w_kind * w_qty * w_ic;

    Some(StandardizedObservation {
        obs_id: o.obs_id.clone(),
        date: o.date(),
        index_id: spec.id.clone(),
        gpu: o.gpu,
        price_raw: raw,
        price_std,
        adj_interconnect,
        adj_term,
        adj_region,
        weight,
        provider: o.provider.clone(),
        tier: o.tier,
        flags: String::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use basis_core::config::{IndicesConfig, ReferenceSpec};
    use basis_core::keys::IndexId;
    use time::macros::datetime;

    fn cfg() -> StandardizationConfig {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../config/standardization.toml"
        );
        basis_core::config::load_toml(std::path::Path::new(path)).unwrap()
    }

    fn indices() -> IndicesConfig {
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../config/indices.toml");
        basis_core::config::load_toml(std::path::Path::new(path)).unwrap()
    }

    fn obs() -> PriceObservation {
        PriceObservation {
            obs_id: "o1".into(),
            observed_at: datetime!(2026-09-10 10:00 UTC),
            source: "sample".into(),
            provider: "nebius".into(),
            tier: ProviderTier::NeoCloud,
            gpu: GpuClass::H100,
            gpu_sku: None,
            gpu_count: 1,
            interconnect: Interconnect::Pcie,
            region: Region::EuWest,
            country: None,
            term: TermType::Reserved,
            term_months: Some(12),
            quantity_gpus: Some(32.0),
            price: 1.0,
            currency: "USD".into(),
            unit: PriceUnit::GpuHour,
            listing_kind: ListingKind::Transaction,
            raw_ref: "r".into(),
        }
    }

    #[test]
    fn golden_case_pcie_reserved_eu() {
        let c = cfg();
        let idx = indices();
        let spec = idx.get(&IndexId::new("sdh100rt")).unwrap();
        let s = standardize_one(&obs(), spec, &c).unwrap();
        // PCIe -> SXM: +0.1133 ; 12-month reserved -> on-demand: -ln(0.75) ; EU West -> US East: -0.06
        let expected = (0.1133 - 0.75f64.ln() - 0.06f64).exp();
        assert!(
            (s.price_std - expected).abs() < 1e-9,
            "{} vs {expected}",
            s.price_std
        );
        assert!((s.adj_interconnect - 0.1133).abs() < 1e-9);
        assert!((s.adj_term + 0.75f64.ln()).abs() < 1e-9);
        assert!((s.adj_region + 0.06).abs() < 1e-9);
        // weight: source 1.0 * transaction 1.0 * qty 32/64
        assert!((s.weight - 0.5).abs() < 1e-9);
    }

    #[test]
    fn reference_observation_is_unchanged() {
        let c = cfg();
        let spec = IndexSpec {
            id: IndexId::new("x"),
            gpu: GpuClass::H100,
            exchange: Exchange::Cme,
            reference: ReferenceSpec {
                interconnect: Interconnect::Sxm,
                term: TermType::OnDemand,
                region: Region::UsEast,
            },
            tiers: vec![ProviderTier::NeoCloud],
            listing_kinds: vec![ListingKind::List],
            tier_weight_cap: Default::default(),
            provider_cap: 0.15,
            mad_k: 3.0,
            winsor: [0.05, 0.95],
            settlement: SettlementStyle::FinalDay,
            calibration_days: 60,
        };
        let mut o = obs();
        o.interconnect = Interconnect::Sxm;
        o.region = Region::UsEast;
        o.term = TermType::OnDemand;
        o.term_months = None;
        o.listing_kind = ListingKind::List;
        o.quantity_gpus = None;
        o.price = 2.5;
        let s = standardize_one(&o, &spec, &c).unwrap();
        assert!((s.price_std - 2.5).abs() < 1e-12);
        assert!((s.weight - 0.6 * 0.5).abs() < 1e-12);
        // filters: transaction-only index drops list quotes
        let mut spec2 = spec.clone();
        spec2.listing_kinds = vec![ListingKind::Transaction];
        assert!(standardize(&[o], &spec2, &c).is_empty());
    }
}
