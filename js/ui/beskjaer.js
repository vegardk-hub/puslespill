// Beskjæring av egne bilder.
//
// Rammen står stille midt på skjermen, og bildet flyttes og zoomes bak den.
// Det er samme grep som i kameraappen: du slipper å treffe små håndtak i
// hjørnene, og rammen kan ikke havne utenfor bildet.
//
// Bildet holdes alltid stort nok til å dekke rammen. Det gjør at et
// puslespill aldri kan få gjennomsiktige felter.

const RAMMEANDEL = 0.84;

export class Beskjaerer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bilde = null;
    this.aspekt = 1.5;
    this.skala = 1;
    this.x = 0;
    this.y = 0;
    this.dpr = 1;
    this.pekere = new Map();
    this.sistMidt = null;
    this.sistAvstand = 0;

    canvas.addEventListener('pointerdown', this._ned, { passive: false });
    canvas.addEventListener('pointermove', this._beveg, { passive: false });
    canvas.addEventListener('pointerup', this._opp, { passive: false });
    canvas.addEventListener('pointercancel', this._opp, { passive: false });
    canvas.addEventListener('wheel', this._hjul, { passive: false });
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  settBilde(bilde) {
    this.bilde = bilde;
    this.tilpassStorrelse();
    this.sentrer();
  }

  settAspekt(a) {
    this.aspekt = a;
    this.sentrer();
  }

  tilpassStorrelse() {
    const r = this.canvas.getBoundingClientRect();
    const d = Math.min(window.devicePixelRatio || 1, 2);
    const b = Math.round(r.width * d);
    const h = Math.round(r.height * d);
    this.visB = r.width;
    this.visH = r.height;
    if (this.canvas.width !== b || this.canvas.height !== h) {
      this.canvas.width = b;
      this.canvas.height = h;
    }
    this.dpr = d;
  }

  /** Rammen, i CSS-piksler. */
  ramme() {
    const maksB = this.visB * RAMMEANDEL;
    const maksH = this.visH * RAMMEANDEL;
    let b = maksB;
    let h = b / this.aspekt;
    if (h > maksH) { h = maksH; b = h * this.aspekt; }
    return { x: (this.visB - b) / 2, y: (this.visH - h) / 2, w: b, h };
  }

  /** Minste skala der bildet fortsatt dekker hele rammen. */
  minSkala() {
    const r = this.ramme();
    return Math.max(r.w / this.bilde.width, r.h / this.bilde.height);
  }

  sentrer() {
    if (!this.bilde) return;
    const r = this.ramme();
    this.skala = this.minSkala();
    this.x = r.x + r.w / 2 - (this.bilde.width * this.skala) / 2;
    this.y = r.y + r.h / 2 - (this.bilde.height * this.skala) / 2;
    this.tegn();
  }

  _klem() {
    const r = this.ramme();
    const min = this.minSkala();
    this.skala = Math.max(min, Math.min(min * 8, this.skala));
    const b = this.bilde.width * this.skala;
    const h = this.bilde.height * this.skala;
    this.x = Math.min(r.x, Math.max(r.x + r.w - b, this.x));
    this.y = Math.min(r.y, Math.max(r.y + r.h - h, this.y));
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _tilstand() {
    const p = [...this.pekere.values()];
    if (!p.length) return null;
    return {
      midt: {
        x: p.reduce((s, q) => s + q.x, 0) / p.length,
        y: p.reduce((s, q) => s + q.y, 0) / p.length,
      },
      avstand: p.length >= 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0,
      antall: p.length,
    };
  }

  _ned = (e) => {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.pekere.set(e.pointerId, this._pos(e));
    const t = this._tilstand();
    this.sistMidt = t.midt;
    this.sistAvstand = t.avstand;
  };

  _beveg = (e) => {
    if (!this.pekere.has(e.pointerId) || !this.bilde) return;
    e.preventDefault();
    this.pekere.set(e.pointerId, this._pos(e));
    const t = this._tilstand();
    if (!t || !this.sistMidt) return;
    if (t.antall >= 2 && this.sistAvstand > 0 && t.avstand > 0) {
      const f = t.avstand / this.sistAvstand;
      const for_ = { x: (t.midt.x - this.x) / this.skala, y: (t.midt.y - this.y) / this.skala };
      this.skala *= f;
      this.x = t.midt.x - for_.x * this.skala;
      this.y = t.midt.y - for_.y * this.skala;
    }
    this.x += t.midt.x - this.sistMidt.x;
    this.y += t.midt.y - this.sistMidt.y;
    this.sistMidt = t.midt;
    this.sistAvstand = t.avstand;
    this._klem();
    this.tegn();
  };

  _opp = (e) => {
    if (!this.pekere.has(e.pointerId)) return;
    e.preventDefault();
    this.pekere.delete(e.pointerId);
    const t = this._tilstand();
    this.sistMidt = t ? t.midt : null;
    this.sistAvstand = t ? t.avstand : 0;
  };

  _hjul = (e) => {
    if (!this.bilde) return;
    e.preventDefault();
    const p = this._pos(e);
    const f = Math.exp(-e.deltaY * 0.0022);
    const for_ = { x: (p.x - this.x) / this.skala, y: (p.y - this.y) / this.skala };
    this.skala *= f;
    this.x = p.x - for_.x * this.skala;
    this.y = p.y - for_.y * this.skala;
    this._klem();
    this.tegn();
  };

  tegn() {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.visB, this.visH);
    ctx.fillStyle = '#07070e';
    ctx.fillRect(0, 0, this.visB, this.visH);
    if (!this.bilde) return;

    ctx.drawImage(this.bilde, this.x, this.y,
      this.bilde.width * this.skala, this.bilde.height * this.skala);

    // Alt utenfor rammen dempes, så det er tydelig hva som blir med.
    const r = this.ramme();
    ctx.fillStyle = 'rgba(7, 7, 14, 0.72)';
    ctx.fillRect(0, 0, this.visB, r.y);
    ctx.fillRect(0, r.y + r.h, this.visB, this.visH - r.y - r.h);
    ctx.fillRect(0, r.y, r.x, r.h);
    ctx.fillRect(r.x + r.w, r.y, this.visB - r.x - r.w, r.h);

    ctx.strokeStyle = 'rgba(34, 224, 255, 0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(r.x + (r.w * i) / 3, r.y);
      ctx.lineTo(r.x + (r.w * i) / 3, r.y + r.h);
      ctx.moveTo(r.x, r.y + (r.h * i) / 3);
      ctx.lineTo(r.x + r.w, r.y + (r.h * i) / 3);
      ctx.stroke();
    }
  }

  /**
   * Utsnittet som et nytt lerret, aldri større enn maksSide på lengste kant.
   * @returns {HTMLCanvasElement}
   */
  resultat(maksSide = 2048) {
    const r = this.ramme();
    const kx = (r.x - this.x) / this.skala;
    const ky = (r.y - this.y) / this.skala;
    const kb = r.w / this.skala;
    const kh = r.h / this.skala;

    let b = Math.round(kb);
    let h = Math.round(kh);
    const f = Math.min(1, maksSide / Math.max(b, h));
    b = Math.max(2, Math.round(b * f));
    h = Math.max(2, Math.round(h * f));

    const ut = document.createElement('canvas');
    ut.width = b;
    ut.height = h;
    const c = ut.getContext('2d', { willReadFrequently: true });
    c.imageSmoothingQuality = 'high';
    c.drawImage(this.bilde, kx, ky, kb, kh, 0, 0, b, h);
    return ut;
  }
}

/**
 * Leser en fil til et bilde med riktig rotasjon.
 * EXIF-rotasjon er fellen her: et bilde tatt med iPaden stående ser
 * riktig ut i Bilder, men ligger sidelengs i pikslene.
 */
export async function lesBildefil(fil) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(fil, { imageOrientation: 'from-image' });
    } catch {
      // Faller gjennom til img-varianten under.
    }
  }
  const url = URL.createObjectURL(fil);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise((ok, feil) => {
      img.onload = ok;
      img.onerror = () => feil(new Error('Klarte ikke å lese bildet'));
      img.src = url;
    });
    await img.decode?.().catch(() => {});
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
