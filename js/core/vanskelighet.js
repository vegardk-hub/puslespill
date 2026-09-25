// Vanskelighetsgrad.
//
// Brikketallet alene sier lite. Hundre brikker av en skarp tegning med
// spøkelsesbilde under er en helt annen oppgave enn hundre brikker av en
// blå himmel, roterte, uten hjelp. Her regnes alt sammen til ett tall.

export const NIVAER = [
  { grense: 18, navn: 'Lett', farge: '#4cd964' },
  { grense: 36, navn: 'Middels', farge: '#22e0ff' },
  { grense: 56, navn: 'Krevende', farge: '#ffd93c' },
  { grense: 76, navn: 'Vanskelig', farge: '#ff9a3c' },
  { grense: Infinity, navn: 'Beinhard', farge: '#ff5a6e' },
];

/**
 * @param {object} p
 * @param {number} p.antall        brikker
 * @param {boolean} p.rotasjon     må brikkene snus?
 * @param {string} p.kuttstil      klassisk | bolget | kaotisk
 * @param {number} p.puslbarhet    0–100, målt lokal kontrast i motivet
 * @param {number} p.spokelse      0–1, styrken på spøkelsesbildet
 * @param {boolean} p.festTilBrett festner riktig plasserte brikker seg?
 * @param {boolean} p.kanterForst  hjelpemodus som holder midtbrikkene unna
 * @returns {{score:number, niva:object, deler:object}}
 */
export function regnVanskelighet(p) {
  // Brikketallet er grunnlaget, på logaritmisk skala: spranget fra 12 til
  // 24 brikker kjennes like stort som fra 250 til 500.
  const antall = Math.max(4, p.antall || 4);
  let score = Math.log2(antall / 10) * 15;

  const deler = { brikker: score };

  // Å måtte snu hver brikke er den største enkeltfaktoren.
  if (p.rotasjon) { score *= 1.38; deler.rotasjon = score - deler.brikker; }

  const kutt = p.kuttstil === 'kaotisk' ? 1.12 : (p.kuttstil === 'bolget' ? 1.05 : 1);
  score *= kutt;

  // Et flatt motiv er vanskeligere enn et motiv med landemerker overalt.
  const flathet = Math.max(0, Math.min(1, (100 - (p.puslbarhet ?? 70)) / 100));
  score *= 1 + flathet * 0.65;

  // Hjelpemidlene trekker ned.
  score *= 1 - Math.min(0.35, (p.spokelse || 0) * 0.8);
  if (p.festTilBrett) score *= 0.88;
  if (p.kanterForst) score *= 0.94;

  score = Math.max(1, Math.min(100, Math.round(score)));
  return { score, niva: NIVAER.find((n) => score < n.grense), deler };
}

/**
 * Ferdige oppsett. Endrer flere brytere samtidig, så man slipper å stille
 * dem enkeltvis for å komme i gang.
 */
export const OPPSETT = {
  barn: {
    navn: 'Barn',
    antall: 24, rotasjon: false, kuttstil: 'klassisk',
    spokelse: 0.32, festTilBrett: true, kanterForst: false,
  },
  lett: {
    navn: 'Lett',
    antall: 50, rotasjon: false, kuttstil: 'klassisk',
    spokelse: 0.15, festTilBrett: true, kanterForst: true,
  },
  vanlig: {
    navn: 'Vanlig',
    antall: 150, rotasjon: false, kuttstil: 'klassisk',
    spokelse: 0, festTilBrett: true, kanterForst: false,
  },
  vanskelig: {
    navn: 'Vanskelig',
    antall: 300, rotasjon: true, kuttstil: 'bolget',
    spokelse: 0, festTilBrett: false, kanterForst: false,
  },
  beinhard: {
    navn: 'Beinhard',
    antall: 500, rotasjon: true, kuttstil: 'kaotisk',
    spokelse: 0, festTilBrett: false, kanterForst: false,
  },
};
