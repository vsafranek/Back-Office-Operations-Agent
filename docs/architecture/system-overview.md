# Back Office Agent – přehled systému

## Kontext (C4 – kontejner)

- **Klient**: Next.js dashboard (`app/dashboard`) volá REST API s Bearer tokenem (Supabase Auth).
- **API**: `app/api/agent` spouští `runBackOfficeAgent`; `app/api/agent/trace` vrací strom kroků pro `runId`; `app/api/audit/run` agreguje běh + odchozí e-maily; `app/api/agent/trace/ops` čte trace pro systémové actory (tajný klíč).
- **Orchestrace**: profil agenta (`lib/agent/config`) → klasifikace záměru (basic LLM nebo thinking orchestrátor) → `runAgentOrchestrator` → specializované subagenty.
- **Nástroje**: `ToolRunner` validuje vstup/výstup dle Zod a volá implementace v `lib/agent/tools/*` (SQL, reporty, prezentace, kalendář, e-mail, web…).
- **Data**: Postgres + Storage (Supabase); Azure OpenAI přes oficiální `openai` SDK (`lib/llm/azure-proxy-provider`).

## Korelace běhu

- Každý požadavek dostane **`runId`** (UUID). Stejná hodnota je v odpovědi agenta, v metadatech zpráv konverzace a v řádcích **`agent_trace_events`**.

## Trace strom

- Uzly: `orchestrator` (start běhu, výběr intentu), `llm` (volání modelu), `subagent` (hranice intentu), `tool` (konkrétní nástroj).
- Rodičovské vazby přes **`parent_id`**; pořadí přes **`step_index`**.
- V UI lze rozkliknout vstup/výstup (velké tabulky v trace jen náhled přes serializaci).

## Další čtení

- [ADR 001 – Orchestrace a profily agentů](./adr/001-orchestration-and-agents.md)
- [ADR 002 – Trace a observabilita](./adr/002-trace-and-observability.md)
- [Konvence auditního meta u trace](./audit-meta-conventions.md)
