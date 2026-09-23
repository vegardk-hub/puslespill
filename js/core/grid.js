// Loser "jeg vil ha N brikker" mot "hvilket rutenett passer dette bildet".
//
// Brukeren skriver et fritt tall. Vi finner det naermeste rutenettet som
// bade treffer antallet og gir tilnaermet kvadratiske brikker, og viser
// alltid apent hva vi landet pa - ingen skjult avrunding.

const MIN_SIDE = 2;

/**
 * @param {number} target  onsket antall brikker
 * @param {number} aspect  bildets sideforhold (bredde / hoyde)
 * @returns {Array<{cols,rows,count,pieceAspect,score}>} sortert, best forst
 */
export function gridCandidates(target, aspect) {
  const t = Math.max(4, Math.round(target));
  const seen = new Set();
  const out = [];

  const idealCols = Math.sqrt(t * aspect);
  const lo = Math.max(MIN_SIDE, Math.floor(idealCols * 0.45));
  const hi = Math.max(MIN_SIDE + 1, Math.ceil(idealCols * 2.2));

  for (let cols = lo; cols <= hi; cols++) {
    const exact = t / cols;
    for (const rows of [Math.floor(exact), Math.ceil(exact), Math.round(exact)]) {
      if (rows < MIN_SIDE) continue;
      const key = cols + 'x' + rows;
      if (seen.has(key)) continue;
      seen.add(key);

      const count = cols * rows;
      // Brikkens eget sideforhold: (B/cols) / (H/rows)
      const pieceAspect = (aspect * rows) / cols;
      // Brikker som er mer enn ca 5:3 avlange blir stygge a pusle.
      if (pieceAspect > 1.75 || pieceAspect < 1 / 1.75) continue;

      const countPenalty = Math.abs(count - t) / t;
      const shapePenalty = Math.abs(Math.log(pieceAspect));
      out.push({
        cols,
        rows,
        count,
        pieceAspect,
        score: countPenalty * 3 + shapePenalty * 1.6,
      });
    }
  }

  out.sort((a, b) => a.score - b.score);
  return out;
}

/** Beste rutenett for onsket antall. */
export function solveGrid(target, aspect) {
  const all = gridCandidates(target, aspect);
  if (!all.length) {
    // Ekstremt sideforhold - fall tilbake til noe som i alle fall virker.
    const cols = Math.max(MIN_SIDE, Math.round(Math.sqrt(target * aspect)));
    const rows = Math.max(MIN_SIDE, Math.round(target / cols));
    return { cols, rows, count: cols * rows, pieceAspect: (aspect * rows) / cols, score: 99, alternatives: [] };
  }
  const best = all[0];
  // Noen fa naboalternativer brukeren kan bla til.
  const alternatives = all
    .slice(1)
    .filter((c) => c.count !== best.count)
    .slice(0, 4);
  return { ...best, alternatives };
}

/** "137 -> 140 brikker (14 x 10)" */
export function describeGrid(target, grid) {
  const exact = grid.count === Math.round(target);
  const head = exact ? `${grid.count} brikker` : `${Math.round(target)} → ${grid.count} brikker`;
  return `${head} (${grid.cols} × ${grid.rows})`;
}
