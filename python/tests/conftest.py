from __future__ import annotations

import os
from pathlib import Path

import pytest

FIXTURE_STORE = Path(__file__).resolve().parent / "fixtures" / "store"


@pytest.fixture(scope="session")
def fixture_store() -> Path:
    if not (FIXTURE_STORE / "manifest.json").exists():
        pytest.skip("fixture store not present; run scripts/make_python_fixture.sh")
    return FIXTURE_STORE


@pytest.fixture(scope="session")
def e2e_store() -> Path:
    p = os.environ.get("BASIS_E2E_STORE")
    if not p or not (Path(p) / "manifest.json").exists():
        pytest.skip("BASIS_E2E_STORE not set")
    return Path(p)
