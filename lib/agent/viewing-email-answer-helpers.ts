import type { AgentAnswer, AgentDataPanel } from "@/lib/agent/types";

export function findViewingEmailDataPanel(
  answer: AgentAnswer | null
): Extract<AgentDataPanel, { kind: "viewing_email_draft" }> | null {
  if (!answer) return null;
  if (answer.dataPanelBundles && answer.dataPanelBundles.length > 0) {
    for (const b of answer.dataPanelBundles) {
      if (b.dataPanel.kind === "viewing_email_draft") {
        return b.dataPanel;
      }
    }
  }
  if (answer.dataPanel?.kind === "viewing_email_draft") {
    return answer.dataPanel;
  }
  return null;
}

/** Sloučí upravené tělo do viewing panelu (včetně více bundle v jedné odpovědi). */
export function mergeViewingEmailDraftBody(answer: AgentAnswer | null, body: string | null): AgentAnswer | null {
  if (!answer || body === null) return answer;
  if (!findViewingEmailDataPanel(answer)) return answer;

  if (answer.dataPanelBundles && answer.dataPanelBundles.length > 0) {
    const nextBundles = answer.dataPanelBundles.map((b) =>
      b.dataPanel.kind === "viewing_email_draft"
        ? {
            ...b,
            dataPanel: {
              ...b.dataPanel,
              draft: { ...b.dataPanel.draft, body }
            }
          }
        : b
    );
    const first = nextBundles[0]!;
    return {
      ...answer,
      dataPanelBundles: nextBundles,
      dataPanel: first.dataPanel,
      dataPanelDownloads: first.dataPanelDownloads
    };
  }

  if (answer.dataPanel?.kind === "viewing_email_draft") {
    return {
      ...answer,
      dataPanel: {
        ...answer.dataPanel,
        draft: { ...answer.dataPanel.draft, body }
      }
    };
  }

  return answer;
}
