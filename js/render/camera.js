// Kamera i verdenskoordinater.
// Skjerm (CSS-piksler) = (verden - kamera) * skala

export class Kamera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.skala = 1;
    this.minSkala = 0.05;
    this.maksSkala = 6;
  }

  tilSkjerm(vx, vy) {
    return { x: (vx - this.x) * this.skala, y: (vy - this.y) * this.skala };
  }

  tilVerden(sx, sy) {
    return { x: sx / this.skala + this.x, y: sy / this.skala + this.y };
  }

  panorer(dxSkjerm, dySkjerm) {
    this.x -= dxSkjerm / this.skala;
    this.y -= dySkjerm / this.skala;
  }

  /** Zoom slik at punktet under fingeren blir liggende i ro. */
  zoomVed(sx, sy, faktor) {
    const for_ = this.tilVerden(sx, sy);
    this.skala = Math.min(this.maksSkala, Math.max(this.minSkala, this.skala * faktor));
    const etter = this.tilVerden(sx, sy);
    this.x += for_.x - etter.x;
    this.y += for_.y - etter.y;
  }

  /**
   * Legger hele rektangelet innenfor den LEDIGE delen av visningsflaten.
   * innrykk holder brettet unna panelet, slik at midten av puslespillet
   * havner midt i det brukeren faktisk ser.
   */
  tilpass(rekt, visB, visH, margin = 0.06, innrykk = {}) {
    const t = innrykk.topp || 0;
    const h = innrykk.hoyre || 0;
    const b = innrykk.bunn || 0;
    const v = innrykk.venstre || 0;
    const effB = Math.max(80, visB - v - h);
    const effH = Math.max(80, visH - t - b);
    const s = Math.min(effB / rekt.w, effH / rekt.h) * (1 - margin * 2);
    this.skala = Math.min(this.maksSkala, Math.max(this.minSkala, s));
    this.x = rekt.x + rekt.w / 2 - (v + effB / 2) / this.skala;
    this.y = rekt.y + rekt.h / 2 - (t + effH / 2) / this.skala;
  }

  /** Hindrer at bordet forsvinner helt ut av skjermen. */
  begrens(bord, visB, visH) {
    const slakk = 0.35;
    const vb = visB / this.skala;
    const vh = visH / this.skala;
    const minX = bord.x - vb * slakk;
    const maksX = bord.x + bord.w - vb * (1 - slakk);
    const minY = bord.y - vh * slakk;
    const maksY = bord.y + bord.h - vh * (1 - slakk);
    this.x = maksX < minX ? (minX + maksX) / 2 : Math.min(maksX, Math.max(minX, this.x));
    this.y = maksY < minY ? (minY + maksY) / 2 : Math.min(maksY, Math.max(minY, this.y));
  }

  /** Synlig omrade i verdenskoordinater. */
  utsnitt(visB, visH, slakk = 0) {
    return {
      x: this.x - slakk, y: this.y - slakk,
      w: visB / this.skala + slakk * 2,
      h: visH / this.skala + slakk * 2,
    };
  }
}
