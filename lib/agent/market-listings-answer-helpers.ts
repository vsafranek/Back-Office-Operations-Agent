import type { AgentAnswer, AgentDataPanel } from "@/lib/agent/types";

export type MarketListingsDataPanel = Extract<AgentDataPanel, { kind: "market_listings" }>;

/** Všechny panely „market_listings“ v odpovědi (pořadí jako ve `dataPanelBundles`). */
export function marketListingsPanelsFromAnswer(answer: AgentAnswer | null): MarketListingsDataPanel[] {
  if (!answer) return [];
  if (answer.dataPanelBundles && answer.dataPanelBundles.length > 0) {
    const out: MarketListingsDataPanel[] = [];
    for (const b of answer.dataPanelBundles) {
      if (b.dataPanel.kind === "market_listings") out.push(b.dataPanel);
    }
    return out;
  }
  if (answer.dataPanel?.kind === "market_listings") {
    return [answer.dataPanel];
  }
  return [];
}
