# Plan: endringer etter tilbakemelding

Status:
- Fase 1 er implementert på branchen `feature/fase1-taksonomi` (migrering `20261030120000_fase1_taxonomy_keys.sql`, overgangsversjon).
- Oppfølgingsmigreringen `20261030130000_fase1_drop_old_keys.sql` er kjørt: databasen godtar bare de nye nøklene. Fase 1 er ferdig.
- Fase 2 er implementert på branchen `feature/fase2-geometri` (migrering `20261030140000_fase2_parkering_flate.sql` er kjørt). Gjenstår: tegne om de 48 gamle stiforbedringspunktene som linjer (og 1 parkeringspunkt som flate).
- Fase 3 er implementert på branchen `feature/fase3-eiendommer` (migrering `20261030150000_fase3_owner_contacts.sql` er kjørt). Oppfølgingsmigreringen `20261030160000_fase3_drop_old_contact_columns.sql` er kjørt. Fase 3 er ferdig.
- Fase 4 (første del) er kjørt og merget (`20261030170000_fase4_trail_segments.sql`). Ombygd til stinettverk som objekt på branchen `feature/fase4-stinettverk-objekt` (migrering `20261030180000_fase4_trail_networks.sql` er kjørt: Fjermestad, Hålandskogen og Hammaren): ett nettverk har navn, turområde og én samlet geometri uten lengde/start/slutt; «Legg til sti» starter på nettverket, overlapp innen 8 m blir én linje; biter kan fjernes. Redigering av linjene (dra knekkpunkter) på branchen `feature/fase4-rediger-linjer` (migrering `20261030190000_fase4_set_network_geometry.sql` er kjørt). Forslag til stikryss og turruter bygd av nettverket er droppet etter ønske. Rettelser på branchen `fix/rediger-nettverk-linjer` (migrering `20261030200000_fase4_network_overlap.sql` er kjørt): «Rediger stinettverk» gir også dragbare linjer, bare første punkt i «Legg til sti» festes, overlapp regnes først fra 25 m langs nettverket, og bare endrede biter behandles ved lagring. Opprydding på branchen `fix/stinettverk-overlapp` (migrering `20261030210000_fase4_network_tidy.sql` er kjørt): overlapp også fra 6 m innen 3 m, og network_tidy fjerner biter som ligger oppå resten, biter under 5 m og doble biter; engangsopprydding av eksisterende nettverk (Hålandskogen 24 → 15 biter). Admin velger «Festeavstand» (0–20 m, standard 8, lagres per nettleser) som styrer festing, sammenslåing og opprydding; 0 fester ingenting.
- Fase 5 er implementert på branchen `feature/fase5-faner`: fanene Stinettverk · Turruter · Eiendommer · Hva finnes på både nettside og admin, Stinettverk er standardvisning, og fanene får plass ned til 320 px bredde.

## Beslutninger

- **Fire hovedfaner:** Stinettverk · Turruter · Eiendommer · Hva finnes. Arbeidslogg nås fortsatt via `?modus=arbeidslogg`.
- **Stikryss er en ny punkttype** (hører til stinettverket). Hovedtypen `annet` beholdes uendret – den inneholder gamle data (merking, rydding, POI).
- **Nøklene i databasen endres også**, ikke bare visningsnavnene, slik at kode og data er ryddige.
- **53 stiforbedringer finnes i dag**, og noen av dem er allerede linjer. Bare de som er punkt/flate må tegnes om.

## Før hver migrering

- Ta backup: `supabase db dump --data-only`.
- Test migreringen lokalt mot en kopi av produksjonsdataene.
- Tell før og etter, og sammenlign:
  ```sql
  select kind, subtype, geometrytype(geom), count(*) from other_points group by 1, 2, 3 order by 1, 2, 3;
  select subtypes, count(*) from gjerdeklyvere group by 1;
  select count(*) from owners;
  ```
- Migreringene skal tåle å kjøres to ganger (vakter på `WHERE`), og den gamle verdien tas vare på der det er mulig.
- **Nøkkelendringer og frontend må lanseres samtidig.** Gammel frontend sender gamle nøkler og blir avvist av CHECK-reglene. Trygg rekkefølge: (1) migrering som godtar både gamle og nye nøkler og skriver om radene, (2) ny frontend ut, (3) egen migrering som strammer CHECK-reglene til bare nye nøkler.

---

## Fase 1 – Tekst, nøkler og undertyper

Filer: `src/models/worklog.js`, `src/models/routes.js`, `src/models/layers.js`, komponenter som bruker nøklene, ny migrering.

### Nøkkelendringer

| Gammel nøkkel | Ny nøkkel | Visningsnavn |
|---|---|---|
| `tilrettelegging` (kind) | `stiforbedring` | Stiforbedring |
| `rekkverk` | `kjetting` | Kjetting |
| `steinsetting` | `naturstein` | Naturstein |
| `drenering` | `stikkror` | Stikkrøyr |
| `underlag` | `steinstov` | Steinstøv |

- Migrering: `UPDATE other_points SET kind = 'stiforbedring' WHERE kind = 'tilrettelegging'` og tilsvarende for `subtype`. `legacy_kind` røres ikke.
- CHECK-reglene `other_points_subtype_chk` og `other_points_geom_kind_chk` skrives om med nye nøkler (først overgangsversjon som godtar begge, se over).
- Views (`all_features_geojson`, `route_features`) sender `kind`/`subtype` rett gjennom og trenger ingen endring.
- Frontend: `TYPES.tilrettelegging` → `TYPES.stiforbedring`, `BRIDGE_COLOR`, `tilretteCount`, `DEFAULT_GEOM_BY_SUBTYPE`, `GEOM_BY_KIND`, `SUBTYPES` og tester (`worklog.test.js`, `routes.test.js`, `layers.test.js`). Søk etter `tilrettelegging` i hele `src/`.
- `gjerdeklyver` beholdes som nøkkel, fordi den er knyttet til tabellnavnet `gjerdeklyvere`. Bare visningsnavnet endres (se under).
- "Om"-tekstene for de nye navnene skrives om (f.eks. Kjetting, Naturstein, Stikkrøyr, Steinstøv).

### Krysningspunkt

- Stavefeil: "Kryssningspunkt(er)" → **Krysningspunkt(er)**.
- Ny undertype **Ombygd gjerdeklyver** (`ombygd`) i `SUBTYPES.gjerdeklyver` og `gjerdeklyvere_subtypes_chk`.
- **Datamerknad:** migreringen `20260929130000` gjorde `ombygd` om til `annen` med `subtype_other = 'Ombygd klyver'`. Disse radene flyttes tilbake: `annen` byttes med `ombygd` i `subtypes`, og `subtype_other` settes til `NULL`.

### Benk

- Nye undertyper: **Kvilebenk** (`kvilebenk`), **Bordbenk** (`bordbenk`), **Enkel benk** (`enkel`).
- Utvid `other_points_subtype_chk`. Eksisterende benker blir stående uten undertype ("ukjent").

### Stikryss

- Ny punkttype `stikryss` i `TYPES` (eget symbol og farge), kun punktgeometri.
- Utvid `other_points_geom_kind_chk`/kind-listene der det trengs.
- Brukes og vises først og fremst i Stinettverk (fase 4), der stikryss også kan foreslås automatisk fra segmentenes endepunkter.

---

## Fase 2 – Geometri og kartgrafikk

### Stiforbedringer som linjer

- Alle undertyper av stiforbedring er linjeformede. Nye stiforbedringer kan bare lagres som linje i skjemaet (`GEOM_BY_KIND.stiforbedring = ['line']` i UI).
- **Eksisterende data: 53 stiforbedringer, noen er allerede linjer.** Kjør tellespørringen over for å se hvor mange som er `POINT`/`POLYGON`. Bare disse må tegnes om.
- Punkter og flater kan ikke gjøres om til linjer automatisk. Databasen godtar dem fortsatt, så ingenting går tapt.
- Admin får en liste / et filter "Bør tegnes om som linje" med de gjenværende punktene og flatene, så de kan tegnes om én etter én. Når du åpner en slik i redigering, er linje forhåndsvalgt og det gamle punktet vises som hjelp.

### Parkering som flate

- `parkering` legges til i `GEOM_BY_KIND` med `['point', 'poly']`, og `other_points_geom_kind_chk` utvides.
- Eksisterende parkeringspunkter er fortsatt gyldige. Markøren vises midt i flaten (som for flater i dag via `feature_anchor`).

### Egen grafikk per underlagstype

- `addStretch` i `WorklogMap.jsx` kjenner i dag bare bru og planker. Den erstattes av en stiltabell per undertype i `models/routes.js`, som både kartet (lagdelte Leaflet-linjer med `dashArray`) og `AlongStrip` (CSS-gradient) bruker.
- Forslag:
  - Bru: hel linje
  - Klopp: planker
  - Trapp: tverrstreker
  - Kjetting: prikkekjede
  - Naturstein: grå "brostein"
  - Stikkrøyr: korte tverrstreker
  - Grus: lys beige
  - Treflis: brune streker
  - Steinstøv: lys grå

### To tegnforklaringer

- Detaljert underlagsgrafikk vises bare i **Hva finnes**.
- **Stinettverk** og **Turruter** får en enkel tegnforklaring for bruk på tur.
- `MapLegend` tar allerede imot `mode`, så dette bygges videre på det.

---

## Fase 3 – Grunneiere → Eiendommer

- **Begreper:** hovedbegrepet blir *Eiendom* (`owners`). Teigene (`parcels`), som i dag heter "eiendom" i skjemaet, får navnet **Teig** i grensesnittet, så to ting ikke heter det samme.
- **Navn er fritekst** (tittel på eiendommen). Feltet `name` brukes videre.
- **Opptil tre kontaktpersoner**, hver med navn, rolle, telefon og e-post – alt fritekst. Ny kolonne `contacts jsonb` på `owners` med CHECK på at lengden er ≤ 3.
- **Migrering:** `contact_name`/`phone`/`email` kopieres til `contacts[0]` med rollen "Grunneier". De gamle kolonnene beholdes én versjon og fjernes i en senere migrering.
- **Grensesnitt:** "Grunneier/Grunneiere" → "Eiendom/Eiendommer" i fane, liste, detalj, skjema ("Rediger eiendom"), tegnforklaring, lagvelger, "Grunneiere langs ruta" og "Grunneier her". `OwnerDetail` viser én ringeknapp per kontakt med telefonnummer.
- Mode-id-en `grunneiere` i URL-en beholdes, så gamle lenker virker.

---

## Fase 4 – Stinettverk

### Datamodell

- Ny tabell `trail_segments`: `geom geometry(LineString, 4326)`, valgfritt navn, `hub_id`, tidsstempler, RLS som de andre tabellene (offentlig lesing, admin skriving).
- View `trail_segments_geojson` med lengde regnet ut på serveren.
- Stikryss lagres som punkttypen `stikryss` (fase 1). Endepunkter der tre eller flere segmenter møtes kan foreslås som stikryss.
- Stiforbedringer (underlag, kjetting, bru osv.) ligger fortsatt i `other_points` som linjer oppå nettverket, på samme måte som `route_features` finner dem i dag.

### Lage nettverket fra rutene som finnes

- Engangsjobb i PostGIS: `ST_Node(ST_Union(geom))` over alle `routes` deler rutene der de krysser og overlapper.
- Resultatet lagres som segmenter, uten duplikater der flere ruter går på samme sti.
- Ingenting må tegnes på nytt for å komme i gang.

### Redigering

- Tegne nye segmenter som fester seg til eksisterende endepunkter og knekkpunkter (bygger på `GeometryDrawField`).
- Dele og slette segmenter.

### Senere (4b)

- Bygge en turrute ved å klikke segmenter i nettverket.
- Eksisterende ruter beholder sin egen lagrede geometri, så ingenting brekker.

---

## Fase 5 – Hovedfaner og mobil

- `MODES` i `App.jsx` og `AdminApp.jsx`: **Stinettverk · Turruter · Eiendommer · Hva finnes**, med nytt mode `stinettverk` i `MODE_IDS`, `DEFAULT_LAYERS` og `LAYER_KEYS`.
- **Mobil:** Stinettverk er standardvisning og står først (rekkefølge Stinettverk → Turruter → Eiendommer → Hva finnes).
- **PC:** samme rekkefølge; standardvisning kan være Hva finnes eller Stinettverk.
- Lanseres når Stinettverk har innhold (etter fase 4).
