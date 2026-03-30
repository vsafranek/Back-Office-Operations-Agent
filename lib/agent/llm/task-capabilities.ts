import { inferSlideCountFromUserText } from "@/lib/agent/llm/intent-heuristics";

export type TaskCapabilities = {
  needsPresentation: boolean;
  needsSchedule: boolean;
  needsReportArtifacts: boolean;
  slideCount?: number;
};

export function parseTaskCapabilities(question: string): TaskCapabilities {
  const q = question.trim();
  const needsPresentation = /\b(prezentac\w*|pptx|power\s*point|slid\w*|deck)\b/i.test(q);
  const needsSchedule = /\b(kazdy|každý|denne|denně|tydne|týdně|cron|pravidelne|pravidelně|automaticky)\b/i.test(q);
  const needsReportArtifacts = /\b(report|csv|excel|xlsx|markdown|md)\b/i.test(q);
  const slideCount = inferSlideCountFromUserText(q);

  return {
    needsPresentation,
    needsSchedule,
    needsReportArtifacts,
    ...(slideCount ? { slideCount } : {})
  };
}
