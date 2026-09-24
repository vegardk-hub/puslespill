import { randomSeed } from './core/rng.js';
import { solveGrid, describeGrid } from './core/grid.js';
import { lagPuslespill, spreBrikker, samleBrikker } from './core/puzzle.js';
import { byggAtlas } from './render/atlas.js';
import { Kamera } from './render/camera.js';
import { Tegner } from './render/renderer.js';
import { Gester } from './input/gester.js';
import { genererMotiv, MOTIVER } from './art/motiver.js';
import { PALETTES } from './art/palettes.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#brett');
const kamera = new Kamera();
const tegner = new Tegner(canvas, kamera);

const tilstand = {
  motiv: 'dinosaur',
  onsketAntall: 100,
  kuttstil: 'klassisk',
  palett: 'auto',
  sideforhold: 1.5,
  seed: randomSeed(),
  spredt: false,
  spokelse: 0.15,
};

let puslespill = null;
let atlas = null;
let motiv = null;
let bord = null;

/** Bordet er stort nok til at brikkene faktisk far plass rundt rammen. */
function regnBord(p) {
  const m = Math.max(p.brikkeB, p.brikkeH) * 4.5;
  return { x: -m, y: -m, w: p.bilde.bredde + m * 2, h: p.bilde.hoyde + m * 2 };
}

function visning() {
  return { b: canvas.clientWidth, h: canvas.clientHeight };
}

/** Plassen panelet legger beslag pa, sa brettet sentreres i resten. */
function innrykk() {
  const p = document.getElementById('panel').getBoundingClientRect();
  return { topp: Math.min(p.bottom + 8, canvas.clientHeight * 0.55) };
}

function tilpassVisning(rekt) {
  const v = visning();
  kamera.tilpass(rekt, v.b, v.h, 0.06, innrykk());
  kamera.begrens(bord, v.b, v.h);
  tegner.merkSkitten();
}

function velgBildestorrelse(antall, sideforhold) {
  const g = solveGrid(antall, sideforhold);
  const brikkePx = Math.round(Math.min(140, Math.max(70, 2600 / Math.sqrt(g.count))));
  const bredde = Math.min(2048, Math.max(640, g.cols * brikkePx));
  return { bredde, hoyde: Math.round(bredde / sideforhold), rutenett: g };
}

async function byggNytt({ nyttMotiv = true } = {}) {
  $('#laster').hidden = false;
  $('#laster-tekst').textContent = nyttMotiv ? 'Tegner motiv …' : 'Kutter brikker …';
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const t0 = performance.now();
  const mal = velgBildestorrelse(tilstand.onsketAntall, tilstand.sideforhold);

  if (nyttMotiv || !motiv || motiv.canvas.width !== mal.bredde || motiv.canvas.height !== mal.hoyde) {
    const palett = tilstand.palett === 'auto' ? undefined : tilstand.palett;
    motiv = genererMotiv(tilstand.motiv, mal.bredde, mal.hoyde, tilstand.seed + ':motiv', { palett });
  }
  const tMotiv = performance.now() - t0;

  const t1 = performance.now();
  if (atlas) atlas.frigjor();
  puslespill = lagPuslespill(
    { bredde: motiv.canvas.width, hoyde: motiv.canvas.height },
    tilstand.onsketAntall,
    { seed: tilstand.seed, kuttstil: tilstand.kuttstil });
  bord = regnBord(puslespill);
  if (tilstand.spredt) spreBrikker(puslespill, bord); else samleBrikker(puslespill);

  atlas = byggAtlas(motiv.canvas, puslespill);
  const tAtlas = performance.now() - t1;

  tegner.spokelseStyrke = tilstand.spokelse;
  tegner.settPuslespill(puslespill, atlas, motiv.canvas);
  kamera.minSkala = Math.min(visning().b / bord.w, visning().h / bord.h) * 0.8;
  tilpassVisning(puslespill.ramme);

  oppdaterStatus({ tMotiv, tAtlas });
  $('#laster').hidden = true;
}

function oppdaterStatus({ tMotiv = 0, tAtlas = 0 } = {}) {
  $('#brikketall').textContent = describeGrid(tilstand.onsketAntall, puslespill.rutenett);
  const palettNavn = motiv.meta.palett ? ' / ' + PALETTES[motiv.meta.palett].navn : '';
  $('#status').textContent =
    `${motiv.meta.navn}${palettNavn} · puslbarhet ${motiv.meta.puslbarhet}% · ` +
    `seed ${tilstand.seed} · ` +
    `bilde ${motiv.canvas.width}×${motiv.canvas.height} · ` +
    `atlas ${atlas.minneMB.toFixed(0)} MB / ${atlas.sider.length} side(r) · ` +
    `motiv ${tMotiv.toFixed(0)} ms · kutt ${tAtlas.toFixed(0)} ms`;
  const alt = puslespill.rutenett.alternatives || [];
  $('#alternativer').innerHTML = alt.length
    ? 'Nær: ' + alt.map((a) => `<button class="lenke" data-antall="${a.count}">${a.count}</button>`).join(' ')
    : '';
}

// --- Storrelse -------------------------------------------------------------
let resizeTimer = 0;
function tilpassCanvas() {
  const r = canvas.getBoundingClientRect();
  const endret = tegner.tilpassStorrelse(r.width, r.height, window.devicePixelRatio);
  if (endret && puslespill) {
    kamera.minSkala = Math.min(r.width / bord.w, r.height / bord.h) * 0.8;
    kamera.begrens(bord, r.width, r.height);
    tegner.merkSkitten();
  }
}
// Debounces fordi iPadOS fyrer av flere resize under rotasjon - og hver
// canvas-resize koster minne i WebKit.
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(tilpassCanvas, 120);
});
window.visualViewport?.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(tilpassCanvas, 120);
});

// --- Gester ----------------------------------------------------------------
new Gester(canvas, kamera, {
  onEndring: () => tegner.merkSkitten(),
  hentBord: () => bord,
  hentVisning: visning,
  onDobbelttrykk: () => tilpassVisning(tilstand.spredt ? bord : puslespill.ramme),
});

// --- Grensesnitt -----------------------------------------------------------
function settAntall(n) {
  tilstand.onsketAntall = Math.max(4, Math.min(500, Math.round(n)));
  $('#eget-antall').value = tilstand.onsketAntall;
  for (const b of document.querySelectorAll('[data-forhandsvalg]')) {
    b.classList.toggle('aktiv', Number(b.dataset.forhandsvalg) === tilstand.onsketAntall);
  }
}

document.querySelectorAll('[data-forhandsvalg]').forEach((b) => {
  b.addEventListener('click', () => { settAntall(Number(b.dataset.forhandsvalg)); byggNytt({ nyttMotiv: false }); });
});
$('#eget-antall').addEventListener('change', (e) => {
  settAntall(Number(e.target.value) || 100);
  byggNytt({ nyttMotiv: false });
});
$('#alternativer').addEventListener('click', (e) => {
  const b = e.target.closest('[data-antall]');
  if (!b) return;
  settAntall(Number(b.dataset.antall));
  byggNytt({ nyttMotiv: false });
});
$('#motiv').addEventListener('change', (e) => {
  tilstand.motiv = e.target.value;
  oppdaterPalettTilgang();
  byggNytt({ nyttMotiv: true });
});
$('#kuttstil').addEventListener('change', (e) => {
  tilstand.kuttstil = e.target.value;
  byggNytt({ nyttMotiv: false });
});
$('#palett').addEventListener('change', (e) => {
  tilstand.palett = e.target.value;
  byggNytt({ nyttMotiv: true });
});
$('#nytt').addEventListener('click', () => {
  tilstand.seed = randomSeed();
  byggNytt({ nyttMotiv: true });
});
$('#spre').addEventListener('click', () => {
  tilstand.spredt = !tilstand.spredt;
  $('#spre').classList.toggle('aktiv', tilstand.spredt);
  $('#spre').textContent = tilstand.spredt ? 'Samle' : 'Spre';
  if (tilstand.spredt) spreBrikker(puslespill, bord); else samleBrikker(puslespill);
  tilpassVisning(tilstand.spredt ? bord : puslespill.ramme);
});
$('#spokelse').addEventListener('input', (e) => {
  tilstand.spokelse = Number(e.target.value) / 100;
  tegner.spokelseStyrke = tilstand.spokelse;
  tegner.merkSkitten();
});
$('#panel-veksle').addEventListener('click', () => {
  document.body.classList.toggle('panel-skjult');
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    tilpassCanvas();
    if (puslespill) tilpassVisning(tilstand.spredt ? bord : puslespill.ramme);
  }, 60);
});

// --- Oppstart --------------------------------------------------------------
const motivVelger = $('#motiv');
const grupper = new Map();
for (const [n, m] of Object.entries(MOTIVER)) {
  if (!grupper.has(m.gruppe)) {
    const g = document.createElement('optgroup');
    g.label = m.gruppe;
    grupper.set(m.gruppe, g);
    motivVelger.append(g);
  }
  const o = document.createElement('option');
  o.value = n;
  o.textContent = m.navn;
  grupper.get(m.gruppe).append(o);
}

/** Palettvalget gjelder bare neon - de figurative scenene har egne farger. */
function oppdaterPalettTilgang() {
  const bareNeon = tilstand.motiv !== 'neon';
  $('#palett').disabled = bareNeon;
  $('#palett').title = bareNeon ? 'Paletten gjelder bare neonmotivet' : '';
}

const palettVelger = $('#palett');
for (const [n, p] of Object.entries(PALETTES)) {
  const o = document.createElement('option');
  o.value = n;
  o.textContent = p.navn;
  palettVelger.append(o);
}

// Feilsokingskrok for utviklingsverktoy og maling av ytelse.
window.__puslespill = {
  get puslespill() { return puslespill; },
  get atlas() { return atlas; },
  get bord() { return bord; },
  tegner, kamera, tilstand, byggNytt, settAntall,
};

motivVelger.value = tilstand.motiv;
oppdaterPalettTilgang();
settAntall(100);
tilpassCanvas();
byggNytt();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  });
}
