import { randomSeed } from './core/rng.js';
import { solveGrid, describeGrid } from './core/grid.js';
import { lagPuslespill, spreBrikker, samleBrikker, ryddBrikker } from './core/puzzle.js';
import { Spill, formaterTid } from './core/spill.js';
import { regnVanskelighet, OPPSETT } from './core/vanskelighet.js';
import { erKantbrikke } from './ui/skuff.js';
import { byggAtlas } from './render/atlas.js';
import { Kamera } from './render/camera.js';
import { Tegner, MAKS_LOFT } from './render/renderer.js';
import { Gester } from './input/gester.js';
import { Skuff, FARGEBOTTER } from './ui/skuff.js';
import { genererMotiv, MOTIVER, tilgjengeligeMotiv } from './art/motiver.js';
import { settAktivtBilde, hentAktivtBilde } from './art/eget.js';
import { Beskjaerer, lesBildefil } from './ui/beskjaer.js';
import { malPuslbarhet } from './art/tegning.js';
import * as lagring from './lagring.js';
import { PALETTES } from './art/palettes.js';
import * as lyd from './lyd.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#brett');
const kamera = new Kamera();
const tegner = new Tegner(canvas, kamera);
const skuff = new Skuff();
tegner.skuff = skuff;

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
  rotasjon: false,
  kanterForst: false,
  visBilde: false,
};

let puslespill = null;
let atlas = null;
let motiv = null;
let bord = null;
let spill = null;
let klokke = 0;
let visHeleBordet = false;
let skuffTrykk = null;
let lassoFra = null;
let beskjaerer = null;
let venterBilde = null;
let mineBilder = [];

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
  return {
    topp: Math.min(p.bottom + 8, canvas.clientHeight * 0.45),
    bunn: skuff.rekt.h + (skuff.apen ? 44 : 0),
  };
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

/**
 * Gir nettleseren en sjanse til a tegne lasteskjermen for vi blokkerer
 * traden med a generere motiv og kutte brikker.
 *
 * requestAnimationFrame alene duger ikke: den fyrer ikke i en skjult fane.
 * Uten tidsfristen ville appen bli staende bak lasteskjermen for alltid om
 * man bygger et puslespill og bytter bort fra fanen i samme oyeblikk.
 */
function laLasteskjermenVises() {
  return new Promise((ferdig) => {
    let gjort = false;
    const en_gang = () => { if (!gjort) { gjort = true; ferdig(); } };
    requestAnimationFrame(() => requestAnimationFrame(en_gang));
    setTimeout(en_gang, 80);
  });
}

async function byggNytt({ nyttMotiv = true } = {}) {
  $('#laster').hidden = false;
  $('#laster-tekst').textContent = nyttMotiv ? 'Tegner motiv …' : 'Kutter brikker …';
  $('#ferdig').hidden = true;
  await laLasteskjermenVises();

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
  spreBrikker(puslespill, bord, tilstand.rotasjon);
  spill = new Spill(puslespill);
  settKantmodus();

  atlas = byggAtlas(motiv.canvas, puslespill);
  const tAtlas = performance.now() - t1;

  tegner.spokelseStyrke = tilstand.spokelse;
  tegner.settPuslespill(puslespill, atlas, motiv.canvas);
  kamera.minSkala = Math.min(visning().b / bord.w, visning().h / bord.h) * 0.75;
  visHeleBordet = false;
  tilpassVisning(arbeidsutsnitt());

  startKlokke();
  oppdaterStatus({ tMotiv, tAtlas });
  oppdaterVanskelighet();
  oppdaterHjelpetekst();
  tegnForhandsvisning();
  oppdaterSkuff();
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

/** Dreier brikken mykt pa plass i stedet for a la den hoppe. */
function animerDreining(brikke) {
  const start = performance.now();
  const varighet = 150;
  const fra = brikke.animRot;
  tegner.animer((na) => {
    const t = Math.min(1, (na - start) / varighet);
    const e = 1 - (1 - t) ** 3;
    brikke.animRot = fra * (1 - e);
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

/** Regner ut skuffens innhold og layout pa nytt, og bygger filterknappene. */
function oppdaterSkuff() {
  if (!puslespill || !spill) return;
  skuff.oppdater(puslespill, spill);
  skuff.layout(canvas.clientWidth, canvas.clientHeight);
  byggFilterknapper();
  const bunn = skuff.apen ? skuff.rekt.h : 0;
  $('#skufflinje').style.bottom = bunn + 'px';
  $('#skufflinje').hidden = !skuff.apen;
  // Forhandsvisningen skal ligge over skuffen, ikke oppa den.
  $('#forhandsvisning').style.bottom = (bunn + (skuff.apen ? 50 : 10)) + 'px';
  tegner.merkSkitten();
}

function byggFilterknapper() {
  const tell = Skuff.botteTelling(puslespill, spill);
  const kantAntall = Skuff.kandidater(puslespill, spill)
    .filter((b) => b.r === 0 || b.c === 0 || b.r === puslespill.rows - 1 || b.c === puslespill.cols - 1)
    .length;

  const valg = [
    { id: 'alle', navn: 'Alle', antall: Skuff.kandidater(puslespill, spill).length, farge: null },
    { id: 'kant', navn: 'Kanter', antall: kantAntall, farge: '#22e0ff' },
  ];
  for (const b of FARGEBOTTER) {
    const n = tell.get(b.id) || 0;
    if (n >= 1) valg.push({ id: b.id, navn: b.navn, antall: n, farge: b.farge });
  }
  // Filteret kan ha blitt tomt fordi brikkene er lagt pa plass.
  if (!valg.some((v) => v.id === skuff.filter)) skuff.filter = 'alle';

  const boks = $('#skufffiltre');
  boks.innerHTML = valg.map((v) => `
    <button class="filterknapp${v.id === skuff.filter ? ' aktiv' : ''}" data-filter="${v.id}">
      ${v.farge ? `<i style="background:${v.farge}"></i>` : ''}${v.navn}
      <b>${v.antall}</b>
    </button>`).join('');
}

/**
 * Skuffen far pekeren for verden gjor det.
 * Retningen avgjor hva som skjer: sidelengs ruller bandet, oppover lofter
 * brikken ut pa bordet. Det er det samme monsteret som en karusell man kan
 * dra elementer ut av, og det krever ingen ekstra knapp.
 */
const skuffLag = {
  traff: (pos) => skuff.inni(pos.x, pos.y),
  ned: (pos) => {
    skuffTrykk = { id: skuff.brikkeVed(pos.x, pos.y), modus: 'usikker' };
  },
  beveg: (pos, dxTot, dyTot, dxSteg) => {
    if (!skuffTrykk) return;
    if (skuffTrykk.modus === 'usikker') {
      if (Math.abs(dxTot) > 10 && Math.abs(dxTot) >= Math.abs(dyTot)) skuffTrykk.modus = 'rull';
      else if (dyTot < -12 && skuffTrykk.id !== null) skuffTrykk.modus = 'loft';
      else return;
    }
    if (skuffTrykk.modus === 'rull') {
      skuff.rullMed(dxSteg);
      return;
    }
    // Loft: flytt brikken under fingeren og la et vanlig drag ta over.
    const b = puslespill.brikker[skuffTrykk.id];
    const verden = kamera.tilVerden(pos.x, pos.y);
    b.x = verden.x - puslespill.brikkeB / 2;
    b.y = verden.y - puslespill.brikkeH / 2;
    b.animX = 0;
    b.animY = 0;
    const h = spill.startDrag(b);
    skuff.uteId = b.id;
    skuffTrykk = null;
    if (!h) return;
    if (tilstand.lyd) lyd.loft();
    return { overtaSomDrag: h };
  },
  opp: () => { skuffTrykk = null; },
  hjul: (d) => skuff.rullMed(-d),
};

new Gester(canvas, kamera, {
  skjermlag: skuffLag,
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
    if (!b) return null;
    // Tar du i en valgt brikke, flyttes hele utvalget.
    if (spill.utvalg.has(b.id)) return spill.startUtvalgDrag();
    return spill.startDrag(b);
  },

  onDragStart: (handtak, verden) => {
    const sett = handtak.utvalg ? handtak.sett : spill.medlemmer(handtak.gruppe);
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
    if (handtak.utvalg) spill.flyttSett(handtak.sett, dx, dy);
    else spill.dragTil(handtak, dx, dy);
    if (tegner.dragGruppe) tegner.dragGruppe.anker = verden;
  },

  onDragSlutt: (handtak, flyttet) => {
    tegner.dragGruppe = null;
    skuff.uteId = null;
    if (!handtak) return;
    // Et trykk uten bevegelse dreier brikken. Deretter provers koblingen
    // som vanlig, sa den siste dreiningen kan vare den som far den pa plass.
    if (!handtak.utvalg && tilstand.rotasjon && flyttet < 9 && spill.drei(handtak.brikke)) {
      animerDreining(handtak.brikke);
      if (tilstand.lyd) lyd.loft();
    }
    // Et utvalg flyttes bare - det skal ikke koble seg sammen av seg selv.
    if (handtak.utvalg) {
      if (tilstand.lyd) lyd.legg();
      oppdaterSkuff();
      return;
    }
    const res = spill.slipp(handtak, toleranse(), tilstand.festTilBrett);
    if (res.koblinger) {
      animerKobling();
      if (tilstand.lyd) (res.hjem ? lyd.fest() : lyd.kobling(res.koblinger));
    } else if (tilstand.lyd) {
      lyd.legg();
    }
    settKantmodus();
    oppdaterSpillstatus();
    oppdaterHjelpetekst();
    oppdaterSkuff();
    if (res.ferdig) feire();
  },

  // --- Lasso -------------------------------------------------------------
  onLassoStart: (verden) => {
    lassoFra = verden;
    tegner.lasso = { x: verden.x, y: verden.y, w: 0, h: 0 };
  },
  onLasso: (verden) => {
    if (!lassoFra) return;
    tegner.lasso = {
      x: lassoFra.x, y: lassoFra.y,
      w: verden.x - lassoFra.x, h: verden.y - lassoFra.y,
    };
  },
  onLassoSlutt: () => {
    if (tegner.lasso) {
      spill.velgIRekt(tegner.lasso);
      tegner.utvalg = spill.utvalg;
      if (tilstand.lyd && spill.utvalg.size) lyd.loft();
    }
    tegner.lasso = null;
    lassoFra = null;
    oppdaterSpillstatus();
  },
  onTomtTrykk: () => {
    if (spill.tomUtvalg()) {
      tegner.utvalg = spill.utvalg;
      tegner.merkSkitten();
      oppdaterSpillstatus();
    }
  },
});

// ---------------------------------------------------------------------------
// Vanskelighetsgrad, kanter forst og forhandsvisning
// ---------------------------------------------------------------------------

/** Er kantrammen ferdig? Da slipper hjelpemodusen taket av seg selv. */
function kanterIgjen() {
  if (!puslespill || !spill) return 0;
  return puslespill.brikker.filter((b) =>
    erKantbrikke(b, puslespill) && !b.laast && spill.medlemmer(b.gruppe).size === 1).length;
}

function kantmodusAktiv() {
  return tilstand.kanterForst && kanterIgjen() > 0;
}

/**
 * Kanter forst holder midtbrikkene unna til rammen er lagt.
 * Brikkene er ikke borte - de er bare ikke i veien enda.
 */
function settKantmodus() {
  const test = (b) => kantmodusAktiv() && !erKantbrikke(b, puslespill);
  spill.skjult = tilstand.kanterForst ? test : null;
  tegner.skjult = tilstand.kanterForst ? test : null;
}

function oppdaterVanskelighet() {
  if (!puslespill || !motiv) return;
  const v = regnVanskelighet({
    antall: puslespill.antall,
    rotasjon: tilstand.rotasjon,
    kuttstil: tilstand.kuttstil,
    puslbarhet: motiv.meta.puslbarhet,
    spokelse: tilstand.spokelse,
    festTilBrett: tilstand.festTilBrett,
    kanterForst: tilstand.kanterForst,
  });
  const m = $('#vanskemerke');
  m.textContent = `${v.niva.navn} · ${v.score}`;
  m.style.color = v.niva.farge;
  return v;
}

function oppdaterHjelpetekst() {
  const igjen = kanterIgjen();
  $('#hjelpetekst').textContent = kantmodusAktiv()
    ? `${igjen} kantbrikker igjen`
    : '';
}

function tegnForhandsvisning() {
  if (!motiv) return;
  const c = $('#forhandsvisning-lerret');
  const b = 420;
  const h = Math.round((b * motiv.canvas.height) / motiv.canvas.width);
  if (c.width !== b || c.height !== h) { c.width = b; c.height = h; }
  c.getContext('2d').drawImage(motiv.canvas, 0, 0, b, h);
}

function brukOppsett(nokkel) {
  const o = OPPSETT[nokkel];
  if (!o) return;
  tilstand.rotasjon = o.rotasjon;
  tilstand.kuttstil = o.kuttstil;
  tilstand.spokelse = o.spokelse;
  tilstand.festTilBrett = o.festTilBrett;
  tilstand.kanterForst = o.kanterForst;
  settAntall(o.antall);
  speilBrytere();
  byggNytt({ nyttMotiv: false });
}

/** Lar knappene vise den tilstanden de faktisk styrer. */
function speilBrytere() {
  $('#kuttstil').value = tilstand.kuttstil;
  $('#spokelse').value = Math.round(tilstand.spokelse * 100);
  $('#fest').classList.toggle('aktiv', tilstand.festTilBrett);
  $('#fest').setAttribute('aria-pressed', String(tilstand.festTilBrett));
  $('#rotasjon').classList.toggle('aktiv', tilstand.rotasjon);
  $('#rotasjon').setAttribute('aria-pressed', String(tilstand.rotasjon));
  $('#kanterforst').classList.toggle('aktiv', tilstand.kanterForst);
  $('#kanterforst').setAttribute('aria-pressed', String(tilstand.kanterForst));
  $('#bildeknapp').classList.toggle('aktiv', tilstand.visBilde);
  $('#lydknapp').classList.toggle('aktiv', tilstand.lyd);
  $('#skuffknapp').classList.toggle('aktiv', skuff.apen);
  tegner.spokelseStyrke = tilstand.spokelse;
  for (const k of document.querySelectorAll('[data-oppsett]')) {
    const o = OPPSETT[k.dataset.oppsett];
    k.classList.toggle('aktiv',
      o.antall === tilstand.onsketAntall && o.rotasjon === tilstand.rotasjon &&
      o.kuttstil === tilstand.kuttstil && o.festTilBrett === tilstand.festTilBrett &&
      o.kanterForst === tilstand.kanterForst);
  }
}

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
  const valgt = spill.utvalg.size ? ` · ${spill.utvalg.size} valgt` : '';
  $('#spillstatus').textContent =
    `${Math.round(andel * puslespill.antall)} / ${puslespill.antall} brikker · ` +
    `${formaterTid(spill.brukteSekunder())}${valgt}`;
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
  if (puslespill && spill) oppdaterSkuff();
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
  speilBrytere();
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
$('#skuffknapp').addEventListener('click', () => {
  skuff.apen = !skuff.apen;
  $('#skuffknapp').classList.toggle('aktiv', skuff.apen);
  oppdaterSkuff();
  tilpassVisning(visHeleBordet ? bord : arbeidsutsnitt());
});
$('#rydd').addEventListener('click', () => {
  const n = ryddBrikker(puslespill, bord, (b) => spill.erLos(b));
  if (n && tilstand.lyd) lyd.legg();
  oppdaterSkuff();
  tegner.merkSkitten();
});
$('#skufffiltre').addEventListener('click', (e) => {
  const k = e.target.closest('[data-filter]');
  if (!k) return;
  skuff.filter = k.dataset.filter;
  skuff.rull = 0;
  oppdaterSkuff();
});
$('#stokk').addEventListener('click', () => {
  spreBrikker(puslespill, bord, tilstand.rotasjon);
  spill = new Spill(puslespill);
  settKantmodus();
  tegner.dragGruppe = null;
  tegner.utvalg = spill.utvalg;
  $('#ferdig').hidden = true;
  startKlokke();
  visHeleBordet = false;
  tilpassVisning(arbeidsutsnitt());
  oppdaterSkuff();
  oppdaterSpillstatus();
});
$('#fasit').addEventListener('click', () => {
  samleBrikker(puslespill);
  tegner.dragGruppe = null;
  tegner.utvalg = null;
  tilpassVisning(puslespill.ramme);
  oppdaterSkuff();
  oppdaterSpillstatus();
});
$('#spokelse').addEventListener('input', (e) => {
  tilstand.spokelse = Number(e.target.value) / 100;
  tegner.spokelseStyrke = tilstand.spokelse;
  oppdaterVanskelighet();
  tegner.merkSkitten();
});
$('#fest').addEventListener('click', () => {
  tilstand.festTilBrett = !tilstand.festTilBrett;
  speilBrytere();
  oppdaterVanskelighet();
});
$('#rotasjon').addEventListener('click', () => {
  tilstand.rotasjon = !tilstand.rotasjon;
  speilBrytere();
  oppdaterVanskelighet();
  // Rotasjon ma deles ut pa nytt, sa brikkene faktisk star feil vei.
  spreBrikker(puslespill, bord, tilstand.rotasjon);
  spill = new Spill(puslespill);
  settKantmodus();
  tegner.dragGruppe = null;
  tegner.utvalg = spill.utvalg;
  startKlokke();
  visHeleBordet = false;
  tilpassVisning(arbeidsutsnitt());
  oppdaterSkuff();
  oppdaterHjelpetekst();
  oppdaterSpillstatus();
});
$('#kanterforst').addEventListener('click', () => {
  tilstand.kanterForst = !tilstand.kanterForst;
  speilBrytere();
  settKantmodus();
  oppdaterVanskelighet();
  oppdaterHjelpetekst();
  oppdaterSkuff();
  tegner.merkSkitten();
});
$('#bildeknapp').addEventListener('click', () => {
  tilstand.visBilde = !tilstand.visBilde;
  $('#forhandsvisning').hidden = !tilstand.visBilde;
  if (tilstand.visBilde) tegnForhandsvisning();
  speilBrytere();
});
$('#forhandsvisning-storre').addEventListener('click', () => {
  $('#forhandsvisning').classList.toggle('stor');
});
$('#oppsett').addEventListener('click', (e) => {
  const k = e.target.closest('[data-oppsett]');
  if (k) brukOppsett(k.dataset.oppsett);
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
// Egne bilder
// ---------------------------------------------------------------------------

function lerretTilBlob(lerret, type = 'image/jpeg', kvalitet = 0.88) {
  return new Promise((ok) => lerret.toBlob((b) => ok(b), type, kvalitet));
}

function lagMiniatyr(lerret, bredde = 148) {
  const h = Math.max(1, Math.round((bredde * lerret.height) / lerret.width));
  const m = document.createElement('canvas');
  m.width = bredde;
  m.height = h;
  m.getContext('2d').drawImage(lerret, 0, 0, bredde, h);
  return m.toDataURL('image/jpeg', 0.72);
}

function apneBeskjaering(bilde, navn) {
  venterBilde = { bilde, navn };
  $('#beskjaer').hidden = false;
  if (!beskjaerer) beskjaerer = new Beskjaerer($('#beskjaer-lerret'));
  // Lerretet hadde ingen størrelse mens vinduet var skjult.
  requestAnimationFrame(() => {
    beskjaerer.tilpassStorrelse();
    beskjaerer.settBilde(bilde);
  });
}

function lukkBeskjaering() {
  $('#beskjaer').hidden = true;
  $('#beskjaer-varsel').hidden = true;
  venterBilde = null;
}

/**
 * Setter et bilde som aktivt motiv.
 * Sideforholdet følger bildet, ikke omvendt – et stående bilde skal ikke
 * bli strukket for å passe inn i et liggende puslespill.
 */
function brukBilde(lerret, navn, id) {
  settAktivtBilde({ lerret, navn, id });
  tilstand.sideforhold = lerret.width / lerret.height;
  tilstand.motiv = 'eget';
  byggMotivvelger();
  oppdaterPalettTilgang();
  oppdaterMineBilder();
  return byggNytt({ nyttMotiv: true });
}

async function lagreOgBruk() {
  if (!venterBilde || !beskjaerer) return;
  const lerret = beskjaerer.resultat(2048);
  const navn = venterBilde.navn;
  lukkBeskjaering();

  const id = lagring.nyId();
  try {
    const blob = await lerretTilBlob(lerret);
    await lagring.lagreBilde({
      id, navn, laget: Date.now(), blob,
      miniatyr: lagMiniatyr(lerret),
      bredde: lerret.width, hoyde: lerret.height,
    });
    mineBilder = await lagring.hentBilder();
  } catch {
    // Blokkert lagring skal ikke hindre at bildet brukes nå.
  }
  await brukBilde(lerret, navn, id);
}

async function velgLagret(post) {
  try {
    const bilde = await createImageBitmap(post.blob);
    await brukBilde(bilde, post.navn, post.id);
  } catch {
    /* ignorer */
  }
}

function oppdaterMineBilder() {
  const rad = $('#minebilder');
  rad.hidden = mineBilder.length === 0;
  const aktiv = hentAktivtBilde();
  $('#minebilder-liste').innerHTML = mineBilder.map((b) => `
    <button class="bildekort${aktiv && aktiv.id === b.id ? ' aktiv' : ''}" data-bilde="${b.id}"
            title="${(b.navn || 'Bilde').replace(/"/g, '')}">
      <img src="${b.miniatyr}" alt="">
      <span class="slett" role="button" data-slett="${b.id}" aria-label="Slett bildet">&times;</span>
    </button>`).join('');
}

/** Advarer for bilder som blir kjedelige å pusle. */
function varsleOmFlateFelt(lerret) {
  const ctx = lerret.getContext('2d', { willReadFrequently: true });
  const { score } = malPuslbarhet(ctx, lerret.width, lerret.height);
  const v = $('#beskjaer-varsel');
  if (score >= 45) { v.hidden = true; return score; }
  v.hidden = false;
  v.textContent = score < 30
    ? `Dette utsnittet har svært store ensfargede felter (puslbarhet ${score} %). Mange brikker blir nesten umulige å plassere – prøv et tettere utsnitt, eller hold deg til få brikker.`
    : `Dette utsnittet har en del ensfargede felter (puslbarhet ${score} %). Det blir hardt med mange brikker.`;
  return score;
}

$('#velgbilde').addEventListener('click', () => $('#bildefil').click());

$('#bildefil').addEventListener('change', async (e) => {
  const fil = e.target.files && e.target.files[0];
  e.target.value = '';                       // så samme fil kan velges igjen
  if (!fil) return;
  $('#laster').hidden = false;
  $('#laster-tekst').textContent = 'Leser bildet …';
  try {
    const bilde = await lesBildefil(fil);
    apneBeskjaering(bilde, fil.name.replace(/\.[^.]+$/, ''));
  } catch {
    $('#status').textContent = 'Klarte ikke å lese bildet. Prøv et annet format.';
  } finally {
    $('#laster').hidden = true;
  }
});

$('#beskjaer-format').addEventListener('click', (e) => {
  const k = e.target.closest('[data-aspekt]');
  if (!k || !beskjaerer) return;
  for (const b of $('#beskjaer-format').children) b.classList.toggle('aktiv', b === k);
  beskjaerer.settAspekt(Number(k.dataset.aspekt));
  varsleOmFlateFelt(beskjaerer.resultat(560));
});

$('#beskjaer-lerret').addEventListener('pointerup', () => {
  if (beskjaerer && venterBilde) varsleOmFlateFelt(beskjaerer.resultat(560));
});

$('#beskjaer-avbryt').addEventListener('click', lukkBeskjaering);
$('#beskjaer-ok').addEventListener('click', lagreOgBruk);

$('#minebilder-liste').addEventListener('click', async (e) => {
  const slett = e.target.closest('[data-slett]');
  if (slett) {
    e.stopPropagation();
    await lagring.slettBilde(slett.dataset.slett).catch(() => {});
    mineBilder = await lagring.hentBilder().catch(() => mineBilder);
    oppdaterMineBilder();
    return;
  }
  const kort = e.target.closest('[data-bilde]');
  if (!kort) return;
  const post = mineBilder.find((b) => b.id === kort.dataset.bilde);
  if (post) velgLagret(post);
});

// ---------------------------------------------------------------------------
// Oppstart
// ---------------------------------------------------------------------------

const motivVelger = $('#motiv');

function byggMotivvelger() {
  const valgt = tilstand.motiv;
  motivVelger.innerHTML = '<option value="tilfeldig">Tilfeldig</option>';
  const grupper = new Map();
  for (const [n, m] of tilgjengeligeMotiv()) {
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
  motivVelger.value = valgt;
  if (!motivVelger.value) motivVelger.value = 'tilfeldig';
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
  tegner, kamera, tilstand, byggNytt, settAntall, toleranse, skuff, oppdaterSkuff,
};

$('#oppsett').innerHTML = Object.entries(OPPSETT)
  .map(([n, o]) => `<button data-oppsett="${n}">${o.navn}</button>`).join('');

byggMotivvelger();
oppdaterPalettTilgang();
settAntall(100);
speilBrytere();
tilpassCanvas();
byggNytt();

lagring.hentBilder()
  .then((liste) => { mineBilder = liste; oppdaterMineBilder(); })
  .catch(() => {});

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
