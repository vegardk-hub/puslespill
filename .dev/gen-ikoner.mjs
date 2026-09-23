// Genererer appikonene. Brikken i ikonet er en EKTE puslespillbrikke fra
// shape.js — samme geometri som i spillet, bare rastrert her i Node.
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { makeRng } from '../js/core/rng.js';
import { buildEdges, pieceOutline, outlineBBox, CUT_STYLES } from '../js/core/shape.js';

// --- Minimal PNG-skriver ---------------------------------------------------
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
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
    rader.push(Buffer.from([0]));                                  // filter: none
    rader.push(Buffer.from(rgba.buffer, y * bredde * 4, bredde * 4));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(bredde, 0);
  ihdr.writeUInt32BE(hoyde, 4);
  ihdr[8] = 8;   // bitdybde
  ihdr[9] = 6;   // RGBA
  writeFileSync(sti, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rader), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

// --- Geometri --------------------------------------------------------------
function flat(outline, perSeg = 24) {
  const bez = (p0, c1, c2, p1, t) => {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
      u * u * u * p0[1] + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
    ];
  };
  const pts = [];
  let cur = [outline.start.x, outline.start.y];
  for (const s of outline.segs) {
    for (let i = 1; i <= perSeg; i++) pts.push(bez(cur, s.c1, s.c2, s.p, i / perSeg));
    cur = [s.p.x, s.p.y];
  }
  return pts;
}

function skaler(poly, senter, f) {
  return poly.map(([x, y]) => [senter[0] + (x - senter[0]) * f, senter[1] + (y - senter[1]) * f]);
}

/** Scanline-fyll med anti-aliasing via 3x vertikal oversampling. */
function fyll(buf, W, H, poly, farge, alpha) {
  const SUB = 3;
  const dekning = new Float32Array(W);
  for (let y = 0; y < H; y++) {
    dekning.fill(0);
    for (let s = 0; s < SUB; s++) {
      const sy = y + (s + 0.5) / SUB;
      const kryss = [];
      for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i];
        const [x2, y2] = poly[(i + 1) % poly.length];
        if ((y1 <= sy && y2 > sy) || (y2 <= sy && y1 > sy)) {
          kryss.push(x1 + ((sy - y1) / (y2 - y1)) * (x2 - x1));
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
      buf[i]     = Math.min(255, buf[i]     + r * d);
      buf[i + 1] = Math.min(255, buf[i + 1] + g * d);
      buf[i + 2] = Math.min(255, buf[i + 2] + bl * d);
      buf[i + 3] = 255;
    }
  }
}

function lagIkon(S) {
  const buf = new Uint8Array(S * S * 4);
  // Bakgrunn: nesten svart med svak lilla glød i midten.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const d = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
      const g = Math.max(0, 1 - d) ** 2;
      buf[i] = 9 + g * 26;
      buf[i + 1] = 8 + g * 8;
      buf[i + 2] = 20 + g * 52;
      buf[i + 3] = 255;
    }
  }

  // En ekte brikke, sentrert.
  const rng = makeRng('ikon-7');
  const kanter = buildEdges(3, 3, 100, 100, rng, CUT_STYLES.klassisk);
  const o = pieceOutline(kanter, 1, 1);
  const bb = outlineBBox(o);
  let poly = flat(o);
  const skala = (S * 0.62) / Math.max(bb.w, bb.h);
  const senter = [bb.x + bb.w / 2, bb.y + bb.h / 2];
  poly = poly.map(([x, y]) => [
    (x - senter[0]) * skala + S / 2,
    (y - senter[1]) * skala + S / 2,
  ]);
  const midt = [S / 2, S / 2];

  // Glød: samme form skalert opp, additivt.
  for (const [f, a] of [[1.30, 0.05], [1.20, 0.07], [1.11, 0.10], [1.05, 0.14]]) {
    fyll(buf, S, S, skaler(poly, midt, f), () => [40, 210, 255], a);
  }
  // Selve brikken: cyan øverst, magenta nederst.
  fyll(buf, S, S, poly, (x, y) => {
    const t = y / S;
    return [34 + t * 200, 224 - t * 150, 255 - t * 40];
  }, 1);
  // Lys kjerne gir neonrør-følelsen.
  fyll(buf, S, S, skaler(poly, midt, 0.9), () => [90, 90, 90], 0.55);

  return buf;
}

for (const S of [180, 192, 512]) {
  skrivPng(new URL(`../icons/ikon-${S}.png`, import.meta.url), S, S, lagIkon(S));
  console.log('icons/ikon-' + S + '.png');
}
