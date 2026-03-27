import type { AgentDefinition } from "../types";

export const thinkingOrchestratorAgentConfig: AgentDefinition = {
  id: "thinking-orchestrator",
  label: "Thinking orchestrátor",
  description:
    "Nejdřív explicitní úvaha nad zadáním (kontext, rizika, vhodné nástroje), poté klasifikace záměru a stejný tok jako u základního agenta.",
  mode: "thinking",
  orchestratorInstructions: `Pred rozhodnutim o intentu:
- Strucne pojmenuj, co uzivatel skutecne potrebuje (vystup, omezeni).
- Uved, zda jde spis o interni data (SQL/analytics), rucni ukol (email/kalendar), reporting (prezentace), nebo externi fakta (web).
- Pokud je zadani nejednoznacne, rekni jaka upresneni by pomohla (bez ptani se uzivatele v tomto kroku).
- SlideCount uvadej jen kdyz uzivatel explicitne zminil pocet slidu u tydenniho reportu.`
};
