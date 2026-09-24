// Registeret over alle motivtyper.
//
// Ett sted som vet hva appen kan tegne, og som måler puslbarheten på det
// som kom ut. Nye motiv legges til her og dukker opp i grensesnittet av seg
// selv.

import { makeRng } from '../core/rng.js';
import { genererNeon } from './neon.js';
import { SCENER, genererScene } from './scener.js';
import { malPuslbarhet } from './tegning.js';

export const MOTIVER = {
  neon: {
    navn: 'Neon',
    gruppe: 'Abstrakt',
    /** Neon har egne paletter, derfor opts. */
    generer: (b, h, seed, opts) => genererNeon(b, h, seed, opts),
  },
};

for (const [nokkel, scene] of Object.entries(SCENER)) {
  MOTIVER[nokkel] = {
    navn: scene.navn,
    gruppe: 'Figurer',
    generer: (b, h, seed) => genererScene(nokkel, b, h, seed),
  };
}

export const MOTIVNOKLER = Object.keys(MOTIVER);

/**
 * @param {string} nokkel  motivtype, eller 'tilfeldig'
 * @returns {{canvas, meta}} meta inneholder blant annet puslbarhet 0–100
 */
export function genererMotiv(nokkel, bredde, hoyde, seed, opts = {}) {
  let valgt = nokkel;
  if (valgt === 'tilfeldig') {
    valgt = makeRng(seed + ':motivvalg').pick(MOTIVNOKLER);
  }
  const motiv = MOTIVER[valgt];
  if (!motiv) throw new Error('Ukjent motiv: ' + nokkel);

  const resultat = motiv.generer(bredde, hoyde, seed, opts);
  const ctx = resultat.canvas.getContext('2d', { willReadFrequently: true });
  const { score } = malPuslbarhet(ctx, bredde, hoyde);

  resultat.meta = {
    ...resultat.meta,
    nokkel: valgt,
    navn: motiv.navn,
    gruppe: motiv.gruppe,
    puslbarhet: score,
  };
  return resultat;
}
