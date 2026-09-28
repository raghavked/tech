from __future__ import annotations

import os

import pytest

from basis_research import Store, run
from basis_research.cli import find_binary


def test_cli_roundtrip(tmp_path) -> None:
    try:
        find_binary()
    except FileNotFoundError:
        pytest.skip("basis binary not built")
    store = tmp_path / "store"
    env_backup = os.environ.get("BASIS_OFFLINE")
    os.environ["BASIS_OFFLINE"] = "1"
    try:
        out = run(["synth", "--tiny"], store)
        assert "synthetic world" in out.stdout
        st = Store(store)
        assert len(st.futures()) > 0
        assert st.parts("observations")
    finally:
        if env_backup is None:
            del os.environ["BASIS_OFFLINE"]
        else:
            os.environ["BASIS_OFFLINE"] = env_backup
