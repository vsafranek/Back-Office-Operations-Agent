# Reality Portal (Zillow-style) - Portal-only scope

Aplikace je nyní čistě realitní portál zaměřený na agregaci inzerátů do jedné databáze.
MVP zdroj je **Sreality**.

## Co aplikace dělá
- Pullne listing data ze Sreality přes adapter vrstvu.
- Deterministicky naparsuje data do kanonického modelu.
- Uloží listingy + média + raw snapshoty + parse výsledky do Supabase.
- Zobrazí katalog a detail inzerátů se Zillow-like filtrováním.
- Trackuje kliky na detail i originální inzerát.

## Co bylo odstraněno
- Agent/chat orchestrace.
- Email/kalendář workflow.
- Dashboard back-office, portfolio zákazníků, storage/browser presets.
- Legacy API route stromy mimo realitní scope.

## Quick start
1. `cp .env.example .env.local`
2. Nastav Supabase proměnné (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
3. `npm install`
4. `npm run dev`

## Klíčové endpointy
- `GET /api/market-listings` – katalog + filtry.
- `GET /api/market-listings/:id` – detail inzerátu.
- `POST /api/market-listings/click` – tracking kliknutí.
- `POST /api/integrations/sreality/ingest` – ruční spuštění ingestu.

## Databáze (Supabase)
Použité migrace pro portal model:
- `031_real_estate_portal_ingestion_foundation.sql`
- `032_listing_click_events.sql`
- `033_portal_only_cleanup_drop_legacy.sql`
- `034_listings_filter_performance_indexes.sql`
- `035_listing_parse_results_provenance.sql`

## Test/validace
- `npm run typecheck`
- `npx vitest run tests/parsers/sreality-deterministic.test.ts tests/parsers/llm-enrichment-parser.test.ts tests/integrations/sreality-ingestion.test.ts tests/listings-filters.test.ts tests/market-listings-detail-route.test.ts tests/market-listings-route.test.ts tests/listings/list-page.test.tsx`
