# Agent Operations Runbook

## 1. Startup checklist
- Verify env vars are present (`.env.local` from `.env.example`).
- Validate Supabase connectivity and storage bucket existence.
- Validate Azure proxy health endpoint and quota status.
- Validate Google Workspace service account delegation.

## 2. Daily operations
- Check `agent_runs` for failures (`confidence < 0.4` or missing sources).
- Check `workflow_runs` for stalled runs.
- Review logs for `azure_proxy_retry` frequency spikes.

## 3. Incident handling
- If Azure proxy fails: switch to fallback model and lower max tokens.
- If Supabase latency spikes: reduce `AGENT_MAX_QUERY_ROWS`, disable heavy reports.
- If Google API throttles: pause draft generation and retry via queue.

## 4. Security controls
- Keep service keys only in Vercel encrypted env vars.
- Never log full customer emails or message bodies.
- Rotate `CRON_SECRET` quarterly.

## 5. Recovery
- Re-run weekly report via `POST /api/workflows/weekly-report`.
- Re-run daily monitor via `POST /api/cron/daily` with `x-cron-secret`.
