// Puslespillmodellen. Rent data - vet ingenting om tegning eller input.

import { makeRng } from './rng.js';
import { solveGrid } from './grid.js';
import { buildEdges, pieceOutline, outlineToPath2D, outlineBBox, CUT_STYLES } from './shape.js';

/**
 * @param {{bredde:number, hoyde:number}} bilde  kildebildets pikselmal
 * @param {number} onsketAntall
 * @param {{seed:string, kuttstil:string}} opts
 */
export function lagPuslespill(bilde, onsketAntall, opts = {}) {
  const seed = opts.seed || 'puslespill';
  const kuttstil = opts.kuttstil || 'klassisk';
  const stil = CUT_STYLES[kuttstil] || CUT_STYLES.klassisk;

  const rutenett = solveGrid(onsketAntall, bilde.bredde / bilde.hoyde);
  const { cols, rows } = rutenett;
  const brikkeB = bilde.bredde / cols;
  const brikkeH = bilde.hoyde / rows;

  const rng = makeRng(seed + ':form');
  const kanter = buildEdges(cols, rows, brikkeB, brikkeH, rng, stil);

  const brikker = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const omriss = pieceOutline(kanter, r, c);
      const bbox = outlineBBox(omriss);
      brikker.push({
        id: r * cols + c,
        r, c,
        // Cellens ovre venstre hjorne i bildekoordinater. All plassering
        // regnes ut fra denne, sa brikker med ulik tapp fortsatt passer.
        hjemX: kanter.gx(c),
        hjemY: kanter.gy(r),
        // Naverende posisjon i verdenskoordinater (fase 3 flytter pa disse).
        x: kanter.gx(c),
        y: kanter.gy(r),
        omriss,
        path: outlineToPath2D(omriss),
        bbox,
        gruppe: r * cols + c,
        // Forskyvning som animeres mot null nar en brikke smetter pa plass.
        animX: 0,
        animY: 0,
        // Rotasjon i kvarte omdreininger, 0-3. animRot animeres mot null.
        rot: 0,
        animRot: 0,
        laast: false,
      });
    }
  }

  const modell = {
    seed,
    kuttstil,
    cols,
    rows,
    antall: brikker.length,
    onsketAntall,
    rutenett,
    brikkeB,
    brikkeH,
    bilde,
    brikker,
    /** gruppeId -> Set av brikke-id. En gruppe flyttes som en enhet. */
    grupper: new Map(),
    /** Tegnerekkefolge. Siste element ligger overst. */
    rekkefolge: brikker.map((b) => b.id),
    /** Puslespillets ramme i verdenskoordinater. */
    ramme: { x: 0, y: 0, w: bilde.bredde, h: bilde.hoyde },
  };
  nullstillGrupper(modell);
  return modell;
}

/** Hver brikke i sin egen gruppe. */
export function nullstillGrupper(puslespill) {
  puslespill.grupper.clear();
  for (const b of puslespill.brikker) {
    b.gruppe = b.id;
    b.laast = false;
    b.animX = 0;
    b.animY = 0;
    b.animRot = 0;
    puslespill.grupper.set(b.id, new Set([b.id]));
  }
  puslespill.rekkefolge = puslespill.brikker.map((b) => b.id);
}

/** Naboer i rutenettet - grunnlaget for snapping i fase 3. */
export function naboer(puslespill, brikke) {
  const { cols, rows, brikker } = puslespill;
  const ut = [];
  const { r, c } = brikke;
  if (r > 0) ut.push(brikker[(r - 1) * cols + c]);
  if (r < rows - 1) ut.push(brikker[(r + 1) * cols + c]);
  if (c > 0) ut.push(brikker[r * cols + c - 1]);
  if (c < cols - 1) ut.push(brikker[r * cols + c + 1]);
  return ut;
}

/**
 * Sprer brikkene i feltet rundt rammen.
 * @param {boolean} medRotasjon gir hver brikke en tilfeldig kvart omdreining
 */
export function spreBrikker(puslespill, bord, medRotasjon = false) {
  const rng = makeRng(puslespill.seed + ':spredning');
  for (const b of puslespill.brikker) {
    // Fordel i den frie sonen rundt puslespillet.
    const side = rng.int(0, 3);
    const m = puslespill.brikkeB * 1.4;
    if (side === 0) {       // venstre
      b.x = rng.range(bord.x + m, -m);
      b.y = rng.range(bord.y + m, bord.y + bord.h - m);
    } else if (side === 1) { // hoyre
      b.x = rng.range(puslespill.ramme.w + m * 0.2, bord.x + bord.w - m);
      b.y = rng.range(bord.y + m, bord.y + bord.h - m);
    } else if (side === 2) { // topp
      b.x = rng.range(bord.x + m, bord.x + bord.w - m);
      b.y = rng.range(bord.y + m, -m);
    } else {                 // bunn
      b.x = rng.range(bord.x + m, bord.x + bord.w - m);
      b.y = rng.range(puslespill.ramme.h + m * 0.2, bord.y + bord.h - m);
    }
  }
  nullstillGrupper(puslespill);
  for (const b of puslespill.brikker) {
    b.rot = medRotasjon ? rng.int(0, 3) : 0;
  }
}

/** Legger alt ferdig sammensatt - brukes til a se motivet. */
export function samleBrikker(puslespill) {
  nullstillGrupper(puslespill);
  const alle = new Set(puslespill.brikker.map((b) => b.id));
  puslespill.grupper.clear();
  puslespill.grupper.set(0, alle);
  for (const b of puslespill.brikker) {
    b.x = b.hjemX;
    b.y = b.hjemY;
    b.gruppe = 0;
    b.laast = true;
    b.rot = 0;
    b.animRot = 0;
  }
}

/**
 * Legger alle løse brikker i et ryddig rutenett rundt rammen.
 *
 * Rekkefølgen følger brikkenes NÅVÆRENDE posisjoner, ikke bildet. To grunner:
 * å sortere dem etter bildet ville røpet løsningen, og å rydde skal flytte
 * haugen minst mulig – brikkene skal bli liggende omtrent der du la dem.
 *
 * @param {(b:object)=>boolean} erLos avgjør hvilke brikker som skal flyttes
 */
export function ryddBrikker(puslespill, bord, erLos) {
  const lose = puslespill.brikker.filter(erLos);
  if (!lose.length) return 0;

  const ramme = puslespill.ramme;
  const naturlig = Math.max(puslespill.brikkeB, puslespill.brikkeH) * 1.1;
  const sperre = {
    x: ramme.x - puslespill.brikkeB * 0.25,
    y: ramme.y - puslespill.brikkeH * 0.25,
    w: ramme.w + puslespill.brikkeB * 0.5,
    h: ramme.h + puslespill.brikkeH * 0.5,
  };

  // Finn en cellestørrelse der alle brikkene får plass utenfor rammen.
  let celle = naturlig;
  let plasser = [];
  for (let forsok = 0; forsok < 8; forsok++) {
    plasser = [];
    const kol = Math.max(1, Math.floor(bord.w / celle));
    const rad = Math.max(1, Math.floor(bord.h / celle));
    const startX = bord.x + (bord.w - kol * celle) / 2;
    const startY = bord.y + (bord.h - rad * celle) / 2;
    for (let r = 0; r < rad && plasser.length < lose.length; r++) {
      for (let c = 0; c < kol && plasser.length < lose.length; c++) {
        const x = startX + c * celle;
        const y = startY + r * celle;
        const midtX = x + celle / 2;
        const midtY = y + celle / 2;
        const iRammen = midtX > sperre.x && midtX < sperre.x + sperre.w &&
                        midtY > sperre.y && midtY < sperre.y + sperre.h;
        if (iRammen) continue;
        plasser.push({ x, y });
      }
    }
    if (plasser.length >= lose.length) break;
    celle *= 0.88;
  }

  // Samme leserekkefølge på begge sider gjør at brikkene flytter seg minst mulig.
  const sortert = lose.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
  plasser.sort((a, b) => (a.y - b.y) || (a.x - b.x));

  const n = Math.min(sortert.length, plasser.length);
  for (let i = 0; i < n; i++) {
    const b = sortert[i];
    b.x = plasser[i].x + (celle - puslespill.brikkeB) / 2;
    b.y = plasser[i].y + (celle - puslespill.brikkeH) / 2;
    b.animX = 0;
    b.animY = 0;
  }
  return n;
}
