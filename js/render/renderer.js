// Tegnemotor.
//
// Ett canvas, en kontekst, og tegning bare nar noe faktisk har endret seg.
// Canvaset endres aldri i storrelse uten at malene virkelig er ulike -
// WebKit lekker minne for hver resize og kraesjer rundt 1,25 GB.

export class Tegner {
  constructor(canvas, kamera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.kamera = kamera;
    this.dpr = 1;
    this.visB = 0;
    this.visH = 0;
    this.skitten = true;
    this.puslespill = null;
    this.atlas = null;
    this.spokelse = null;
    this.spokelseStyrke = 0.15;
    this.sisteTegnet = 0;
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  settPuslespill(puslespill, atlas, spokelse) {
    this.puslespill = puslespill;
    this.atlas = atlas;
    this.spokelse = spokelse;
    this.merkSkitten();
  }

  merkSkitten() { this.skitten = true; }

  /** @returns {boolean} om storrelsen faktisk ble endret */
  tilpassStorrelse(bredde, hoyde, dpr) {
    const d = Math.min(dpr || 1, 2); // DPR over 2 koster minne uten synlig gevinst
    const b = Math.round(bredde * d);
    const h = Math.round(hoyde * d);
    this.visB = bredde;
    this.visH = hoyde;
    if (this.canvas.width === b && this.canvas.height === h && this.dpr === d) return false;
    this.canvas.width = b;
    this.canvas.height = h;
    this.dpr = d;
    this.merkSkitten();
    return true;
  }

  _loop() {
    if (this.skitten) {
      this.skitten = false;
      this.tegn();
    }
    requestAnimationFrame(this._loop);
  }

  tegn() {
    const { ctx, kamera } = this;
    const t0 = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#07070e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.puslespill || !this.atlas) return;

    const s = kamera.skala * this.dpr;
    ctx.setTransform(s, 0, 0, s, -kamera.x * s, -kamera.y * s);

    this._tegnBord();
    this._tegnBrikker();

    this.sisteTegnet = performance.now() - t0;
  }

  _tegnBord() {
    const { ctx, puslespill } = this;
    const r = puslespill.ramme;

    // Rammen der puslespillet skal ligge.
    ctx.save();
    ctx.lineWidth = 2 / this.kamera.skala;
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.35)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();

    // Spokelsesbilde UNDER brettet - aldri et vindu som dekker det.
    if (this.spokelse && this.spokelseStyrke > 0) {
      ctx.save();
      ctx.globalAlpha = this.spokelseStyrke;
      ctx.drawImage(this.spokelse, r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  }

  _tegnBrikker() {
    const { ctx, puslespill, atlas } = this;
    const utsnitt = this.kamera.utsnitt(this.visB, this.visH, puslespill.brikkeB);
    const x1 = utsnitt.x + utsnitt.w;
    const y1 = utsnitt.y + utsnitt.h;
    let tegnet = 0;

    for (const b of puslespill.brikker) {
      const celle = atlas.celler[b.id];
      const dx = b.x + celle.ox;
      const dy = b.y + celle.oy;
      if (dx > x1 || dy > y1 || dx + celle.sw < utsnitt.x || dy + celle.sh < utsnitt.y) continue;
      ctx.drawImage(atlas.sider[celle.side], celle.sx, celle.sy, celle.sw, celle.sh,
        dx, dy, celle.sw, celle.sh);
      tegnet++;
    }
    this.sisteAntallTegnet = tegnet;
  }
}
