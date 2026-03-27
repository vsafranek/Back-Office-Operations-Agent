# Back Office Agent Backlog

Last updated: 2026-03-27

## How to use
- `status`: `todo` | `in_progress` | `blocked` | `done`
- `priority`: `P0` (critical) to `P3` (nice-to-have)
- Keep tasks concrete and implementation-oriented.

## Tasks

| id | title | status | priority | notes |
|---|---|---|---|---|
| BOA-001 | Weekly report: generate 3-slide presentation artifact | done | P0 | PPTX+PDF do Supabase Storage, verejne URL v artefaktech. Vychozi pocet slidu 3 (`WEEKLY_REPORT_DEFAULT_SLIDE_COUNT`). |
| BOA-002 | Generate chart images (PNG) for analytics outputs | todo | P0 | Persist PNG charts to Supabase Storage and return URLs. |
| BOA-003 | Replace market monitor mock feed with real property sources | todo | P0 | Add ingestion adapters, dedupe, and relevance scoring for Praha Holesovice. |
| BOA-004 | Add explicit approval workflow for outbound email sending | todo | P1 | Keep draft-first and add approve/send state transition. |
| BOA-005 | Create data-quality task queue for missing property fields | todo | P1 | Auto-create tasks from missing reconstruction analysis with owner/priority. |
| BOA-006 | Add role model (admin, broker, management) and enforce RLS/UI permissions | todo | P1 | Restrict reports and settings by role. |
| BOA-007 | Extend audit trail for all agent/tool/workflow actions | in_progress | P1 | Basic run logs exist; complete actor/action/target/outcome coverage and export view. |
| BOA-008 | Improve chat UX from raw JSON to message bubbles with artifact cards | todo | P2 | Add readable rendering for tables/charts/links/actions. |
| BOA-009 | Add soft-delete and undo support for conversations | todo | P2 | Replace hard delete with deleted_at and recovery window. |
| BOA-010 | Add pagination and lazy loading for long conversation histories | todo | P2 | Prevent full-history payload on each switch. |
| BOA-011 | Add scheduler verification runbook and automated health checks | todo | P2 | Validate cron execution and workflow freshness daily. |
| BOA-012 | Add disconnect/reconnect Google integration diagnostics in UI | in_progress | P2 | Disconnect implemented. Remaining: token health, last refresh timestamp, guided reconnect. |
| BOA-013 | Scrapers for major Czech listing portals (Sreality.cz, Reality.iDNES.cz, Bezrealitky.cz) | todo | P0 | Ingestion adapters per portal: fetch/listing detail parsing, unified schema, dedupe across sites, rate limits, logging. Prefer official/API or allowed feeds where available; align with site ToS and robots.txt. Supports BOA-003. |
| BOA-014 | Agent-callable Clients DB query tool | done | P1 | Rozšířen `runSqlPreset`: preset `new_clients_q1` → view `vw_new_clients_q1` (migrace 008: Q1 + aktuální rok Europe/Prague), lepší detekce z NL (`detectQueryPresetFromQuestion`). Service-role beze změny. |
| BOA-015 | Pravý panel: tabulka + graf z výstupů agenta | done | P1 | `AgentAnswer.dataPanel`, analytics subagent plní `clients_q1`; UI `AgentDataPanel` + split grid v `ConfigurableAgentPanel`. Export PNG zůstává v BOA-002. |
