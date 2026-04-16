# Implementation Plan: Listing Detail Experience

**Branch**: `master` | **Date**: 2026-04-13 | **Spec**: `/specs/004-listing-detail-experience/spec.md`  
**Input**: Feature specification from `/specs/004-listing-detail-experience/spec.md`

## Summary

Vylepšit detail nemovitosti do moderního "hero-first" layoutu: nahoře velký carousel fotek, pod ním strukturované informace o nemovitosti, náhled mapky sousedství a samostatná sekce kontaktu na oprávněnou osobu. Zároveň zachovat stávající funkce (uložení oblíbené, odkaz na originál, robustní fallbacky při chybějících datech).

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js App Router (Node.js runtime)  
**Primary Dependencies**: Next.js, React, Mantine UI, MapLibre GL, Supabase JS SDK  
**Storage**: Supabase Postgres (existing listings + listing media + listing metadata, no new table required for MVP)  
**Testing**: Vitest (integration + API route tests), TypeScript typecheck  
**Target Platform**: Web (desktop + responsive mobile)  
**Project Type**: Single full-stack Next.js application  
**Performance Goals**: Detail page first meaningful content under 2s in typical dataset; carousel interactions perceived instant (<150ms interaction feedback)  
**Constraints**: Must preserve anonymous read flow; no secret leakage in client; graceful fallback for missing image/location/contact data; no breaking change in existing detail API shape  
**Scale/Scope**: Listing detail screen for all existing listing sources (Sreality-first), one listing at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Security & Privacy by Default**: PASS (kontakt pouze z veřejně dostupných listing dat; žádné nové citlivé tajné údaje na klientu).  
- **II. Human Approval for External Actions**: PASS (feature nepřidává nové outbound automatizace, pouze detailní zobrazení dat).  
- **III. Traceability and Auditability**: PASS (stávající `x-correlation-id` flow v API zůstává, změny jsou převážně prezentační).  
- **IV. Test-First Delivery for Business-Critical Logic**: PASS WITH ENFORCEMENT (UI/API fallbacky a datové mapování kontaktu pokrýt integračními testy).  
- **V. Spec-Driven Incremental Change**: PASS (spec -> plan -> tasks -> implementace po samostatně testovatelných slicech).

## Project Structure

### Documentation (this feature)

```text
specs/004-listing-detail-experience/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── listing-detail-experience.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── listing/[id]/page.tsx                         # detail page route entry
└── api/market-listings/[id]/route.ts             # detail payload endpoint (verify compatibility)

components/
└── listings/
    ├── ListingDetailPage.tsx                     # main layout + carousel + sections
    └── ListingDetailNeighborhoodMap.tsx          # mini neighborhood map preview

lib/
└── listings/
    ├── queries.ts                                # detail shaping (existing)
    └── types.ts                                  # DTOs used by detail UI

tests/
├── market-listings-detail-route.test.ts          # detail endpoint behavior
└── listings/                                     # add/extend detail UI interaction coverage
```

**Structure Decision**: Zachovat stávající single-project Next.js strukturu; feature je primárně UI composition nad existujícím detail API, s minimálními backend úpravami.

## Phase 0 - Research & Final Decisions

1. Potvrdit UX pattern pro hero carousel a fallback při 0/1/N obrázcích.
2. Potvrdit strategii "kontakt oprávněné osoby" z heterogenního `metadata` bez lámání existujícího API.
3. Potvrdit rozsah neighborhood map preview (statický náhled vs. interaktivní mini mapa) pro MVP.
4. Potvrdit mobilní chování (pořadí sekcí, scroll ergonomie, čitelnost CTA).
5. Potvrdit testovací strategii pro scénáře s chybějícími daty.

## Phase 1 - Design Artifacts

1. `research.md` s rozhodnutími k UX, datovým fallbackům a kontakt mappingu.
2. `data-model.md` s prezentačními entity/view-modely (`GalleryState`, `AuthorizedContactView`, `NeighborhoodPreview`).
3. `contracts/listing-detail-experience.openapi.yaml` pro detail endpoint response expectations (bez breaking change).
4. `quickstart.md` s manuálními validačními scénáři pro desktop/mobile a edge cases.

## Phase 2 - Implementation Planning Strategy

- **Slice A (P1)**: Hero carousel (0/1/N image stavy), top CTA, základní informační hierarchy.
- **Slice B (P1)**: Kompletní detail facts sekce + robustní fallbacky na chybějící hodnoty.
- **Slice C (P2)**: Neighborhood map preview + kontakt oprávněné osoby.
- **Hardening (P3)**: Accessibility polish, responsive tuning, regression tests pro detail API/UI.

## Post-Design Constitution Re-Check

- Security: PASS (kontakt pouze z již uložených listing dat; žádná nová tajemství).
- Human approval: PASS (žádné nové externí side effects).
- Traceability: PASS (zachováno stávající API observability; UI změna bez nových rizikových toků).
- Test-first: PASS (plán zahrnuje rozšíření detail route + UI edge coverage).
- Incremental delivery: PASS (carousel a facts přináší hodnotu samostatně i bez map/contact sekce).

## Complexity Tracking

No constitution violations require justification.
