// Brikke-atlas.
//
// Hver brikke tegnes ÉN gang – med skygge, bevel og kildebilde bakt inn –
// inn i et stort canvas. Under spilling er hver brikke da bare en
// drawImage fra atlaset. Ingen clipping, ingen shadowBlur per frame.
// Det er forskjellen på 60 fps og 12 fps på iPad.
//
// Pakkingen går i to omganger: først regnes hele utlegget ut, så allokeres
// canvasene med nøyaktig den høyden som trengs. WebKit gir oss bare ~256 MB
// på tvers av alle canvas, så en halvtom 2048×2048-side er ikke gratis.

const MAKS_SIDE = 2048;

/** Hylle-pakking. Returnerer plassering per brikke og målene på hver side. */
function planlegg(puslespill, pad) {
  const plasser = new Array(puslespill.brikker.length);
  const sidemal = [];
  let bredde = MAKS_SIDE;
  let hylleX = 0;
  let hylleY = 0;
  let hylleH = 0;
  let side = -1;

  const nySide = (b) => {
    side++;
    bredde = b;
    sidemal.push({ bredde: b, hoyde: 0 });
    hylleX = 0; hylleY = 0; hylleH = 0;
  };

  for (const brikke of puslespill.brikker) {
    const sw = Math.ceil(brikke.bbox.w) + pad * 2;
    const sh = Math.ceil(brikke.bbox.h) + pad * 2;

    if (side < 0) nySide(Math.max(MAKS_SIDE, sw));
    if (hylleX + sw > bredde) {           // ny hylle
      hylleX = 0;
      hylleY += hylleH;
      hylleH = 0;
    }
    if (hylleY + sh > MAKS_SIDE) {        // ny side
      nySide(Math.max(MAKS_SIDE, sw));
    }

    plasser[brikke.id] = { side, sx: hylleX, sy: hylleY, sw, sh };
    hylleX += sw;
    hylleH = Math.max(hylleH, sh);
    sidemal[side].hoyde = Math.max(sidemal[side].hoyde, hylleY + hylleH);
  }

  return { plasser, sidemal };
}

/** Tegner én brikke inn i atlaset: skygge, bilde, bevel, kontur. */
function tegnBrikke(ctx, brikke, plass, kilde, bilde, pad) {
  ctx.save();
  ctx.translate(plass.sx - brikke.bbox.x + pad, plass.sy - brikke.bbox.y + pad);

  // 1. Skygge under brikken.
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = pad * 0.9;
  ctx.shadowOffsetY = pad * 0.30;
  ctx.fillStyle = '#000';
  ctx.fill(brikke.path);
  ctx.restore();

  // 2. Bildet, klippet til brikkeformen.
  ctx.save();
  ctx.clip(brikke.path);
  ctx.drawImage(kilde, 0, 0, bilde.bredde, bilde.hoyde);

  // 3. Bevel: lys kant opp/venstre, mørk ned/høyre – begge innenfor klippet.
  ctx.lineWidth = Math.max(1.5, pad * 0.30);
  ctx.save();
  ctx.translate(-1, -1);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.30)';
  ctx.stroke(brikke.path);
  ctx.restore();
  ctx.save();
  ctx.translate(1.2, 1.2);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.stroke(brikke.path);
  ctx.restore();
  ctx.restore();

  // 4. Tynn ytterkontur så brikken leser tydelig mot bordet.
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.stroke(brikke.path);
  ctx.restore();
}

export function byggAtlas(kilde, puslespill) {
  const pad = Math.max(6, Math.round(Math.min(puslespill.brikkeB, puslespill.brikkeH) * 0.10));
  const { plasser, sidemal } = planlegg(puslespill, pad);

  const sider = sidemal.map((m) => {
    const c = document.createElement('canvas');
    c.width = m.bredde;
    c.height = m.hoyde;
    return c;
  });
  const kontekster = sider.map((c) => c.getContext('2d'));

  const celler = new Array(puslespill.brikker.length);
  for (const brikke of puslespill.brikker) {
    const p = plasser[brikke.id];
    tegnBrikke(kontekster[p.side], brikke, p, kilde, puslespill.bilde, pad);
    celler[brikke.id] = {
      side: p.side,
      sx: p.sx, sy: p.sy, sw: p.sw, sh: p.sh,
      // Forskyvning fra brikkens verdensposisjon til atlasutsnittets hjørne.
      ox: brikke.bbox.x - pad - brikke.hjemX,
      oy: brikke.bbox.y - pad - brikke.hjemY,
    };
  }

  const piksler = sider.reduce((s, c) => s + c.width * c.height, 0);
  return {
    sider,
    celler,
    pad,
    minneMB: (piksler * 4) / 1048576,
    frigjor() {
      // WebKit holder på canvas-minne. Nulling av størrelsen slipper det.
      for (const c of this.sider) { c.width = 0; c.height = 0; }
      this.sider.length = 0;
      this.celler.length = 0;
    },
  };
}
