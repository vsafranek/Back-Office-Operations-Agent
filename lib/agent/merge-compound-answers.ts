import type { ClassifiedAgentIntent } from "@/lib/agent/llm/intent-classifier";
import type { AgentAnswer, AgentDataPanelBundle } from "@/lib/agent/types";

function answerToBundles(a: AgentAnswer): AgentDataPanelBundle[] {
  if (a.dataPanelBundles?.length) return a.dataPanelBundles;
  if (a.dataPanel) {
    return [{ dataPanel: a.dataPanel, dataPanelDownloads: a.dataPanelDownloads }];
  }
  return [];
}

function mergeIntents(intents: ClassifiedAgentIntent["intent"][]): ClassifiedAgentIntent["intent"] {
  if (intents.length === 0) return "analytics";
  if (intents.every((i) => i === "casual_chat")) return "casual_chat";
  const firstNonCasual = intents.find((i) => i !== "casual_chat");
  return firstNonCasual ?? intents[0]!;
}

/** Slepí více dílčích odpovědí do jedné bubliny; poskládá panely ve stejném pořadí. */
export function mergeCompoundAgentAnswers(params: {
  parts: { taskLabel: string; answer: AgentAnswer; intent: ClassifiedAgentIntent["intent"] }[];
}): AgentAnswer {
  const { parts } = params;
  if (parts.length === 0) {
    return {
      answer_text: "",
      confidence: 0,
      sources: [],
      generated_artifacts: [],
      next_actions: []
    };
  }
  if (parts.length === 1) {
    const only = parts[0]!;
    return { ...only.answer, intent: only.intent };
  }

  const mergedText = parts
    .map((p, i) => {
      const head = `### ${i + 1}. ${p.taskLabel}\n\n`;
      return `${head}${p.answer.answer_text.trim()}`;
    })
    .join("\n\n");

  const confidences = parts.map((p) => p.answer.confidence).filter((c) => Number.isFinite(c));
  const confidence = confidences.length ? Math.min(...confidences) : 0;

  const sources = [...new Set(parts.flatMap((p) => p.answer.sources ?? []))];
  const generated_artifacts = parts.flatMap((p) => p.answer.generated_artifacts ?? []);
  const next_actions = [...new Set(parts.flatMap((p) => p.answer.next_actions ?? []))];

  const bundles = parts.flatMap((p) => answerToBundles(p.answer));
  const intent = mergeIntents(parts.map((p) => p.intent));

  const base = parts[0]!.answer;
  const merged: AgentAnswer = {
    ...base,
    answer_text: mergedText,
    confidence,
    sources,
    generated_artifacts,
    next_actions,
    intent
  };

  if (bundles.length > 0) {
    merged.dataPanel = bundles[0]!.dataPanel;
    merged.dataPanelDownloads = bundles[0]!.dataPanelDownloads;
  }
  if (bundles.length > 1) {
    merged.dataPanelBundles = bundles;
  }

  return merged;
}
