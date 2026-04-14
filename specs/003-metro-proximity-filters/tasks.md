# Tasks: Metro and Transit Proximity Filters

**Input**: Design documents from `/specs/003-metro-proximity-filters/`  
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required for this feature (constitution principle IV + filtering correctness + map/list sync).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align contracts/types and bootstrap transit feature skeleton.

- T001 Align current listing API param naming with new transit contract in `app/api/market-listings/route.ts`
- T002 Add transit feature flags and defaults in `lib/config/portal.ts`
- T003 [P] Extend shared listing DTOs with transit info in `lib/listings/types.ts`
- T004 [P] Add public transit stop DTO definitions in `lib/listings/types.ts`
- T005 [P] Add initial transit filter UI placeholders in `components/listings/filters/ListingFiltersPanel.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared data and query foundation required by all stories.

**⚠️ CRITICAL**: Complete before user story implementation.

- T006 Create migration `039_transit_stops.sql` for `transit_stops` schema in `supabase/migrations/`
- T007 Create migration `040_listing_transit_profile.sql` for `listing_transit_profile` schema in `supabase/migrations/`
- T008 Create migration `041_transit_filter_indexes.sql` for transit query performance indexes in `supabase/migrations/`
- T009 [P] Implement transit stop repository helpers in `lib/transit/stops.ts`
- T010 [P] Implement transit score computation helpers in `lib/transit/scoring.ts`
- T011 [P] Implement listing transit profile enrichment helpers in `lib/transit/profile.ts`
- T012 Extend request parsing/validation for transit filters in `lib/listings/filters.ts`
- T013 Extend listing SQL pipeline with transit-aware constraints in `lib/listings/queries.ts`
- T014 Add structured telemetry fields for transit filters in `lib/observability/logger.ts`

**Checkpoint**: Shared transit data model + filter/query pipeline are ready.

---

## Phase 3: User Story 1 - Filtrovat nabídky podle dostupnosti metra (Priority: P1) 🎯 MVP

**Goal**: Uživatel může filtrovat výsledky podle "u metra", max vzdálenosti a max času chůze.

**Independent Test**: Zapnout `nearMetro`, změnit distance/time limity a ověřit konzistentní změnu výsledků v mapě i seznamu.

### Tests for User Story 1

- T015 [P] [US1] Add contract tests for transit query params on `GET /api/market-listings` in `tests/contract/portal-transit-filters.contract.test.ts`
- T016 [P] [US1] Add integration test for `nearMetro` + `maxMetroDistanceM` filtering in `tests/integrations/market-listings-transit-filters.test.ts`
- T017 [P] [US1] Add integration test for `maxMetroWalkMin` filtering in `tests/integrations/market-listings-transit-filters.test.ts`

### Implementation for User Story 1

- T018 [US1] Implement transit filter handling in listing route `GET /api/market-listings` in `app/api/market-listings/route.ts`
- T019 [US1] Add metro distance/time controls and reset behavior in `components/listings/filters/ListingFiltersPanel.tsx`
- T020 [US1] Wire metro distance/time state into query builder in `components/listings/PortalListingsHome.tsx`
- T021 [US1] Render nearest metro distance/walk info badge in `components/listings/ListingResultsPanel.tsx`

**Checkpoint**: Near-metro filtering independently functional and testable.

---

## Phase 4: User Story 2 - Upřesnit výsledky podle linek, stanic a typu dopravy (Priority: P2)

**Goal**: Uživatel může kombinovat line filters, station filters a transit mode kombinace (metro/tram/bus/vlak).

**Independent Test**: Vybrat linky/stanice a kombinovaný režim `any`; výsledky odpovídají zadaným podmínkám.

### Tests for User Story 2

- T022 [P] [US2] Add contract tests for `metroLines`, `metroStopIds`, `transitModes`, `transitMatchMode` in `tests/contract/portal-transit-filters.contract.test.ts`
- T023 [P] [US2] Add integration test for metro line and station filtering in `tests/integrations/market-listings-transit-filters.test.ts`
- T024 [P] [US2] Add integration test for combined transit mode OR matching in `tests/integrations/market-listings-transit-filters.test.ts`

### Implementation for User Story 2

- T025 [US2] Extend filter parsing for lines/stations/modes in `lib/listings/filters.ts`
- T026 [US2] Extend query composition for lines/stations/modes in `lib/listings/queries.ts`
- T027 [US2] Add line/station/mode controls in `components/listings/filters/ListingFiltersPanel.tsx`
- T028 [US2] Wire new controls into request query state in `components/listings/PortalListingsHome.tsx`
- T029 [US2] Add explanatory empty-state reasons for restrictive transit filters in `components/listings/ListingResultsPanel.tsx`

**Checkpoint**: Advanced line/station/mode filtering independently functional.

---

## Phase 5: User Story 3 - Rozumět dopravní kvalitě přes skóre a mapu (Priority: P2)

**Goal**: Uživatel vidí transit score, mapovou vrstvu stanic a coverage zóny při filtrování.

**Independent Test**: Nastavit `minTransitScore`, zapnout mapovou transit vrstvu a ověřit synchronní změny mapy i seznamu.

### Tests for User Story 3

- T030 [P] [US3] Add contract test for `GET /api/transit/stops` in `tests/contract/portal-transit-filters.contract.test.ts`
- T031 [P] [US3] Add integration test for transit stops bounds endpoint in `tests/integrations/transit-stops-route.test.ts`
- T032 [P] [US3] Add UI test for score filter + map overlay sync in `tests/listings/transit-filter-map-sync.test.tsx`

### Implementation for User Story 3

- T033 [US3] Implement public transit stops route in `app/api/transit/stops/route.ts`
- T034 [US3] Add transit stop overlay and coverage circles rendering in `components/listings/ListingMapLibreCanvas.tsx`
- T035 [US3] Add map layer controls and overlay state in `components/listings/ListingMapPanel.tsx`
- T036 [US3] Add transit score filter control in `components/listings/filters/ListingFiltersPanel.tsx`
- T037 [US3] Surface score and nearest-stop details on cards/detail in `components/listings/ListingResultsPanel.tsx` and `components/listings/ListingDetailPage.tsx`
- T038 [US3] Add score query wiring and diagnostics rendering in `components/listings/PortalListingsHome.tsx`

**Checkpoint**: Transit score and map visualization independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Stabilization, observability, docs and final validation.

- T039 [P] Add transit filter analytics events and correlation IDs in `lib/observability/logger.ts` and relevant routes
- T040 [P] Add fallback UX for listings without coordinates/transit profile in `components/listings/ListingResultsPanel.tsx`
- T041 Update README and feature quickstart usage notes in `README.md` and `specs/003-metro-proximity-filters/quickstart.md`
- T042 Run full quickstart validation and capture outcomes in `specs/003-metro-proximity-filters/research.md`
- T043 Run regression suite for listings+map interactions in `tests/integrations/` and `tests/listings/`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 -> can start immediately.
- Phase 2 -> depends on Phase 1 and blocks all user stories.
- Phases 3-5 -> depend on Phase 2; can run in parallel by staffing.
- Phase 6 -> depends on required user stories being complete.

### User Story Dependencies

- **US1**: no dependency on other stories (after foundation) and is MVP-critical.
- **US2**: depends on foundational transit schema/query work; independent from US3.
- **US3**: depends on foundational transit data and benefits from US1 query extensions, but remains independently testable once stop endpoint exists.

### Parallel Opportunities

- T003/T004/T005 in setup.
- T009/T010/T011 in foundational phase.
- Contract/integration/UI test tasks marked [P] inside each story.
- US2 and US3 can proceed in parallel after US1 core filtering is stable.

---

## Parallel Example: US2 + US3

```bash
# US2 test slice in parallel
T022, T023, T024

# US3 test slice in parallel
T030, T031, T032

# Implementation parallel slice
T027 (US2 filter UI) and T034 (US3 map overlay)
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Deliver US1 (near-metro filtering by distance/time).
3. Validate against SC-001 and SC-003.

### Incremental Delivery

1. Add US2 (lines/stations/combined modes).
2. Add US3 (score + map overlays).
3. Finalize Phase 6 hardening and regression checks.

### Team Strategy

- Dev A: data + query + migrations (Phase 2, US1 backend)
- Dev B: filter UX and list/map query wiring (US1/US2 frontend)
- Dev C: transit overlay + scoring presentation (US3 frontend/backend)

---

## Notes

- Keep all new routes and query params aligned with `contracts/portal-transit-filters.openapi.yaml`.
- If transit scoring formula changes, update `data-model.md` and quickstart expectations.
- Prefer additive migrations and idempotent profile recomputation to preserve backward compatibility.

