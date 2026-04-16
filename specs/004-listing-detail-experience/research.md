# Research: Listing Detail Experience

## Decision 1: Hero carousel with thumbnail strip and explicit position indicator
- **Decision**: Use a top hero image area with next/previous controls, thumbnail strip for direct selection, and visible `current/total` indicator.
- **Rationale**: This best matches user expectation from mature real-estate portals and keeps orientation clear in large galleries.
- **Alternatives considered**:
  - Grid-only gallery without hero: rejected (weaker visual hierarchy and slower browsing).
  - Fullscreen modal-first gallery: deferred (better as enhancement after MVP).

## Decision 2: Keep detail data contract backward-compatible
- **Decision**: Reuse existing `GET /api/market-listings/{id}` response and derive presentation sections from current fields (`images`, listing facts, `metadata`, transit fields).
- **Rationale**: Enables fast delivery with no schema migration and no breaking integration risk.
- **Alternatives considered**:
  - Introduce a new dedicated detail endpoint shape: rejected for MVP due to avoidable complexity.
  - Add hard-required new contact fields server-side: rejected because source data may be incomplete.

## Decision 3: Contact section uses resilient metadata extraction with partial rendering
- **Decision**: Build an "authorized contact" view model from best-effort metadata keys and show available fields only, with explicit fallback guidance when absent.
- **Rationale**: Listing providers can have inconsistent contact payloads; UI must remain stable even with partial data.
- **Alternatives considered**:
  - Hide contact section when incomplete: rejected (loses context and creates confusing layout jumps).
  - Require all contact attributes before display: rejected (too strict, low real-world coverage).

## Decision 4: Neighborhood section uses embedded mini map preview
- **Decision**: Show an interactive but constrained mini map centered on listing coordinates, with lightweight controls and a direct "open full map" action.
- **Rationale**: Gives immediate location context while preserving page focus on listing content.
- **Alternatives considered**:
  - Static image map only: rejected (less useful and less engaging).
  - Full-featured map panel equal to search map: rejected for MVP scope and performance overhead.

## Decision 5: Section ordering follows conversion-oriented hierarchy
- **Decision**: Order sections as `Media -> Core Facts -> Transit/Area Context -> Contact -> Metadata`.
- **Rationale**: Mirrors buyer/renter scanning behavior and supports quick qualification of listing relevance.
- **Alternatives considered**:
  - Contact before facts: rejected (users decide interest first, then outreach).
  - Metadata near top: rejected (low primary value for typical user flow).

## Decision 6: Missing-data behavior must be explicit, never silent
- **Decision**: Every optional domain (images, map, contact, transit) has visible fallback text and non-blocking rendering.
- **Rationale**: Prevents blank zones and improves trust by explaining why information is unavailable.
- **Alternatives considered**:
  - Implicit empty sections: rejected (looks like rendering bug to users).
  - Hard error on missing optional data: rejected (unnecessary interruption).

## Decision 7: Validation strategy prioritizes detail route integrity and UI edge states
- **Decision**: Extend/maintain integration coverage around detail API response and add UI checks for 0/1/N gallery states plus contact/map fallbacks.
- **Rationale**: This feature is mostly presentation logic driven by variable upstream data quality.
- **Alternatives considered**:
  - Visual-only manual QA without automated checks: rejected (high regression risk).
