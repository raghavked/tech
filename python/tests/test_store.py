from __future__ import annotations

import pandas as pd

from basis_research import Store, load_schema


def test_schema_loads() -> None:
    s = load_schema()
    assert "observations" in s["raw"]
    assert s["derived"]["ledger"]["columns"][0] == "seq"


def test_fixture_store_roundtrip(fixture_store) -> None:
    st = Store(fixture_store)
    obs = st.observations()
    assert len(obs) > 100
    assert obs["observed_at"].dt.tz is not None
    est = st.estimates()
    assert (est["ci_low"] <= est["estimate"]).all()
    assert (est["estimate"] <= est["ci_high"]).all()
    assert set(est["index_id"]) >= {"sdh100rt", "ocpi_h100"}
    sp = st.spreads()
    assert {"basis", "spark_spread"} <= set(sp["kind"])
    spark = sp[sp["kind"] == "spark_spread"].iloc[0]
    assert "power_cost" in spark["inputs"]
    ledger = st.ledger()
    assert ledger.iloc[0]["kind"] == "deposit"
    eq = st.equity()
    identity = (eq["cash"] + eq["unrealized"] - eq["equity"]).abs().max()
    assert identity < 1e-6
    curve = st.curve()
    assert (curve["srmc_floor"] <= curve["fair_value"]).all()
    md = st.report()
    assert "Compute spark spreads" in md
    summary = st.report_summary()
    assert isinstance(summary, pd.DataFrame) and "metric" in summary.columns


def test_e2e_store_if_present(e2e_store) -> None:
    st = Store(e2e_store)
    assert len(st.estimates()) > 50
    assert not st.positions().empty or not st.ledger().empty
