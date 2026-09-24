// Figurative motiv – dinosaur, hus, bil, rakett, båt og katt.
//
// Alt tegnes med kode i designrommet 1600 × 1067, og alt varierer med seed:
// farger, positurer, antall skyer, hvor treet står. To dinosaurer blir aldri
// helt like.
//
// Scenene er tegnet med tanke på at de skal PUSLES. Ingen store flate felt:
// himmelen har gradient, skyer og fugler, bakken har gress, blomster og
// steiner, og selve figuren har flekker, striper eller paneler. Resultatet
// måles med malPuslbarhet() og vises i grensesnittet.

import { makeRng } from '../core/rng.js';
import {
  DESIGN_B, DESIGN_H, hsl, mork, sirkel, ellipse, rundetRekt, polygon,
  bezierPunkter, taperetBane, stjerne, mal, strek, loddrettGradient,
} from './tegning.js';

const KONTUR = hsl(224, 45, 16);
const HORISONT = 700;

// ===========================================================================
// Felles kulisser
// ===========================================================================

function himmel(ctx, rng, { topp = 205, bunn = 194 } = {}) {
  ctx.fillStyle = loddrettGradient(ctx, 0, HORISONT + 60, [
    [0, hsl(topp, 78, 62)],
    [0.55, hsl(topp - 6, 80, 76)],
    [1, hsl(bunn, 82, 90)],
  ]);
  ctx.fillRect(0, 0, DESIGN_B, HORISONT + 60);
}

function sol(ctx, x, y, r, hue = 48) {
  const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 3.2);
  g.addColorStop(0, hsl(hue, 100, 75, 0.55));
  g.addColorStop(1, hsl(hue, 100, 75, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
  mal(ctx, sirkel(x, y, r), { fyll: hsl(hue, 100, 68), strek: hsl(hue - 16, 90, 52), bredde: 6 });
  mal(ctx, sirkel(x - r * 0.28, y - r * 0.3, r * 0.42), { fyll: hsl(hue + 8, 100, 82, 0.75) });
}

function sky(ctx, x, y, s, rng) {
  const p = new Path2D();
  const bobler = [
    [0, 0, 1], [-0.72, 0.18, 0.72], [0.74, 0.2, 0.68],
    [-0.36, -0.3, 0.66], [0.38, -0.26, 0.6],
  ];
  for (const [dx, dy, r] of bobler) {
    p.addPath(sirkel(x + dx * s, y + dy * s, r * s * rng.range(0.88, 1.12)));
  }
  p.addPath(rundetRekt(x - s * 1.25, y + s * 0.05, s * 2.5, s * 0.6, s * 0.3));
  mal(ctx, p, { fyll: hsl(205, 60, 99), strek: hsl(205, 45, 82), bredde: 5 });
  mal(ctx, rundetRekt(x - s * 1.05, y + s * 0.34, s * 2.05, s * 0.26, s * 0.13),
    { fyll: hsl(210, 45, 90, 0.85) });
}

function skyer(ctx, rng, antall = 3) {
  for (let i = 0; i < antall; i++) {
    sky(ctx, rng.range(120, DESIGN_B - 120), rng.range(90, 330), rng.range(46, 84), rng);
  }
}

function fugl(ctx, x, y, s, farge = KONTUR) {
  strek(ctx, [[x - s, y], [x - s * 0.45, y - s * 0.55], [x, y - s * 0.05]], farge, s * 0.22);
  strek(ctx, [[x, y - s * 0.05], [x + s * 0.45, y - s * 0.6], [x + s, y - s * 0.05]], farge, s * 0.22);
}

function fugler(ctx, rng, antall = 3) {
  for (let i = 0; i < antall; i++) {
    fugl(ctx, rng.range(150, DESIGN_B - 150), rng.range(120, 300), rng.range(16, 30),
      hsl(224, 40, 34, 0.8));
  }
}

/** Åser bak horisonten – gir dybde og bryter opp himmelen. */
function aser(ctx, rng, hue = 128) {
  for (const [dy, lys, spenn] of [[-120, 42, 1.25], [-64, 34, 0.95]]) {
    const p = new Path2D();
    p.moveTo(-50, HORISONT + 10);
    const n = 4;
    for (let i = 0; i <= n; i++) {
      const x = -50 + ((DESIGN_B + 100) * i) / n;
      const y = HORISONT + dy - rng.range(0, 90) * spenn;
      p.quadraticCurveTo(x - DESIGN_B / (n * 2.4), y - 60 * spenn, x, y);
    }
    p.lineTo(DESIGN_B + 50, HORISONT + 10);
    p.closePath();
    mal(ctx, p, { fyll: hsl(hue + rng.range(-8, 8), 46, lys) });
  }
}

function bakke(ctx, rng, hue = 108) {
  ctx.fillStyle = loddrettGradient(ctx, HORISONT - 10, DESIGN_H, [
    [0, hsl(hue, 52, 46)],
    [1, hsl(hue + 8, 58, 30)],
  ]);
  ctx.fillRect(0, HORISONT - 10, DESIGN_B, DESIGN_H - HORISONT + 10);
  strek(ctx, [[0, HORISONT - 8], [DESIGN_B, HORISONT - 8]], hsl(hue, 45, 34), 7);

  // Lysere bånd gir terrenget form.
  for (let i = 0; i < 4; i++) {
    const y = rng.range(HORISONT + 30, DESIGN_H - 40);
    const p = new Path2D();
    p.moveTo(-40, y);
    p.quadraticCurveTo(DESIGN_B / 2, y - rng.range(20, 60), DESIGN_B + 40, y);
    p.lineTo(DESIGN_B + 40, y + rng.range(30, 70));
    p.quadraticCurveTo(DESIGN_B / 2, y + rng.range(10, 40), -40, y + rng.range(20, 60));
    p.closePath();
    mal(ctx, p, { fyll: hsl(hue + rng.range(-6, 10), 50, rng.range(38, 52), 0.5) });
  }
}

function gresstust(ctx, x, y, s, hue = 108) {
  for (const d of [-1, -0.35, 0.35, 1]) {
    strek(ctx, [[x + d * s * 0.3, y], [x + d * s * 0.75, y - s * (0.85 - Math.abs(d) * 0.22)]],
      hsl(hue, 58, 34), s * 0.16);
  }
}

function blomst(ctx, x, y, s, hue) {
  strek(ctx, [[x, y], [x, y - s * 1.5]], hsl(112, 55, 34), s * 0.22);
  const midt = y - s * 1.5;
  for (let i = 0; i < 5; i++) {
    const v = (i / 5) * Math.PI * 2;
    mal(ctx, sirkel(x + Math.cos(v) * s * 0.55, midt + Math.sin(v) * s * 0.55, s * 0.46),
      { fyll: hsl(hue, 85, 68), strek: hsl(hue, 70, 48), bredde: 3 });
  }
  mal(ctx, sirkel(x, midt, s * 0.4), { fyll: hsl(48, 95, 66), strek: hsl(40, 80, 48), bredde: 3 });
}

function markdetaljer(ctx, rng, { tuster = 26, blomster = 12, steiner = 8, hue = 108 } = {}) {
  for (let i = 0; i < tuster; i++) {
    gresstust(ctx, rng.range(0, DESIGN_B), rng.range(HORISONT + 10, DESIGN_H - 10),
      rng.range(26, 54), hue);
  }
  for (let i = 0; i < blomster; i++) {
    blomst(ctx, rng.range(30, DESIGN_B - 30), rng.range(HORISONT + 50, DESIGN_H - 20),
      rng.range(16, 28), rng.pick([348, 320, 276, 20, 196]));
  }
  for (let i = 0; i < steiner; i++) {
    const x = rng.range(0, DESIGN_B);
    const y = rng.range(HORISONT + 40, DESIGN_H - 20);
    const s = rng.range(12, 26);
    mal(ctx, ellipse(x, y, s, s * 0.68), { fyll: hsl(35, 18, 58), strek: hsl(35, 20, 40), bredde: 4 });
  }
}

function lovtre(ctx, x, bunnY, h, rng, hue = 132) {
  const stamme = taperetBane(
    bezierPunkter([x, bunnY], [x - 8, bunnY - h * 0.3], [x + 10, bunnY - h * 0.5], [x, bunnY - h * 0.62], 24),
    (t) => h * (0.115 - t * 0.05));
  mal(ctx, stamme, { fyll: hsl(26, 42, 40), strek: hsl(26, 45, 26), bredde: 6 });
  const krone = new Path2D();
  for (const [dx, dy, r] of [[0, -0.86, 0.30], [-0.24, -0.72, 0.25], [0.25, -0.73, 0.26], [0, -0.66, 0.24]]) {
    krone.addPath(sirkel(x + dx * h, bunnY + dy * h, r * h * rng.range(0.9, 1.1)));
  }
  mal(ctx, krone, { fyll: hsl(hue, 52, 42), strek: hsl(hue, 55, 26), bredde: 7 });
  for (let i = 0; i < 6; i++) {
    mal(ctx, sirkel(x + rng.range(-0.22, 0.22) * h, bunnY - rng.range(0.6, 0.88) * h, h * rng.range(0.05, 0.09)),
      { fyll: hsl(hue + 12, 55, 54, 0.6) });
  }
}

// ===========================================================================
// Dinosaur
// ===========================================================================

function palme(ctx, x, bunnY, h, rng) {
  const stamme = taperetBane(
    bezierPunkter([x, bunnY], [x + h * 0.06, bunnY - h * 0.4], [x - h * 0.1, bunnY - h * 0.6], [x - h * 0.06, bunnY - h], 26),
    (t) => h * (0.085 - t * 0.04));
  mal(ctx, stamme, { fyll: hsl(32, 40, 46), strek: hsl(30, 45, 28), bredde: 6 });
  const topp = { x: x - h * 0.06, y: bunnY - h };
  for (let i = 0; i < 7; i++) {
    const v = -Math.PI + (i / 6) * Math.PI;
    const len = h * rng.range(0.34, 0.46);
    const blad = taperetBane(
      bezierPunkter([topp.x, topp.y],
        [topp.x + Math.cos(v) * len * 0.5, topp.y + Math.sin(v) * len * 0.5 - h * 0.1],
        [topp.x + Math.cos(v) * len * 0.9, topp.y + Math.sin(v) * len * 0.7],
        [topp.x + Math.cos(v) * len, topp.y + Math.sin(v) * len + h * 0.08], 20),
      (t) => h * 0.12 * Math.sin(Math.PI * Math.min(1, t + 0.12)));
    mal(ctx, blad, { fyll: hsl(126 + i * 3, 52, 38), strek: hsl(126, 55, 24), bredde: 5 });
  }
  for (let i = 0; i < 3; i++) {
    mal(ctx, sirkel(topp.x + rng.range(-20, 20), topp.y + rng.range(10, 34), 14),
      { fyll: hsl(34, 65, 48), strek: hsl(30, 60, 30), bredde: 3 });
  }
}

function vulkan(ctx, x, rng) {
  const p = polygon([[x - 300, HORISONT - 4], [x - 90, 250], [x + 90, 250], [x + 300, HORISONT - 4]]);
  mal(ctx, p, { fyll: hsl(268, 18, 38), strek: hsl(268, 22, 24), bredde: 7 });
  mal(ctx, polygon([[x - 220, HORISONT - 4], [x - 70, 300], [x + 20, 330], [x + 40, HORISONT - 4]]),
    { fyll: hsl(268, 16, 46, 0.7) });
  // Lava over kanten.
  mal(ctx, polygon([[x - 90, 252], [x - 40, 320], [x + 10, 268], [x + 50, 360], [x + 90, 252]]),
    { fyll: hsl(18, 92, 56), strek: hsl(8, 85, 42), bredde: 5 });
  for (let i = 0; i < 3; i++) {
    const rok = taperetBane(
      bezierPunkter([x, 250], [x - 120 + i * 90, 170], [x + 110 - i * 70, 110], [x + rng.range(-70, 90), 40], 24),
      (t) => 46 + t * 90);
    mal(ctx, rok, { fyll: hsl(250, 12, 84, 0.42) });
  }
}

function tegnDinosaur(ctx, rng) {
  const hue = rng.pick([128, 158, 96, 276, 186, 28]);
  const lys = rng.range(46, 56);
  const hud = hsl(hue, 52, lys);
  const hudMork = hsl(hue, 54, lys - 16);
  const kontur = hsl(hue, 55, lys - 30);
  const speil = rng.bool();

  ctx.save();
  if (speil) { ctx.translate(DESIGN_B, 0); ctx.scale(-1, 1); }

  const kroppX = 830;
  const kroppY = 600;

  mal(ctx, ellipse(850, 892, 430, 38), { fyll: hsl(96, 45, 22, 0.26) });

  // Bakbein først, så de havner bak kroppen.
  for (const [bx, by, bh, f] of [[985, 660, 250, hudMork], [655, 660, 240, hudMork]]) {
    mal(ctx, rundetRekt(bx, by, 104, bh, 44), { fyll: f, strek: kontur, bredde: 7 });
    mal(ctx, ellipse(bx + 52, by + bh - 8, 76, 30), { fyll: f, strek: kontur, bredde: 7 });
  }

  // Hale.
  const hale = taperetBane(
    bezierPunkter([1050, 590], [1240, 560], [1330, 690], [1520, 640], 44),
    (t) => 160 * (1 - t) ** 1.25 + 8);
  mal(ctx, hale, { fyll: hud, strek: kontur, bredde: 7 });

  // Hals.
  const hals = taperetBane(
    bezierPunkter([650, 560], [560, 470], [470, 370], [452, 236], 40),
    (t) => 148 - t * 62);
  mal(ctx, hals, { fyll: hud, strek: kontur, bredde: 7 });

  // Kropp.
  mal(ctx, ellipse(kroppX, kroppY, 268, 158), { fyll: hud, strek: kontur, bredde: 8 });
  mal(ctx, ellipse(kroppX + 10, kroppY + 66, 208, 76), { fyll: hsl(hue - 6, 42, lys + 22), strek: kontur, bredde: 6 });

  // Forbein.
  for (const [bx, by, bh] of [[905, 690, 224], [600, 686, 214]]) {
    mal(ctx, rundetRekt(bx, by, 100, bh, 42), { fyll: hud, strek: kontur, bredde: 7 });
    mal(ctx, ellipse(bx + 50, by + bh - 8, 74, 30), { fyll: hud, strek: kontur, bredde: 7 });
    for (let i = 0; i < 3; i++) {
      mal(ctx, sirkel(bx + 18 + i * 32, by + bh - 4, 13), { fyll: hsl(46, 58, 88), strek: kontur, bredde: 4 });
    }
  }

  // Rygglameller.
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = kroppX - 210 + t * 430;
    const h = 46 - Math.abs(t - 0.45) * 44;
    mal(ctx, polygon([[x - 26, kroppY - 150 + Math.abs(t - 0.5) * 60],
      [x, kroppY - 150 - h + Math.abs(t - 0.5) * 60],
      [x + 26, kroppY - 150 + Math.abs(t - 0.5) * 60]]),
      { fyll: hsl(hue + 30, 62, lys + 10), strek: kontur, bredde: 5 });
  }

  // Flekker – bryter opp kroppen så den ikke blir et flatt felt å pusle.
  for (let i = 0; i < 9; i++) {
    const v = rng.range(0, Math.PI * 2);
    const rad = rng.range(0, 0.74);
    mal(ctx, ellipse(kroppX + Math.cos(v) * 240 * rad, kroppY + Math.sin(v) * 130 * rad,
      rng.range(22, 42), rng.range(16, 30), rng.range(0, 3)),
      { fyll: hsl(hue + rng.range(-14, 24), 50, lys - 12, 0.85) });
  }

  // Hode.
  mal(ctx, ellipse(452, 218, 104, 76, -0.12), { fyll: hud, strek: kontur, bredde: 8 });
  mal(ctx, ellipse(360, 246, 62, 46, -0.05), { fyll: hud, strek: kontur, bredde: 7 });
  mal(ctx, sirkel(330, 236, 8), { fyll: kontur });
  mal(ctx, sirkel(352, 228, 7), { fyll: kontur });
  strek(ctx, [[322, 268], [372, 274]], kontur, 6);
  mal(ctx, sirkel(438, 196, 21), { fyll: hsl(0, 0, 100), strek: kontur, bredde: 5 });
  mal(ctx, sirkel(444, 199, 11), { fyll: KONTUR });
  mal(ctx, sirkel(449, 194, 4.5), { fyll: hsl(0, 0, 100) });

  ctx.restore();
}

function sceneDinosaur(ctx, rng) {
  himmel(ctx, rng, { topp: 198 });
  sol(ctx, rng.range(180, 400), rng.range(120, 210), 66, 42);
  skyer(ctx, rng, rng.int(2, 4));
  fugler(ctx, rng, rng.int(2, 4));
  vulkan(ctx, rng.range(1080, 1380), rng);
  aser(ctx, rng, 112);
  bakke(ctx, rng, 96);
  for (let i = 0, n = rng.int(2, 3); i < n; i++) {
    palme(ctx, rng.range(80, DESIGN_B - 80), rng.range(HORISONT + 20, HORISONT + 90), rng.range(250, 360), rng);
  }
  tegnDinosaur(ctx, rng);
  markdetaljer(ctx, rng, { tuster: 30, blomster: 8, steiner: 10, hue: 96 });
}

// ===========================================================================
// Hus
// ===========================================================================

function tegnHus(ctx, rng) {
  const veggHue = rng.pick([42, 18, 196, 152, 348, 0]);
  const veggLys = rng.range(70, 84);
  const takHue = rng.pick([8, 18, 262, 212]);
  const vegg = hsl(veggHue, 62, veggLys);
  const x = 520, y = 470, b = 560, h = 350;

  // Pipe bak taket.
  mal(ctx, rundetRekt(930, 262, 76, 150, 8), { fyll: hsl(12, 38, 52), strek: KONTUR, bredde: 7 });
  mal(ctx, rundetRekt(918, 250, 100, 34, 10), { fyll: hsl(12, 34, 44), strek: KONTUR, bredde: 7 });
  for (let i = 0; i < 3; i++) {
    const rok = taperetBane(
      bezierPunkter([968, 250], [900 + i * 50, 190], [1040 - i * 40, 140], [960 + rng.range(-60, 90), 54], 22),
      (t) => 34 + t * 74);
    mal(ctx, rok, { fyll: hsl(210, 14, 92, 0.42) });
  }

  // Vegg med panelstriper – flat vegg er kjedelig å pusle.
  mal(ctx, rundetRekt(x, y, b, h, 10), { fyll: vegg, strek: KONTUR, bredde: 8 });
  for (let i = 1; i < 7; i++) {
    strek(ctx, [[x + 6, y + (h / 7) * i], [x + b - 6, y + (h / 7) * i]], hsl(veggHue, 45, veggLys - 12, 0.65), 4);
  }

  // Tak.
  mal(ctx, polygon([[x - 62, y + 14], [x + b / 2, 246], [x + b + 62, y + 14]]),
    { fyll: hsl(takHue, 58, 44), strek: KONTUR, bredde: 8 });
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    strek(ctx, [[x - 62 + t * (b / 2 + 62), y + 14 - t * (y + 14 - 246)],
      [x + b + 62 - t * (b / 2 + 62), y + 14 - t * (y + 14 - 246)]],
      hsl(takHue, 50, 34, 0.5), 5);
  }

  // Dør.
  mal(ctx, rundetRekt(738, 640, 126, 190, 12), { fyll: hsl(24, 52, 40), strek: KONTUR, bredde: 7 });
  strek(ctx, [[756, 668], [846, 668]], hsl(24, 45, 28), 5);
  strek(ctx, [[756, 800], [846, 800]], hsl(24, 45, 28), 5);
  mal(ctx, sirkel(838, 738, 11), { fyll: hsl(46, 82, 62), strek: KONTUR, bredde: 4 });

  // Vinduer med kryssposter og gardiner.
  for (const vx of [592, 900]) {
    mal(ctx, rundetRekt(vx, 540, 140, 142, 10), { fyll: hsl(196, 72, 78), strek: KONTUR, bredde: 7 });
    mal(ctx, polygon([[vx + 8, 548], [vx + 132, 548], [vx + 8, 674]]),
      { fyll: hsl(200, 80, 90, 0.55) });
    strek(ctx, [[vx + 70, 542], [vx + 70, 680]], KONTUR, 6);
    strek(ctx, [[vx + 4, 611], [vx + 136, 611]], KONTUR, 6);
    mal(ctx, rundetRekt(vx - 12, 528, 164, 20, 8), { fyll: hsl(24, 48, 44), strek: KONTUR, bredde: 5 });
  }

  // Sti fra døra.
  mal(ctx, polygon([[762, 830], [842, 830], [960, DESIGN_H], [640, DESIGN_H]]),
    { fyll: hsl(38, 30, 72), strek: hsl(38, 26, 56), bredde: 6 });
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    strek(ctx, [[762 - t * 122, 830 + t * 240], [842 + t * 118, 830 + t * 240]], hsl(38, 24, 60), 5);
  }

  // Gjerde.
  for (const [fra, til] of [[40, 500], [1100, 1560]]) {
    strek(ctx, [[fra, 790], [til, 790]], hsl(40, 45, 78), 12);
    strek(ctx, [[fra, 836], [til, 836]], hsl(40, 45, 78), 12);
    for (let px = fra; px < til; px += 62) {
      mal(ctx, polygon([[px, 870], [px, 772], [px + 17, 750], [px + 34, 772], [px + 34, 870]]),
        { fyll: hsl(40, 52, 86), strek: KONTUR, bredde: 5 });
    }
  }
}

function sceneHus(ctx, rng) {
  himmel(ctx, rng, { topp: 202 });
  sol(ctx, rng.range(140, 330), rng.range(110, 190), 62, 48);
  skyer(ctx, rng, rng.int(3, 5));
  fugler(ctx, rng, rng.int(2, 4));
  aser(ctx, rng, 122);
  bakke(ctx, rng, 112);
  tegnHus(ctx, rng);
  lovtre(ctx, rng.range(1230, 1420), rng.range(880, 950), rng.range(330, 420), rng, rng.pick([132, 108, 88]));
  lovtre(ctx, rng.range(120, 260), rng.range(900, 980), rng.range(250, 320), rng, rng.pick([136, 116]));
  markdetaljer(ctx, rng, { tuster: 26, blomster: 16, steiner: 6, hue: 112 });
}

// ===========================================================================
// Bil
// ===========================================================================

function tegnBil(ctx, rng) {
  const hue = rng.pick([355, 18, 210, 145, 275, 48]);
  const lakk = hsl(hue, 78, 56);
  const lakkMork = hsl(hue, 72, 40);
  const kontur = hsl(hue, 60, 22);
  const bakke_ = 830;

  ctx.save();
  if (rng.bool()) { ctx.translate(DESIGN_B, 0); ctx.scale(-1, 1); }

  // Skygge under bilen.
  mal(ctx, ellipse(800, bakke_ + 58, 420, 36), { fyll: hsl(220, 30, 20, 0.28) });

  // Kupé.
  const kupe = new Path2D();
  kupe.moveTo(596, 630);
  kupe.bezierCurveTo(640, 486, 720, 452, 812, 452);
  kupe.bezierCurveTo(926, 452, 986, 496, 1026, 630);
  kupe.closePath();
  mal(ctx, kupe, { fyll: lakk, strek: kontur, bredde: 8 });

  // Vinduer.
  mal(ctx, polygon([[648, 612], [684, 508], [794, 494], [794, 612]]),
    { fyll: hsl(196, 70, 80), strek: kontur, bredde: 7 });
  mal(ctx, polygon([[822, 494], [930, 508], [978, 612], [822, 612]]),
    { fyll: hsl(196, 70, 80), strek: kontur, bredde: 7 });
  mal(ctx, polygon([[656, 606], [688, 516], [730, 512]]), { fyll: hsl(200, 80, 93, 0.7) });

  // Karosseri.
  mal(ctx, rundetRekt(400, 606, 800, 176, 62), { fyll: lakk, strek: kontur, bredde: 8 });
  mal(ctx, rundetRekt(412, 700, 776, 76, 38), { fyll: lakkMork, strek: kontur, bredde: 6 });
  strek(ctx, [[808, 612], [808, 700]], kontur, 6);
  mal(ctx, rundetRekt(744, 656, 56, 15, 7), { fyll: hsl(0, 0, 92), strek: kontur, bredde: 4 });
  mal(ctx, rundetRekt(840, 656, 56, 15, 7), { fyll: hsl(0, 0, 92), strek: kontur, bredde: 4 });

  // Lys og støtfangere.
  mal(ctx, ellipse(1180, 660, 34, 28), { fyll: hsl(52, 100, 74), strek: kontur, bredde: 6 });
  mal(ctx, ellipse(420, 660, 26, 24), { fyll: hsl(4, 85, 58), strek: kontur, bredde: 6 });
  mal(ctx, rundetRekt(386, 726, 56, 40, 14), { fyll: hsl(0, 0, 78), strek: kontur, bredde: 6 });
  mal(ctx, rundetRekt(1158, 726, 56, 40, 14), { fyll: hsl(0, 0, 78), strek: kontur, bredde: 6 });

  // Hjul.
  for (const hx of [592, 1008]) {
    mal(ctx, sirkel(hx, 800, 92), { fyll: hsl(220, 12, 22), strek: KONTUR, bredde: 8 });
    mal(ctx, sirkel(hx, 800, 48), { fyll: hsl(0, 0, 86), strek: KONTUR, bredde: 6 });
    for (let i = 0; i < 5; i++) {
      const v = (i / 5) * Math.PI * 2 + 0.3;
      strek(ctx, [[hx, 800], [hx + Math.cos(v) * 40, 800 + Math.sin(v) * 40]], hsl(220, 10, 55), 9);
    }
    mal(ctx, sirkel(hx, 800, 14), { fyll: hsl(220, 12, 40), strek: KONTUR, bredde: 4 });
  }
  ctx.restore();
}

function sceneBil(ctx, rng) {
  himmel(ctx, rng, { topp: 206 });
  sol(ctx, rng.range(1150, 1450), rng.range(110, 200), 64, 46);
  skyer(ctx, rng, rng.int(3, 5));
  fugler(ctx, rng, rng.int(1, 3));
  aser(ctx, rng, 134);
  bakke(ctx, rng, 118);
  for (let i = 0, n = rng.int(2, 4); i < n; i++) {
    lovtre(ctx, rng.range(60, DESIGN_B - 60), rng.range(HORISONT + 30, HORISONT + 90),
      rng.range(190, 260), rng, rng.pick([128, 104, 146]));
  }

  // Vei.
  const veiY = 860;
  mal(ctx, polygon([[0, veiY], [DESIGN_B, veiY - 24], [DESIGN_B, DESIGN_H], [0, DESIGN_H]]),
    { fyll: hsl(226, 10, 34), strek: hsl(226, 12, 22), bredde: 7 });
  for (let x = -40; x < DESIGN_B; x += 180) {
    mal(ctx, rundetRekt(x, veiY + 96, 96, 17, 8), { fyll: hsl(52, 92, 72) });
  }
  tegnBil(ctx, rng);
}

// ===========================================================================
// Rakett
// ===========================================================================

function romhimmel(ctx, rng) {
  ctx.fillStyle = loddrettGradient(ctx, 0, DESIGN_H, [
    [0, hsl(252, 62, 12)],
    [0.5, hsl(268, 58, 20)],
    [1, hsl(292, 50, 28)],
  ]);
  ctx.fillRect(0, 0, DESIGN_B, DESIGN_H);

  // Tåkeskyer gir himmelen struktur å pusle etter.
  for (let i = 0; i < 8; i++) {
    const x = rng.range(0, DESIGN_B);
    const y = rng.range(0, DESIGN_H);
    const r = rng.range(220, 460);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const hue = rng.pick([196, 286, 320, 172]);
    g.addColorStop(0, hsl(hue, 85, 60, 0.28));
    g.addColorStop(1, hsl(hue, 85, 60, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Stjernebånd på tvers - bryter opp de store mørke feltene.
  const bandV = rng.range(-0.6, -0.2);
  const bandX = rng.range(300, 1300);
  const bandY = rng.range(400, 700);
  for (let i = 0; i < 260; i++) {
    const t = rng.range(-1, 1);
    const spredning = rng.range(-1, 1) ** 3 * 190;
    const x = bandX + Math.cos(bandV) * t * 1100 - Math.sin(bandV) * spredning;
    const y = bandY + Math.sin(bandV) * t * 1100 + Math.cos(bandV) * spredning;
    if (x < -20 || y < -20 || x > DESIGN_B + 20 || y > DESIGN_H + 20) continue;
    mal(ctx, sirkel(x, y, rng.range(1.5, 4)),
      { fyll: hsl(rng.pick([50, 196, 286, 0]), 65, 94, rng.range(0.3, 0.95)) });
  }

  for (let i = 0; i < 220; i++) {
    const x = rng.range(0, DESIGN_B);
    const y = rng.range(0, DESIGN_H);
    const r = rng.range(1.5, 4.5);
    mal(ctx, sirkel(x, y, r), { fyll: hsl(rng.pick([50, 196, 0]), 60, 96, rng.range(0.4, 1)) });
  }
  for (let i = 0; i < 7; i++) {
    mal(ctx, stjerne(rng.range(60, DESIGN_B - 60), rng.range(50, DESIGN_H - 50), rng.range(14, 26), 4, 0.3),
      { fyll: hsl(52, 100, 88, 0.95) });
  }
}

function planet(ctx, x, y, r, rng) {
  const hue = rng.pick([26, 196, 320, 150, 268]);
  mal(ctx, sirkel(x, y, r), { fyll: hsl(hue, 62, 58), strek: hsl(hue, 60, 34), bredde: 7 });
  ctx.save();
  ctx.clip(sirkel(x, y, r));
  for (let i = 0; i < 4; i++) {
    mal(ctx, ellipse(x + rng.range(-r, r) * 0.5, y + rng.range(-r, r) * 0.8, r * rng.range(0.3, 0.6), r * rng.range(0.12, 0.22)),
      { fyll: hsl(hue + rng.range(-20, 20), 58, rng.range(40, 72), 0.8) });
  }
  ctx.restore();
  if (rng.bool(0.6)) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng.range(-0.5, -0.2));
    mal(ctx, ellipse(0, 0, r * 1.7, r * 0.38), { strek: hsl(hue + 30, 70, 74), bredde: 14 });
    ctx.restore();
  }
}

function tegnRakett(ctx, rng) {
  const hue = rng.pick([0, 210, 46, 150, 280]);
  const kropp = hsl(0, 0, 96);
  const aksent = hsl(hue, 82, 56);
  const kontur = hsl(hue, 40, 22);
  const cx = 800;

  // Flamme.
  for (const [w, len, h2, l] of [[150, 320, hue, 0], [104, 240, 24, 60], [58, 150, 48, 72]]) {
    const f = taperetBane(
      bezierPunkter([cx, 742], [cx + rng.range(-24, 24), 742 + len * 0.4],
        [cx + rng.range(-30, 30), 742 + len * 0.7], [cx + rng.range(-14, 14), 742 + len], 22),
      (t) => w * (1 - t) ** 0.85);
    mal(ctx, f, { fyll: hsl(h2 === hue ? 14 : h2, 95, 50 + l * 0.4, 0.92) });
  }

  // Finner.
  for (const s of [-1, 1]) {
    mal(ctx, polygon([[cx + s * 96, 520], [cx + s * 226, 736], [cx + s * 96, 712]]),
      { fyll: aksent, strek: kontur, bredde: 8 });
  }

  // Kropp.
  const b = new Path2D();
  b.moveTo(cx - 100, 700);
  b.bezierCurveTo(cx - 108, 420, cx - 64, 250, cx, 148);
  b.bezierCurveTo(cx + 64, 250, cx + 108, 420, cx + 100, 700);
  b.closePath();
  mal(ctx, b, { fyll: kropp, strek: kontur, bredde: 8 });

  // Nesekjegle og band.
  ctx.save();
  ctx.clip(b);
  mal(ctx, polygon([[cx - 80, 320], [cx + 80, 320], [cx + 46, 150], [cx - 46, 150]]),
    { fyll: aksent });
  mal(ctx, rundetRekt(cx - 110, 604, 220, 46, 0), { fyll: aksent });
  mal(ctx, rundetRekt(cx - 110, 148, 46, 560, 0), { fyll: hsl(0, 0, 100, 0.55) });
  ctx.restore();
  strek(ctx, [[cx - 82, 320], [cx + 82, 320]], kontur, 7);
  strek(ctx, [[cx - 104, 604], [cx + 104, 604]], kontur, 7);
  strek(ctx, [[cx - 106, 650], [cx + 106, 650]], kontur, 7);

  // Vindu.
  mal(ctx, sirkel(cx, 450, 74), { fyll: hsl(200, 78, 72), strek: kontur, bredde: 9 });
  mal(ctx, sirkel(cx, 450, 56), { fyll: hsl(200, 85, 82), strek: hsl(200, 50, 60), bredde: 4 });
  mal(ctx, polygon([[cx - 44, 434], [cx - 4, 400], [cx + 14, 414], [cx - 26, 452]]),
    { fyll: hsl(0, 0, 100, 0.75) });

  // Dyse.
  mal(ctx, polygon([[cx - 100, 700], [cx + 100, 700], [cx + 74, 748], [cx - 74, 748]]),
    { fyll: hsl(0, 0, 72), strek: kontur, bredde: 8 });
}

function sceneRakett(ctx, rng) {
  romhimmel(ctx, rng);
  planet(ctx, rng.range(150, 380), rng.range(160, 320), rng.range(90, 140), rng);
  planet(ctx, rng.range(1250, 1500), rng.range(680, 900), rng.range(70, 120), rng);
  // Måne.
  const mx = rng.range(1180, 1420), my = rng.range(130, 260), mr = rng.range(70, 100);
  mal(ctx, sirkel(mx, my, mr), { fyll: hsl(48, 40, 88), strek: hsl(44, 30, 66), bredde: 6 });
  for (let i = 0; i < 5; i++) {
    const v = rng.range(0, Math.PI * 2), d = rng.range(0, mr * 0.65);
    mal(ctx, sirkel(mx + Math.cos(v) * d, my + Math.sin(v) * d, rng.range(8, 20)),
      { fyll: hsl(44, 26, 78), strek: hsl(44, 24, 66), bredde: 3 });
  }
  tegnRakett(ctx, rng);
}

// ===========================================================================
// Båt
// ===========================================================================

function tegnBat(ctx, rng) {
  const seilHue = rng.pick([0, 210, 46, 150, 280, 320]);
  const skrogHue = rng.pick([18, 355, 210]);
  const vannY = 760;

  // Mast og seil.
  strek(ctx, [[820, 300], [820, 770]], hsl(28, 45, 36), 16);
  mal(ctx, polygon([[806, 316], [806, 700], [560, 700]]),
    { fyll: hsl(seilHue, 70, 88), strek: KONTUR, bredde: 8 });
  mal(ctx, polygon([[834, 360], [834, 700], [1024, 700]]),
    { fyll: hsl(seilHue, 75, 70), strek: KONTUR, bredde: 8 });
  for (let i = 1; i < 4; i++) {
    strek(ctx, [[806, 316 + i * 96], [560 + (3 - i) * 62, 700]], hsl(seilHue, 50, 70, 0.6), 5);
  }
  mal(ctx, polygon([[822, 300], [822, 250], [930, 274]]),
    { fyll: hsl(4, 82, 58), strek: KONTUR, bredde: 6 });

  // Skrog.
  const skrog = new Path2D();
  skrog.moveTo(520, 700);
  skrog.lineTo(1120, 700);
  skrog.bezierCurveTo(1090, 806, 990, 848, 820, 848);
  skrog.bezierCurveTo(650, 848, 550, 806, 520, 700);
  skrog.closePath();
  mal(ctx, skrog, { fyll: hsl(skrogHue, 58, 46), strek: KONTUR, bredde: 9 });
  mal(ctx, rundetRekt(528, 700, 584, 34, 8), { fyll: hsl(skrogHue, 50, 64), strek: KONTUR, bredde: 6 });
  for (let i = 0; i < 4; i++) {
    mal(ctx, sirkel(640 + i * 110, 772, 26), { fyll: hsl(196, 70, 80), strek: KONTUR, bredde: 6 });
  }

  // Speiling i vannet.
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.translate(0, vannY * 2 + 96);
  ctx.scale(1, -1);
  mal(ctx, skrog, { fyll: hsl(skrogHue, 58, 46) });
  ctx.restore();
}

function sceneBat(ctx, rng) {
  himmel(ctx, rng, { topp: 200 });
  sol(ctx, rng.range(1100, 1440), rng.range(110, 210), 70, 44);
  skyer(ctx, rng, rng.int(3, 5));
  fugler(ctx, rng, rng.int(3, 5));

  // Øy i horisonten.
  const ox = rng.range(120, 460);
  mal(ctx, polygon([[ox - 190, 762], [ox - 40, 646], [ox + 60, 700], [ox + 210, 762]]),
    { fyll: hsl(96, 34, 40), strek: hsl(96, 38, 26), bredde: 6 });

  // Hav.
  const vannY = 760;
  ctx.fillStyle = loddrettGradient(ctx, vannY, DESIGN_H, [
    [0, hsl(198, 72, 52)],
    [1, hsl(212, 70, 34)],
  ]);
  ctx.fillRect(0, vannY, DESIGN_B, DESIGN_H - vannY);
  strek(ctx, [[0, vannY], [DESIGN_B, vannY]], hsl(198, 60, 40), 7);

  tegnBat(ctx, rng);

  // Bølger foran og bak båten.
  for (let i = 0; i < 44; i++) {
    const x = rng.range(-40, DESIGN_B);
    const y = rng.range(vannY + 16, DESIGN_H - 10);
    const s = rng.range(34, 86);
    const p = new Path2D();
    p.moveTo(x, y);
    p.quadraticCurveTo(x + s * 0.3, y - s * 0.28, x + s * 0.6, y);
    p.quadraticCurveTo(x + s * 0.85, y + s * 0.22, x + s * 1.2, y);
    mal(ctx, p, { strek: hsl(200, 80, rng.range(72, 92), 0.75), bredde: rng.range(5, 9) });
  }
}

// ===========================================================================
// Katt
// ===========================================================================

function sommerfugl(ctx, x, y, s, hue) {
  mal(ctx, ellipse(x - s * 0.5, y - s * 0.2, s * 0.5, s * 0.36, -0.5),
    { fyll: hsl(hue, 85, 66), strek: KONTUR, bredde: 4 });
  mal(ctx, ellipse(x + s * 0.5, y - s * 0.2, s * 0.5, s * 0.36, 0.5),
    { fyll: hsl(hue, 85, 66), strek: KONTUR, bredde: 4 });
  mal(ctx, ellipse(x - s * 0.38, y + s * 0.3, s * 0.34, s * 0.26, 0.4),
    { fyll: hsl(hue + 20, 85, 74), strek: KONTUR, bredde: 4 });
  mal(ctx, ellipse(x + s * 0.38, y + s * 0.3, s * 0.34, s * 0.26, -0.4),
    { fyll: hsl(hue + 20, 85, 74), strek: KONTUR, bredde: 4 });
  mal(ctx, rundetRekt(x - s * 0.08, y - s * 0.4, s * 0.16, s * 0.9, s * 0.08), { fyll: KONTUR });
}

function tegnKatt(ctx, rng) {
  const hue = rng.pick([28, 38, 0, 220, 300]);
  const metning = rng.range(30, 72);
  const lys = rng.range(52, 72);
  const pels = hsl(hue, metning, lys);
  const pelsLys = hsl(hue, metning - 10, Math.min(94, lys + 22));
  const kontur = hsl(hue, metning, Math.max(16, lys - 36));
  const cx = 800;

  ctx.save();
  if (rng.bool()) { ctx.translate(DESIGN_B, 0); ctx.scale(-1, 1); }

  // Hale.
  const hale = taperetBane(
    bezierPunkter([cx + 170, 870], [cx + 400, 880], [cx + 420, 640], [cx + 300, 560], 40),
    (t) => 78 - t * 22);
  mal(ctx, hale, { fyll: pels, strek: kontur, bredde: 8 });
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    const pts = bezierPunkter([cx + 170, 870], [cx + 400, 880], [cx + 420, 640], [cx + 300, 560], 40);
    const p = pts[Math.round(t * 40)];
    mal(ctx, ellipse(p.x, p.y, 34 - t * 8, 15, 0.6), { fyll: hsl(hue, metning, lys - 20, 0.85) });
  }

  // Skygge gir figuren bakkekontakt.
  mal(ctx, ellipse(cx, 916, 218, 32), { fyll: hsl(116, 45, 24, 0.28) });

  // Kropp.
  const kropp = new Path2D();
  kropp.moveTo(cx - 150, 900);
  kropp.bezierCurveTo(cx - 210, 700, cx - 150, 540, cx, 540);
  kropp.bezierCurveTo(cx + 150, 540, cx + 210, 700, cx + 150, 900);
  kropp.closePath();
  mal(ctx, kropp, { fyll: pels, strek: kontur, bredde: 9 });
  mal(ctx, ellipse(cx, 810, 96, 120), { fyll: pelsLys });

  // Forpoter.
  for (const s of [-1, 1]) {
    mal(ctx, ellipse(cx + s * 78, 888, 62, 38), { fyll: pelsLys, strek: kontur, bredde: 7 });
    for (let i = -1; i <= 1; i++) {
      strek(ctx, [[cx + s * 78 + i * 22, 876], [cx + s * 78 + i * 22, 902]], kontur, 5);
    }
  }

  // Ører bak hodet.
  for (const s of [-1, 1]) {
    mal(ctx, polygon([[cx + s * 66, 334], [cx + s * 128, 198], [cx + s * 176, 336]]),
      { fyll: pels, strek: kontur, bredde: 8 });
    mal(ctx, polygon([[cx + s * 90, 322], [cx + s * 128, 242], [cx + s * 152, 324]]),
      { fyll: hsl(340, 62, 78) });
  }

  // Hode.
  mal(ctx, ellipse(cx, 396, 178, 158), { fyll: pels, strek: kontur, bredde: 9 });
  mal(ctx, ellipse(cx, 448, 110, 86), { fyll: pelsLys });

  // Striper.
  for (let i = -1; i <= 1; i++) {
    strek(ctx, [[cx + i * 46, 268], [cx + i * 54, 320]], hsl(hue, metning, lys - 24), 11);
  }

  // Øyne.
  for (const s of [-1, 1]) {
    mal(ctx, ellipse(cx + s * 66, 386, 40, 44), { fyll: hsl(0, 0, 100), strek: kontur, bredde: 6 });
    mal(ctx, ellipse(cx + s * 66, 388, 22, 34), { fyll: hsl(rng.pick([96, 44, 200]), 70, 44) });
    mal(ctx, ellipse(cx + s * 66, 388, 9, 26), { fyll: KONTUR });
    mal(ctx, sirkel(cx + s * 66 - 9, 374, 8), { fyll: hsl(0, 0, 100) });
  }

  // Snute.
  mal(ctx, polygon([[cx - 20, 458], [cx + 20, 458], [cx, 480]]),
    { fyll: hsl(340, 70, 70), strek: kontur, bredde: 5 });
  strek(ctx, [[cx, 480], [cx, 498]], kontur, 5);
  const munn = new Path2D();
  munn.moveTo(cx - 44, 512);
  munn.quadraticCurveTo(cx, 534, cx, 498);
  munn.quadraticCurveTo(cx, 534, cx + 44, 512);
  mal(ctx, munn, { strek: kontur, bredde: 6 });

  // Værhår.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      strek(ctx, [[cx + s * 30, 474 + i * 16], [cx + s * 220, 442 + i * 40]], hsl(0, 0, 100, 0.9), 5);
    }
  }
  ctx.restore();
}

function sceneKatt(ctx, rng) {
  himmel(ctx, rng, { topp: 196 });
  sol(ctx, rng.range(140, 380), rng.range(110, 200), 60, 50);
  skyer(ctx, rng, rng.int(3, 5));
  aser(ctx, rng, 126);
  bakke(ctx, rng, 116);
  lovtre(ctx, rng.range(1240, 1450), rng.range(860, 940), rng.range(300, 400), rng, rng.pick([132, 110]));
  tegnKatt(ctx, rng);
  markdetaljer(ctx, rng, { tuster: 28, blomster: 18, steiner: 6, hue: 116 });
  for (let i = 0, n = rng.int(2, 4); i < n; i++) {
    sommerfugl(ctx, rng.range(150, DESIGN_B - 150), rng.range(260, 640), rng.range(28, 44),
      rng.pick([320, 46, 280, 196]));
  }
}

// ===========================================================================

export const SCENER = {
  dinosaur: { navn: 'Dinosaur', tegn: sceneDinosaur },
  hus: { navn: 'Hus', tegn: sceneHus },
  bil: { navn: 'Bil', tegn: sceneBil },
  rakett: { navn: 'Rakett', tegn: sceneRakett },
  bat: { navn: 'Seilbåt', tegn: sceneBat },
  katt: { navn: 'Katt', tegn: sceneKatt },
};

/** Tegner en scene i designrommet og skalerer til ønsket bildestørrelse. */
export function genererScene(nokkel, bredde, hoyde, seed) {
  const scene = SCENER[nokkel];
  if (!scene) throw new Error('Ukjent scene: ' + nokkel);
  const rng = makeRng(seed);

  const canvas = document.createElement('canvas');
  canvas.width = bredde;
  canvas.height = hoyde;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  ctx.save();
  ctx.scale(bredde / DESIGN_B, hoyde / DESIGN_H);
  scene.tegn(ctx, rng);
  ctx.restore();

  return { canvas, meta: { stil: nokkel, navn: scene.navn, seed } };
}
