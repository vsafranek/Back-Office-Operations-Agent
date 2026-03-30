# Agentní systém — architektura (obdélníky a šipky)

Všechny diagramy jsou v Mermaidu jako **flowchart**: uzly jako obdélníky, větvení šipkami.

## 1) Hlavní tok běhu (od UI po uložení)

```mermaid
flowchart TB
  subgraph VSTUP[Vstup]
    UI[UI / Chat]
    API[API route]
  end

  subgraph BEH[Běh agenta]
    RUN[runBackOfficeAgent]
    DEF[getAgentDefinition]
    TR[getMcpToolRunnerForAgent]
    MODE[Režim agenta]
    IC[classifyAgentIntent]
    TO[classifyWithThinkingOrchestrator]
    ORCH[runAgentOrchestrator]
    PLAN[Plán kroků podle intentu]
    SUB[TypeScript subagent]
    TOOL[toolRunner.run]
  end

  subgraph REGISTRY[MCP registry]
    MAP[buildFullMcpToolMap / restricted map]
  end

  subgraph DATA[Data a integrace]
    INT[SQL, kalendář, mail, web, listings, workflow…]
  end

  subgraph VYSTUP[Výstup]
    ANS[AgentAnswer]
    DB[(Databáze: agent_runs, zprávy)]
    PAN[UI panely]
  end

  UI --> API
  API --> RUN
  RUN --> DEF
  RUN --> TR
  RUN --> MODE
  MODE -->|basic| IC
  MODE -->|thinking| TO
  IC --> ORCH
  TO --> ORCH
  ORCH --> PLAN
  PLAN --> SUB
  SUB --> TOOL
  TOOL --> MAP
  MAP --> INT
  SUB --> ANS
  ANS --> DB
  ANS --> PAN
```

## 2) Intent → který subagent

```mermaid
flowchart LR
  subgraph I[Classified intent]
    NODE[AgentIntent]
  end

  NODE --> SA1[analytics-subagent]
  NODE --> SA2[calendar-email-subagent]
  NODE --> SA3[presentation-subagent]
  NODE --> SA4[weekly-report-subagent]
  NODE --> SA5[web-search-subagent]
  NODE --> SA6[market-listings-chat-subagent]
  NODE --> SA7[scheduled-task-proposal-subagent]
  NODE --> SA8[casual-chat-subagent]
```

## 3) MCP tooly — seskupení (stejné klíče jako v kódu)

```mermaid
flowchart TB
  subgraph SQL[SQL a report]
    T1[runSqlPreset]
    T2[generateReportArtifacts]
  end

  subgraph PRES[Prezentace]
    T3[runPresentationAgent]
  end

  subgraph CALMAIL[Kalendář a e-mail]
    T4[browseCalendarAvailability]
    T5[suggestViewingSlots]
    T6[createEmailDraft]
    T7[listGmailMessages]
    T8[getGmailMessage]
    T9[sendGmailOutbound]
  end

  subgraph FLOW[Úlohy a plánování]
    T10[enqueueWorkflowTask]
    T11[proposeScheduledAgentTask]
  end

  subgraph LIST[Nabídky]
    T12[fetchMarketListings]
    T13[upsertMarketListings]
  end

  subgraph WEB[Web]
    T14[webSearch]
    T15[fetchWebPageText]
  end

  META[listMcpCapabilities — doplní se automaticky do mapy]

  ROOT[MCP_TOOL_CONFIG_ENTRIES + listMcpCapabilities]

  ROOT --> SQL
  ROOT --> PRES
  ROOT --> CALMAIL
  ROOT --> FLOW
  ROOT --> LIST
  ROOT --> WEB
  ROOT --> META
```

Poznámka: `listMcpCapabilities` není v pevném seznamu `MCP_TOOL_CONFIG_ENTRIES`, do runtime mapy se přidá v `assemble-registry.ts`.

## 4) Hierarchie agentů a nástrojů (jeden přehled)

**Vrstvy:** (1) produktový profil v UI (`basic` / `thinking-orchestrator`) určuje stejnou sadu povolených MCP klíčů; (2) `runBackOfficeAgent` sestaví `ToolRunner` nad omezenou mapou + `listMcpCapabilities`; (3) klasifikace záměru; (4) `runAgentOrchestrator` naplánuje kroky (`parseTaskCapabilities` může přidat druhý krok prezentace u `analytics` / `market_listings`); (5) každý krok volá TypeScript **subagent**; subagent volá MCP přes `toolRunner.run(...)` — výjimka: `market-listings-chat-subagent` používá interní `fetchMarketListings`, nikoli MCP wrapper.

```mermaid
flowchart TB
  subgraph UI[Vstup]
    CHAT[UI Chat]
    APIR[API route]
  end

  subgraph PROD[Produktove agenty agent-definitions]
    BASIC[basic — Zakladni Agent]
    THINK[thinking-orchestrator — Thinking Agent]
  end

  subgraph RUN[Beh]
    RBO[runBackOfficeAgent]
    DEF[getAgentDefinition]
    MAP[buildRestrictedMcpToolMap + listMcpCapabilities]
    TR[ToolRunner]
    MODE{mode}
    IC[classifyAgentIntent]
    TO[classifyWithThinkingOrchestrator]
    ORCH[runAgentOrchestrator]
    PLAN[planSteps + parseTaskCapabilities]
    LOOP[smycka kroku: shouldRunStep, replanRemainingSteps]
  end

  subgraph STEPS[Planovane kroky a subagenti]
    SA_ANA[runAnalyticsSubAgent]
    SA_PRES[runPresentationSubAgent]
    SA_WK[runWeeklyReportSubAgent]
    SA_RD[runReportDataSubAgent]
    SA_PFR[runPresentationFromRowsSubAgent]
    SA_CAL[runCalendarEmailSubAgent]
    SA_WEB[runWebSearchSubAgent]
    SA_MKT[runMarketListingsChatSubAgent]
    SA_SCH[runScheduledTaskProposalSubAgent]
    SA_CAS[runCasualChatSubAgent]
  end

  subgraph MCP[MCP nastroje povolene DEFAULT_AGENT_MCP_TOOL_KEYS]
    SQL[runSqlPreset + generateReportArtifacts]
    PRES[runPresentationAgent]
    CAL[browseCalendarAvailability suggestViewingSlots]
    MAIL[createEmailDraft listGmail getGmail sendGmailOutbound]
    FLOW[enqueueWorkflowTask proposeScheduledAgentTask]
    LIST[fetchMarketListings upsertMarketListings]
    WEB[webSearch fetchWebPageText]
  end

  subgraph INT[Interni bez MCP toolRunner]
    MKTAPI[fetchMarketListings TS + API portaly]
  end

  subgraph NO_MCP[Bez MCP nastroje]
    LLM_ONLY[Azure LLM — casual chat]
  end

  CHAT --> APIR
  APIR --> RBO
  RBO --> DEF
  DEF --> BASIC
  DEF --> THINK
  RBO --> MAP
  MAP --> TR
  RBO --> MODE
  MODE -->|basic| IC
  MODE -->|thinking| TO
  IC --> ORCH
  TO --> ORCH
  ORCH --> PLAN
  PLAN --> LOOP

  LOOP -->|analytics| SA_ANA
  LOOP -->|analytics_presentation| SA_PFR
  LOOP -->|presentation| SA_PRES
  LOOP -->|weekly_report| SA_WK
  LOOP -->|calendar_email| SA_CAL
  LOOP -->|web_search| SA_WEB
  LOOP -->|market_listings| SA_MKT
  LOOP -->|market_listings_presentation| SA_PFR
  LOOP -->|scheduled_agent_task| SA_SCH
  LOOP -->|casual_chat| SA_CAS

  SA_WK --> SA_RD
  SA_WK --> SA_PFR
  SA_PRES --> SA_PFR

  SA_ANA --> SQL
  SA_RD --> SQL
  SA_PRES --> SQL
  SA_PFR --> PRES
  SA_CAL --> CAL
  SA_CAL --> MAIL
  SA_WEB --> WEB
  SA_SCH --> FLOW
  SA_MKT --> MKTAPI
  SA_CAS --> LLM_ONLY
```

`ToolRunner` se vytvoří z profilu agenta a **předává se do každého subagentního volání** z orchestrátoru — uvnitř se volá `toolRunner.run("názevNástroje", …)`. **Bez MCP volání** zůstává `runCasualChatSubAgent` (čistě LLM). **`runMarketListingsChatSubAgent`** hlavní data bere přes interní `fetchMarketListings`, ne přes MCP klíč `fetchMarketListings` (i když je v allowlistu pro jiné účely).

**Zkratky chování orchestrátoru:** u `market_listings` + „chci prezentaci“ jsou kroky `market_listings` → `market_listings_presentation`; u `analytics` analogicky `analytics` → `analytics_presentation`. Pokud první krok nevrátí řádky pro deck, druhý krok se přeskočí (`replanRemainingSteps`). `weekly_report` uvnitř jednoho běhu skládá report (`runReportDataSubAgent`) a pak `runPresentationFromRowsSubAgent` oba přes sdílené MCP nástroje výše.
