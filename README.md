# Reality Portal (Zillow-style) - Portal-only scope

Aplikace je realitní portál zaměřený na agregaci nabídek do jedné databáze.
MVP zdroj je **Sreality** (scope: **byty**).

## Co aplikace dělá
- Pullne listing data ze Sreality přes adapter vrstvu.
- Deterministicky naparsuje data do kanonického modelu.
- Uloží listingy + média + raw snapshoty + parse výsledky do Supabase.
- Nabídne veřejný katalog + detail bez přihlášení.
- Umožní přihlášeným uživatelům ukládání oblíbených nabídek.
- Nabídne Zillow-like split view (mapa + synchronizovaný seznam podle viewportu).
- Trackuje kliky na detail i originální inzerát.

## Quick start
1. `cp .env.example .env.local`
2. Nastav Supabase proměnné (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
3. Volitelně nastav operator ingest key: `OPERATOR_INGEST_KEY`.
4. `npm install`
5. `npm run dev`

## Klíčové endpointy
- `GET /api/market-listings` - veřejný katalog + filtry + bbox mapy.
- `GET /api/market-listings/:id` - veřejný detail inzerátu.
- `GET /api/saved-listings` - seznam uložených nabídek přihlášeného uživatele.
- `POST /api/saved-listings` - uložit nabídku (`{ listingId }`).
- `DELETE /api/saved-listings/:listingId` - odebrat nabídku z oblíbených.
- `POST /api/market-listings/click` - tracking kliknutí.
- `POST /api/integrations/sreality/ingest` - chráněné spuštění full ingestu bytů.

## Databáze (Supabase)
Použité migrace pro portal model:
- `031_real_estate_portal_ingestion_foundation.sql`
- `032_listing_click_events.sql`
- `033_portal_only_cleanup_drop_legacy.sql`
- `034_listings_filter_performance_indexes.sql`
- `035_listing_parse_results_provenance.sql`
- `036_saved_listings.sql`
- `037_public_listing_read_policies.sql`
- `038_map_bounds_indexes.sql`

## Test/validace
- `npm run typecheck`
- `npm run test`

## Operacni monitoring
- /admin/ingestion - operator prehled ingest runu (nacita pres /api/integrations/sreality/ingest/runs).


