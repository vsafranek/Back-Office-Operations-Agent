---
name: backoffice-orchestrator-flow
description: >-
  Describes Back Office agent intents (analytics, presentation, weekly_report, etc.), TypeScript subagents under
  lib/agent/subagents, integration with MCP ToolRunner, and presentation vs full weekly report flows.
  Use when changing intent classification, routing, subagents, or when the user asks how chat requests map to code paths.
---

# Back Office — orchestrátor, intenty a subagenti

## Kdy skill použít
- Úprava **klasifikace záměru** (basic / thinking orchestrátor).
- Nový **intent** nebo změna směrování z `runAgentOrchestrator`.
- Úprava **TypeScript subagenta** (weekly report, presentation, analytics, …).
- Rozlišení **presentation** (hlavně PPTX) vs **weekly_report** (CSV + MD + PPTX).

## Tok od API k nástrojům
1. **`runBackOfficeAgent`** (`lib/agent/index.ts`) — načte **`agentDef`**, vytvoří **`toolRunner = getMcpToolRunnerForAgent(agentDef)`**, zvolí intent (classifier / thinking).
2. **`runAgentOrchestrator`** (`lib/agent/orchestrator/agent-orchestrator.ts`) — dostane **`toolRunner`** a podle **`intent`** zavolá příslušný subagent.
3. Subagent volá nástroje přes **`params.toolRunner.run("názevKlíče", ctx, input)`** — **`názevKlíče`** musí být v **`availableMcpTools`** daného agenta (jinak `TOOL_NOT_FOUND`).

## Intenty (`AgentIntent`)
- **`analytics`** — `runAnalyticsSubAgent`: SQL preset, report artefakty (CSV/MD), bez automatické prezentace.
- **`presentation`** — `runPresentationSubAgent`: SQL → **`runPresentationAgent`** (MCP), odpověď + PPTX/PDF odkazy.
- **`weekly_report`** — `runWeeklyReportSubAgent`: SQL → report → **`runPresentationAgent`** (plný balíček).
- **`calendar_email`**, **`web_search`** — vlastní subagenti.

Klasifikace: `lib/agent/llm/intent-classifier.ts`, thinking: `lib/agent/llm/thinking-orchestrator.ts`.  
Prompty musí držet rozdíl **jen prezentace** vs **kompletní manažerský balíček**.

## MCP vs TypeScript subagent
- **MCP záznam** **`runPresentationAgent`** — jeden tool v registru; ostatní agenti ho mohou volat, pokud mají klíč v **`availableMcpTools`**.
- **TypeScript** `runPresentationSubAgent` — orchestrátorovský krok: připraví data a kontext, pak zavolá MCP tool přes runner.

## Úpravy při novém intentu
- [ ] Rozšířit enum / schema v **intent-classifier** a **thinking-orchestrator**.
- [ ] Přidat větev v **`runAgentOrchestrator`**.
- [ ] Implementovat nebo znovupoužít subagent modul v **`lib/agent/subagents/`**.
- [ ] Zkontrolovat **`slideCount`** / defaulty v **`lib/agent/index.ts`** pro nový intent.
- [ ] Aktualizovat pokyny v **`lib/agent/config/agents/thinking-orchestrator.agent.config.ts`**, pokud je potřeba.

## Související
- MCP registry a nástroje: `.cursor/skills/backoffice-mcp-registry/SKILL.md`
- Úkoly: `.cursor/skills/backoffice-task-tracker/SKILL.md`
