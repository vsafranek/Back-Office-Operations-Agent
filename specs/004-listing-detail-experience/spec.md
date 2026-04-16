# Feature Specification: Listing Detail Experience

**Feature Branch**: `004-listing-detail-experience`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "Chci vylepšit Detail stránku pro jednotlivé realitky. Nahoře bude carousel s obrázky. A pod tím veškeré informace, které k tomu máme včetně náhledu mapky ze sousedství a kontakt na oprávněnou osobu."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Complete Listing Overview (Priority: P1)

As a visitor viewing a single property detail, I want to see the most important listing information in one clear layout so I can quickly decide whether the listing is relevant for me.

**Why this priority**: This is the core value of the detail page and must work even if advanced sections are missing data.

**Independent Test**: Open any listing detail page and verify that key listing information (title, price, location, offer metadata, property facts) is presented in a readable structure without requiring additional navigation.

**Acceptance Scenarios**:

1. **Given** a listing detail page with complete listing data, **When** the page is opened, **Then** the page shows a top visual section and a structured information section below it.
2. **Given** a listing detail page with partial listing data, **When** the page is opened, **Then** unavailable values are shown with clear fallback text and the page remains usable.

---

### User Story 2 - Browse Property Photos with Hero Carousel (Priority: P1)

As a property seeker, I want a large image carousel at the top of the detail page so I can understand the property visually before reading detailed information.

**Why this priority**: Photos are often the first decision driver in real-estate browsing.

**Independent Test**: Open a listing with multiple images and verify that users can navigate images from the hero gallery and always know their current position in the set.

**Acceptance Scenarios**:

1. **Given** a listing with multiple photos, **When** the user opens the detail page, **Then** a top carousel is displayed with the first image active.
2. **Given** a listing with multiple photos, **When** the user switches to next/previous image, **Then** the hero image updates and the current image position is visible.
3. **Given** a listing without gallery photos but with at least one preview image, **When** the page is opened, **Then** the available image is shown as fallback.

---

### User Story 3 - Evaluate Area and Contact Responsible Person (Priority: P2)

As a potential buyer or renter, I want to see a neighborhood map preview and responsible-person contact details so I can understand location context and know how to proceed with inquiry.

**Why this priority**: This directly supports conversion from browsing to contacting the listing representative.

**Independent Test**: Open listing detail pages with and without location/contact fields and verify that neighborhood and contact sections appear correctly, including explicit fallback messaging when data is missing.

**Acceptance Scenarios**:

1. **Given** a listing with valid coordinates, **When** the detail page is opened, **Then** a neighborhood map preview is shown in the information area.
2. **Given** a listing with available representative contact data, **When** the detail page is opened, **Then** contact identity and available channels are displayed in a dedicated contact section.
3. **Given** a listing without contact data, **When** the page is opened, **Then** a clear fallback message is shown with guidance to use the original listing link.

---

### Edge Cases

- Listing has no images at all (no gallery and no preview image).
- Listing has coordinates missing or invalid for neighborhood preview.
- Listing has contact name but no phone/email.
- Listing is inactive but still accessible through direct URL.
- Listing metadata is present but contains non-displayable or unexpected values.
- Original source link is unavailable or malformed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The detail page MUST present a top hero media section before textual listing information.
- **FR-002**: The hero media section MUST support navigating through all available listing images.
- **FR-003**: The hero media section MUST display the user’s current position within the image set when more than one image is available.
- **FR-004**: The detail page MUST show all currently available listing attributes relevant to user decision-making (price, location, offer type, property type, disposition, floor/area facts, activity status, timestamps where available).
- **FR-005**: The detail page MUST include a dedicated neighborhood preview section when listing coordinates are available.
- **FR-006**: The detail page MUST include a dedicated section for contact to the responsible person.
- **FR-007**: The contact section MUST show all available contact attributes from listing data and clearly indicate missing attributes.
- **FR-008**: The page MUST provide a clear action for opening the original external listing source.
- **FR-009**: The page MUST preserve existing saved-listing behavior for authenticated users.
- **FR-010**: The page MUST remain readable and actionable across desktop and mobile viewport sizes.
- **FR-011**: The page MUST provide user-friendly fallback content when media, map, or contact data is unavailable.
- **FR-012**: The page MUST keep navigation back to listing search results clearly accessible.
- **FR-013**: Listing metadata intended for transparency/debug context MUST remain accessible in the detail view.
- **FR-014**: The visual hierarchy MUST prioritize media first, then core property information, then supporting sections (neighborhood and contact).

### Key Entities *(include if feature involves data)*

- **Listing Detail Presentation**: A user-facing composition of listing attributes, visual media, location context, and actionable controls.
- **Gallery Item**: A single listing image used in hero carousel navigation, including active index and display state.
- **Neighborhood Snapshot**: A location preview tied to listing coordinates that helps users assess surrounding context.
- **Authorized Contact**: Responsible person/contact record derived from listing data, containing identity and contact channels.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of listing detail views show a top visual media section, with fallback state if no media exists.
- **SC-002**: In usability validation, at least 90% of users can identify the listing price, location, and disposition within 10 seconds of page load.
- **SC-003**: For listings with available coordinates, neighborhood preview is visible in at least 99% of successful page renders.
- **SC-004**: For listings with at least one contact field, contact section displays at least one actionable or readable contact value in 100% of cases.
- **SC-005**: At least 95% of users in acceptance review can complete the intended next step ("open original listing" or "save listing") without additional guidance.

## Assumptions

- Existing listing detail data source continues to provide all currently exposed listing fields.
- Responsible-person contact data may be incomplete and must therefore support partial rendering.
- The detail page remains focused on one listing and does not include recommendation logic in this scope.
- Existing authentication and saved-listing flows remain unchanged and reusable.
- Neighborhood preview relies on existing location coordinates already associated with listing records.