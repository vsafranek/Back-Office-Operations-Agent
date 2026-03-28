# ADR 002 – Trace a observabilita

## Stav: přijato

## Kontext

Operátoři a vývojáři potřebují vidět průběh: LLM kroky, volání nástrojů, vstupy a výstupy (v bezpečné, zkrácené podobě).

## Rozhodnutí

- Události se ukládají do **`public.agent_trace_events`** (migrace `007_agent_trace_events.sql`).
- Zápis probíhá ze serveru přes service role; čtení v UI přes **`GET /api/agent/trace?runId=...`** s ověřením vlastníka (`user_id`).
- **ToolRunner** a **`generateWithAzureProxy`** emitují záznamy přes **`AgentTraceRecorder`**.
- Struktura stromu: **`parent_id`** + **`step_index`**; druhy uzlů: `orchestrator`, `llm`, `subagent`, `tool`.
- Velké struktury (např. řádky z SQL) se serializují funkcí **`serializeForTrace`** – náhled, ne kompletní dump; citlivé klíče a e-mailová pole se redaktují/maskují (BOA-007).
- Agregát auditu jednoho běhu: **`GET /api/audit/run?runId=...`** (JSON / `format=csv`).
- Trace pro cron / `automation_worker`: **`GET /api/agent/trace/ops`** + **`X-Audit-Ops-Secret`** (env `AUDIT_OPS_SECRET`).
- Retence: **`POST /api/cron/purge-audit`** + `x-cron-secret`; stáří řídí `AGENT_TRACE_RETENTION_DAYS` (výchozí 90).

## Důsledky

- Nutné spustit migraci 007 v Supabase; pro sloupce `workflow_runs` (audit enqueue) migrace **014**.
- RLS umožňuje čtení vlastním uživatelům z `authenticated`; API stejně autorizuje Bearer token.
- Konvence `meta` u orchestrátoru: viz [audit-meta-conventions.md](../audit-meta-conventions.md).
