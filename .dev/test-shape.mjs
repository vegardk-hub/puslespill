import { makeRng } from '../js/core/rng.js';
import { buildEdges, pieceOutline, outlineBBox, CUT_STYLES } from '../js/core/shape.js';

// --- 1. Deler naboene noyaktig samme kant? ---
function bez(p0, c1, c2, p1, t) {
  const u = 1 - t;
  return {
    x: u*u*u*p0.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t*t*t*p1.x,
    y: u*u*u*p0.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t*t*t*p1.y,
  };
}
function sampleEdge(edge, n = 40) {
  const pts = [];
  let cur = edge.start;
  for (const s of edge.segs) {
    for (let i = 0; i <= n; i++) pts.push(bez(cur, s.c1, s.c2, s.p, i / n));
    cur = s.p;
  }
  return pts;
}

const rng = makeRng('test');
const cols = 6, rows = 4, pw = 100, ph = 100;
const edges = buildEdges(cols, rows, pw, ph, rng, CUT_STYLES.klassisk);

// Piece (1,2) sin hoyrekant = piece (1,3) sin venstrekant
import { } from '../js/core/shape.js';
const shared = edges.edgesV[1][3];
const fwd = sampleEdge(shared);
// Reverser slik pieceOutline gjor det, via en liten kopi av logikken:
const anchors = [shared.start, ...shared.segs.map(s => s.p)];
const rev = { start: anchors[anchors.length-1], segs: [] };
for (let i = shared.segs.length - 1; i >= 0; i--) {
  const s = shared.segs[i];
  rev.segs.push({ c1: s.c2, c2: s.c1, p: anchors[i] });
}
const back = sampleEdge(rev).reverse();
let maxErr = 0;
for (let i = 0; i < fwd.length; i++) {
  maxErr = Math.max(maxErr, Math.hypot(fwd[i].x - back[i].x, fwd[i].y - back[i].y));
}
console.log('Reversert kant avviker maks:', maxErr.toFixed(12), maxErr < 1e-9 ? 'OK' : 'FEIL');

// --- 2. Hvor langt stikker tappene ut? (styrer atlas-padding) ---
let maxOver = 0;
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const bb = outlineBBox(pieceOutline(edges, r, c));
  maxOver = Math.max(maxOver,
    (c*pw) - bb.x, (r*ph) - bb.y,
    (bb.x+bb.w) - (c+1)*pw, (bb.y+bb.h) - (r+1)*ph);
}
console.log('Maks utstikk fra cellen:', (maxOver/pw*100).toFixed(1) + '% av brikkebredden');

// --- 3. SVG-forhandsvisning ---
import { writeFileSync } from 'fs';
const parts = [];
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const o = pieceOutline(edges, r, c);
  let d = `M ${o.start.x.toFixed(2)} ${o.start.y.toFixed(2)}`;
  for (const s of o.segs) d += ` C ${s.c1.x.toFixed(2)} ${s.c1.y.toFixed(2)} ${s.c2.x.toFixed(2)} ${s.c2.y.toFixed(2)} ${s.p.x.toFixed(2)} ${s.p.y.toFixed(2)}`;
  const hue = (r*cols+c) * 360 / (rows*cols);
  parts.push(`<path d="${d} Z" fill="hsl(${hue} 70% 55% / 0.35)" stroke="#0ff" stroke-width="1.2"/>`);
}
writeFileSync(new URL('./shape-preview.svg', import.meta.url),
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -40 ${cols*pw+80} ${rows*ph+80}" width="${cols*pw+80}" height="${rows*ph+80}"><rect x="-40" y="-40" width="100%" height="100%" fill="#06060d"/>${parts.join('')}</svg>`);
console.log('Skrev .dev/shape-preview.svg');
