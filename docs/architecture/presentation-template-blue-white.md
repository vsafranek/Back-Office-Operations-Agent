# Blue & white company profile — BOA template

Source file in repo: `assets/presentation-templates/blue-white-company-profile.pptx` (copy of a generic “Blue & white company profile” style deck). Confirm licensing before redistribution.

## Deck structure

- **15 slides** in the packaged template (intro, company sections, charts placeholders, thank-you).
- **Theme** (`ppt/theme/theme1.xml`): accent blues include `#4F81BD`, dark text/secondary `#1F497D`, neutrals `#EEECE1` / `#FFFFFF` — useful if a future PDF renderer needs palette hints.

## Slides used by the agent

| Role | 1-based slide # | Notes |
|------|-----------------|--------|
| Title / cover | **1** | Large title layout; placeholders injected in shapes `TextBox 3`, `TextBox 7`, `TextBox 8`. |
| Content (cloned per `SlideSpec`) | **13** | Minimal “detail” layout; placeholders in `TextBox 3` (title) and `TextBox 4` (body). |

Configured via `PRESENTATION_TEMPLATE_TITLE_SLIDE_INDEX` (use **0** to skip the title slide) and `PRESENTATION_TEMPLATE_CONTENT_SLIDE_INDEX` (default **13**).

## Placeholder convention (`{{BOA_*}}`)

Placeholders are plain text in a **single** Office Open XML `<a:t>` run so `pptx-automizer` `modify.replaceText` can substitute reliably (split runs break replacement).

| Token | Shape (slide 1) | Meaning |
|-------|-------------------|---------|
| `{{BOA_DECK_TITLE}}` | TextBox 3 | Main deck title (e.g. weekly report title). |
| `{{BOA_DECK_SUBTITLE}}` | TextBox 7 | Short subtitle (agent uses a fixed “Back Office · report” line; override in code if needed). |
| `{{BOA_DECK_TAGLINE}}` | TextBox 8 | Longer line from `context` / fallback text. |

| Token | Shape (slide 13) | Meaning |
|-------|------------------|---------|
| `{{BOA_TITLE}}` | TextBox 3 | Slide title. |
| `{{BOA_BULLETS}}` | TextBox 4 | Bullet lines joined with **newline** (visual bullets depend on template paragraph style). |

## Runtime

- Generation: `pptx-automizer` in `lib/agent/tools/presentation-from-template.ts`.
- If the resolved template file is missing and `PRESENTATION_USE_TEMPLATE` is not forced to `true`, the pipeline falls back to `pptxgenjs` (`presentation-tool.ts`).
