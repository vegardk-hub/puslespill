// Berøring: dra brikker, panorer bordet, pinch-zoom.
//
// Reglene er de samme som på et ekte bord:
//   én finger på en brikke   → dra brikken (og alt som henger på den)
//   én finger på tomt bord   → flytt bordet
//   to fingre                → zoom og flytt bordet
//
// Legger du ned en finger nummer to mens du drar, slippes brikken der den
// er og zoomen tar over. Det er mer forutsigbart enn å forsøke begge deler.
//
// touch-action: none i CSS og preventDefault på touchstart er ikke valgfritt:
// uten dem panorerer Safari selve siden i stedet for bordet. setPointerCapture
// holder på pekeren gjennom hele draget – det finnes kjente feil i installerte
// PWA-er på iPadOS der bevegelser ellers forsvinner.

const DOBBELTTRYKK_MS = 320;
const DOBBELTTRYKK_PX = 30;

export class Gester {
  constructor(el, kamera, opts = {}) {
    this.el = el;
    this.kamera = kamera;
    this.o = {
      onEndring: () => {},
      hentBord: () => null,
      hentVisning: () => ({ b: el.clientWidth, h: el.clientHeight }),
      onDobbelttrykk: () => {},
      // Fase 3: kroker inn i spillogikken.
      finnHandtak: () => null,
      onDragStart: () => {},
      onDrag: () => {},
      onDragSlutt: () => {},
      onBeroring: () => {},
      ...opts,
    };

    this.pekere = new Map();
    this.modus = 'ingen'; // 'ingen' | 'drar' | 'bord'
    this.handtak = null;
    this.dragPeker = null;
    this.dragForrige = null;
    this.dragFlyttet = 0;
    this.sistMidt = null;
    this.sistAvstand = 0;
    this.sisteTrykkTid = 0;
    this.sisteTrykkPos = null;

    el.addEventListener('pointerdown', this._ned, { passive: false });
    el.addEventListener('pointermove', this._beveg, { passive: false });
    el.addEventListener('pointerup', this._opp, { passive: false });
    el.addEventListener('pointercancel', this._opp, { passive: false });
    el.addEventListener('wheel', this._hjul, { passive: false });
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('gesturestart', (e) => e.preventDefault());
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _pos(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _bordtilstand() {
    const p = [...this.pekere.values()];
    if (!p.length) return null;
    const midt = {
      x: p.reduce((s, q) => s + q.x, 0) / p.length,
      y: p.reduce((s, q) => s + q.y, 0) / p.length,
    };
    const avstand = p.length >= 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
    return { midt, avstand, antall: p.length };
  }

  _startBordmodus() {
    this.modus = 'bord';
    const t = this._bordtilstand();
    this.sistMidt = t ? t.midt : null;
    this.sistAvstand = t ? t.avstand : 0;
  }

  _avsluttDrag() {
    if (this.modus !== 'drar') return;
    const h = this.handtak;
    this.modus = 'ingen';
    this.handtak = null;
    this.dragPeker = null;
    this.o.onDragSlutt(h, this.dragFlyttet);
  }

  _ned = (e) => {
    e.preventDefault();
    this.el.setPointerCapture(e.pointerId);
    this.pekere.set(e.pointerId, this._pos(e));
    this.o.onBeroring();

    if (this.pekere.size === 1) {
      const skjerm = this._pos(e);
      const verden = this.kamera.tilVerden(skjerm.x, skjerm.y);
      const h = this.o.finnHandtak(verden);
      if (h) {
        this.modus = 'drar';
        this.handtak = h;
        this.dragPeker = e.pointerId;
        this.dragForrige = skjerm;
        this.dragFlyttet = 0;
        this.o.onDragStart(h, verden);
        this.o.onEndring();
        return;
      }

      // Dobbelttrykk gjelder bare tomt bord, ellers ville det krasjet med drag.
      const na = performance.now();
      if (na - this.sisteTrykkTid < DOBBELTTRYKK_MS && this.sisteTrykkPos &&
          Math.hypot(skjerm.x - this.sisteTrykkPos.x, skjerm.y - this.sisteTrykkPos.y) < DOBBELTTRYKK_PX) {
        this.sisteTrykkTid = 0;
        this.o.onDobbelttrykk(skjerm);
      } else {
        this.sisteTrykkTid = na;
        this.sisteTrykkPos = skjerm;
      }
      this._startBordmodus();
      return;
    }

    // Finger nummer to: slipp brikken og la zoomen ta over.
    this._avsluttDrag();
    this._startBordmodus();
  };

  _beveg = (e) => {
    if (!this.pekere.has(e.pointerId)) return;
    e.preventDefault();
    const na = this._pos(e);
    this.pekere.set(e.pointerId, na);

    if (this.modus === 'drar') {
      if (e.pointerId !== this.dragPeker) return;
      const dx = (na.x - this.dragForrige.x) / this.kamera.skala;
      const dy = (na.y - this.dragForrige.y) / this.kamera.skala;
      this.dragFlyttet += Math.hypot(na.x - this.dragForrige.x, na.y - this.dragForrige.y);
      this.dragForrige = na;
      this.o.onDrag(this.handtak, dx, dy, this.kamera.tilVerden(na.x, na.y));
      this.o.onEndring();
      return;
    }

    if (this.modus !== 'bord' || !this.sistMidt) return;
    const t = this._bordtilstand();
    if (!t) return;
    if (t.antall >= 2 && this.sistAvstand > 0 && t.avstand > 0) {
      this.kamera.zoomVed(t.midt.x, t.midt.y, t.avstand / this.sistAvstand);
    }
    this.kamera.panorer(t.midt.x - this.sistMidt.x, t.midt.y - this.sistMidt.y);
    this.sistMidt = t.midt;
    this.sistAvstand = t.avstand;
    this._begrens();
    this.o.onEndring();
  };

  _opp = (e) => {
    if (!this.pekere.has(e.pointerId)) return;
    e.preventDefault();
    const varDrag = this.modus === 'drar' && e.pointerId === this.dragPeker;
    this.pekere.delete(e.pointerId);

    if (varDrag) {
      this._avsluttDrag();
      this.o.onEndring();
    }
    if (this.pekere.size === 0) {
      this.modus = 'ingen';
      this.sistMidt = null;
      this.sistAvstand = 0;
    } else if (this.modus !== 'drar') {
      // Ny referanse når fingertallet endres, ellers hopper bildet.
      this._startBordmodus();
    }
  };

  _hjul = (e) => {
    e.preventDefault();
    const p = this._pos(e);
    const faktor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0022));
    this.kamera.zoomVed(p.x, p.y, faktor);
    this._begrens();
    this.o.onEndring();
  };

  _begrens() {
    const bord = this.o.hentBord();
    if (!bord) return;
    const v = this.o.hentVisning();
    this.kamera.begrens(bord, v.b, v.h);
  }
}
