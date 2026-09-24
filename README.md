# Puslespill

En puslespill-PWA laget for iPad. Ingen annonser, ingen abonnement, ingen kjøp.
Motivene genereres i appen, eller du bruker dine egne bilder.

**Status: fase 0–6 ferdig.** Puslespillet er spillbart, brikkene lar seg
finne, og du kan bruke dine egne bilder. Neste steg er fase 7 –
vanskelighetssystemet.

## Kjøre lokalt

```bash
node .dev/server.mjs
```

Åpne `http://localhost:5178`. Ingen avhengigheter, ingen byggesteg.

## Arkitektur

```
js/core/rng.js      Seedet PRNG. (motiv, antall, seed) beskriver et puslespill fullt ut.
js/core/grid.js     Fritt brikkeantall → nærmeste rutenett med kvadratiske brikker.
js/core/shape.js    Bézier-brikker. Naboer deler én kant, traversert hver sin vei.
js/core/puzzle.js   Puslespillmodellen. Rene data, vet ingenting om tegning.
js/render/atlas.js  Forhåndstegner hver brikke én gang med skygge og bevel.
js/render/camera.js Pan/zoom i verdenskoordinater.
js/render/renderer.js  Tegner bare når noe har endret seg.
js/core/spill.js    Spillogikken: treffdeteksjon, grupper, snapping.
js/input/gester.js  Pointer Events: dra brikker, panorering og pinch-zoom.
js/ui/skuff.js      Brikkeskuffen: register over løse brikker, med filtre.
js/ui/beskjaer.js   Beskjæring av egne bilder, og lesing av bildefiler.
js/art/eget.js      Eget bilde som motivkilde.
js/lagring.js       IndexedDB. Bildene blir liggende på iPaden.
js/lyd.js           Lyd laget med oscillatorer. Ingen lydfiler.
js/art/neon.js      Flow field + lagvis glød. Motivene er laget for å PUSLES.
js/art/noise.js     Verdistøy.
js/art/tegning.js   Tegneverktøykasse: taperte bånd, former, puslbarhetsmåling.
js/art/scener.js    De figurative motivene – dinosaur, hus, bil, rakett, båt, katt.
js/art/motiver.js   Registeret over alle motivtyper.
```

## Slik spilles det

| Gest | Handling |
|---|---|
| Én finger på en brikke | Dra brikken og alt som henger på den |
| Én finger på tomt bord | Flytt bordet |
| To fingre | Zoom og flytt bordet |
| Dobbelttrykk på tomt bord | Veksle mellom oversikt og arbeidsvisning |
| Hold på tomt bord, så dra | Lasso rundt en haug |
| I skuffen: dra sidelengs | Rull båndet |
| I skuffen: dra oppover | Løft brikken ut på bordet |

Legger du ned en finger nummer to mens du drar, slippes brikken der den er
og zoomen tar over. Det er mer forutsigbart enn å forsøke begge deler.

### Snapping

To ting kan feste seg: en brikke til en nabobrikke, og en gruppe til sin
rette plass på brettet. Det siste kan slås av med «Fest til brettet» for den
som synes det blir for enkelt.

Toleransen sikter mot **26 skjermpiksler**, men aldri mer enn 42 % eller
mindre enn 12 % av brikkestørrelsen. Poenget med å måle i skjermpiksler er
at det skal føles likt uansett hvor langt inn du har zoomet.

Én kobling kan utløse flere. Legger du en brikke mellom to grupper, festes
begge i samme slipp – logikken leter videre i opptil seks runder.

### Treffdeteksjon

Baklengs gjennom tegnerekkefølgen, boksprøve først og så `isPointInPath` mot
brikkens egen Path2D. Bommer fingeren, letes det i to ringer rundt punktet.
Ingen brikke skal kunne gjemme seg for en litt upresis finger.

Planen nevnte spatial hashing her. Det viste seg unødvendig: treffprøving
skjer bare ved `pointerdown`, og snapping slår bare opp en brikkes fire
naboer i rutenettet. 500 boksprøver ved hvert fingertrykk koster ingenting.
Enklere er bedre.

## Å finne brikkene igjen

Etter annonsene er dette den største klagen mot puslespillapper: brikkene
gjemmer seg. Haugen ligger oppå seg selv, og den ene brikken du leter etter
er under de andre. Tre ting svarer på det.

**Skuffen** er et register, ikke en beholder. Den viser alle løse
enkeltbrikker i et bånd som aldri overlapper, og du drar dem rett ut på
bordet. Retningen avgjør hva som skjer: sidelengs ruller båndet, oppover
løfter brikken ut. Samme mønster som en karusell man kan dra elementer ut
av, og det krever ingen ekstra knapp.

En brikke du har lagt fra deg på bordet uten å koble den, ligger fortsatt i
skuffen. Det er meningen – det er nettopp den brikken som pleier å bli borte.

**Filtrene** sorterer skuffen: alle, bare kantbrikker, eller etter farge.
Fargebøttene regnes ut fra hver brikkes egen snittfarge, målt i bildet, og
bare bøtter som faktisk har brikker vises. Ingen brikke er uten et filter
som finner den.

**Rydd** legger alle løse brikker i et rutenett rundt rammen. Rekkefølgen
følger brikkenes nåværende posisjoner, ikke bildet – å sortere dem etter
bildet ville røpet løsningen, og opprydning skal flytte haugen minst mulig.

**Lasso**: hold fingeren på tomt bord og dra. Brikkene innenfor blir valgt
og kan flyttes samlet. Et utvalg kobler seg ikke sammen av seg selv – det
skal kunne skyves til side uten at noe fester seg.

## Egne bilder

Trykk «Eget bilde …» for å velge fra Bilder, ta et nytt, eller hente fra
Filer. Bildet beskjæres, lagres på iPaden og blir et puslespill.

**Rammen står stille, bildet flyttes bak den.** Samme grep som i
kameraappen: du slipper å treffe små håndtak i hjørnene, og rammen kan
aldri havne utenfor bildet. Bildet holdes alltid stort nok til å dekke
rammen, så et puslespill kan ikke få gjennomsiktige felter.

**Sideforholdet følger bildet, ikke omvendt.** Velger du stående format,
blir puslespillet stående – et portrett skal ikke strekkes for å passe inn
i en liggende ramme. Rutenettløseren håndterer alle sideforhold, så
brikkene blir like firkantede uansett.

**EXIF-rotasjon** er den klassiske fellen: et bilde tatt med iPaden stående
ser riktig ut i Bilder, men ligger sidelengs i pikslene. Filen leses med
`createImageBitmap(fil, { imageOrientation: 'from-image' })`, med en
`<img>`-variant som reserve. Testet med en JPEG merket orientation = 6:
400 × 200 leses som 200 × 400.

**Advarsel om flate bilder.** Puslbarheten måles på utsnittet mens du
beskjærer. Under 45 % kommer en advarsel, under 30 % en tydeligere en. Et
bilde av snø og himmel gir 20 % – og da er det bedre å vite det før man har
lagt 200 brikker.

**Bildene forlater aldri iPaden.** De lagres som blober i IndexedDB. Appen
har ingen server å sende dem til.

## Motiv

| Motiv | Gruppe | Typisk puslbarhet |
|---|---|---:|
| Neon | Abstrakt | 100 % |
| Dinosaur | Figurer | 74 % |
| Hus | Figurer | 81 % |
| Bil | Figurer | 80 % |
| Rakett | Figurer | 61 % |
| Seilbåt | Figurer | 63 % |
| Katt | Figurer | 75 % |

De figurative scenene tegnes med kode i designrommet 1600 × 1067 og skaleres
til faktisk bildestørrelse. Alt varierer med seed: farger, positur, speiling,
antall skyer, hvor treet står. Hver scene tar 8–30 ms å tegne.

Scenene er komponert for å kunne pusles. Ingen store flate felt: himmelen har
gradient, skyer og fugler, bakken har gress, blomster og steiner, og figurene
har flekker, striper eller paneler. Romscenen er den vanskeligste – mørke
hjørner er vanskelig å unngå uten å ødelegge romfølelsen.

### Tre valg som styrer resten

**Alt utledes av en seed.** Brikkeformer, motiv og utlegg kommer fra
`(motiv, antall, seed)`. Det gir «dagens puslespill» uten server, og gjør
deling via lenke triviell senere.

**Brikkene tegnes én gang.** Hver brikke bakes inn i et atlas med skygge og
bevel ferdig påført. Under spilling er hver brikke bare én `drawImage`.
Alternativet — clipping og `shadowBlur` per frame — er forskjellen på 60 fps
og 12 fps på iPad.

**Motivene måles.** Generatoren regner ut lokal kontrast i et grovt rutenett
og legger til landemerker der bildet er for flatt. Flate felt er den vanligste
grunnen til at bildebaserte puslespill er kjedelige å pusle.

### iPad-hensyn som er bygget inn

- Alle canvas deler ~256 MB i WebKit, og minnet lekker ved gjentatt resize.
  Canvaset endres derfor aldri i størrelse uten at målene faktisk er ulike,
  resize er debounced, og atlaset frigjøres eksplisitt ved bytte av puslespill.
- Atlaset allokerer nøyaktig den høyden det trenger, ikke fulle sider.
- DPR kappes på 2.
- `touch-action: none` og `preventDefault` på `touchstart` — uten det
  panorerer Safari siden i stedet for brettet.
- `setPointerCapture` på hver peker, så dragging ikke mister kontakten.

## Målt ytelse

Full opptegning av alle brikker, desktop (Chromium, dpr 1.5):

| Brikker | Atlas | Sider | Tegning |
|--------:|------:|------:|--------:|
| 12 | 3,9 MB | 1 | 0,02 ms |
| 54 | 11,6 MB | 1 | 0,05 ms |
| 96 | 21,3 MB | 2 | 0,08 ms |
| 204 | 32,8 MB | 3 | 0,32 ms |
| 504 | 32,9 MB | 3 | 0,82 ms |

Bygging av et nytt puslespill tar 52–141 ms for de figurative motivene.
Neonmotivet er tyngre: 785 ms på 2048 piksler, fordi gløden bygges av fem
lag strek. Dragning av en gruppe på 12 brikker tegner på 0,7 ms.

### getImageData koster per kall, ikke per piksel

Fargesorteringen ble først skrevet som én `drawImage` + `getImageData` per
brikke. Kuttetiden gikk fra 6 ms til **1296 ms** for 96 brikker. Hver
`getImageData` tvinger en synkronisering mellom GPU og CPU, og den regningen
betales per kall.

Én lesning av kildebildet og deretter ren løkkegang over pikslene gjør det
samme arbeidet på under 40 ms, også for 504 brikker. Samme feil lå i
puslbarhetsmålingen og i neongeneratorens landemerker – 81 kall hver. Begge
er rettet.
**Tallene må måles på nytt på ekte iPad.**

## Testet

36 automatiske sjekker kjører mot den bygde appen.

Spillogikk: kobling innenfor og utenfor toleranse, eksakt plassering etter
snapping, kaskade mellom to grupper, at en gruppe flytter seg samlet, låsing
mot brettet, treffdeteksjon med og uten slakk, og full gjennomspilling.

Skuff og opprydning: at skuffen bare viser løse enkeltbrikker, at kantfilteret
gir nøyaktig `2(kolonner + rader) − 4` brikker, at fargebøttene dekker alle
brikker, at lasso velger riktig, at et utvalg flytter seg samlet, og at
opprydning ved 54, 204 og 504 brikker gir null overlapp, ingenting oppå
rammen og ingenting utenfor bordet.

Egne bilder: EXIF-rotasjon med en konstruert JPEG, at bildet overlever en
omlasting, at sideforholdet følger bildet i både liggende og stående format,
at forrige bilde faktisk slippes fra minnet ved bytte, og at sletting virker.

I tillegg er hele berøringskjeden verifisert med ekte pointer events:
en brikke ble dratt 18 piksler bom og smatt eksakt på plass, panorering på
tomt bord flyttet kameraet uten å røre en eneste brikke, en brikke ble
løftet ut av skuffen og opp på bordet, båndet rullet sidelengs, og et bilde
gikk hele veien fra filvelger via beskjæring til ferdig puslespill.

## Ikke verifisert ennå

- Service worker lar seg ikke registrere i utviklingsnettleserpanelet.
  Filene er på plass og serveres riktig; registreringen må testes på iPad.
- Pointer Events i en *installert* PWA på iPadOS har kjente feil. Må testes
  fra hjemskjermen, ikke bare i en Safari-fane.

## Videre

Fase 3 er dra, snapping og grupper — det viktigste av alt. Deretter bord og
skuff (fase 4), flere motivstiler (5), egne bilder (6), vanskelighetssystem
(7), lagring og galleri (8), og polering (9).
