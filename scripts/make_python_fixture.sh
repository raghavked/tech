#!/usr/bin/env bash
# Regenerate the tiny committed store used by the Python SDK tests.
set -euo pipefail
cd "$(dirname "$0")/.."
BASIS_BIN="${BASIS_BIN:-target/debug/basis}"
[ -x "$BASIS_BIN" ] || cargo build -p basis-cli
OUT=python/tests/fixtures/store
rm -rf "$OUT"
BASIS_OFFLINE=1 "$BASIS_BIN" --store "$OUT" --seed 7 pipeline --tiny >/dev/null
# keep the fixture small: drop the standardized rows' bulk is not needed; keep everything else
du -sh "$OUT"
echo "fixture store written to $OUT"
