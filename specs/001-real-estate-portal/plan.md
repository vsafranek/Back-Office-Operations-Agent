# Implementation Plan: Real Estate Portal MVP (Sreality Wrapper)

**Branch**: `001-real-estate-portal` | **Date**: 2026-04-13 | **Spec**: `/specs/001-real-estate-portal/spec.md`
**Input**: Feature specification from `/specs/001-real-estate-portal/spec.md`

## Summary

Pivot the existing back-office app into a Zillow-style real estate portal MVP that
aggregates Sreality listings into Supabase, normalizes + enriches listing data,
then serves listing browse and detailed filtering UX. Remove or disable unrelated
legacy workflows to reduce maintenance complexity.

## Technical Context

**Language/Version**: TypeScript (Next.js App Router, Node.js runtime)  
**Primary Dependencies**: Next.js, React, Supabase JS SDK, OpenAI SDK, Zod,
existing internal agent/tool framework  
**Storage**: Supabase Postgres + storage for media references (URLs only for MVP)  
**Testing**: Vitest (unit/integration), route-level integration tests,
parser fixture tests  
**Target Platform**: Web app (server-rendered + API routes)  
**Project Type**: Full-stack web application (single Next.js project)  
**Performance Goals**: Listing/filter API p95 <= 800ms on MVP dataset,
initial listing page render under 2.5s on typical office network  
**Constraints**: Keep source attribution + source URL for each listing,
idempotent ingestion, no destructive data loss during pivot  
**Scale/Scope**: MVP = Sreality only + adapter abstraction for future providers;
read-only portal UX

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Security & Privacy by Default**: PASS (no client-side secrets, server-only source/API keys).
- **Human Approval for External Actions**: PASS (MVP is read-mostly ingestion/listing; no outbound comms).
- **Traceability and Auditability**: PASS with required work (ingestion_run + parser diagnostics logging).
- **Test-First Delivery**: PASS with required work (parser fixtures, ingestion idempotency tests,
  filter query tests before implementation).
- **Spec-Driven Incremental Change**: PASS (spec + plan + upcoming tasks).

## Project Structure

### Documentation (this feature)

```text
specs/001-real-estate-portal/
+¦¦ plan.md
+¦¦ spec.md
+¦¦ research.md
+¦¦ data-model.md
+¦¦ quickstart.md
+¦¦ contracts/
L¦¦ tasks.md
```

### Source Code (repository root)

```text
app/
+¦¦ api/
-   +¦¦ market-listings/                # keep/reshape for portal listing APIs
-   +¦¦ integrations/sreality/          # new/updated ingestion routes if exposed
-   L¦¦ ...                             # remove or disable non-portal endpoints
+¦¦ dashboard/                          # convert to portal listing pages
L¦¦ ...

components/
+¦¦ listings/                           # new Zillow-style list/filter/detail UI components
L¦¦ ...

lib/
+¦¦ integrations/
-   +¦¦ sources/
-   -   +¦¦ sreality-adapter.ts         # source fetch + mapping contract
-   -   L¦¦ source-adapter.types.ts
-   +¦¦ parsers/
-   -   +¦¦ deterministic-parser.ts
-   -   L¦¦ llm-enrichment-parser.ts
-   L¦¦ ingestion/
-       +¦¦ run-ingestion.ts
-       L¦¦ upsert-listings.ts
+¦¦ listings/
-   +¦¦ filters.ts
-   L¦¦ queries.ts
L¦¦ ...

supabase/
L¦¦ migrations/
    +¦¦ xxx_portal_sources.sql
    +¦¦ xxx_listings.sql
    +¦¦ xxx_listing_media.sql
    +¦¦ xxx_listing_raw_snapshots.sql
    L¦¦ xxx_ingestion_runs.sql

tests/
+¦¦ integrations/
+¦¦ parsers/
L¦¦ listings/
```

**Structure Decision**: Keep single Next.js monorepo layout and add a clearly separated
`source adapter -> parser -> normalized persistence -> listing query` pipeline.
Retain only portal-relevant API/UI modules.

## Phase Plan

### Phase 0 - Discovery & De-scope Inventory
- Inventory all current endpoints/pages/jobs.
- Tag each as `keep`, `rewrite`, or `remove` according to portal MVP scope.
- Produce migration-safe deprecation list.

### Phase 1 - Data Model & Ingestion Foundation
- Add Supabase schema for sources, listings, raw snapshots, parse metadata, ingestion runs.
- Implement Sreality adapter contract and deterministic parser.
- Add idempotent upsert flow with observability logs.

### Phase 2 - LLM Enrichment & Quality Controls
- Add optional LLM enrichment for ambiguous fields.
- Persist parse confidence/provenance.
- Add parser fallback behavior and error handling.

### Phase 3 - Portal Listing + Filtering UX
- Build Zillow-style listing page (card grid/list presentation).
- Implement filter API + UI controls (price, location, type, disposition, area).
- Add source attribution and deep-link to origin listing.

### Phase 4 - Cleanup & Hardening
- Remove/disable non-portal features.
- Update docs and runtime configuration.
- Run full regression for remaining modules.

## Initial Keep/Rewrite/Remove Proposal

- **Keep/Rewrite**: `app/api/market-listings`, `app/api/integrations`, `app/api/geocode`
  (if needed for location normalization), selected `dashboard` routes.
- **Likely Remove/Disable**: `app/api/mail`, large parts of `app/api/agent` that are not
  parser-related, workflow/reporting routes not tied to listing ingestion/portal UX.
- **Review Needed**: `app/api/storage`, `app/api/settings`, `app/api/cron` (keep only
  ingestion scheduling + maintenance relevant to listings).

## Complexity Tracking

No constitution violations identified at this stage.
