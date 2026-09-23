// Panorering og pinch-zoom.
//
// Pointer Events med setPointerCapture. touch-action: none i CSS er
// obligatorisk, ellers panorerer Safari selve siden i stedet.
// Fase 3 henger drag av brikker pa de samme hendelsene.

export class Gester {
  constructor(el, kamera, opts = {}) {
    this.el = el;
    this.kamera = kamera;
    this.onEndring = opts.onEndring || (() => {});
    this.hentBord = opts.hentBord || (() => null);
    this.hentVisning = opts.hentVisning || (() => ({ b: el.clientWidth, h: el.clientHeight }));
    this.onDobbelttrykk = opts.onDobbelttrykk || (() => {});
    this.pekere = new Map();
    this.sistMidt = null;
    this.sistAvstand = 0;
    this.sisteTrykkTid = 0;
    this.sisteTrykkPos = null;

    el.addEventListener('pointerdown', this._ned, { passive: false });
    el.addEventListener('pointermove', this._beveg, { passive: false });
    el.addEventListener('pointerup', this._opp, { passive: false });
    el.addEventListener('pointercancel', this._opp, { passive: false });
    el.addEventListener('wheel', this._hjul, { passive: false });
    // Safari panorerer siden uten dette, selv med touch-action: none.
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  _pos(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _tilstand() {
    const p = [...this.pekere.values()];
    if (!p.length) return null;
    const midt = {
      x: p.reduce((s, q) => s + q.x, 0) / p.length,
      y: p.reduce((s, q) => s + q.y, 0) / p.length,
    };
    const avstand = p.length >= 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
    return { midt, avstand, antall: p.length };
  }

  _ned = (e) => {
    e.preventDefault();
    this.el.setPointerCapture(e.pointerId);
    this.pekere.set(e.pointerId, this._pos(e));
    const t = this._tilstand();
    this.sistMidt = t.midt;
    this.sistAvstand = t.avstand;

    if (t.antall === 1) {
      const na = performance.now();
      const p = t.midt;
      if (na - this.sisteTrykkTid < 320 && this.sisteTrykkPos &&
          Math.hypot(p.x - this.sisteTrykkPos.x, p.y - this.sisteTrykkPos.y) < 30) {
        this.onDobbelttrykk(p);
        this.sisteTrykkTid = 0;
      } else {
        this.sisteTrykkTid = na;
        this.sisteTrykkPos = p;
      }
    }
  };

  _beveg = (e) => {
    if (!this.pekere.has(e.pointerId)) return;
    e.preventDefault();
    this.pekere.set(e.pointerId, this._pos(e));
    const t = this._tilstand();
    if (!t || !this.sistMidt) return;

    if (t.antall >= 2 && this.sistAvstand > 0 && t.avstand > 0) {
      this.kamera.zoomVed(t.midt.x, t.midt.y, t.avstand / this.sistAvstand);
    }
    this.kamera.panorer(t.midt.x - this.sistMidt.x, t.midt.y - this.sistMidt.y);

    this.sistMidt = t.midt;
    this.sistAvstand = t.avstand;
    this._etterpa();
  };

  _opp = (e) => {
    if (!this.pekere.has(e.pointerId)) return;
    e.preventDefault();
    this.pekere.delete(e.pointerId);
    // Ny referanse nar fingertallet endres, ellers hopper bildet.
    const t = this._tilstand();
    this.sistMidt = t ? t.midt : null;
    this.sistAvstand = t ? t.avstand : 0;
  };

  _hjul = (e) => {
    e.preventDefault();
    const p = this._pos(e);
    // Ctrl+hjul er pinch pa styreflate.
    const faktor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0022));
    this.kamera.zoomVed(p.x, p.y, faktor);
    this._etterpa();
  };

  _etterpa() {
    const bord = this.hentBord();
    if (bord) {
      const v = this.hentVisning();
      this.kamera.begrens(bord, v.b, v.h);
    }
    this.onEndring();
  }
}
