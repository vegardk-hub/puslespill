// Genererer appikonene.
//
// Brikkene i ikonet er EKTE puslespillbrikker fra shape.js — samme geometri
// som i spillet, bare rastrert her i Node. Fire biter i hver sin farge sier
// «puslespill» tydeligere enn én, og passer en app som nå ledes av fargerike
// barnemotiver og ikke bare neon.
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { makeRng } from '../js/core/rng.js';
import { buildEdges, pieceOutline, CUT_STYLES } from '../js/core/shape.js';

// --- Minimal PNG-skriver ---------------------------------------------------
const tabell = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = tabell[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function skrivPng(sti, bredde, hoyde, rgba) {
  const rader = [];
  for (let y = 0; y < hoyde; y++) {
    rader.push(Buffer.from([0]));
    rader.push(Buffer.from(rgba.buffer, y * bredde * 4, bredde * 4));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(bredde, 0);
  ihdr.writeUInt32BE(hoyde, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(sti, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rader), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

// --- Geometri --------------------------------------------------------------
function bez(p0, c1, c2, p1, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
    u * u * u * p0[1] + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
  ];
}

function flat(outline, perSeg = 26) {
  const pts = [];
  let cur = [outline.start.x, outline.start.y];
  for (const s of outline.segs) {
    for (let i = 1; i <= perSeg; i++) pts.push(bez(cur, s.c1, s.c2, s.p, i / perSeg));
    cur = [s.p.x, s.p.y];
  }
  return pts;
}

const flytt = (poly, dx, dy) => poly.map(([x, y]) => [x + dx, y + dy]);
const skaler = (poly, senter, f) =>
  poly.map(([x, y]) => [senter[0] + (x - senter[0]) * f, senter[1] + (y - senter[1]) * f]);

/** Scanline-fyll med 3x vertikal oversampling. */
function fyll(buf, W, H, poly, farge, alpha) {
  const SUB = 3;
  const dekning = new Float32Array(W);
  let minY = Infinity;
  let maksY = -Infinity;
  for (const [, y] of poly) { if (y < minY) minY = y; if (y > maksY) maksY = y; }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(H, Math.ceil(maksY) + 1);

  for (let y = y0; y < y1; y++) {
    dekning.fill(0);
    for (let s = 0; s < SUB; s++) {
      const sy = y + (s + 0.5) / SUB;
      const kryss = [];
      for (let i = 0; i < poly.length; i++) {
        const [x1, ya] = poly[i];
        const [x2, yb] = poly[(i + 1) % poly.length];
        if ((ya <= sy && yb > sy) || (yb <= sy && ya > sy)) {
          kryss.push(x1 + ((sy - ya) / (yb - ya)) * (x2 - x1));
        }
      }
      kryss.sort((a, b) => a - b);
      for (let i = 0; i + 1 < kryss.length; i += 2) {
        const a = Math.max(0, kryss[i]);
        const b = Math.min(W, kryss[i + 1]);
        for (let x = Math.floor(a); x < Math.ceil(b); x++) {
          if (x < 0 || x >= W) continue;
          dekning[x] += (Math.min(b, x + 1) - Math.max(a, x)) / SUB;
        }
      }
    }
    for (let x = 0; x < W; x++) {
      const d = Math.min(1, dekning[x]) * alpha;
      if (d <= 0) continue;
      const i = (y * W + x) * 4;
      const [r, g, bl] = farge(x, y);
      buf[i] = Math.min(255, buf[i] * (1 - d) + r * d);
      buf[i + 1] = Math.min(255, buf[i + 1] * (1 - d) + g * d);
      buf[i + 2] = Math.min(255, buf[i + 2] * (1 - d) + bl * d);
      buf[i + 3] = 255;
    }
  }
}

/** Additiv glød — legger lys oppå i stedet for å blande. */
function glod(buf, W, H, poly, farge, alpha) {
  fyll(buf, W, H, poly, (x, y) => {
    const i = (y * W + x) * 4;
    const [r, g, b] = farge(x, y);
    return [
      Math.min(255, buf[i] + r) - buf[i] * (1 - 1),
      Math.min(255, buf[i + 1] + g) - buf[i + 1] * (1 - 1),
      Math.min(255, buf[i + 2] + b) - buf[i + 2] * (1 - 1),
    ];
  }, alpha);
}

// Cyan, magenta, gul og grønn — de samme fargene som ellers i appen.
const FARGER = [
  [[90, 232, 255], [20, 150, 210]],
  [[255, 110, 225], [190, 40, 150]],
  [[255, 214, 90], [215, 140, 20]],
  [[110, 235, 150], [30, 160, 95]],
];

function lagIkon(S) {
  const buf = new Uint8Array(S * S * 4);

  // Bakgrunn: dyp indigo med lys i midten.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const d = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
      const g = Math.max(0, 1 - d) ** 1.7;
      buf[i] = 12 + g * 30;
      buf[i + 1] = 10 + g * 20;
      buf[i + 2] = 28 + g * 62;
      buf[i + 3] = 255;
    }
  }

  // Fire ekte brikker i et 2x2-rutenett.
  const rng = makeRng('ikon-2x2-c');
  const kanter = buildEdges(2, 2, 100, 100, rng, CUT_STYLES.klassisk);
  const skala = (S * 0.66) / 200;
  const midt = S / 2;
  // Litt luft mellom brikkene, så tappene synes og det leser som et puslespill.
  const sprik = S * 0.022;

  const biter = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const poly = flat(pieceOutline(kanter, r, c)).map(([x, y]) => [
        (x - 100) * skala + midt + (c === 0 ? -sprik : sprik),
        (y - 100) * skala + midt + (r === 0 ? -sprik : sprik),
      ]);
      biter.push({ poly, farge: FARGER[r * 2 + c] });
    }
  }

  // Glød rundt hele figuren.
  for (const [f, a] of [[1.22, 0.10], [1.13, 0.13], [1.06, 0.16]]) {
    for (const bit of biter) {
      const [lys] = bit.farge;
      glod(buf, S, S, skaler(bit.poly, [midt, midt], f),
        () => [lys[0] * 0.5, lys[1] * 0.5, lys[2] * 0.5], a);
    }
  }

  // Skygge under, så brikkene løfter seg fra flaten.
  for (const bit of biter) {
    fyll(buf, S, S, flytt(bit.poly, S * 0.012, S * 0.018), () => [0, 0, 0], 0.4);
  }

  // Selve brikkene, med loddrett fargeovergang og mørk kontur.
  for (const bit of biter) {
    const [lys, mork] = bit.farge;
    let minY = Infinity;
    let maksY = -Infinity;
    for (const [, y] of bit.poly) { if (y < minY) minY = y; if (y > maksY) maksY = y; }
    fyll(buf, S, S, skaler(bit.poly, midtPunkt(bit.poly), 1.0), () => [10, 12, 26], 1);
    fyll(buf, S, S, skaler(bit.poly, midtPunkt(bit.poly), 0.94), (x, y) => {
      const t = Math.max(0, Math.min(1, (y - minY) / (maksY - minY)));
      return [
        lys[0] + (mork[0] - lys[0]) * t,
        lys[1] + (mork[1] - lys[1]) * t,
        lys[2] + (mork[2] - lys[2]) * t,
      ];
    }, 1);
    // Lysstripe øverst gir brikkene litt form.
    fyll(buf, S, S, skaler(bit.poly, midtPunkt(bit.poly), 0.56), () => [255, 255, 255], 0.14);
  }

  return buf;
}

function midtPunkt(poly) {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of poly) { sx += x; sy += y; }
  return [sx / poly.length, sy / poly.length];
}

/** Samme fire brikker som SVG, så ikonene ser like ut overalt. */
function lagSvg(S = 512) {
  const rng = makeRng('ikon-2x2-c');
  const kanter = buildEdges(2, 2, 100, 100, rng, CUT_STYLES.klassisk);
  const skala = (S * 0.66) / 200;
  const midt = S / 2;
  const sprik = S * 0.022;
  const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  const deler = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const dx = midt + (c === 0 ? -sprik : sprik);
      const dy = midt + (r === 0 ? -sprik : sprik);
      const P = (p) => `${((p.x - 100) * skala + dx).toFixed(2)} ${((p.y - 100) * skala + dy).toFixed(2)}`;
      const o = pieceOutline(kanter, r, c);
      let d = `M ${P(o.start)}`;
      for (const seg of o.segs) d += ` C ${P(seg.c1)} ${P(seg.c2)} ${P(seg.p)}`;
      const [lys, mork] = FARGER[r * 2 + c];
      deler.push({ d: d + ' Z', id: `g${r}${c}`, lys: hex(lys), mork: hex(mork) });
    }
  }

  const gradienter = deler.map((p) =>
    `<linearGradient id="${p.id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${p.lys}"/><stop offset="1" stop-color="${p.mork}"/></linearGradient>`).join('');
  const baner = deler.map((p) =>
    `<path d="${p.d}" fill="url(#${p.id})" stroke="#0a0c1a" stroke-width="${(S * 0.016).toFixed(1)}"/>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
  <defs>
    <radialGradient id="bak" cx="50%" cy="50%" r="62%">
      <stop offset="0" stop-color="#2a2060"/><stop offset="1" stop-color="#0c0a1c"/>
    </radialGradient>
    ${gradienter}
    <filter id="glod" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${(S * 0.03).toFixed(1)}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#bak)"/>
  <g filter="url(#glod)">${baner}</g>
</svg>
`;
}

for (const S of [180, 192, 512]) {
  skrivPng(new URL(`../icons/ikon-${S}.png`, import.meta.url), S, S, lagIkon(S));
  console.log('icons/ikon-' + S + '.png');
}
writeFileSync(new URL('../icons/ikon.svg', import.meta.url), lagSvg());
console.log('icons/ikon.svg');
