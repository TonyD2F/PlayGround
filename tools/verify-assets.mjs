// GATES.md G2: vendored libs + fighter assets present and valid.
// Prints success-only marker.
import { existsSync, readFileSync, statSync } from 'node:fs';

const need = [
  'vendor/tween.esm.js',
  'vendor/nipplejs.js',
  'vendor/N8AO.js',
  'vendor/screen-shake.js',
  'assets/tex/floor.png',
  'assets/tex/fabric.png',
  'assets/tex/sky.png',
];
for (const f of need) {
  if (!existsSync(f) || statSync(f).size === 0) throw new Error('missing: ' + f);
}
const manifest = JSON.parse(readFileSync('assets/fighters/manifest.json', 'utf8'));
for (const [id, file] of Object.entries(manifest)) {
  if (id.startsWith('_')) continue;
  const p = 'assets/fighters/' + file;
  if (!existsSync(p)) throw new Error('manifest points at missing file: ' + p);
  if (!existsSync(p + '.attribution.json')) throw new Error('missing sidecar: ' + p);
}
console.log('asset verification passed');
