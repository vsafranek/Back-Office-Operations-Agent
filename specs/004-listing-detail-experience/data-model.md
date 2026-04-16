# Data Model: Listing Detail Experience

## 1) ListingDetailView (presentation aggregate)

**Purpose**: Unified view consumed by the detail page, combining listing core fields, media, transit snippets, metadata, and user actions.

### Core Fields
- `id` (uuid)
- `title` (string)
- `priceAmount` (number|null)
- `currency` (string)
- `locality` (string)
- `offerType` (string|null)
- `propertyType` (string|null)
- `disposition` (string|null)
- `isActive` (boolean)
- `sourceUrl` (url string)
- `latitude` / `longitude` (number|null)
- `description` (string|null)
- `facts` (area/floor/land and related optional values)
- `transit` (nearest metro and score subset, optional)
- `metadata` (object|null)
- `isSaved` (boolean, user-dependent)

### Validation Rules
- `id`, `title`, `locality`, `currency`, `sourceUrl` must be present.
- `latitude` and `longitude` must be both present for neighborhood preview.
- Numeric facts (area/floor) must be non-negative when present.

---

## 2) GalleryState

**Purpose**: Client-side state for hero carousel behavior.

### Fields
- `images` (array of image URLs in display order)
- `activeIndex` (integer, zero-based)
- `total` (derived from images length)
- `hasNext` / `hasPrev` (derived booleans)

### Rules
- `activeIndex` must always stay in range `[0, total-1]`.
- `total = 0` must render a dedicated media fallback state.
- `total = 1` disables carousel navigation controls.

---

## 3) AuthorizedContactView

**Purpose**: Normalized contact block shown as "kontakt na oprávněnou osobu".

### Fields
- `name` (string|null)
- `organization` (string|null)
- `phone` (string|null)
- `email` (string|null)
- `hasAnyContact` (derived boolean)

### Rules
- The section is always rendered.
- Missing fields show explicit fallback labels/messages.
- At least one populated field is sufficient for a "contact available" state.

---

## 4) NeighborhoodPreview

**Purpose**: Lightweight map context around listing location.

### Fields
- `centerLatitude` (number)
- `centerLongitude` (number)
- `markerTitle` (string)
- `isAvailable` (derived boolean from coordinate presence)

### Rules
- Render map only when both coordinates are valid.
- Render explanatory fallback when coordinates are missing.

---

## 5) DetailSectionState (layout-level state)

**Purpose**: Captures UI visibility/readiness of optional content sections.

### Fields
- `mediaState` (`ready` | `fallback`)
- `contactState` (`available` | `partial` | `missing`)
- `mapState` (`available` | `missing`)
- `metadataState` (`available` | `empty`)

### Rules
- Section state must be deterministically derived from data payload.
- No section should block rendering of primary listing content.

---

## Relationships Overview

- `ListingDetailView` 1:1 `GalleryState` (derived from detail images/preview URLs).
- `ListingDetailView` 1:1 `AuthorizedContactView` (derived from metadata normalization).
- `ListingDetailView` 1:1 `NeighborhoodPreview` (derived from coordinates).
- `DetailSectionState` derives from all previous view entities to drive fallbacks.

---

## State & Consistency Notes

- Detail page must remain functional for anonymous users and authenticated users.
- Saved status (`isSaved`) is orthogonal to media/contact/map availability.
- UI must avoid hard failures when optional fields are absent or malformed.
