//! Basis model: standardization, nowcast, supply stack, forward curve and spreads.

pub mod config;
pub mod curve;
pub mod error;
pub mod nowcast;
pub mod spreads;
pub mod standardize;
pub mod supply;

pub use error::ModelError;
