// Seks motiv laget for å PUSLES av barn.
//
// Romscenen avslørte problemet: store felt som ser like ut er umulige når
// brikketallet stiger. Et barn som sitter med tjue nesten identiske mørkeblå
// brikker gir opp.
//
// Svaret her er strukturelt, ikke kunstnerisk. `strOverAlt()` går gjennom et
// rutenett over HELE flaten og tegner noe i hver eneste celle. Ingen celle
// kan bli tom, og ingen brikke kan bli uten et kjennemerke. Scenene er
// bygget rundt den regelen i stedet for å håpe på den.

import { makeRng } from '../core/rng.js';
import {
  DESIGN_B, DESIGN_H, hsl, sirkel, ellipse, rundetRekt, polygon,
  bezierPunkter, taperetBane, stjerne, mal, strek, loddrettGradient,
} from './tegning.js';
import {
  KONTUR, HORISONT, himmel, sol, skyer, fugler, aser, bakke,
  gresstust, blomst, lovtre,
} from './scener.js';

/**
 * Tegner noe i hver celle i et rutenett over flaten.
 *
 * Dette er hele poenget med disse motivene. Posisjonen får en slump innenfor
 * cellen, så det ikke ser oppstilt ut, men ingen celle slipper unna.
 *
 * @param {(ctx, x, y, s, i) => void} tegn kalles én gang per celle
 */
function strOverAlt(ctx, rng, { kolonner, rader, tegn, omrade, slark = 0.34, storrelse = [1, 1] }) {
  const o = omrade || { x: 0, y: 0, w: DESIGN_B, h: DESIGN_H };
  const cw = o.w / kolonner;
  const ch = o.h / rader;
  let i = 0;
  for (let r = 0; r < rader; r++) {
    for (let c = 0; c < kolonner; c++) {
      const x = o.x + (c + 0.5) * cw + rng.range(-slark, slark) * cw;
      const y = o.y + (r + 0.5) * ch + rng.range(-slark, slark) * ch;
      const s = Math.min(cw, ch) * rng.range(storrelse[0], storrelse[1]);
      tegn(ctx, x, y, s, i++);
    }
  }
}

/**
 * Mark i fargede bånd fra en valgt horisont og ned.
 *
 * De delte kulissene legger horisonten på to tredjedeler ned. Det er fint
 * for ett stort motiv, men gir en stor, tom himmel – og tom himmel er
 * nettopp det som gjør et puslespill vanskelig. Her bestemmer hver scene
 * sin egen horisont, og setter den høyt.
 */
function markIBand(ctx, rng, horisont, hue, band = 4) {
  for (let i = 0; i < band; i++) {
    const y = horisont + i * ((DESIGN_H - horisont) / band);
    const p = new Path2D();
    p.moveTo(-20, y);
    p.quadraticCurveTo(DESIGN_B / 2, y - rng.range(14, 54), DESIGN_B + 20, y);
    p.lineTo(DESIGN_B + 20, DESIGN_H);
    p.lineTo(-20, DESIGN_H);
    p.closePath();
    mal(ctx, p, { fyll: hsl(hue + i * 7, 52, 50 - i * 5) });
  }
}

/** Luftballong – et stort kjennemerke midt i himmelen. */
function luftballong(ctx, x, y, s, rng) {
  const hues = [rng.pick([348, 18, 46]), rng.pick([196, 276, 150])];
  const kule = new Path2D();
  kule.moveTo(x, y + s * 0.95);
  kule.bezierCurveTo(x - s * 0.95, y + s * 0.3, x - s * 0.8, y - s, x, y - s);
  kule.bezierCurveTo(x + s * 0.8, y - s, x + s * 0.95, y + s * 0.3, x, y + s * 0.95);
  mal(ctx, kule, { fyll: hsl(hues[0], 85, 64), strek: KONTUR, bredde: 7 });
  ctx.save();
  ctx.clip(kule);
  for (let i = -2; i <= 2; i++) {
    mal(ctx, ellipse(x + i * s * 0.44, y, s * 0.17, s * 1.2),
      { fyll: hsl(hues[(i + 2) % 2], 85, i % 2 ? 56 : 74) });
  }
  ctx.restore();
  strek(ctx, [[x - s * 0.3, y + s * 0.85], [x - s * 0.18, y + s * 1.35]], KONTUR, 5);
  strek(ctx, [[x + s * 0.3, y + s * 0.85], [x + s * 0.18, y + s * 1.35]], KONTUR, 5);
  mal(ctx, rundetRekt(x - s * 0.22, y + s * 1.32, s * 0.44, s * 0.34, 6),
    { fyll: hsl(32, 55, 46), strek: KONTUR, bredde: 6 });
}

/** Vindmølle – høy, tydelig, og deler himmelen i to. */
function vindmolle(ctx, x, bunnY, h, rng) {
  mal(ctx, polygon([[x - h * 0.1, bunnY], [x - h * 0.05, bunnY - h], [x + h * 0.05, bunnY - h], [x + h * 0.1, bunnY]]),
    { fyll: hsl(210, 14, 88), strek: KONTUR, bredde: 7 });
  const nav = { x, y: bunnY - h };
  const v0 = rng.range(0, Math.PI);
  for (let i = 0; i < 4; i++) {
    const v = v0 + (i / 4) * Math.PI * 2;
    ctx.save();
    ctx.translate(nav.x, nav.y);
    ctx.rotate(v);
    mal(ctx, polygon([[0, 0], [h * 0.44, -h * 0.07], [h * 0.46, h * 0.05], [0, h * 0.04]]),
      { fyll: hsl(46, 85, 72), strek: KONTUR, bredde: 6 });
    ctx.restore();
  }
  mal(ctx, sirkel(nav.x, nav.y, h * 0.05), { fyll: hsl(210, 14, 70), strek: KONTUR, bredde: 5 });
}

/** Lite øye som gjenbrukes av alle dyrene. */
function oye(ctx, x, y, r) {
  mal(ctx, sirkel(x, y, r), { fyll: '#fff', strek: KONTUR, bredde: r * 0.5 });
  mal(ctx, sirkel(x + r * 0.15, y, r * 0.5), { fyll: KONTUR });
}

// ===========================================================================
// 1. Bondegård
// ===========================================================================

function ku(ctx, x, y, s) {
  const b = s * 1.5;
  mal(ctx, rundetRekt(x - b / 2, y - s * 0.38, b, s * 0.72, s * 0.3),
    { fyll: '#fdfdfd', strek: KONTUR, bredde: s * 0.07 });
  for (const [dx, dy, r] of [[-0.3, -0.1, 0.2], [0.18, 0.1, 0.16], [0.4, -0.18, 0.12]]) {
    mal(ctx, ellipse(x + dx * b, y + dy * s, r * s, r * s * 0.8), { fyll: '#2b2b33' });
  }
  for (const dx of [-0.32, -0.1, 0.12, 0.34]) {
    mal(ctx, rundetRekt(x + dx * b, y + s * 0.3, s * 0.13, s * 0.4, s * 0.06),
      { fyll: '#fdfdfd', strek: KONTUR, bredde: s * 0.06 });
  }
  mal(ctx, ellipse(x - b * 0.56, y - s * 0.3, s * 0.3, s * 0.27),
    { fyll: '#fdfdfd', strek: KONTUR, bredde: s * 0.07 });
  mal(ctx, ellipse(x - b * 0.66, y - s * 0.22, s * 0.16, s * 0.12), { fyll: '#ffb3c6' });
  oye(ctx, x - b * 0.58, y - s * 0.38, s * 0.07);
}

function gris(ctx, x, y, s) {
  const b = s * 1.3;
  mal(ctx, ellipse(x, y, b * 0.5, s * 0.36), { fyll: '#ff9fb8', strek: KONTUR, bredde: s * 0.07 });
  for (const dx of [-0.26, -0.06, 0.14, 0.32]) {
    mal(ctx, rundetRekt(x + dx * b, y + s * 0.24, s * 0.12, s * 0.3, s * 0.05),
      { fyll: '#ff9fb8', strek: KONTUR, bredde: s * 0.06 });
  }
  mal(ctx, ellipse(x - b * 0.48, y - s * 0.1, s * 0.26, s * 0.24),
    { fyll: '#ffb0c6', strek: KONTUR, bredde: s * 0.07 });
  mal(ctx, ellipse(x - b * 0.6, y - s * 0.06, s * 0.13, s * 0.1),
    { fyll: '#ff7fa3', strek: KONTUR, bredde: s * 0.05 });
  mal(ctx, polygon([[x - b * 0.52, y - s * 0.3], [x - b * 0.42, y - s * 0.44], [x - b * 0.36, y - s * 0.26]]),
    { fyll: '#ff8fae', strek: KONTUR, bredde: s * 0.05 });
  oye(ctx, x - b * 0.44, y - s * 0.16, s * 0.06);
  strek(ctx, [[x + b * 0.46, y - s * 0.1], [x + b * 0.58, y - s * 0.24], [x + b * 0.5, y - s * 0.34]],
    '#ff7fa3', s * 0.07);
}

function sau(ctx, x, y, s) {
  const p = new Path2D();
  for (const [dx, dy, r] of [[0, 0, 0.42], [-0.34, 0.06, 0.32], [0.34, 0.04, 0.3], [-0.16, -0.26, 0.3], [0.18, -0.24, 0.28]]) {
    p.addPath(sirkel(x + dx * s * 1.4, y + dy * s, r * s));
  }
  mal(ctx, p, { fyll: '#fbfbf6', strek: KONTUR, bredde: s * 0.07 });
  for (const dx of [-0.3, -0.1, 0.12, 0.3]) {
    mal(ctx, rundetRekt(x + dx * s * 1.4, y + s * 0.3, s * 0.1, s * 0.3, s * 0.05), { fyll: '#3a3a46' });
  }
  mal(ctx, ellipse(x - s * 0.74, y - s * 0.16, s * 0.22, s * 0.25),
    { fyll: '#3a3a46', strek: KONTUR, bredde: s * 0.05 });
  oye(ctx, x - s * 0.8, y - s * 0.2, s * 0.06);
}

function hone(ctx, x, y, s) {
  mal(ctx, ellipse(x, y, s * 0.36, s * 0.3), { fyll: '#fff6ea', strek: KONTUR, bredde: s * 0.07 });
  mal(ctx, ellipse(x - s * 0.3, y - s * 0.26, s * 0.2, s * 0.2),
    { fyll: '#fff6ea', strek: KONTUR, bredde: s * 0.06 });
  mal(ctx, polygon([[x - s * 0.38, y - s * 0.42], [x - s * 0.3, y - s * 0.56], [x - s * 0.22, y - s * 0.42]]),
    { fyll: '#e23c4e', strek: KONTUR, bredde: s * 0.05 });
  mal(ctx, polygon([[x - s * 0.48, y - s * 0.24], [x - s * 0.62, y - s * 0.18], [x - s * 0.48, y - s * 0.14]]),
    { fyll: '#f5a524' });
  mal(ctx, ellipse(x + s * 0.08, y, s * 0.2, s * 0.16, 0.3), { fyll: '#f0dcc0' });
  for (const dx of [-0.1, 0.12]) strek(ctx, [[x + dx * s, y + s * 0.28], [x + dx * s, y + s * 0.46]], '#f5a524', s * 0.06);
  oye(ctx, x - s * 0.34, y - s * 0.3, s * 0.055);
}

function lave(ctx, x, bunnY, b) {
  const h = b * 0.95;
  mal(ctx, rundetRekt(x - b / 2, bunnY - h, b, h * 0.62, 6),
    { fyll: '#c0392b', strek: KONTUR, bredde: 7 });
  mal(ctx, polygon([[x - b * 0.58, bunnY - h * 0.6], [x, bunnY - h * 1.06], [x + b * 0.58, bunnY - h * 0.6]]),
    { fyll: '#8e2b22', strek: KONTUR, bredde: 7 });
  mal(ctx, rundetRekt(x - b * 0.17, bunnY - h * 0.5, b * 0.34, h * 0.5, 4),
    { fyll: '#f3e7d4', strek: KONTUR, bredde: 6 });
  strek(ctx, [[x - b * 0.17, bunnY - h * 0.5], [x + b * 0.17, bunnY - h * 0.12]], '#c0392b', 5);
  strek(ctx, [[x + b * 0.17, bunnY - h * 0.5], [x - b * 0.17, bunnY - h * 0.12]], '#c0392b', 5);
  mal(ctx, sirkel(x, bunnY - h * 0.76, b * 0.09), { fyll: '#f3e7d4', strek: KONTUR, bredde: 5 });
}

function hoyballe(ctx, x, y, s) {
  mal(ctx, ellipse(x, y, s * 0.44, s * 0.38), { fyll: '#e8c468', strek: '#a8832c', bredde: s * 0.08 });
  for (const r of [0.3, 0.17]) mal(ctx, ellipse(x, y, s * 0.44 * r * 1.6, s * 0.38 * r * 1.6), { strek: '#c7a243', bredde: s * 0.05 });
}

function sceneBondegard(ctx, rng) {
  // Horisonten ligger høyt: himmelen skal ikke bli et stort, likt felt.
  const horisont = DESIGN_H * 0.38;
  himmel(ctx, rng, { topp: 203 });
  sol(ctx, rng.range(150, 380), rng.range(80, 140), 58, 46);
  skyer(ctx, rng, rng.int(4, 6));
  fugler(ctx, rng, rng.int(3, 5));
  luftballong(ctx, rng.range(950, 1400), rng.range(120, 230), rng.range(85, 115), rng);
  markIBand(ctx, rng, horisont, 102, 5);

  vindmolle(ctx, rng.range(180, 420), horisont + 40, rng.range(300, 380), rng);
  lave(ctx, rng.range(1080, 1340), horisont + 120, rng.range(300, 370));
  lovtre(ctx, rng.range(560, 820), horisont + 70, rng.range(210, 270), rng, 128);

  // Gjerde tvers over, som deler flaten i to lesbare bånd.
  const gy = horisont + 150;
  strek(ctx, [[0, gy], [DESIGN_B, gy]], '#d9c9a6', 11);
  strek(ctx, [[0, gy + 34], [DESIGN_B, gy + 34]], '#d9c9a6', 11);
  for (let x = 20; x < DESIGN_B; x += 150) {
    mal(ctx, rundetRekt(x, gy - 34, 20, 100, 5), { fyll: '#e7dcc2', strek: KONTUR, bredde: 5 });
  }

  // Dyr og ting i hver celle – ingen flekk av gresset blir tom.
  const dyr = [ku, gris, sau, hone, hoyballe];
  strOverAlt(ctx, rng, {
    kolonner: 5, rader: 3, storrelse: [0.72, 1.0],
    omrade: { x: 40, y: gy + 60, w: DESIGN_B - 80, h: DESIGN_H - gy - 90 },
    tegn: (c, x, y, s, i) => dyr[(i + rng.int(0, 4)) % dyr.length](c, x, y, s),
  });

  strOverAlt(ctx, rng, {
    kolonner: 9, rader: 4, storrelse: [0.3, 0.55], slark: 0.42,
    omrade: { x: 0, y: horisont + 20, w: DESIGN_B, h: DESIGN_H - horisont - 20 },
    tegn: (c, x, y, s, i) => (i % 2
      ? blomst(c, x, y, s * 0.6, rng.pick([348, 46, 276, 20]))
      : gresstust(c, x, y, s * 0.9, 100)),
  });
}

// ===========================================================================
// 2. Under vann
// ===========================================================================

function fisk(ctx, x, y, s, hue) {
  const retning = Math.random() < 0.5 ? 1 : -1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(retning, 1);
  mal(ctx, ellipse(0, 0, s * 0.5, s * 0.33), { fyll: hsl(hue, 85, 60), strek: KONTUR, bredde: s * 0.07 });
  mal(ctx, polygon([[s * 0.42, 0], [s * 0.78, -s * 0.3], [s * 0.72, 0], [s * 0.78, s * 0.3]]),
    { fyll: hsl(hue, 80, 48), strek: KONTUR, bredde: s * 0.06 });
  mal(ctx, polygon([[-s * 0.1, -s * 0.3], [s * 0.08, -s * 0.56], [s * 0.2, -s * 0.28]]),
    { fyll: hsl(hue, 80, 52), strek: KONTUR, bredde: s * 0.05 });
  for (let i = 0; i < 3; i++) {
    mal(ctx, ellipse(-s * 0.1 + i * s * 0.18, 0, s * 0.05, s * 0.26),
      { fyll: hsl(hue + 18, 80, 72, 0.8) });
  }
  oye(ctx, -s * 0.28, -s * 0.07, s * 0.07);
  ctx.restore();
}

function tare(ctx, x, bunnY, h, rng, hue) {
  const kurve = bezierPunkter([x, bunnY], [x + rng.range(-60, 60), bunnY - h * 0.4],
    [x + rng.range(-70, 70), bunnY - h * 0.7], [x + rng.range(-40, 40), bunnY - h], 26);
  mal(ctx, taperetBane(kurve, (t) => h * (0.1 - t * 0.055)),
    { fyll: hsl(hue, 60, 34), strek: hsl(hue, 60, 22), bredde: 5 });
  for (let i = 3; i < kurve.length; i += 5) {
    const p = kurve[i];
    mal(ctx, ellipse(p.x + (i % 2 ? 1 : -1) * h * 0.08, p.y, h * 0.09, h * 0.035, i % 2 ? 0.5 : -0.5),
      { fyll: hsl(hue + 10, 62, 42) });
  }
}

function korall(ctx, x, bunnY, s, hue) {
  for (let i = -1; i <= 1; i++) {
    const gren = taperetBane(
      bezierPunkter([x, bunnY], [x + i * s * 0.3, bunnY - s * 0.4],
        [x + i * s * 0.6, bunnY - s * 0.6], [x + i * s * 0.75, bunnY - s * 0.95], 20),
      (t) => s * (0.2 - t * 0.12));
    mal(ctx, gren, { fyll: hsl(hue, 78, 62), strek: hsl(hue, 70, 40), bredde: 5 });
  }
  mal(ctx, sirkel(x, bunnY - s * 0.1, s * 0.2), { fyll: hsl(hue + 14, 78, 56), strek: hsl(hue, 70, 38), bredde: 5 });
}

function sceneUndervann(ctx, rng) {
  // Vannet har bånd, ikke én flat farge.
  ctx.fillStyle = loddrettGradient(ctx, 0, DESIGN_H, [
    [0, hsl(192, 82, 62)], [0.45, hsl(200, 78, 46)], [1, hsl(214, 72, 28)],
  ]);
  ctx.fillRect(0, 0, DESIGN_B, DESIGN_H);

  // Lysstråler ovenfra gir de øvre brikkene retning.
  for (let i = 0; i < 7; i++) {
    const x = rng.range(-100, DESIGN_B);
    mal(ctx, polygon([[x, -20], [x + rng.range(60, 130), -20],
      [x + rng.range(180, 340), DESIGN_H * 0.72], [x + rng.range(60, 160), DESIGN_H * 0.72]]),
      { fyll: hsl(190, 90, 86, 0.11) });
  }

  // Sandbunn med rygger.
  const sandY = DESIGN_H * 0.8;
  const sand = new Path2D();
  sand.moveTo(-20, DESIGN_H);
  sand.lineTo(-20, sandY);
  for (let i = 0; i <= 6; i++) {
    sand.quadraticCurveTo(i * 280 - 140, sandY + rng.range(-60, 30), i * 280, sandY + rng.range(-20, 40));
  }
  sand.lineTo(DESIGN_B + 20, DESIGN_H);
  sand.closePath();
  mal(ctx, sand, { fyll: hsl(44, 62, 76), strek: hsl(40, 50, 58), bredde: 6 });

  for (let i = 0, n = rng.int(7, 10); i < n; i++) {
    tare(ctx, rng.range(20, DESIGN_B - 20), rng.range(sandY + 10, DESIGN_H), rng.range(220, 420), rng,
      rng.pick([128, 152, 96]));
  }
  for (let i = 0, n = rng.int(5, 8); i < n; i++) {
    korall(ctx, rng.range(40, DESIGN_B - 40), rng.range(sandY + 30, DESIGN_H - 10), rng.range(110, 190),
      rng.pick([340, 20, 280, 50]));
  }

  // Fisk i hver eneste celle over hele flaten.
  const hues = [10, 40, 60, 140, 190, 280, 320];
  strOverAlt(ctx, rng, {
    kolonner: 6, rader: 4, storrelse: [0.45, 0.85],
    omrade: { x: 30, y: 20, w: DESIGN_B - 60, h: sandY - 20 },
    tegn: (c, x, y, s, i) => fisk(c, x, y, s, hues[(i * 3 + rng.int(0, 2)) % hues.length]),
  });

  // Bobler og sjøstjerner som ekstra kjennemerker.
  strOverAlt(ctx, rng, {
    kolonner: 8, rader: 5, storrelse: [0.12, 0.3], slark: 0.45,
    tegn: (c, x, y, s) => mal(c, sirkel(x, y, s), { strek: hsl(190, 90, 92, 0.6), bredde: 3 }),
  });
  for (let i = 0, n = rng.int(3, 5); i < n; i++) {
    mal(ctx, stjerne(rng.range(60, DESIGN_B - 60), rng.range(sandY + 20, DESIGN_H - 20), rng.range(34, 54), 5, 0.45),
      { fyll: hsl(rng.pick([20, 340, 46]), 85, 62), strek: KONTUR, bredde: 6 });
  }
}

// ===========================================================================
// 3. Jungel
// ===========================================================================

function blad(ctx, x, y, s, vinkel, hue) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(vinkel);
  mal(ctx, ellipse(0, 0, s * 0.5, s * 0.22), { fyll: hsl(hue, 55, 38), strek: hsl(hue, 58, 22), bredde: s * 0.05 });
  strek(ctx, [[-s * 0.46, 0], [s * 0.46, 0]], hsl(hue, 50, 26), s * 0.035);
  for (let i = -2; i <= 2; i++) {
    strek(ctx, [[i * s * 0.16, 0], [i * s * 0.16 + s * 0.08, -s * 0.16]], hsl(hue, 50, 26), s * 0.03);
    strek(ctx, [[i * s * 0.16, 0], [i * s * 0.16 + s * 0.08, s * 0.16]], hsl(hue, 50, 26), s * 0.03);
  }
  ctx.restore();
}

function ape(ctx, x, y, s) {
  mal(ctx, taperetBane(bezierPunkter([x + s * 0.3, y + s * 0.2], [x + s * 0.9, y + s * 0.4],
    [x + s * 1.0, y - s * 0.3], [x + s * 0.6, y - s * 0.55], 24), (t) => s * (0.14 - t * 0.08)),
    { fyll: '#8b5a2b', strek: KONTUR, bredde: s * 0.05 });
  mal(ctx, ellipse(x, y + s * 0.2, s * 0.32, s * 0.36), { fyll: '#8b5a2b', strek: KONTUR, bredde: s * 0.07 });
  for (const d of [-1, 1]) {
    mal(ctx, ellipse(x + d * s * 0.42, y - s * 0.28, s * 0.14, s * 0.14),
      { fyll: '#8b5a2b', strek: KONTUR, bredde: s * 0.06 });
  }
  mal(ctx, sirkel(x, y - s * 0.26, s * 0.32), { fyll: '#a06a35', strek: KONTUR, bredde: s * 0.07 });
  mal(ctx, ellipse(x, y - s * 0.16, s * 0.22, s * 0.17), { fyll: '#e2c08a' });
  oye(ctx, x - s * 0.11, y - s * 0.32, s * 0.07);
  oye(ctx, x + s * 0.11, y - s * 0.32, s * 0.07);
  mal(ctx, ellipse(x, y - s * 0.12, s * 0.05, s * 0.035), { fyll: KONTUR });
}

function papegoye(ctx, x, y, s) {
  mal(ctx, polygon([[x + s * 0.1, y], [x + s * 0.75, y - s * 0.22], [x + s * 0.5, y + s * 0.3]]),
    { fyll: hsl(205, 85, 52), strek: KONTUR, bredde: s * 0.05 });
  mal(ctx, ellipse(x, y, s * 0.3, s * 0.36), { fyll: '#e23c4e', strek: KONTUR, bredde: s * 0.06 });
  mal(ctx, ellipse(x - s * 0.08, y + s * 0.05, s * 0.2, s * 0.26), { fyll: hsl(46, 95, 60) });
  mal(ctx, sirkel(x - s * 0.1, y - s * 0.34, s * 0.2), { fyll: '#e23c4e', strek: KONTUR, bredde: s * 0.06 });
  mal(ctx, polygon([[x - s * 0.24, y - s * 0.34], [x - s * 0.46, y - s * 0.26], [x - s * 0.24, y - s * 0.2]]),
    { fyll: hsl(36, 95, 56), strek: KONTUR, bredde: s * 0.05 });
  oye(ctx, x - s * 0.1, y - s * 0.38, s * 0.06);
}

function sceneJungel(ctx, rng) {
  ctx.fillStyle = loddrettGradient(ctx, 0, DESIGN_H, [
    [0, hsl(150, 55, 30)], [0.5, hsl(132, 48, 38)], [1, hsl(100, 45, 26)],
  ]);
  ctx.fillRect(0, 0, DESIGN_B, DESIGN_H);

  // Stammer deler flaten i loddrette soner.
  for (let i = 0, n = rng.int(3, 5); i < n; i++) {
    const x = rng.range(60, DESIGN_B - 60);
    mal(ctx, taperetBane(bezierPunkter([x, DESIGN_H + 20], [x + rng.range(-40, 40), DESIGN_H * 0.6],
      [x + rng.range(-50, 50), DESIGN_H * 0.3], [x + rng.range(-30, 30), -20], 24), () => rng.range(70, 110)),
      { fyll: hsl(28, 38, 34), strek: hsl(26, 40, 20), bredde: 7 });
  }

  // Blader overalt – dette er det som holder brikkene fra hverandre.
  const gronne = [96, 118, 136, 152, 84];
  strOverAlt(ctx, rng, {
    kolonner: 7, rader: 5, storrelse: [0.8, 1.5], slark: 0.4,
    tegn: (c, x, y, s, i) => blad(c, x, y, s, rng.range(0, Math.PI * 2), gronne[i % gronne.length]),
  });

  // Blomster som fargeklatter.
  strOverAlt(ctx, rng, {
    kolonner: 5, rader: 4, storrelse: [0.2, 0.36], slark: 0.45,
    tegn: (c, x, y, s) => {
      const hue = rng.pick([340, 20, 46, 288]);
      for (let k = 0; k < 5; k++) {
        const v = (k / 5) * Math.PI * 2;
        mal(c, ellipse(x + Math.cos(v) * s * 0.5, y + Math.sin(v) * s * 0.5, s * 0.4, s * 0.28, v),
          { fyll: hsl(hue, 88, 68), strek: hsl(hue, 70, 44), bredde: 4 });
      }
      mal(c, sirkel(x, y, s * 0.3), { fyll: hsl(48, 95, 64), strek: KONTUR, bredde: 4 });
    },
  });

  ape(ctx, rng.range(300, 700), rng.range(420, 640), rng.range(230, 290));
  papegoye(ctx, rng.range(950, 1400), rng.range(220, 520), rng.range(190, 250));
}

// ===========================================================================
// 4. Byen
// ===========================================================================

function byhus(ctx, x, bunnY, b, h, rng) {
  const hue = rng.pick([6, 34, 52, 150, 196, 268, 320]);
  const vegg = hsl(hue, 58, rng.range(58, 74));
  mal(ctx, rundetRekt(x, bunnY - h, b, h, 6), { fyll: vegg, strek: KONTUR, bredde: 7 });

  const tak = rng.int(0, 2);
  if (tak === 0) {
    mal(ctx, polygon([[x - 16, bunnY - h], [x + b / 2, bunnY - h - b * 0.42], [x + b + 16, bunnY - h]]),
      { fyll: hsl(hue - 18, 52, 40), strek: KONTUR, bredde: 7 });
  } else if (tak === 1) {
    mal(ctx, rundetRekt(x - 12, bunnY - h - 34, b + 24, 36, 6),
      { fyll: hsl(hue - 18, 52, 40), strek: KONTUR, bredde: 7 });
  } else {
    mal(ctx, polygon([[x - 10, bunnY - h], [x + b / 2, bunnY - h - b * 0.3], [x + b + 10, bunnY - h],
      [x + b + 10, bunnY - h + 18], [x - 10, bunnY - h + 18]]),
      { fyll: hsl(hue - 18, 52, 40), strek: KONTUR, bredde: 7 });
  }

  // Vinduer i rutenett – hvert hus får sitt eget mønster.
  const kol = rng.int(2, 3);
  const rad = Math.max(1, Math.round(h / 150));
  const vb = b / (kol * 2 + 1);
  const vh = Math.min(vb * 1.2, (h - 90) / (rad * 1.7));
  for (let r = 0; r < rad; r++) {
    for (let c = 0; c < kol; c++) {
      const vx = x + vb * (c * 2 + 1);
      const vy = bunnY - h + 30 + r * vh * 1.7;
      mal(ctx, rundetRekt(vx, vy, vb, vh, 4),
        { fyll: rng.bool(0.65) ? hsl(48, 95, 72) : hsl(200, 70, 72), strek: KONTUR, bredde: 5 });
      strek(ctx, [[vx + vb / 2, vy], [vx + vb / 2, vy + vh]], KONTUR, 3);
    }
  }
  mal(ctx, rundetRekt(x + b * 0.4, bunnY - 86, b * 0.22, 86, 5),
    { fyll: hsl(24, 50, 36), strek: KONTUR, bredde: 6 });
  mal(ctx, sirkel(x + b * 0.57, bunnY - 44, 6), { fyll: hsl(48, 90, 66) });
}

function bybil(ctx, x, y, s, rng) {
  const hue = rng.pick([355, 18, 210, 145, 275, 48]);
  mal(ctx, rundetRekt(x - s * 0.5, y - s * 0.22, s, s * 0.34, s * 0.14),
    { fyll: hsl(hue, 78, 56), strek: KONTUR, bredde: s * 0.05 });
  mal(ctx, rundetRekt(x - s * 0.28, y - s * 0.42, s * 0.56, s * 0.24, s * 0.1),
    { fyll: hsl(hue, 78, 62), strek: KONTUR, bredde: s * 0.05 });
  mal(ctx, rundetRekt(x - s * 0.22, y - s * 0.38, s * 0.2, s * 0.16, s * 0.05), { fyll: hsl(200, 75, 80) });
  mal(ctx, rundetRekt(x + s * 0.03, y - s * 0.38, s * 0.2, s * 0.16, s * 0.05), { fyll: hsl(200, 75, 80) });
  for (const dx of [-0.28, 0.28]) {
    mal(ctx, sirkel(x + dx * s, y + s * 0.14, s * 0.12), { fyll: '#20222e', strek: KONTUR, bredde: s * 0.04 });
    mal(ctx, sirkel(x + dx * s, y + s * 0.14, s * 0.05), { fyll: '#c8ccda' });
  }
}

function sceneByen(ctx, rng) {
  himmel(ctx, rng, { topp: 206 });
  sol(ctx, rng.range(1100, 1460), rng.range(100, 180), 60, 48);
  skyer(ctx, rng, rng.int(3, 5));
  fugler(ctx, rng, rng.int(2, 4));

  const gateY = DESIGN_H * 0.84;

  // Husrekke: hvert hus er sin egen, tydelige sone.
  let x = -30;
  while (x < DESIGN_B + 20) {
    const b = rng.range(170, 250);
    byhus(ctx, x, gateY, b, rng.range(300, 520), rng);
    x += b + rng.range(10, 26);
  }

  // Fortau og gate.
  mal(ctx, rundetRekt(-20, gateY, DESIGN_B + 40, 36, 0), { fyll: hsl(210, 14, 76), strek: KONTUR, bredde: 5 });
  mal(ctx, rundetRekt(-20, gateY + 36, DESIGN_B + 40, DESIGN_H - gateY - 36, 0), { fyll: hsl(220, 12, 34) });
  for (let gx = -40; gx < DESIGN_B; gx += 170) {
    mal(ctx, rundetRekt(gx, gateY + 92, 94, 15, 7), { fyll: hsl(52, 92, 72) });
  }

  // Trær og lyktestolper mellom husene.
  strOverAlt(ctx, rng, {
    kolonner: 6, rader: 1, storrelse: [0.7, 1],
    omrade: { x: 0, y: gateY - 60, w: DESIGN_B, h: 60 },
    tegn: (c, px, py, s, i) => {
      if (i % 2) {
        lovtre(c, px, gateY + 20, rng.range(150, 210), rng, rng.pick([128, 108, 146]));
      } else {
        strek(c, [[px, gateY + 20], [px, gateY - 150]], hsl(220, 12, 42), 11);
        mal(c, ellipse(px, gateY - 162, 26, 20), { fyll: hsl(50, 95, 72), strek: KONTUR, bredde: 5 });
      }
    },
  });

  for (let i = 0, n = rng.int(3, 4); i < n; i++) {
    bybil(ctx, rng.range(120, DESIGN_B - 120), gateY + rng.range(60, 130), rng.range(190, 250), rng);
  }
}

// ===========================================================================
// 5. Blomstereng
// ===========================================================================

function sommerfuglLiten(ctx, x, y, s, hue) {
  for (const d of [-1, 1]) {
    mal(ctx, ellipse(x + d * s * 0.3, y - s * 0.1, s * 0.3, s * 0.22, d * 0.5),
      { fyll: hsl(hue, 88, 68), strek: KONTUR, bredde: s * 0.06 });
    mal(ctx, ellipse(x + d * s * 0.24, y + s * 0.2, s * 0.22, s * 0.16, -d * 0.4),
      { fyll: hsl(hue + 24, 88, 74), strek: KONTUR, bredde: s * 0.06 });
  }
  mal(ctx, rundetRekt(x - s * 0.05, y - s * 0.28, s * 0.1, s * 0.6, s * 0.05), { fyll: KONTUR });
}

function marihone(ctx, x, y, s) {
  mal(ctx, ellipse(x, y, s * 0.4, s * 0.34), { fyll: '#e23c4e', strek: KONTUR, bredde: s * 0.07 });
  strek(ctx, [[x, y - s * 0.34], [x, y + s * 0.34]], KONTUR, s * 0.06);
  for (const [dx, dy] of [[-0.2, -0.12], [0.18, -0.14], [-0.16, 0.14], [0.2, 0.1]]) {
    mal(ctx, sirkel(x + dx * s, y + dy * s, s * 0.07), { fyll: KONTUR });
  }
  mal(ctx, sirkel(x - s * 0.38, y - s * 0.06, s * 0.17), { fyll: KONTUR });
}

function bie(ctx, x, y, s) {
  mal(ctx, ellipse(x, y, s * 0.36, s * 0.26), { fyll: hsl(48, 95, 62), strek: KONTUR, bredde: s * 0.07 });
  for (const dx of [-0.1, 0.12]) strek(ctx, [[x + dx * s, y - s * 0.22], [x + dx * s, y + s * 0.22]], KONTUR, s * 0.09);
  for (const d of [-1, 1]) {
    mal(ctx, ellipse(x - s * 0.02, y - s * 0.26, s * 0.22, s * 0.12, d * 0.5),
      { fyll: hsl(195, 80, 92, 0.85), strek: KONTUR, bredde: s * 0.05 });
  }
  mal(ctx, sirkel(x + s * 0.38, y - s * 0.02, s * 0.14), { fyll: KONTUR });
}

function storBlomst(ctx, x, y, s, hue, kronblad) {
  for (let i = 0; i < kronblad; i++) {
    const v = (i / kronblad) * Math.PI * 2;
    mal(ctx, ellipse(x + Math.cos(v) * s * 0.52, y + Math.sin(v) * s * 0.52, s * 0.42, s * 0.26, v),
      { fyll: hsl(hue, 88, 68), strek: hsl(hue, 72, 44), bredde: 5 });
  }
  mal(ctx, sirkel(x, y, s * 0.3), { fyll: hsl(46, 95, 60), strek: hsl(38, 80, 42), bredde: 5 });
  for (let i = 0; i < 7; i++) {
    const v = rng2.range(0, Math.PI * 2);
    mal(ctx, sirkel(x + Math.cos(v) * s * 0.16, y + Math.sin(v) * s * 0.16, s * 0.04), { fyll: hsl(32, 85, 44) });
  }
}

let rng2 = makeRng('blomst');

function sceneBlomstereng(ctx, rng) {
  rng2 = rng;
  himmel(ctx, rng, { topp: 199 });
  sol(ctx, rng.range(160, 420), rng.range(100, 180), 66, 48);
  skyer(ctx, rng, rng.int(3, 5));
  fugler(ctx, rng, rng.int(2, 4));
  luftballong(ctx, rng.range(1050, 1420), rng.range(110, 200), rng.range(70, 95), rng);

  // Enga starter høyt oppe, så blomstene får mest mulig av flaten.
  const engY = DESIGN_H * 0.34;
  markIBand(ctx, rng, engY, 100, 5);

  lovtre(ctx, rng.range(1250, 1460), engY + 110, rng.range(250, 310), rng, 132);

  // Store blomster i hver celle over hele enga.
  const hues = [348, 20, 46, 276, 320, 196, 0];
  strOverAlt(ctx, rng, {
    kolonner: 6, rader: 4, storrelse: [0.55, 1.0],
    omrade: { x: 20, y: engY - 30, w: DESIGN_B - 40, h: DESIGN_H - engY + 10 },
    tegn: (c, x, y, s, i) => {
      strek(c, [[x, y], [x, y + s * 1.1]], hsl(112, 55, 32), s * 0.11);
      storBlomst(c, x, y, s, hues[(i * 2 + rng.int(0, 3)) % hues.length], rng.int(5, 8));
    },
  });

  // Insekter i lufta, også i hver celle.
  strOverAlt(ctx, rng, {
    kolonner: 6, rader: 2, storrelse: [0.4, 0.65], slark: 0.4,
    omrade: { x: 40, y: 110, w: DESIGN_B - 80, h: engY - 120 },
    tegn: (c, x, y, s, i) => (i % 3 === 0
      ? bie(c, x, y, s)
      : sommerfuglLiten(c, x, y, s, rng.pick([320, 46, 196, 276, 10]))),
  });

  strOverAlt(ctx, rng, {
    kolonner: 8, rader: 2, storrelse: [0.25, 0.45], slark: 0.45,
    omrade: { x: 0, y: DESIGN_H - 170, w: DESIGN_B, h: 170 },
    tegn: (c, x, y, s, i) => (i % 4 === 0 ? marihone(c, x, y, s) : gresstust(c, x, y, s * 1.4, 102)),
  });
}

// ===========================================================================
// 6. Planetparade
// ===========================================================================

function planetDetaljert(ctx, x, y, r, rng) {
  const hue = rng.pick([18, 36, 190, 210, 280, 320, 140, 0]);
  mal(ctx, sirkel(x, y, r), { fyll: hsl(hue, 70, 58), strek: hsl(hue, 60, 30), bredde: Math.max(4, r * 0.09) });
  ctx.save();
  ctx.clip(sirkel(x, y, r));
  const type = rng.int(0, 2);
  if (type === 0) {
    for (let i = -3; i <= 3; i++) {
      mal(ctx, ellipse(x, y + i * r * 0.3, r * 1.1, r * 0.13),
        { fyll: hsl(hue + rng.range(-25, 25), 72, rng.range(40, 76), 0.9) });
    }
  } else if (type === 1) {
    for (let i = 0; i < 6; i++) {
      const v = rng.range(0, Math.PI * 2);
      const d = rng.range(0, r * 0.7);
      mal(ctx, sirkel(x + Math.cos(v) * d, y + Math.sin(v) * d, r * rng.range(0.14, 0.3)),
        { fyll: hsl(hue + rng.range(-30, 30), 68, rng.range(36, 72)) });
    }
  } else {
    mal(ctx, ellipse(x - r * 0.2, y + r * 0.3, r * 0.8, r * 0.5, -0.4), { fyll: hsl(hue + 30, 65, 46) });
    mal(ctx, ellipse(x + r * 0.35, y - r * 0.35, r * 0.5, r * 0.3, 0.5), { fyll: hsl(hue - 25, 70, 68) });
  }
  // Skyggesiden gir kula form.
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r * 1.25);
  g.addColorStop(0, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.55, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();

  if (rng.bool(0.4)) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng.range(-0.6, -0.15));
    mal(ctx, ellipse(0, 0, r * 1.75, r * 0.4), { strek: hsl(hue + 36, 78, 76), bredde: Math.max(6, r * 0.16) });
    ctx.restore();
  }
}

function komet(ctx, x, y, s, rng) {
  const hale = taperetBane(
    bezierPunkter([x, y], [x + s * 1.2, y - s * 0.4], [x + s * 2.2, y - s * 0.7], [x + s * 3, y - s * 0.8], 22),
    (t) => s * 0.6 * (1 - t) ** 1.3);
  mal(ctx, hale, { fyll: hsl(195, 95, 72, 0.5) });
  mal(ctx, sirkel(x, y, s * 0.34), { fyll: hsl(48, 100, 86), strek: hsl(30, 90, 60), bredde: 5 });
  void rng;
}

/**
 * Rommet var det vanskeligste motivet å pusle, fordi store felt var like.
 * Her er himmelen delt i fargede tåkefelt, og hver celle i et 5x4-rutenett
 * får sin egen klode. Da finnes det ikke to brikker som ser like ut.
 */
function sceneRommet(ctx, rng) {
  ctx.fillStyle = loddrettGradient(ctx, 0, DESIGN_H, [
    [0, hsl(252, 60, 14)], [0.5, hsl(276, 54, 20)], [1, hsl(300, 48, 16)],
  ]);
  ctx.fillRect(0, 0, DESIGN_B, DESIGN_H);

  // Store, fargede tåkefelt – ett per område, så bakgrunnen varierer.
  strOverAlt(ctx, rng, {
    kolonner: 4, rader: 3, storrelse: [1.1, 1.8], slark: 0.4,
    tegn: (c, x, y, s) => {
      const hue = rng.pick([196, 286, 322, 166, 40]);
      const g = c.createRadialGradient(x, y, 0, x, y, s);
      g.addColorStop(0, hsl(hue, 90, 60, 0.34));
      g.addColorStop(1, hsl(hue, 90, 60, 0));
      c.fillStyle = g;
      c.fillRect(x - s, y - s, s * 2, s * 2);
    },
  });

  // Stjerner jevnt fordelt.
  strOverAlt(ctx, rng, {
    kolonner: 16, rader: 11, storrelse: [0.04, 0.12], slark: 0.48,
    tegn: (c, x, y, s) => mal(c, sirkel(x, y, Math.max(1.4, s)),
      { fyll: hsl(rng.pick([50, 196, 0, 286]), 70, 96, rng.range(0.4, 1)) }),
  });

  // Én klode i hver celle. Dette er grepet som gjør rommet puslbart.
  strOverAlt(ctx, rng, {
    kolonner: 5, rader: 4, storrelse: [0.3, 0.46], slark: 0.26,
    omrade: { x: 30, y: 30, w: DESIGN_B - 60, h: DESIGN_H - 60 },
    tegn: (c, x, y, s) => planetDetaljert(c, x, y, s, rng),
  });

  for (let i = 0, n = rng.int(2, 3); i < n; i++) {
    komet(ctx, rng.range(100, DESIGN_B - 500), rng.range(80, DESIGN_H - 80), rng.range(40, 70), rng);
  }
  for (let i = 0, n = rng.int(4, 7); i < n; i++) {
    mal(ctx, stjerne(rng.range(40, DESIGN_B - 40), rng.range(40, DESIGN_H - 40), rng.range(16, 30), 4, 0.3),
      { fyll: hsl(52, 100, 90, 0.95) });
  }
}

// ===========================================================================

export const BARNESCENER = {
  bondegard: { navn: 'Bondegård', tegn: sceneBondegard },
  undervann: { navn: 'Under vann', tegn: sceneUndervann },
  jungel: { navn: 'Jungel', tegn: sceneJungel },
  byen: { navn: 'Byen', tegn: sceneByen },
  eng: { navn: 'Blomstereng', tegn: sceneBlomstereng },
  rommet: { navn: 'Rommet', tegn: sceneRommet },
};
