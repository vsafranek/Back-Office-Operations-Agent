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
- Přidává dopravní filtry (u metra, vzdálenost/minuty, linky, stanice, transit score).
- Umožňuje mapovou vrstvu zastávek MHD + orientační coverage zóny.
- Trackuje kliky na detail i originální inzerát.

## Quick start
1. `cp .env.example .env.local`
2. Nastav Supabase proměnné (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
3. Volitelně nastav operator ingest key: `OPERATOR_INGEST_KEY`.
5. `npm install`
6. `npm run dev`

## Klíčové endpointy
- `GET /api/market-listings` - veřejný katalog + filtry + bbox mapy.
- `GET /api/transit/stops` - veřejné zastávky MHD pro mapový overlay.
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
- `039_transit_stops.sql`
- `040_listing_transit_profile.sql`
- `041_transit_filter_indexes.sql`

## Test/validace
- `npm run typecheck`
- `npm run test`

## Transit filtry - příklady dotazů
- `GET /api/market-listings?nearMetro=true&maxMetroDistanceM=600`
- `GET /api/market-listings?maxMetroWalkMin=10&minTransitScore=70`
- `GET /api/market-listings?metroLines=A,C&transitModes=metro,tram&transitMatchMode=any`
- `GET /api/transit/stops?north=50.2&south=49.9&east=14.8&west=14.2&mode=metro,tram`

## Operacni monitoring
- /admin/ingestion - operator prehled ingest runu (nacita pres /api/integrations/sreality/ingest/runs).



