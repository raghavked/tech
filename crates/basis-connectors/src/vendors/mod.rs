//! Vendor connectors for hosts that are not reachable from the development sandbox.
//!
//! Every parser here is `SHAPE_UNVERIFIED`: it targets the best-known public response
//! shape (see `data/fixtures/<vendor>/`) and must be checked against a live response
//! before the source is trusted. `fetch` returns [`ConnectorError::Blocked`] unless the
//! `live` feature is enabled and `BASIS_OFFLINE` is unset.

use basis_core::keys::IndexId;
use basis_core::types::*;
use serde::Deserialize;
use time::OffsetDateTime;

use crate::error::{ConnectorError, Result};
use crate::source::{FetchRequest, RawPayload, Source};

fn gpu_from_name(name: &str) -> (GpuClass, Interconnect) {
    let n = name.to_ascii_uppercase();
    let ic = if n.contains("PCIE") {
        Interconnect::Pcie
    } else if n.contains("SXM") || n.contains("NVL") {
        Interconnect::Sxm
    } else {
        Interconnect::Unknown
    };
    let gpu = if n.contains("GB200") {
        GpuClass::GB200
    } else if n.contains("B300") {
        GpuClass::B300
    } else if n.contains("B200") {
        GpuClass::B200
    } else if n.contains("H200") {
        GpuClass::H200
    } else if n.contains("H100") {
        GpuClass::H100
    } else if n.contains("A100") {
        if n.contains("40") {
            GpuClass::A100_40
        } else {
            GpuClass::A100_80
        }
    } else if n.contains("5090") {
        GpuClass::RTX5090
    } else if n.contains("4090") {
        GpuClass::RTX4090
    } else if n.contains("L40") {
        GpuClass::L40S
    } else {
        GpuClass::Other
    };
    (gpu, ic)
}

fn region_from_geo(geo: &str) -> Region {
    let g = geo.to_ascii_uppercase();
    if g.starts_with("US") || g.starts_with("CA") {
        if g.contains("TX") || g.contains("IL") || g.contains("OH") {
            Region::UsCentral
        } else if g.contains("CA") || g.contains("OR") || g.contains("WA") {
            Region::UsWest
        } else {
            Region::UsEast
        }
    } else if g.starts_with("DE")
        || g.starts_with("NL")
        || g.starts_with("FR")
        || g.starts_with("GB")
        || g.starts_with("UK")
        || g.starts_with("SE")
        || g.starts_with("NO")
        || g.starts_with("FI")
    {
        if g.starts_with("DE") || g.starts_with("NL") {
            Region::EuCentral
        } else {
            Region::EuWest
        }
    } else if g.starts_with("SG")
        || g.starts_with("JP")
        || g.starts_with("KR")
        || g.starts_with("AU")
        || g.starts_with("IN")
    {
        Region::Apac
    } else {
        Region::Other
    }
}

fn blocked(url: &str) -> Result<RawPayload> {
    Err(ConnectorError::Blocked(url.to_string()))
}

macro_rules! live_fetch {
    ($self:ident, $url:expr) => {{
        #[cfg(feature = "live")]
        {
            if crate::offline() {
                return blocked($url);
            }
            let resp =
                reqwest::blocking::get($url).map_err(|e| ConnectorError::Http(e.to_string()))?;
            let bytes = resp
                .bytes()
                .map_err(|e| ConnectorError::Http(e.to_string()))?
                .to_vec();
            Ok(RawPayload::in_memory(
                $self.id(),
                $url,
                "application/json",
                bytes,
            ))
        }
        #[cfg(not(feature = "live"))]
        {
            blocked($url)
        }
    }};
}

/// Vast.ai marketplace offers. SHAPE_UNVERIFIED.
pub struct VastSource;

#[derive(Deserialize)]
struct VastOffer {
    id: u64,
    gpu_name: String,
    num_gpus: u16,
    dph_total: f64,
    #[serde(default)]
    geolocation: String,
    #[serde(default = "default_true")]
    rentable: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Deserialize)]
struct VastDoc {
    offers: Vec<VastOffer>,
}

impl Source for VastSource {
    fn id(&self) -> &'static str {
        "vast"
    }
    fn is_live(&self) -> bool {
        true
    }
    fn fetch(&self, _req: &FetchRequest) -> Result<RawPayload> {
        live_fetch!(self, "https://console.vast.ai/api/v0/bundles/")
    }
    fn parse(&self, raw: &RawPayload) -> Result<Vec<PriceObservation>> {
        let doc: VastDoc = serde_json::from_slice(&raw.bytes)?;
        let ts = raw.fetched_at;
        Ok(doc
            .offers
            .into_iter()
            .filter(|o| o.rentable && o.num_gpus > 0 && o.dph_total > 0.0)
            .map(|o| {
                let (gpu, ic) = gpu_from_name(&o.gpu_name);
                let raw_ref = format!("offer:{}", o.id);
                PriceObservation {
                    obs_id: PriceObservation::compute_id("vast", "vast", &raw_ref, ts),
                    observed_at: ts,
                    source: "vast".into(),
                    provider: format!("vast:{}", o.id % 1000),
                    tier: ProviderTier::Marketplace,
                    gpu,
                    gpu_sku: Some(o.gpu_name),
                    gpu_count: o.num_gpus,
                    interconnect: ic,
                    region: region_from_geo(&o.geolocation),
                    country: o
                        .geolocation
                        .split(',')
                        .next()
                        .map(|s| s.trim().to_string()),
                    term: TermType::OnDemand,
                    term_months: None,
                    quantity_gpus: Some(f64::from(o.num_gpus)),
                    price: o.dph_total,
                    currency: "USD".into(),
                    unit: PriceUnit::InstanceHour,
                    listing_kind: ListingKind::List,
                    raw_ref,
                }
            })
            .collect())
    }
}

/// RunPod GPU types (secure and community cloud prices). SHAPE_UNVERIFIED.
pub struct RunpodSource;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunpodType {
    id: String,
    secure_price: Option<f64>,
    community_price: Option<f64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunpodData {
    gpu_types: Vec<RunpodType>,
}

#[derive(Deserialize)]
struct RunpodDoc {
    data: RunpodData,
}

impl Source for RunpodSource {
    fn id(&self) -> &'static str {
        "runpod"
    }
    fn is_live(&self) -> bool {
        true
    }
    fn fetch(&self, _req: &FetchRequest) -> Result<RawPayload> {
        live_fetch!(
            self,
            "https://api.runpod.io/graphql?query={gpuTypes{id,securePrice,communityPrice}}"
        )
    }
    fn parse(&self, raw: &RawPayload) -> Result<Vec<PriceObservation>> {
        let doc: RunpodDoc = serde_json::from_slice(&raw.bytes)?;
        let ts = raw.fetched_at;
        let mut out = Vec::new();
        for t in doc.data.gpu_types {
            let (gpu, ic) = gpu_from_name(&t.id);
            for (label, price, tier) in [
                ("secure", t.secure_price, ProviderTier::NeoCloud),
                ("community", t.community_price, ProviderTier::Marketplace),
            ] {
                let Some(p) = price.filter(|p| *p > 0.0) else {
                    continue;
                };
                let raw_ref = format!("{}:{label}", t.id);
                out.push(PriceObservation {
                    obs_id: PriceObservation::compute_id("runpod", "runpod", &raw_ref, ts),
                    observed_at: ts,
                    source: "runpod".into(),
                    provider: format!("runpod_{label}"),
                    tier,
                    gpu,
                    gpu_sku: Some(t.id.clone()),
                    gpu_count: 1,
                    interconnect: ic,
                    region: Region::Other,
                    country: None,
                    term: TermType::OnDemand,
                    term_months: None,
                    quantity_gpus: None,
                    price: p,
                    currency: "USD".into(),
                    unit: PriceUnit::GpuHour,
                    listing_kind: ListingKind::List,
                    raw_ref,
                });
            }
        }
        Ok(out)
    }
}

/// Lambda public instance types. SHAPE_UNVERIFIED.
pub struct LambdaSource;

#[derive(Deserialize)]
struct LambdaSpecs {
    gpus: u16,
}

#[derive(Deserialize)]
struct LambdaType {
    name: String,
    price_cents_per_hour: f64,
    specs: LambdaSpecs,
}

#[derive(Deserialize)]
struct LambdaRegion {
    name: String,
}

#[derive(Deserialize)]
struct LambdaEntry {
    instance_type: LambdaType,
    #[serde(default)]
    regions_with_capacity_available: Vec<LambdaRegion>,
}

#[derive(Deserialize)]
struct LambdaDoc {
    data: std::collections::BTreeMap<String, LambdaEntry>,
}

impl Source for LambdaSource {
    fn id(&self) -> &'static str {
        "lambda"
    }
    fn is_live(&self) -> bool {
        true
    }
    fn fetch(&self, _req: &FetchRequest) -> Result<RawPayload> {
        live_fetch!(self, "https://cloud.lambdalabs.com/api/v1/instance-types")
    }
    fn parse(&self, raw: &RawPayload) -> Result<Vec<PriceObservation>> {
        let doc: LambdaDoc = serde_json::from_slice(&raw.bytes)?;
        let ts = raw.fetched_at;
        Ok(doc
            .data
            .into_values()
            .filter(|e| e.instance_type.specs.gpus > 0)
            .map(|e| {
                let (gpu, ic) = gpu_from_name(&e.instance_type.name);
                let region = e
                    .regions_with_capacity_available
                    .first()
                    .map(|r| crate::aws::region_from_code(&r.name))
                    .unwrap_or(Region::Other);
                PriceObservation {
                    obs_id: PriceObservation::compute_id(
                        "lambda",
                        "lambda",
                        &e.instance_type.name,
                        ts,
                    ),
                    observed_at: ts,
                    source: "lambda".into(),
                    provider: "lambda".into(),
                    tier: ProviderTier::NeoCloud,
                    gpu,
                    gpu_sku: Some(e.instance_type.name.clone()),
                    gpu_count: e.instance_type.specs.gpus,
                    interconnect: ic,
                    region,
                    country: None,
                    term: TermType::OnDemand,
                    term_months: None,
                    quantity_gpus: if e.regions_with_capacity_available.is_empty() {
                        Some(0.0)
                    } else {
                        None
                    },
                    price: e.instance_type.price_cents_per_hour / 100.0,
                    currency: "USD".into(),
                    unit: PriceUnit::InstanceHour,
                    listing_kind: ListingKind::List,
                    raw_ref: e.instance_type.name,
                }
            })
            .collect())
    }
}

/// Published index prints from an index provider (Silicon Data or Ornn style). These
/// are not price observations; use [`parse_prints`]. SHAPE_UNVERIFIED for both.
#[derive(Deserialize)]
struct SdHistory {
    date: String,
    value: f64,
}

#[derive(Deserialize)]
struct SdDoc {
    index: String,
    history: Vec<SdHistory>,
}

#[derive(Deserialize)]
struct OrnnPoint {
    ts: String,
    price: f64,
}

#[derive(Deserialize)]
struct OrnnDoc {
    hardware: String,
    points: Vec<OrnnPoint>,
}

/// Parse a Silicon Data style document into index prints.
pub fn parse_silicondata_prints(bytes: &[u8]) -> Result<Vec<IndexPrint>> {
    let doc: SdDoc = serde_json::from_slice(bytes)?;
    let (id, gpu) = match doc.index.to_ascii_uppercase().as_str() {
        "SDH100RT" => ("sdh100rt", GpuClass::H100),
        "SDB200RT" => ("sdb200rt", GpuClass::B200),
        other => {
            return Err(ConnectorError::Parse(format!(
                "unknown Silicon Data index {other}"
            )))
        }
    };
    doc.history
        .iter()
        .map(|h| {
            let date = basis_core::date_serde::parse(&h.date)
                .map_err(|e| ConnectorError::Parse(e.to_string()))?;
            Ok(IndexPrint {
                date,
                index_id: IndexId::new(id),
                gpu,
                value: h.value,
                source: "silicondata".into(),
            })
        })
        .collect()
}

/// Parse an Ornn style document into index prints.
pub fn parse_ornn_prints(bytes: &[u8]) -> Result<Vec<IndexPrint>> {
    let doc: OrnnDoc = serde_json::from_slice(bytes)?;
    let (id, gpu) = match doc.hardware.to_ascii_uppercase().as_str() {
        "H100" => ("ocpi_h100", GpuClass::H100),
        "B200" => ("ocpi_b200", GpuClass::B200),
        other => {
            return Err(ConnectorError::Parse(format!(
                "unsupported OCPI hardware {other}"
            )))
        }
    };
    doc.points
        .iter()
        .map(|p| {
            let ts = OffsetDateTime::parse(&p.ts, &time::format_description::well_known::Rfc3339)
                .map_err(|e| ConnectorError::Parse(e.to_string()))?;
            Ok(IndexPrint {
                date: ts.date(),
                index_id: IndexId::new(id),
                gpu,
                value: p.price,
                source: "ornn".into(),
            })
        })
        .collect()
}

/// Every vendor source by id.
pub fn by_id(id: &str) -> Option<Box<dyn Source>> {
    match id {
        "vast" => Some(Box::new(VastSource)),
        "runpod" => Some(Box::new(RunpodSource)),
        "lambda" => Some(Box::new(LambdaSource)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fixture(rel: &str) -> Vec<u8> {
        std::fs::read(
            PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/../../data/fixtures")).join(rel),
        )
        .unwrap()
    }

    fn payload(src: &str, rel: &str) -> RawPayload {
        RawPayload {
            source: src.into(),
            fetched_at: OffsetDateTime::now_utc(),
            content_type: "application/json".into(),
            uri: rel.into(),
            bytes: fixture(rel),
            path: None,
        }
    }

    #[test]
    fn vast_fixture() {
        let obs = VastSource
            .parse(&payload("vast", "vast/offers.json"))
            .unwrap();
        assert_eq!(obs.len(), 3); // the non-rentable offer is dropped
        let h100 = obs.iter().find(|o| o.gpu_count == 8).unwrap();
        assert_eq!(h100.gpu, GpuClass::H100);
        assert!((h100.price_per_gpu_hour() - 2.3).abs() < 1e-9);
        assert_eq!(h100.region, Region::UsCentral);
        let pcie = obs
            .iter()
            .find(|o| o.interconnect == Interconnect::Pcie)
            .unwrap();
        assert_eq!(pcie.region, Region::EuCentral);
    }

    #[test]
    fn runpod_fixture() {
        let obs = RunpodSource
            .parse(&payload("runpod", "runpod/gpu_types.json"))
            .unwrap();
        assert_eq!(obs.len(), 6);
        assert!(obs
            .iter()
            .any(|o| o.gpu == GpuClass::B200 && (o.price - 5.98).abs() < 1e-9));
        assert!(obs
            .iter()
            .any(|o| o.tier == ProviderTier::Marketplace && o.gpu == GpuClass::H100));
    }

    #[test]
    fn lambda_fixture() {
        let obs = LambdaSource
            .parse(&payload("lambda", "lambda/instance_types.json"))
            .unwrap();
        assert_eq!(obs.len(), 3);
        let eight = obs
            .iter()
            .find(|o| o.gpu_sku.as_deref() == Some("gpu_8x_h100_sxm5"))
            .unwrap();
        assert!((eight.price_per_gpu_hour() - 2.99).abs() < 1e-9);
        assert_eq!(eight.region, Region::UsEast);
    }

    #[test]
    fn index_print_parsers() {
        let sd = parse_silicondata_prints(&fixture("silicondata/index.json")).unwrap();
        assert_eq!(sd.len(), 3);
        assert_eq!(sd[2].index_id.as_str(), "sdh100rt");
        assert!((sd[2].value - 2.74).abs() < 1e-9);
        let oc = parse_ornn_prints(&fixture("ornn/ocpi.json")).unwrap();
        assert_eq!(oc.len(), 3);
        assert_eq!(oc[0].index_id.as_str(), "ocpi_h100");
    }

    #[test]
    fn fetch_is_blocked_offline() {
        std::env::set_var("BASIS_OFFLINE", "1");
        let err = VastSource.fetch(&FetchRequest::new()).unwrap_err();
        assert!(matches!(err, ConnectorError::Blocked(_)));
    }
}
