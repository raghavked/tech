#!/usr/bin/env bash
# Offline end-to-end run: samples + synthetic markets -> standardize -> curve -> nowcast
# -> spreads -> backtest -> report, then the Python SDK reads the store back.
set -euo pipefail
cd "$(dirname "$0")/.."

BASIS_BIN="${BASIS_BIN:-target/debug/basis}"
STORE="${BASIS_E2E_STORE:-store-e2e}"
DAYS="${BASIS_E2E_DAYS:-200}"
export BASIS_OFFLINE=1

if [ ! -x "$BASIS_BIN" ]; then
  echo "building basis..."
  cargo build -p basis-cli
  BASIS_BIN=target/debug/basis
fi

rm -rf "$STORE"
"$BASIS_BIN" --store "$STORE" --seed 42 pipeline --synth-days "$DAYS"

echo "--- checks"
for f in standardized estimates settlements curve spreads ledger equity signals positions; do
  test -s "$STORE/derived/$f.csv" || { echo "missing derived/$f.csv"; exit 1; }
done
report=$(ls -d "$STORE"/reports/*/ | head -1)
test -s "$report/desk_report.md" || { echo "missing desk report"; exit 1; }
grep -q "Compute spark spreads" "$report/desk_report.md"
"$BASIS_BIN" --store "$STORE" store verify | tail -1
"$BASIS_BIN" --store "$STORE" aws fetch --from-file data/fixtures/aws/ec2_us-east-1_snippet.json | tail -5

if command -v uv >/dev/null 2>&1; then
  echo "--- python sdk"
  (cd python && uv sync --all-extras --dev >/dev/null && BASIS_BIN="$(pwd)/../$BASIS_BIN" BASIS_E2E_STORE="$(pwd)/../$STORE" uv run pytest -q)
else
  echo "uv not installed; skipping python checks"
fi
echo "e2e ok: $STORE"
