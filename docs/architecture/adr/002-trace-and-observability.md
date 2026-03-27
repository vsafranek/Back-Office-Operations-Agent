# ADR 002 – Trace a observabilita

## Stav: přijato

## Kontext

Operátoři a vývojáři potřebují vidět průběh: LLM kroky, volání nástrojů, vstupy a výstupy (v bezpečné, zkrácené podobě).

## Rozhodnutí

- Události se ukládají do **`public.agent_trace_events`** (migrace `007_agent_trace_events.sql`).
- Zápis probíhá ze serveru přes service role; čtení v UI přes **`GET /api/agent/trace?runId=...`** s ověřením vlastníka (`user_id`).
- **ToolRunner** a **`generateWithAzureProxy`** emitují záznamy přes **`AgentTraceRecorder`**.
- Struktura stromu: **`parent_id`** + **`step_index`**; druhy uzlů: `orchestrator`, `llm`, `subagent`, `tool`.
- Velké struktury (např. řádky z SQL) se serializují funkcí **`serializeForTrace`** – náhled, ne kompletní dump.

## Důsledky

- Nutné spustit migraci 007 v Supabase.
- RLS umožňuje čtení vlastním uživatelům z `authenticated`; API stejně autorizuje Bearer token.
- Další rozšíření: export trace, retenční politika, PII maskování podle typu pole.
