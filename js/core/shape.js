// Brikkegeometri.
//
// Hver indre kant lages EN gang og deles av de to nabobrikkene: den ene
// traverserer den forlengs, den andre baklengs. Da passer brikkene eksakt,
// uansett hvor mye tilfeldig variasjon vi legger inn.
//
// En kant er tre kubiske Bezier-segmenter i enhetsrom (x langs kanten 0..1,
// y vinkelrett), mappet til bildekoordinater. Formen er den klassiske
// jigsaw-tappen: flat inngang, smal hals med undersnitt, bred kule, flat ut.

export const CUT_STYLES = {
  klassisk: { tab: 0.105, tabVar: 0.12, jitterAlong: 0.025, jitterAcross: 0.02, cellJitter: 0 },
  bolget:   { tab: 0.115, tabVar: 0.18, jitterAlong: 0.05,  jitterAcross: 0.05, cellJitter: 0 },
  kaotisk:  { tab: 0.125, tabVar: 0.35, jitterAlong: 0.09,  jitterAcross: 0.08, cellJitter: 0.16 },
};

/** Rett kant - brukes langs ytterkanten av puslespillet. */
function flatEdge(x0, y0, x1, y1) {
  const dx = (x1 - x0) / 3;
  const dy = (y1 - y0) / 3;
  return {
    start: { x: x0, y: y0 },
    segs: [{
      c1: { x: x0 + dx, y: y0 + dy },
      c2: { x: x0 + 2 * dx, y: y0 + 2 * dy },
      p: { x: x1, y: y1 },
    }],
    flat: true,
  };
}

/** Kant med tapp mellom to nabobrikker. */
function tabEdge(x0, y0, x1, y1, rng, style) {
  const t = style.tab * (1 + rng.range(-style.tabVar, style.tabVar));
  const flip = rng.sign();
  const ja = style.jitterAlong;
  const jc = style.jitterAcross;
  const a = rng.range(-jc, jc);
  const b = rng.range(-ja, ja);
  const c = rng.range(-jc, jc);
  const d = rng.range(-ja, ja);
  const e = rng.range(-jc, jc);

  // (langs, vinkelrett) i enhetsrom
  const u = [
    [0.2, a],              [0.5 + b + d, -t + c],      [0.5 - t + b, t + c],
    [0.5 - 2 * t + b - d, 3 * t + c], [0.5 + 2 * t + b - d, 3 * t + c], [0.5 + t + b, t + c],
    [0.5 + b + d, -t + c], [0.8, e],                   [1.0, 0],
  ];

  const ax = x1 - x0;
  const ay = y1 - y0;
  const len = Math.hypot(ax, ay);
  // Vinkelrett enhetsvektor, skalert med kantlengden sa tappen holder proporsjon.
  const px = (-ay / len) * len * flip;
  const py = (ax / len) * len * flip;
  const map = ([s, n]) => ({ x: x0 + ax * s + px * n, y: y0 + ay * s + py * n });

  const m = u.map(map);
  return {
    start: { x: x0, y: y0 },
    segs: [
      { c1: m[0], c2: m[1], p: m[2] },
      { c1: m[3], c2: m[4], p: m[5] },
      { c1: m[6], c2: m[7], p: m[8] },
    ],
    flat: false,
  };
}

/** Samme kurve traversert motsatt vei. */
function reverseEdge(edge) {
  const anchors = [edge.start, ...edge.segs.map((s) => s.p)];
  const segs = [];
  for (let i = edge.segs.length - 1; i >= 0; i--) {
    const s = edge.segs[i];
    segs.push({ c1: s.c2, c2: s.c1, p: anchors[i] });
  }
  return { start: anchors[anchors.length - 1], segs, flat: edge.flat };
}

/**
 * Bygger alle kanter i rutenettet.
 * edgesH[r][c] gar vannrett langs toppen av brikke (r, c)  - r i 0..rows
 * edgesV[r][c] gar loddrett langs venstre side av (r, c)   - c i 0..cols
 */
export function buildEdges(cols, rows, pieceW, pieceH, rng, style = CUT_STYLES.klassisk) {
  // Litt forskyvning av selve rutenettlinjene gir ulik brikkestorrelse.
  const jx = new Array(cols + 1).fill(0);
  const jy = new Array(rows + 1).fill(0);
  if (style.cellJitter) {
    for (let c = 1; c < cols; c++) jx[c] = rng.range(-1, 1) * pieceW * style.cellJitter;
    for (let r = 1; r < rows; r++) jy[r] = rng.range(-1, 1) * pieceH * style.cellJitter;
  }
  const gx = (c) => c * pieceW + jx[c];
  const gy = (r) => r * pieceH + jy[r];

  const edgesH = [];
  for (let r = 0; r <= rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const x0 = gx(c), x1 = gx(c + 1), y = gy(r);
      row.push(r === 0 || r === rows
        ? flatEdge(x0, y, x1, y)
        : tabEdge(x0, y, x1, y, rng, style));
    }
    edgesH.push(row);
  }

  const edgesV = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c <= cols; c++) {
      const x = gx(c), y0 = gy(r), y1 = gy(r + 1);
      row.push(c === 0 || c === cols
        ? flatEdge(x, y0, x, y1)
        : tabEdge(x, y0, x, y1, rng, style));
    }
    edgesV.push(row);
  }

  return { edgesH, edgesV, gx, gy };
}

/** Omrisset til en brikke, med klokka fra ovre venstre hjorne. */
export function pieceOutline(edges, r, c) {
  const top = edges.edgesH[r][c];
  const right = edges.edgesV[r][c + 1];
  const bottom = reverseEdge(edges.edgesH[r + 1][c]);
  const left = reverseEdge(edges.edgesV[r][c]);
  return {
    start: top.start,
    segs: [...top.segs, ...right.segs, ...bottom.segs, ...left.segs],
  };
}

export function outlineToPath2D(outline) {
  const p = new Path2D();
  p.moveTo(outline.start.x, outline.start.y);
  for (const s of outline.segs) p.bezierCurveTo(s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.p.x, s.p.y);
  p.closePath();
  return p;
}

/**
 * Bokseramme rundt omrisset. Konveks-hull-egenskapen til Bezier-kurver gjor
 * at boksen rundt ankere og kontrollpunkter alltid rommer kurven.
 */
export function outlineBBox(outline) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };
  add(outline.start);
  for (const s of outline.segs) { add(s.c1); add(s.c2); add(s.p); }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
