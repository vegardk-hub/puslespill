// Seedet tilfeldighetsgenerator.
// Alt i puslespillet - brikkeformer, motiv, utlegg - utledes av en seed,
// slik at (motiv, antall, seed) beskriver et puslespill fullstendig.

/** Hasher en streng til et 32-bits heltall. */
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 - liten, rask og god nok PRNG. */
export function makeRng(seed) {
  let a = (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0) || 1;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Flyttall i [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** Heltall i [min, max]. */
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    bool: (p = 0.5) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

/** Kort, lesbar seed-streng, f.eks. "k7f2q9". */
export function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff).toString(36).slice(0, 6);
}
