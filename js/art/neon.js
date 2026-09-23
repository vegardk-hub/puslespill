// Neonmotiv: flow field + lagvis gled.
//
// Gled bygges av flere strek med okende bredde og fallende alpha, tegnet
// additivt. Det er det som skiller ekte neon fra "sterk farge pa svart":
// lyset faller av utover, slik et neonror gjor.
//
// Motivene er designet for a PUSLES: startpunktene fordeles over hele
// flaten, fargetonen varierer med posisjon, og til slutt males lokal
// kontrast opp slik at flate felt far egne landemerker.

import { makeRng } from '../core/rng.js';
import { makeFbm2D } from './noise.js';
import { PALETTES, PALETTE_KEYS } from './palettes.js';

const GLOW_LAYERS = [
  { w: 26, a: 0.030 },
  { w: 14, a: 0.055 },
  { w: 7,  a: 0.10 },
  { w: 3,  a: 0.34 },
  { w: 1.2, a: 0.85 },
];

function bakgrunn(ctx, w, h, pal, rng) {
  const [bh, bs, bl] = pal.bg;
  ctx.fillStyle = `hsl(${bh} ${bs}% ${bl}%)`;
  ctx.fillRect(0, 0, w, h);
  // To store, myke lysfelt gir dybde uten a lage flate omrader.
  for (let i = 0; i < 2; i++) {
    const g = ctx.createRadialGradient(
      rng.range(0.15, 0.85) * w, rng.range(0.15, 0.85) * h, 0,
      rng.range(0.15, 0.85) * w, rng.range(0.15, 0.85) * h, Math.max(w, h) * rng.range(0.4, 0.75));
    const hue = rng.pick(pal.hues);
    g.addColorStop(0, `hsl(${hue} 90% 50% / 0.16)`);
    g.addColorStop(1, 'hsl(0 0% 0% / 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function strokGlod(ctx, path, hue, skala) {
  for (const layer of GLOW_LAYERS) {
    ctx.lineWidth = layer.w * skala;
    const lys = layer.w <= 3 ? 82 : 55;
    ctx.strokeStyle = `hsl(${hue} 100% ${lys}% / ${layer.a})`;
    ctx.stroke(path);
  }
}

/** Glodende kule - brukes som landemerke. */
function orb(ctx, x, y, r, hue) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `hsl(${hue} 100% 92% / 0.95)`);
  g.addColorStop(0.18, `hsl(${hue} 100% 68% / 0.70)`);
  g.addColorStop(0.5, `hsl(${hue} 100% 55% / 0.22)`);
  g.addColorStop(1, `hsl(${hue} 100% 50% / 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Maler lokal kontrast i et grovt rutenett og legger til landemerker
 * der bildet er for flatt til a vaere morsomt a pusle.
 */
function sikreLandemerker(ctx, w, h, rng, pal, celler = 9) {
  const rader = Math.max(3, Math.round((celler * h) / w));
  const cw = w / celler;
  const ch = h / rader;
  let lagtTil = 0;
  for (let r = 0; r < rader; r++) {
    for (let c = 0; c < celler; c++) {
      const x = Math.floor(c * cw);
      const y = Math.floor(r * ch);
      const sw = Math.max(1, Math.floor(cw));
      const sh = Math.max(1, Math.floor(ch));
      const d = ctx.getImageData(x, y, sw, sh).data;
      // Standardavvik pa luminans, samplet grovt.
      let sum = 0, sum2 = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 17) {
        const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        sum += l; sum2 += l * l; n++;
      }
      const varians = sum2 / n - (sum / n) ** 2;
      if (varians < 90) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const hue = rng.pick(pal.hues) + rng.range(-12, 12);
        const px = x + rng.range(0.25, 0.75) * sw;
        const py = y + rng.range(0.25, 0.75) * sh;
        orb(ctx, px, py, Math.min(cw, ch) * rng.range(0.30, 0.52), hue);
        ctx.restore();
        lagtTil++;
      }
    }
  }
  return lagtTil;
}

/**
 * @returns {{canvas: HTMLCanvasElement, meta: object}}
 */
export function genererNeon(bredde, hoyde, seed, opts = {}) {
  const rng = makeRng(seed);
  const palettNokkel = opts.palett || rng.pick(PALETTE_KEYS);
  const pal = PALETTES[palettNokkel] || PALETTES.cyberpunk;
  const skala = Math.max(bredde, hoyde) / 1600;

  const canvas = document.createElement('canvas');
  canvas.width = bredde;
  canvas.height = hoyde;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  bakgrunn(ctx, bredde, hoyde, pal, rng);

  const fbm = makeFbm2D(rng.int(1, 1e9), 3, 2.1, 0.55);
  const feltSkala = rng.range(1.6, 3.4) / Math.max(bredde, hoyde);
  const virvel = rng.range(2.2, 4.6);
  const steg = Math.max(bredde, hoyde) / 190;
  const antallSteg = Math.round(rng.range(90, 170));

  // Startpunkter i et forskjovet rutenett - garanterer struktur overalt.
  const kolonner = Math.round(rng.range(20, 28));
  const rader = Math.max(6, Math.round((kolonner * hoyde) / bredde));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let r = 0; r < rader; r++) {
    for (let c = 0; c < kolonner; c++) {
      let x = (c + rng.range(0.1, 0.9)) * (bredde / kolonner);
      let y = (r + rng.range(0.1, 0.9)) * (hoyde / rader);
      const path = new Path2D();
      path.moveTo(x, y);
      let levende = false;
      for (let i = 0; i < antallSteg; i++) {
        const vinkel = fbm(x * feltSkala, y * feltSkala) * Math.PI * virvel;
        x += Math.cos(vinkel) * steg;
        y += Math.sin(vinkel) * steg;
        if (x < -steg || y < -steg || x > bredde + steg || y > hoyde + steg) break;
        path.lineTo(x, y);
        levende = true;
      }
      if (!levende) continue;
      // Fargetonen folger posisjonen, sa ulike omrader blir gjenkjennelige.
      const t = (c / kolonner) * 0.6 + (r / rader) * 0.4;
      const i = Math.min(pal.hues.length - 1, Math.floor(t * pal.hues.length));
      const hue = pal.hues[i] + rng.range(-16, 16);
      strokGlod(ctx, path, hue, skala);
    }
  }

  // Noen fa sterke knutepunkter som ankerpunkter i bildet.
  for (let i = 0, n = rng.int(3, 6); i < n; i++) {
    orb(ctx, rng.range(0.1, 0.9) * bredde, rng.range(0.1, 0.9) * hoyde,
      Math.max(bredde, hoyde) * rng.range(0.035, 0.085), rng.pick(pal.hues));
  }
  ctx.restore();

  const landemerker = sikreLandemerker(ctx, bredde, hoyde, rng, pal);

  return {
    canvas,
    meta: { stil: 'neon', palett: palettNokkel, seed, landemerker },
  };
}
