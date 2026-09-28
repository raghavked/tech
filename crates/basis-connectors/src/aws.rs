//! AWS public price-list connector.
//!
//! The regional EC2 offer file is hundreds of megabytes (`us-east-1` is ~480 MB), so
//! this parser streams it with a serde visitor: it keeps only GPU instance products
//! (`p4d`, `p4de`, `p5`, `p5e`, `p5en`, `p6-b200`, `p6e-gb200`) with Linux / shared
//! tenancy / used capacity, then reads only the `OnDemand` terms of those SKUs. Every
//! other value is consumed with `IgnoredAny`, so memory is bounded by the kept set.
//! `products` precede `terms` in the real file; a file with the opposite order returns
//! [`ConnectorError::UnexpectedOrder`]. A byte cap guards the download.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;
use std::io::{self, Read};

use basis_core::types::*;
use serde::de::{DeserializeSeed, IgnoredAny, MapAccess, Visitor};
use serde::Deserialize;
use time::{Date, OffsetDateTime, Time};

use crate::error::{ConnectorError, Result};
use crate::source::{FetchRequest, RawPayload, Source};

pub const DEFAULT_FAMILIES: &[&str] = &["p4d", "p4de", "p5", "p5e", "p5en", "p6-b200", "p6e-gb200"];
pub const DEFAULT_MAX_BYTES: u64 = 1 << 30;

pub fn price_list_url(region: &str) -> String {
    format!("https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/{region}/index.json")
}

/// A reader that fails once more than `max` bytes have been read.
pub struct LimitedReader<R: Read> {
    inner: R,
    max: u64,
    read: u64,
}

impl<R: Read> LimitedReader<R> {
    pub fn new(inner: R, max: u64) -> Self {
        LimitedReader {
            inner,
            max,
            read: 0,
        }
    }
    pub fn bytes_read(&self) -> u64 {
        self.read
    }
}

impl<R: Read> Read for LimitedReader<R> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        if self.read >= self.max {
            return Err(io::Error::other(format!("byte cap {} exceeded", self.max)));
        }
        let n = self.inner.read(buf)?;
        self.read += n as u64;
        if self.read > self.max {
            return Err(io::Error::other(format!("byte cap {} exceeded", self.max)));
        }
        Ok(n)
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Attributes {
    #[serde(default)]
    instance_type: String,
    #[serde(default)]
    location: String,
    #[serde(default)]
    region_code: String,
    #[serde(default)]
    operating_system: String,
    #[serde(default)]
    tenancy: String,
    #[serde(default)]
    capacitystatus: String,
    #[serde(default)]
    pre_installed_sw: String,
    #[serde(default)]
    gpu: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductLite {
    #[serde(default)]
    sku: String,
    #[serde(default)]
    attributes: Attributes,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PriceDimension {
    #[serde(default)]
    rate_code: String,
    #[serde(default)]
    unit: String,
    #[serde(default)]
    price_per_unit: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TermLite {
    #[serde(default)]
    price_dimensions: BTreeMap<String, PriceDimension>,
}

#[derive(Debug, Default)]
pub struct ParsedPriceList {
    pub publication_date: Option<String>,
    pub region: String,
    pub rows: Vec<AwsPriceRow>,
}

struct KeptProduct {
    instance_type: String,
    gpu: GpuClass,
    gpu_count: u16,
    region_code: String,
    location: String,
}

/// GPU class for an EC2 instance family.
pub fn family_gpu(family: &str) -> Option<GpuClass> {
    Some(match family {
        "p4d" => GpuClass::A100_40,
        "p4de" => GpuClass::A100_80,
        "p5" => GpuClass::H100,
        "p5e" | "p5en" => GpuClass::H200,
        "p6-b200" => GpuClass::B200,
        "p6e-gb200" => GpuClass::GB200,
        _ => return None,
    })
}

fn fallback_gpu_count(instance_type: &str) -> u16 {
    match instance_type {
        "p5.4xlarge" => 1,
        "p6e-gb200.36xlarge" => 4,
        t if t.ends_with("48xlarge") || t.ends_with("24xlarge") => 8,
        _ => 8,
    }
}

pub fn region_from_code(code: &str) -> Region {
    if code.starts_with("us-east") {
        Region::UsEast
    } else if code.starts_with("us-west") {
        Region::UsWest
    } else if code.starts_with("eu-west") {
        Region::EuWest
    } else if code.starts_with("eu-central") || code.starts_with("eu-north") {
        Region::EuCentral
    } else if code.starts_with("ap-") {
        Region::Apac
    } else if code.starts_with("ca-") || code.starts_with("us-") {
        Region::UsCentral
    } else {
        Region::Other
    }
}

struct State<'a> {
    families: &'a [&'a str],
    kept: BTreeMap<String, KeptProduct>,
    seen_products: bool,
    rows: Vec<AwsPriceRow>,
    publication_date: Option<String>,
}

struct ProductsSeed<'s, 'a>(&'s mut State<'a>);

impl<'de> DeserializeSeed<'de> for ProductsSeed<'_, '_> {
    type Value = ();
    fn deserialize<D: serde::Deserializer<'de>>(self, d: D) -> std::result::Result<(), D::Error> {
        d.deserialize_map(self)
    }
}

impl<'de> Visitor<'de> for ProductsSeed<'_, '_> {
    type Value = ();
    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("products map")
    }
    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> std::result::Result<(), A::Error> {
        let st = self.0;
        st.seen_products = true;
        while let Some(sku) = map.next_key::<String>()? {
            // Peek cheaply: we must deserialize the value either way; ProductLite skips unknown fields.
            let p: ProductLite = map.next_value()?;
            let a = &p.attributes;
            let family = a.instance_type.split('.').next().unwrap_or("");
            if !st.families.contains(&family) {
                continue;
            }
            if a.operating_system != "Linux"
                || a.tenancy != "Shared"
                || a.capacitystatus != "Used"
                || (a.pre_installed_sw != "NA" && !a.pre_installed_sw.is_empty())
            {
                continue;
            }
            let Some(gpu) = family_gpu(family) else {
                continue;
            };
            let gpu_count = a
                .gpu
                .parse::<u16>()
                .ok()
                .filter(|n| *n > 0)
                .unwrap_or_else(|| fallback_gpu_count(&a.instance_type));
            let sku_key = if p.sku.is_empty() {
                sku.clone()
            } else {
                p.sku.clone()
            };
            st.kept.insert(
                sku_key,
                KeptProduct {
                    instance_type: a.instance_type.clone(),
                    gpu,
                    gpu_count,
                    region_code: a.region_code.clone(),
                    location: a.location.clone(),
                },
            );
        }
        Ok(())
    }
}

struct TermsSeed<'s, 'a>(&'s mut State<'a>);

impl<'de> DeserializeSeed<'de> for TermsSeed<'_, '_> {
    type Value = ();
    fn deserialize<D: serde::Deserializer<'de>>(self, d: D) -> std::result::Result<(), D::Error> {
        d.deserialize_map(self)
    }
}

impl<'de> Visitor<'de> for TermsSeed<'_, '_> {
    type Value = ();
    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("terms map")
    }
    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> std::result::Result<(), A::Error> {
        while let Some(kind) = map.next_key::<String>()? {
            if kind == "OnDemand" {
                map.next_value_seed(OnDemandSeed(self.0))?;
            } else {
                map.next_value::<IgnoredAny>()?;
            }
        }
        Ok(())
    }
}

struct OnDemandSeed<'s, 'a>(&'s mut State<'a>);

impl<'de> DeserializeSeed<'de> for OnDemandSeed<'_, '_> {
    type Value = ();
    fn deserialize<D: serde::Deserializer<'de>>(self, d: D) -> std::result::Result<(), D::Error> {
        d.deserialize_map(self)
    }
}

impl<'de> Visitor<'de> for OnDemandSeed<'_, '_> {
    type Value = ();
    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("OnDemand terms map")
    }
    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> std::result::Result<(), A::Error> {
        let st = self.0;
        while let Some(sku) = map.next_key::<String>()? {
            if let Some(kp) = st.kept.get(&sku) {
                let terms: BTreeMap<String, TermLite> = map.next_value()?;
                for t in terms.values() {
                    for dim in t.price_dimensions.values() {
                        if dim.unit != "Hrs" {
                            continue;
                        }
                        let Some(usd) = dim.price_per_unit.get("USD") else {
                            continue;
                        };
                        let Ok(price) = usd.parse::<f64>() else {
                            continue;
                        };
                        if price <= 0.0 {
                            continue; // zero-priced rows are reservation placeholders
                        }
                        st.rows.push(AwsPriceRow {
                            publication_date: Date::MIN, // filled in after parsing
                            region: if kp.region_code.is_empty() {
                                kp.location.clone()
                            } else {
                                kp.region_code.clone()
                            },
                            instance_type: kp.instance_type.clone(),
                            gpu: kp.gpu,
                            gpu_count: kp.gpu_count,
                            usd_per_hour: price,
                            usd_per_gpu_hour: price / f64::from(kp.gpu_count.max(1)),
                            rate_code: dim.rate_code.clone(),
                        });
                    }
                }
            } else {
                map.next_value::<IgnoredAny>()?;
            }
        }
        Ok(())
    }
}

struct TopSeed<'s, 'a>(&'s mut State<'a>);

impl<'de> DeserializeSeed<'de> for TopSeed<'_, '_> {
    type Value = ();
    fn deserialize<D: serde::Deserializer<'de>>(self, d: D) -> std::result::Result<(), D::Error> {
        d.deserialize_map(self)
    }
}

impl<'de> Visitor<'de> for TopSeed<'_, '_> {
    type Value = ();
    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("price list document")
    }
    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> std::result::Result<(), A::Error> {
        while let Some(key) = map.next_key::<String>()? {
            match key.as_str() {
                "publicationDate" => self.0.publication_date = Some(map.next_value::<String>()?),
                "products" => map.next_value_seed(ProductsSeed(self.0))?,
                "terms" => {
                    if !self.0.seen_products {
                        return Err(serde::de::Error::custom(
                            "UNEXPECTED_ORDER: terms before products",
                        ));
                    }
                    map.next_value_seed(TermsSeed(self.0))?;
                }
                _ => {
                    map.next_value::<IgnoredAny>()?;
                }
            }
        }
        Ok(())
    }
}

/// Stream-parse a price-list document.
pub fn parse_reader<R: Read>(
    reader: R,
    region: &str,
    families: &[&str],
    max_bytes: u64,
) -> Result<ParsedPriceList> {
    let limited = LimitedReader::new(reader, max_bytes);
    let mut de =
        serde_json::Deserializer::from_reader(io::BufReader::with_capacity(1 << 20, limited));
    let mut st = State {
        families,
        kept: BTreeMap::new(),
        seen_products: false,
        rows: Vec::new(),
        publication_date: None,
    };
    match TopSeed(&mut st).deserialize(&mut de) {
        Ok(()) => {}
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("UNEXPECTED_ORDER") {
                return Err(ConnectorError::UnexpectedOrder(
                    "`terms` appeared before `products`; re-run with a two-pass file mode".into(),
                ));
            }
            if msg.contains("byte cap") {
                return Err(ConnectorError::ByteCap(max_bytes));
            }
            return Err(ConnectorError::Parse(format!("aws price list: {msg}")));
        }
    }
    let pub_date = st
        .publication_date
        .as_deref()
        .and_then(|s| OffsetDateTime::parse(s, &time::format_description::well_known::Rfc3339).ok())
        .map(|t| t.date())
        .unwrap_or_else(|| OffsetDateTime::now_utc().date());
    let mut rows = st.rows;
    for r in rows.iter_mut() {
        r.publication_date = pub_date;
    }
    rows.sort_by(|a, b| {
        (a.instance_type.as_str(), a.rate_code.as_str())
            .cmp(&(b.instance_type.as_str(), b.rate_code.as_str()))
    });
    rows.dedup_by(|a, b| a.rate_code == b.rate_code);
    Ok(ParsedPriceList {
        publication_date: st.publication_date,
        region: region.to_string(),
        rows,
    })
}

/// Convert parsed rows into the canonical observation shape.
pub fn to_observations(p: &ParsedPriceList) -> Vec<PriceObservation> {
    let observed_at = OffsetDateTime::new_utc(
        p.rows
            .first()
            .map(|r| r.publication_date)
            .unwrap_or(Date::MIN),
        Time::MIDNIGHT,
    );
    let mut seen: BTreeSet<String> = BTreeSet::new();
    p.rows
        .iter()
        .filter(|r| seen.insert(r.rate_code.clone()))
        .map(|r| PriceObservation {
            obs_id: PriceObservation::compute_id("aws_pricelist", "aws", &r.rate_code, observed_at),
            observed_at,
            source: "aws_pricelist".into(),
            provider: "aws".into(),
            tier: ProviderTier::Hyperscaler,
            gpu: r.gpu,
            gpu_sku: Some(r.instance_type.clone()),
            gpu_count: r.gpu_count,
            interconnect: Interconnect::Sxm,
            region: region_from_code(&r.region),
            country: None,
            term: TermType::OnDemand,
            term_months: None,
            quantity_gpus: None,
            price: r.usd_per_hour,
            currency: "USD".into(),
            unit: PriceUnit::InstanceHour,
            listing_kind: ListingKind::List,
            raw_ref: r.rate_code.clone(),
        })
        .collect()
}

/// The `Source` implementation. `fetch` streams the regional file to a temp path (the
/// document is too large to hold in memory) and `parse` streams it back.
pub struct AwsPriceListSource {
    pub region: String,
    pub max_bytes: u64,
    pub families: Vec<String>,
}

impl AwsPriceListSource {
    pub fn new(region: &str) -> Self {
        AwsPriceListSource {
            region: region.to_string(),
            max_bytes: DEFAULT_MAX_BYTES,
            families: DEFAULT_FAMILIES.iter().map(|s| s.to_string()).collect(),
        }
    }

    pub fn parse_file(&self, path: &std::path::Path) -> Result<ParsedPriceList> {
        let f = std::fs::File::open(path)?;
        let fams: Vec<&str> = self.families.iter().map(String::as_str).collect();
        parse_reader(f, &self.region, &fams, self.max_bytes)
    }

    /// Stream the live document straight into the parser (never materialized).
    #[cfg(feature = "live")]
    pub fn fetch_live(&self) -> Result<ParsedPriceList> {
        if crate::offline() {
            return Err(ConnectorError::Blocked(price_list_url(&self.region)));
        }
        let url = price_list_url(&self.region);
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(1800))
            .build()
            .map_err(|e| ConnectorError::Http(e.to_string()))?;
        let resp = client
            .get(&url)
            .send()
            .map_err(|e| ConnectorError::Http(format!("{url}: {e}")))?;
        if !resp.status().is_success() {
            return Err(ConnectorError::Http(format!(
                "{url}: HTTP {}",
                resp.status()
            )));
        }
        let fams: Vec<&str> = self.families.iter().map(String::as_str).collect();
        parse_reader(resp, &self.region, &fams, self.max_bytes)
    }

    #[cfg(not(feature = "live"))]
    pub fn fetch_live(&self) -> Result<ParsedPriceList> {
        Err(ConnectorError::Blocked(price_list_url(&self.region)))
    }
}

impl Source for AwsPriceListSource {
    fn id(&self) -> &'static str {
        "aws_pricelist"
    }
    fn is_live(&self) -> bool {
        true
    }
    fn fetch(&self, req: &FetchRequest) -> Result<RawPayload> {
        // Parse-on-fetch: the payload carries the compact parsed rows as CSV.
        let parsed = match req.param("from_file") {
            Some(p) => self.parse_file(std::path::Path::new(p))?,
            None => self.fetch_live()?,
        };
        let bytes = basis_core::store::to_csv_bytes(&parsed.rows)?;
        Ok(RawPayload::in_memory(
            self.id(),
            &price_list_url(&self.region),
            "text/csv",
            bytes,
        ))
    }
    fn parse(&self, raw: &RawPayload) -> Result<Vec<PriceObservation>> {
        let mut rdr = csv::Reader::from_reader(raw.bytes.as_slice());
        let mut rows = Vec::new();
        for r in rdr.deserialize::<AwsPriceRow>() {
            rows.push(r?);
        }
        Ok(to_observations(&ParsedPriceList {
            publication_date: None,
            region: self.region.clone(),
            rows,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fixture(name: &str) -> PathBuf {
        PathBuf::from(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../data/fixtures/aws"
        ))
        .join(name)
    }

    #[test]
    fn parses_gpu_rows_from_fixture() {
        let src = AwsPriceListSource::new("us-east-1");
        let p = src
            .parse_file(&fixture("ec2_us-east-1_snippet.json"))
            .unwrap();
        assert_eq!(p.publication_date.as_deref(), Some("2026-09-25T18:44:02Z"));
        let by_type: BTreeMap<&str, &AwsPriceRow> = p
            .rows
            .iter()
            .map(|r| (r.instance_type.as_str(), r))
            .collect();
        let p5 = by_type["p5.48xlarge"];
        assert_eq!(p5.gpu, GpuClass::H100);
        assert_eq!(p5.gpu_count, 8);
        assert!((p5.usd_per_hour - 11.008).abs() < 1e-9);
        assert!((p5.usd_per_gpu_hour - 1.376).abs() < 1e-9);
        assert_eq!(by_type["p5.4xlarge"].gpu_count, 1);
        assert_eq!(by_type["p6-b200.48xlarge"].gpu, GpuClass::B200);
        assert_eq!(by_type["p4d.24xlarge"].gpu, GpuClass::A100_40);
        // non-GPU, Windows, dedicated and zero-priced rows are excluded
        assert_eq!(
            p.rows.len(),
            4,
            "{:?}",
            p.rows.iter().map(|r| &r.instance_type).collect::<Vec<_>>()
        );
        let obs = to_observations(&p);
        assert_eq!(obs.len(), 4);
        assert!(obs
            .iter()
            .all(|o| o.tier == ProviderTier::Hyperscaler && o.unit == PriceUnit::InstanceHour));
        assert!(
            (obs.iter()
                .find(|o| o.gpu_sku.as_deref() == Some("p5.48xlarge"))
                .unwrap()
                .price_per_gpu_hour()
                - 1.376)
                .abs()
                < 1e-9
        );
    }

    #[test]
    fn terms_before_products_is_rejected() {
        let src = AwsPriceListSource::new("us-east-1");
        let err = src
            .parse_file(&fixture("ec2_terms_first.json"))
            .unwrap_err();
        assert!(matches!(err, ConnectorError::UnexpectedOrder(_)), "{err}");
    }

    #[test]
    fn byte_cap_is_enforced() {
        let mut src = AwsPriceListSource::new("us-east-1");
        src.max_bytes = 200;
        let err = src
            .parse_file(&fixture("ec2_us-east-1_snippet.json"))
            .unwrap_err();
        assert!(matches!(err, ConnectorError::ByteCap(200)), "{err}");
    }

    #[test]
    fn source_roundtrip_via_file() {
        let src = AwsPriceListSource::new("us-east-1");
        let req = FetchRequest::new().with(
            "from_file",
            fixture("ec2_us-east-1_snippet.json").display().to_string(),
        );
        let raw = src.fetch(&req).unwrap();
        let obs = src.parse(&raw).unwrap();
        assert_eq!(obs.len(), 4);
    }

    /// Streams the real ~480 MB regional document through the proxy. Run with
    /// `cargo test -p basis-connectors --features live -- --ignored aws_live`.
    #[test]
    #[ignore]
    fn aws_live_us_east_1() {
        let src = AwsPriceListSource::new("us-east-1");
        let p = src.fetch_live().unwrap();
        let p5 = p
            .rows
            .iter()
            .find(|r| r.instance_type == "p5.48xlarge")
            .expect("p5.48xlarge present");
        assert!(
            p5.usd_per_gpu_hour > 0.5 && p5.usd_per_gpu_hour < 25.0,
            "{}",
            p5.usd_per_gpu_hour
        );
    }
}
