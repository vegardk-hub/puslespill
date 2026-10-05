// Seks motiv laget for å PUSLES av barn.
//
// To krav som trekker i hver sin retning:
//
//   1. Ingen store felt som ser like ut. Et barn med tjue nesten identiske
//      mørkeblå brikker gir opp.
//   2. Ingen rot. Blomster som dekker kua, blader oppå apen, blomster oppå
//      blomster – da blir bildet travelt uten å bli lesbart.
//
// Første forsøk løste bare det første, ved å strø ting i et rutenett over
// hele flaten. Men rutenettene visste ikke om hverandre, og pynten ble tegnet
// etter hovedfigurene, så den la seg oppå dem.
//
// Her er svaret todelt:
//
//   `fordel()` finner en LEDIG plass i hver celle, og melder fra om hva den
//   tok. Alt deler ett opptattkart, så ingenting havner oppå noe annet.
//
//   Tegningen skjer etterpå, sortert: først bakgrunnspynt, så figurer, og
//   innenfor hvert lag nedenfra og opp – slik at det som står nærmest også
//   står foran.

import {
  DESIGN_B, DESIGN_H, hsl, sirkel, ellipse, rundetRekt, polygon,
  bezierPunkter, taperetBane, stjerne, mal, strek, loddrettGradient,
} from './tegning.js';
import { KONTUR, himmel, sol, skyer, fugler, lovtre, gresstust } from './scener.js';

// --- Plassering ------------------------------------------------------------

/** Lag: lavere tall tegnes først, altså bakerst. */
const BAK = 0;
const MIDT = 1;
const FRONT = 2;

function nyttKart() {
  return [];
}

/**
 * To slags krav på plassen.
 *
 * Figurene - kua, apen, blomsten - krever full klaring: ingenting skal
 * legge seg oppa dem. Pynt kan derimot gjerne overlappe ANNEN pynt litt;
 * blader som ligger litt over hverandre ser ut som lov, ikke som rot.
 *
 * Forste forsok nektet all overlapping. Da ble det ryddig, men hullene
 * etter avviste celler ga store, like felt igjen - nettopp det problemet
 * disse motivene skal lose. Jungelen falt fra 86 til 59 % puslbarhet.
 */
const MYK_OVERLAPP = 0.52;

function erLedig(kart, x, y, r, mykt = false) {
  for (const t of kart) {
    const grense = (mykt && !t.hard) ? (t.r + r) * MYK_OVERLAPP : t.r + r;
    if (Math.hypot(t.x - x, t.y - y) < grense) return false;
  }
  return true;
}

function taPlass(kart, x, y, r, hard = true) {
  kart.push({ x, y, r, hard });
}

/**
 * Går gjennom et rutenett og finner en ledig plass i hver celle.
 *
 * Finnes det ingen ledig plass etter noen forsøk, hopper cellen over. Det er
 * bedre med et tomt hjørne enn to ting oppå hverandre – og de store
 * figurene er allerede plassert, så hullet er aldri der det betyr noe.
 *
 * @returns {Array} plasseringer, til tegning senere
 */
function fordel(rng, kart, plan, {
  kolonner, rader, omrade, tegn,
  storrelse = [1, 1], slark = 0.24, radius = 0.5, lag = MIDT, forsok = 6,
  mykt = false, krymp = [1, 0.8, 0.62],
}) {
  const o = omrade || { x: 0, y: 0, w: DESIGN_B, h: DESIGN_H };
  const cw = o.w / kolonner;
  const ch = o.h / rader;
  let i = 0;

  for (let r = 0; r < rader; r++) {
    for (let c = 0; c < kolonner; c++) {
      const grunn = Math.min(cw, ch) * rng.range(storrelse[0], storrelse[1]);
      let satt = false;
      // Far den ikke plass, provers en mindre utgave for cellen gis opp.
      // Et tomt hjorne er verre enn en litt mindre blomst.
      for (const k of krymp) {
        if (satt) break;
        const s = grunn * k;
        const rad = s * radius;
        for (let f = 0; f < forsok && !satt; f++) {
          const spenn = slark * (0.4 + (f / forsok) * 0.6);
          const x = o.x + (c + 0.5) * cw + rng.range(-spenn, spenn) * cw;
          const y = o.y + (r + 0.5) * ch + rng.range(-spenn, spenn) * ch;
          if (!erLedig(kart, x, y, rad, mykt)) continue;
          taPlass(kart, x, y, rad, !mykt);
          plan.push({ x, y, s, lag, nr: i, tegn });
          satt = true;
        }
      }
      i++;
    }
  }
  return plan;
}

/** Ett enkelt element på en bestemt plass, hvis det er ledig. */
function settInn(kart, plan, x, y, s, { radius = 0.5, lag = FRONT, tegn }) {
  const r = s * radius;
  if (!erLedig(kart, x, y, r)) return false;
  taPlass(kart, x, y, r);
  plan.push({ x, y, s, lag, nr: 0, tegn });
  return true;
}

/** Tegner planen: bakerst først, og nedenfra og opp innenfor hvert lag. */
function tegnPlan(ctx, plan) {
  plan.sort((a, b) => (a.lag - b.lag) || (a.y - b.y));
  for (const p of plan) p.tegn(ctx, p.x, p.y, p.s, p.nr);
}

// --- Felles småting --------------------------------------------------------

function oye(ctx, x, y, r) {
  mal(ctx, sirkel(x, y, r), { fyll: '#fff', strek: KONTUR, bredde: r * 0.5 });
  mal(ctx, sirkel(x + r * 0.15, y, r * 0.5), { fyll: KONTUR });
}

/**
 * Mark i fargede bånd fra en valgt horisont og ned.
 * De delte kulissene legger horisonten to tredjedeler ned. Det gir en stor,
 * tom himmel – og tom himmel er nettopp det som gjør et puslespill vanskelig.
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

function luftballong(ctx, x, y, s, hue1, hue2) {
  const kule = new Path2D();
  kule.moveTo(x, y + s * 0.95);
  kule.bezierCurveTo(x - s * 0.95, y + s * 0.3, x - s * 0.8, y - s, x, y - s);
  kule.bezierCurveTo(x + s * 0.8, y - s, x + s * 0.95, y + s * 0.3, x, y + s * 0.95);
  mal(ctx, kule, { fyll: hsl(hue1, 85, 64), strek: KONTUR, bredde: 7 });
  ctx.save();
  ctx.clip(kule);
  for (let i = -2; i <= 2; i++) {
    mal(ctx, ellipse(x + i * s * 0.44, y, s * 0.17, s * 1.2),
      { fyll: i % 2 ? hsl(hue2, 85, 58) : hsl(hue1, 85, 76) });
  }
  ctx.restore();
  strek(ctx, [[x - s * 0.3, y + s * 0.85], [x - s * 0.18, y + s * 1.35]], KONTUR, 5);
  strek(ctx, [[x + s * 0.3, y + s * 0.85], [x + s * 0.18, y + s * 1.35]], KONTUR, 5);
  mal(ctx, rundetRekt(x - s * 0.22, y + s * 1.32, s * 0.44, s * 0.34, 6),
    { fyll: hsl(32, 55, 46), strek: KONTUR, bredde: 6 });
}

function vindmolle(ctx, x, bunnY, h, v0) {
  mal(ctx, polygon([[x - h * 0.1, bunnY], [x - h * 0.05, bunnY - h],
    [x + h * 0.05, bunnY - h], [x + h * 0.1, bunnY]]),
    { fyll: hsl(210, 14, 88), strek: KONTUR, bredde: 7 });
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(x, bunnY - h);
    ctx.rotate(v0 + (i / 4) * Math.PI * 2);
    mal(ctx, polygon([[0, 0], [h * 0.44, -h * 0.07], [h * 0.46, h * 0.05], [0, h * 0.04]]),
      { fyll: hsl(46, 85, 72), strek: KONTUR, bredde: 6 });
    ctx.restore();
  }
  mal(ctx, sirkel(x, bunnY - h, h * 0.05), { fyll: hsl(210, 14, 70), strek: KONTUR, bredde: 5 });
}

// ===========================================================================
// 1. Bondegård
// ===========================================================================

function ku(ctx, x, y, s) {
  const b = s * 1.4;
  mal(ctx, rundetRekt(x - b / 2, y - s * 0.36, b, s * 0.68, s * 0.28),
    { fyll: '#fdfdfd', strek: KONTUR, bredde: s * 0.07 });
  for (const [dx, dy, r] of [[-0.26, -0.08, 0.19], [0.16, 0.1, 0.15], [0.36, -0.16, 0.11]]) {
    mal(ctx, ellipse(x + dx * b, y + dy * s, r * s, r * s * 0.8), { fyll: '#2b2b33' });
  }
  for (const dx of [-0.3, -0.08, 0.14, 0.32]) {
    mal(ctx, rundetRekt(x + dx * b, y + s * 0.28, s * 0.12, s * 0.36, s * 0.05),
      { fyll: '#fdfdfd', strek: KONTUR, bredde: s * 0.06 });
  }
  mal(ctx, ellipse(x - b * 0.54, y - s * 0.28, s * 0.28, s * 0.25),
    { fyll: '#fdfdfd', strek: KONTUR, bredde: s * 0.07 });
  mal(ctx, ellipse(x - b * 0.64, y - s * 0.2, s * 0.15, s * 0.11), { fyll: '#ffb3c6' });
  oye(ctx, x - b * 0.56, y - s * 0.36, s * 0.07);
}

function gris(ctx, x, y, s) {
  const b = s * 1.2;
  mal(ctx, ellipse(x, y, b * 0.5, s * 0.34), { fyll: '#ff9fb8', strek: KONTUR, bredde: s * 0.07 });
  for (const dx of [-0.24, -0.05, 0.14, 0.3]) {
    mal(ctx, rundetRekt(x + dx * b, y + s * 0.22, s * 0.11, s * 0.28, s * 0.05),
      { fyll: '#ff9fb8', strek: KONTUR, bredde: s * 0.06 });
  }
  mal(ctx, ellipse(x - b * 0.46, y - s * 0.08, s * 0.24, s * 0.22),
    { fyll: '#ffb0c6', strek: KONTUR, bredde: s * 0.07 });
  mal(ctx, ellipse(x - b * 0.56, y - s * 0.04, s * 0.12, s * 0.09),
    { fyll: '#ff7fa3', strek: KONTUR, bredde: s * 0.05 });
  mal(ctx, polygon([[x - b * 0.5, y - s * 0.26], [x - b * 0.4, y - s * 0.4], [x - b * 0.34, y - s * 0.22]]),
    { fyll: '#ff8fae', strek: KONTUR, bredde: s * 0.05 });
  oye(ctx, x - b * 0.42, y - s * 0.14, s * 0.06);
}

function sau(ctx, x, y, s) {
  const p = new Path2D();
  for (const [dx, dy, r] of [[0, 0, 0.4], [-0.3, 0.06, 0.3], [0.3, 0.04, 0.28],
    [-0.14, -0.24, 0.28], [0.16, -0.22, 0.26]]) {
    p.addPath(sirkel(x + dx * s * 1.3, y + dy * s, r * s));
  }
  mal(ctx, p, { fyll: '#fbfbf6', strek: KONTUR, bredde: s * 0.07 });
  for (const dx of [-0.26, -0.08, 0.1, 0.26]) {
    mal(ctx, rundetRekt(x + dx * s * 1.3, y + s * 0.28, s * 0.09, s * 0.26, s * 0.04), { fyll: '#3a3a46' });
  }
  mal(ctx, ellipse(x - s * 0.68, y - s * 0.14, s * 0.2, s * 0.23),
    { fyll: '#3a3a46', strek: KONTUR, bredde: s * 0.05 });
  oye(ctx, x - s * 0.73, y - s * 0.18, s * 0.055);
}

function hone(ctx, x, y, s) {
  mal(ctx, ellipse(x, y, s * 0.34, s * 0.28), { fyll: '#fff6ea', strek: KONTUR, bredde: s * 0.07 });
  mal(ctx, ellipse(x - s * 0.28, y - s * 0.24, s * 0.19, s * 0.19),
    { fyll: '#fff6ea', strek: KONTUR, bredde: s * 0.06 });
  mal(ctx, polygon([[x - s * 0.36, y - s * 0.4], [x - s * 0.28, y - s * 0.53], [x - s * 0.2, y - s * 0.4]]),
    { fyll: '#e23c4e', strek: KONTUR, bredde: s * 0.05 });
  mal(ctx, polygon([[x - s * 0.45, y - s * 0.22], [x - s * 0.58, y - s * 0.17], [x - s * 0.45, y - s * 0.13]]),
    { fyll: '#f5a524' });
  mal(ctx, ellipse(x + s * 0.07, y, s * 0.18, s * 0.15, 0.3), { fyll: '#f0dcc0' });
  for (const dx of [-0.08, 0.1]) strek(ctx, [[x + dx * s, y + s * 0.26], [x + dx * s, y + s * 0.42]], '#f5a524', s * 0.06);
  oye(ctx, x - s * 0.31, y - s * 0.28, s * 0.05);
}

function hoyballe(ctx, x, y, s) {
  mal(ctx, ellipse(x, y, s * 0.42, s * 0.36), { fyll: '#e8c468', strek: '#a8832c', bredde: s * 0.08 });
  mal(ctx, ellipse(x, y, s * 0.2, s * 0.17), { strek: '#c7a243', bredde: s * 0.05 });
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

/** Liten blomst som pynt – skal aldri konkurrere med dyrene. */
function pyntblomst(ctx, x, y, s, hue) {
  strek(ctx, [[x, y], [x, y - s * 0.9]], hsl(112, 55, 34), s * 0.13);
  for (let i = 0; i < 5; i++) {
    const v = (i / 5) * Math.PI * 2;
    mal(ctx, sirkel(x + Math.cos(v) * s * 0.3, y - s * 0.9 + Math.sin(v) * s * 0.3, s * 0.24),
      { fyll: hsl(hue, 85, 70), strek: hsl(hue, 70, 48), bredde: 3 });
  }
  mal(ctx, sirkel(x, y - s * 0.9, s * 0.2), { fyll: hsl(48, 95, 66) });
}

function sceneBondegard(ctx, rng) {
  const horisont = DESIGN_H * 0.38;
  himmel(ctx, rng, { topp: 203 });
  sol(ctx, rng.range(140, 330), rng.range(80, 140), 56, 46);
  skyer(ctx, rng, rng.int(3, 4));
  fugler(ctx, rng, rng.int(2, 4));
  luftballong(ctx, rng.range(1000, 1380), rng.range(130, 210), rng.range(80, 105),
    rng.pick([348, 18, 46]), rng.pick([196, 276, 150]));
  markIBand(ctx, rng, horisont, 102, 5);

  const kart = nyttKart();
  const plan = [];

  // Byggverk først, med god klaring rundt seg.
  const vx = rng.range(170, 330);
  vindmolle(ctx, vx, horisont + 30, rng.range(290, 350), rng.range(0, Math.PI));
  taPlass(kart, vx, horisont + 30, 150);

  const lx = rng.range(1060, 1320);
  const lb = rng.range(290, 340);
  lave(ctx, lx, horisont + 110, lb);
  taPlass(kart, lx, horisont + 60, lb * 0.62);

  const tx = rng.range(620, 820);
  lovtre(ctx, tx, horisont + 60, rng.range(200, 250), rng, 128);
  taPlass(kart, tx, horisont - 20, 120);

  // Gjerde deler flaten i to lesbare bånd.
  const gy = horisont + 150;
  strek(ctx, [[0, gy], [DESIGN_B, gy]], '#d9c9a6', 11);
  strek(ctx, [[0, gy + 34], [DESIGN_B, gy + 34]], '#d9c9a6', 11);
  for (let x = 20; x < DESIGN_B; x += 150) {
    mal(ctx, rundetRekt(x, gy - 34, 20, 100, 5), { fyll: '#e7dcc2', strek: KONTUR, bredde: 5 });
  }

  // Dyrene får plass først, og god klaring. De er motivet.
  const dyr = [ku, sau, gris, hone, hoyballe, sau, ku, gris];
  fordel(rng, kart, plan, {
    kolonner: 4, rader: 2, storrelse: [0.78, 0.95], radius: 0.78, lag: FRONT,
    omrade: { x: 60, y: gy + 70, w: DESIGN_B - 120, h: DESIGN_H - gy - 120 },
    tegn: (c, x, y, s, nr) => dyr[nr % dyr.length](c, x, y, s),
  });

  // Pynt bare der det faktisk er ledig, og bakerst.
  fordel(rng, kart, plan, {
    kolonner: 11, rader: 5, storrelse: [0.46, 0.7], radius: 0.52, lag: BAK, slark: 0.3,
    mykt: true,
    omrade: { x: 10, y: horisont + 30, w: DESIGN_B - 20, h: DESIGN_H - horisont - 50 },
    tegn: (c, x, y, s, nr) => (nr % 3
      ? gresstust(c, x, y, s * 1.1, 100)
      : pyntblomst(c, x, y, s, [348, 46, 276, 20][nr % 4])),
  });

  tegnPlan(ctx, plan);
}

// ===========================================================================
// 2. Under vann
// ===========================================================================

function fisk(ctx, x, y, s, hue, speil) {
  ctx.save();
  ctx.translate(x, y);
  if (speil) ctx.scale(-1, 1);
  mal(ctx, ellipse(0, 0, s * 0.46, s * 0.3), { fyll: hsl(hue, 85, 60), strek: KONTUR, bredde: s * 0.07 });
  mal(ctx, polygon([[s * 0.38, 0], [s * 0.72, -s * 0.26], [s * 0.66, 0], [s * 0.72, s * 0.26]]),
    { fyll: hsl(hue, 80, 48), strek: KONTUR, bredde: s * 0.06 });
  mal(ctx, polygon([[-s * 0.08, -s * 0.28], [s * 0.08, -s * 0.5], [s * 0.2, -s * 0.26]]),
    { fyll: hsl(hue, 80, 52), strek: KONTUR, bredde: s * 0.05 });
  for (let i = 0; i < 3; i++) {
    mal(ctx, ellipse(-s * 0.08 + i * s * 0.16, 0, s * 0.045, s * 0.23),
      { fyll: hsl(hue + 18, 80, 74, 0.8) });
  }
  oye(ctx, -s * 0.26, -s * 0.06, s * 0.065);
  ctx.restore();
}

function tare(ctx, x, bunnY, h, bue, hue) {
  const kurve = bezierPunkter([x, bunnY], [x + bue * 0.6, bunnY - h * 0.4],
    [x - bue * 0.7, bunnY - h * 0.7], [x + bue * 0.4, bunnY - h], 24);
  mal(ctx, taperetBane(kurve, (t) => h * (0.085 - t * 0.045)),
    { fyll: hsl(hue, 60, 34), strek: hsl(hue, 60, 22), bredde: 5 });
  for (let i = 4; i < kurve.length; i += 6) {
    const p = kurve[i];
    mal(ctx, ellipse(p.x + (i % 2 ? 1 : -1) * h * 0.07, p.y, h * 0.075, h * 0.03, i % 2 ? 0.5 : -0.5),
      { fyll: hsl(hue + 10, 62, 42) });
  }
}

function korall(ctx, x, bunnY, s, hue) {
  for (let i = -1; i <= 1; i++) {
    mal(ctx, taperetBane(
      bezierPunkter([x, bunnY], [x + i * s * 0.3, bunnY - s * 0.4],
        [x + i * s * 0.6, bunnY - s * 0.6], [x + i * s * 0.72, bunnY - s * 0.9], 20),
      (t) => s * (0.18 - t * 0.11)),
      { fyll: hsl(hue, 78, 62), strek: hsl(hue, 70, 40), bredde: 5 });
  }
  mal(ctx, sirkel(x, bunnY - s * 0.08, s * 0.18), { fyll: hsl(hue + 14, 78, 56), strek: hsl(hue, 70, 38), bredde: 5 });
}

function sceneUndervann(ctx, rng) {
  ctx.fillStyle = loddrettGradient(ctx, 0, DESIGN_H, [
    [0, hsl(192, 82, 62)], [0.45, hsl(200, 78, 46)], [1, hsl(214, 72, 28)],
  ]);
  ctx.fillRect(0, 0, DESIGN_B, DESIGN_H);

  for (let i = 0; i < 7; i++) {
    const x = rng.range(-100, DESIGN_B);
    mal(ctx, polygon([[x, -20], [x + rng.range(60, 130), -20],
      [x + rng.range(180, 340), DESIGN_H * 0.72], [x + rng.range(60, 160), DESIGN_H * 0.72]]),
      { fyll: hsl(190, 90, 86, 0.1) });
  }

  const sandY = DESIGN_H * 0.78;
  const sand = new Path2D();
  sand.moveTo(-20, DESIGN_H);
  sand.lineTo(-20, sandY);
  for (let i = 0; i <= 6; i++) {
    sand.quadraticCurveTo(i * 280 - 140, sandY + rng.range(-50, 26), i * 280, sandY + rng.range(-16, 36));
  }
  sand.lineTo(DESIGN_B + 20, DESIGN_H);
  sand.closePath();
  mal(ctx, sand, { fyll: hsl(44, 62, 76), strek: hsl(40, 50, 58), bredde: 6 });

  const kart = nyttKart();
  const plan = [];

  // Bunnvekstene står på rekke med fast avstand, ikke tilfeldig oppå hverandre.
  const bunnting = 9;
  for (let i = 0; i < bunnting; i++) {
    const x = (DESIGN_B / bunnting) * (i + 0.5) + rng.range(-40, 40);
    const y = rng.range(sandY + 20, DESIGN_H - 10);
    if (i % 3 === 2) {
      korall(ctx, x, y, rng.range(110, 160), rng.pick([340, 20, 280, 50]));
      taPlass(kart, x, y - 60, 90);
    } else {
      tare(ctx, x, y, rng.range(220, 360), rng.range(-70, 70), rng.pick([128, 152, 96]));
      taPlass(kart, x, y - 120, 70);
    }
  }

  // Fisken er motivet. Den får plass først, med klaring.
  const hues = [10, 40, 60, 140, 190, 280, 320];
  fordel(rng, kart, plan, {
    kolonner: 5, rader: 3, storrelse: [0.62, 0.86], radius: 0.6, lag: FRONT,
    omrade: { x: 50, y: 40, w: DESIGN_B - 100, h: sandY - 70 },
    tegn: (c, x, y, s, nr) => fisk(c, x, y, s, hues[(nr * 3) % hues.length], nr % 2 === 0),
  });

  // Bobler i hullene mellom fiskene, bakerst.
  fordel(rng, kart, plan, {
    kolonner: 9, rader: 5, storrelse: [0.16, 0.3], radius: 0.8, lag: BAK, slark: 0.3,
    mykt: true,
    omrade: { x: 20, y: 20, w: DESIGN_B - 40, h: sandY - 40 },
    tegn: (c, x, y, s) => mal(c, sirkel(x, y, s * 0.5), { strek: hsl(190, 90, 92, 0.55), bredde: 3 }),
  });

  // Sjøstjerner på sanden, bare der det er plass.
  for (let i = 0; i < 4; i++) {
    const x = rng.range(70, DESIGN_B - 70);
    const y = rng.range(sandY + 40, DESIGN_H - 30);
    settInn(kart, plan, x, y, rng.range(40, 56), {
      radius: 1, lag: MIDT,
      tegn: (c, px, py, s) => mal(c, stjerne(px, py, s, 5, 0.45),
        { fyll: hsl(rng.pick([20, 340, 46]), 85, 62), strek: KONTUR, bredde: 6 }),
    });
  }

  tegnPlan(ctx, plan);
}

// ===========================================================================
// 3. Jungel
// ===========================================================================

function blad(ctx, x, y, s, vinkel, hue) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(vinkel);
  mal(ctx, ellipse(0, 0, s * 0.5, s * 0.21), { fyll: hsl(hue, 55, 38), strek: hsl(hue, 58, 22), bredde: s * 0.05 });
  strek(ctx, [[-s * 0.46, 0], [s * 0.46, 0]], hsl(hue, 50, 26), s * 0.035);
  for (let i = -2; i <= 2; i++) {
    strek(ctx, [[i * s * 0.16, 0], [i * s * 0.16 + s * 0.08, -s * 0.15]], hsl(hue, 50, 26), s * 0.03);
    strek(ctx, [[i * s * 0.16, 0], [i * s * 0.16 + s * 0.08, s * 0.15]], hsl(hue, 50, 26), s * 0.03);
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

function junglblomst(ctx, x, y, s, hue) {
  for (let k = 0; k < 5; k++) {
    const v = (k / 5) * Math.PI * 2;
    mal(ctx, ellipse(x + Math.cos(v) * s * 0.34, y + Math.sin(v) * s * 0.34, s * 0.28, s * 0.19, v),
      { fyll: hsl(hue, 88, 68), strek: hsl(hue, 70, 44), bredde: 4 });
  }
  mal(ctx, sirkel(x, y, s * 0.2), { fyll: hsl(48, 95, 64), strek: KONTUR, bredde: 4 });
}

function sceneJungel(ctx, rng) {
  ctx.fillStyle = loddrettGradient(ctx, 0, DESIGN_H, [
    [0, hsl(150, 55, 30)], [0.5, hsl(132, 48, 38)], [1, hsl(100, 45, 26)],
  ]);
  ctx.fillRect(0, 0, DESIGN_B, DESIGN_H);

  const kart = nyttKart();
  const plan = [];

  // Stammer med fast avstand, så de ikke klumper seg.
  const stammer = 3;
  for (let i = 0; i < stammer; i++) {
    const x = (DESIGN_B / stammer) * (i + 0.5) + rng.range(-70, 70);
    mal(ctx, taperetBane(bezierPunkter([x, DESIGN_H + 20], [x + rng.range(-30, 30), DESIGN_H * 0.6],
      [x + rng.range(-40, 40), DESIGN_H * 0.3], [x + rng.range(-20, 20), -20], 24), () => rng.range(72, 100)),
      { fyll: hsl(28, 38, 34), strek: hsl(26, 40, 20), bredde: 7 });
  }

  // Dyrene plasseres først og får rikelig klaring.
  const ax = rng.range(330, 620);
  const ay = rng.range(480, 680);
  taPlass(kart, ax, ay, 230);
  const px = rng.range(1030, 1340);
  const py = rng.range(260, 470);
  taPlass(kart, px, py, 190);

  // Blader i ledige felt. Dette er det som holder brikkene fra hverandre.
  const gronne = [96, 118, 136, 152, 84];
  fordel(rng, kart, plan, {
    kolonner: 8, rader: 6, storrelse: [0.95, 1.35], radius: 0.3, lag: BAK, slark: 0.3,
    mykt: true, krymp: [1, 0.85, 0.7, 0.55],
    tegn: (c, x, y, s, nr) => blad(c, x, y, s, (nr * 2.4) % (Math.PI * 2), gronne[nr % gronne.length]),
  });

  // Blomster bare i hull som fortsatt er ledige.
  fordel(rng, kart, plan, {
    kolonner: 6, rader: 4, storrelse: [0.32, 0.46], radius: 0.55, lag: MIDT, slark: 0.3,
    mykt: true,
    tegn: (c, x, y, s, nr) => junglblomst(c, x, y, s, [340, 20, 46, 288][nr % 4]),
  });

  plan.push({ x: ax, y: ay, s: rng.range(230, 275), lag: FRONT, nr: 0, tegn: ape });
  plan.push({ x: px, y: py, s: rng.range(185, 225), lag: FRONT, nr: 0, tegn: papegoye });

  tegnPlan(ctx, plan);
}

// ===========================================================================
// 4. Byen
// ===========================================================================

function byhus(ctx, x, bunnY, b, h, rng) {
  const hue = rng.pick([6, 34, 52, 150, 196, 268, 320]);
  mal(ctx, rundetRekt(x, bunnY - h, b, h, 6),
    { fyll: hsl(hue, 58, rng.range(58, 74)), strek: KONTUR, bredde: 7 });

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

  const kol = rng.int(2, 3);
  const rad = Math.max(1, Math.round(h / 150));
  const vb = b / (kol * 2 + 1);
  const vh = Math.min(vb * 1.2, (h - 110) / (rad * 1.7));
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

function bybil(ctx, x, y, s, hue) {
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
  sol(ctx, rng.range(1100, 1460), rng.range(90, 160), 58, 48);
  skyer(ctx, rng, rng.int(4, 6));
  fugler(ctx, rng, rng.int(2, 4));

  const gateY = DESIGN_H * 0.8;

  // Husrekke: hvert hus er sin egen sone, uten overlapp.
  let x = -30;
  while (x < DESIGN_B + 20) {
    const b = rng.range(170, 250);
    byhus(ctx, x, gateY, b, rng.range(330, 560), rng);
    x += b + rng.range(8, 22);
  }

  mal(ctx, rundetRekt(-20, gateY, DESIGN_B + 40, 36, 0), { fyll: hsl(210, 14, 76), strek: KONTUR, bredde: 5 });
  mal(ctx, rundetRekt(-20, gateY + 36, DESIGN_B + 40, DESIGN_H - gateY - 36, 0), { fyll: hsl(220, 12, 34) });
  for (let gx = -40; gx < DESIGN_B; gx += 170) {
    mal(ctx, rundetRekt(gx, gateY + 96, 94, 15, 7), { fyll: hsl(52, 92, 72) });
  }

  // Trær og lyktestolper på fortauet, med fast avstand.
  const langs = 7;
  for (let i = 0; i < langs; i++) {
    const px = (DESIGN_B / langs) * (i + 0.5) + rng.range(-30, 30);
    if (i % 2) {
      lovtre(ctx, px, gateY + 24, rng.range(140, 180), rng, rng.pick([128, 108, 146]));
    } else {
      strek(ctx, [[px, gateY + 24], [px, gateY - 130]], hsl(220, 12, 42), 10);
      mal(ctx, ellipse(px, gateY - 142, 24, 18), { fyll: hsl(50, 95, 72), strek: KONTUR, bredde: 5 });
    }
  }

  // Biler med garantert avstand, langs gata.
  const biler = rng.int(3, 4);
  for (let i = 0; i < biler; i++) {
    const bx = (DESIGN_B / biler) * (i + 0.5) + rng.range(-50, 50);
    bybil(ctx, bx, gateY + (i % 2 ? 78 : 132), rng.range(195, 235),
      [355, 18, 210, 145, 275, 48][i % 6]);
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

function storBlomst(ctx, x, y, s, hue, kronblad, prikker) {
  strek(ctx, [[x, y], [x, y + s * 1.05]], hsl(112, 55, 32), s * 0.11);
  for (let i = 0; i < kronblad; i++) {
    const v = (i / kronblad) * Math.PI * 2;
    mal(ctx, ellipse(x + Math.cos(v) * s * 0.46, y + Math.sin(v) * s * 0.46, s * 0.36, s * 0.23, v),
      { fyll: hsl(hue, 88, 68), strek: hsl(hue, 72, 44), bredde: 5 });
  }
  mal(ctx, sirkel(x, y, s * 0.27), { fyll: hsl(46, 95, 60), strek: hsl(38, 80, 42), bredde: 5 });
  for (const [dx, dy] of prikker) {
    mal(ctx, sirkel(x + dx * s * 0.15, y + dy * s * 0.15, s * 0.035), { fyll: hsl(32, 85, 44) });
  }
}

function sceneBlomstereng(ctx, rng) {
  himmel(ctx, rng, { topp: 199 });
  sol(ctx, rng.range(140, 360), rng.range(90, 160), 60, 48);
  skyer(ctx, rng, rng.int(3, 5));
  fugler(ctx, rng, rng.int(2, 4));
  luftballong(ctx, rng.range(1080, 1400), rng.range(120, 200), rng.range(66, 88),
    rng.pick([348, 18, 46]), rng.pick([196, 276, 150]));

  const engY = DESIGN_H * 0.36;
  markIBand(ctx, rng, engY, 100, 5);

  const kart = nyttKart();
  const plan = [];

  const tx = rng.range(1270, 1450);
  lovtre(ctx, tx, engY + 120, rng.range(240, 290), rng, 132);
  taPlass(kart, tx, engY + 20, 150);

  // Blomstene er motivet. Færre og større, med klaring, så de ikke
  // overlapper hverandre.
  const hues = [348, 20, 46, 276, 320, 196];
  fordel(rng, kart, plan, {
    kolonner: 5, rader: 3, storrelse: [0.72, 0.92], radius: 0.62, lag: MIDT, slark: 0.22,
    omrade: { x: 50, y: engY - 10, w: DESIGN_B - 100, h: DESIGN_H - engY - 70 },
    tegn: (c, x, y, s, nr) => storBlomst(c, x, y, s, hues[(nr * 2) % hues.length],
      5 + (nr % 3), [[-1, -1], [1, -0.6], [0.3, 1], [-0.8, 0.7]]),
  });

  // Insekter i lufta, over enga, i ledige felt.
  fordel(rng, kart, plan, {
    kolonner: 5, rader: 2, storrelse: [0.4, 0.6], radius: 0.8, lag: FRONT, slark: 0.3,
    omrade: { x: 60, y: 120, w: DESIGN_B - 120, h: engY - 140 },
    tegn: (c, x, y, s, nr) => (nr % 3 === 0 ? bie(c, x, y, s)
      : sommerfuglLiten(c, x, y, s, [320, 46, 196, 276, 10][nr % 5])),
  });

  // Småblomster og gress som fyller mellom de store, bakerst.
  fordel(rng, kart, plan, {
    kolonner: 11, rader: 4, storrelse: [0.3, 0.5], radius: 0.5, lag: BAK, slark: 0.32,
    mykt: true,
    omrade: { x: 0, y: engY + 10, w: DESIGN_B, h: DESIGN_H - engY - 20 },
    tegn: (c, x, y, s, nr) => (nr % 5 === 0
      ? marihone(c, x, y, s)
      : (nr % 2 ? gresstust(c, x, y, s * 1.5, 102) : pyntblomst(c, x, y, s * 1.2, [348, 46, 276, 196][nr % 4]))),
  });

  tegnPlan(ctx, plan);
}

// ===========================================================================
// 6. Rommet
// ===========================================================================

function planetDetaljert(ctx, x, y, r, oppskrift) {
  const { hue, type, ring, flekker, ringvinkel } = oppskrift;
  mal(ctx, sirkel(x, y, r), { fyll: hsl(hue, 70, 58), strek: hsl(hue, 60, 30), bredde: Math.max(4, r * 0.09) });
  ctx.save();
  ctx.clip(sirkel(x, y, r));
  if (type === 0) {
    for (let i = -3; i <= 3; i++) {
      mal(ctx, ellipse(x, y + i * r * 0.3, r * 1.1, r * 0.13),
        { fyll: hsl(hue + flekker[i + 3][0], 72, 40 + flekker[i + 3][1] * 36, 0.9) });
    }
  } else if (type === 1) {
    for (const [a, b, c] of flekker) {
      mal(ctx, sirkel(x + a * r * 0.7, y + b * r * 0.7, r * (0.14 + c * 0.16)),
        { fyll: hsl(hue + a * 30, 68, 36 + c * 36) });
    }
  } else {
    mal(ctx, ellipse(x - r * 0.2, y + r * 0.3, r * 0.8, r * 0.5, -0.4), { fyll: hsl(hue + 30, 65, 46) });
    mal(ctx, ellipse(x + r * 0.35, y - r * 0.35, r * 0.5, r * 0.3, 0.5), { fyll: hsl(hue - 25, 70, 68) });
  }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r * 1.25);
  g.addColorStop(0, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.55, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();

  if (ring) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ringvinkel);
    mal(ctx, ellipse(0, 0, r * 1.7, r * 0.38), { strek: hsl(hue + 36, 78, 76), bredde: Math.max(6, r * 0.15) });
    ctx.restore();
  }
}

function komet(ctx, x, y, s) {
  mal(ctx, taperetBane(
    bezierPunkter([x, y], [x + s * 1.2, y - s * 0.4], [x + s * 2.2, y - s * 0.7], [x + s * 3, y - s * 0.8], 22),
    (t) => s * 0.55 * (1 - t) ** 1.3),
    { fyll: hsl(195, 95, 72, 0.5) });
  mal(ctx, sirkel(x, y, s * 0.32), { fyll: hsl(48, 100, 86), strek: hsl(30, 90, 60), bredde: 5 });
}

function sceneRommet(ctx, rng) {
  ctx.fillStyle = loddrettGradient(ctx, 0, DESIGN_H, [
    [0, hsl(252, 60, 14)], [0.5, hsl(276, 54, 20)], [1, hsl(300, 48, 16)],
  ]);
  ctx.fillRect(0, 0, DESIGN_B, DESIGN_H);

  // Tåkefelt i et rolig rutenett – bakgrunnen skal variere, ikke rote.
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const x = (DESIGN_B / 4) * (c + 0.5) + rng.range(-60, 60);
      const y = (DESIGN_H / 3) * (r + 0.5) + rng.range(-50, 50);
      const s = rng.range(300, 430);
      const hue = rng.pick([196, 286, 322, 166, 40]);
      const g = ctx.createRadialGradient(x, y, 0, x, y, s);
      g.addColorStop(0, hsl(hue, 90, 60, 0.3));
      g.addColorStop(1, hsl(hue, 90, 60, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - s, y - s, s * 2, s * 2);
    }
  }

  // Stjerner over alt, bakerst – de forstyrrer ingenting.
  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 16; c++) {
      const x = (DESIGN_B / 16) * (c + rng.range(0.1, 0.9));
      const y = (DESIGN_H / 11) * (r + rng.range(0.1, 0.9));
      mal(ctx, sirkel(x, y, rng.range(1.5, 4)),
        { fyll: hsl(rng.pick([50, 196, 0, 286]), 70, 96, rng.range(0.4, 1)) });
    }
  }

  const kart = nyttKart();
  const plan = [];

  // Én klode per celle. Kloder skal aldri overlappe hverandre, men
  // klaringen er strammet inn så flere får plass - hullene fylles i stedet
  // med måner og asteroider etterpå.
  const hues = [18, 36, 190, 210, 280, 320, 140, 0];
  fordel(rng, kart, plan, {
    kolonner: 6, rader: 4, storrelse: [0.44, 0.62], radius: 0.74, lag: MIDT, slark: 0.18,
    omrade: { x: 30, y: 30, w: DESIGN_B - 60, h: DESIGN_H - 60 },
    tegn: (c, x, y, s, nr) => {
      const o = {
        hue: hues[(nr * 3) % hues.length],
        type: nr % 3,
        ring: nr % 5 === 1 || nr % 7 === 3,
        ringvinkel: -0.2 - (nr % 3) * 0.15,
        flekker: Array.from({ length: 7 }, (_, i) => [
          Math.sin(nr * 2.3 + i) , Math.cos(nr * 1.7 + i), (Math.sin(nr + i * 2) + 1) / 2,
        ]),
      };
      planetDetaljert(c, x, y, s * 0.5, o);
    },
  });

  // Måner og asteroider i hullene mellom klodene. Uten disse ble det igjen
  // store, like mørkeflater - akkurat det som gjorde Rakett vanskelig.
  fordel(rng, kart, plan, {
    kolonner: 9, rader: 6, storrelse: [0.2, 0.36], radius: 0.6, lag: BAK, slark: 0.34,
    mykt: true, krymp: [1, 0.78, 0.6, 0.45],
    omrade: { x: 20, y: 20, w: DESIGN_B - 40, h: DESIGN_H - 40 },
    tegn: (c, x, y, s, nr) => {
      const hue = [34, 200, 290, 150, 10][nr % 5];
      mal(c, sirkel(x, y, s * 0.5), { fyll: hsl(hue, 45, 62), strek: hsl(hue, 40, 36), bredde: 4 });
      for (let k = 0; k < 3; k++) {
        const v = nr * 1.7 + k * 2.1;
        mal(c, sirkel(x + Math.cos(v) * s * 0.22, y + Math.sin(v) * s * 0.22, s * 0.09),
          { fyll: hsl(hue, 38, 48) });
      }
    },
  });

  // Kometer bare der det er god plass.
  for (let i = 0; i < 2; i++) {
    const x = rng.range(100, DESIGN_B - 560);
    const y = rng.range(80, DESIGN_H - 80);
    settInn(kart, plan, x, y, rng.range(42, 62), {
      radius: 2.6, lag: FRONT,
      tegn: (c, px, py, s) => komet(c, px, py, s),
    });
  }

  tegnPlan(ctx, plan);
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
