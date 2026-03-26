# n8n and Scheduling Strategy

## n8n with Vercel
- n8n itself does not run natively inside Vercel serverless functions.
- Recommended deployment for hybrid mode:
  - host n8n on separate container runtime (Railway, Render, Fly.io, VM),
  - expose webhook endpoints protected by shared HMAC secret,
  - invoke n8n from this app using signed webhook requests.

## Secrets and API key handoff
- Keep integration keys in n8n secret store, not in workflow payload.
- Pass only short-lived signed tokens from Vercel -> n8n.
- Use idempotency keys for retries to avoid duplicate actions.

## Cron limits and fallback
- Vercel free plan allows limited cron frequency.
- Current implementation uses one daily cron route (`/api/cron/daily`) that orchestrates all recurring tasks.
- If higher frequency is needed, use Supabase `pg_cron` and call secured API endpoints from database jobs.

## Suggested split
- Vercel: agent API, core orchestration, reporting.
- n8n: external system glue jobs with visual operations ownership.
- Supabase: durable state, scheduling fallback (`pg_cron`), audit data.
