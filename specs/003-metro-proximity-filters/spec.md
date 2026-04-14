# Feature Specification: Metro and Transit Proximity Filters

**Feature Branch**: `[003-metro-proximity-filters]`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "Přidej lepší filtry včetně metra, vzdálenosti, času chůze, linek, stanic, dopravního skóre, kombinovaných filtrů a mapové vizualizace."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filtrovat nabídky podle dostupnosti metra (Priority: P1)

Kupující nebo nájemce chce rychle vybrat jen nabídky, které jsou blízko metra, bez nutnosti ručně odhadovat vzdálenost z mapy.

**Why this priority**: Dostupnost metra je hlavní rozhodovací faktor a zásadně zkracuje čas hledání.

**Independent Test**: Uživatel zapne filtr "u metra" a nastaví limit vzdálenosti nebo času chůze; seznam i mapa zobrazí jen odpovídající nabídky.

**Acceptance Scenarios**:

1. **Given** uživatel prohlíží nabídky, **When** zapne filtr "u metra", **Then** systém vrátí pouze nabídky s platnou dostupností metra podle výchozího limitu.
2. **Given** uživatel nastaví maximální vzdálenost 600 m, **When** potvrdí filtr, **Then** systém zobrazí jen nabídky do 600 m od nejbližší stanice metra.
3. **Given** uživatel přepne metry na čas chůze, **When** nastaví "do 10 minut", **Then** systém vrátí nabídky odpovídající tomuto limitu.

---

### User Story 2 - Upřesnit výsledky podle linek, stanic a typu dopravy (Priority: P2)

Uživatel chce vyhledávat podle konkrétních linek metra, konkrétních stanic a zároveň kombinovat preference i pro jiné typy dopravy (tram, bus, vlak).

**Why this priority**: Uživatelé často hledají lokalitu vůči konkrétní trase do práce/školy, ne jen obecně "blízko metra".

**Independent Test**: Uživatel vybere linku metra a konkrétní stanici, případně zapne kombinaci "metro nebo tram"; výsledky odpovídají zvoleným podmínkám.

**Acceptance Scenarios**:

1. **Given** uživatel zvolí linky A a C, **When** aplikuje filtr, **Then** systém vrátí nabídky navázané na dostupnost vybraných linek.
2. **Given** uživatel zvolí konkrétní stanice, **When** aplikuje filtr, **Then** systém vrátí nabídky v definované dostupnosti od těchto stanic.
3. **Given** uživatel aktivuje "metro nebo tram", **When** aplikuje filtr, **Then** systém vrátí nabídky splňující alespoň jeden z vybraných dopravních režimů.

---

### User Story 3 - Rozumět dopravní kvalitě přes skóre a mapu (Priority: P2)

Uživatel chce vidět nejen filtrovaný výsledek, ale i jasné vysvětlení dopravní kvality lokality na kartě nabídky a v mapě.

**Why this priority**: Lepší vysvětlení výsledků zvyšuje důvěru v doporučené nabídky a usnadňuje porovnávání.

**Independent Test**: Uživatel vidí u nabídky dopravní skóre, odhad času k metru a na mapě vrstvu stanic s dostupnostními zónami.

**Acceptance Scenarios**:

1. **Given** výsledky obsahují nabídky s dopravními daty, **When** uživatel otevře kartu nabídky, **Then** vidí dopravní badge/skóre a základní vysvětlení.
2. **Given** uživatel zapne mapovou vrstvu dopravy, **When** zobrazí mapu, **Then** vidí stanice metra a zóny dostupnosti.
3. **Given** uživatel klikne na stanici v mapě, **When** se zobrazí její detail, **Then** vidí počet relevantních nabídek v dosahu.

---

### Edge Cases

- Co se stane, když nabídka nemá přesné souřadnice a nelze určit vzdálenost od zastávky?
- Jak se systém zachová, když vybrané stanice/typy dopravy nemají v daném výřezu žádné výsledky?
- Co se stane, když je nabídka blízko více stanic najednou s různými linkami?
- Jak se vypočte čas chůze při velmi krátké vzdálenosti (zaokrouhlení na minuty)?
- Jak se zobrazí data, když je dočasně nedostupný zdroj dopravních bodů?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Systém MUST umožnit zapnout/vypnout filtr "u metra" jedním ovladačem.
- **FR-002**: Systém MUST umožnit filtrovat podle maximální vzdálenosti od nejbližší stanice metra.
- **FR-003**: Systém MUST umožnit filtrovat podle maximálního času chůze k metru.
- **FR-004**: Systém MUST poskytovat předvolby vzdálenosti (např. 300 m, 600 m, 1000 m) i vlastní hodnotu.
- **FR-005**: Systém MUST umožnit výběr jedné nebo více linek metra.
- **FR-006**: Systém MUST umožnit výběr jedné nebo více konkrétních stanic metra.
- **FR-007**: Systém MUST umožnit kombinované dopravní filtry alespoň pro metro, tram, bus a vlak.
- **FR-008**: Systém MUST umožnit logiku "splňuje alespoň jeden vybraný typ dopravy" pro kombinované filtry.
- **FR-009**: Systém MUST zobrazit u každé nabídky stručnou informaci o dopravní dostupnosti (např. nejbližší stanice + čas/vzdálenost).
- **FR-010**: Systém MUST zobrazit dopravní skóre lokality ve srozumitelné škále.
- **FR-011**: Systém MUST umožnit filtrovat podle minimálního dopravního skóre.
- **FR-012**: Systém MUST zobrazit v mapě stanice metra jako samostatnou vrstvu.
- **FR-013**: Systém MUST zobrazit v mapě dostupnostní zóny pro zvolené limity.
- **FR-014**: Systém MUST udržovat konzistenci mezi mapou a seznamem při aktivaci dopravních filtrů.
- **FR-015**: Systém MUST jasně indikovat, proč nabídka nesplnila aktivní dopravní filtr (např. překročený limit).
- **FR-016**: Systém MUST nabídnout uživateli snadný reset všech dopravních filtrů na výchozí stav.

### Key Entities *(include if feature involves data)*

- **Transit Stop**: Dopravní bod (zejména stanice metra) s názvem, typem dopravy, linkou, polohou a stavem dostupnosti.
- **Listing Transit Profile**: Profil dostupnosti nabídky obsahující nejbližší zastávky, vzdálenosti, odhad času chůze a agregované dopravní skóre.
- **Transit Filter Criteria**: Uživatelsky zvolená kombinace podmínek (max vzdálenost, max čas, linky, stanice, typy dopravy, minimální skóre).
- **Transit Coverage Zone**: Mapová zóna reprezentující dostupnostní hranici kolem zastávky pro aktivní filtr.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uživatel dokáže během 20 sekund zapnout filtr "u metra" a zobrazit odpovídající výsledky bez nutnosti ruční práce s mapou.
- **SC-002**: Alespoň 90 % uživatelů v uživatelském testu správně pochopí význam dopravního skóre a dokáže podle něj upravit filtr.
- **SC-003**: Po aktivaci dopravních filtrů se aktualizace seznamu i mapy dokončí do 2 sekund v minimálně 95 % interakcí.
- **SC-004**: Alespoň 80 % relací, které používají dopravní filtry, využije během jedné relace alespoň jednu pokročilou volbu (linky, stanice nebo kombinovaný režim).
- **SC-005**: Po nasazení klesne podíl relací s okamžitým opuštěním výsledků o 15 % u uživatelů, kteří aktivovali dopravní filtry.

## Assumptions

- Primární trh je Praha a okolí, kde je dostupnost metra zásadní kritérium výběru.
- Uživatelé očekávají jednoduchý vstup ("u metra") i pokročilé filtrování bez přepnutí do jiného režimu stránky.
- V první verzi je dostačující pracovat s pěší dostupností bez modelování aktuálního jízdního řádu.
- Dopravní body (metro/tram/bus/vlak) jsou dostupné v dostatečné kvalitě pro běžné vyhledávání.
- Funkce navazuje na existující mapa+seznam flow a musí zůstat kompatibilní s anonymním prohlížením.