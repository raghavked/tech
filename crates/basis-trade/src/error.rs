use thiserror::Error;

#[derive(Debug, Error)]
pub enum TradeError {
    #[error("core error: {0}")]
    Core(#[from] basis_core::CoreError),
    #[error("invalid operation: {0}")]
    Invalid(String),
    #[error("configuration error: {0}")]
    Config(String),
}

pub type Result<T> = std::result::Result<T, TradeError>;
