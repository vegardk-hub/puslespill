// Lagring i IndexedDB.
//
// Bildene og spillene blir liggende på iPaden. De sendes ingen steder, de
// lastes ikke opp noe sted, og appen har ingen server å sende dem til.
//
// Fire lagre:
//   bilder        egne bilder, med miniatyr
//   spill         puslespillet som er i gang nå
//   fullforte     samlingen av ferdige puslespill
//   innstillinger brytere og valg, så appen husker hvordan du liker den

const DB_NAVN = 'puslespill';
const VERSJON = 2;
export const BILDER = 'bilder';
export const SPILL = 'spill';
export const FULLFORTE = 'fullforte';
export const INNSTILLINGER = 'innstillinger';

let dbLofte = null;
/**
 * Synkron referanse til den åpne databasen.
 *
 * Ved pagehide river nettleseren siden ned rett etter hendelsen. En
 * IndexedDB-transaksjon som åpnes synkront inne i hendelsen blir fullført;
 * en som først venter på et løfte gjør det ikke. Derfor holder vi på
 * databasen her, slik at siste lagring faktisk rekker fram.
 */
let dbKlar = null;

function apne() {
  if (dbLofte) return dbLofte;
  dbLofte = new Promise((ok, feil) => {
    const r = indexedDB.open(DB_NAVN, VERSJON);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const navn of [BILDER, SPILL, FULLFORTE, INNSTILLINGER]) {
        if (!db.objectStoreNames.contains(navn)) {
          db.createObjectStore(navn, { keyPath: 'id' });
        }
      }
    };
    r.onsuccess = () => { dbKlar = r.result; ok(r.result); };
    r.onerror = () => feil(r.error);
  }).catch((e) => {
    // Privat modus og blokkert lagring skal ikke velte appen – da får man
    // spille i denne økten og ikke mer.
    dbLofte = null;
    throw e;
  });
  return dbLofte;
}

function utfor(db, butikk, modus, arbeid) {
  return new Promise((ok, feil) => {
    const t = db.transaction(butikk, modus);
    const b = t.objectStore(butikk);
    let svar;
    const r = arbeid(b);
    if (r) r.onsuccess = () => { svar = r.result; };
    t.oncomplete = () => ok(svar);
    t.onerror = () => feil(t.error);
    t.onabort = () => feil(t.error);
  });
}

function kjor(butikk, modus, arbeid) {
  // Er databasen allerede åpen, starter transaksjonen med en gang - uten
  // å gå veien om et løfte først.
  if (dbKlar) {
    try {
      return utfor(dbKlar, butikk, modus, arbeid);
    } catch (e) {
      dbKlar = null;      // lukket eller utdatert; åpne på nytt
      dbLofte = null;
    }
  }
  return apne().then((db) => utfor(db, butikk, modus, arbeid));
}

// --- Bilder ----------------------------------------------------------------

export function lagreBilde(post) {
  return kjor(BILDER, 'readwrite', (b) => b.put(post));
}

export function hentBilder() {
  return kjor(BILDER, 'readonly', (b) => b.getAll())
    .then((liste) => (liste || []).sort((a, b) => b.laget - a.laget));
}

export function hentBilde(id) {
  return kjor(BILDER, 'readonly', (b) => b.get(id));
}

export function slettBilde(id) {
  return kjor(BILDER, 'readwrite', (b) => b.delete(id));
}

// --- Pågående spill --------------------------------------------------------

/** Det er alltid bare ett spill i gang, så det har fast nøkkel. */
export function lagreSpill(post) {
  return kjor(SPILL, 'readwrite', (b) => b.put({ ...post, id: 'aktivt' }));
}

export function hentSpill() {
  return kjor(SPILL, 'readonly', (b) => b.get('aktivt'));
}

export function slettSpill() {
  return kjor(SPILL, 'readwrite', (b) => b.delete('aktivt'));
}

// --- Samlingen -------------------------------------------------------------

export function lagreFullfort(post) {
  return kjor(FULLFORTE, 'readwrite', (b) => b.put(post));
}

export function hentFullforte() {
  return kjor(FULLFORTE, 'readonly', (b) => b.getAll())
    .then((liste) => (liste || []).sort((a, b) => b.dato - a.dato));
}

export function slettFullfort(id) {
  return kjor(FULLFORTE, 'readwrite', (b) => b.delete(id));
}

// --- Innstillinger ---------------------------------------------------------

export function lagreInnstillinger(verdier) {
  return kjor(INNSTILLINGER, 'readwrite', (b) => b.put({ id: 'valg', ...verdier }));
}

export function hentInnstillinger() {
  return kjor(INNSTILLINGER, 'readonly', (b) => b.get('valg'));
}

export function nyId() {
  return 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}
