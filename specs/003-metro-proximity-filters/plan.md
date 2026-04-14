# Implementation Plan: Metro and Transit Proximity Filters

**Branch**: `master` | **Date**: 2026-04-13 | **Spec**: `/specs/003-metro-proximity-filters/spec.md`  
**Input**: Feature specification from `/specs/003-metro-proximity-filters/spec.md`

## Summary

Rozšířit katalog realit o dopravní filtry zaměřené na metro/MHD: vzdálenost a čas chůze k metru, výběr linek a stanic, kombinované režimy dopravy, dopravní skóre a mapovou vrstvu zastávek se zónami dostupnosti. Řešení naváže na existující mapa+seznam UX a bude použitelné i pro anonymní prohlížení.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js App Router (Node.js runtime)  
**Primary Dependencies**: Next.js, React, Supabase JS SDK, Zod, MapLibre renderer already used in listing map UI  
**Storage**: Supabase Postgres (listings + new transit metadata/profiles + transit stops)  
**Testing**: Vitest (contract, integration, UI interaction tests)  
**Target Platform**: Web (desktop split view + responsive mobile toggle)  
**Project Type**: Full-stack web application (single Next.js project)  
**Performance Goals**: dopravní filtr p95 <= 2s pro mapa+seznam refresh; listing query p95 <= 900ms při aktivních transit filtrech  
**Constraints**: anonymní read flow musí zůstat bez loginu; žádné úniky interních dat; geodata musí být idempotentně aktualizovatelná; migrační změny pouze přes versioned SQL  
**Scale/Scope**: Praha-first MVP (metro A/B/C + transit typy metro/tram/bus/vlak), architektura připravená pro další města

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Security & Privacy by Default**: PASS (nové endpointy vrací jen veřejná listing/transit metadata; žádné tajné klíče na klientu; auditovatelný ingest transit dat).
- **II. Human Approval for External Actions**: PASS (žádné nové outbound akce třetím stranám; jde o read/query UX + interní datové enrichmenty).
- **III. Traceability and Auditability**: PASS (dopravní query filtry a fallback stavy budou logované se correlation ID).
- **IV. Test-First Delivery for Business-Critical Logic**: PASS WITH ENFORCEMENT (testy pro query přesnost, map/list sync, edge cases bez GPS a kombinované filtry).
- **V. Spec-Driven Incremental Change**: PASS (spec -> plan -> tasks -> implementace, s nezávislými US řezy).

## Project Structure

### Documentation (this feature)

```text
specs/003-metro-proximity-filters/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── portal-transit-filters.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── api/
│   ├── market-listings/route.ts                    # extend query params with transit filters
│   └── transit/stops/route.ts                      # lightweight public dataset for map overlays
├── page.tsx
└── listing/[id]/page.tsx

components/
└── listings/
    ├── filters/ListingFiltersPanel.tsx             # transit controls (metro, distance, time, lines, stations)
    ├── ListingMapPanel.tsx                         # stop overlay + coverage zones
    ├── ListingMapLibreCanvas.tsx                   # map layer rendering + interactions
    ├── ListingResultsPanel.tsx                     # transit badges, reason hints
    └── PortalListingsHome.tsx                      # unified filter state + map/list sync

lib/
├── listings/
│   ├── filters.ts                                  # transit query schema/validation
│   ├── queries.ts                                  # SQL composition with transit joins and score constraints
│   └── types.ts                                    # DTO updates for transit fields
├── transit/
│   ├── scoring.ts                                  # score composition rules
│   ├── stops.ts                                    # stop read/model helpers
│   └── profile.ts                                  # listing-transit profile utilities
└── observability/logger.ts                         # structured telemetry for transit-filter flows

supabase/migrations/
├── 039_transit_stops.sql
├── 040_listing_transit_profile.sql
└── 041_transit_filter_indexes.sql

tests/
├── contract/
│   └── portal-transit-filters.contract.test.ts
├── integrations/
│   ├── market-listings-transit-filters.test.ts
│   └── transit-stops-route.test.ts
└── listings/
    └── transit-filter-map-sync.test.tsx
```

**Structure Decision**: Zachovat stávající single Next.js projekt a přidat transit doménový modul (`lib/transit`) + nové API route/migrace bez odděleného backend služby.

## Phase 0 - Research & Final Decisions

1. Potvrdit zdroj a kvalitu transit stop datasetu (metro/tram/bus/vlak) pro Praha-first scope.  
2. Potvrdit způsob výpočtu pěšího času (deterministický odhad vs. externí routing API) -> pro MVP deterministický odhad.  
3. Potvrdit strategii výpočtu `nearest_metro_distance_m` a cache invalidace při změně stop/listing GPS.  
4. Potvrdit podobu dopravního skóre a jeho vysvětlení v UI (srozumitelné pro ne-technického uživatele).  
5. Potvrdit mapovou vrstvu zón (kružnice vs. izochrony) -> pro MVP kružnice.

## Phase 1 - Design Artifacts

1. `research.md` s finálními rozhodnutími, racionálem a alternativami.  
2. `data-model.md` s entitami transit stop/profile/filter a validačními pravidly.  
3. `contracts/portal-transit-filters.openapi.yaml` pro rozšířené listing filtry + transit stops endpoint.  
4. `quickstart.md` se scénáři ověření pro metro distance/time, line/station combos, score a mapové vrstvy.

## Phase 2 - Implementation Planning Strategy

- **Slice A (P1)**: Filtr "u metra" + distance/time + výchozí UX a API podpora.
- **Slice B (P2)**: Linky/stanice + kombinovaný režim metro/tram/bus/vlak.
- **Slice C (P2)**: Dopravní skóre + mapová vrstva stanic a coverage zón.
- **Hardening (P3)**: Edge cases bez GPS, fallback messaging, index tuning, observability.

## Post-Design Constitution Re-Check

- Security: PASS (public read only transit metadata; explicit field allowlist).
- Human approval: PASS (no outbound communication side effects introduced).
- Traceability: PASS (transit-filter telemetry + correlation IDs included in query paths).
- Test-first: PASS (contract + integration + UI test packs are part of execution slices).
- Incremental delivery: PASS (MVP path independently valuable after Slice A).

## Complexity Tracking

No constitution violations require justification.
