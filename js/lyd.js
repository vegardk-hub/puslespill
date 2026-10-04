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
  tone(280, 0.05, { type: 'sine', volum: 0.045 });
}

/** Brikken legges ned uten å koble seg. */
export function legg() {
  knepp(240, 0.04, 0.05);
  tone(170, 0.055, { type: 'sine', volum: 0.04, slutt: 115 });
}

/**
 * Kort støyknepp gjennom et smalt filter.
 * En ren tone høres elektronisk ut. Et knepp med litt støy i seg likner
 * mer på to brikker som møtes, og det er den lyden som skal tåle å høres
 * fem hundre ganger.
 */
function knepp(frekvens, varighet = 0.055, volum = 0.09) {
  const a = kontekst();
  if (!a) return;
  const lengde = Math.max(1, Math.floor(a.sampleRate * varighet));
  const buffer = a.createBuffer(1, lengde, a.sampleRate);
  const d = buffer.getChannelData(0);
  for (let i = 0; i < lengde; i++) {
    // Støy som dør raskt ut.
    d[i] = (Math.random() * 2 - 1) * (1 - i / lengde) ** 3;
  }
  const kilde = a.createBufferSource();
  kilde.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frekvens;
  filter.Q.value = 7;
  const g = a.createGain();
  g.gain.value = volum;
  kilde.connect(filter);
  filter.connect(g);
  g.connect(a.destination);
  kilde.start();
}

/**
 * Brikken smetter på plass. Flere koblinger på én gang gir en lysere klang,
 * så det å treffe to naboer samtidig høres bedre ut enn å treffe én.
 */
export function kobling(antall = 1) {
  const grunn = 620 + Math.min(4, antall - 1) * 90;
  knepp(grunn * 1.6, 0.05, 0.11);
  tone(grunn, 0.085, { type: 'triangle', volum: 0.075 });
  tone(grunn * 1.5, 0.06, { type: 'sine', volum: 0.045, nar: 0.02 });
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
    tone(f * 2, 0.2, { type: 'sine', volum: 0.035, nar: i * 0.11 + 0.01 });
  });
  tone(1046.5, 1.1, { type: 'sine', volum: 0.06, nar: 0.46 });
}
