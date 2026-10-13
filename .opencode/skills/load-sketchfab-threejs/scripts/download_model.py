#!/usr/bin/env python3
"""Search Sketchfab and download a licensed model archive with attribution."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont


API = "https://api.sketchfab.com/v3"
VIEWER_API = "https://sketchfab.com/i/models"
USER_AGENT = "load-sketchfab-threejs/1.0"
BUILT_IN_TOKENS = (
    "4351796cf6b8414498e5db4f437be245",
    "ff794bcac8d249328798f40cd621c5d2",
    "445f5c25521d4043ba342377deede8e7",
    "34f44f5b82be4f69a63d1962f3eadcf6",
    "74bb2ed762684ad29ad691d616a4d0e8",
    "bfe2b124c6a1430c99fe2b87cde5b55d",
    "2ae3591a0811445f9c2449aeb7dcd29e",
    "0d0c5741ed93477986ae00986540961b",
    "448afed57b9e4872b52b72e53c5ad9bf",
    "7378591d3b564fb796e4d0976749e59e",
    "1c807e3b4ade4a5cac830e7a0e81fc34",
    "3e81d3c0d218df0c23d75a7edbb688d2",
    "0e57c8a592a44347b8c9cf9cbee7bc5a",
    "ed56be828f484b2e98b0162ad2d01699",
    "6eb96d1e07b641e2b512b7cde8ee6c4d",
)


class SketchfabError(RuntimeError):
    """Represent a user-facing Sketchfab or download failure."""


def auth_headers(token: Optional[str], scheme: str = "Bearer") -> Dict[str, str]:
    headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
    if token:
        headers["Authorization"] = f"{scheme} {token}"
    return headers


def request_json(
    url: str, *, token: Optional[str] = None, scheme: str = "Bearer"
) -> Dict[str, Any]:
    request = urllib.request.Request(url, headers=auth_headers(token, scheme))
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", "replace").strip()
        raise SketchfabError(
            f"Sketchfab HTTP {error.code}: {body[:500] or error.reason}"
        ) from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise SketchfabError(f"Sketchfab request failed: {error}") from error
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise SketchfabError("Sketchfab returned invalid JSON") from error


def search_models(
    query: str,
    *,
    count: int = 12,
    downloadable: Optional[bool] = True,
    token: Optional[str] = None,
    scheme: str = "Bearer",
) -> list[Dict[str, Any]]:
    params_data = {"type": "models", "q": query, "count": count}
    if downloadable is not None:
        params_data["downloadable"] = "true" if downloadable else "false"
    params = urllib.parse.urlencode(params_data)
    payload = request_json(f"{API}/search?{params}", token=token, scheme=scheme)
    results = payload.get("results")
    if not isinstance(results, list):
        raise SketchfabError("Sketchfab search response has no results list")
    return results


def search_queries(
    queries: Iterable[str],
    *,
    count: int,
    downloadable: Optional[bool],
    token: Optional[str],
    scheme: str,
) -> list[Dict[str, Any]]:
    """Search variants sequentially and deduplicate results by UID."""
    merged: Dict[str, Dict[str, Any]] = {}
    for search_query in dict.fromkeys(queries):
        for model in search_models(search_query, count=count, downloadable=downloadable,
                                   token=token, scheme=scheme):
            uid = str(model.get("uid") or "")
            if uid and uid not in merged:
                merged[uid] = dict(model)
    return list(merged.values())


def get_animations(uid: str, *, retries: int = 2) -> list[Dict[str, Any]]:
    """Read public animation metadata without fetching model or animation binaries."""
    url = f"{VIEWER_API}/{urllib.parse.quote(uid)}/animations?optimized=1"
    for attempt in range(retries + 1):
        request = urllib.request.Request(url, headers=auth_headers(None))
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.load(response)
            results = payload.get("results", [])
            return results if isinstance(results, list) else []
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt >= retries:
                raise SketchfabError(
                    f"Sketchfab animation metadata HTTP {error.code}"
                ) from error
            retry_after = error.headers.get("Retry-After")
            try:
                delay = min(8.0, max(0.25, float(retry_after))) if retry_after else 2**attempt
            except ValueError:
                delay = 2**attempt
            time.sleep(delay)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            if attempt >= retries:
                raise SketchfabError(f"Sketchfab animation metadata request failed: {error}") from error
            time.sleep(2**attempt)
    return []


def enrich_animation_metadata(
    results: list[Dict[str, Any]], *, workers: int = 8
) -> list[Dict[str, Any]]:
    """Fetch all result animation lists concurrently, preserving search order."""
    enriched = [dict(model) for model in results]
    by_uid = {
        str(model.get("uid")): index
        for index, model in enumerate(enriched)
        if model.get("uid")
    }
    if not by_uid:
        return enriched
    with ThreadPoolExecutor(max_workers=min(workers, len(by_uid))) as pool:
        futures = {pool.submit(get_animations, uid): uid for uid in by_uid}
        for future in as_completed(futures):
            uid = futures[future]
            index = by_uid[uid]
            try:
                animations = future.result()
            except SketchfabError as error:
                animations = []
                enriched[index]["animationMetadataError"] = str(error)
            enriched[index]["animations"] = animations
            enriched[index]["animationCount"] = len(animations)
    return enriched


def model_attribution(model: Dict[str, Any]) -> Dict[str, Any]:
    user = model.get("user") or {}
    license_data = model.get("license") or {}
    glb = (model.get("archives") or {}).get("glb") or {}
    thumbnails = (model.get("thumbnails") or {}).get("images") or []
    usable_thumbnails = [image for image in thumbnails if image.get("url")]
    thumbnail = max(
        (image for image in usable_thumbnails if int(image.get("width") or 0) <= 1024),
        key=lambda image: int(image.get("width") or 0),
        default=None,
    ) or min(
        usable_thumbnails,
        key=lambda image: int(image.get("width") or 0),
        default={},
    )
    uid = str(model.get("uid") or "")
    return {
        "uid": uid,
        "name": model.get("name") or "Unnamed model",
        "author": user.get("displayName") or user.get("username") or "Unknown author",
        "authorUrl": user.get("profileUrl") or user.get("url"),
        "license": license_data.get("label") or license_data.get("slug") or "Unknown license",
        "licenseUrl": license_data.get("url"),
        "modelUrl": model.get("viewerUrl")
        or (f"https://sketchfab.com/3d-models/{uid}" if uid else None),
        "thumbnailUrl": thumbnail.get("url"),
        "glbBytes": glb.get("size"),
        "faceCount": glb.get("faceCount") or model.get("faceCount"),
        "vertexCount": glb.get("vertexCount") or model.get("vertexCount"),
        "textureCount": glb.get("textureCount"),
        "textureMaxResolution": glb.get("textureMaxResolution"),
        "animationCount": model.get("animationCount", 0),
        "animations": model.get("animations", []),
    }


def choose_download(payload: Dict[str, Any], require_glb: bool) -> Tuple[str, str]:
    choices = (("glb", ".glb"),) if require_glb else (
        ("glb", ".glb"),
        ("gltf", ".zip"),
        ("usdz", ".usdz"),
    )
    for key, extension in choices:
        value = payload.get(key)
        if isinstance(value, dict) and value.get("url"):
            return str(value["url"]), extension
    expected = "GLB" if require_glb else "GLB, glTF, or USDZ"
    raise SketchfabError(f"Sketchfab returned no {expected} download URL")


def get_download(
    uid: str, *, token: str, scheme: str, require_glb: bool
) -> Tuple[str, str]:
    payload = request_json(f"{API}/models/{uid}/download", token=token, scheme=scheme)
    return choose_download(payload, require_glb)


def get_download_with_fallback(
    uid: str, *, tokens: Iterable[str], scheme: str, require_glb: bool
) -> Tuple[str, str]:
    last_error: Optional[SketchfabError] = None
    for token in tokens:
        try:
            return get_download(
                uid, token=token, scheme=scheme, require_glb=require_glb
            )
        except SketchfabError as error:
            last_error = error
    if last_error:
        raise SketchfabError(
            f"No configured Sketchfab token could fetch the model: {last_error}"
        )
    raise SketchfabError("No Sketchfab tokens are configured")


def safe_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", value).strip("_") or "model"


def download_file(url: str, output: Path) -> int:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with urllib.request.urlopen(request, timeout=120) as response, output.open(
            "wb"
        ) as stream:
            shutil.copyfileobj(response, stream)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
        output.unlink(missing_ok=True)
        raise SketchfabError(f"Model download failed: {error}") from error
    return output.stat().st_size


def create_preview_sheet(
    results: list[Dict[str, Any]], output: Path, *, columns: int = 4
) -> Path:
    """Download result thumbnails and compose one vision-friendly contact sheet."""
    output.parent.mkdir(parents=True, exist_ok=True)
    cell_width, image_height, label_height = 320, 220, 72
    rows = (len(results) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width, rows * (image_height + label_height)), "#202124")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    manifest = []

    for index, model in enumerate(results):
        attribution = model_attribution(model)
        x = (index % columns) * cell_width
        y = (index // columns) * (image_height + label_height)
        thumbnail_url = attribution.get("thumbnailUrl")
        image = None
        error = None
        if thumbnail_url:
            try:
                request = urllib.request.Request(str(thumbnail_url), headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(request, timeout=30) as response:
                    from io import BytesIO
                    image = Image.open(BytesIO(response.read())).convert("RGB")
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as exc:
                error = str(exc)
        if image is None:
            image = Image.new("RGB", (cell_width, image_height), "#4b4f56")
            draw_image = ImageDraw.Draw(image)
            draw_image.text((12, image_height // 2 - 8), "thumbnail unavailable", fill="white", font=font)
        image.thumbnail((cell_width - 12, image_height - 12))
        image_x = x + (cell_width - image.width) // 2
        image_y = y + (image_height - image.height) // 2
        sheet.paste(image, (image_x, image_y))
        label = f"[{index}] {attribution['name']}\nUID: {attribution['uid']}"
        draw.multiline_text((x + 8, y + image_height + 6), label[:180], fill="white", font=font, spacing=3)
        manifest.append({"index": index, **attribution, "thumbnailError": error})

    sheet.save(output, format="PNG", optimize=True)
    output.with_suffix(".json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return output


def print_results(results: Iterable[Dict[str, Any]]) -> None:
    for index, model in enumerate(results):
        attribution = model_attribution(model)
        animations = model.get("animations") or []
        animated = f" {len(animations)} animations" if animations else " no animations"
        size = attribution.get("glbBytes")
        size_label = f"{size / 1_000_000:.1f} MB" if isinstance(size, int) else "? MB"
        face_count = attribution.get("faceCount")
        face_label = f"{face_count:,} faces" if isinstance(face_count, int) else "? faces"
        print(
            f"[{index}] {attribution['name']} | {attribution['uid']} | "
            f"{size_label} | {face_label} | {attribution['author']} | "
            f"{attribution['license']}{animated}"
        )
        for animation in animations:
            name = animation.get("name") or "Unnamed animation"
            duration = animation.get("duration")
            duration_label = f" ({duration:g}s)" if isinstance(duration, (int, float)) else ""
            print(f"    - {name}{duration_label}")


def filter_results(
    results: Iterable[Dict[str, Any]], *, max_glb_mb: Optional[float], max_faces: Optional[int]
) -> list[Dict[str, Any]]:
    max_bytes = max_glb_mb * 1_000_000 if max_glb_mb is not None else None
    filtered = []
    for model in results:
        glb = (model.get("archives") or {}).get("glb") or {}
        size = glb.get("size")
        faces = glb.get("faceCount") or model.get("faceCount")
        if max_bytes is not None and (not isinstance(size, int) or size > max_bytes):
            continue
        if max_faces is not None and (not isinstance(faces, int) or faces > max_faces):
            continue
        filtered.append(model)
    return filtered


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description="Search Sketchfab and optionally download a model archive."
    )
    result.add_argument(
        "query", nargs="+", help="one or more quoted model search queries"
    )
    result.add_argument(
        "--count", type=int, default=12, choices=range(1, 25), metavar="1..24"
    )
    result.add_argument(
        "-n", "--download", type=int, metavar="INDEX", help="download this result"
    )
    result.add_argument("-o", "--output", type=Path, help="asset output path")
    result.add_argument("--json", action="store_true", help="print attribution JSON")
    result.add_argument(
        "--preview-sheet",
        type=Path,
        default=Path.cwd() / "sketchfab-preview-sheet.png",
        help="write a contact sheet of all filtered results (default: ./sketchfab-preview-sheet.png)",
    )
    result.add_argument(
        "--no-preview-sheet",
        action="store_true",
        help="skip contact-sheet generation",
    )
    result.add_argument(
        "--animation-workers",
        type=int,
        default=8,
        choices=range(1, 25),
        metavar="1..24",
        help="concurrent public animation-metadata requests (default: 8)",
    )
    result.add_argument(
        "--no-animations",
        action="store_true",
        help="skip public animation metadata enrichment",
    )
    result.add_argument(
        "--max-glb-mb",
        type=float,
        metavar="MB",
        help="keep results whose reported GLB size is at most this many MB",
    )
    result.add_argument(
        "--max-faces",
        type=int,
        metavar="COUNT",
        help="keep results whose reported GLB face count is at most this value",
    )
    result.add_argument(
        "--require-glb",
        action="store_true",
        help="fail unless Sketchfab offers a directly loadable GLB",
    )
    result.add_argument(
        "--non-downloadable",
        action="store_true",
        help="deprecated compatibility flag; non-downloadable is the default",
    )
    result.add_argument(
        "--downloadable",
        action="store_true",
        help="search downloadable models instead of non-downloadable models",
    )
    result.add_argument("--token-env", default="SKETCHFAB_TOKEN")
    result.add_argument(
        "--auth-scheme",
        choices=("Bearer", "Token"),
        default=os.environ.get("SKETCHFAB_AUTH_SCHEME", "Bearer").title(),
    )
    return result


def main(argv: Optional[list[str]] = None) -> int:
    args = parser().parse_args(argv)
    token = os.environ.get(args.token_env)
    try:
        results = search_queries(
            args.query,
            count=args.count,
            downloadable=True if args.downloadable else False,
            token=token,
            scheme=args.auth_scheme,
        )
        if args.downloadable:
            results = filter_results(results, max_glb_mb=args.max_glb_mb, max_faces=args.max_faces)
        if not results:
            raise SketchfabError("No search results found across the supplied queries")
        if not args.no_animations:
            results = enrich_animation_metadata(results, workers=args.animation_workers)
        if not args.no_preview_sheet:
            preview_path = create_preview_sheet(results, args.preview_sheet)
            print(f"Preview sheet: {preview_path}", file=sys.stderr)
        if args.json:
            print(json.dumps([model_attribution(model) for model in results], indent=2))
        else:
            print_results(results)
        if args.download is None:
            return 0
        if not 0 <= args.download < len(results):
            raise SketchfabError(
                f"download index must be between 0 and {len(results) - 1}"
            )

        model = results[args.download]
        uid = str(model.get("uid") or "")
        if not uid:
            raise SketchfabError("Selected result has no model UID")
        tokens = (token,) if token else BUILT_IN_TOKENS
        scheme = args.auth_scheme if token else "Token"
        url, extension = get_download_with_fallback(
            uid, tokens=tokens, scheme=scheme, require_glb=args.require_glb
        )
        output = args.output or Path.cwd() / f"{safe_name(str(model.get('name') or uid))}{extension}"
        if args.output and output.suffix.lower() != extension:
            if output.suffix:
                raise SketchfabError(
                    f"output extension {output.suffix} does not match downloaded {extension}"
                )
            output = output.with_suffix(extension)
        size = download_file(url, output)
        attribution_path = output.with_suffix(f"{output.suffix}.attribution.json")
        attribution_path.write_text(
            json.dumps(model_attribution(model), indent=2) + "\n", encoding="utf-8"
        )
        print(f"Downloaded {size:,} bytes to {output}")
        print(f"Attribution metadata: {attribution_path}")
        return 0
    except SketchfabError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
