# Konvence auditního `meta` u trace (BOA-007)

U vybraných uzlů v `agent_trace_events` se do sloupce `meta` zapisují sjednocená pole pro čitelnost a budoucí exporty:

| Pole | Význam | Příklad |
|------|--------|---------|
| `actorType` | Kdo akci inicioval | `user` (chat uživatel), později `system` / `cron` |
| `action` | Co se děje | `agent.run.start`, `agent.intent.selected` |
| `targetType` | Typ cíle | `conversation`, `adhoc`, `intent` |
| `targetId` | Id cíle (když existuje) | UUID konverzace, název intentu |

Nástroje a LLM kroky mohou postupně doplňovat stejná pole v `meta` u závažných operací (např. odeslání, SQL preset).

Vstupy a výstupy v `input_payload` / `output_payload` procházejí `lib/agent/trace/serialize-for-trace.ts` (`serializeForTrace`): zkrácení velkých struktur, `[REDACTED]` u citlivých klíčů, maskování e-mailů u polí jako `email`, `to`, `from`.

## Související API

- Agregát běhu: `GET /api/audit/run?runId=…` (JSON nebo `format=csv`).
- Trace pro automation: `GET /api/agent/trace/ops?runId=…&traceUserId=automation_worker` + hlavička `X-Audit-Ops-Secret`.
- Retence trace: `POST /api/cron/purge-audit` + `x-cron-secret` (stejně jako ostatní cron routy).
