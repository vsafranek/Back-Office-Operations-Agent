# Tasks: Public Browsing, Saved Listings & Map-List Discovery

**Input**: Design documents from `/specs/002-public-map-saved-listings/`  
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required for this feature (constitution principle IV + business-critical ingest/auth/map sync).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature scaffolding and baseline docs/contracts sync.

- [x] T001 Validate and align API route skeletons with contract in `app/api/` (market-listings, saved-listings, integrations/sreality/ingest)
- [x] T002 Add feature config flags for split map/list and saved listings in `lib/config/portal.ts`
- [x] T003 [P] Add base shared DTO/types for listing map responses in `lib/listings/types.ts`
- [x] T004 [P] Add request validation schemas for bounds + filters in `lib/listings/filters.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database + security + query foundations required by all stories.

**⚠️ CRITICAL**: Complete before user story implementation.

- [x] T005 Create migration `036_saved_listings.sql` with table + unique `(user_id, listing_id)` in `supabase/migrations/`
- [x] T006 Create migration `037_public_listing_read_policies.sql` to enforce anonymous-safe listing read policies in `supabase/migrations/`
- [x] T007 Create migration `038_map_bounds_indexes.sql` for active/bounds/price query performance in `supabase/migrations/`
- [x] T008 [P] Add/adjust RLS policies for `saved_listings` in migration and verify ownership isolation in `supabase/migrations/`
- [x] T009 Implement saved listing domain service (`save`, `unsave`, `listMine`) in `lib/listings/saved-listings.ts`
- [x] T010 Implement reusable operator authorization guard for ingest trigger in `lib/security/operator-auth.ts`
- [x] T011 Add ingestion run summary helpers for full-run counters/status in `lib/integrations/ingestion/ingestion-runs.ts`

**Checkpoint**: Shared security + data foundations complete.

---

## Phase 3: User Story 1 - Veřejné prohlížení bez přihlášení (Priority: P1) 🎯 MVP

**Goal**: Umožnit anonymnímu uživateli plné čtení katalogu a detailu nabídek.

**Independent Test**: Incognito uživatel načte katalog, detail a zdrojový odkaz bez login promptu.

### Tests for User Story 1

- [x] T012 [P] [US1] Add contract test for `GET /api/market-listings` and `GET /api/market-listings/{id}` in `tests/contract/portal-public-map-saved.contract.test.ts`
- [x] T013 [P] [US1] Add integration test for anonymous catalog browsing in `tests/market-listings-route.test.ts`
- [x] T014 [P] [US1] Add integration test for anonymous listing detail in `tests/market-listings-detail-route.test.ts`

### Implementation for User Story 1

- [x] T015 [US1] Extend public listing query pipeline with field allowlist in `lib/listings/queries.ts`
- [x] T016 [US1] Implement/adjust public list route behavior in `app/api/market-listings/route.ts`
- [x] T017 [US1] Implement/adjust public detail route behavior in `app/api/market-listings/[id]/route.ts`
- [x] T018 [US1] Ensure source attribution rendering in catalog/detail UI in `components/listings/PortalListingsHome.tsx` and `components/listings/ListingDetailPage.tsx`

**Checkpoint**: Anonymous browsing independently functional.

---

## Phase 4: User Story 2 - Kompletní ingest bytů endpointem (Priority: P1)

**Goal**: Spustit kompletní scrape Sreality (byty) přes chráněný endpoint, idempotentně a auditovatelně.

**Independent Test**: Dva po sobě jdoucí běhy endpointu vrátí validní run summary bez duplicit.

### Tests for User Story 2

- [x] T019 [P] [US2] Add contract test for `POST /api/integrations/sreality/ingest` in `tests/contract/portal-public-map-saved.contract.test.ts`
- [x] T020 [P] [US2] Add integration test for full-run ingest success path in `tests/integrations/sreality-ingestion-full-run.test.ts`
- [x] T021 [P] [US2] Add integration test for idempotent rerun in `tests/integrations/sreality-ingestion-full-run.test.ts`

### Implementation for User Story 2

- [x] T022 [US2] Extend Sreality adapter full apartment pagination behavior in `lib/integrations/sources/sreality-adapter.ts`
- [x] T023 [US2] Implement full-run orchestration mode + error aggregation in `lib/integrations/ingestion/run-ingestion.ts`
- [x] T024 [US2] Implement operator-protected trigger route in `app/api/integrations/sreality/ingest/route.ts`
- [x] T025 [US2] Persist run lifecycle and counters in `lib/integrations/ingestion/ingestion-runs.ts`

**Checkpoint**: Operator can trigger complete apartment scrape with auditable results.

---

## Phase 5: User Story 3 - Uložené nabídky pro přihlášené (Priority: P2)

**Goal**: Přihlášený uživatel může ukládat/odebírat nabídky a zobrazit svůj seznam.

**Independent Test**: Po loginu uživatel uloží, načte a odebere nabídku; cizí uživatel k datům nemá přístup.

### Tests for User Story 3

- [x] T026 [P] [US3] Add contract tests for `GET/POST/DELETE /api/saved-listings*` in `tests/contract/portal-public-map-saved.contract.test.ts`
- [x] T027 [P] [US3] Add integration test for save/unsave lifecycle in `tests/integrations/saved-listings-route.test.ts`
- [x] T028 [P] [US3] Add integration test for row ownership isolation in `tests/integrations/saved-listings-route.test.ts`

### Implementation for User Story 3

- [x] T029 [US3] Implement `GET/POST /api/saved-listings` route in `app/api/saved-listings/route.ts`
- [x] T030 [US3] Implement `DELETE /api/saved-listings/[listingId]` route in `app/api/saved-listings/[listingId]/route.ts`
- [x] T031 [US3] Add save/unsave UI control with auth gating in `components/listings/SavedListingButton.tsx`
- [x] T032 [US3] Integrate saved-state hydration into catalog cards/detail in `components/listings/PortalListingsHome.tsx` and `components/listings/ListingDetailPage.tsx`

**Checkpoint**: Saved listings independently functional and secure.

---

## Phase 6: User Story 4 - Zillow-like mapa + synchronizovaný seznam (Priority: P2)

**Goal**: Split view s mapou a seznamem, synchronizace podle viewportu + obousměrné zvýraznění.

**Independent Test**: Pan/zoom mapy mění list výsledků, výběr markeru a karty je synchronní.

### Tests for User Story 4

- [x] T033 [P] [US4] Add integration test for bounds-filtered listing API in `tests/integrations/market-listings-map-sync.test.ts`
- [x] T034 [P] [US4] Add UI interaction test for map<->list selection sync in `tests/listings/split-view-sync.test.tsx`

### Implementation for User Story 4

- [x] T035 [US4] Add bbox filter support and pagination behavior in `lib/listings/queries.ts`
- [x] T036 [US4] Implement map viewport query wiring in `app/api/market-listings/route.ts`
- [x] T037 [US4] Implement map panel component with price markers in `components/listings/ListingMapPanel.tsx`
- [x] T038 [US4] Implement synchronized results panel in `components/listings/ListingResultsPanel.tsx`
- [x] T039 [US4] Integrate split-view state orchestration and mobile toggle in `components/listings/PortalListingsHome.tsx`

**Checkpoint**: Map/list UX independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Stabilizace, observability, dokumentace a finální validace.

- [x] T040 [P] Add structured logs and correlation IDs for save + ingest + map-query flows in `lib/observability/logger.ts` and related routes
- [x] T041 [P] Add empty-state and inactive-saved-listing UX handling in `components/listings/`
- [x] T042 Update README and feature docs with public/auth behavior + ingest operator usage in `README.md` and `specs/002-public-map-saved-listings/quickstart.md`
- [x] T043 Execute full quickstart validation and record outcomes in `specs/002-public-map-saved-listings/research.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- Phase 1 -> can start immediately.
- Phase 2 -> depends on Phase 1 and blocks all user stories.
- Phases 3-6 -> depend on Phase 2; can run parallel by staffing, recommended order P1 -> P1 -> P2 -> P2.
- Phase 7 -> depends on all required story phases.

### User Story Dependencies
- **US1**: no dependency on other stories (after foundation).
- **US2**: no dependency on US1, but both are MVP-critical.
- **US3**: depends on foundational auth/service setup, independent from US4.
- **US4**: depends on public listing APIs (US1 foundations) but independently testable once bounds API is available.

### Parallel Opportunities
- T003/T004 in setup.
- T006/T007/T008 in foundational migrations.
- Contract + integration tests inside each story marked [P].
- US3 and US4 can proceed in parallel after US1 core API stabilization.

---

## Parallel Example: US3 + US4

```bash
# US3 tests in parallel
T026, T027, T028

# US4 UI/API tests in parallel
T033, T034

# Implementation parallel slice
T031 (saved button UI) and T037 (map panel UI)
```

---

## Implementation Strategy

### MVP First
1. Complete Phase 1 and Phase 2.
2. Deliver US1 (anonymous browsing).
3. Deliver US2 (full apartment ingest endpoint).
4. Validate MVP against SC-001, SC-002, SC-003, SC-006.

### Incremental Delivery
1. Add US3 (saved listings).
2. Add US4 (split map/list sync).
3. Finalize Phase 7 hardening and performance checks.

### Team Strategy
- Dev A: ingestion + operator endpoint (US2)
- Dev B: public listing API + bounds logic (US1/US4 backend)
- Dev C: UI split view + save button experiences (US3/US4 frontend)

---

## Notes

- Keep all new routes aligned with `contracts/portal-public-map-saved.openapi.yaml`.
- Any deviation from contract must be reflected in contract and quickstart before completion.
- Favor additive migrations; avoid destructive schema changes in this feature.

