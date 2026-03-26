# Back Office Operations Agent

Back-office agent for real-estate operations built on:
- Next.js (API + orchestration),
- Supabase (database, storage),
- Azure LLM proxy (single model access point),
- Google Workspace (Calendar + Gmail drafts).

## Quick start
1. Copy `.env.example` to `.env.local`.
2. Fill Supabase, Azure proxy and Google credentials.
3. Install dependencies: `npm install`
4. Run dev server: `npm run dev`

## Main endpoints
- `POST /api/agent` - natural-language prompt for analytics/workflows (optional `options.presentation.slideCount`; weekly report defaults to **3** slides).
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
  - PPTX presentation (`presentation.pptx`) with dynamic slide count (default **3** for weekly flow)
  - PDF version (`presentation.pdf`) for direct sharing
- Decision note for future MCP-based presentation mode:
  - `docs/architecture/presentation-modes.md`

## Supabase migrations
Run files in order:
1. `supabase/migrations/001_init_core.sql`
2. `supabase/migrations/002_views_and_functions.sql`
3. `supabase/migrations/003_rls_policies.sql`

## Security notes
- Keep service keys only in server env vars.
- Rotate secrets and cron token regularly.
- Keep external communication in approval mode (email drafts first).
