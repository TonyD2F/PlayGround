# Assets — make your own, keep it legal

All game art must be **original or CC0/CC-BY**. No Dragon Ball / Street Fighter
rips, no NonCommercial / NoDerivatives stock.

## 1. Procedural forge (built-in, zero dependencies)

Creates your own CC0 textures locally — no downloads, no licenses to track:

```sh
node tools/forge-assets.mjs          # writes assets/tex/*.png
node tools/forge-assets.mjs --check  # CI check
```

| file | used as |
|---|---|
| `assets/tex/floor.png` | arena platform map (game falls back to runtime canvas if absent) |
| `assets/tex/fabric.png` | gi/jacket weave for future costume materials |
| `assets/tex/sky.png` | dusk-gradient backdrop reference |
| `assets/ATTRIBUTION.json` | license record for forged files |

## 2. External models — `load-sketchfab-threejs` skill (installed)

Scripts live in `.agents/skills/load-sketchfab-threejs/scripts/`.
Drop results into `assets/fighters/<fighter-id>.glb` — the game auto-loads
them at boot and falls back to the procedural model when absent.

```sh
SKILL=.agents/skills/load-sketchfab-threejs

# search (CC0/CC-BY only — filter in the preview sheet + metadata)
python3 "$SKILL/scripts/download_model.py" \
  "low poly fighter" "stylized brawler" --count 12 \
  --max-glb-mb 6 --max-faces 20000 --require-glb --downloadable \
  --preview-sheet /tmp/fighter-search.png

# open /tmp/fighter-search.png, pick a tile, download it
python3 "$SKILL/scripts/download_model.py" "low poly fighter" \
  --download 0 --output assets/fighters/kaito.glb

# inspect + normalize, then A/B-verify in the browser
node "$SKILL/scripts/inspect_glb.mjs" assets/fighters/kaito.glb
node "$SKILL/scripts/normalize_glb.mjs" assets/fighters/kaito.glb \
  --output assets/fighters/kaito.glb   # only if inspect flags legacy materials
python3 "$SKILL/scripts/prepare_viewer.py" \
  --model assets/fighters/kaito.glb --output /tmp/sketchfab-engine-ab
python3 -m http.server 8765 --directory /tmp/sketchfab-engine-ab
# open http://127.0.0.1:8765/ → both panels must say Rendered
```

Keep the `kaito.glb.attribution.json` sidecar. Accepted licenses:
**CC0, CC-BY, MIT, Apache-2.0**. Never NC/ND.

## 3. Reference images — `image-search` skill (installed)

```sh
python3 .agents/skills/image-search/scripts/image_search.py \
  "neon torii gate night" --max_results 8 --license Public --download assets/ref/
```

Reference only — trace/rebuild originals, don't ship copyrighted photos.
