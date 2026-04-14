# Data Model: Metro and Transit Proximity Filters

## 1) TransitStop

**Purpose**: Canonical registry of transport stops used for map overlay and distance calculations.

### Core Fields
- `id` (uuid, PK)
- `provider_stop_id` (text, unique per provider)
- `name` (text)
- `mode` (enum: `metro`, `tram`, `bus`, `train`)
- `metro_line` (text, nullable; e.g. `A`, `B`, `C`)
- `lat` (numeric)
- `lng` (numeric)
- `is_active` (boolean)
- `metadata` (jsonb, optional provider extras)
- `updated_at` (timestamptz)

### Validation Rules
- `lat` must be in `[-90, 90]`
- `lng` must be in `[-180, 180]`
- `name` must be non-empty
- `metro_line` required when `mode = metro`

### Indexing
- `(mode, is_active)`
- `(metro_line, is_active)` partial for metro stops
- `(is_active, lat, lng)` for viewport queries

---

## 2) ListingTransitProfile

**Purpose**: Precomputed transit accessibility profile bound to one listing.

### Core Fields
- `listing_id` (uuid, PK/FK -> listings.id)
- `nearest_metro_stop_id` (uuid, FK -> transit_stops.id, nullable)
- `nearest_metro_distance_m` (integer, nullable)
- `nearest_metro_walk_min` (integer, nullable)
- `nearest_tram_distance_m` (integer, nullable)
- `nearest_bus_distance_m` (integer, nullable)
- `nearest_train_distance_m` (integer, nullable)
- `transit_score` (integer, 0-100)
- `score_band` (enum: `low`, `medium`, `high`)
- `computed_at` (timestamptz)
- `computation_version` (text)

### Validation Rules
- Distance fields must be `>= 0` when present
- `nearest_metro_walk_min` must be `>= 0` when present
- `transit_score` must be between `0` and `100`
- `score_band` must match score ranges

### Lifecycle Rules
- Recomputed when listing coordinates change.
- Recomputed when transit stop dataset changes.
- Listing without coordinates keeps nullable distance fields and low/default score.

### Indexing
- `(nearest_metro_distance_m)` partial where not null
- `(nearest_metro_walk_min)` partial where not null
- `(transit_score desc)`
- `(nearest_metro_stop_id)`

---

## 3) TransitFilterCriteria (request entity)

**Purpose**: User-selected filter input applied to listing queries.

### Fields
- `nearMetro` (boolean)
- `maxMetroDistanceM` (integer, nullable)
- `maxMetroWalkMin` (integer, nullable)
- `metroLines` (string[], nullable)
- `metroStopIds` (uuid[], nullable)
- `transitModes` (enum[], optional values: `metro`, `tram`, `bus`, `train`)
- `matchMode` (enum: `any`, `all`; MVP default `any`)
- `minTransitScore` (integer, nullable)

### Validation
- At least one transit condition must be set when transit filter is enabled.
- `maxMetroDistanceM` bounded to sensible range (e.g. 100-5000 m).
- `maxMetroWalkMin` bounded to sensible range (e.g. 1-60 min).
- `minTransitScore` within `0-100`.
- `metroStopIds` must reference active stops.

---

## 4) TransitCoverageZone (view/model entity)

**Purpose**: Map layer representation of active coverage ranges around stops.

### Fields
- `stop_id` (uuid)
- `mode` (`metro` default for v1 core)
- `radius_m` (integer)
- `center_lat` (numeric)
- `center_lng` (numeric)
- `label` (text)

### Rules
- Generated from stop dataset + active distance/time filter.
- Only visible stops in current viewport are returned/rendered.

---

## Relationships Overview

- `TransitStop` 1:N `ListingTransitProfile` via nearest stop references.
- `Listing` 1:1 `ListingTransitProfile`.
- `TransitFilterCriteria` filters `Listing` through `ListingTransitProfile`.
- `TransitCoverageZone` derived from `TransitStop` + active filters (not persisted as primary table in MVP).

---

## State & Consistency Notes

- Listing records without coordinates remain visible in catalog unless transit filter requires geospatial match.
- Transit filters must never leak inactive/deprecated stops in public API.
- Score computation versioning allows safe backfill and future tuning without breaking historical observability.
