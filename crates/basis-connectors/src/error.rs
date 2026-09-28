use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConnectorError {
    #[error("core error: {0}")]
    Core(#[from] basis_core::CoreError),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("csv error: {0}")]
    Csv(#[from] csv::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("network access to {0} is blocked (offline mode or feature `live` disabled)")]
    Blocked(String),
    #[error("http error: {0}")]
    Http(String),
    #[error("unexpected document order: {0}")]
    UnexpectedOrder(String),
    #[error("byte cap of {0} bytes exceeded")]
    ByteCap(u64),
    #[error("parse error: {0}")]
    Parse(String),
    #[error("unknown source `{0}`")]
    UnknownSource(String),
}

pub type Result<T> = std::result::Result<T, ConnectorError>;
