# Public Sketchfab extraction

Use the browser-native exporter vendored in `vendor/sketchfab_downloader_extension`. The supported entry point launches an isolated headless Chrome/Chromium instance, retrieves public viewer resources, and writes a self-contained GLB plus attribution sidecar:

```sh
python3 scripts/extract_public_model.py \
  "https://sketchfab.com/3d-models/example-UID" \
  --output /absolute/path/model.glb
```

The extraction stage performs all model corrections. It decrypts meshes and animation binaries, descrambles protected textures, embeds textures in the GLB, resolves legacy 31-character animation IDs, composes Sketchfab bind-relative bone curves, and fixes one-joint prop attachments by preserving their grip translation while retaining authored rotation. The A/B viewer is only a regression check and is not required for extraction.

The local bridge must consume the ZIP POST body using its exact `Content-Length`; reading until connection close can deadlock because `fetch()` keeps the HTTP connection alive. The bridge also accepts `/progress` and `/error` callbacks so unattended failures terminate instead of waiting indefinitely.

## Gotchas

- Do not use the old Rust/vynxc exporter as the primary path. It can stop at an enabled but textureless material channel and produce white meshes; the vendored browser pipeline follows the viewer's actual material and texture references.
- Do not apply attachment or animation repairs in the viewer. The converter must write them into the GLB: Sketchfab bone curves are bind-relative, while a one-joint prop parented to an animated hand needs its grip translation preserved and its authored rotation retained.
- Keep the extraction browser profile isolated and temporary. A reused Chrome profile can inherit extensions, stale service workers, or cached viewer state.
- Headless Chrome can stall while processing protected images through `OffscreenCanvas`; the launcher uses a tiny off-screen app window so the browser remains unattended while retaining normal image APIs.
- Always keep the attribution sidecar next to the GLB. The extractor creates it from `/i/models/{uid}` and falls back to `CC` when Sketchfab omits a license.
- Khronos warnings about unused tangents are expected when the source has tangents but no normal map; treat validator errors, broken embedded images, missing animation targets, or missing material textures as failures.

After extraction, inspect the artifact and run the exporter tests:

```sh
node scripts/inspect_glb.mjs /absolute/path/model.glb
python3 -m py_compile scripts/extract_public_model.py scripts/serve_public_extractor.py
(cd vendor/sketchfab_downloader_extension && npm test)
```

For browser proof only, prepare the isolated viewer and serve it over HTTP:

```sh
python3 scripts/prepare_viewer.py --model /absolute/path/model.glb --output /tmp/sketchfab-engine-ab
python3 -m http.server 8765 --directory /tmp/sketchfab-engine-ab
```
