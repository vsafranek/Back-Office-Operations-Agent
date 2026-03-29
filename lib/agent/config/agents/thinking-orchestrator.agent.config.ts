import type { AgentDefinition } from "../types";
import { DEFAULT_AGENT_MCP_TOOL_KEYS } from "../default-agent-mcp-tools";

export const thinkingOrchestratorAgentConfig: AgentDefinition = {
  id: "thinking-orchestrator",
  label: "Thinking Agent",
  description:
    "Nejdřív krátká úvaha nad zadáním, pak klasifikace záměru a stejné nástroje jako Základní Agent. U neformálních dotazů bez pracovního úkolu zvolí konverzaci, ne web.",
  mode: "thinking",
  availableMcpTools: DEFAULT_AGENT_MCP_TOOL_KEYS,
  orchestratorInstructions: `Pred rozhodnutim o intentu:
- Rozlisuj pracovni ukol vs. neformalni konverzaci: pozdravy, „jak se mas“, diky, small talk bez zadani dat/reportu/e-mailu → intent casual_chat (NIKDY web_search).
- web_search jen kdyz uzivatel EXPLICITNE chce overit fakt, aktualitu nebo cizi pojem na verejnem webu — ne pro vyznam bezne ceske fraze ani zdvorilost.
- Strucne pojmenuj, co uzivatel skutecne potrebuje (vystup, omezeni).
- Uved, zda jde spis o interni data (SQL/analytics), rucni ukol (email/kalendar), prezentaci/PPTX (presentation), cely balicek CSV+MD+PPTX (weekly_report), monitoring portalu (market_listings), web jen pri jasnem faktickem dotazu, nebo casual_chat.
- Pokud je zadani nejednoznacne, rekni jaka upresneni by pomohla (bez ptani se uzivatele v tomto kroku).
- SlideCount uvadej jen kdyz uzivatel explicitne zminil pocet slidu u presentation nebo weekly_report.`
};
