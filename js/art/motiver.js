// Registeret over alle motivtyper.
//
// Ett sted som vet hva appen kan tegne, og som måler puslbarheten på det
// som kom ut. Nye motiv legges til her og dukker opp i grensesnittet av seg
// selv.

import { makeRng } from '../core/rng.js';
import { genererNeon } from './neon.js';
import { genererEget, harEgetBilde } from './eget.js';
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

// Eget bilde ligger alltid i registeret, men dukker bare opp i
// grensesnittet nar det faktisk finnes et bilde a bruke.
MOTIVER.eget = {
  navn: 'Eget bilde',
  gruppe: 'Mitt',
  krever: harEgetBilde,
  generer: (b, h) => genererEget(b, h),
};

/** Motiv som kan velges akkurat na. */
export function tilgjengeligeMotiv() {
  return Object.entries(MOTIVER).filter(([, m]) => !m.krever || m.krever());
}

export const MOTIVNOKLER = Object.keys(MOTIVER);

/**
 * @param {string} nokkel  motivtype, eller 'tilfeldig'
 * @returns {{canvas, meta}} meta inneholder blant annet puslbarhet 0–100
 */
export function genererMotiv(nokkel, bredde, hoyde, seed, opts = {}) {
  let valgt = nokkel;
  if (valgt === 'tilfeldig') {
    valgt = makeRng(seed + ':motivvalg').pick(tilgjengeligeMotiv().map(([n]) => n));
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
