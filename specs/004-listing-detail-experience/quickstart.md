# Quickstart: Listing Detail Experience

## Prerequisites
- Running app with accessible listing detail routes (`/listing/{id}`).
- Listings dataset containing at least:
  - one listing with multiple images,
  - one listing with missing images,
  - one listing with coordinates,
  - one listing with partial or missing contact metadata.
- `NEXT_PUBLIC_MAPY_API_KEY` configured for neighborhood preview.

## Scenario A - Hero carousel with multiple images
1. Open a listing that has at least 3 images.
2. Verify large hero image appears at top.
3. Click next/previous controls.
4. Select an image from thumbnail strip.

**Expected**: Active hero image changes immediately; current position indicator reflects selected image.

## Scenario B - Single-image and no-image fallback
1. Open listing with exactly one image.
2. Open listing with no images.

**Expected**:
- Single-image listing shows hero image without unnecessary carousel navigation.
- No-image listing shows explicit media fallback state (not blank area).

## Scenario C - Complete detail information layout
1. Open a listing with rich data (facts, transit, location).
2. Confirm section order and readability on desktop.

**Expected**: Media first, then core info, then supporting sections (transit/map/contact/metadata) with no missing visual hierarchy.

## Scenario D - Neighborhood map preview
1. Open listing with valid coordinates.
2. Open listing without coordinates.

**Expected**:
- With coordinates: mini neighborhood map renders with marker.
- Without coordinates: clear message explains map preview is unavailable.

## Scenario E - Contact on responsible person
1. Open listing with at least one contact field in metadata.
2. Open listing with no contact fields.

**Expected**:
- Contact section shows available values and indicates missing ones gracefully.
- When empty, section shows guidance fallback (including original source action).

## Scenario F - Existing actions preserved
1. Use "Zpět na výpis".
2. Use "Otevřít originál".
3. For authenticated user, toggle saved listing state.

**Expected**: Existing navigation, source link, and save behavior remain unchanged.

## Scenario G - Mobile responsiveness
1. Open listing detail on narrow viewport.
2. Scroll through all sections.

**Expected**: Content remains readable, interactive controls are usable, and no section overflow breaks layout.

## Validation Commands
- `npm run typecheck`
- `npm test -- tests/market-listings-detail-route.test.ts`

## Validation Log (2026-04-13)
- [x] `npm run typecheck` passed.
- [x] `npm test -- tests/market-listings-detail-route.test.ts tests/listings/listing-detail-overview.test.ts tests/listings/listing-detail-carousel.test.ts tests/listings/listing-detail-neighborhood.test.ts tests/listings/listing-detail-contact.test.ts` passed.
