---
name: load-sketchfab-threejs
description: Find low-resource downloadable Sketchfab models, preserve attribution, inspect and normalize GLB materials, load assets and animation clips with official Three.js GLTFLoader and PlayCanvas Container loaders, and prove geometry, animation, and material fidelity in a real browser. Use for Sketchfab search/download, Three.js or PlayCanvas GLB integration, missing or incorrect textures/materials/animations, legacy glTF extensions, camera-framing defects, or browser-visible A/B verification.
---

# Load Sketchfab models into Three.js and PlayCanvas

Use the bundled downloader, inspector, safe normalizer, and A/B viewer. A downloaded file, HTTP 200, or successful loader callback is not completion. Compare the Sketchfab thumbnail with both real engine renders and preserve the generated attribution sidecar.

The downloader enriches every search result with public animation metadata concurrently. Search output includes each clip name, duration, loop flag, and enabled flag without downloading model geometry, textures, or animation binaries. Use `--no-animations` to skip this enrichment or `--animation-workers 1..24` to tune concurrency. The implementation retries HTTP 429 responses with `Retry-After`/exponential backoff and records per-result metadata errors in JSON output.

Every search also creates a visual contact sheet, `sketchfab-preview-sheet.png` by default, plus a same-name `.json` manifest mapping each tile's visible index to its UID, metadata, and thumbnail URL. Use `--preview-sheet /absolute/path/results.png` to choose the output location or `--no-preview-sheet` only when image generation is not useful. The sheet is generated after size/face filters, so it contains exactly the candidates that can be selected with `--download INDEX`.

Searches target non-downloadable Sketchfab models by default. Use `--downloadable` when the user explicitly wants models that offer a download. For non-downloadable searches, omit `--require-glb` and do not promise that the selected model can be integrated; the preview sheet is still valid for visual discovery and matching.

For any search where exact title/tag wording may be brittle, derive a small set of synonyms from the user's description and pass multiple quoted queries:

```sh
python3 "$SKILL_DIR/scripts/download_model.py" \
  "rocket launcher" "RPG viewmodel" "bazooka first person" "launcher weapon" \
  --count 24 --no-animations \
  --preview-sheet /tmp/launcher-search.png
```

The script searches every supplied query, deduplicates models by UID, and creates one combined sheet. Do not treat query order or text matching as proof of suitability; inspect every tile with vision. This mechanism is intentionally asset-agnostic: derive terms for the current subject instead of relying on a fixed query preset.

Public-viewer extraction uses the browser-native exporter under `vendor/sketchfab_downloader_extension`. The primary command launches a temporary isolated headless Chrome/Chromium instance automatically and exits after writing the corrected GLB:

```sh
python3 "$SKILL_DIR/scripts/extract_public_model.py" \
  "https://sketchfab.com/3d-models/example-UID" \
  --output /absolute/project/public/models/model.glb
```

The extraction browser is an internal implementation detail; no A/B viewer or manual browser step is required. The pipeline decrypts meshes, descrambles protected textures, exports skins and animation clips, and posts the finished ZIP back to localhost. The bridge extracts the single GLB and automatically creates `<model>.glb.attribution.json` beside it using `/i/models/{uid}` metadata. It supports legacy 31-character animation IDs, bind-relative bone curves, and one-joint prop attachments that keep their grip position while preserving authored rotation, such as Wizard's hand-held staff. If the metadata endpoint provides no license, record the license as `CC`. Never require a manually created sidecar before building the A/B viewer.

## Keep the test lightweight

Set the skill path once:

```sh
SKILL_DIR="${CODEX_HOME:-$HOME/.codex}/skills/load-sketchfab-threejs"
```

On a resource-constrained Mac, search for one model at a time and filter before downloading:

```sh
python3 "$SKILL_DIR/scripts/download_model.py" "low poly tree" \
  --count 12 --max-glb-mb 5 --max-faces 15000 --require-glb
```

Open the generated `sketchfab-preview-sheet.png` with vision before selecting a result. Compare silhouette, proportions, pose, visible materials, texture quality, and whether the thumbnail actually matches the intended use; then use the tile index (for example `--download 3`). Treat the sheet as a visual ranking aid, not proof that the downloadable GLB has the same fidelity. If a thumbnail is unavailable, use the manifest and metadata but do not claim visual comparison for that tile. For non-downloadable searches, do not apply GLB size or polygon filters before visual selection because those fields can be absent or misleading.

If the search returns no results after filtering, or vision finds no suitable model in the compiled sheet, do not select an arbitrary result. Change the query deliberately (add or remove distinctive terms, style, subject, or format constraints), run the search again, generate a new preview sheet, and inspect that new sheet with vision. Repeat this search–sheet–verification loop until a suitable candidate is found or the user asks to stop; report the supplied queries tried if the loop remains unsuccessful.

Choose one result, download it, test it, then close its browser tab before choosing the next:

```sh
python3 "$SKILL_DIR/scripts/download_model.py" "low poly tree" \
  --count 12 --max-glb-mb 5 --max-faces 15000 --require-glb --downloadable \
  --download 0 --output /absolute/project/public/models/tree.glb
```

Use the built-in Sketchfab token pool by default. `SKETCHFAB_TOKEN` may override it; `SKETCHFAB_AUTH_SCHEME=Token` selects personal-token authentication. Never print token values. Keep `tree.glb.attribution.json` beside `tree.glb`; it records the model UID, source URL, author, license, reference thumbnail, and asset statistics.

Prefer CC Attribution results when choices are otherwise similar. Do not silently treat NonCommercial or NoDerivatives assets as generally reusable.

## Inspect before integration

```sh
node "$SKILL_DIR/scripts/inspect_glb.mjs" /absolute/project/public/models/tree.glb
```

Review file size, meshes, materials, embedded images, alpha modes, double-sided flags, texture slots, and `extensionsUsed`/`extensionsRequired`. Prefer GLB because it keeps buffers and textures together.

Treat these as compatibility signals:

- `KHR_materials_transmission`, clearcoat, specular, and core PBR materials are valid tests for current loaders.
- `KHR_materials_pbrSpecularGlossiness` is archived. Three.js may load geometry while dropping its diffuse textures.
- `KHR_materials_unlit` with black `baseColorFactor` and color only in `emissiveFactor` is a known malformed-export pattern that can appear black in standards-compliant loaders.
- Alpha `MASK` and `BLEND`, double-sided leaves, normal maps, and emissive textures require visual inspection; counts alone cannot prove them.

## Normalize only safe legacy patterns

Run the normalizer only after inspection or a visible A/B mismatch:

```sh
node "$SKILL_DIR/scripts/normalize_glb.mjs" input.glb --output normalized.glb
```

The normalizer:

- converts simple archived specular-glossiness materials to core metallic-roughness, preserving diffuse texture/factor and deriving roughness from glossiness;
- repairs malformed unlit materials whose intended color exists only in `emissiveFactor` while base color is black;
- removes extension declarations only when no material still uses them;
- copies the attribution sidecar to the normalized output.

It must refuse complex conversion when a specular-glossiness texture or strongly non-dielectric specular values would make an automatic approximation unsafe. Keep the original GLB and report that a conversion was performed.

## Build the isolated A/B viewer

```sh
python3 "$SKILL_DIR/scripts/prepare_viewer.py" \
  --model /absolute/project/public/models/tree.glb \
  --output /tmp/sketchfab-engine-ab
python3 -m http.server 8765 --directory /tmp/sketchfab-engine-ab
```

Open `http://127.0.0.1:8765/` through HTTP, never `file://`. The viewer shows the Sketchfab reference thumbnail and a Three.js preview:

1. Sketchfab reference thumbnail.
2. Three.js with the official matching `GLTFLoader` addon.

Original materials are the default. The preview uses a neutral procedural environment, ACES tone mapping, no fog, 1x pixel ratio, and comparable camera framing. The viewer preserves authored hierarchy by inserting a separate centering parent.

Useful diagnostic URLs:

- `?only=three` loads the Three.js preview for a lower-memory check.
- `?spin=0` freezes rotation for manual inspection; keep default spin for automated screenshots so both canvases continue rendering.
- `?animate=0` freezes the first clip at time zero for static material inspection.

## Browser acceptance

Wait until `document.body.dataset.compareState` is `ready`. Inspect each panel's `data-details` JSON and confirm:

- reference and Three.js say `Rendered`;
- Three.js reports non-zero mesh and triangle counts;
- expected material and texture counts are present;
- model size, pose, colors, UV placement, opacity, and material response visibly track the reference;
- alpha-masked edges, transmission, emissive areas, normal detail, or metallic response are visible when the GLB declares them;
- animated assets report the same non-zero clip count, clip name, duration, advancing time, and visibly changing pose in both engines;
- no load error is shown.

Capture a screenshot containing all three columns and the statistics. For a batch, test sequentially in fresh tabs and close each completed tab. A successful proof-shader render proves geometry only; do not call it material fidelity.

## Engine integration

For Three.js projects, use the project's installed Three.js version and its matching addon:

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltf = await new GLTFLoader().loadAsync('/models/tree.glb');
scene.add(gltf.scene);
```

Update world matrices before measuring `THREE.Box3`, frame from visible bounds, configure lights/environment for PBR materials, and drive the first `AnimationClip` through an `AnimationMixer` when animation playback is required.

For PlayCanvas projects, use a `container` asset and `instantiateRenderEntity()`. Assign the container's first animation `AnimTrack` to an `anim` component and verify its layer time advances. Synchronize hierarchy before reading mesh-instance bounds. Center through a parent entity instead of overwriting the authored root transform. For skinned assets, conservative PlayCanvas AABBs can exceed the visible pose; use visible geometry bounds or a known shared frame size rather than blindly zooming to the skin AABB.

## Failure guide

- White Three.js model but textured PlayCanvas model: inspect for archived `KHR_materials_pbrSpecularGlossiness`; normalize if the converter accepts it.
- Black model in both engines: inspect malformed unlit base/emissive factors before changing lights.
- PlayCanvas model tiny but Three.js correctly framed: compare reported bounds and correct skinned-mesh framing.
- Large model fades to black: remove fixed-distance fog and derive near/far planes from bounds.
- Ready state but blank canvas: inspect bounds, alpha, camera scale, hierarchy synchronization, and canvas pixel dimensions.
- Missing textures: use GLB or preserve every `.gltf` relative URI.
- Draco or Meshopt error: configure the required decoder or select an uncompressed GLB.
- Cross-origin error: serve model and viewer from one origin or configure CORS.

## Completion standard

Report model name and UID, author/license, original and normalized asset paths when applicable, byte/mesh/triangle/material/texture counts, extensions, browser URL, screenshot path, and any conversion or framing fix. Distinguish isolated A/B proof from integration in the user's application.
