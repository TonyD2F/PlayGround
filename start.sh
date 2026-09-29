#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${PORT:=3000}"
export PORT
/usr/bin/time -p node "${RUNTIME_DIR:?}/scripts/default-start.mjs"
