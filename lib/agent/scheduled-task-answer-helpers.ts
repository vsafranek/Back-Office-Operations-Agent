import type { AgentAnswer, AgentDataPanel } from "@/lib/agent/types";

export type ScheduledTaskConfirmationDraft = Extract<
  AgentDataPanel,
  { kind: "scheduled_task_confirmation" }
>["draft"];

function bundlesFromAnswer(answer: AgentAnswer): { dataPanel: AgentDataPanel }[] {
  if (answer.dataPanelBundles && answer.dataPanelBundles.length > 0) {
    return answer.dataPanelBundles;
  }
  if (answer.dataPanel) {
    return [{ dataPanel: answer.dataPanel }];
  }
  return [];
}

/** Návrh cron úlohy čekající na potvrzení v aktuální odpovědi agenta. */
export function scheduledTaskConfirmationDraftFromAnswer(answer: AgentAnswer | null): ScheduledTaskConfirmationDraft | null {
  if (!answer) return null;
  for (const b of bundlesFromAnswer(answer)) {
    if (b.dataPanel.kind === "scheduled_task_confirmation") {
      return b.dataPanel.draft;
    }
  }
  return null;
}
