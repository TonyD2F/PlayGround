#!/usr/bin/env bash
# Serve the built static site in the foreground.
# Source lives in PROJECT_DIR/src, built output in PROJECT_DIR/dist.
# Writes worker metadata (deployment-output.json) to OPENCODE_WEB_DIR only.
set -euo pipefail
time -p cd "$(dirname "$0")"
export PROJECT_DIR="$PWD"
export PORT="${PORT:-3000}"
DIST="$PROJECT_DIR/dist"
SRC="$PROJECT_DIR/src"
export DIST_DIR="$DIST"

time -p test -d "$SRC" || { echo "start.sh: missing source directory $SRC" >&2; exit 1; }
if [ -f "$PROJECT_DIR/package.json" ]; then
  time -p npm install --no-audit --no-fund
else
  echo "start.sh: no package.json, skipping dependency install"
fi
REBUILD=0
if [ ! -f "$DIST/index.html" ]; then REBUILD=1; fi
if [ "$SRC/index.html" -nt "$DIST/index.html" ] 2>/dev/null; then REBUILD=1; fi
if [ "$REBUILD" = 1 ]; then
  time -p rm -rf "$DIST"
  time -p cp -r "$SRC" "$DIST"
  echo "start.sh: built $DIST"
else
  echo "start.sh: build output is current, skipping rebuild"
fi
time -p test -f "$DIST/index.html" || { echo "start.sh: build did not produce $DIST/index.html" >&2; exit 1; }

META_DIR="${OPENCODE_WEB_DIR:-${RUNNER_TEMP:?}}"
export META_DIR
time -p mkdir -p "$META_DIR"
time -p python3 -c 'import json,os; json.dump({"project": os.environ["PROJECT_DIR"], "directory": os.environ["DIST_DIR"]}, open(os.path.join(os.environ["META_DIR"], "deployment-output.json"), "w"))'
echo "start.sh: wrote $META_DIR/deployment-output.json project=$PROJECT_DIR directory=$DIST"
echo "start.sh: serving $DIST on port $PORT (foreground)"

exec node --eval '
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(process.env.DIST_DIR);
const port = Number(process.env.PORT || 3000);
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
require("node:http").createServer((req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const p = path.resolve(root, "." + decodeURIComponent(url.pathname));
    if (p !== root && !p.startsWith(root + "/")) { res.writeHead(404); res.end(); return; }
    const st = fs.existsSync(p) && fs.statSync(p);
    if (!st) { res.writeHead(404); res.end("Not found"); return; }
    const file = st.isDirectory() ? path.join(p, "index.html") : p;
    res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.end(fs.readFileSync(file));
  } catch (e) { res.writeHead(404); res.end("Not found"); }
}).listen(port, "0.0.0.0", () => console.log("serving " + root + " on " + port));
'
