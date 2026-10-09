# Puslespill

Puslespill-PWA for iPad, primært for barn: ingen annonser, abonnement eller kjøp. Ren HTML/CSS/JS, ingen byggesteg og ingen avhengigheter. Motivene genereres i koden, eller brukeren bruker egne bilder.

## Kjøre og teste
- Forhåndsvisning: `puslespill` i `.claude/launch.json` (`node .dev/server.mjs`, port 5178).
- Røyktest før publisering: `node .dev/roykTest.mjs` (skal skrive «Røyktest OK»).
- Egne tester: `node .dev/test-shape.mjs` (brikkegeometri: delte kanter, utstikk). Skriver `.dev/shape-preview.svg` (gitignorert). Det finnes ingen andre automatiske tester.
- Service worker kan ikke registreres over http i utviklingspanelet; test PWA-delen på Pages-adressen eller iPad.

## Publisering
- Repo `vegardk-hub/puslespill`, gren `main`, GitHub Pages: https://vegardk-hub.github.io/puslespill/
- Cache-navnet står i `sw.js` på linje 18: `const CACHE = 'puslespill-v18';`. Det MÅ telles opp (v19, v20 ...) ved hver utgivelse, ellers beholder iPad gammel versjon.
- Skillen `publiser-pwa` gjør opptelling, røyktest og publisering.

## Struktur
- `js/core`: ren logikk uten tegning. Puslespillmodell, rutenett, Bézier-brikker (`shape.js`), spillregler (snapping, grupper, rotasjon), vanskelighetstall og økt-pakking (`okt.js`). Seedet PRNG i `rng.js`.
- `js/art`: kodegenererte motiver og registeret over dem (`motiver.js`), samt `eget.js` for egne bilder og tegneverktøy som måler puslbarhet.
- `js/render`: canvas-tegning. Atlas forhåndstegner hver brikke, kamera for pan/zoom, tegner kun ved endring.
- `js/ui`: skuff (register over løse brikker, filtre), konfetti, beskjæring av egne bilder.
- `js/input`: `gester.js`, Pointer Events for dra, pan, pinch og lasso.
- `js/main.js` kobler alt sammen; `js/lagring.js` er IndexedDB; `js/lyd.js` er oscillatorlyd uten lydfiler.
- `.dev/`: lokal server, `test-shape.mjs`, `roykTest.mjs`, `gen-ikoner.mjs` (appikoner), `motiver.html` (motivgalleri).

## Verdt å vite
- Appen er for barn: heller færre valg og større flater. Startskjermen har bare to spørsmål (bilde, brikketall) og «Pusle!»; detaljer ligger bak «Flere valg».
- `sw.js` må være nett-først og hente med `cache: 'reload'`/`'no-cache'`. GitHub Pages sender max-age=600, og vanlig fetch la gammel JS i cachen.
- Lagring ved avslutning: pakk tilstanden synkront og start skrivingen av spillet før noen `await`; IndexedDB-transaksjonen må også starte synkront (hold synkron referanse til åpen db). Ellers går spillet tapt når iOS river siden.
- Brikkeformer lagres ikke; de bygges på nytt fra `(motiv, antall, kuttstil, seed)`. Endrer du seed-bruk i generatorene, brekker lagrede økter og dagens puslespill (seed = dato).
- `getImageData` koster per kall: les bildet én gang og løkk over pikslene (96 kall tok 1296 ms mot 6 ms).
- Egne bilder lagres kun som blober i IndexedDB på enheten. Ingen nettverkskall utenom service workerens `fetch` av appens egne filer; hold det slik. EXIF-rotasjon leses med `imageOrientation: 'from-image'`.
- Ikke verifisert på ekte iPad: dra-følelse, snappetoleranse (26 skjermpiksler), ytelse ved 500 brikker, Pointer Events i installert PWA. Nettleserpanelet rapporterer `hidden`, så `requestAnimationFrame` fyrer ikke før et skjermbilde tas.
