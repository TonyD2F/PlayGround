#!/usr/bin/env python3
"""Serve the bundled browser-native Sketchfab exporter until a GLB is saved."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
import threading
import urllib.parse
import urllib.request
import zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from extract_public_model import write_attribution


ROOT = Path(__file__).resolve().parent.parent / "vendor" / "sketchfab_downloader_extension"
ALLOWED_HOSTS = {"sketchfab.com", "www.sketchfab.com", "media.sketchfab.com", "static.sketchfab.com"}
BROWSER_CANDIDATES = [
    Path("/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta"),
    Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
]


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("model_url")
    result.add_argument("-o", "--output", type=Path, required=True)
    result.add_argument("--port", type=int, default=8890)
    result.add_argument(
        "--no-launch",
        action="store_true",
        help="print the extraction URL instead of launching an isolated local headless browser",
    )
    return result


def extract(model_url: str, output_path: Path, port: int = 8890, launch: bool = True) -> int:
    output = output_path.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    completed = threading.Event()
    failed = threading.Event()
    server: ThreadingHTTPServer

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *handler_args, **handler_kwargs):
            super().__init__(*handler_args, directory=str(ROOT), **handler_kwargs)

        def do_GET(self):
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path != "/proxy":
                return super().do_GET()
            target = urllib.parse.parse_qs(parsed.query).get("url", [""])[0]
            target_url = urllib.parse.urlparse(target)
            if target_url.scheme != "https" or target_url.hostname not in ALLOWED_HOSTS:
                self.send_error(403, "unsupported proxy target")
                return
            request = urllib.request.Request(
                target,
                headers={"User-Agent": "Mozilla/5.0", "Referer": "https://sketchfab.com/"},
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                body = response.read()
                self.send_response(response.status)
                self.send_header("Content-Type", response.headers.get_content_type())
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        def do_POST(self):
            path = urllib.parse.urlparse(self.path).path
            if path in {"/progress", "/error"}:
                length = int(self.headers.get("Content-Length", "0"))
                print(self.rfile.read(length).decode("utf-8", errors="replace"), flush=True)
                self.send_response(204)
                self.end_headers()
                if path == "/error":
                    failed.set()
                    threading.Thread(target=server.shutdown, daemon=True).start()
                return
            if path != "/save":
                self.send_error(404)
                return
            length = int(self.headers.get("Content-Length", "0"))
            with tempfile.NamedTemporaryFile(suffix=".zip") as archive_file:
                remaining = length
                while remaining:
                    chunk = self.rfile.read(min(remaining, 1024 * 1024))
                    if not chunk:
                        self.send_error(400, "incomplete ZIP upload")
                        return
                    archive_file.write(chunk)
                    remaining -= len(chunk)
                archive_file.flush()
                with zipfile.ZipFile(archive_file.name) as archive:
                    glbs = [name for name in archive.namelist() if name.lower().endswith(".glb")]
                    if len(glbs) != 1:
                        self.send_error(422, f"expected one GLB, found {len(glbs)}")
                        return
                    with archive.open(glbs[0]) as source, output.open("wb") as target:
                        shutil.copyfileobj(source, target)
            write_attribution(model_url, output)
            self.send_response(204)
            self.end_headers()
            completed.set()
            threading.Thread(target=server.shutdown, daemon=True).start()

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    query = urllib.parse.urlencode({"model": model_url})
    url = f"http://127.0.0.1:{port}/headless.html?{query}"
    browser = None
    profile = None
    if launch:
        executable = next((candidate for candidate in BROWSER_CANDIDATES if candidate.is_file()), None)
        if executable is None:
            executable_name = next(
                (name for name in ("google-chrome", "chromium", "chromium-browser") if shutil.which(name)),
                None,
            )
            executable = Path(shutil.which(executable_name)) if executable_name else None
        if executable is None:
            raise SystemExit("Chrome or Chromium is required; use --no-launch to open the URL manually")
        profile = tempfile.TemporaryDirectory(prefix="sketchfab-extractor-chrome-")
        browser = subprocess.Popen(
            [
                str(executable),
                "--headless=new",
                "--disable-background-networking",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-extensions",
                "--disable-renderer-backgrounding",
                "--no-first-run",
                "--no-default-browser-check",
                "--window-position=-10000,-10000",
                "--window-size=1,1",
                f"--user-data-dir={profile.name}",
                f"--app={url}",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        print(f"Started browser-native extraction: {url}")
    else:
        print(f"Open in a browser: {url}")
    try:
        server.serve_forever()
    finally:
        if browser is not None:
            browser.terminate()
            try:
                browser.wait(timeout=5)
            except subprocess.TimeoutExpired:
                browser.kill()
        if profile is not None:
            profile.cleanup()
    if failed.is_set() or not completed.is_set():
        return 1
    print(f"Extracted GLB: {output}")
    print(f"Attribution metadata: {output.with_suffix(output.suffix + '.attribution.json')}")
    return 0


def main() -> int:
    args = parser().parse_args()
    return extract(args.model_url, args.output, port=args.port, launch=not args.no_launch)


if __name__ == "__main__":
    raise SystemExit(main())
