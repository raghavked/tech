"""Research SDK over the Basis store: typed pandas access to observations, nowcasts,
curves, spreads and the paper ledger written by the Rust CLI."""

from .cli import find_binary, run
from .schemas import load_schema
from .store import Store

__all__ = ["Store", "find_binary", "load_schema", "run"]
__version__ = "0.1.0"
