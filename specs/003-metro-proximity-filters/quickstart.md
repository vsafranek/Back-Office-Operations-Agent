# Quickstart: Metro and Transit Proximity Filters

## Prerequisites
- Running app with connected Supabase project.
- Listings with valid coordinates present in catalog.
- Transit stop seed/import available for Praha scope (metro + selected MHD modes).
- Existing map+list catalog page enabled.

## Scenario A - Basic "Near metro" flow
1. Open catalog home page.
2. Enable toggle "u metra".
3. Keep default distance (e.g. 600 m).
4. Observe updated list + map markers.

**Expected**: Only listings meeting metro proximity condition remain visible.

## Scenario B - Distance and walking time filtering
1. Enable "u metra".
2. Set max distance to 300 m.
3. Switch to walking-time mode and set max 8 minutes.
4. Compare result counts between distance and time modes.

**Expected**: Both filters work and produce consistent constrained sets.

## Scenario C - Metro lines and stations
1. Select metro lines `A` and `C`.
2. Select one or more specific stations.
3. Apply filters.

**Expected**: Results align with selected lines/stations; map shows relevant stop overlays.

## Scenario D - Combined transit modes
1. Enable combined transit filtering.
2. Select `metro` and `tram`.
3. Keep match mode `any`.
4. Apply filters and inspect count.

**Expected**: Listings pass if they satisfy metro OR tram condition.

## Scenario E - Transit score and badges
1. Set minimum transit score (e.g. 70).
2. Inspect listing cards and detail.
3. Confirm score badge and nearest metro info are visible.

**Expected**: All returned listings meet score threshold and expose understandable score info.

## Scenario F - Map overlay and coverage zones
1. Enable transit map layer.
2. Verify metro stop markers appear.
3. Activate distance filter and inspect coverage circles.
4. Pan map and verify overlays update with viewport.

**Expected**: Overlay remains synchronized with active filters and viewport bounds.

## Scenario G - Edge behavior
1. Move map to area with no stops/listings in active filters.
2. Test listing missing coordinates (if present in fixture).
3. Apply strict transit filters.

**Expected**: Empty-state text is clear, app remains responsive, no runtime errors.

## Validation Log (2026-04-13)
- [x] `npm run typecheck` passed.
- [x] `npm test -- tests/contract/portal-transit-filters.contract.test.ts tests/integrations/transit-stops-route.test.ts tests/integrations/market-listings-transit-filters.test.ts tests/listings/transit-filter-map-sync.test.tsx tests/listings/split-view-sync.test.ts tests/market-listings-route.test.ts` passed.
