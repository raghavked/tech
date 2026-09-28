//! Configuration structures loaded from `config/*.toml`.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use crate::error::{CoreError, Result};
use crate::keys::IndexId;
use crate::types::{
    Exchange, GpuClass, Hub, Interconnect, ListingKind, ProviderTier, Region, SettlementStyle,
    TermType,
};

/// Load any TOML file into a typed struct.
pub fn load_toml<T: DeserializeOwned>(path: &Path) -> Result<T> {
    let text = std::fs::read_to_string(path)
        .map_err(|e| CoreError::Config(format!("cannot read {}: {e}", path.display())))?;
    let v: T =
        toml::from_str(&text).map_err(|e| CoreError::Config(format!("{}: {e}", path.display())))?;
    Ok(v)
}

/// The reference specification an index is quoted against.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferenceSpec {
    pub interconnect: Interconnect,
    pub term: TermType,
    pub region: Region,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexSpec {
    pub id: IndexId,
    pub gpu: GpuClass,
    pub exchange: Exchange,
    pub reference: ReferenceSpec,
    pub tiers: Vec<ProviderTier>,
    pub listing_kinds: Vec<ListingKind>,
    #[serde(default)]
    pub tier_weight_cap: BTreeMap<ProviderTier, f64>,
    #[serde(default = "default_provider_cap")]
    pub provider_cap: f64,
    #[serde(default = "default_mad_k")]
    pub mad_k: f64,
    #[serde(default = "default_winsor")]
    pub winsor: [f64; 2],
    pub settlement: SettlementStyle,
    /// Trailing days used to calibrate the composite against published prints.
    #[serde(default = "default_calib_days")]
    pub calibration_days: usize,
}

fn default_provider_cap() -> f64 {
    0.15
}
fn default_mad_k() -> f64 {
    3.0
}
fn default_winsor() -> [f64; 2] {
    [0.05, 0.95]
}
fn default_calib_days() -> usize {
    60
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndicesConfig {
    #[serde(rename = "index")]
    pub indices: Vec<IndexSpec>,
}

impl IndicesConfig {
    pub fn get(&self, id: &IndexId) -> Option<&IndexSpec> {
        self.indices.iter().find(|i| &i.id == id)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractSpec {
    pub exchange: Exchange,
    pub index_id: IndexId,
    pub multiplier_gpu_hours: f64,
    pub tick: f64,
    pub fee_per_contract: f64,
    pub settlement: SettlementStyle,
    pub listed_months: u32,
    /// Placeholder flag: specs still to be verified against the exchange rulebook.
    #[serde(default)]
    pub to_verify: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractsConfig {
    #[serde(rename = "contract")]
    pub contracts: Vec<ContractSpec>,
}

impl ContractsConfig {
    pub fn get(&self, exchange: Exchange, index_id: &IndexId) -> Option<&ContractSpec> {
        self.contracts
            .iter()
            .find(|c| c.exchange == exchange && &c.index_id == index_id)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuCost {
    pub tdp_kw: f64,
    pub capex_usd: f64,
    pub life_years: f64,
    pub target_util: f64,
    pub opex_usd_per_hour: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TierCost {
    pub pue: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HubCost {
    pub default_power_usd_mwh: f64,
    pub capacity_usd_mw_day: f64,
    pub colo_usd_per_kw_month: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostStackConfig {
    /// Server-level power overhead above GPU TDP (CPU, memory, fans, NICs).
    pub server_overhead: f64,
    pub gpu: BTreeMap<GpuClass, GpuCost>,
    pub tier: BTreeMap<ProviderTier, TierCost>,
    pub hub: BTreeMap<Hub, HubCost>,
}

/// Resolved config directory with lazily loaded files.
#[derive(Debug, Clone)]
pub struct ConfigDir {
    pub root: PathBuf,
}

impl ConfigDir {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        ConfigDir { root: root.into() }
    }
    pub fn path(&self, name: &str) -> PathBuf {
        self.root.join(name)
    }
    pub fn indices(&self) -> Result<IndicesConfig> {
        load_toml(&self.path("indices.toml"))
    }
    pub fn contracts(&self) -> Result<ContractsConfig> {
        load_toml(&self.path("contracts.toml"))
    }
    pub fn cost_stack(&self) -> Result<CostStackConfig> {
        load_toml(&self.path("cost_stack.toml"))
    }
    pub fn load<T: DeserializeOwned>(&self, name: &str) -> Result<T> {
        load_toml(&self.path(name))
    }
}
