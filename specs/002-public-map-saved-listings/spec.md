# Feature Specification: Public Browsing, Saved Listings & Map-List Discovery

**Feature Branch**: `002-public-map-saved-listings`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "Zaměřit se na design aplikace. Nepřihlášený uživatel může prohlížet reality. Přihlášený uživatel si může ukládat reality. Potřebuji endpoint, kterým se scrapnou celé Sreality a uloží, pro začátek jen byty. Chci Zillow-like mapu na jedné straně a výpis realit na druhé straně, synchronizovaný podle mapy."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Veřejné prohlížení nabídek bez přihlášení (Priority: P1)

Jako návštěvník bez účtu chci okamžitě prohlížet nabídky bytů,
abych mohl rychle posoudit trh bez nutnosti registrace.

**Why this priority**: Otevřený přístup je klíčový pro akvizici uživatelů a první hodnotu produktu.

**Independent Test**: Otevřít katalog v anonymním režimu a ověřit, že se načítají karty i detailní údaje bez autentizace.

**Acceptance Scenarios**:

1. **Given** existují uložené nabídky bytů, **When** anonymní uživatel otevře katalog, **Then** zobrazí se seznam nabídek s cenou, lokalitou, dispozicí, plochou a fotografií.
2. **Given** anonymní uživatel je na kartě nabídky, **When** zvolí přechod na zdroj, **Then** může otevřít originální inzerát na Sreality.
3. **Given** uživatel není přihlášen, **When** prohlíží výsledky, **Then** není blokován login wall pro čtení dat.

---

### User Story 2 - Kompletní ingest bytů ze Sreality přes dedikovaný endpoint (Priority: P1)

Jako operátor systému chci mít endpoint, který spustí kompletní scrape Sreality pro byty,
aby se data pravidelně plnila do interní databáze a byla připravena pro vyhledávání.

**Why this priority**: Bez robustního ingestu není co zobrazovat v katalogu ani na mapě.

**Independent Test**: Spustit endpoint manuálně, dokončit jeden běh a ověřit počty nových/aktualizovaných záznamů, log chyb a idempotenci opakovaného běhu.

**Acceptance Scenarios**:

1. **Given** endpoint je dostupný autorizovanému operátorovi, **When** je volání spuštěno, **Then** systém zpracuje všechny dostupné stránky Sreality v kategorii bytů v definovaném rozsahu.
2. **Given** inzerát již existuje v databázi, **When** proběhne další scrape, **Then** záznam se aktualizuje bez vytvoření duplicity.
3. **Given** některé inzeráty mají nekompletní pole, **When** jsou zpracovány, **Then** systém uloží dostupná data, označí neúplnost a běh se kvůli tomu nezastaví.
4. **Given** během běhu nastane chyba na části stránek, **When** běh doběhne, **Then** je vráceno shrnutí úspěchů/chyb a možnost bezpečného opakování.

---

### User Story 3 - Ukládání oblíbených nabídek pro přihlášené uživatele (Priority: P2)

Jako přihlášený uživatel chci ukládat jednotlivé nabídky do oblíbených,
abych je mohl později rychle dohledat.

**Why this priority**: Obohacuje základní browsing o retenci a opakované návštěvy.

**Independent Test**: Přihlásit se, uložit více nabídek, obnovit stránku/sesí a ověřit perzistenci i možnost odebrání.

**Acceptance Scenarios**:

1. **Given** uživatel je přihlášen, **When** klikne na „Uložit“, **Then** nabídka se přidá do jeho osobního seznamu.
2. **Given** nabídka je uložená, **When** uživatel otevře „Uložené nabídky“, **Then** položka je viditelná s klíčovými informacemi pro rychlou orientaci.
3. **Given** uživatel není přihlášen, **When** chce uložit nabídku, **Then** systém vyžádá přihlášení před dokončením akce.
4. **Given** nabídka je v oblíbených, **When** uživatel zvolí odebrání, **Then** položka zmizí z jeho uloženého seznamu.

---

### User Story 4 - Zillow-like split view: mapa + synchronizovaný seznam (Priority: P2)

Jako návštěvník chci na jedné polovině obrazovky mapu a na druhé seznam,
abych mohl filtrovat lokalitou a hned vidět odpovídající reality.

**Why this priority**: Geografické objevování je zásadní UX vlastnost realitního portálu.

**Independent Test**: Posouvat/zoomovat mapu a ověřit, že seznam i markery vždy odpovídají aktuálním hranicím mapy a aktivním filtrům.

**Acceptance Scenarios**:

1. **Given** split view je otevřený, **When** se načtou data, **Then** na mapě se zobrazí nabídky jako cenové markery.
2. **Given** uživatel změní viewport mapy, **When** proběhne refresh výsledků, **Then** seznam obsahuje pouze nabídky v aktuálním mapovém výřezu.
3. **Given** uživatel vybere marker na mapě, **When** je výběr potvrzen, **Then** odpovídající karta v seznamu se zvýrazní.
4. **Given** uživatel vybere položku v seznamu, **When** je položka aktivní, **Then** mapa zvýrazní odpovídající marker.

---

### Edge Cases

- Co se stane, když se struktura Sreality částečně změní a některá pole nejdou parseovat?
- Jak se řeší situace, kdy endpoint scrape běží souběžně vícekrát?
- Jak se chová split view, když ve viewportu mapy nejsou žádné nabídky?
- Jak se zachová seznam oblíbených, pokud zdrojový inzerát mezitím zmizí nebo je neaktivní?
- Jak se řeší rychlé opakované pan/zoom akce, aby se nezobrazovala zastaralá data?
- Co se stane při výpadku zdrojového systému během dlouhého scrape běhu?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Systém MUSÍ umožnit anonymním uživatelům prohlížet katalog nabídek bytů bez přihlášení.
- **FR-002**: Systém MUSÍ zobrazit u veřejně dostupné nabídky minimálně cenu, lokalitu, dispozici, plochu, hlavní fotografii a odkaz na zdroj.
- **FR-003**: Systém MUSÍ poskytnout dedikovaný endpoint pro spuštění kompletního scrape Sreality v rozsahu bytů pro MVP.
- **FR-004**: Systém MUSÍ při scrape ukládat nové i existující nabídky idempotentně bez duplicit.
- **FR-005**: Systém MUSÍ ukládat surový payload zdroje pro audit a případné opětovné zpracování.
- **FR-006**: Systém MUSÍ normalizovat klíčové atributy nabídky (cena, lokalita, typ nabídky, typ nemovitosti, dispozice, plocha, souřadnice pokud dostupné, média, zdrojová URL).
- **FR-007**: Systém MUSÍ vracet po scrape běhu souhrn stavu (zpracováno, vloženo, aktualizováno, selhalo).
- **FR-008**: Systém MUSÍ umožnit přihlášenému uživateli uložit nabídku do oblíbených.
- **FR-009**: Systém MUSÍ umožnit přihlášenému uživateli odebrat nabídku z oblíbených.
- **FR-010**: Systém MUSÍ uchovávat oblíbené nabídky odděleně podle identity uživatele.
- **FR-011**: Systém MUSÍ vyžadovat autentizaci pro operace ukládání/odebírání oblíbených.
- **FR-012**: Systém MUSÍ nabídnout Zillow-like split layout s mapou na jedné části a seznamem nabídek na druhé části obrazovky.
- **FR-013**: Systém MUSÍ na mapě zobrazovat nabídky formou markerů s cenovým štítkem.
- **FR-014**: Systém MUSÍ synchronizovat seznam nabídek s aktuálním viewportem mapy a aktivními filtry.
- **FR-015**: Systém MUSÍ synchronizovat výběr položky mezi mapou a seznamem obousměrně.
- **FR-016**: Systém MUSÍ zachovat čitelné chování při nulových výsledcích (ve viewportu mapy nebo po aplikaci filtrů).
- **FR-017**: Systém MUSÍ logovat chyby scrape/parsování s kontextem pro opakování běhu a diagnostiku.
- **FR-018**: Systém MUSÍ být navržen tak, aby bylo možné v budoucnu přidat další realitní zdroje bez narušení toku Sreality.

### Key Entities *(include if feature involves data)*

- **Listing**: Normalizovaná nabídka bytu určená pro zobrazení v katalogu a mapě.
- **ListingSnapshot**: Verzionovaný surový záznam ze zdroje pro audit a reparsing.
- **IngestionRun**: Jeden běh scrape endpointu se stavy, metrikami a diagnostikou.
- **SavedListing**: Vazba mezi přihlášeným uživatelem a uloženou nabídkou.
- **MapViewportQuery**: Stav dotazu reprezentující aktuální hranice mapy a aktivní filtry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Alespoň 95 % dostupných bytových inzerátů z cílového scrape rozsahu je při běhu úspěšně uloženo nebo aktualizováno.
- **SC-002**: Alespoň 90 % aktivních záznamů má vyplněné klíčové atributy: cena, lokalita, dispozice, typ nemovitosti a zdrojová URL.
- **SC-003**: 100 % anonymních návštěvníků v akceptačních testech dokáže otevřít katalog a zobrazit detail nabídky bez přihlášení.
- **SC-004**: Úspěšnost operací „uložit/odebrat oblíbenou nabídku“ je alespoň 99 % při testované zátěži běžných uživatelských scénářů.
- **SC-005**: V 95. percentilu interakcí se seznam po změně viewportu mapy synchronizuje do 2 sekund.
- **SC-006**: 100 % zobrazených nabídek obsahuje funkční přechod na originální zdrojový inzerát, pokud je URL dostupná.

## Assumptions

- MVP rozsah scrape je omezen na kategorii bytů; ostatní typy nemovitostí jsou mimo tuto fázi.
- Veřejné prohlížení je read-only; vytváření/úprava inzerátů uživatelem není součástí scope.
- Ukládání oblíbených je dostupné pouze pro autentizované uživatele se standardní uživatelskou rolí.
- Zillow-like design znamená inspirační UX pattern (mapa + seznam), nikoli kopírování chráněných prvků značky.
- Pro mobilní obrazovky může být split view nahrazen přepínáním mapa/seznam při zachování stejné datové logiky.
