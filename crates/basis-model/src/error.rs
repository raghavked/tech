use thiserror::Error;

#[derive(Debug, Error)]
pub enum ModelError {
    #[error("core error: {0}")]
    Core(#[from] basis_core::CoreError),
    #[error("model input error: {0}")]
    Input(String),
}

pub type Result<T> = std::result::Result<T, ModelError>;
