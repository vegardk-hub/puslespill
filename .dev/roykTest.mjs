#!/usr/bin/env node
// Røyktest for en statisk PWA uten byggesteg. Ingen avhengigheter.
//   node roykTest.mjs [appmappe]      (standard: mappa over .dev/, ellers cwd)
// Sjekker: JS-syntaks, at relative importer finnes, at index.html peker på
// filer som finnes, at manifestet er gyldig JSON med ikoner som finnes, og at
// alt service workeren forhåndslagrer finnes. Avslutter med kode 1 ved feil.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const her = dirname(fileURLToPath(import.meta.url));
const rot = resolve(process.argv[2] ?? (basename(her) === '.dev' ? join(her, '..') : process.cwd()));
const HOPP = new Set(['node_modules', '.git', '.claude', 'dist', 'build']);
const feil = [];
const vis = f => relative(rot, f).replaceAll('\\', '/');

const filer = [];
(function gaa(mappe) {
  for (const navn of readdirSync(mappe)) {
    if (HOPP.has(navn)) continue;
    const sti = join(mappe, navn);
    statSync(sti).isDirectory() ? gaa(sti) : filer.push(sti);
  }
})(rot);

const lokal = ref => ref && !/^([a-z]+:|\/\/|#|data:)/i.test(ref);
const rens = ref => decodeURIComponent(ref.split(/[?#]/)[0]);
const finnes = (fra, ref) => {
  const sti = ref.startsWith('/') ? join(rot, ref) : resolve(dirname(fra), ref);
  return existsSync(sti) && (statSync(sti).isFile() || existsSync(join(sti, 'index.html')));
};

// 1. Syntaks og importer i all JavaScript
const js = filer.filter(f => /\.(js|mjs)$/.test(f));
for (const f of js) {
  const kilde = readFileSync(f, 'utf8');
  const erModul = /^\s*(import\s|export\s)/m.test(kilde) || f.endsWith('.mjs');
  const r = erModul
    ? spawnSync(process.execPath, ['--input-type=module', '--check'], { input: kilde, encoding: 'utf8' })
    : spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    const linje = (r.stderr || '').split('\n').find(l => /Error/.test(l)) ?? 'syntaksfeil';
    feil.push(`${vis(f)}: ${linje.trim()}`);
  }
  for (const m of kilde.matchAll(/(?:^|[\s;}])(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|(?:^|[\s;}])import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm)) {
    const ref = m[1] ?? m[2] ?? m[3];
    if (/^\.{1,2}\//.test(ref) && !finnes(f, rens(ref))) feil.push(`${vis(f)}: importerer ${ref}, som ikke finnes`);
  }
}

// 2. HTML-sider i rota: src/href må finnes
const html = filer.filter(f => f.endsWith('.html') && dirname(f) === rot);
if (!existsSync(join(rot, 'index.html'))) feil.push('index.html mangler i rota');
for (const f of html) {
  const kilde = readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  for (const m of kilde.matchAll(/<(?:script|link|img|source|audio|video)\b[^>]*?\s(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    if (lokal(m[1]) && rens(m[1]) && !finnes(f, rens(m[1]))) feil.push(`${vis(f)}: peker på ${m[1]}, som ikke finnes`);
  }
}

// 3. Manifest
const manifest = filer.find(f => dirname(f) === rot && /^manifest\.(json|webmanifest)$/.test(basename(f)));
if (manifest) {
  try {
    const m = JSON.parse(readFileSync(manifest, 'utf8'));
    for (const ikon of m.icons ?? []) {
      if (lokal(ikon.src) && !finnes(manifest, rens(ikon.src))) feil.push(`${vis(manifest)}: ikonet ${ikon.src} finnes ikke`);
    }
  } catch (e) {
    feil.push(`${vis(manifest)}: ugyldig JSON (${e.message})`);
  }
}

// 4. Service worker: alt som ser ut som en lokal filsti i sw.js må finnes
let lager = '';
const sw = ['sw.js', 'service-worker.js'].map(n => join(rot, n)).find(existsSync);
if (sw) {
  const kilde = readFileSync(sw, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  for (const m of kilde.matchAll(/['"`]((?:\.{0,2}\/)?[\w\-./æøåÆØÅ]+\.(?:html|js|mjs|css|json|webmanifest|png|jpe?g|webp|svg|ico|mp3|wav|ogg|woff2?))['"`]/g)) {
    if (!finnes(sw, rens(m[1]))) feil.push(`${vis(sw)}: forhåndslagrer ${m[1]}, som ikke finnes`);
  }
  const versjon = kilde.match(/(?:CACHE\w*|LAGER\w*|VERSJON|VERSION)\s*=\s*['"`]([^'"`]+)['"`]/);
  lager = versjon ? `, lager «${versjon[1]}»` : '';
}

if (feil.length) {
  console.error(`RØYKTEST FEILET (${feil.length}):`);
  for (const f of feil) console.error('  - ' + f);
  process.exit(1);
}
console.log(`Røyktest OK: ${js.length} JS-filer, ${html.length} HTML-sider${manifest ? ', manifest' : ''}${sw ? ', service worker' + lager : ''}`);
