# System Overview (Portal-only)

## Cíl
Zillow-style realitní portal agregující více zdrojů do jedné kanonické databáze.
Aktuálně je aktivní zdroj **Sreality**.

## Hlavní vrstvy

1. **Source adapters** (`lib/integrations/sources/*`)
   - sjednocené načítání dat z externích portálů.
   - aktuálně: `sreality-adapter.ts`.

2. **Parsers** (`lib/integrations/parsers/*`)
   - deterministic parser pro stabilní mapping.
   - optional LLM enrichment parser s confidence a fallback.

3. **Ingestion orchestration** (`lib/integrations/ingestion/*`)
   - běh ingestu (`run-ingestion.ts`), run logy, upsert canonical dat.

4. **Persistence (Supabase)**
   - `portal_sources`, `listing_ingestion_runs`, `listings`, `listing_media`, `listing_raw_snapshots`, `listing_parse_results`, `listing_click_events`.

5. **Portal API + UI**
   - API: `app/api/market-listings/*`, `app/api/integrations/sreality/ingest`.
   - UI: `app/page.tsx`, `components/listings/*`, detail `app/listing/[id]/page.tsx`.

## Scope boundaries
- Mimo scope: email, calendar, CRM, workflow orchestrace, konverzační agent.
- Legacy back-office DB objekty se odstraňují migrací `033_portal_only_cleanup_drop_legacy.sql`.

## Runtime
- Next.js App Router
- Supabase auth + DB
- Mantine UI
