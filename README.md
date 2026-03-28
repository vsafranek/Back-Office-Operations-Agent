# Back Office Operations Agent

Back-office agent for real-estate operations built on:
- Next.js (API + orchestration),
- Supabase (database, storage),
- Azure OpenAI-compatible endpoint via official **`openai`** SDK (chat completions),
- Google Workspace (Calendar + Gmail drafts).

## Quick start
1. Copy `.env.example` to `.env.local`.
2. Fill Supabase, Azure proxy and Google credentials.
3. Install dependencies: `npm install`
4. Run dev server: `npm run dev`

## Main endpoints
- `POST /api/agent` - natural-language prompt for analytics/workflows. Body: `question`, optional `conversationId`, optional `agentId` (`basic` / `thinking-orchestrator`, default = thinking orchestrator), optional `options.presentation.slideCount` (weekly report defaults to **3** slides).
- `GET /api/agent/trace?runId=...` - strom LLM + nástrojů pro jeden běh (stejný uživatel jako Bearer token).
- `GET /api/audit/run?runId=...` - agregát auditu běhu (agent run + outbound e-maily + počet trace); `format=csv` pro export.
- `GET /api/agent/trace/ops?runId=...&traceUserId=automation_worker` + hlavička `X-Audit-Ops-Secret` - trace pro cron (vyžaduje `AUDIT_OPS_SECRET`).
- `POST /api/cron/purge-audit` - mazání starých `agent_trace_events` (stejná autorizace jako `x-cron-secret`; volitelně `AGENT_TRACE_RETENTION_DAYS`).
- `POST /api/cron/daily` - daily market monitoring job.
- `POST /api/workflows/weekly-report` - weekly executive report trigger (optional: `slideCount` default **3**, `title`, `context`).
- `GET /api/storage/list` - list files in Supabase Storage (auth required).
- `GET /api/storage/download` - create signed download link (auth required).
- `POST /api/storage/download-batch` - create multiple signed download links (auth required).
- `DELETE /api/storage/file` - delete one file in Supabase Storage (auth required).
- `DELETE /api/storage/files` - bulk delete files (auth required).

## Presentation artifacts
- Weekly report flow now generates:
  - CSV dataset
  - Markdown summary
  - PPTX presentation (`presentation.pptx`) with dynamic slide count (default **3** for weekly flow). When `assets/presentation-templates/blue-white-company-profile.pptx` is present, the deck is filled from that branded template (`pptx-automizer`); see `docs/architecture/presentation-template-blue-white.md`.
  - PDF version (`presentation.pdf`) for direct sharing — still a simple text layout from slide specs (not the PPTX design); optional `PRESENTATION_SKIP_PDF=true` replaces it with a short placeholder file.
- **Template rights**: the blue-white deck is a third-party style; verify license/usage before shipping or redistributing the binary.
- Decision note for future MCP-based presentation mode:
  - `docs/architecture/presentation-modes.md`

## Supabase migrations
Run files in order (včetně konverzací a trace), např.:
1. `001_init_core.sql` … `006_conversations.sql` (jak máte v repu),
2. **`007_agent_trace_events.sql`** – strom agent / LLM / tool pro dashboard.

Architektura: `docs/architecture/system-overview.md`.

## Security notes
- Keep service keys only in server env vars.
- Rotate secrets and cron token regularly.
- Keep external communication in approval mode (email drafts first).
