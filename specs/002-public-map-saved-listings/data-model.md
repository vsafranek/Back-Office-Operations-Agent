# Data Model: Public Browsing, Saved Listings & Map-List Discovery

## 1) Listing (existing canonical entity, extended usage)

**Purpose**: Publicly browsable apartment listing used by catalog, detail, and map marker rendering.

### Core Fields
- `id` (uuid, PK)
- `source_portal` (text, expected `sreality` in MVP)
- `source_external_id` (text, unique per source)
- `source_url` (text, nullable only if source missing)
- `title` (text)
- `price_amount` (numeric)
- `price_currency` (text, default `CZK`)
- `locality` (text)
- `latitude` (numeric, nullable)
- `longitude` (numeric, nullable)
- `property_type` (text, expected `apartment` in MVP ingest)
- `offer_type` (text: sale/rent)
- `disposition` (text, nullable)
- `area_m2` (numeric, nullable)
- `is_active` (boolean)
- `published_at` (timestamptz, nullable)
- `updated_at` (timestamptz)

### Validation Rules
- `price_amount >= 0`
- `latitude` in `[-90, 90]`, `longitude` in `[-180, 180]`
- `property_type` must be populated for displayed records
- Public queries return only `is_active = true`

### Indexing
- `(is_active, property_type, updated_at desc)`
- `(is_active, latitude, longitude)` for bbox filtering
- `(is_active, price_amount)` for slider/range filters

---

## 2) ListingSnapshot

**Purpose**: Immutable raw payload capture for each ingest cycle.

### Fields
- `id` (uuid, PK)
- `listing_id` (uuid, FK -> listing.id)
- `source_payload` (jsonb)
- `adapter_version` (text)
- `captured_at` (timestamptz)
- `ingestion_run_id` (uuid, FK -> ingestion_run.id)

### Rules
- Snapshot is append-only.
- Payload must be present (`jsonb` not null).

---

## 3) IngestionRun

**Purpose**: End-to-end audit and status summary of one scrape execution.

### Fields
- `id` (uuid, PK)
- `source_portal` (text, `sreality`)
- `scope` (text, `apartments`)
- `trigger_type` (text: manual_endpoint / scheduled)
- `triggered_by_user_id` (uuid, nullable)
- `status` (text: running/succeeded/partial_failed/failed)
- `processed_count` (int)
- `inserted_count` (int)
- `updated_count` (int)
- `failed_count` (int)
- `error_summary` (jsonb, nullable)
- `started_at` (timestamptz)
- `finished_at` (timestamptz, nullable)

### Rules
- `status` transition: `running -> succeeded|partial_failed|failed`
- `finished_at` required when status terminal

---

## 4) SavedListing (new)

**Purpose**: User-specific favorite listings for fast revisit.

### Fields
- `id` (uuid, PK)
- `user_id` (uuid, FK -> auth.users.id)
- `listing_id` (uuid, FK -> listing.id)
- `created_at` (timestamptz)

### Constraints
- Unique composite key `(user_id, listing_id)`
- ON DELETE CASCADE for user deletion
- ON DELETE RESTRICT for listing deletion (or soft-delete listing in lifecycle)

### RLS Policies
- `SELECT`: allow only rows where `user_id = auth.uid()`
- `INSERT`: allow only if `user_id = auth.uid()`
- `DELETE`: allow only rows where `user_id = auth.uid()`

---

## 5) MapViewportQuery (request-level entity)

**Purpose**: Ephemeral query state for map/list synchronization.

### Fields
- `north` (number)
- `south` (number)
- `east` (number)
- `west` (number)
- `zoom` (number, optional)
- `price_min` / `price_max` (number, optional)
- `offer_type`, `disposition`, `area_min`, `area_max` (optional)
- `page`, `limit` (pagination)

### Validation
- `north > south`
- `east != west`
- bounds within valid lat/lng ranges
- `limit <= 100`

---

## Relationships Overview

- Listing 1:N ListingSnapshot
- IngestionRun 1:N ListingSnapshot
- User 1:N SavedListing
- Listing 1:N SavedListing

---

## State & Lifecycle Notes

- Listings are ingested/upserted repeatedly; inactive listings remain historically but excluded from default public reads.
- Saved listing may reference listing that later becomes inactive; UI should show archived state and allow unsave.
- Ingestion run must always close terminal status even for partial failures.
