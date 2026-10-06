#!/usr/bin/env bash
# Capture desktop + mobile screenshots of CAPTURE_URL into CAPTURE_DIR.
# Exit 75: temporary navigation/browser infrastructure failure.
# Exit 1: script or rendering defect.
set -euo pipefail
time -p cd "$(dirname "$0")"
time -p test -n "${CAPTURE_URL:-}" || { echo "capture.sh: CAPTURE_URL is required" >&2; exit 1; }
time -p test -n "${CAPTURE_DIR:-}" || { echo "capture.sh: CAPTURE_DIR is required" >&2; exit 1; }
time -p mkdir -p "$CAPTURE_DIR"
echo "capture.sh: capturing $CAPTURE_URL into $CAPTURE_DIR"
time -p node "${RUNTIME_DIR:?}/scripts/default-capture.mjs"
status=$?
time -p test -f "$CAPTURE_DIR/final-desktop.png" || { echo "capture.sh: missing $CAPTURE_DIR/final-desktop.png" >&2; exit 1; }
time -p test -f "$CAPTURE_DIR/final-mobile.png" || { echo "capture.sh: missing $CAPTURE_DIR/final-mobile.png" >&2; exit 1; }
echo "capture.sh: done (capture exit $status)"
exit "$status"
