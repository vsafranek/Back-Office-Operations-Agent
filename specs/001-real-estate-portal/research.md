# Research: Pivot Inventory (Keep / Rewrite / Remove)

## Goal

Transform current app into a Zillow-style real estate portal focused on multi-source
listing aggregation (MVP: Sreality), normalized storage in Supabase, and rich filtering.

## Route & Module Inventory

### Keep (core to new goal)

| Area | Path | Decision | Notes |
|---|---|---|---|
| Listings API | `app/api/market-listings` | Keep + Rewrite | Becomes canonical read API for list/filter/detail. |
| Integrations base | `app/api/integrations` | Keep + Rewrite | Keep for source adapter endpoints; de-scope OAuth parts unless needed. |
| Geocoding | `app/api/geocode/nominatim-suggest` | Keep (optional) | Useful for location normalization/filter UX. |
| Cron | `app/api/cron` | Keep + Rewrite | Keep only listing ingestion schedule + maintenance jobs. |
| Dashboard page | `app/dashboard/page.tsx` | Rewrite | Convert to Zillow-like listing view. |
| App root | `app/page.tsx` | Rewrite | Public portal landing / listing entry. |
| Data layer | `supabase/migrations/*` | Keep + Extend | New schema for sources/listings/snapshots/ingestion runs. |

### Rewrite / Evaluate

| Area | Path | Decision | Reason |
|---|---|---|---|
| Agent API | `app/api/agent*` | Rewrite (limited) | Keep only parser/enrichment capabilities relevant to listing extraction. |
| Settings APIs | `app/api/settings/*` | Evaluate | Keep only portal/integration/ingestion settings. |
| Data APIs | `app/api/data/*` | Evaluate | Keep if useful for filter presets; otherwise remove. |
| Storage APIs | `app/api/storage/*` | Evaluate | Keep only if needed for future media caching; not required for MVP. |

### Remove / Disable (outside new scope)

| Area | Path | Decision | Reason |
|---|---|---|---|
| Mail APIs | `app/api/mail/*` | Remove/Disable | Not required for listing portal MVP. |
| Google comms APIs | `app/api/google/*` | Remove/Disable | Calendar/Gmail flows not part of portal scope. |
| Weekly reporting | `app/api/workflows/weekly-report` + `workflows/weekly-exec-report.ts` | Remove/Disable | Legacy reporting use case. |
| Audit run endpoint | `app/api/audit/run` | Remove/Disable or shrink | Keep only if needed for ingestion observability. |
| Conversations API | `app/api/conversations` | Remove/Disable | Chat conversation UX not required for MVP portal. |

## Unknowns to Clarify Before Deletion

1. Do we keep user auth (`app/api/auth/*`) for internal/admin-only MVP, or make first release public read-only?
2. Do we need OAuth integrations for any near-term source other than Sreality?
3. Should listing images stay as source URLs only, or do we plan immediate caching in Supabase storage?

## Proposed Order of Execution

1. Freeze and flag non-portal routes (avoid immediate hard delete while pivot stabilizes).
2. Build ingestion + DB model + listing/filter APIs.
3. Switch UI to portal experience.
4. Remove disabled legacy modules after successful regression.

## Hard De-scope Execution (Portal-only Mode)

Implemented central blocking in `middleware.ts` when `PORTAL_MODE_ONLY=true`:
- Blocks legacy APIs: agent, mail, google, workflow reports, storage, cron, settings, conversations, data, audit, oauth integrations.
- Allows only portal APIs: `/api/market-listings/*` and `/api/integrations/sreality/ingest`.
- Redirects legacy pages (`/dashboard`, `/settings`, `/storage`) to `/`.

This enables safe runtime de-scope immediately before physically deleting legacy code paths.

### Wave 1 Physical Removal Completed
- Deleted route trees: `app/api/google/*`, `app/api/mail/*`, `app/api/workflows/*`
- Deleted workflow module: `workflows/weekly-exec-report.ts`
- Kept runtime safety: `middleware.ts` still blocks other non-portal endpoints/pages in portal-only mode.

### Wave 2 Physical Removal Completed (2026-04-13)

Hard cleanup executed beyond runtime blocking:
- Deleted API trees: `app/api/agent/*`, `app/api/audit/*`, `app/api/conversations/*`.
- Deleted additional non-portal APIs: `app/api/settings/*`, `app/api/storage/*`, `app/api/cron/*`, `app/api/data/*`, `app/api/geocode/*`, OAuth callbacks under `app/api/integrations/oauth/*`, and auth sync endpoints under `app/api/auth/*`.
- Deleted UI trees: `app/dashboard/*`, `app/settings/*`, `app/storage/*`, `components/agent/*`, `components/storage/*`.
- Deleted backend legacy modules: `lib/agent/*`, `lib/scheduled-tasks/*`, `lib/data/*`, `lib/settings/*`, and related auth/integration helpers tied to email/calendar/reporting flows.
- Simplified `app/api/market-listings/route.ts` to canonical portal GET flow; legacy agent POST flow now returns `410 Gone`.
- Updated auth redirects from `/dashboard` to `/` and simplified top navigation to portal listings only.

Validation after Wave 2:
- `npm run typecheck` [OK]
- `npx vitest run tests/parsers/sreality-deterministic.test.ts tests/integrations/sreality-ingestion.test.ts tests/listings-filters.test.ts tests/market-listings-detail-route.test.ts tests/market-listings-route.test.ts` [OK]


### Wave 3 DB Cleanup + Task Closure (2026-04-13)

Database and task finalization:
- Added `033_portal_only_cleanup_drop_legacy.sql` to physically remove legacy back-office tables, views, and SQL functions.
- Added `034_listings_filter_performance_indexes.sql` for portal filter-query performance.
- Added `035_listing_parse_results_provenance.sql` for parser provenance/enrichment traceability.
- Extracted filter controls to `components/listings/filters/ListingFiltersPanel.tsx`.
- Added page rendering test `tests/listings/list-page.test.tsx`.
- Added optional LLM enrichment parser `lib/integrations/parsers/llm-enrichment-parser.ts` with low-confidence fallback tests.
- Marked all tasks in `specs/001-real-estate-portal/tasks.md` as completed.
