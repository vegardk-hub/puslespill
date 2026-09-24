// Brikkeskuffen.
//
// Den største klagen mot puslespillapper, etter annonsene, er at brikkene
// gjemmer seg: haugen ligger oppå seg selv, og den ene brikken du leter
// etter er under de andre. Skuffen løser det ved å være et REGISTER, ikke
// en beholder – den viser alle løse enkeltbrikker i et ryddig bånd som
// aldri overlapper, og du drar dem rett ut på bordet.
//
// Den lever i skjermkoordinater, ikke i verden. Den følger altså ikke med
// når du zoomer eller panorerer, og den ruller for seg selv.

/** Fargebøttene brikkene sorteres i. Rekkefølgen er den de vises i. */
export const FARGEBOTTER = [
  { id: 'rod', navn: 'Rød', fra: 340, til: 20, farge: '#ff5a6e' },
  { id: 'oransje', navn: 'Oransje', fra: 20, til: 48, farge: '#ff9a3c' },
  { id: 'gul', navn: 'Gul', fra: 48, til: 70, farge: '#ffd93c' },
  { id: 'gronn', navn: 'Grønn', fra: 70, til: 165, farge: '#4cd964' },
  { id: 'cyan', navn: 'Turkis', fra: 165, til: 200, farge: '#22e0ff' },
  { id: 'bla', navn: 'Blå', fra: 200, til: 255, farge: '#3c8cff' },
  { id: 'lilla', navn: 'Lilla', fra: 255, til: 300, farge: '#a06bff' },
  { id: 'rosa', navn: 'Rosa', fra: 300, til: 340, farge: '#ff5ad2' },
  { id: 'morkt', navn: 'Mørkt', farge: '#2b3050', gratt: true },
  { id: 'gratt', navn: 'Grått', farge: '#8b93b8', gratt: true },
  { id: 'lyst', navn: 'Lyst', farge: '#e8ecff', gratt: true },
];

/** Hvilken bøtte en brikke havner i. */
export function fargebotte(brikke) {
  const f = brikke.snittfarge;
  if (!f) return 'gratt';
  if (f.s < 0.20) return f.l < 0.33 ? 'morkt' : (f.l > 0.66 ? 'lyst' : 'gratt');
  const h = ((f.h % 360) + 360) % 360;
  for (const b of FARGEBOTTER) {
    if (b.gratt) continue;
    if (b.fra > b.til ? (h >= b.fra || h < b.til) : (h >= b.fra && h < b.til)) return b.id;
  }
  return 'gratt';
}

export function erKantbrikke(brikke, puslespill) {
  return brikke.r === 0 || brikke.c === 0 ||
         brikke.r === puslespill.rows - 1 || brikke.c === puslespill.cols - 1;
}

const MELLOMROM = 7;
const KANTMARG = 8;

export class Skuff {
  constructor() {
    this.apen = true;
    this.filter = 'alle';
    this.rull = 0;
    this.brikker = [];
    this.rekt = { x: 0, y: 0, w: 0, h: 0 };
    this.celle = 0;
    this.innholdB = 0;
    /** Brikke som løftes ut akkurat nå – tegnes ikke i båndet. */
    this.uteId = null;
  }

  /** Brikker som kan ligge i skuffen: løse, enkeltstående, ikke låst. */
  static kandidater(puslespill, spill) {
    const ut = [];
    for (const b of puslespill.brikker) {
      if (b.laast) continue;
      if (spill.medlemmer(b.gruppe).size > 1) continue;
      ut.push(b);
    }
    return ut;
  }

  /** Antall brikker per fargebøtte, til å bygge filterknappene. */
  static botteTelling(puslespill, spill) {
    const tell = new Map();
    for (const b of Skuff.kandidater(puslespill, spill)) {
      const id = fargebotte(b);
      tell.set(id, (tell.get(id) || 0) + 1);
    }
    return tell;
  }

  _passerer(b, puslespill) {
    if (this.filter === 'alle') return true;
    if (this.filter === 'kant') return erKantbrikke(b, puslespill);
    return fargebotte(b) === this.filter;
  }

  oppdater(puslespill, spill) {
    this.brikker = Skuff.kandidater(puslespill, spill)
      .filter((b) => this._passerer(b, puslespill))
      .map((b) => b.id);
    this._klemRull();
  }

  layout(visB, visH) {
    const h = this.apen ? Math.max(82, Math.min(148, visH * 0.21)) : 0;
    this.rekt = { x: 0, y: visH - h, w: visB, h };
    this.celle = Math.max(36, h - KANTMARG * 2 - 14);
    this.innholdB = this.brikker.length * (this.celle + MELLOMROM) + KANTMARG * 2;
    this._klemRull();
  }

  _maksRull() {
    return Math.max(0, this.innholdB - this.rekt.w);
  }

  _klemRull() {
    this.rull = Math.max(0, Math.min(this._maksRull(), this.rull));
  }

  rullMed(dx) {
    this.rull -= dx;
    this._klemRull();
  }

  inni(sx, sy) {
    const r = this.rekt;
    return this.apen && r.h > 0 && sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h;
  }

  _celleX(i) {
    return this.rekt.x + KANTMARG + i * (this.celle + MELLOMROM) - this.rull;
  }

  /** @returns {number|null} brikke-id under skjermpunktet */
  brikkeVed(sx, sy) {
    if (!this.inni(sx, sy)) return null;
    const i = Math.floor((sx - this.rekt.x - KANTMARG + this.rull) / (this.celle + MELLOMROM));
    if (i < 0 || i >= this.brikker.length) return null;
    const x = this._celleX(i);
    if (sx < x || sx > x + this.celle) return null;
    const y = this.rekt.y + KANTMARG;
    if (sy < y || sy > y + this.celle) return null;
    return this.brikker[i];
  }

  /** Ruller båndet slik at en bestemt brikke er synlig. */
  rullTil(brikkeId) {
    const i = this.brikker.indexOf(brikkeId);
    if (i < 0) return;
    const x = KANTMARG + i * (this.celle + MELLOMROM);
    if (x - this.rull < 0) this.rull = x - KANTMARG;
    else if (x + this.celle - this.rull > this.rekt.w) this.rull = x + this.celle + KANTMARG - this.rekt.w;
    this._klemRull();
  }

  /**
   * Tegner båndet. Kalles med identitetstransform i CSS-piksler,
   * altså etter at verden er ferdig tegnet.
   */
  tegn(ctx, atlas, puslespill) {
    if (!this.apen || this.rekt.h <= 0) return;
    const r = this.rekt;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 12, 24, 0.90)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + 0.5);
    ctx.lineTo(r.x + r.w, r.y + 0.5);
    ctx.stroke();

    const y = r.y + KANTMARG;
    for (let i = 0; i < this.brikker.length; i++) {
      const x = this._celleX(i);
      if (x + this.celle < r.x || x > r.x + r.w) continue;   // utenfor synsfeltet
      const id = this.brikker[i];
      if (id === this.uteId) continue;
      const b = puslespill.brikker[id];
      const celle = atlas.celler[id];
      const s = this.celle / Math.max(celle.sw, celle.sh);
      const b2 = celle.sw * s;
      const h2 = celle.sh * s;
      ctx.drawImage(atlas.sider[celle.side], celle.sx, celle.sy, celle.sw, celle.sh,
        x + (this.celle - b2) / 2, y + (this.celle - h2) / 2, b2, h2);
      void b;
    }

    // Rullefelt, så det synes at det finnes mer utenfor skjermen.
    const maks = this._maksRull();
    if (maks > 0) {
      const spor = r.w - KANTMARG * 2;
      const bredde = Math.max(30, (r.w / this.innholdB) * spor);
      const x = r.x + KANTMARG + (this.rull / maks) * (spor - bredde);
      const sy = r.y + r.h - 7;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
      ctx.fillRect(r.x + KANTMARG, sy, spor, 3);
      ctx.fillStyle = 'rgba(34, 224, 255, 0.75)';
      ctx.fillRect(x, sy, bredde, 3);
    }

    if (!this.brikker.length) {
      ctx.fillStyle = 'rgba(139, 147, 184, 0.9)';
      ctx.font = '14px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Ingen løse brikker her', r.x + r.w / 2, r.y + r.h / 2);
    }
    ctx.restore();
  }
}
