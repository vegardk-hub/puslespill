// Lagring i IndexedDB.
//
// Bildene blir liggende på iPaden. De sendes ingen steder, de lastes ikke
// opp noe sted, og appen har ingen server å sende dem til i det hele tatt.

const DB_NAVN = 'puslespill';
const VERSJON = 1;
const BILDER = 'bilder';

let dbLofte = null;

function apne() {
  if (dbLofte) return dbLofte;
  dbLofte = new Promise((ok, feil) => {
    const r = indexedDB.open(DB_NAVN, VERSJON);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(BILDER)) {
        db.createObjectStore(BILDER, { keyPath: 'id' });
      }
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => feil(r.error);
  }).catch((e) => {
    // Privat modus og blokkert lagring skal ikke velte appen – da får man
    // bruke bildet i denne økten og ikke mer.
    dbLofte = null;
    throw e;
  });
  return dbLofte;
}

function kjor(butikk, modus, arbeid) {
  return apne().then((db) => new Promise((ok, feil) => {
    const t = db.transaction(butikk, modus);
    const b = t.objectStore(butikk);
    let svar;
    const r = arbeid(b);
    if (r) r.onsuccess = () => { svar = r.result; };
    t.oncomplete = () => ok(svar);
    t.onerror = () => feil(t.error);
    t.onabort = () => feil(t.error);
  }));
}

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

export function nyId() {
  return 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}
