---
name: backoffice-mcp-registry
description: >-
  Describes the Back Office repo MCP architecture—per-tool config files under lib/agent/mcp-tools/config/tools,
  assemble-registry, agent allowlists (availableMcpTools), restricted ToolRunner, and listMcpCapabilities.
  Use when adding or changing MCP tools, registering tools, configuring agents, debugging TOOL_NOT_FOUND,
  or when the user asks how the tool registry or agent tool access works.
---

# Back Office — MCP registry a konfigurace nástrojů

## Kdy skill použít
- Přidávání nebo úprava **MCP nástroje** (nový SQL/report/calendar/… wrapper).
- Úprava **seznamu nástrojů u agenta** (`availableMcpTools`).
- Vysvětlování rozdílu **plný registry** vs **omezěný runner** podle agenta.
- Chyby **`TOOL_NOT_FOUND`** po zúžení allowlistu.
- Otázky na **`listMcpCapabilities`** a JSON Schema vstupů/výstupů.

## Vrstvy (musí zůstat konzistentní)

1. **Konfigurace jednoho nástroje**  
   Soubor: `lib/agent/mcp-tools/config/tools/<nazev>.tool.ts`  
   Exportuje `McpToolConfigEntry`: `registryKey` (řetězec shodný s klíčem v mapě) + `tool` (`contract`: `name`, `role` `tool` \| `subagent`, `description`, `inputSchema`, `outputSchema`, `auth`, `sideEffects`; `run`).

2. **Sestavení globálního registru**  
   Soubor: `lib/agent/mcp-tools/config/assemble-registry.ts`  
   - Pole **`MCP_TOOL_CONFIG_ENTRIES`** musí obsahovat každý nový nástroj (pořadí určuje typ `McpToolRegistryKey`).  
   - **`buildFullMcpToolMap()`** — všechny nástroje + na konec **`listMcpCapabilities`** (callback vidí celou mapu).  
   - **`buildRestrictedMcpToolMap(allowedKeys)`** — jen klíče z `availableMcpTools` agenta + **`listMcpCapabilities`** nad touto podmnožinou.

3. **Runner pro runtime**  
   Soubor: `lib/agent/mcp-tools/tool-registry.ts`  
   - **`getFullMcpToolRunner()`** / **`getToolRunner()`** — celá množina (testy, diagnostika).  
   - **`getMcpToolRunnerForAgent(agentDef)`** — podle `agentDef.availableMcpTools` (cache podle id + seřazeného seznamu klíčů).

4. **Agent**  
   - Typ: `lib/agent/config/types.ts` — **`availableMcpTools: readonly McpToolRegistryKey[]`** (povinné).  
   - Výchozí sada: `lib/agent/config/default-agent-mcp-tools.ts` — **`DEFAULT_AGENT_MCP_TOOL_KEYS`**.  
   - Konkrétní agenti: `lib/agent/config/agents/*.agent.config.ts` — přiřadit `availableMcpTools` (často celý default; lze zúžit).  
   - Validace při loadu: `lib/agent/config/validate-agent-mcp-tools.ts` — neznámý klíč → throw.

5. **Orchestrátor**  
   `runAgentOrchestrator` dostává **`toolRunner`** z `runBackOfficeAgent` (`getMcpToolRunnerForAgent(agentDef)`). Nepoužívat globální full runner u produkčního toku, pokud má platit allowlist.

## Checklist: nový MCP nástroj
- [ ] Implementace logiky zůstává v `lib/agent/tools/<feature>-tool.ts` (nebo existující modul).
- [ ] Nový soubor `lib/agent/mcp-tools/config/tools/<kebab>.tool.ts` s `registryKey` a `tool`.
- [ ] Přidat entry do **`MCP_TOOL_CONFIG_ENTRIES`** v `assemble-registry.ts`.
- [ ] Typ `McpToolRegistryKey` se aktualizuje automaticky z pole — opravit případné **TS chyby** v agent configs.
- [ ] Doplnit klíč do **`DEFAULT_AGENT_MCP_TOOL_KEYS`**, pokud má být u všech produktových agentů dostupný; jinak jen u vybraného agenta v jeho `availableMcpTools`.
- [ ] Spustit **`npm run typecheck`** a **`npm test`**.
- [ ] Před voláním držet **schema-driven** postup z projektového skillu **`tool-as-mcp`** (volitelně zavolat `listMcpCapabilities` pro introspekci).

## Checklist: nový agent nebo změna allowlistu
- [ ] Přidat `AgentDefinition` do `lib/agent/config/registry.ts` (a soubor v `agents/`).
- [ ] Vyplnit **`availableMcpTools`** — pouze hodnoty z `McpToolRegistryKey`.
- [ ] Ověřit, že `assertAgentMcpToolsValid` při importu registry nepadá.

## Důležité pravidla
- **`listMcpCapabilities`** není v `DEFAULT_AGENT_MCP_TOOL_KEYS`; do mapy se **přidá vždy** v `buildRestrictedMcpToolMap` / `buildFullMcpToolMap`.
- Specialisté s **`role: "subagent"`** (např. `runPresentationAgent`) jsou v MCP stejně jako tools; TypeScript „subagent“ toky (`runPresentationSubAgent`, …) jsou **nad** tímto registry a volají nástroje přes předaný `ToolRunner`.
- Duplicitní **`registryKey`** v `MCP_TOOL_CONFIG_ENTRIES` způsobí throw při buildu mapy.

## Související
- Schema-driven volání: `.cursor/skills/tool-as-mcp/SKILL.md`
- Backlog úkolů: `.cursor/skills/backoffice-task-tracker/SKILL.md`
