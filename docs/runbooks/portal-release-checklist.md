# Portal-only release checklist

## 1) Pre-deploy
- Verify env vars in target environment:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `PORTAL_MODE_ONLY=true`
  - `NEXT_PUBLIC_PORTAL_MODE_ONLY=true`
- Run locally:
  - `npm run typecheck`
  - `npx vitest run tests/parsers/sreality-deterministic.test.ts tests/parsers/llm-enrichment-parser.test.ts tests/integrations/sreality-ingestion.test.ts tests/listings-filters.test.ts tests/market-listings-detail-route.test.ts tests/market-listings-route.test.ts tests/listings/list-page.test.tsx`

## 2) Database migration order
Apply in this order:
1. `031_real_estate_portal_ingestion_foundation.sql`
2. `032_listing_click_events.sql`
3. `033_portal_only_cleanup_drop_legacy.sql`
4. `034_listings_filter_performance_indexes.sql`
5. `035_listing_parse_results_provenance.sql`

> Note: `033` is destructive for legacy back-office schema objects. Run a DB backup/snapshot before applying in production.

## 3) Post-migration SQL smoke checks
- Core tables exist:
  - `portal_sources`, `listing_ingestion_runs`, `listings`, `listing_media`, `listing_raw_snapshots`, `listing_parse_results`, `listing_click_events`
- Legacy tables are removed (for example):
  - `conversations`, `agent_runs`, `workflow_runs`, `user_integration_settings`, `properties`
- `portal_sources` contains row for `sreality`.

## 4) API smoke tests
- `POST /api/integrations/sreality/ingest` returns run summary.
- `GET /api/market-listings` returns paginated payload.
- `GET /api/market-listings/:id` returns detail for existing listing.
- `POST /api/market-listings/click` inserts click event.

## 5) UI smoke tests
- Home page renders listing cards and filter panel.
- Filters change result set and pagination works.
- Detail opens and source link points to original listing.

## 6) Rollback strategy
- App rollback: redeploy previous app version.
- DB rollback for `033` requires restore from backup/snapshot (dropped objects are not recreated automatically).
- Keep a tested restore procedure before production migration window.
