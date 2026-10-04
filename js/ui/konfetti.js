// Konfetti til feiringen.
//
// Lever i skjermkoordinater og tegnes oppå alt annet. Partiklene er
// rektangler som faller, roterer og tipper – ingen bilder, ingen
// avhengigheter, og de rydder opp etter seg selv.

const FARGER = ['#22e0ff', '#ff2bd6', '#ffd93c', '#4cd964', '#a06bff', '#ff9a3c'];

export class Konfetti {
  constructor() {
    this.partikler = [];
  }

  get aktiv() {
    return this.partikler.length > 0;
  }

  /** @param {number} antall settes til 0 av den som vil ha ro (redusert bevegelse) */
  slipp(visB, visH, antall = 140) {
    this.partikler = [];
    for (let i = 0; i < antall; i++) {
      this.partikler.push({
        x: Math.random() * visB,
        // Starter over skjermkanten, spredt i tid ved å spre høyden.
        y: -Math.random() * visH * 0.9 - 20,
        vx: (Math.random() - 0.5) * 90,
        vy: 220 + Math.random() * 320,
        b: 6 + Math.random() * 7,
        h: 9 + Math.random() * 11,
        vinkel: Math.random() * Math.PI * 2,
        spinn: (Math.random() - 0.5) * 9,
        // Tipping gjør at remsene veksler mellom flat og på kant.
        tipp: Math.random() * Math.PI * 2,
        tippFart: 3 + Math.random() * 5,
        farge: FARGER[Math.floor(Math.random() * FARGER.length)],
      });
    }
  }

  /** @returns {boolean} om det fortsatt er noe i lufta */
  oppdater(dt, visH) {
    if (!this.partikler.length) return false;
    const igjen = [];
    for (const p of this.partikler) {
      p.vy += 320 * dt;            // tyngdekraft
      p.vx *= 1 - 0.9 * dt;        // luftmotstand
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vinkel += p.spinn * dt;
      p.tipp += p.tippFart * dt;
      if (p.y < visH + 40) igjen.push(p);
    }
    this.partikler = igjen;
    return this.partikler.length > 0;
  }

  /** Tegnes med identitetstransform i CSS-piksler. */
  tegn(ctx) {
    for (const p of this.partikler) {
      const h = Math.abs(Math.cos(p.tipp)) * p.h;
      if (h < 0.6) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.vinkel);
      ctx.fillStyle = p.farge;
      ctx.fillRect(-p.b / 2, -h / 2, p.b, h);
      ctx.restore();
    }
  }

  stopp() {
    this.partikler = [];
  }
}
