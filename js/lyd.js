// Lyd laget med oscillatorer – ingen lydfiler, ingenting å laste ned.
//
// Klikket når en brikke smetter på plass er den enkeltdetaljen som gjør mest
// for følelsen. iOS krever at lyd startes fra en berøring, og det er akkurat
// det som skjer: første pointerdown vekker lydkortet.

let ac = null;
export let dempet = false;

export function settDempet(verdi) {
  dempet = verdi;
}

function kontekst() {
  if (dempet) return null;
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  } catch {
    return null;
  }
}

/** Vekker lydkortet fra en berøring. Trygt å kalle så ofte man vil. */
export function vekk() {
  kontekst();
}

function tone(frekvens, varighet, { type = 'sine', volum = 0.1, nar = 0, slutt = null } = {}) {
  const a = kontekst();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  const t = a.currentTime + nar;
  o.type = type;
  o.frequency.setValueAtTime(frekvens, t);
  if (slutt) o.frequency.exponentialRampToValueAtTime(slutt, t + varighet);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(volum, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + varighet);
  o.connect(g);
  g.connect(a.destination);
  o.start(t);
  o.stop(t + varighet + 0.03);
}

/** Brikken løftes fra bordet. */
export function loft() {
  tone(280, 0.05, { type: 'sine', volum: 0.05 });
}

/** Brikken legges ned uten å koble seg. */
export function legg() {
  tone(180, 0.06, { type: 'sine', volum: 0.05, slutt: 120 });
}

/**
 * Brikken smetter på plass. Flere koblinger på én gang gir en lysere klang,
 * så det å treffe to naboer samtidig høres bedre ut enn å treffe én.
 */
export function kobling(antall = 1) {
  const grunn = 620 + Math.min(4, antall - 1) * 90;
  tone(grunn, 0.09, { type: 'triangle', volum: 0.11 });
  tone(grunn * 1.5, 0.07, { type: 'sine', volum: 0.06, nar: 0.025 });
}

/** Gruppen låste seg fast på brettet. */
export function fest() {
  tone(440, 0.10, { type: 'triangle', volum: 0.10 });
  tone(660, 0.12, { type: 'sine', volum: 0.08, nar: 0.04 });
  tone(880, 0.14, { type: 'sine', volum: 0.06, nar: 0.08 });
}

/** Puslespillet er ferdig. */
export function ferdig() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(f, 0.34, { type: 'triangle', volum: 0.1, nar: i * 0.11 });
  });
}
