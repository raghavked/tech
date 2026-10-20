#!/usr/bin/env bash
# The Vercel build (docs/20_hosting.md): one deployment that is the whole product. Builds
# every package and the web app with its base at /app/, then assembles the static output:
#
#   out/index.html, out/<site files>   the landing page (site/)
#   out/app/                            the web app (apps/web/dist)
#
# The server itself is the function at api/server.ts, which Vercel bundles after this script
# from the packages' dist folders built here.
set -euo pipefail
cd "$(dirname "$0")/.."
export HENOSIS_BASE="${HENOSIS_BASE:-/app/}"

echo "== build (HENOSIS_BASE=$HENOSIS_BASE)"
pnpm -s build

echo "== assemble out/"
rm -rf out
mkdir -p out/app
for f in site/*; do
  case "$f" in
    site/README.md) ;;
    *) cp -R "$f" out/ ;;
  esac
done
cp -R apps/web/dist/. out/app/

test -f out/index.html
test -f out/app/index.html
grep -q "${HENOSIS_BASE}assets/" out/app/index.html
echo "== ok: out/index.html, out/app/index.html"
