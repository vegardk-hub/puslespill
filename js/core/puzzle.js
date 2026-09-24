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

/** Deterministisk spredning av brikkene rundt rammen (midlertidig for fase 2). */
export function spreBrikker(puslespill, bord) {
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
  }
}
