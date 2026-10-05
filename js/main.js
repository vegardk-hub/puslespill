import { randomSeed } from './core/rng.js';
import { solveGrid, describeGrid } from './core/grid.js';
import { lagPuslespill, spreBrikker, samleBrikker, ryddBrikker } from './core/puzzle.js';
import { Spill, formaterTid } from './core/spill.js';
import { regnVanskelighet, OPPSETT } from './core/vanskelighet.js';
import { pakk, pakkUt, dagensOppskrift } from './core/okt.js';
import { erKantbrikke } from './ui/skuff.js';
import { byggAtlas } from './render/atlas.js';
import { Kamera } from './render/camera.js';
import { Tegner, MAKS_LOFT } from './render/renderer.js';
import { Gester } from './input/gester.js';
import { Skuff, FARGEBOTTER } from './ui/skuff.js';
import { Konfetti } from './ui/konfetti.js';
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
const konfetti = new Konfetti();
tegner.konfetti = konfetti;
const roligBevegelse = window.matchMedia('(prefers-reduced-motion: reduce)');

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
  bildeId: null,
  dagens: null,
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
let fullforte = [];
let bildeFraStart = false;
let lagringsUr = 0;
let gjenoppretter = false;

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
  const t = $('#topplinje').getBoundingClientRect();
  return {
    topp: t.bottom + 8,
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

async function byggNytt({ nyttMotiv = true, stilling = null } = {}) {
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
  const gjenopprettet = stilling ? pakkUt(stilling, puslespill, spill, kamera) : false;
  settKantmodus();

  atlas = byggAtlas(motiv.canvas, puslespill);
  const tAtlas = performance.now() - t1;

  tegner.spokelseStyrke = tilstand.spokelse;
  tegner.settPuslespill(puslespill, atlas, motiv.canvas);
  kamera.minSkala = Math.min(visning().b / bord.w, visning().h / bord.h) * 0.75;
  visHeleBordet = false;
  // En gjenopprettet okt beholder utsnittet man forlot.
  if (!gjenopprettet) tilpassVisning(arbeidsutsnitt());
  else { kamera.begrens(bord, visning().b, visning().h); tegner.merkSkitten(); }

  startKlokke();
  oppdaterStatus({ tMotiv, tAtlas });
  oppdaterVanskelighet();
  oppdaterHjelpetekst();
  tegnForhandsvisning();
  oppdaterSkuff();
  oppdaterSpillstatus();
  $('#laster').hidden = true;
  if (!gjenoppretter) lagreSnart();
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

/**
 * Konfetti i skjermkoordinater. Respekterer at noen slår av bevegelse -
 * da kommer kortet alene, uten at noe faller.
 */
function slippKonfetti() {
  if (roligBevegelse.matches) return;
  const v = visning();
  konfetti.slipp(v.b, v.h);
  let forrige = performance.now();
  tegner.animer((na) => {
    const dt = Math.min(0.05, (na - forrige) / 1000);
    forrige = na;
    return konfetti.oppdater(dt, v.h);
  });
}

function feire() {
  stoppKlokke();
  slippKonfetti();
  lagreIFullforte();
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
  onBeroring: () => {
    if (tilstand.lyd) lyd.vekk();
    holdSkjermenVaken();
  },

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
    if (!handtak) { lagreSnart(); return; }
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
      lagreSnart();
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
    lagreSnart();
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
  ikkeLengerDagens();
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

/**
 * Holder skjermen vaken mens man pusler.
 * Et puslespill er lange perioder med ettertanke og korte berøringer, og
 * iPaden rekker å sovne imellom. Låsen må be om seg selv på nytt etter at
 * appen har vært i bakgrunnen.
 */
let vakenLas = null;
async function holdSkjermenVaken() {
  if (!('wakeLock' in navigator) || vakenLas) return;
  try {
    vakenLas = await navigator.wakeLock.request('screen');
    vakenLas.addEventListener('release', () => { vakenLas = null; });
  } catch {
    // Ikke tilgjengelig, eller nektet. Da sovner skjermen som vanlig.
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') holdSkjermenVaken();
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

/** Endrer man oppsettet, er det ikke dagens puslespill lenger. */
function ikkeLengerDagens() {
  tilstand.dagens = null;
}

function settAntall(n) {
  tilstand.onsketAntall = Math.max(4, Math.min(500, Math.round(n)));
  $('#eget-antall').value = tilstand.onsketAntall;
  for (const b of document.querySelectorAll('[data-forhandsvalg]')) {
    b.classList.toggle('aktiv', Number(b.dataset.forhandsvalg) === tilstand.onsketAntall);
  }
}

document.querySelectorAll('[data-forhandsvalg]').forEach((b) => {
  b.addEventListener('click', () => {
    ikkeLengerDagens();
    settAntall(Number(b.dataset.forhandsvalg));
    byggNytt({ nyttMotiv: false });
  });
});
$('#eget-antall').addEventListener('change', (e) => {
  ikkeLengerDagens();
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
  ikkeLengerDagens();
  tilstand.motiv = e.target.value;
  oppdaterPalettTilgang();
  byggNytt({ nyttMotiv: true });
});
$('#kuttstil').addEventListener('change', (e) => {
  ikkeLengerDagens();
  tilstand.kuttstil = e.target.value;
  speilBrytere();
  byggNytt({ nyttMotiv: false });
});
$('#palett').addEventListener('change', (e) => {
  tilstand.palett = e.target.value;
  byggNytt({ nyttMotiv: true });
});
$('#nytt').addEventListener('click', () => {
  ikkeLengerDagens();
  tilstand.seed = randomSeed();
  byggNytt({ nyttMotiv: true });
});
$('#skuffknapp').addEventListener('click', () => {
  skuff.apen = !skuff.apen;
  $('#skuffknapp').classList.toggle('aktiv', skuff.apen);
  oppdaterSkuff();
  tilpassVisning(visHeleBordet ? bord : arbeidsutsnitt());
  lagreSnart();
});
$('#rydd').addEventListener('click', () => {
  const n = ryddBrikker(puslespill, bord, (b) => spill.erLos(b));
  if (n && tilstand.lyd) lyd.legg();
  oppdaterSkuff();
  tegner.merkSkitten();
  lagreSnart();
});
$('#skufffiltre').addEventListener('click', (e) => {
  const k = e.target.closest('[data-filter]');
  if (!k) return;
  skuff.filter = k.dataset.filter;
  skuff.rull = 0;
  oppdaterSkuff();
  lagreSnart();
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
  lagreSnart();
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
  lagreSnart();
});
$('#fest').addEventListener('click', () => {
  tilstand.festTilBrett = !tilstand.festTilBrett;
  speilBrytere();
  oppdaterVanskelighet();
  lagreSnart();
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
  lagreSnart();
});
$('#kanterforst').addEventListener('click', () => {
  tilstand.kanterForst = !tilstand.kanterForst;
  speilBrytere();
  settKantmodus();
  oppdaterVanskelighet();
  oppdaterHjelpetekst();
  oppdaterSkuff();
  tegner.merkSkitten();
  lagreSnart();
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
  lagreSnart();
});
$('#ferdig').addEventListener('click', () => {
  $('#ferdig').hidden = true;
  konfetti.stopp();
  tegner.merkSkitten();
});
/** Menyen dekker bordet, så den lukkes lett: skygge, kryss eller Escape. */
function settMeny(apen) {
  $('#meny').hidden = !apen;
  $('#menyskygge').hidden = !apen;
  $('#menyknapp').setAttribute('aria-expanded', String(apen));
  if (apen) $('#meny-lukk').focus();
  else $('#menyknapp').focus();
}

$('#menyknapp').addEventListener('click', () => settMeny($('#meny').hidden));
$('#meny-lukk').addEventListener('click', () => settMeny(false));
$('#menyskygge').addEventListener('click', () => settMeny(false));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#meny').hidden) settMeny(false);
  else if (!$('#samling').hidden) $('#samling').hidden = true;
  else if (!$('#ferdig').hidden) $('#ferdig').hidden = true;
});

// ---------------------------------------------------------------------------
// Startskjermen
// ---------------------------------------------------------------------------
//
// To valg: hvilket bilde, og hvor mange brikker. Appen er primært for barn,
// og da er et dusin nedtrekksmenyer feil svar. Alt det detaljerte finnes
// fortsatt, men bak «Flere valg».

/** Brikketall på startskjermen, med ord et barn kan forstå. */
const STARTANTALL = [
  { n: 12, ord: 'Helt lett' },
  { n: 24, ord: 'Lett' },
  { n: 50, ord: 'Passe' },
  { n: 100, ord: 'Litt vrient' },
  { n: 200, ord: 'Vanskelig' },
  { n: 500, ord: 'Verst som finnes' },
];

/** Rekkefølgen bildene vises i. Figurene først – de er for barna. */
const STARTMOTIV = ['dinosaur', 'hus', 'bil', 'rakett', 'bat', 'katt', 'neon'];

const miniatyrer = new Map();
let startKlar = false;

function byggStartantall() {
  $('#start-antall').innerHTML = STARTANTALL.map((a) => `
    <button class="antallknapp" data-startantall="${a.n}">
      <b>${a.n}</b><span>${a.ord}</span>
    </button>`).join('');
  merkStartvalg();
}

function byggStartmotiv() {
  const kort = STARTMOTIV
    .filter((n) => MOTIVER[n])
    .map((n) => `
      <button class="motivkort" data-startmotiv="${n}" data-miniatyr="${n}">
        <span>${MOTIVER[n].navn}</span>
      </button>`);

  kort.push(`
    <button class="motivkort eget" data-startmotiv="tilfeldig">
      <b>?</b><span>Overraskelse</span>
    </button>`);

  // Ett kort per lagret bilde. Miniatyren ligger allerede i databasen, så
  // de koster ingenting å vise.
  for (const b of mineBilder) {
    kort.push(`
      <button class="motivkort" data-startmotiv="bilde" data-bildeid="${b.id}">
        <img src="${b.miniatyr}" alt="">
        <span>${(b.navn || 'Eget bilde').slice(0, 22)}</span>
      </button>`);
  }

  // Pluss-kortet skal ALLTID være der. Før erstattet bildet ditt det, og
  // da fantes det ingen vei til bilde nummer to.
  kort.push(`
    <button class="motivkort eget" data-startmotiv="nytt-bilde">
      <b>+</b><span>${mineBilder.length ? 'Nytt bilde' : 'Eget bilde'}</span>
    </button>`);

  $('#start-motiv').innerHTML = kort.join('');
  fyllMiniatyrer();
  merkStartvalg();
}

/**
 * Tegner miniatyrene én om gangen.
 * Sju motiv tar rundt 200 ms til sammen. Deles de opp, er skjermen framme
 * med én gang og fylles ut mens man ser på den.
 */
function fyllMiniatyrer() {
  const igjen = [...$('#start-motiv').querySelectorAll('[data-miniatyr]')];

  const neste = () => {
    const kort = igjen.shift();
    if (!kort) return;
    const n = kort.dataset.miniatyr;
    try {
      if (!miniatyrer.has(n)) {
        miniatyrer.set(n, genererMotiv(n, 280, 187, 'forhand-' + n).canvas);
      }
      const kilde = miniatyrer.get(n);
      const c = document.createElement('canvas');
      c.width = kilde.width;
      c.height = kilde.height;
      c.getContext('2d').drawImage(kilde, 0, 0);
      kort.prepend(c);
    } catch {
      /* hopp over motiv som ikke lar seg tegne */
    }
    setTimeout(neste, 0);
  };
  setTimeout(neste, 0);
}

function merkStartvalg() {
  for (const k of document.querySelectorAll('[data-startmotiv]')) {
    const erBilde = k.dataset.startmotiv === 'bilde';
    k.classList.toggle('aktiv', erBilde
      ? tilstand.motiv === 'eget' && tilstand.bildeId === k.dataset.bildeid
      : k.dataset.startmotiv === tilstand.motiv);
  }
  for (const k of document.querySelectorAll('[data-startantall]')) {
    k.classList.toggle('aktiv', Number(k.dataset.startantall) === tilstand.onsketAntall);
  }
}

/**
 * Hintet om full skjerm.
 *
 * Nettleserne gjør dette på tre helt ulike måter, så appen må si tre ulike
 * ting:
 *
 *   Chrome og Edge  kan installere appen med ett trykk. Da viser vi en ekte
 *                   knapp i stedet for en bruksanvisning.
 *   Safari på iOS   har ingen slik knapp, og ingen nettside får lov til å
 *                   skjule Safaris grensesnitt. Det eneste som virker er
 *                   Del-knappen og «Legg til på Hjem-skjerm».
 *   Chrome på iOS   kan ikke installere i det hele tatt – Apple lar bare
 *                   Safari gjøre det. Da er det ærligere å si fra enn å gi
 *                   en oppskrift som ikke finnes.
 */
let installLofte = null;

function erEgenApp() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.matchMedia('(display-mode: fullscreen)').matches ||
         window.navigator.standalone === true;
}

/** Chrome og Edge tilbyr installasjon selv. Vi tar imot tilbudet og venter. */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installLofte = e;
  oppdaterHeltskjermHint();
});

window.addEventListener('appinstalled', () => {
  installLofte = null;
  $('#heltskjerm-hint').hidden = true;
  skjulHintForGodt();
});

function skjulHintForGodt() {
  try {
    localStorage.setItem('puslespill-hint-skjult', '1');
  } catch {
    /* ikke viktig nok til å bry seg */
  }
}

function nettlesersituasjon() {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // På iOS er alle nettlesere WebKit under panseret, men bare Safari får
  // lov til å legge noe på hjemskjermen.
  const annenPaIos = iOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  if (installLofte) return 'installer';
  if (annenPaIos) return 'ios-annen';
  if (iOS) return 'ios-safari';
  return 'meny';
}

const HINT = {
  installer: {
    tittel: 'Vil du ha hele skjermen?',
    tekst: 'Installer puslespillet som en egen app. Da starter det uten ' +
           'nettleseren rundt, og brettet får hele skjermen.',
    knapp: true,
  },
  'ios-safari': {
    tittel: 'Vil du ha hele skjermen?',
    tekst: 'Trykk <strong>Del</strong>-knappen i Safari og velg ' +
           '<strong>«Legg til på Hjem-skjerm»</strong>. Da starter ' +
           'puslespillet som en egen app, uten nettleseren rundt – og ' +
           'brettet blir større.',
    knapp: false,
  },
  'ios-annen': {
    tittel: 'Åpne i Safari for hele skjermen',
    tekst: 'På iPad er det bare Safari som kan legge en app på hjemskjermen. ' +
           'Åpner du denne lenken i Safari, kan du velge ' +
           '<strong>Del → «Legg til på Hjem-skjerm»</strong>, og da får ' +
           'puslespillet hele skjermen.',
    knapp: false,
  },
  meny: {
    tittel: 'Vil du ha hele skjermen?',
    tekst: 'Åpne nettlesermenyen og velg <strong>«Installer app»</strong> ' +
           'eller <strong>«Legg til på startskjerm»</strong>. Da starter ' +
           'puslespillet uten nettleseren rundt.',
    knapp: false,
  },
};

function oppdaterHeltskjermHint() {
  let avvist = false;
  try {
    avvist = localStorage.getItem('puslespill-hint-skjult') === '1';
  } catch {
    // Blokkert lagring. Da viser vi hintet; det er bare en liten plage.
  }
  const kort = $('#heltskjerm-hint');
  if (erEgenApp() || avvist) {
    kort.hidden = true;
    return;
  }
  const h = HINT[nettlesersituasjon()];
  $('#hint-tittel').textContent = h.tittel;
  $('#hint-tekst').innerHTML = h.tekst;
  $('#hint-installer').hidden = !h.knapp;
  kort.hidden = false;
}

$('#hint-installer').addEventListener('click', async () => {
  if (!installLofte) return;
  const lofte = installLofte;
  installLofte = null;
  try {
    await lofte.prompt();
    const svar = await lofte.userChoice;
    if (svar.outcome === 'accepted') {
      $('#heltskjerm-hint').hidden = true;
      skjulHintForGodt();
    } else {
      oppdaterHeltskjermHint();   // takket nei: fall tilbake til bruksanvisning
    }
  } catch {
    oppdaterHeltskjermHint();
  }
});

$('#heltskjerm-lukk').addEventListener('click', () => {
  $('#heltskjerm-hint').hidden = true;
  skjulHintForGodt();
});

function visStart() {
  if (!startKlar) {
    byggStartantall();
    byggStartmotiv();
    startKlar = true;
  } else {
    merkStartvalg();
  }
  oppdaterFortsett();
  oppdaterHeltskjermHint();
  $('#start').hidden = false;
  settMeny(false);
}

function skjulStart() {
  $('#start').hidden = true;
}

/** Knappen øverst vises bare når det faktisk finnes noe å fortsette på. */
async function oppdaterFortsett() {
  let okt = null;
  try {
    okt = await lagring.hentSpill();
  } catch {
    /* ingen lagring */
  }
  const knapp = $('#fortsett');
  if (!okt || !okt.oppskrift) {
    knapp.hidden = true;
    return;
  }
  const navn = MOTIVER[okt.oppskrift.motiv]?.navn || 'Puslespill';
  const sek = Math.round(okt.fremdrift?.sekunder || 0);
  $('#fortsett-tekst').textContent =
    `${navn} · ${okt.stilling?.x?.length || 0} brikker · ${formaterTid(sek)}`;
  knapp.hidden = false;
  knapp.dataset.okt = '1';
}

$('#start-motiv').addEventListener('click', async (e) => {
  const k = e.target.closest('[data-startmotiv]');
  if (!k) return;

  if (k.dataset.startmotiv === 'nytt-bilde') {
    bildeFraStart = true;
    $('#bildefil').click();
    return;
  }

  ikkeLengerDagens();

  if (k.dataset.startmotiv === 'bilde') {
    const post = mineBilder.find((b) => b.id === k.dataset.bildeid);
    // Bildet velges bare - det er «Pusle!» som starter spillet.
    if (post) await velgLagret(post, { startSpill: false });
    merkStartvalg();
    return;
  }

  tilstand.motiv = k.dataset.startmotiv;
  byggMotivvelger();
  oppdaterPalettTilgang();
  merkStartvalg();
});

$('#start-antall').addEventListener('click', (e) => {
  const k = e.target.closest('[data-startantall]');
  if (!k) return;
  ikkeLengerDagens();
  settAntall(Number(k.dataset.startantall));
  merkStartvalg();
});

$('#start-spill').addEventListener('click', async () => {
  tilstand.seed = randomSeed();
  skjulStart();
  await byggNytt({ nyttMotiv: true });
});

$('#fortsett').addEventListener('click', async () => {
  skjulStart();
  const fortsatte = await gjenopprett({ byggOgsa: true });
  if (!fortsatte) await byggNytt({ nyttMotiv: true });
});

$('#start-flere').addEventListener('click', () => settMeny(true));
$('#start-samling').addEventListener('click', visSamling);
$('#hjemknapp').addEventListener('click', () => { lagreNa(); visStart(); });
$('#ferdig-nytt').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#ferdig').hidden = true;
  konfetti.stopp();
  visStart();
});
$('#ferdig-lukk').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#ferdig').hidden = true;
  konfetti.stopp();
  tegner.merkSkitten();
});

// ---------------------------------------------------------------------------
// Lagring: pågående spill, innstillinger og samlingen
// ---------------------------------------------------------------------------

/**
 * Ber om lagring snart. Vi venter litt, så et drag med mange slipp ikke
 * blir til ett skriv per slipp.
 */
function lagreSnart() {
  if (gjenoppretter) return;
  clearTimeout(lagringsUr);
  lagringsUr = setTimeout(lagreNa, 1200);
}

/**
 * Skriver tilstanden til IndexedDB.
 *
 * Rekkefølgen er ikke tilfeldig. Ved pagehide river nettleseren siden ned
 * etter første await, og alt som ligger bak den awaiten blir aldri kjørt.
 * Første versjon lagret innstillingene først og spillet etterpå — da gikk
 * spillet tapt hver gang appen ble lukket, og klokka hoppet tilbake til
 * forrige autolagring. Derfor pakkes stillingen synkront, og skrivingen av
 * selve spillet settes i gang før noe annet.
 */
function lagreNa() {
  clearTimeout(lagringsUr);
  if (!puslespill || !spill || gjenoppretter) return Promise.resolve();

  const ferdig = spill.erFerdig();
  const post = ferdig ? null : pakk(tilstand, puslespill, spill, kamera);
  const valg = {
    motiv: tilstand.motiv, onsketAntall: tilstand.onsketAntall,
    kuttstil: tilstand.kuttstil, palett: tilstand.palett,
    spokelse: tilstand.spokelse, festTilBrett: tilstand.festTilBrett,
    rotasjon: tilstand.rotasjon, kanterForst: tilstand.kanterForst,
    visBilde: tilstand.visBilde, lyd: tilstand.lyd,
    skuffApen: skuff.apen, skuffFilter: skuff.filter,
  };

  const spillSkriv = (post ? lagring.lagreSpill(post) : lagring.slettSpill())
    .catch(() => {});
  const valgSkriv = lagring.lagreInnstillinger(valg).catch(() => {});
  return Promise.all([spillSkriv, valgSkriv]);
}

// iOS kan ta livet av en bakgrunnsfane uten forvarsel. Dette er det eneste
// virkelig pålitelige øyeblikket til å skrive.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') lagreNa();
});
window.addEventListener('pagehide', lagreNa);

function brukInnstillinger(v) {
  if (!v) return;
  for (const n of ['onsketAntall', 'spokelse']) {
    if (typeof v[n] === 'number') tilstand[n] = v[n];
  }
  for (const n of ['festTilBrett', 'rotasjon', 'kanterForst', 'visBilde', 'lyd']) {
    if (typeof v[n] === 'boolean') tilstand[n] = v[n];
  }
  for (const n of ['motiv', 'kuttstil', 'palett']) {
    if (typeof v[n] === 'string') tilstand[n] = v[n];
  }
  if (typeof v.skuffApen === 'boolean') skuff.apen = v.skuffApen;
  if (typeof v.skuffFilter === 'string') skuff.filter = v.skuffFilter;
}

/** Henter fram igjen bildet en lagret økt brukte. */
async function lastBildeFor(id) {
  if (!id) return false;
  try {
    const post = await lagring.hentBilde(id);
    if (!post) return false;
    const bilde = await createImageBitmap(post.blob);
    settAktivtBilde({ lerret: bilde, navn: post.navn, id: post.id });
    tilstand.bildeId = post.id;
    byggMotivvelger();
    return true;
  } catch {
    return false;
  }
}

/**
 * Starter appen slik man forlot den.
 * Brikkeformene følger av (motiv, antall, kuttstil, seed), så økten kan
 * bygges helt opp igjen fra fire tall — posisjonene legges bare oppå.
 */
async function gjenopprett({ byggOgsa = false } = {}) {
  gjenoppretter = true;
  try {
    const [valg, okt, bilder, ferdige] = await Promise.all([
      lagring.hentInnstillinger().catch(() => null),
      lagring.hentSpill().catch(() => null),
      lagring.hentBilder().catch(() => []),
      lagring.hentFullforte().catch(() => []),
    ]);
    mineBilder = bilder;
    fullforte = ferdige;
    brukInnstillinger(valg);

    if (byggOgsa && okt && okt.oppskrift) {
      const o = okt.oppskrift;
      const bildeOk = !o.bildeId || await lastBildeFor(o.bildeId);
      if (!bildeOk) {
        // Bildet er slettet. Da finnes ikke puslespillet lenger heller.
        await lagring.slettSpill().catch(() => {});
      } else {
        Object.assign(tilstand, o);
        if (okt.brytere) Object.assign(tilstand, okt.brytere);
        settAntall(tilstand.onsketAntall);
        speilBrytere();
        byggMotivvelger();
        oppdaterPalettTilgang();
        gjenoppretter = false;
        await byggNytt({ nyttMotiv: true, stilling: okt });
        oppdaterMineBilder();
        return true;
      }
    }

    settAntall(tilstand.onsketAntall);
    speilBrytere();
    byggMotivvelger();
    oppdaterPalettTilgang();
  } catch {
    /* Ny start er et helt greit utfall. */
  } finally {
    gjenoppretter = false;
  }
  oppdaterMineBilder();
  return false;
}

// --- Samlingen -------------------------------------------------------------

function miniatyrAvMotiv(bredde = 300) {
  const h = Math.max(1, Math.round((bredde * motiv.canvas.height) / motiv.canvas.width));
  const c = document.createElement('canvas');
  c.width = bredde;
  c.height = h;
  c.getContext('2d').drawImage(motiv.canvas, 0, 0, bredde, h);
  return c.toDataURL('image/jpeg', 0.75);
}

async function lagreIFullforte() {
  const v = oppdaterVanskelighet();
  try {
    await lagring.lagreFullfort({
      id: lagring.nyId(),
      dato: Date.now(),
      motiv: motiv.meta.navn,
      brikker: puslespill.antall,
      sekunder: Math.round(spill.brukteSekunder()),
      trekk: spill.trekk,
      vanskelighet: v ? v.score : null,
      niva: v ? v.niva.navn : null,
      dagens: tilstand.dagens || null,
      miniatyr: miniatyrAvMotiv(),
    });
    await lagring.slettSpill();
    fullforte = await lagring.hentFullforte();
  } catch {
    /* ignorer */
  }
}

function datostempel(d = new Date()) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/** Hvor mange dager på rad dagens puslespill er løst. */
function dagsrekke() {
  const dager = new Set(fullforte.filter((f) => f.dagens).map((f) => f.dagens));
  if (!dager.size) return 0;
  const d = new Date();
  let rekke = 0;
  // Dagens er kanskje ikke løst ennå. Det bryter ikke rekka fram til i går.
  if (!dager.has(datostempel(d))) d.setDate(d.getDate() - 1);
  while (dager.has(datostempel(d))) {
    rekke++;
    d.setDate(d.getDate() - 1);
  }
  return rekke;
}

function visSamling() {
  const brikker = fullforte.reduce((s, f) => s + (f.brikker || 0), 0);
  const tid = fullforte.reduce((s, f) => s + (f.sekunder || 0), 0);
  const timer = tid / 3600;
  const tall = [
    [fullforte.length, 'fullført'],
    [brikker.toLocaleString('no'), 'brikker lagt'],
    [timer >= 1 ? timer.toFixed(1) + ' t' : Math.round(tid / 60) + ' min', 'brukt'],
    [dagsrekke(), 'dager på rad'],
  ];
  $('#samling-tall').innerHTML = tall
    .map(([v, n]) => '<div class="talltavle"><b>' + v + '</b><span>' + n + '</span></div>').join('');

  $('#samling-liste').innerHTML = fullforte.length
    ? fullforte.map((f) => `
      <figure class="fullfortkort">
        ${f.dagens ? '<span class="merke">Dagens</span>' : ''}
        <img src="${f.miniatyr}" alt="">
        <figcaption>
          <b>${f.motiv || 'Puslespill'}</b>
          ${f.brikker} brikker &middot; ${formaterTid(f.sekunder)}<br>
          ${new Date(f.dato).toLocaleDateString('no')}${f.niva ? ' &middot; ' + f.niva : ''}
        </figcaption>
      </figure>`).join('')
    : '<p class="samling-tom">Ingen ferdige puslespill ennå.<br>Legg den siste brikken, så dukker det opp her.</p>';

  $('#samling').hidden = false;
}

$('#samlingknapp').addEventListener('click', visSamling);
$('#samling-lukk').addEventListener('click', () => { $('#samling').hidden = true; });

$('#dagens').addEventListener('click', () => {
  const o = dagensOppskrift();
  Object.assign(tilstand, o);
  tilstand.bildeId = null;
  tilstand.rotasjon = false;
  tilstand.kanterForst = false;
  settAntall(o.onsketAntall);
  speilBrytere();
  byggMotivvelger();
  oppdaterPalettTilgang();
  byggNytt({ nyttMotiv: true });
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
/**
 * @param {boolean} opts.startSpill  false når man bare velger på startskjermen
 * @param {boolean} opts.nyttKort    true når et helt nytt bilde er kommet til
 */
function brukBilde(lerret, navn, id, { startSpill = true, nyttKort = false } = {}) {
  ikkeLengerDagens();
  settAktivtBilde({ lerret, navn, id });
  tilstand.bildeId = id;
  tilstand.sideforhold = lerret.width / lerret.height;
  tilstand.motiv = 'eget';
  byggMotivvelger();
  oppdaterPalettTilgang();
  oppdaterMineBilder();
  if (nyttKort) byggStartmotiv();
  if (!startSpill) {
    merkStartvalg();
    return Promise.resolve();
  }
  skjulStart();
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
  // Kom man fra startskjermen, blir man der - med det nye bildet valgt.
  // Da kan man legge til flere, og velge brikketall før man setter i gang.
  const fraStart = bildeFraStart;
  bildeFraStart = false;
  await brukBilde(lerret, navn, id, { startSpill: !fraStart, nyttKort: true });
}

async function velgLagret(post, opts = {}) {
  try {
    const bilde = await createImageBitmap(post.blob);
    await brukBilde(bilde, post.navn, post.id, opts);
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

$('#velgbilde').addEventListener('click', () => {
  bildeFraStart = false;
  $('#bildefil').click();
});

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
    if (tilstand.bildeId === slett.dataset.slett) {
      tilstand.bildeId = null;
      await lagring.slettSpill().catch(() => {});
    }
    mineBilder = await lagring.hentBilder().catch(() => mineBilder);
    oppdaterMineBilder();
    byggStartmotiv();
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

settMeny(false);
$('#oppsett').innerHTML = Object.entries(OPPSETT)
  .map(([n, o]) => `<button data-oppsett="${n}">${o.navn}</button>`).join('');

byggMotivvelger();
oppdaterPalettTilgang();
tilpassCanvas();

gjenopprett().then(() => visStart());

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
