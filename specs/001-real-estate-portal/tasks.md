# Tasks: Real Estate Portal MVP (Sreality Wrapper)


**Input**: Design documents from `/specs/001-real-estate-portal/`
**Prerequisites**: plan.md (required), spec.md (required)

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Create de-scope inventory document `specs/001-real-estate-portal/research.md`
- [x] T002 Define adapter interfaces in `lib/integrations/sources/source-adapter.types.ts`
- [x] T003 [P] Add feature flags/config for portal pivot in `lib/config/portal.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T004 Add Supabase migration for `portal_sources` table in `supabase/migrations/`
- [x] T005 Add Supabase migration for `listings` canonical table in `supabase/migrations/`
- [x] T006 [P] Add Supabase migration for `listing_media` in `supabase/migrations/`
- [x] T007 [P] Add Supabase migration for `listing_raw_snapshots` in `supabase/migrations/`
- [x] T008 Add Supabase migration for `listing_parse_results` and `ingestion_runs`
- [x] T009 Implement normalized listing upsert repository in `lib/integrations/ingestion/upsert-listings.ts`
- [x] T010 Add ingestion run + error logging utilities in `lib/integrations/ingestion/`

**Checkpoint**: DB + ingestion foundation ready.

---

## Phase 3: User Story 1 - Sreality Ingestion (P1)

**Goal**: Pull Sreality data, parse, normalize, persist idempotently.

- [x] T011 [P] [US1] Add fixture samples for Sreality payloads in `tests/parsers/fixtures/`
- [x] T012 [P] [US1] Write failing deterministic parser tests in `tests/parsers/sreality-deterministic.test.ts`
- [x] T013 [US1] Implement Sreality adapter in `lib/integrations/sources/sreality-adapter.ts`
- [x] T014 [US1] Implement deterministic parser in `lib/integrations/parsers/deterministic-parser.ts`
- [x] T015 [US1] Implement ingestion orchestrator in `lib/integrations/ingestion/run-ingestion.ts`
- [x] T016 [US1] Expose ingestion trigger route in `app/api/integrations/sreality/ingest/route.ts`
- [x] T017 [US1] Add idempotency integration test in `tests/integrations/sreality-ingestion.test.ts`

**Checkpoint**: Ingestion runs successfully and upserts listings.

---

## Phase 4: User Story 2 - Zillow-like Listing Catalog (P2)

**Goal**: Render listings from DB in Zillow-inspired UI.

- [x] T018 [P] [US2] Create listing query layer in `lib/listings/queries.ts`
- [x] T019 [P] [US2] Create listing card and grid components in `components/listings/`
- [x] T020 [US2] Implement listing page in `app/page.tsx` + `components/listings/PortalListingsHome.tsx`
- [x] T021 [US2] Add source attribution link UI and tracking
- [x] T022 [US2] Add page-level rendering test in `tests/listings/list-page.test.tsx`

**Checkpoint**: User can browse listing cards and open source URLs.

---

## Phase 5: User Story 3 - Detailed Filtering (P3)

**Goal**: Provide multi-criteria filtering.

- [x] T023 [P] [US3] Define filter schema with Zod in `lib/listings/filters.ts`
- [x] T024 [US3] Implement filter API route in `app/api/market-listings/route.ts`
- [x] T025 [US3] Implement filter UI controls in `components/listings/filters/`
- [x] T026 [US3] Add integration tests for combined filters in `tests/listings/filter-api.test.ts`
- [x] T027 [US3] Optimize query performance and add indexes migration (`034_listings_filter_performance_indexes.sql`)

**Checkpoint**: Combined filters return correct and performant results.

---

## Phase 6: User Story 4 - De-scope Legacy Features (P3)

**Goal**: Remove or disable non-portal functionality.

- [x] T028 [US4] Mark keep/rewrite/remove matrix for current routes in `specs/001-real-estate-portal/research.md`
- [x] T029 [US4] Remove irrelevant API routes (mail/reporting/non-portal agents) *(hard-deleted in Wave 1+2; middleware remains as safety net)*
- [x] T030 [US4] Remove irrelevant UI pages and nav entries *(dashboard/settings/storage + agent UI hard-deleted; nav reduced to portal listing)*
- [x] T031 [US4] Update README + architecture docs for portal-only scope
- [x] T032 [US4] Run regression tests and fix breakages *(typecheck + 5 real-estate vitest suites passing on 2026-04-13)*

---

## Phase 7: LLM Enrichment (Optional in MVP, recommended)

- [x] T033 Add LLM enrichment parser in `lib/integrations/parsers/llm-enrichment-parser.ts`
- [x] T034 Add confidence + provenance persistence in parser result schema (`035_listing_parse_results_provenance.sql`)
- [x] T035 Add fallback behavior tests for low-confidence outputs (`tests/parsers/llm-enrichment-parser.test.ts`)

---

## Notes

- Tests for parser/ingestion/filter logic are mandatory due constitution principles.
- Prefer disabling endpoints behind flags before full deletion if uncertainty exists.
- Keep data migration reversible where practical.





