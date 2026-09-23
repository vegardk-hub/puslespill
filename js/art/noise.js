// Verdistoy (value noise) med seedet permutasjonstabell.
// Brukes som grunnlag for flow fields i motivgeneratoren.

import { makeRng } from '../core/rng.js';

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

export function makeNoise2D(seed) {
  const rng = makeRng(seed);
  const size = 256;
  const mask = size - 1;
  const grad = new Float32Array(size * size);
  for (let i = 0; i < grad.length; i++) grad[i] = rng.next();

  const at = (x, y) => grad[((y & mask) << 8) | (x & mask)];

  return function noise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const top = lerp(at(xi, yi), at(xi + 1, yi), xf);
    const bot = lerp(at(xi, yi + 1), at(xi + 1, yi + 1), xf);
    return lerp(top, bot, yf); // [0, 1)
  };
}

/** Flerlags stoy - gir mer naturlig struktur enn ett lag. */
export function makeFbm2D(seed, octaves = 4, lacunarity = 2, gain = 0.5) {
  const noise = makeNoise2D(seed);
  return function fbm(x, y) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  };
}
