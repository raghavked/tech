#!/usr/bin/env bash
# End-to-end: build, run the offline demo, verify its log, then exercise the live server with
# two scripted websocket clients. No network beyond localhost; no model API.
set -euo pipefail
cd "$(dirname "$0")/.."
export QUORUM_OFFLINE=1
STORE="${STORE:-./store-e2e}"
rm -rf "$STORE"
mkdir -p "$STORE"

echo "== build"
pnpm -s build >/dev/null

echo "== offline demo"
node packages/cli/dist/main.js demo --dir "$STORE/demo" > "$STORE/demo.out"
grep -q "hash chain: ok; full replay == snapshot resume: true" "$STORE/demo.out"
grep -q "contention" "$STORE/demo.out"
grep -q "deploy \[irreversible\] -> granted" "$STORE/demo.out"

echo "== verify + report"
node packages/cli/dist/main.js verify "$STORE/demo/sessions/demo/log.json"
node packages/cli/dist/main.js report "$STORE/demo/sessions/demo/log.json" > "$STORE/report.md"
grep -q "Session report" "$STORE/report.md"
node packages/cli/dist/main.js replay "$STORE/demo/sessions/demo/log.json" --branch python-spike | grep -q "Handoff brief"

echo "== live server with two clients"
PORT=7717
node packages/cli/dist/main.js serve --port $PORT --dir "$STORE/live" --token e2e > "$STORE/server.out" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for i in $(seq 1 50); do
  if curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then break; fi
  sleep 0.1
done
node scripts/e2e-clients.mjs "ws://127.0.0.1:$PORT/ws" e2e
kill $SERVER; wait $SERVER 2>/dev/null || true
node packages/cli/dist/main.js verify "$STORE/live/sessions/e2e/log.json"
echo "== ok"
