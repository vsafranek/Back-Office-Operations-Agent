# Implementation Plan: Public Browsing, Saved Listings & Map-List Discovery

**Branch**: `002-public-map-saved-listings` | **Date**: 2026-04-13 | **Spec**: `/specs/002-public-map-saved-listings/spec.md`  
**Input**: Feature specification from `/specs/002-public-map-saved-listings/spec.md`

## Summary

Rozšířit současný realitní portál o plně veřejné prohlížení (bez loginu), uživatelské ukládání oblíbených pro přihlášené účty, dedikovaný endpoint pro kompletní ingest Sreality (MVP: byty) a Zillow-like split UX s mapou + synchronizovaným seznamem podle aktuálního viewportu.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js App Router (Node.js runtime)  
**Primary Dependencies**: Next.js, React, Supabase JS SDK, Zod, map rendering library already used in UI stack (Leaflet/MapLibre via React wrapper)  
**Storage**: Supabase Postgres (listings + saved listings + ingestion audit), existing media URLs  
**Testing**: Vitest (unit/integration), route-level tests, UI interaction tests for map/list sync  
**Target Platform**: Web (desktop-first split view, responsive fallback for mobile)  
**Project Type**: Full-stack web application (single Next.js project)  
**Performance Goals**: map/list sync p95 <= 2s after pan/zoom; listing API p95 <= 800ms on MVP dataset  
**Constraints**: anonymous read access only for public listing data; auth required for save actions; idempotent ingestion; auditable ingest runs  
**Scale/Scope**: MVP only Sreality apartments, extensible adapter architecture for additional sources

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Security & Privacy by Default**: PASS (public endpoints expose only listing fields; saved listing actions protected by authenticated user context; no secrets in client).
- **II. Human Approval for External Actions**: PASS (scrape trigger is explicit operator action via protected endpoint; no autonomous outbound communication).
- **III. Traceability and Auditability**: PASS (ingestion_run tracking, structured logs, correlation IDs required in ingest + save endpoints).
- **IV. Test-First Delivery for Business-Critical Logic**: PASS WITH ENFORCEMENT (contract and integration tests required for ingest idempotency, saved-list RLS behavior, map/list query sync).
- **V. Spec-Driven Incremental Change**: PASS (spec -> plan -> tasks sequencing retained, each story independently testable).

## Project Structure

### Documentation (this feature)

```text
specs/002-public-map-saved-listings/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── portal-public-map-saved.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── api/
│   ├── integrations/sreality/ingest/route.ts      # operator-triggered full apartment ingest
│   ├── market-listings/route.ts                   # public listing search + map bounds
│   ├── market-listings/[id]/route.ts              # public listing detail
│   └── saved-listings/
│       ├── route.ts                               # GET user saved listings / POST save listing
│       └── [listingId]/route.ts                   # DELETE saved listing
├── page.tsx                                       # split map/list catalog landing
└── listing/[id]/page.tsx                          # listing detail page

components/
└── listings/
    ├── PortalListingsHome.tsx                     # orchestrates split view state
    ├── ListingDetailPage.tsx
    ├── ListingMapPanel.tsx                        # map markers + viewport events
    ├── ListingResultsPanel.tsx                    # synchronized list panel
    ├── SavedListingButton.tsx                     # save/unsave CTA with auth gating
    └── filters/ListingFiltersPanel.tsx

lib/
├── auth/server-auth.ts                            # authenticated user resolution
├── listings/
│   ├── filters.ts                                 # schema incl. bounds
│   ├── queries.ts                                 # listing read queries + map-bounds SQL
│   └── saved-listings.ts                          # save/unsave domain service
└── integrations/
    ├── ingestion/run-ingestion.ts                 # full run orchestration
    ├── ingestion/ingestion-runs.ts                # run logs and summary
    └── sources/sreality-adapter.ts                # page-by-page apartment adapter

supabase/migrations/
├── 036_saved_listings.sql                         # saved listings table + RLS
├── 037_public_listing_read_policies.sql           # anon read policy guardrails
└── 038_map_bounds_indexes.sql                     # geospatial/performance indexes

tests/
├── integrations/
│   ├── sreality-ingestion-full-run.test.ts
│   ├── saved-listings-route.test.ts
│   └── market-listings-map-sync.test.ts
├── listings/
│   └── split-view-sync.test.tsx
└── contract/
    └── portal-public-map-saved.contract.test.ts
```

**Structure Decision**: Zachovat single-project Next.js architekturu a doplnit ji o samostatný modul saved listings + map-sync vrstvu bez vytváření nového backend projektu.

## Phase 0 - Research & Final Decisions

1. Potvrdit parametry bounds filtrace (bbox vs polygon) -> pro MVP zvolit bbox.  
2. Potvrdit přístup k mapovým podkladům (stávající poskytovatel) -> reuse existující map stack.  
3. Potvrdit autorizační model ingest endpointu -> pouze service role / operator session.  
4. Definovat UX fallback pro mobile viewport -> tab switch map/list.

## Phase 1 - Design Artifacts

1. `research.md` s rozhodnutími a alternativami.  
2. `data-model.md` s entitami, vazbami, validačními pravidly a RLS.  
3. `contracts/portal-public-map-saved.openapi.yaml` pro veřejné čtení, ingest trigger a save endpoints.  
4. `quickstart.md` se scénáři ověření (anon browse, ingest, saved listings, map sync).

## Phase 2 - Implementation Planning Strategy

- **MVP Slice A (P1)**: veřejný browsing + ingest byty.
- **MVP Slice B (P2)**: saved listings pro přihlášené.
- **MVP Slice C (P2)**: mapa + synchronizovaný seznam.
- **Hardening (P3)**: edge cases, observability, performance, polish.

## Post-Design Constitution Re-Check

- Security: PASS (RLS on saved listings + controlled ingest).
- Human approval: PASS (manual ingest trigger, audit trail).
- Traceability: PASS (run IDs, logs, click/save telemetry).
- Test-first: PASS (tasks include pre-implementation contract/integration tests).
- Incremental delivery: PASS (three independent delivery slices).

## Complexity Tracking

No constitution violations require justification.
