# Presentation Modes Decision

## Current mode (BOA-001)
- Runtime mode: primary **branded PPTX** from `assets/presentation-templates/blue-white-company-profile.pptx` via **`pptx-automizer`** when the template file exists (or when `PRESENTATION_USE_TEMPLATE=true`). Otherwise **plain slides** via `pptxgenjs`.
- Slide cloning uses template slide **13** for each content slide and optional slide **1** as title; placeholders documented in `docs/architecture/presentation-template-blue-white.md`.
- Default deck size: **3 slides** (`WEEKLY_REPORT_DEFAULT_SLIDE_COUNT`); override via API or agent options.
- Output: `presentation.pptx` and `presentation.pdf` stored in Supabase Storage with public URLs on artifacts.
- **PDF**: still produced with **`pdf-lib`** from `SlideSpec[]` (layout does **not** match the branded PPTX). Logs `presentation_pdf_not_template_layout` when a template PPTX was used. Set `PRESENTATION_SKIP_PDF=true` to upload a small placeholder PDF instead. Planned: PPTX→PDF converter for visual parity.
- Trigger points:
  - weekly workflow (`/api/workflows/weekly-report`)
  - weekly report intent in agent.

## Why local mode now
- Lowest integration risk.
- No extra MCP server lifecycle management.
- Full control over output format and deterministic file artifact URL.

## MCP alternatives considered
- `google-slides-mcp` for native editable Google Slides.
- `office-powerpoint-mcp-server` / `pptx-mcp` for richer deck generation via MCP.
- `mcp-pandoc-md2pptx` style converters for markdown-driven decks.

## Upgrade path to MCP mode
Use MCP-based mode when at least one condition is true:
- Team requires live collaborative editing in Google Slides.
- Business requires comments/revisions inside slides.
- Existing operations already run MCP worker infrastructure reliably.

If activated, keep this fallback order:
1. MCP Slides mode (primary),
2. local `pptxgenjs` mode fallback on MCP failure,
3. markdown report fallback if both fail.
