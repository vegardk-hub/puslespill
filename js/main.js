import { randomSeed } from './core/rng.js';
import { solveGrid, describeGrid } from './core/grid.js';
import { lagPuslespill, spreBrikker, samleBrikker } from './core/puzzle.js';
import { Spill, formaterTid } from './core/spill.js';
import { byggAtlas } from './render/atlas.js';
import { Kamera } from './render/camera.js';
import { Tegner, MAKS_LOFT } from './render/renderer.js';
import { Gester } from './input/gester.js';
import { genererMotiv, MOTIVER } from './art/motiver.js';
import { PALETTES } from './art/palettes.js';
import * as lyd from './lyd.js';

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
  spokelse: 0.15,
  festTilBrett: true,
  lyd: true,
};

let puslespill = null;
let atlas = null;
let motiv = null;
let bord = null;
let spill = null;
let klokke = 0;
let visHeleBordet = false;

/**
 * Bordet må være stort nok til at alle brikkene får plass rundt rammen,
 * men ikke større – er det for stort, blir alt zoomet for langt ut og
 * brikkene for små å treffe.
 *
 * Ringen rundt rammen blir omtrent to ganger bildets areal, som rommer
 * brikkehaugen med god margin. Gulvet på 2,2 brikkebredder gjør at også
 * små puslespill får litt albuerom.
 */
function regnBord(p) {
  const m = Math.max(
    Math.max(p.brikkeB, p.brikkeH) * 2.2,
    Math.min(p.bilde.bredde, p.bilde.hoyde) * 0.44);
  return { x: -m, y: -m, w: p.bilde.bredde + m * 2, h: p.bilde.hoyde + m * 2 };
}

function visning() {
  return { b: canvas.clientWidth, h: canvas.clientHeight };
}

/** Plassen panelet legger beslag på, så brettet sentreres i resten. */
function innrykk() {
  const p = $('#panel').getBoundingClientRect();
  return { topp: Math.min(p.bottom + 8, canvas.clientHeight * 0.55) };
}

/**
 * Startvisningen: rammen med litt av brikkehaugen rundt. Hele bordet gjør
 * brikkene for små å treffe, og bare rammen skjuler haugen helt.
 */
function arbeidsutsnitt() {
  const r = puslespill.ramme;
  const mx = (r.x - bord.x) * 0.5;
  const my = (r.y - bord.y) * 0.5;
  return { x: r.x - mx, y: r.y - my, w: r.w + mx * 2, h: r.h + my * 2 };
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

// ---------------------------------------------------------------------------
// Bygge nytt puslespill
// ---------------------------------------------------------------------------

async function byggNytt({ nyttMotiv = true } = {}) {
  $('#laster').hidden = false;
  $('#laster-tekst').textContent = nyttMotiv ? 'Tegner motiv …' : 'Kutter brikker …';
  $('#ferdig').hidden = true;
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
  spreBrikker(puslespill, bord);
  spill = new Spill(puslespill);

  atlas = byggAtlas(motiv.canvas, puslespill);
  const tAtlas = performance.now() - t1;

  tegner.spokelseStyrke = tilstand.spokelse;
  tegner.settPuslespill(puslespill, atlas, motiv.canvas);
  kamera.minSkala = Math.min(visning().b / bord.w, visning().h / bord.h) * 0.75;
  visHeleBordet = false;
  tilpassVisning(arbeidsutsnitt());

  startKlokke();
  oppdaterStatus({ tMotiv, tAtlas });
  oppdaterSpillstatus();
  $('#laster').hidden = true;
}

// ---------------------------------------------------------------------------
// Spilling
// ---------------------------------------------------------------------------

/**
 * Hvor nær en brikke må ligge for å smette på plass.
 * Målet er ~26 skjermpiksler, men aldri mer enn 42 % eller mindre enn 12 %
 * av brikkestørrelsen. Da føles det likt uansett zoomnivå.
 */
function toleranse() {
  const minMal = Math.min(puslespill.brikkeB, puslespill.brikkeH);
  return Math.min(0.42 * minMal, Math.max(0.12 * minMal, 26 / kamera.skala));
}

/** Animerer forskyvningen brikkene fikk da de smatt på plass, mot null. */
function animerKobling() {
  const berort = puslespill.brikker.filter((b) => b.animX || b.animY);
  if (!berort.length) return;
  const fra = berort.map((b) => ({ b, x: b.animX, y: b.animY }));
  const start = performance.now();
  const varighet = 150;
  tegner.animer((na) => {
    const t = Math.min(1, (na - start) / varighet);
    const e = 1 - (1 - t) ** 3;
    for (const f of fra) {
      f.b.animX = f.x * (1 - e);
      f.b.animY = f.y * (1 - e);
    }
    return t < 1;
  });
}

function feire() {
  stoppKlokke();
  $('#ferdig-tekst').textContent =
    `${puslespill.antall} brikker på ${formaterTid(spill.brukteSekunder())}`;
  $('#ferdig').hidden = false;
  if (tilstand.lyd) lyd.ferdig();
}

new Gester(canvas, kamera, {
  onEndring: () => tegner.merkSkitten(),
  hentBord: () => bord,
  hentVisning: visning,
  // Dobbelttrykk veksler mellom oversikt over hele bordet og arbeidsvisning.
  onDobbelttrykk: () => {
    visHeleBordet = !visHeleBordet;
    tilpassVisning(visHeleBordet ? bord : arbeidsutsnitt());
  },
  onBeroring: () => { if (tilstand.lyd) lyd.vekk(); },

  finnHandtak: (verden) => {
    if (!spill) return null;
    const b = spill.brikkeUnder(verden, 14 / kamera.skala);
    return spill.startDrag(b);
  },

  onDragStart: (handtak, verden) => {
    const sett = spill.medlemmer(handtak.gruppe);
    for (const id of sett) {
      puslespill.brikker[id].animX = 0;
      puslespill.brikker[id].animY = 0;
    }
    tegner.dragGruppe = {
      sett,
      anker: verden,
      skala: sett.size <= MAKS_LOFT ? 1.06 : 1,
    };
    if (tilstand.lyd) lyd.loft();
  },

  onDrag: (handtak, dx, dy, verden) => {
    spill.dragTil(handtak, dx, dy);
    if (tegner.dragGruppe) tegner.dragGruppe.anker = verden;
  },

  onDragSlutt: (handtak) => {
    tegner.dragGruppe = null;
    if (!handtak) return;
    const res = spill.slipp(handtak, toleranse(), tilstand.festTilBrett);
    if (res.koblinger) {
      animerKobling();
      if (tilstand.lyd) (res.hjem ? lyd.fest() : lyd.kobling(res.koblinger));
    } else if (tilstand.lyd) {
      lyd.legg();
    }
    oppdaterSpillstatus();
    if (res.ferdig) feire();
  },
});

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

function oppdaterStatus({ tMotiv = 0, tAtlas = 0 } = {}) {
  $('#brikketall').textContent = describeGrid(tilstand.onsketAntall, puslespill.rutenett);
  const palettNavn = motiv.meta.palett ? ' / ' + PALETTES[motiv.meta.palett].navn : '';
  $('#status').textContent =
    `${motiv.meta.navn}${palettNavn} · puslbarhet ${motiv.meta.puslbarhet}% · ` +
    `seed ${tilstand.seed} · bilde ${motiv.canvas.width}×${motiv.canvas.height} · ` +
    `atlas ${atlas.minneMB.toFixed(0)} MB / ${atlas.sider.length} side(r) · ` +
    `motiv ${tMotiv.toFixed(0)} ms · kutt ${tAtlas.toFixed(0)} ms`;
  const alt = puslespill.rutenett.alternatives || [];
  $('#alternativer').innerHTML = alt.length
    ? 'Nær: ' + alt.map((a) => `<button class="lenke" data-antall="${a.count}">${a.count}</button>`).join(' ')
    : '';
}

function oppdaterSpillstatus() {
  if (!spill) return;
  const andel = spill.fremdrift();
  $('#fremdrift-linje').style.width = (andel * 100).toFixed(1) + '%';
  $('#spillstatus').textContent =
    `${Math.round(andel * puslespill.antall)} / ${puslespill.antall} brikker · ` +
    `${formaterTid(spill.brukteSekunder())}`;
}

function startKlokke() {
  stoppKlokke();
  klokke = setInterval(() => {
    if (spill && spill.startTid && !spill.erFerdig()) oppdaterSpillstatus();
  }, 1000);
}

function stoppKlokke() {
  if (klokke) clearInterval(klokke);
  klokke = 0;
}

// ---------------------------------------------------------------------------
// Størrelse
// ---------------------------------------------------------------------------

let resizeTimer = 0;
function tilpassCanvas() {
  const r = canvas.getBoundingClientRect();
  const endret = tegner.tilpassStorrelse(r.width, r.height, window.devicePixelRatio);
  if (endret && puslespill) {
    kamera.minSkala = Math.min(r.width / bord.w, r.height / bord.h) * 0.75;
    kamera.begrens(bord, r.width, r.height);
    tegner.merkSkitten();
  }
}
// Debounces fordi iPadOS fyrer av flere resize under rotasjon – og hver
// canvas-resize koster minne i WebKit.
const utsattTilpassing = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(tilpassCanvas, 120);
};
window.addEventListener('resize', utsattTilpassing);
window.visualViewport?.addEventListener('resize', utsattTilpassing);

// ---------------------------------------------------------------------------
// Grensesnitt
// ---------------------------------------------------------------------------

function settAntall(n) {
  tilstand.onsketAntall = Math.max(4, Math.min(500, Math.round(n)));
  $('#eget-antall').value = tilstand.onsketAntall;
  for (const b of document.querySelectorAll('[data-forhandsvalg]')) {
    b.classList.toggle('aktiv', Number(b.dataset.forhandsvalg) === tilstand.onsketAntall);
  }
}

document.querySelectorAll('[data-forhandsvalg]').forEach((b) => {
  b.addEventListener('click', () => {
    settAntall(Number(b.dataset.forhandsvalg));
    byggNytt({ nyttMotiv: false });
  });
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
$('#stokk').addEventListener('click', () => {
  spreBrikker(puslespill, bord);
  spill = new Spill(puslespill);
  tegner.dragGruppe = null;
  $('#ferdig').hidden = true;
  startKlokke();
  visHeleBordet = false;
  tilpassVisning(arbeidsutsnitt());
  oppdaterSpillstatus();
});
$('#fasit').addEventListener('click', () => {
  samleBrikker(puslespill);
  tegner.dragGruppe = null;
  tilpassVisning(puslespill.ramme);
  oppdaterSpillstatus();
});
$('#spokelse').addEventListener('input', (e) => {
  tilstand.spokelse = Number(e.target.value) / 100;
  tegner.spokelseStyrke = tilstand.spokelse;
  tegner.merkSkitten();
});
$('#fest').addEventListener('click', () => {
  tilstand.festTilBrett = !tilstand.festTilBrett;
  $('#fest').classList.toggle('aktiv', tilstand.festTilBrett);
});
$('#lydknapp').addEventListener('click', () => {
  tilstand.lyd = !tilstand.lyd;
  lyd.settDempet(!tilstand.lyd);
  $('#lydknapp').classList.toggle('aktiv', tilstand.lyd);
  $('#lydknapp').textContent = tilstand.lyd ? 'Lyd på' : 'Lyd av';
});
$('#ferdig').addEventListener('click', () => { $('#ferdig').hidden = true; });
$('#panel-veksle').addEventListener('click', () => {
  document.body.classList.toggle('panel-skjult');
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(tilpassCanvas, 60);
});

// ---------------------------------------------------------------------------
// Oppstart
// ---------------------------------------------------------------------------

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

/** Palettvalget gjelder bare neon – de figurative scenene har egne farger. */
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

// Feilsøkingskrok for utviklingsverktøy og måling av ytelse.
window.__puslespill = {
  get puslespill() { return puslespill; },
  get atlas() { return atlas; },
  get bord() { return bord; },
  get spill() { return spill; },
  tegner, kamera, tilstand, byggNytt, settAntall, toleranse,
};

motivVelger.value = tilstand.motiv;
oppdaterPalettTilgang();
$('#fest').classList.toggle('aktiv', tilstand.festTilBrett);
$('#lydknapp').classList.toggle('aktiv', tilstand.lyd);
settAntall(100);
tilpassCanvas();
byggNytt();

if ('serviceWorker' in navigator) {
  // Fantes det allerede en service worker da siden lastet, betyr et bytte at
  // en ny versjon har tatt over. Da lastes siden en gang til, sa alle filene
  // kommer fra samme versjon. Uten dette kan ny HTML mote gammel JavaScript.
  const haddeKontroll = !!navigator.serviceWorker.controller;
  let lastetPaNytt = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!haddeKontroll || lastetPaNytt) return;
    lastetPaNytt = true;
    location.reload();
  });
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  });
}
