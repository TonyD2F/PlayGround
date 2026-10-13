#!/usr/bin/env bash
# Hellfetty.com static preview server (custom start.sh).
# Builds dist/ inside PROJECT_DIR, writes deployment-output.json, serves foreground on PORT.
set -euo pipefail
time -p cd "$(dirname "$0")"
/usr/bin/time -p bash -c 'PROJECT_DIR="${PROJECT_DIR:-$PWD}"; echo "PROJECT_DIR=$PROJECT_DIR"'
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
/usr/bin/time -p test -f scripts/build-static.py
PORT="${PORT:-3000}"
OPENCODE_WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
# Install dependencies when a package.json exists (none currently; kept for setup parity).
/usr/bin/time -p bash -c 'if [ -f package.json ]; then npm install --no-audit --no-fund; else echo "no package.json, skipping npm install"; fi'
# Build static output when needed (missing or sources newer).
/usr/bin/time -p bash -c 'if [ ! -f dist/index.html ] || [ scripts/build-static.py -nt dist/index.html ] || [ site/sql/seed.sql -nt dist/index.html ]; then python3 scripts/build-static.py; else echo "dist/index.html up to date"; fi'
/usr/bin/time -p test -f dist/index.html
# Publish deployment output (absolute paths; output lives inside PROJECT_DIR).
/usr/bin/time -p bash -c 'mkdir -p "$OPENCODE_WEB_DIR"'
/usr/bin/time -p python3 -c 'import json,os; root=os.environ.get("PROJECT_DIR", os.getcwd()); web=os.environ.get("OPENCODE_WEB_DIR","/home/runner/work/_temp/omgithub-web"); payload={"project": root, "directory": os.path.join(root, "dist")}; open(os.path.join(web,"deployment-output.json"),"w").write(json.dumps(payload)); print(json.dumps(payload))'
/usr/bin/time -p cat "$OPENCODE_WEB_DIR/deployment-output.json"
/usr/bin/time -p bash -c 'if [ "$OPENCODE_WEB_DIR" != /home/runner/work/_temp/omgithub-web ]; then mkdir -p /home/runner/work/_temp/omgithub-web && cp "$OPENCODE_WEB_DIR/deployment-output.json" /home/runner/work/_temp/omgithub-web/deployment-output.json; else echo "deployment-output already at canonical path"; fi'
echo "Serving $PROJECT_DIR/dist on port $PORT"
/usr/bin/time -p python3 -m http.server "$PORT" --directory "$PROJECT_DIR/dist"
