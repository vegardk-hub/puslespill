// Spillogikken: hva ligger under fingeren, hva henger sammen med hva,
// og når smetter en brikke på plass.
//
// Dette er håndverket i hele appen. Hvis dette ikke føles riktig, spiller
// ingenting annet noen rolle.

import { naboer } from './puzzle.js';

/** Hvor mange runder vi leter etter flere koblinger etter et treff. */
const KASKADE = 6;

export class Spill {
  constructor(puslespill) {
    this.p = puslespill;
    // Eget 1x1-lerret uten transform, brukt bare til isPointInPath.
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    this.treffCtx = c.getContext('2d');
    this.startTid = 0;
    this.trekk = 0;
    this.koblinger = 0;
    /** Brikker valgt med lasso. Flyttes samlet, men kobles ikke sammen. */
    this.utvalg = new Set();
    /** Valgfri test: brikker den sier ja til er usynlige og uklikkbare. */
    this.skjult = null;
    this.dreininger = 0;
  }

  // --- Utvalg (lasso) ------------------------------------------------------

  /** Er brikken los, enkeltstaende og ikke last? Bare slike kan velges. */
  erLos(b) {
    return !b.laast && this.medlemmer(b.gruppe).size === 1;
  }

  /**
   * Velger alle lose brikker med midtpunktet innenfor rektangelet.
   * Midtpunktet, ikke hele brikken: a treffe halve brikken skal telle.
   */
  velgIRekt(rekt) {
    const x1 = Math.min(rekt.x, rekt.x + rekt.w);
    const x2 = Math.max(rekt.x, rekt.x + rekt.w);
    const y1 = Math.min(rekt.y, rekt.y + rekt.h);
    const y2 = Math.max(rekt.y, rekt.y + rekt.h);
    this.utvalg.clear();
    for (const b of this.p.brikker) {
      if (!this.erLos(b)) continue;
      const mx = b.x + this.p.brikkeB / 2;
      const my = b.y + this.p.brikkeH / 2;
      if (mx >= x1 && mx <= x2 && my >= y1 && my <= y2) this.utvalg.add(b.id);
    }
    return this.utvalg.size;
  }

  tomUtvalg() {
    const hadde = this.utvalg.size > 0;
    this.utvalg.clear();
    return hadde;
  }

  /** Loft hele utvalget overst, og gi et handtak som kan dras. */
  startUtvalgDrag() {
    if (!this.utvalg.size) return null;
    if (!this.startTid) this.startTid = performance.now();
    const under = [];
    const over = [];
    for (const id of this.p.rekkefolge) (this.utvalg.has(id) ? over : under).push(id);
    this.p.rekkefolge = under.concat(over);
    return { utvalg: true, sett: this.utvalg };
  }

  flyttSett(sett, dx, dy) {
    for (const id of sett) {
      const b = this.p.brikker[id];
      b.x += dx;
      b.y += dy;
    }
  }

  // --- Treffdeteksjon ------------------------------------------------------

  /** Brikkens midtpunkt i verden - dreiepunktet for rotasjon. */
  _midt(b) {
    return {
      x: b.x + b.bbox.x - b.hjemX + b.bbox.w / 2,
      y: b.y + b.bbox.y - b.hjemY + b.bbox.h / 2,
    };
  }

  /**
   * Regner et punkt tilbake til brikkens egen, urotere ramme.
   * Da kan bade boksproven og isPointInPath brukes uendret, uansett
   * hvordan brikken star.
   */
  _avroter(b, v) {
    if (!b.rot) return v;
    const m = this._midt(b);
    const a = (-b.rot * Math.PI) / 2;
    const dx = v.x - m.x;
    const dy = v.y - m.y;
    return {
      x: m.x + dx * Math.cos(a) - dy * Math.sin(a),
      y: m.y + dx * Math.sin(a) + dy * Math.cos(a),
    };
  }

  _iBoks(b, v) {
    const x = b.bbox.x - b.hjemX + b.x;
    const y = b.bbox.y - b.hjemY + b.y;
    return v.x >= x && v.y >= y && v.x <= x + b.bbox.w && v.y <= y + b.bbox.h;
  }

  _iForm(b, v) {
    return this.treffCtx.isPointInPath(b.path, v.x - b.x + b.hjemX, v.y - b.y + b.hjemY);
  }

  _sok(v) {
    const { brikker, rekkefolge } = this.p;
    // Baklengs gjennom tegnerekkefølgen: den øverste brikken vinner.
    for (let i = rekkefolge.length - 1; i >= 0; i--) {
      const b = brikker[rekkefolge[i]];
      if (b.laast) continue;
      if (this.skjult && this.skjult(b)) continue;
      const lokal = this._avroter(b, v);
      if (this._iBoks(b, lokal) && this._iForm(b, lokal)) return b;
    }
    return null;
  }

  /**
   * Brikken under punktet. Bommer fingeren, leter vi i en liten ring rundt
   * – ingen brikker skal kunne gjemme seg for en litt upresis finger.
   * @param {{x,y}} v punkt i verdenskoordinater
   * @param {number} slakk radius i verdenskoordinater
   */
  brikkeUnder(v, slakk = 0) {
    const treff = this._sok(v);
    if (treff || slakk <= 0) return treff;
    for (const r of [slakk * 0.5, slakk]) {
      for (let k = 0; k < 8; k++) {
        const vin = (k / 8) * Math.PI * 2;
        const t = this._sok({ x: v.x + Math.cos(vin) * r, y: v.y + Math.sin(vin) * r });
        if (t) return t;
      }
    }
    return null;
  }

  // --- Grupper -------------------------------------------------------------

  medlemmer(gruppeId) {
    return this.p.grupper.get(gruppeId) || new Set();
  }

  /** Løfter en gruppe øverst i tegnerekkefølgen. */
  hevGruppe(gruppeId) {
    const sett = this.medlemmer(gruppeId);
    const under = [];
    const over = [];
    for (const id of this.p.rekkefolge) (sett.has(id) ? over : under).push(id);
    this.p.rekkefolge = under.concat(over);
  }

  /** Senker en gruppe nederst - en fastlast del skal ligge under lose brikker. */
  senkGruppe(gruppeId) {
    const sett = this.medlemmer(gruppeId);
    const ned = [];
    const rest = [];
    for (const id of this.p.rekkefolge) (sett.has(id) ? ned : rest).push(id);
    this.p.rekkefolge = ned.concat(rest);
  }

  _slaSammen(a, b) {
    if (a === b) return a;
    let stor = a;
    let liten = b;
    if (this.medlemmer(stor).size < this.medlemmer(liten).size) {
      stor = b;
      liten = a;
    }
    const maal = this.medlemmer(stor);
    for (const id of this.medlemmer(liten)) {
      maal.add(id);
      this.p.brikker[id].gruppe = stor;
    }
    this.p.grupper.delete(liten);
    return stor;
  }

  _flyttGruppe(gruppeId, dx, dy) {
    for (const id of this.medlemmer(gruppeId)) {
      const b = this.p.brikker[id];
      b.x += dx;
      b.y += dy;
    }
  }

  _lasGruppe(gruppeId) {
    for (const id of this.medlemmer(gruppeId)) this.p.brikker[id].laast = true;
  }

  /**
   * Dreier en los brikke en kvart omdreining med klokka.
   * Bare enkeltbrikker kan dreies. En gruppe har alltid rotasjon null,
   * siden brikker bare kobler seg nar de star riktig vei - og da er det
   * ingenting a dreie.
   * @returns {boolean} om noe faktisk ble dreid
   */
  drei(brikke) {
    if (!brikke || brikke.laast) return false;
    if (this.medlemmer(brikke.gruppe).size > 1) return false;
    brikke.rot = (brikke.rot + 1) % 4;
    // Animasjonen gar fra forrige stilling til den nye.
    brikke.animRot = -1;
    this.dreininger++;
    if (!this.startTid) this.startTid = performance.now();
    return true;
  }

  // --- Dragning ------------------------------------------------------------

  /** @returns {{gruppe:number, brikke:object}|null} */
  startDrag(brikke) {
    if (!brikke || brikke.laast) return null;
    if (!this.startTid) this.startTid = performance.now();
    this.hevGruppe(brikke.gruppe);
    return { gruppe: brikke.gruppe, brikke };
  }

  dragTil(handtak, dx, dy) {
    this._flyttGruppe(handtak.gruppe, dx, dy);
  }

  /**
   * Leter etter en kobling for gruppen.
   * Fester til brettet går foran kobling til nabobrikke – ligger den riktig,
   * er det riktig.
   */
  _finnKobling(gruppeId, toleranse, festTilBrett) {
    const ids = [...this.medlemmer(gruppeId)];
    if (!ids.length) return null;
    // En brikke som star feil vei kan ikke koble seg til noe.
    if (ids.some((id) => this.p.brikker[id].rot !== 0)) return null;

    if (festTilBrett) {
      // En gruppe er stiv, så alle medlemmene har samme avvik fra hjemme.
      const b = this.p.brikker[ids[0]];
      const dx = b.hjemX - b.x;
      const dy = b.hjemY - b.y;
      if (Math.hypot(dx, dy) < toleranse) return { dx, dy, hjem: true };
    }

    let best = null;
    for (const id of ids) {
      const b = this.p.brikker[id];
      for (const n of naboer(this.p, b)) {
        if (n.gruppe === gruppeId || n.rot !== 0) continue;
        // Der b måtte ligge for å passe med n.
        const dx = n.x + (b.hjemX - n.hjemX) - b.x;
        const dy = n.y + (b.hjemY - n.hjemY) - b.y;
        const d = Math.hypot(dx, dy);
        if (d < toleranse && (!best || d < best.d)) {
          best = { d, dx, dy, annen: n.gruppe, laast: n.laast };
        }
      }
    }
    return best;
  }

  /**
   * Slipper gruppen og prøver å koble den. Én kobling kan utløse flere:
   * legger du en brikke mellom to grupper, skal begge feste seg.
   *
   * @returns {{koblinger:number, hjem:boolean, ferdig:boolean}}
   */
  slipp(handtak, toleranse, festTilBrett) {
    this.trekk++;
    let gruppe = handtak.gruppe;
    let koblinger = 0;
    let hjem = false;

    for (let runde = 0; runde < KASKADE; runde++) {
      const treff = this._finnKobling(gruppe, toleranse, festTilBrett);
      if (!treff) break;

      this._flyttGruppe(gruppe, treff.dx, treff.dy);
      // Animer fra der brikkene faktisk ble sluppet.
      for (const id of this.medlemmer(gruppe)) {
        const b = this.p.brikker[id];
        b.animX -= treff.dx;
        b.animY -= treff.dy;
      }
      koblinger++;

      if (treff.hjem) {
        this._lasGruppe(gruppe);
        hjem = true;
        break;
      }
      gruppe = this._slaSammen(gruppe, treff.annen);
      // Koblet vi oss til noe som allerede står fast, står vi fast selv.
      if (treff.laast) {
        this._lasGruppe(gruppe);
        hjem = true;
        break;
      }
    }

    if (koblinger) for (const id of this.medlemmer(gruppe)) this.utvalg.delete(id);
    if (hjem) this.senkGruppe(gruppe);
    this.koblinger += koblinger;
    handtak.gruppe = gruppe;
    return { koblinger, hjem, ferdig: this.erFerdig() };
  }

  erFerdig() {
    if (this.p.grupper.size === 1) return true;
    return this.p.brikker.every((b) => b.laast);
  }

  /** Andel brikker som henger sammen med minst én nabo. */
  fremdrift() {
    let festet = 0;
    for (const sett of this.p.grupper.values()) if (sett.size > 1) festet += sett.size;
    for (const b of this.p.brikker) if (b.laast && this.medlemmer(b.gruppe).size === 1) festet++;
    return festet / this.p.brikker.length;
  }

  brukteSekunder() {
    return this.startTid ? (performance.now() - this.startTid) / 1000 : 0;
  }
}

export function formaterTid(sekunder) {
  const m = Math.floor(sekunder / 60);
  const s = Math.floor(sekunder % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
