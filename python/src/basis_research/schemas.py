"""The dataset column contract shared with the Rust crates (``schemas/datasets.toml``)."""

from __future__ import annotations

import tomllib
from pathlib import Path


def default_schema_path() -> Path:
    """Locate ``schemas/datasets.toml`` from the installed package or the repo."""
    here = Path(__file__).resolve()
    for parent in [here.parent, *here.parents]:
        candidate = parent / "schemas" / "datasets.toml"
        if candidate.exists():
            return candidate
    raise FileNotFoundError("schemas/datasets.toml not found; pass schema_path explicitly")


def load_schema(path: str | Path | None = None) -> dict:
    p = Path(path) if path else default_schema_path()
    with open(p, "rb") as f:
        schema = tomllib.load(f)
    if "raw" not in schema or "derived" not in schema:
        raise ValueError(f"{p} does not look like a Basis schema")
    return schema


def columns(schema: dict, group: str, name: str) -> list[str]:
    return list(schema[group][name]["columns"])
