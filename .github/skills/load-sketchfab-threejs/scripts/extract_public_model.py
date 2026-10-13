#!/usr/bin/env python3
"""Extract a public Sketchfab viewer model to a corrected self-contained GLB.

This intentionally uses viewer resources rather than Sketchfab's official
Download API.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path


VIEWER_MODEL_API = "https://sketchfab.com/i/models"
USER_AGENT = "load-sketchfab-threejs/1.0"


def model_uid(value: str) -> str:
    match = re.search(r"[a-f0-9]{32}", value)
    if not match:
        raise SystemExit("could not extract a 32-character Sketchfab model UID")
    return match.group(0)


def fetch_model_metadata(uid: str) -> dict:
    request = urllib.request.Request(
        f"{VIEWER_MODEL_API}/{uid}",
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        print(f"warning: could not fetch attribution metadata: {error}", file=sys.stderr)
        return {}
    return payload if isinstance(payload, dict) else {}


def attribution_for(model_url: str, output: Path) -> dict:
    uid = model_uid(model_url)
    metadata = fetch_model_metadata(uid)
    user = metadata.get("user") or {}
    license_data = metadata.get("license")
    if isinstance(license_data, dict):
        license_name = license_data.get("label") or license_data.get("slug") or "CC"
        license_url = license_data.get("url")
    else:
        license_name = license_data or "CC"
        license_url = None

    images = (metadata.get("thumbnails") or {}).get("images") or []
    usable_images = [image for image in images if image.get("url")]
    thumbnail = max(
        (image for image in usable_images if int(image.get("width") or 0) <= 1024),
        key=lambda image: int(image.get("width") or 0),
        default=None,
    ) or min(
        usable_images,
        key=lambda image: int(image.get("width") or 0),
        default={},
    )
    canonical_url = metadata.get("viewerUrl") or (
        model_url if model_url.startswith("http") else f"https://sketchfab.com/3d-models/{uid}"
    )
    return {
        "uid": uid,
        "name": metadata.get("name") or output.stem,
        "author": user.get("displayName") or user.get("username") or "Unknown author",
        "authorUrl": user.get("profileUrl") or user.get("url"),
        "license": license_name,
        "licenseUrl": license_url,
        "modelUrl": canonical_url,
        "thumbnailUrl": thumbnail.get("url"),
        "source": "public Sketchfab viewer resources",
        "glbBytes": output.stat().st_size,
    }


def write_attribution(model_url: str, output: Path) -> Path:
    sidecar = output.with_suffix(f"{output.suffix}.attribution.json")
    sidecar.write_text(
        json.dumps(attribution_for(model_url, output), indent=2) + "\n",
        encoding="utf-8",
    )
    return sidecar


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model_url", help="Sketchfab model URL or 32-character UID")
    parser.add_argument("-o", "--output", type=Path, required=True, help="output GLB path")
    parser.add_argument("--port", type=int, default=8890)
    parser.add_argument("--no-launch", action="store_true")
    args = parser.parse_args()
    from serve_public_extractor import extract

    return extract(args.model_url, args.output, port=args.port, launch=not args.no_launch)


if __name__ == "__main__":
    raise SystemExit(main())
