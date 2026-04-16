# Tasks: Listing Detail Experience

**Input**: Design documents from `/specs/004-listing-detail-experience/`  
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required for this feature (constitution principle IV + detail UX fallback correctness).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared UI/contract baseline for the upgraded detail page.

- T001 Align detail contract expectations with current endpoint shape in `specs/004-listing-detail-experience/contracts/listing-detail-experience.openapi.yaml` and `app/api/market-listings/[id]/route.ts`
- T002 [P] Add/normalize shared detail DTO fields used by new sections in `lib/listings/types.ts`
- T003 [P] Add reusable format/extraction helpers for detail presentation in `components/listings/ListingDetailPage.tsx`
- T004 [P] Define quickstart validation checklist entries for manual QA in `specs/004-listing-detail-experience/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared building blocks required by all user stories.

**⚠️ CRITICAL**: Complete before user story implementation.

- T005 Implement resilient media fallback resolver (`images` -> `previewImageUrl` -> `galleryPreviewUrls`) in `components/listings/ListingDetailPage.tsx`
- T006 [P] Implement authorized-contact view normalization from metadata in `components/listings/ListingDetailPage.tsx`
- T007 [P] Create neighborhood mini-map component scaffold in `components/listings/ListingDetailNeighborhoodMap.tsx`
- T008 Ensure listing detail API keeps backward-compatible response behavior in `app/api/market-listings/[id]/route.ts` and `lib/listings/queries.ts`
- T009 Add shared fallback-state copy and section-state derivation in `components/listings/ListingDetailPage.tsx`

**Checkpoint**: Foundation ready - user story implementation can proceed.

---

## Phase 3: User Story 1 - View Complete Listing Overview (Priority: P1) 🎯 MVP

**Goal**: Uživatel vidí kompletní a čitelný přehled detailu inzerátu v jasné hierarchii.

**Independent Test**: Otevřít detail nabídky a ověřit, že klíčová data (title, cena, lokalita, fakta) jsou čitelně zobrazená i při částečně chybějících údajích.

### Tests for User Story 1

- T010 [P] [US1] Extend detail route integration coverage for core fields and fallback-safe payload in `tests/market-listings-detail-route.test.ts`
- T011 [P] [US1] Add UI integration test for section hierarchy and missing-value fallbacks in `tests/listings/listing-detail-overview.test.ts`

### Implementation for User Story 1

- T012 [US1] Rebuild top-level detail layout hierarchy (hero-first + information sections) in `components/listings/ListingDetailPage.tsx`
- T013 [US1] Implement comprehensive facts block rendering with fallback values in `components/listings/ListingDetailPage.tsx`
- T014 [US1] Preserve existing actions (back, save, original link) in new layout in `components/listings/ListingDetailPage.tsx`
- T015 [US1] Render transparency metadata block with safe formatting in `components/listings/ListingDetailPage.tsx`

**Checkpoint**: Core detail overview is independently functional and testable.

---

## Phase 4: User Story 2 - Browse Property Photos with Hero Carousel (Priority: P1)

**Goal**: Uživatel může plynule procházet fotografie přes velký horní carousel.

**Independent Test**: Ověřit 0/1/N image scénáře, navigaci šipkami a výběr přes miniatury.

### Tests for User Story 2

- T016 [P] [US2] Add UI tests for carousel navigation and active index behavior in `tests/listings/listing-detail-carousel.test.ts`
- T017 [P] [US2] Add UI tests for single-image and no-image fallback behavior in `tests/listings/listing-detail-carousel.test.ts`

### Implementation for User Story 2

- T018 [US2] Implement hero carousel state (`activeIndex`, next/prev wrap logic) in `components/listings/ListingDetailPage.tsx`
- T019 [US2] Implement hero image controls and position indicator in `components/listings/ListingDetailPage.tsx`
- T020 [US2] Implement thumbnail strip with direct image selection in `components/listings/ListingDetailPage.tsx`
- T021 [US2] Implement explicit empty-media fallback state in `components/listings/ListingDetailPage.tsx`

**Checkpoint**: Hero carousel behavior is independently functional and testable.

---

## Phase 5: User Story 3 - Evaluate Area and Contact Responsible Person (Priority: P2)

**Goal**: Uživatel vidí kontext okolí přes mapový náhled a kontakt na odpovědnou osobu.

**Independent Test**: Otevřít detail s/bez GPS a s/bez contact metadat; ověřit mapku, kontakt sekci a fallback texty.

### Tests for User Story 3

- T022 [P] [US3] Add UI test for neighborhood map visible/missing coordinate states in `tests/listings/listing-detail-neighborhood.test.ts`
- T023 [P] [US3] Add UI test for contact available/partial/missing states in `tests/listings/listing-detail-contact.test.ts`

### Implementation for User Story 3

- T024 [US3] Implement interactive neighborhood preview map with listing marker in `components/listings/ListingDetailNeighborhoodMap.tsx`
- T025 [US3] Integrate neighborhood map section into detail layout with fallback messaging in `components/listings/ListingDetailPage.tsx`
- T026 [US3] Implement authorized contact section rendering from normalized metadata in `components/listings/ListingDetailPage.tsx`
- T027 [US3] Add support for representative contact fields mapping (name/organization/phone/email) in `lib/listings/queries.ts` and `components/listings/ListingDetailPage.tsx`

**Checkpoint**: Neighborhood and contact experience is independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Stabilization, responsiveness, documentation, and regression safety.

- T028 [P] Improve responsive behavior and spacing for mobile detail layout in `components/listings/ListingDetailPage.tsx`
- T029 [P] Accessibility pass for carousel and section controls (ARIA labels, keyboard interactions) in `components/listings/ListingDetailPage.tsx`
- T030 Update project docs with new detail page behavior in `README.md`
- T031 Run quickstart validation and record outcomes in `specs/004-listing-detail-experience/quickstart.md`
- T032 Run regression suite for listing detail and listing APIs in `tests/market-listings-detail-route.test.ts` and `tests/listings/*.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phase 3-5 (User Stories)**: Depend on Phase 2 completion; can run in parallel by team capacity.
- **Phase 6 (Polish)**: Depends on completion of selected user stories.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after foundation; defines MVP baseline.
- **US2 (P1)**: Depends on foundational media helpers; independent from US3.
- **US3 (P2)**: Depends on foundational contact/map helpers; independent from US2.

### Within Each User Story

- Tests first (must fail before implementation).
- State/model helpers before UI composition.
- UI composition before polish/accessibility.
- Story checkpoint must pass before closing phase.

### Parallel Opportunities

- Phase 1: T002, T003, T004 in parallel.
- Phase 2: T006 and T007 in parallel.
- Story test tasks marked `[P]` can run together.
- US2 and US3 can be developed in parallel after US1 baseline is stable.

---

## Parallel Example: US2 + US3

```bash
# US2 tests in parallel
T016
T017

# US3 tests in parallel
T022
T023

# Implementation in parallel
T020 (US2 thumbnail UX) and T024 (US3 neighborhood map component)
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1) fully.
3. Validate independent US1 acceptance before continuing.

### Incremental Delivery

1. Add US2 (hero carousel depth and media UX).
2. Add US3 (neighborhood + contact conversion sections).
3. Finalize with Phase 6 polish and regressions.

### Team Strategy

- Dev A: detail API/data shaping + fallback logic (T008, T027).
- Dev B: carousel and main detail layout (US1/US2).
- Dev C: neighborhood map + contact section (US3).

---

## Notes

- Keep `GET /api/market-listings/{id}` contract backward-compatible while enriching presentation.
- Prefer explicit fallback UI over hidden sections for missing optional data.
- Ensure new tests cover no-image, no-coordinate, and no-contact scenarios.

