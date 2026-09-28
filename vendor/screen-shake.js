/**
 * Dependency-free JavaScript port of `sajmoni/screen-shake` (MIT).
 * Original: https://github.com/sajmoni/screen-shake
 * Depends in upstream on `park-miller` + `simplex-noise`; this port inlines a
 * small seeded value-noise so the game ships zero extra dependencies.
 *
 * Adaptation: `update()` returns ABSOLUTE offsets (upstream returns deltas),
 * which suits cameras that re-aim every frame.
 */
function makeNoise2D(rand) {
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * (3 - 2 * t);
  const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
  return (x, y) => {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const aa = perm[perm[xi] + yi], ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi], bb = perm[perm[xi + 1] + yi + 1];
    const u = fade(xf), v = fade(yf);
    return (grad(aa, xf, yf) * (1 - u) + grad(ba, xf - 1, yf) * u) * (1 - v)
         + (grad(ab, xf, yf - 1) * (1 - u) + grad(bb, xf - 1, yf - 1) * u) * v;
  };
}
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createScreenShake({
  maxAngle = 10,
  maxOffsetX = 60,
  maxOffsetY = 60,
  duration = 28,
  seed = 1234567,
  speed = 0.4,
} = {}) {
  let trauma = 0;
  const rand = mulberry(seed);
  const nA = makeNoise2D(rand), nX = makeNoise2D(rand), nY = makeNoise2D(rand);
  const decay = 1 / duration;
  return {
    add: (t) => { trauma = Math.min(1, trauma + t); },
    get level() { return trauma; },
    update: (time) => {
      const s = trauma * trauma, tt = time * speed;
      const out = {
        angle: maxAngle * s * nA(tt, 1.7),
        offsetX: maxOffsetX * s * nX(tt, 4.2),
        offsetY: maxOffsetY * s * nY(tt, 8.8),
      };
      trauma = Math.max(0, trauma - decay);
      return out;
    },
  };
}
