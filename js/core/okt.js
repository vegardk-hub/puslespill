// Å pakke et pågående puslespill ned og opp igjen.
//
// Her betaler seed-designet fra fase 1 seg: brikkeformene følger av
// (motiv, antall, kuttstil, seed), så de trenger ikke lagres i det hele
// tatt. Vi bygger puslespillet på nytt fra de fire tallene og legger bare
// posisjonene tilbake oppå. Det som faktisk lagres er under 10 kB for
// 500 brikker.

import { nullstillGrupper } from './puzzle.js';

export const OKT_VERSJON = 1;

/** @returns {object} klart for IndexedDB (typede tabeller lagres som de er) */
export function pakk(tilstand, puslespill, spill, kamera) {
  const n = puslespill.brikker.length;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const rot = new Uint8Array(n);
  const gruppe = new Uint16Array(n);
  const laast = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const b = puslespill.brikker[i];
    x[i] = b.x;
    y[i] = b.y;
    rot[i] = b.rot;
    gruppe[i] = b.gruppe;
    laast[i] = b.laast ? 1 : 0;
  }

  return {
    versjon: OKT_VERSJON,
    lagret: Date.now(),
    // Nok til å bygge nøyaktig samme puslespill igjen.
    oppskrift: {
      motiv: tilstand.motiv,
      seed: tilstand.seed,
      onsketAntall: tilstand.onsketAntall,
      kuttstil: tilstand.kuttstil,
      palett: tilstand.palett,
      sideforhold: tilstand.sideforhold,
      bildeId: tilstand.bildeId || null,
      dagens: tilstand.dagens || null,
    },
    brytere: {
      spokelse: tilstand.spokelse,
      festTilBrett: tilstand.festTilBrett,
      rotasjon: tilstand.rotasjon,
      kanterForst: tilstand.kanterForst,
      visBilde: tilstand.visBilde,
      lyd: tilstand.lyd,
    },
    stilling: { x, y, rot, gruppe, laast, rekkefolge: Uint16Array.from(puslespill.rekkefolge) },
    fremdrift: {
      sekunder: spill.brukteSekunder(),
      trekk: spill.trekk,
      koblinger: spill.koblinger,
      dreininger: spill.dreininger,
    },
    kamera: { x: kamera.x, y: kamera.y, skala: kamera.skala },
  };
}

/**
 * Legger en lagret stilling tilbake på et nybygd puslespill.
 * Puslespillet må være bygget av samme oppskrift, ellers passer ikke
 * brikketallet – og da gjør vi ingenting heller enn å lage rot.
 *
 * @returns {boolean} om stillingen ble tatt i bruk
 */
export function pakkUt(post, puslespill, spill, kamera) {
  const s = post && post.stilling;
  if (!s || s.x.length !== puslespill.brikker.length) return false;

  nullstillGrupper(puslespill);
  puslespill.grupper.clear();

  for (let i = 0; i < puslespill.brikker.length; i++) {
    const b = puslespill.brikker[i];
    b.x = s.x[i];
    b.y = s.y[i];
    b.rot = s.rot[i];
    b.gruppe = s.gruppe[i];
    b.laast = !!s.laast[i];
    b.animX = 0;
    b.animY = 0;
    b.animRot = 0;
    if (!puslespill.grupper.has(b.gruppe)) puslespill.grupper.set(b.gruppe, new Set());
    puslespill.grupper.get(b.gruppe).add(b.id);
  }

  if (s.rekkefolge && s.rekkefolge.length === puslespill.brikker.length) {
    puslespill.rekkefolge = Array.from(s.rekkefolge);
  }

  const f = post.fremdrift || {};
  // Klokka lagres som forbrukt tid, ikke som et tidspunkt. Ellers ville
  // pausen mellom to økter blitt talt med.
  spill.startTid = performance.now() - (f.sekunder || 0) * 1000;
  spill.trekk = f.trekk || 0;
  spill.koblinger = f.koblinger || 0;
  spill.dreininger = f.dreininger || 0;

  if (post.kamera && kamera) {
    kamera.x = post.kamera.x;
    kamera.y = post.kamera.y;
    kamera.skala = post.kamera.skala;
  }
  return true;
}

/** Dagens puslespill: samme motiv og samme kutt for alle, hver dag. */
export function dagensOppskrift(dato = new Date()) {
  const d = `${dato.getFullYear()}-${String(dato.getMonth() + 1).padStart(2, '0')}-${String(dato.getDate()).padStart(2, '0')}`;
  return {
    dagens: d,
    seed: 'dag-' + d,
    motiv: 'tilfeldig',
    onsketAntall: 100,
    kuttstil: 'klassisk',
    palett: 'auto',
    sideforhold: 1.5,
  };
}
