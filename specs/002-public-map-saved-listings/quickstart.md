# Quickstart: Public Browsing, Saved Listings & Map-List Discovery

## Prerequisites
- Running app with configured Supabase connection.
- Existing listing ingestion baseline enabled.
- Test user account for authenticated scenarios.
- Operator credential or key for ingest trigger endpoint.

## Scenario A - Anonymous browsing works without login
1. Open `/` in fresh incognito session.
2. Confirm listing cards render (price, locality, disposition, area, image).
3. Open one listing detail `/listing/{id}`.
4. Confirm source link opens original Sreality page.

**Expected**: No authentication prompt for reading listings.

## Scenario B - Trigger full apartment scrape endpoint
1. Send POST request to `/api/integrations/sreality/ingest` with operator credentials.
2. Capture returned `runId`.
3. Verify ingestion run status and counters are persisted.
4. Re-trigger endpoint to verify idempotent upsert behavior (no duplicate listings).

Example request body:
```json
{
  "mode": "apartments_full",
  "dryRun": false
}
```

**Expected**: Run accepted, counters updated, duplicate-safe updates on repeated run.

## Scenario C - Save/unsave listing for authenticated user
1. Login as standard user.
2. In catalog, click save icon on listing card.
3. Call or open saved listings UI (`/api/saved-listings` backing data).
4. Verify listing appears in saved collection.
5. Remove saved listing.
6. Verify item is removed.

**Expected**: Save/unsave succeeds only when authenticated; data is user-isolated.

## Scenario D - Map/list synchronization
1. Open catalog split view.
2. Pan map to a different city district.
3. Verify list refreshes to only in-bounds listings.
4. Click marker with price -> corresponding list card highlights.
5. Click list card -> corresponding marker highlights.

**Expected**: Bidirectional sync, no stale out-of-bounds items, update p95 under 2s.

## Scenario E - Edge behavior
1. Move map to area with zero listings.
2. Verify empty-state messaging in list panel and no app error.
3. Save listing that later becomes inactive (simulate by deactivating listing).
4. Verify saved section marks listing as unavailable but keeps unsave action.

**Expected**: Graceful empty and inactive-item behavior.

## Validation Log (2026-04-13)
- [x] cmd /c npm run test passed (20 tests).
- [x] cmd /c npm run typecheck passed.
- [x] cmd /c npm run build passed.

