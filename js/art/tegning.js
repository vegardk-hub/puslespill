// Tegneverktøykasse for de figurative motivene.
//
// Alle motiv tegnes i et fast designrom på 1600 × 1067 og skaleres til
// faktisk bildestørrelse. Da kan scenene skrives med konkrete koordinater
// i stedet for brøker av bredden, og de ser like ut i alle oppløsninger.

export const DESIGN_B = 1600;
export const DESIGN_H = 1067;

export const hsl = (h, s, l, a = 1) => `hsl(${h} ${s}% ${l}% / ${a})`;

/** Samme farge, mørkere – brukes til konturer. */
export const mork = (h, s, l, d = 22, a = 1) => hsl(h, s, Math.max(4, l - d), a);

// --- Former ----------------------------------------------------------------

export function sirkel(x, y, r) {
  const p = new Path2D();
  p.arc(x, y, r, 0, Math.PI * 2);
  return p;
}

export function ellipse(x, y, rx, ry, rot = 0) {
  const p = new Path2D();
  p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  return p;
}

export function rundetRekt(x, y, b, h, r = 12) {
  const p = new Path2D();
  const rr = Math.min(r, b / 2, h / 2);
  p.moveTo(x + rr, y);
  p.arcTo(x + b, y, x + b, y + h, rr);
  p.arcTo(x + b, y + h, x, y + h, rr);
  p.arcTo(x, y + h, x, y, rr);
  p.arcTo(x, y, x + b, y, rr);
  p.closePath();
  return p;
}

export function polygon(punkter, lukk = true) {
  const p = new Path2D();
  punkter.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  if (lukk) p.closePath();
  return p;
}

/** Punkter langs en kubisk Bézier – grunnlag for taperte former. */
export function bezierPunkter(p0, c1, c2, p1, n = 48) {
  const ut = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    ut.push({
      x: u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
      y: u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
    });
  }
  return ut;
}

/**
 * Bånd med varierende bredde langs en senterlinje.
 * Hals, hale, trestamme, røyk og rakettflamme er alle denne.
 * @param {Array<{x,y}>} senterlinje
 * @param {(t:number)=>number} bredde  bredde som funksjon av 0..1 langs linja
 */
export function taperetBane(senterlinje, bredde) {
  const venstre = [];
  const hoyre = [];
  const n = senterlinje.length;
  for (let i = 0; i < n; i++) {
    const p = senterlinje[i];
    const a = senterlinje[Math.max(0, i - 1)];
    const b = senterlinje[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const w = bredde(i / (n - 1)) / 2;
    venstre.push({ x: p.x - dy * w, y: p.y + dx * w });
    hoyre.push({ x: p.x + dy * w, y: p.y - dx * w });
  }
  const p = new Path2D();
  p.moveTo(venstre[0].x, venstre[0].y);
  for (let i = 1; i < venstre.length; i++) p.lineTo(venstre[i].x, venstre[i].y);
  for (let i = hoyre.length - 1; i >= 0; i--) p.lineTo(hoyre[i].x, hoyre[i].y);
  p.closePath();
  return p;
}

export function stjerne(x, y, r, tagger = 5, innerFaktor = 0.45) {
  const p = new Path2D();
  for (let i = 0; i < tagger * 2; i++) {
    const rad = i % 2 ? r * innerFaktor : r;
    const v = (i / (tagger * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(v) * rad;
    const py = y + Math.sin(v) * rad;
    i ? p.lineTo(px, py) : p.moveTo(px, py);
  }
  p.closePath();
  return p;
}

// --- Maling ----------------------------------------------------------------

/**
 * Fyller og konturerer en form. Den tykke, mørke konturen er det som gir
 * scenene et tegneserie-preg – og den gir samtidig brikkene skarpe kanter
 * å kjenne igjen når man pusler.
 */
export function mal(ctx, path, { fyll, strek, bredde = 7, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (fyll) { ctx.fillStyle = fyll; ctx.fill(path); }
  if (strek) { ctx.lineWidth = bredde; ctx.strokeStyle = strek; ctx.stroke(path); }
  ctx.restore();
}

/** Fri strek, f.eks. værhår, gresstrå og bølger. */
export function strek(ctx, punkter, farge, bredde = 6) {
  const p = new Path2D();
  punkter.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = bredde;
  ctx.strokeStyle = farge;
  ctx.stroke(p);
  ctx.restore();
}

export function loddrettGradient(ctx, y0, y1, stopp) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [t, f] of stopp) g.addColorStop(t, f);
  return g;
}

// --- Puslbarhet ------------------------------------------------------------

/**
 * Måler hvor mye lokal kontrast bildet har. Store flate felt – himmel uten
 * skyer, en ensfarget vegg – er den vanligste grunnen til at et puslespill
 * er kjedelig. Vi måler det i stedet for å gjette.
 *
 * @returns {{score:number, flate:number[][]}} score 0–100
 */
export function malPuslbarhet(ctx, bredde, hoyde, celler = 9) {
  const rader = Math.max(3, Math.round((celler * hoyde) / bredde));
  const cw = bredde / celler;
  const ch = hoyde / rader;
  const flate = [];
  let sumScore = 0;

  for (let r = 0; r < rader; r++) {
    const rad = [];
    for (let c = 0; c < celler; c++) {
      const d = ctx.getImageData(
        Math.floor(c * cw), Math.floor(r * ch),
        Math.max(1, Math.floor(cw)), Math.max(1, Math.floor(ch))).data;
      let sum = 0, sum2 = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 17) {
        const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        sum += l; sum2 += l * l; n++;
      }
      const varians = Math.max(0, sum2 / n - (sum / n) ** 2);
      // Standardavvik på ~26 lumakvanter holder i massevis; over det er cellen fin.
      const cellescore = Math.min(1, Math.sqrt(varians) / 26);
      rad.push(cellescore);
      sumScore += cellescore;
    }
    flate.push(rad);
  }

  return { score: Math.round((sumScore / (celler * rader)) * 100), flate };
}
