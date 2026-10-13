#!/usr/bin/env bash
# Capture desktop + mobile screenshots of the exact preview URL.
# Leaves the app running; output goes to CAPTURE_DIR (outside source).
set -euo pipefail
time -p cd "$(dirname "$0")"
/usr/bin/time -p bash -c 'echo "CAPTURE_URL=${CAPTURE_URL:-<unset>} CAPTURE_DIR=${CAPTURE_DIR:-<unset>}"'
if [ -z "${CAPTURE_URL:-}" ] || [ -z "${CAPTURE_DIR:-}" ]; then
  echo "Set CAPTURE_URL and CAPTURE_DIR." >&2
  exit 1
fi
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p test -n "${RUNTIME_DIR:-}"
# Open the exact URL, wait for rendered content, capture both views via runtime helper.
/usr/bin/time -p node "${RUNTIME_DIR:?}/scripts/default-capture.mjs"
code=$?
if [ $code -eq 75 ]; then
  echo "capture: transient infrastructure failure (exit 75)" >&2
  exit 75
fi
if [ $code -ne 0 ]; then
  echo "capture: helper failed with exit $code" >&2
  exit 1
fi
# Verify rendering defects: both PNGs must exist and be non-empty.
/usr/bin/time -p test -s "$CAPTURE_DIR/final-desktop.png"
/usr/bin/time -p test -s "$CAPTURE_DIR/final-mobile.png"
/usr/bin/time -p ls -la "$CAPTURE_DIR"
echo "capture ok: $CAPTURE_DIR/final-desktop.png + final-mobile.png"
