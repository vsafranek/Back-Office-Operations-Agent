# Presentation Modes Decision

## Current mode (BOA-001)
- Runtime mode: local PPTX generation using `pptxgenjs`.
- Default deck size: **3 slides** (`WEEKLY_REPORT_DEFAULT_SLIDE_COUNT`); override via API or agent options.
- Output: `presentation.pptx` and `presentation.pdf` stored in Supabase Storage with public URLs on artifacts.
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
