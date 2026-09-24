# Puslespill

En puslespill-PWA laget for iPad. Ingen annonser, ingen abonnement, ingen kjøp.
Motivene genereres i appen (neon), og egne bilder fra iPaden kommer i fase 6.

**Status: fase 0–3 ferdig, pluss motivgeneratorene fra fase 5.**
Puslespillet er spillbart: brikkene dras, kobler seg sammen i grupper og
fester seg på brettet. Neste steg er fase 4 – brikkeskuff, lasso og
sorteringsfiltre.

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

Bygging av et nytt puslespill (motiv + kutt + atlas) tar 200–330 ms.
Dragning av en gruppe på 12 brikker tegner på 0,7 ms.
**Tallene må måles på nytt på ekte iPad.**

## Testet

15 automatiske sjekker av spillogikken kjører mot den bygde appen: kobling
innenfor og utenfor toleranse, eksakt plassering etter snapping, kaskade
mellom to grupper, at en gruppe flytter seg samlet, låsing mot brettet,
treffdeteksjon med og uten slakk, og full gjennomspilling til ferdig.

I tillegg er hele berøringskjeden verifisert med ekte pointer events:
en brikke ble dratt 18 piksler bom og smatt eksakt på plass, og panorering
på tomt bord flyttet kameraet uten å røre en eneste brikke.

## Ikke verifisert ennå

- Service worker lar seg ikke registrere i utviklingsnettleserpanelet.
  Filene er på plass og serveres riktig; registreringen må testes på iPad.
- Pointer Events i en *installert* PWA på iPadOS har kjente feil. Må testes
  fra hjemskjermen, ikke bare i en Safari-fane.

## Videre

Fase 3 er dra, snapping og grupper — det viktigste av alt. Deretter bord og
skuff (fase 4), flere motivstiler (5), egne bilder (6), vanskelighetssystem
(7), lagring og galleri (8), og polering (9).
