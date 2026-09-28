"""Run the Rust ``basis`` binary from Python."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


def find_binary() -> Path:
    """``BASIS_BIN`` env, then the repo's target directory, then PATH."""
    env = os.environ.get("BASIS_BIN")
    if env and Path(env).exists():
        return Path(env)
    here = Path(__file__).resolve()
    for parent in here.parents:
        for profile in ("release", "debug"):
            candidate = parent / "target" / profile / "basis"
            if candidate.exists():
                return candidate
    on_path = shutil.which("basis")
    if on_path:
        return Path(on_path)
    raise FileNotFoundError(
        "basis binary not found; build it with `cargo build -p basis-cli` or set BASIS_BIN"
    )


def run(
    args: list[str], store: str | Path, config: str | Path | None = None, check: bool = True
) -> subprocess.CompletedProcess:
    cmd = [str(find_binary()), "--store", str(store)]
    if config:
        cmd += ["--config", str(config)]
    cmd += args
    return subprocess.run(cmd, check=check, capture_output=True, text=True)
