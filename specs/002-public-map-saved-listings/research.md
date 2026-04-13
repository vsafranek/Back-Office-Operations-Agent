# Research: Public Browsing, Saved Listings & Map-List Discovery

## Decision 1: Anonymous users can read listing catalog and detail endpoints
- **Decision**: Keep listing read API public (anonymous) with strict field allowlist.
- **Rationale**: Requirement prioritizes frictionless browsing and acquisition.
- **Alternatives considered**:
  - Require login for all listing reads: rejected (conflicts with product requirement).
  - Hybrid teaser-only anonymous data: rejected for MVP due to complexity and lower utility.

## Decision 2: Saved listings require authenticated user with row-level isolation
- **Decision**: Use dedicated `saved_listings` table keyed by `(user_id, listing_id)` with RLS per `auth.uid()`.
- **Rationale**: Clean ownership model, simple idempotency, strong privacy boundary.
- **Alternatives considered**:
  - JSON array in profile table: rejected (weak query ergonomics, harder indexing).
  - Client-only localStorage favorites: rejected (not cross-device, not durable).

## Decision 3: Full Sreality apartment scrape exposed via protected trigger endpoint
- **Decision**: Reuse existing ingest route namespace and add operator-protected full-run mode for apartment category.
- **Rationale**: Aligns with existing ingestion architecture and audit logging.
- **Alternatives considered**:
  - Cron-only scraping with no trigger endpoint: rejected (requirement explicitly asks for endpoint trigger).
  - Public endpoint with shared secret query param: rejected (security risk, poor auditability).

## Decision 4: Map/list synchronization based on bbox bounds
- **Decision**: Accept map viewport as bbox (`north`, `south`, `east`, `west`) and apply server-side filtering.
- **Rationale**: Simple contract, fast indexable predicates, enough for MVP UX.
- **Alternatives considered**:
  - Polygon query: rejected for MVP complexity.
  - Client-side filtering from full dataset: rejected (performance + stale data risk).

## Decision 5: Marker representation and list synchronization behavior
- **Decision**: Marker label displays formatted price; selecting marker highlights card and vice versa.
- **Rationale**: Mirrors Zillow mental model and supports quick scan.
- **Alternatives considered**:
  - Generic pin without price: rejected (weaker value density on map).
  - Independent map and list selections: rejected (breaks expected UX coherence).

## Decision 6: Mobile behavior for split view
- **Decision**: Desktop/tablet use true split panes; mobile uses explicit toggle between map and list with same query state.
- **Rationale**: Preserves usability on small screens without duplicating query logic.
- **Alternatives considered**:
  - Force split view on all sizes: rejected (poor mobile UX).
  - Remove map on mobile: rejected (inconsistent experience).

## Decision 7: Ingestion run resiliency and observability
- **Decision**: Every run records `ingestion_run` with counters, status, error summary, started/finished timestamps.
- **Rationale**: Required for operator confidence, retries, and diagnostics.
- **Alternatives considered**:
  - Logging only in app logs: rejected (weak historical observability).
  - Per-page persistent retry queue in MVP: deferred (can be phase 2 hardening).

## Decision 8: Performance strategy for map/list queries
- **Decision**: Add composite indexes for active listings + coordinates + price; enforce pagination.
- **Rationale**: Keeps p95 response targets realistic as data volume grows.
- **Alternatives considered**:
  - No index tuning initially: rejected (high risk of slow map interactions).
  - Full geospatial stack migration in MVP: deferred (cost > immediate need).

## Implementation Validation (2026-04-13)
- Automated tests: cmd /c npm run test -> PASS (20/20).
- Type safety: cmd /c npm run typecheck -> PASS.
- Production build: cmd /c npm run build -> PASS.

