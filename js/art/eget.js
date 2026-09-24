// Eget bilde som puslespillmotiv.
//
// Bildet ligger allerede beskåret og nedskalert. Her tegnes det bare inn i
// den størrelsen puslespillet trenger, slik at brikkene får omtrent samme
// pikselstørrelse uansett hvor mange de er.

let aktivt = null;

/**
 * Bytter aktivt bilde og slipper det forrige.
 * Et beskaret bilde er opptil 2048 piksler pa lengste kant. WebKit gir
 * hele siden bare ~256 MB til lerreter, sa gamle bilder ma faktisk
 * slippes - ikke bare mistes av syne.
 *
 * @param {{lerret: (HTMLCanvasElement|ImageBitmap), navn: string, id: string}} bilde
 */
export function settAktivtBilde(bilde) {
  const forrige = aktivt;
  aktivt = bilde;
  if (!forrige || forrige.lerret === bilde.lerret) return;
  const l = forrige.lerret;
  if (typeof l.close === 'function') l.close();          // ImageBitmap
  else if ('width' in l) { l.width = 0; l.height = 0; }  // lerret
}

export function hentAktivtBilde() {
  return aktivt;
}

export function harEgetBilde() {
  return !!aktivt;
}

export function genererEget(bredde, hoyde) {
  if (!aktivt) throw new Error('Ingen bilde valgt');
  const canvas = document.createElement('canvas');
  canvas.width = bredde;
  canvas.height = hoyde;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(aktivt.lerret, 0, 0, bredde, hoyde);
  return { canvas, meta: { stil: 'eget', navn: aktivt.navn, bildeId: aktivt.id } };
}
