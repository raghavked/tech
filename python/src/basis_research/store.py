"""Typed pandas access to a Basis store produced by the Rust CLI."""

from __future__ import annotations

import json
import tomllib
from functools import cached_property
from pathlib import Path

import pandas as pd

from .schemas import load_schema

RAW_DATASETS = (
    "observations",
    "power",
    "futures",
    "index_prints",
    "aws_pricelist",
    "fleet_cohorts",
    "pipeline",
    "demand",
    "perf",
)
DERIVED_DATASETS = (
    "standardized",
    "estimates",
    "settlements",
    "curve",
    "spreads",
    "signals",
    "positions",
    "ledger",
    "equity",
)

DECIMAL_COLUMNS = {
    "positions": ["avg_price", "mark", "unrealized_pnl", "notional"],
    "ledger": ["price", "cash_delta", "fee", "cash_after", "equity_after"],
    "equity": ["cash", "unrealized", "equity", "daily_pnl", "gross_notional"],
}


class Store:
    """Read-only view over ``<store>/manifest.json``, ``raw/`` and ``derived/``."""

    def __init__(self, path: str | Path, schema_path: str | Path | None = None):
        self.path = Path(path)
        if not (self.path / "manifest.json").exists():
            raise FileNotFoundError(f"{self.path} is not a Basis store (no manifest.json)")
        self.schema = load_schema(schema_path)

    # -- manifest -----------------------------------------------------------------
    @cached_property
    def manifest(self) -> dict:
        return json.loads((self.path / "manifest.json").read_text())

    def parts(self, dataset: str) -> list[dict]:
        return self.manifest.get("datasets", {}).get(dataset, {}).get("parts", [])

    # -- loaders ------------------------------------------------------------------
    def _typed(self, df: pd.DataFrame, group: str, name: str) -> pd.DataFrame:
        entry = self.schema[group].get(name)
        if entry is not None:
            missing = [c for c in entry["columns"] if c not in df.columns]
            if missing:
                raise ValueError(f"{group}.{name}: missing columns {missing}")
            for col in entry.get("dates", []):
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], utc=True, errors="coerce")
        for col in DECIMAL_COLUMNS.get(name, []):
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
        return df

    def raw(self, dataset: str) -> pd.DataFrame:
        parts = self.parts(dataset)
        if not parts:
            return pd.DataFrame(columns=self.schema["raw"].get(dataset, {}).get("columns", []))
        frames = [pd.read_csv(self.path / "raw" / dataset / p["file"]) for p in parts]
        df = pd.concat(frames, ignore_index=True)
        return self._typed(df, "raw", dataset)

    def derived(self, name: str) -> pd.DataFrame:
        p = self.path / "derived" / f"{name}.csv"
        if not p.exists():
            raise FileNotFoundError(f"derived/{name}.csv not found; run the producing step")
        df = pd.read_csv(p)
        return self._typed(df, "derived", name)

    def observations(self) -> pd.DataFrame:
        return self.raw("observations")

    def power(self) -> pd.DataFrame:
        return self.raw("power")

    def futures(self) -> pd.DataFrame:
        return self.raw("futures")

    def index_prints(self) -> pd.DataFrame:
        return self.raw("index_prints")

    def standardized(self) -> pd.DataFrame:
        return self.derived("standardized")

    def estimates(self) -> pd.DataFrame:
        return self.derived("estimates")

    def settlements(self) -> pd.DataFrame:
        return self.derived("settlements")

    def curve(self) -> pd.DataFrame:
        return self.derived("curve")

    def spreads(self) -> pd.DataFrame:
        df = self.derived("spreads")
        if "inputs" in df.columns:
            df["inputs"] = df["inputs"].map(_parse_inputs)
        return df

    def signals(self) -> pd.DataFrame:
        return self.derived("signals")

    def positions(self) -> pd.DataFrame:
        return self.derived("positions")

    def ledger(self) -> pd.DataFrame:
        return self.derived("ledger")

    def equity(self) -> pd.DataFrame:
        return self.derived("equity")

    # -- reports --------------------------------------------------------------------
    def report_dates(self) -> list[str]:
        d = self.path / "reports"
        if not d.exists():
            return []
        return sorted(p.name for p in d.iterdir() if p.is_dir())

    def report(self, date: str | None = None) -> str:
        dates = self.report_dates()
        if not dates:
            raise FileNotFoundError("no reports in store; run `basis report`")
        date = date or dates[-1]
        return (self.path / "reports" / date / "desk_report.md").read_text()

    def report_summary(self, date: str | None = None) -> pd.DataFrame:
        date = date or self.report_dates()[-1]
        return pd.read_csv(self.path / "reports" / date / "summary.csv")


def _parse_inputs(s: object) -> dict:
    if not isinstance(s, str):
        return {}
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return {}


def read_toml(path: str | Path) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)
