#!/usr/bin/env python3
"""Prepare the bundled Three.js GLB viewer in an output directory."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


ASSETS = Path(__file__).resolve().parent.parent / "assets" / "viewer"
SCRIPTS = Path(__file__).resolve().parent
DECODER_ASSETS = Path(__file__).resolve().parent.parent / "node_modules" / "three" / "examples" / "jsm" / "libs"


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Prepare a Three.js GLB verification viewer.")
    result.add_argument("--model", required=True, type=Path, help="source .glb path")
    result.add_argument("--output", required=True, type=Path, help="viewer output directory")
    result.add_argument(
        "--allow-invalid",
        action="store_true",
        help="prepare the viewer even when Khronos validation reports errors",
    )
    result.add_argument(
        "--max-texture", type=int, default=2048, help="maximum texture dimension for validation"
    )
    return result


def main() -> int:
    args = parser().parse_args()
    model = args.model.expanduser().resolve()
    output = args.output.expanduser().resolve()
    if not model.is_file():
        print(f"error: model does not exist: {model}", file=sys.stderr)
        return 1
    if model.suffix.lower() != ".glb":
        print("error: isolated viewer requires a .glb model", file=sys.stderr)
        return 1
    if not ASSETS.is_dir():
        print(f"error: viewer assets are missing: {ASSETS}", file=sys.stderr)
        return 1
    if not (DECODER_ASSETS / "draco" / "draco_decoder.wasm").is_file() or not (
        DECODER_ASSETS / "basis" / "basis_transcoder.wasm"
    ).is_file():
        print(
            "error: decoder assets are missing; run npm install in the skill directory",
            file=sys.stderr,
        )
        return 1

    output.mkdir(parents=True, exist_ok=True)
    node = shutil.which("node")
    if not node:
        print("error: node is required for GLB inspection and validation", file=sys.stderr)
        return 1
    inspection_report = output / "model.glb.inspection.json"
    validation_report = output / "model.glb.validation.json"
    inspect_result = subprocess.run(
        [node, str(SCRIPTS / "inspect_glb.mjs"), str(model), "--output", str(inspection_report)],
        check=False,
        text=True,
        capture_output=True,
    )
    if inspect_result.returncode:
        print(inspect_result.stderr or inspect_result.stdout, file=sys.stderr)
        return inspect_result.returncode
    inspection = json.loads(inspection_report.read_text(encoding="utf-8"))
    validate_result = subprocess.run(
        [
            node,
            str(SCRIPTS / "validate_glb.mjs"),
            str(model),
            "--output",
            str(validation_report),
            "--max-texture",
            str(args.max_texture),
        ],
        check=False,
        text=True,
        capture_output=True,
    )
    if validate_result.returncode and not args.allow_invalid:
        print(validate_result.stdout, file=sys.stderr)
        print(
            f"error: Khronos validation failed; inspect {validation_report} or use --allow-invalid",
            file=sys.stderr,
        )
        return validate_result.returncode

    playcanvas_model = "./model.glb"
    compatibility_transform = None
    needs_playcanvas_copy = bool(
        {"EXT_meshopt_compression", "EXT_texture_avif"}
        & set(inspection.get("extensionsUsed", []))
    )
    if needs_playcanvas_copy:
        compatibility_path = output / "model.playcanvas.glb"
        compatibility_manifest = output / "model.playcanvas.transform.json"
        decompress_result = subprocess.run(
            [
                node,
                str(SCRIPTS / "prepare_playcanvas_glb.mjs"),
                str(model),
                "--output",
                str(compatibility_path),
                "--manifest",
                str(compatibility_manifest),
            ],
            check=False,
            text=True,
            capture_output=True,
        )
        if decompress_result.returncode:
            print(decompress_result.stderr or decompress_result.stdout, file=sys.stderr)
            return decompress_result.returncode
        playcanvas_model = "./model.playcanvas.glb"
        compatibility_transform = json.loads(
            compatibility_manifest.read_text(encoding="utf-8")
        ).get("transformations", [])
    else:
        (output / "model.playcanvas.glb").unlink(missing_ok=True)
        (output / "model.playcanvas.transform.json").unlink(missing_ok=True)

    (output / "viewer-config.json").write_text(
        json.dumps(
            {
                "threeModelUrl": "./model.glb",
                "playCanvasModelUrl": playcanvas_model,
                "compatibilityTransform": compatibility_transform,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    for asset in ASSETS.iterdir():
        if asset.is_file():
            shutil.copy2(asset, output / asset.name)
    shutil.copytree(DECODER_ASSETS / "draco", output / "decoders" / "draco", dirs_exist_ok=True)
    shutil.copytree(DECODER_ASSETS / "basis", output / "decoders" / "basis", dirs_exist_ok=True)
    shutil.copy2(model, output / "model.glb")

    attribution = model.with_suffix(f"{model.suffix}.attribution.json")
    target_attribution = output / "model.glb.attribution.json"
    if attribution.is_file():
        shutil.copy2(attribution, target_attribution)
    else:
        target_attribution.unlink(missing_ok=True)

    print(f"Viewer prepared at {output}")
    print(f"Inspection report: {inspection_report}")
    print(f"Validation report: {validation_report}")
    print(f"Serve with: python3 -m http.server 8765 --directory {output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
