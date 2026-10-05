# Puslespill

En puslespill-PWA laget for iPad. Ingen annonser, ingen abonnement, ingen kjøp.
Motivene genereres i appen, eller du bruker dine egne bilder.

**Status: ferdig.** Alle ni fasene er gjennomført. Appen er spillbar,
brikkene lar seg finne, du kan bruke dine egne bilder, vanskelighetsgraden
går fra barnehage til beinhard, og alt overlever at appen lukkes.

## Full skjerm

Appen er bygget for å kjøre uten nettleser rundt: manifest med
`display: standalone`, `apple-mobile-web-app-capable`, og `viewport-fit=cover`
med safe-area-innrykk så innholdet går helt ut i kantene uten å havne under
statuslinja.

Men nettleserne kommer dit på tre helt ulike måter, så startskjermen sier
tre ulike ting:

| Nettleser | Hva appen gjør |
|---|---|
| **Chrome, Edge** | Viser en ekte **«Installer appen»**-knapp, drevet av `beforeinstallprompt`. Ett trykk. |
| **Safari på iOS** | Forklarer **Del → «Legg til på Hjem-skjerm»**. Det finnes ingen knapp å trykke på – iOS lar ingen nettside skjule Safari. |
| **Chrome på iOS** | Sier rett ut at man må åpne lenken i Safari. På iPad er det bare Safari som kan legge en app på hjemskjermen, og da er det ærligere å si fra enn å gi en oppskrift som ikke finnes. |
| **Andre** | Peker på nettlesermenyen. |

Hintet vises bare når appen faktisk kjører i en nettleser. Starter den fra
hjemskjermen, sier den ingenting. Takker man nei til Chromes
installasjonsdialog, faller kortet tilbake til bruksanvisningen.

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
js/core/spill.js    Spillogikken: treffdeteksjon, grupper, snapping, rotasjon.
js/core/vanskelighet.js  Regner alle innstillingene om til ett tall.
js/core/okt.js      Pakker et pågående puslespill ned og opp igjen.
js/input/gester.js  Pointer Events: dra brikker, panorering og pinch-zoom.
js/ui/skuff.js      Brikkeskuffen: register over løse brikker, med filtre.
js/ui/konfetti.js   Konfetti til feiringen.
js/ui/beskjaer.js   Beskjæring av egne bilder, og lesing av bildefiler.
js/art/eget.js      Eget bilde som motivkilde.
js/lagring.js       IndexedDB: bilder, pågående spill, samling, innstillinger.
js/lyd.js           Lyd laget med oscillatorer. Ingen lydfiler.
js/art/neon.js      Flow field + lagvis glød. Motivene er laget for å PUSLES.
js/art/noise.js     Verdistøy.
js/art/tegning.js   Tegneverktøykasse: taperte bånd, former, puslbarhetsmåling.
js/art/scener.js    De figurative motivene – dinosaur, hus, bil, rakett, båt, katt.
js/art/motiver.js   Registeret over alle motivtyper.
```

## Grensesnittet

### Startskjermen: to valg

Appen åpner på en startskjerm med to spørsmål og ingenting annet: **hvilket
bilde**, og **hvor mange brikker**. Bildene vises som store kort med ekte
miniatyrer av motivene, ikke som en nedtrekksmeny – et barn skal kunne peke
på dinosauren. Brikketallene har ord ved siden av tallet, fra «Helt lett»
(12) til «Verst som finnes» (500).

Så er det én stor knapp: **Pusle!**

Egne bilder får hvert sitt kort i den samme ruta, og helt til slutt står
det alltid et **«+ Nytt bilde»**. Det siste er viktigere enn det høres ut:
i første versjon erstattet bildet ditt pluss-kortet, og da fantes det ingen
vei til bilde nummer to uten å lete seg fram til menyen.

Å trykke på et bildekort velger det bare – det er «Pusle!» som starter
spillet. Legger du til et nytt bilde fra startskjermen, blir du værende der
med det nye valgt, så du kan legge til flere og velge brikketall før du
setter i gang. Bilder slettes i menyen, under «Flere valg».

Alt det detaljerte finnes fortsatt, men bak «Flere valg». Har du et
puslespill på gang, står «Fortsett der du slapp» øverst med motiv,
brikketall og tid.

Dette kom etter at appen ble prøvd på en ekte iPad. Den første versjonen la
alle valgene foran brukeren samtidig, og det er feil svar når appen primært
er for barn.

Miniatyrene tegnes én om gangen. Sju motiv tar rundt 200 ms til sammen;
deles de opp, er skjermen framme med én gang og fylles ut mens man ser
på den.

### Mens man pusler

Topplinja holder det man trenger: **«← Tilbake»** helt til venstre, så
fremdrift og klokke, og til høyre snarveiene (Rydd, Skuff, Bilde) med menyen
sist.

Tilbakeknappen var først et lite husikon helt til høyre, og det sa ingenting
til et barn. Nå er den den tydeligste knappen i linja, med pil og tekst, og
den står der tilbakeknapper hører hjemme. Spillet lagres før man går, så
«Fortsett der du slapp» venter på startskjermen.

Alt oppsett bor i en meny som skyves inn fra siden.

Det var ikke slik i starten. Panelet vokste for hver fase til det dekket
omtrent 70 % av skjermen – på en app hvis hele poeng er at bordet skal være
stort. Nå tar topplinja 9 %. Menyen lukkes med skygge, kryss eller Escape.

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

## Vanskelighetsgrad

Brikketallet alene sier lite. Hundre brikker av en skarp tegning med
spøkelsesbilde under er en helt annen oppgave enn hundre brikker av en blå
himmel, roterte, uten hjelp. Appen regner alt sammen til ett tall og viser
det som et merke: **Lett · Middels · Krevende · Vanskelig · Beinhard**.

Grunnlaget er brikketallet på logaritmisk skala – spranget fra 12 til 24
brikker kjennes like stort som fra 250 til 500. Så ganges det opp for
rotasjon (×1,38), kuttstil, og hvor flatt motivet er. Hjelpemidlene trekker
ned: spøkelsesbilde, feste til brettet, kanter først.

Fem ferdige oppsett stiller alle bryterne samtidig, fra **Barn**
(24 brikker, ingen rotasjon, kraftig spøkelsesbilde) til **Beinhard**
(500 brikker, rotasjon, kaotisk kutt, ingen hjelp).

### Rotasjon

Med rotasjon på får hver brikke en tilfeldig kvart omdreining. **Trykk på en
brikke for å dreie den 90 grader**, uten å dra den. Etter dreiningen prøves
koblingen med én gang, så den siste dreiningen kan være den som får brikken
på plass.

En brikke som står feil vei kan ikke koble seg til noe. Det gir en ryddig
regel: en gruppe har alltid rotasjon null, for brikker kobler seg bare når
de står riktig – og da er det ingenting å dreie. Derfor kan bare
enkeltbrikker dreies.

Treffdeteksjonen regner punktet tilbake til brikkens egen, uroterte ramme før
den prøver `isPointInPath`. Da virker både boksprøven og formprøven uendret,
uansett hvordan brikken står. Skuffen viser brikkene slik de faktisk står, så
man ser hvilke som må snus.

### Kanter først

Et hjelpemiddel som holder midtbrikkene unna til rammen er lagt. Brikkene er
ikke borte – de er bare ikke i veien ennå, og de kommer tilbake av seg selv
i det siste kantbrikken faller på plass. Panelet teller ned hvor mange som
gjenstår.

### Skjermen sovner ikke

Et puslespill er lange perioder med ettertanke og korte berøringer, og
iPaden rekker å sovne imellom. Appen ber om Wake Lock ved første berøring,
og på nytt hver gang den kommer tilbake fra bakgrunnen.

### Lyd

Alt er laget med oscillatorer – ingen lydfiler, ingenting å laste ned.
Klikket når en brikke smetter på plass er et kort støyknepp gjennom et smalt
båndpassfilter, ikke en ren tone. En ren tone høres elektronisk ut; et knepp
med litt støy i likner mer på to brikker som møtes, og det er den lyden som
skal tåle å høres fem hundre ganger. Treffer du to naboer samtidig, blir
klangen lysere.

### Forhåndsvisning

Spøkelsesbildet under brettet kan stilles fra 0 til 60 %. I tillegg finnes en
liten forhåndsvisning i hjørnet med to størrelser, som kan slås helt av for
den som vil pusle uten fasit.

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

## Alt blir liggende

Appen starter der du slapp. Et påbegynt puslespill, hvilke brikker som
henger sammen, klokka, utsnittet du jobbet i – og alle bryterne du har
stilt.

**En lagret økt er under 7 kB for 504 brikker.** Her betaler seed-designet
fra fase 1 seg: brikkeformene følger av `(motiv, antall, kuttstil, seed)`,
så de trenger ikke lagres i det hele tatt. Puslespillet bygges på nytt fra
fire tall, og bare posisjonene legges oppå – som typede tabeller.

### To feller i lagring ved avslutning

iOS kan ta livet av en bakgrunnsfane uten forvarsel, så `pagehide` og
`visibilitychange` er de eneste virkelig pålitelige øyeblikkene å skrive på.
Begge var ødelagte i første forsøk, og begge måtte rettes:

**Rekkefølgen.** Nettleseren river siden ned etter første `await`, og alt bak
den awaiten blir aldri kjørt. Første versjon lagret innstillingene først og
spillet etterpå – da gikk spillet tapt hver gang appen ble lukket, og klokka
hoppet tilbake til forrige autolagring. Nå pakkes stillingen synkront, og
skrivingen av selve spillet settes i gang før noe annet.

**Transaksjonen må starte synkront.** En IndexedDB-transaksjon som åpnes
inne i selve hendelsen blir fullført; en som først venter på at databasen
skal åpnes gjør det ikke. Derfor holdes en synkron referanse til den åpne
databasen.

Testet med en klokke satt til 9999 sekunder rett før omlasting, uten noe
trekk som kunne utløst autolagring: den kom tilbake som 9998.

## Samlingen

Hvert ferdig puslespill havner i samlingen med miniatyr, motiv, brikketall,
tid, dato og nivå. Øverst står totalene: antall fullførte, brikker lagt,
tid brukt, og hvor mange dager på rad dagens puslespill er løst.

## Dagens puslespill

Samme motiv, samme kutt og samme 100 brikker for alle, hver dag – helt uten
server. Seeden er datoen, og resten følger av den. Endrer du noe i oppsettet,
er det ikke dagens puslespill lenger, og det teller ikke i dagsrekka.

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

Tretten motiv, alle tegnet med kode. Puslbarheten er målt lokal kontrast
over hele flaten – snitt av fem seeds:

| Motiv | Puslbarhet | |
|---|---:|---|
| Neon | 100 % | abstrakt |
| **Under vann** | **97 %** | ny |
| **Rommet** | **96 %** | ny |
| **Byen** | **92 %** | ny |
| **Blomstereng** | **92 %** | ny |
| **Jungel** | **91 %** | ny |
| **Bondegård** | **87 %** | ny |
| Hus | 82 % | |
| Bil | 81 % | |
| Katt | 74 % | |
| Dinosaur | 73 % | |
| Seilbåt | 69 % | |
| Rakett | 67 % | |

### To krav som trekker mot hverandre

Rakett er kult, men var vanskeligst av alle: store felt av nesten lik mørk
himmel. Et barn med tjue nesten identiske brikker gir opp. Så scenene må
være travle.

Men travle scener blir fort rot: blomster oppå kua, blader oppå apen,
blomster oppå blomster. Da er bildet fullt uten å være lesbart.

Løsningen er todelt, og begge halvdeler trengs:

**`fordel()`** går gjennom et rutenett over hele flaten og finner en *ledig*
plass i hver celle. Alt deler ett opptattkart, så ingenting havner oppå noe
annet. Får noe ikke plass, prøves en mindre utgave før cellen gis opp – et
tomt hjørne er verre enn en litt mindre blomst.

**To slags krav på plassen.** Figurene – kua, apen, blomsten – krever full
klaring. Pynt kan derimot overlappe *annen pynt* med rundt halvparten; blader
som ligger litt over hverandre ser ut som løv, ikke som rot.

Tegningen skjer etterpå, sortert: først bakgrunnspynt, så figurer, og
innenfor hvert lag nedenfra og opp, slik at det som står nærmest også står
foran.

### Målingen fanget begge feilene

Første forsøk strødde ting i rutenett som ikke visste om hverandre, og tegnet
pynten etter figurene. Travelt nok, men rotete.

Andre forsøk nektet all overlapping. Nå ble det ryddig – men hullene etter
avviste celler ga store, like felt igjen. **Jungel falt fra 86 til 59 %**, og
Rommet fra 96 til 75 %.

Tredje forsøk, med myk overlapping for pynt og måner som fyller hullene
mellom klodene, ga både ryddighet og 87–97 %.

De figurative scenene tegnes med kode i designrommet 1600 × 1067 og skaleres
til faktisk bildestørrelse. Alt varierer med seed. Hver scene tar 4–9 ms.

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

Lagring: at en økt pakkes tapsfritt ved 12, 204 og 504 brikker, at 504
brikker tar under 10 kB, at en stilling fra feil puslespill avvises i stedet
for å lage rot, at posisjoner, rotasjoner, grupper, låsinger, tegnerekkefølge,
trekk, fremdrift og kamera er identiske etter en omlasting, at dagens
puslespill er likt hele dagen og endrer seg ved midnatt, og at et fullført
puslespill havner i samlingen mens det pågående slettes.

Egne bilder: EXIF-rotasjon med en konstruert JPEG, at bildet overlever en
omlasting, at sideforholdet følger bildet i både liggende og stående format,
at forrige bilde faktisk slippes fra minnet ved bytte, og at sletting virker.

Rotasjon og vanskelighetsgrad: at rotasjon deles ut ved stokking, at en
brikke som står feil ikke kan koble seg, at fire dreininger fører tilbake til
utgangspunktet, at grupper ikke kan dreies, og at treffdeteksjonen følger
rotasjonen – et punkt i en tapp bommer etter dreining, mens det samme punktet
dreid 90 grader treffer. At scoren stiger med brikketall, rotasjon og flate
motiver, og synker med hjelpemidler. At kanter først skjuler midtbrikkene og
slipper taket av seg selv når rammen er ferdig.

I tillegg er hele berøringskjeden verifisert med ekte pointer events:
en brikke ble dratt 18 piksler bom og smatt eksakt på plass, panorering på
tomt bord flyttet kameraet uten å røre en eneste brikke, en brikke ble
løftet ut av skuffen og opp på bordet, båndet rullet sidelengs, og et bilde
gikk hele veien fra filvelger via beskjæring til ferdig puslespill.

## Tilgjengelighet

Alle treffområder er minst 44 piksler. Alle knapper har lesbart navn. Fokus
vises tydelig med `:focus-visible`. Fremdrift og hjelpetekst er `aria-live`,
så en skjermleser får med seg at noe skjedde. `prefers-reduced-motion` slår
av konfetti, menyanimasjon, pulsende stjerne og overganger.

**Haptikk er ikke med.** iOS gir ikke nettsider tilgang til vibrasjon –
`navigator.vibrate` finnes ikke i Safari. Det finnes triks med skjulte
skjemaelementer, men de er skjøre og misbruker noe som er ment til noe annet.
Lyden og animasjonen får bære følelsen i stedet.

## Ikke verifisert ennå

- Service worker lar seg ikke registrere i utviklingsnettleserpanelet.
  Filene er på plass og serveres riktig; registreringen må testes på iPad.
- Pointer Events i en *installert* PWA på iPadOS har kjente feil. Må testes
  fra hjemskjermen, ikke bare i en Safari-fane.

## Videre

Fase 3 er dra, snapping og grupper — det viktigste av alt. Deretter bord og
skuff (fase 4), flere motivstiler (5), egne bilder (6), vanskelighetssystem
(7), lagring og galleri (8), og polering (9).
