//! Data sources for Basis.
//!
//! Every source separates `fetch` (network or file I/O) from `parse` (pure), so vendor
//! parsers are fixture-testable with no network. `BASIS_OFFLINE=1` makes every live
//! fetch fail fast with [`ConnectorError::Blocked`].

pub mod aws;
pub mod error;
pub mod sample;
pub mod source;
pub mod synth;
#[cfg(feature = "vendors")]
pub mod vendors;

pub use error::ConnectorError;
pub use sample::SampleBundle;
pub use source::{FetchRequest, RawPayload, Source};

/// True when live network access has been disabled by the environment.
pub fn offline() -> bool {
    std::env::var("BASIS_OFFLINE")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}
