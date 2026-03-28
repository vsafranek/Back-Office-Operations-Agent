# Back Office Agent Backlog

Last updated: 2026-03-27 (BOA-003: market monitor bez mock + filtr lokality)

## How to use
- `status`: `todo` | `in_progress` | `blocked` | `done`
- `priority`: `P0` (critical) to `P3` (nice-to-have)
- Keep tasks concrete and implementation-oriented.

## Tasks

| id | title | status | priority | notes |
|---|---|---|---|---|
| BOA-001 | Weekly report: generate 3-slide presentation artifact | done | P0 | PPTX+PDF do Supabase Storage, verejne URL v artefaktech. Vychozi pocet slidu 3 (`WEEKLY_REPORT_DEFAULT_SLIDE_COUNT`). |
| BOA-002 | Generate chart images (PNG) for analytics outputs | done | P0 | Q1 kanálový graf: SVG (`chart-png-svg.ts`) → PNG (`sharp`) → `reports/{runId}/q1-source-channel.png`, veřejná URL v artefaktu typu `chart`; analytický subagent. |
| BOA-003 | Replace market monitor mock feed with real property sources | done | P0 | Daily monitor už bere jen Sreality + Bezrealitky (`fetchMarketListings` default); **mock** odstraněn z produkce. Filtr relevance čtvrtí: `market-listing-locality-filter.ts` + `daily-market-monitor-subagent` (Holešovice → text v lokaci/titulku, fallback pokud by filtr vyprázdnil data). |
| BOA-004 | Add explicit approval workflow for outbound email sending | done | P1 | Panel: draft v Gmailu nebo „Odeslat rovnou“; `POST /api/google/email-send` s `strategy` `from_draft` \| `direct`. MCP: `sendGmailOutbound`, `createEmailDraft` (+ audit draftu), `listGmailMessages`, `getGmailMessage`. Vazba leadů: `013_outbound_email_leads` (**nasazeno na remote**), `leadIds` v API, `relatedLeadIds` v `dataPanel` (zatím ruční UUID — viz BOA-019). |
| BOA-005 | Create data-quality task queue for missing property fields | todo | P1 | MVP hotový: agent + `missing_reconstruction` → `fn_missing_reconstruction_data`, exporty CSV/MD/XLSX, textové zúžení (title, city z RPC, `address` jsonb, internal_ref); jedna migrace **015** (rekonstrukce + `address` + DQI seed + mock 01dd) + `data_quality_issues`. Dál: owner/priority, UI fronty, auto-create při dotazu. |
| BOA-006 | Add role model (admin, broker, management) and enforce RLS/UI permissions | todo | P1 | Restrict reports and settings by role. |
| BOA-007 | Extend audit trail for all agent/tool/workflow actions | done | P1 | `GET /api/audit/run` + panel `AuditRunSummary`; CSV export; `workflow_runs` sloupce (migrace 014) + enqueue audit; cron workflow metadata/chyby; `GET /api/agent/trace/ops` + `AUDIT_OPS_SECRET`; `POST /api/cron/purge-audit` + retence; `meta` actor/action u `run.start` / `intent.selected`; PII v `serializeForTrace`; docs `audit-meta-conventions.md`. |
| BOA-008 | Improve chat UX from raw JSON to message bubbles with artifact cards | todo | P2 | Add readable rendering for tables/charts/links/actions. |
| BOA-009 | Add soft-delete and undo support for conversations | todo | P2 | Replace hard delete with deleted_at and recovery window. |
| BOA-010 | Add pagination and lazy loading for long conversation histories | todo | P2 | Prevent full-history payload on each switch. |
| BOA-011 | Add scheduler verification runbook and automated health checks | todo | P2 | Validate cron execution and workflow freshness daily. |
| BOA-012 | Add disconnect/reconnect Google integration diagnostics in UI | in_progress | P2 | Disconnect implemented. Remaining: token health, last refresh timestamp, guided reconnect. |
| BOA-013 | Scrapers for major Czech listing portals (Sreality.cz, Reality.iDNES.cz, Bezrealitky.cz) | in_progress | P0 | Hotovo první vlna: Sreality (API), Bezrealitky (GraphQL přes env + šablona). Zbývá iDNES / detail parsing / meziportálový dedupe — navazuje na BOA-003. |
| BOA-014 | Agent-callable Clients DB query tool | done | P1 | Rozšířen `runSqlPreset`: preset `new_clients_q1` → view `vw_new_clients_q1` (migrace 008: Q1 + aktuální rok Europe/Prague), lepší detekce z NL (`detectQueryPresetFromQuestion`). Service-role beze změny. |
| BOA-015 | Pravý panel: tabulka + graf z výstupů agenta | done | P1 | `AgentAnswer.dataPanel`, analytics subagent plní `clients_q1`; UI `AgentDataPanel` + split grid v `ConfigurableAgentPanel`. PNG export viz BOA-002. |
| BOA-016 | Analytics: graf + panel pro leady vs prodané (6 měsíců) | done | P1 | `dataPanel` `leads_sales_6m`: dvojité sloupce v UI + tabulka; LLM instrukce neomlouvají absenci grafu. Volitelný follow-up: PNG do Storage jako u Q1 (`chart-png`). |
| BOA-017 | Rozšíření DB pro realitní provoz (lead pipeline, deal detaily) | todo | P1 | Hotovo: migrace **016** — `leads` (`updated_at`, `last_contact_at`, `expected_value_czk`, `lost_reason`, `notes`, FK `property_id`), `deals` (`lead_id`, `commission_*`, `deal_source`, `status`), `vw_lead_pipeline_summary`, backfill; Excel list **Deals** + heuristika v `crm-excel-sheets.ts`. Dál: tvrdší enum `status`, UI pipeline, materializované agregace BI. |
| BOA-018 | Excel (.xlsx) z analytiky + extra listy Properties/Leads | done | P1 | `exceljs`, `generateReportArtifacts` → Storage `report.xlsx`, MCP `xlsxPublic`; heuristika „excel/xlsx/portfolio/nemovitosti“ → `fetchCrmSheetsForReport`; weekly report má Excel artefakt; Vitest `tests/report-tool.test.ts`. Migrace: `011_leads_portfolio_scale.sql`. |
| BOA-019 | E-mail panel: výběr leadů z CRM (místo ručního UUID) | todo | P2 | Vyhledání leadů podle jména/e-mailu, multi-select, zápis do `leadIds` při draft/send. Volitelně auto-doplnění z kontextu agenta. |

## Nedávno dodáno (mimo tabulku)

- **Kalendář / prohlídka:** MCP `browseCalendarAvailability`, náhled v `CalendarPreviewStrip`, podpis odesílatele, expert na maily v `calendar-email-subagent`.
- **Gmail:** čtení schránky (`listGmailMessages`, `getGmailMessage`), sloučené odeslání `sendGmailOutbound`.
