# Research: Metro and Transit Proximity Filters

## Decision 1: Transit filtering model uses precomputed listing transit profiles
- **Decision**: U každé nabídky ukládat agregované transit metriky (nejbližší metro, vzdálenost, odhad pěšího času, skóre) do dedikovaného profilu.
- **Rationale**: Dotazy nad katalogem zůstanou rychlé a predikovatelné i při kombinaci více filtrů.
- **Alternatives considered**:
  - Počítat vzdálenosti on-the-fly v každém requestu: zamítnuto kvůli výkonu.
  - Vše počítat pouze na klientu: zamítnuto kvůli nekonzistenci a velkému objemu dat.

## Decision 2: Walking time is deterministic estimate for MVP
- **Decision**: Čas chůze odhadnout z lineární vzdálenosti konzervativním přepočtem (m/min) bez externího routingu.
- **Rationale**: Stabilní chování, nulová závislost na externím placeném API, snadné testování.
- **Alternatives considered**:
  - Reálný routing API pro každou nabídku: odloženo (náklady, latence, quota).
  - Žádný time filter, jen metry: zamítnuto (uživatelský požadavek výslovně zahrnuje minuty).

## Decision 3: Praha-first metro scope with extensible transit types
- **Decision**: V první verzi explicitně pokrýt metro A/B/C a současně připravit strukturu i pro tram/bus/vlak.
- **Rationale**: Nejvyšší byznysová hodnota je "u metra", ale kombinované filtry musí být připravené od začátku.
- **Alternatives considered**:
  - Metro-only bez ostatních typů: zamítnuto (uživatelský požadavek na kombinace).
  - Full nationwide transit model: odloženo (vyšší složitost bez MVP přínosu).

## Decision 4: Transit score is interpretable weighted index
- **Decision**: Skóre počítat jako vážený index dostupnosti (metro priorita > tram > bus/vlak) a publikovat jako jednoduché pásmo (např. 0-100 + slovní popis).
- **Rationale**: Uživatel musí chápat, proč nabídka dostala dané skóre, a umět podle něj filtrovat.
- **Alternatives considered**:
  - Black-box score bez vysvětlení: zamítnuto (nízká důvěra).
  - Jen textové štítky bez čísla: zamítnuto (hůře filtrovatelné).

## Decision 5: Map visualization uses stop markers + coverage circles
- **Decision**: Zobrazit stanice jako body a dostupnostní zóny jako kružnice podle aktivního limitu.
- **Rationale**: Jednoduché, rychlé a konzistentní napříč viewporty.
- **Alternatives considered**:
  - Izochrony po ulicích: odloženo (výpočetně náročné, vyžaduje routing zdroj).
  - Bez mapové vrstvy: zamítnuto (uživatel požadoval explicitní mapovou vizualizaci).

## Decision 6: Combined transit filter semantics = OR across selected modes
- **Decision**: Pokud uživatel zvolí více typů dopravy, nabídka projde když splní alespoň jeden zvolený typ.
- **Rationale**: Odpovídá uživatelskému očekávání "metro nebo tram".
- **Alternatives considered**:
  - AND logika pro všechny typy: zamítnuto (příliš restriktivní, matoucí výstupy).

## Decision 7: Explainability for filtered-out listings
- **Decision**: API vrací i stručný důvod nesplnění aktivních transit podmínek pro debug/UX tooltip.
- **Rationale**: Pomáhá uživateli upravit filtr místo opakovaného pokus-omyl.
- **Alternatives considered**:
  - Bez důvodu, jen prázdný výsledek: zamítnuto (horší UX).

## Decision 8: Contract split for listing filters and transit stop overlay
- **Decision**: Rozšířit `GET /api/market-listings` o transit parametry a přidat `GET /api/transit/stops` pro mapový overlay.
- **Rationale**: Jasné oddělení mezi katalogovým dotazem a geodaty pro render mapy.
- **Alternatives considered**:
  - Vkládat celý transit dataset do listing response: zamítnuto (payload bloat).
  - Separátní endpoint pro každý transit typ: zamítnuto (zbytečná fragmentace).

## Implementation Validation (2026-04-13)
- Automated validation: `npm run typecheck` -> PASS.
- Contract and integration coverage:
  - `tests/contract/portal-transit-filters.contract.test.ts` -> PASS.
  - `tests/integrations/transit-stops-route.test.ts` -> PASS.
  - `tests/integrations/market-listings-transit-filters.test.ts` -> PASS.
- Map/list regression checks:
  - `tests/listings/transit-filter-map-sync.test.tsx` -> PASS.
  - `tests/listings/split-view-sync.test.ts` -> PASS.
  - `tests/market-listings-route.test.ts` -> PASS.
