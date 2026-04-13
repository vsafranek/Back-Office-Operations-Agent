# Feature Specification: Real Estate Portal MVP (Sreality Wrapper)

**Feature Branch**: `001-real-estate-portal`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "Chci z aplikace udìlat realitní portal... wrapper pro vícero realitních portálù, MVP na Sreality, detailní filtrování, Zillow-like design, LLM parsing."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import listings from Sreality into normalized DB (Priority: P1)

As an internal operator, I need a reliable ingestion pipeline that pulls Sreality listings,
parses as many fields as possible, and stores normalized records in Supabase including
source URL and raw payload.

**Why this priority**: Without ingestion + normalized storage there is no data foundation
for any portal experience.

**Independent Test**: Trigger one ingestion run and verify inserted/updated rows in
Supabase include core fields, source URL, and raw payload snapshots.

**Acceptance Scenarios**:

1. **Given** valid Sreality source access, **When** ingestion job is executed,
   **Then** listings are upserted into normalized tables with stable external IDs.
2. **Given** a listing description with non-trivial text attributes,
   **When** parsing pipeline runs, **Then** deterministic parser and optional LLM
   enrichment populate structured fields and confidence metadata.
3. **Given** a listing already present in DB, **When** the next ingestion run executes,
   **Then** the record is updated idempotently instead of duplicated.

---

### User Story 2 - Browse Zillow-like listing catalog from Supabase data (Priority: P2)

As a portal visitor, I need to browse real estate cards with photos, key attributes,
price, and location in a modern Zillow-inspired visual style.

**Why this priority**: Browsing experience is the first visible user value once data exists.

**Independent Test**: Open listing page and confirm cards render from DB data with
consistent layout and source link to original Sreality listing.

**Acceptance Scenarios**:

1. **Given** listings are in DB, **When** user opens listing page,
   **Then** the app shows paginated cards with image, title, price, locality,
   property type, disposition, floor area, and source badge.
2. **Given** a listing card, **When** user opens detail or source action,
   **Then** user can navigate to the original Sreality URL.

---

### User Story 3 - Apply detailed filtering over normalized listing data (Priority: P3)

As a portal visitor, I need detailed filtering so I can quickly narrow down relevant
properties without leaving the portal.

**Why this priority**: Filtering is the core utility feature expected from a property portal.

**Independent Test**: Apply combined filters and verify returned result set matches DB
constraints and updates within acceptable response time.

**Acceptance Scenarios**:

1. **Given** listing catalog is loaded, **When** user sets filters (price range, location,
   offer type, property type, disposition, floor area),
   **Then** only matching listings are returned.
2. **Given** multiple filters are active, **When** user changes one filter,
   **Then** results update correctly and preserve remaining active filters.

---

### User Story 4 - De-scope legacy non-portal functionality (Priority: P3)

As a product owner, I need unrelated legacy workflows removed or disabled so the codebase
is focused on real estate portal goals and easier to maintain.

**Why this priority**: Reduces complexity, risk, and maintenance overhead for the pivot.

**Independent Test**: Run test/build after de-scope and confirm only portal-relevant
endpoints/workflows remain active.

**Acceptance Scenarios**:

1. **Given** legacy endpoints not needed for portal scope,
   **When** cleanup phase is completed,
   **Then** they are removed or feature-flagged off with no runtime errors.
2. **Given** updated docs, **When** developer onboards,
   **Then** quick start and architecture describe only portal-focused flows.

---

### Edge Cases

- What happens when Sreality API/HTML structure changes and deterministic parser fails?
- How does pipeline handle duplicate listings across repeated runs?
- How does pipeline handle missing price, locality, or area fields?
- What if LLM parser returns low-confidence or malformed structured output?
- How do filters behave when field values are null/unknown?
- What is shown when source URL is unavailable or invalid?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST ingest listings from Sreality on demand and via scheduled runs.
- **FR-002**: System MUST store each listing with stable external identifier,
  source portal ID (`sreality`), and original listing URL.
- **FR-003**: System MUST persist raw source payload for each listing version to support
  reprocessing and parser audits.
- **FR-004**: System MUST normalize core attributes (price, currency, locality,
  coordinates when available, property type, offer type, disposition, area, floor,
  photos, publication metadata).
- **FR-005**: System MUST support deterministic parsing first and optional LLM enrichment
  second for ambiguous textual attributes.
- **FR-006**: System MUST store parser provenance metadata (source parser, confidence,
  timestamp, and fallback path used).
- **FR-007**: System MUST upsert idempotently to avoid duplicates on repeated ingestion.
- **FR-008**: System MUST expose listing read APIs for portal UI with pagination and sorting.
- **FR-009**: System MUST provide detailed filtering at minimum by price range,
  location, offer type, property type, disposition, and floor area range.
- **FR-010**: System MUST render listing catalog in a Zillow-inspired design direction
  (clean card layout, large imagery, prominent price/location hierarchy).
- **FR-011**: System MUST provide clear navigation from each internal listing to
  the original source URL.
- **FR-012**: System MUST remove or disable features unrelated to the portal MVP scope.
- **FR-013**: System MUST log ingestion/parsing errors with enough context for retry and
  debugging.
- **FR-014**: System MUST make it possible to add additional portal adapters
  (e.g., future sources) without breaking existing Sreality adapter.

### Key Entities *(include if feature involves data)*

- **PortalSource**: Defines external source metadata (source key, adapter version,
  rate limits, active flag).
- **Listing**: Canonical normalized listing record shown in UI (title, type, offer,
  price, location, key dimensions, source ID, source URL, status).
- **ListingMedia**: Ordered media for listing (image URL, type, quality metadata).
- **ListingRawSnapshot**: Raw source payload/versioned capture for audit and reparse.
- **ListingParseResult**: Parsed/enriched attributes with parser method,
  confidence, and parse diagnostics.
- **IngestionRun**: One pipeline execution instance with counts, timing,
  and failure diagnostics.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of fetched Sreality listings are successfully persisted
  (inserted or updated) per ingestion run.
- **SC-002**: At least 90% of active listings contain complete core fields:
  price, locality, offer type, property type, and source URL.
- **SC-003**: Listing filter API returns p95 response time <= 800 ms for standard
  filter combinations on MVP dataset size.
- **SC-004**: 100% of displayed listings include clickable source attribution and
  navigation to original Sreality detail when source URL is available.
- **SC-005**: Legacy non-portal endpoints/workflows identified for de-scope are either
  removed or explicitly disabled before MVP release.

## Assumptions

- Sreality access method used by the adapter is legally and technically permitted.
- Supabase remains the primary storage and query layer for listing data.
- Zillow-like design means visual style inspiration, not brand-copying assets or trademarks.
- First release covers read-only listing portal behavior (no broker/admin write UI required).
- Multi-source architecture is introduced now, but only Sreality adapter is implemented in MVP.
