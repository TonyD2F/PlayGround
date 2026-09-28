#!/usr/bin/env node
/**
 * Asset Forge — create your own CC0 textures for COSMIC CLASH 3D.
 *
 * Zero dependencies (uses node:zlib + a minimal PNG encoder).
 * Everything generated is 100% original and yours: no ripped IP.
 *
 *   node tools/forge-assets.mjs          # writes assets/tex/*.png
 *   node tools/forge-assets.mjs --check  # verify files exist
 *
 * Pairs with the `load-sketchfab-threejs` skill for external models:
 *   python3 .agents/skills/load-sketchfab-threejs/scripts/download_model.py \
 *     "low poly fighter" --count 12 --max-glb-mb 5 --require-glb --downloadable \
 *     --download 0 --output assets/fighters/<id>.glb
 *   node  .agents/skills/load-sketchfab-threejs/scripts/inspect_glb.mjs \
 *     assets/fighters/<id>.glb
 * Only CC0 / CC-BY results. Keep the .attribution.json sidecar.
 * The game auto-loads assets/fighters/<fighter-id>.glb when present,
 * otherwise it falls back to the built-in procedural model.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEX = join(ROOT, 'assets', 'tex');

function crc32(buf) {
  let table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** pixels: Buffer RGBA, w*h*4 */
function writePNG(path, w, h, pixels) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    pixels.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', (() => { const b = Buffer.alloc(13); b.writeUInt32BE(w); b.writeUInt32BE(h, 4); b[8] = 8; b[9] = 6; return b; })()),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  console.log('forged', path, `${w}x${h}`);
}
let seed = 1337;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; }

function forgeFloor(S = 512) {
  const px = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x - S / 2, dy = y - S / 2, r = Math.hypot(dx, dy) / (S / 2);
    const base = 44 + 26 * (1 - Math.min(1, r));
    const ring = Math.abs(((r * S / 2) % 64) - 32) < 1.6 ? 26 : 0;
    const seam = Math.abs(((Math.atan2(dy, dx) / Math.PI * 12) % 1) - 0.5) < 0.012 && r > 0.18 ? 14 : 0;
    const speck = rnd() * 14;
    const i = (y * S + x) * 4;
    px[i] = base * 0.75 + ring; px[i + 1] = base * 0.85 + ring; px[i + 2] = base * 1.5 + ring + seam; px[i + 3] = 255;
    px[i] += speck; px[i + 1] += speck; px[i + 2] += speck;
  }
  // gold emblem ring
  for (let a = 0; a < 360; a += 1) {
    const t = a * Math.PI / 180;
    for (const rr of [70, 71, 72, 73, 74]) {
      const x = Math.round(S / 2 + Math.cos(t) * rr), y = Math.round(S / 2 + Math.sin(t) * rr);
      const i = (y * S + x) * 4; px[i] = 255; px[i + 1] = 208; px[i + 2] = 63;
    }
  }
  writePNG(join(TEX, 'floor.png'), S, S, px);
}
function forgeFabric(S = 256) {
  const px = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const weave = ((x >> 2) + (y >> 2)) % 2 === 0 ? 18 : 0;
    const fold = Math.sin(x / S * Math.PI * 6) * 10;
    const i = (y * S + x) * 4;
    px[i] = 30 + weave + fold; px[i + 1] = 70 + weave + fold; px[i + 2] = 255; px[i + 3] = 255;
  }
  writePNG(join(TEX, 'fabric.png'), S, S, px);
}
function forgeSky(W = 512, H = 512) {
  const px = Buffer.alloc(W * H * 4);
  const stops = [[7, 10, 26], [20, 16, 54], [64, 32, 96], [10, 8, 30]];
  for (let y = 0; y < H; y++) {
    const k = y / (H - 1) * (stops.length - 1), i0 = Math.floor(k), f = k - i0;
    const a = stops[i0], b = stops[Math.min(stops.length - 1, i0 + 1)];
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      px[i] = a[0] + (b[0] - a[0]) * f; px[i + 1] = a[1] + (b[1] - a[1]) * f;
      px[i + 2] = a[2] + (b[2] - a[2]) * f; px[i + 3] = 255;
    }
  }
  // stars
  for (let s = 0; s < 700; s++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H * 0.8), b = 150 + rnd() * 105;
    const i = (y * W + x) * 4; px[i] = px[i + 1] = px[i + 2] = b;
  }
  writePNG(join(TEX, 'sky.png'), W, H, px);
}

mkdirSync(TEX, { recursive: true });
mkdirSync(join(ROOT, 'assets', 'fighters'), { recursive: true });
if (process.argv.includes('--check')) {
  const need = ['tex/floor.png', 'tex/fabric.png', 'tex/sky.png'];
  const missing = need.filter(f => !existsSync(join(ROOT, 'assets', f)));
  console.log(missing.length ? 'MISSING: ' + missing.join(', ') : 'all forged assets present');
  process.exit(missing.length ? 1 : 0);
} else {
  forgeFloor(); forgeFabric(); forgeSky();
  const attr = {
    license: 'CC0-1.0', author: 'COSMIC CLASH 3D Asset Forge (procedural)',
    note: 'Generated locally by tools/forge-assets.mjs. Free for any use, no attribution required.',
    external_models: 'See assets/README.md — CC0/CC-BY only, keep .attribution.json sidecars.',
  };
  writeFileSync(join(ROOT, 'assets', 'ATTRIBUTION.json'), JSON.stringify(attr, null, 2) + '\n');
  console.log('forged assets/ATTRIBUTION.json');
}
