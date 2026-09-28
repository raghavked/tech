use std::collections::BTreeMap;

use basis_core::types::PriceObservation;
use time::{Date, OffsetDateTime};

use crate::error::Result;

#[derive(Debug, Clone)]
pub struct FetchRequest {
    pub from: Option<Date>,
    pub to: Option<Date>,
    pub params: BTreeMap<String, String>,
}

impl FetchRequest {
    pub fn new() -> Self {
        FetchRequest {
            from: None,
            to: None,
            params: BTreeMap::new(),
        }
    }
    pub fn with(mut self, k: &str, v: impl Into<String>) -> Self {
        self.params.insert(k.to_string(), v.into());
        self
    }
    pub fn param(&self, k: &str) -> Option<&str> {
        self.params.get(k).map(String::as_str)
    }
}

impl Default for FetchRequest {
    fn default() -> Self {
        Self::new()
    }
}

/// Raw bytes (or a path for very large payloads) plus provenance.
#[derive(Debug, Clone)]
pub struct RawPayload {
    pub source: String,
    pub fetched_at: OffsetDateTime,
    pub content_type: String,
    pub uri: String,
    pub bytes: Vec<u8>,
    pub path: Option<std::path::PathBuf>,
}

impl RawPayload {
    pub fn in_memory(source: &str, uri: &str, content_type: &str, bytes: Vec<u8>) -> Self {
        RawPayload {
            source: source.to_string(),
            fetched_at: OffsetDateTime::now_utc(),
            content_type: content_type.to_string(),
            uri: uri.to_string(),
            bytes,
            path: None,
        }
    }
}

pub trait Source: Send + Sync {
    fn id(&self) -> &'static str;
    /// Does `fetch` need the network?
    fn is_live(&self) -> bool;
    fn fetch(&self, req: &FetchRequest) -> Result<RawPayload>;
    fn parse(&self, raw: &RawPayload) -> Result<Vec<PriceObservation>>;
}
