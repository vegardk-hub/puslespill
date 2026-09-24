// Tegnemotor.
//
// Ett canvas, én kontekst, og tegning bare når noe faktisk har endret seg.
// Canvaset endres aldri i størrelse uten at målene virkelig er ulike –
// WebKit lekker minne for hver resize og krasjer rundt 1,25 GB.

/** Over denne gruppestørrelsen dropper vi løfteffekten – den ser feil ut. */
const MAKS_LOFT = 12;
/** Over denne dropper vi løfteskyggen, som koster en path-fill per brikke. */
const MAKS_LOFTSKYGGE = 40;

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
    /** {sett:Set<id>, anker:{x,y}, skala:number} mens noe dras. */
    this.dragGruppe = null;
    /** Funksjoner som kjøres hver frame og selv sier om de er ferdige. */
    this.animatorer = new Set();
    this.sisteTegnet = 0;
    this.sisteAntallTegnet = 0;
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  settPuslespill(puslespill, atlas, spokelse) {
    this.puslespill = puslespill;
    this.atlas = atlas;
    this.spokelse = spokelse;
    this.dragGruppe = null;
    this.animatorer.clear();
    this.merkSkitten();
  }

  merkSkitten() { this.skitten = true; }

  /** @param {(na:number)=>boolean} fn returner true så lenge den skal kjøre */
  animer(fn) {
    this.animatorer.add(fn);
    this.merkSkitten();
  }

  /** @returns {boolean} om størrelsen faktisk ble endret */
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
    if (this.animatorer.size) {
      const na = performance.now();
      for (const fn of [...this.animatorer]) {
        if (!fn(na)) this.animatorer.delete(fn);
      }
      this.merkSkitten();
    }
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

    ctx.save();
    ctx.lineWidth = 2 / this.kamera.skala;
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.35)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();

    // Spøkelsesbilde UNDER brettet – aldri et vindu som dekker det.
    if (this.spokelse && this.spokelseStyrke > 0) {
      ctx.save();
      ctx.globalAlpha = this.spokelseStyrke;
      ctx.drawImage(this.spokelse, r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  }

  /** Legger løftetransformen på, hvis en liten gruppe dras. */
  _medLoft(fn) {
    const d = this.dragGruppe;
    if (!d || d.skala === 1) { fn(); return; }
    const { ctx } = this;
    ctx.save();
    ctx.translate(d.anker.x, d.anker.y);
    ctx.scale(d.skala, d.skala);
    ctx.translate(-d.anker.x, -d.anker.y);
    fn();
    ctx.restore();
  }

  _tegnEn(b, utsnitt, x1, y1) {
    const celle = this.atlas.celler[b.id];
    const dx = b.x + b.animX + celle.ox;
    const dy = b.y + b.animY + celle.oy;
    if (dx > x1 || dy > y1 || dx + celle.sw < utsnitt.x || dy + celle.sh < utsnitt.y) return 0;
    this.ctx.drawImage(this.atlas.sider[celle.side], celle.sx, celle.sy, celle.sw, celle.sh,
      dx, dy, celle.sw, celle.sh);
    return 1;
  }

  /** Skygge under brikkene som er løftet fra bordet. */
  _tegnLoftskygge(sett) {
    const { ctx, puslespill } = this;
    if (sett.size > MAKS_LOFTSKYGGE) return;
    const av = 18 / this.kamera.skala;
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = '#000';
    ctx.translate(av * 0.35, av);
    for (const id of sett) {
      const b = puslespill.brikker[id];
      ctx.save();
      ctx.translate(b.x + b.animX - b.hjemX, b.y + b.animY - b.hjemY);
      ctx.fill(b.path);
      ctx.restore();
    }
    ctx.restore();
  }

  _tegnBrikker() {
    const { puslespill } = this;
    const utsnitt = this.kamera.utsnitt(this.visB, this.visH, puslespill.brikkeB * 2);
    const x1 = utsnitt.x + utsnitt.w;
    const y1 = utsnitt.y + utsnitt.h;
    const dragSett = this.dragGruppe ? this.dragGruppe.sett : null;
    let tegnet = 0;

    for (const id of puslespill.rekkefolge) {
      if (dragSett && dragSett.has(id)) continue;
      tegnet += this._tegnEn(puslespill.brikker[id], utsnitt, x1, y1);
    }

    if (dragSett && dragSett.size) {
      this._medLoft(() => {
        this._tegnLoftskygge(dragSett);
        for (const id of puslespill.rekkefolge) {
          if (!dragSett.has(id)) continue;
          tegnet += this._tegnEn(puslespill.brikker[id], utsnitt, x1, y1);
        }
      });
    }

    this.sisteAntallTegnet = tegnet;
  }
}

export { MAKS_LOFT };
