import type { ClassifiedAgentIntent } from "@/lib/agent/llm/intent-classifier";

/** ASCII-ish form for regex matching (Czech diacritics removed). */
export function normalizeForIntentHeuristics(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses explicit slide count from Czech/English user text when the LLM omits slideCount.
 * Supports digits ("3 slidy") and common Czech words ("třemi slidy", "tremi slidy").
 */
export function inferSlideCountFromUserText(question: string): number | undefined {
  const n = normalizeForIntentHeuristics(question);

  const digit = n.match(/\b(\d{1,2})\s+slid/);
  if (digit) {
    const v = Number.parseInt(digit[1]!, 10);
    if (v >= 2 && v <= 15) return v;
  }

  const czMap: Array<{ re: RegExp; value: number }> = [
    { re: /\b(?:peti|patem)\s+slid/, value: 5 },
    { re: /\b(?:ctyrmi|ctyri|styri)\s+slid/, value: 4 },
    { re: /\b(?:tremi|tri)\s+slid/, value: 3 },
    { re: /\b(?:dvema|dve|dva)\s+slid/, value: 2 }
  ];

  for (const { re, value } of czMap) {
    if (re.test(n)) return value;
  }

  return undefined;
}

/**
 * User asks for a management/weekly-style written report plus a deck → full artifact bundle (weekly_report),
 * not presentation-only. Skipped when the user clearly wants only the PPTX.
 */
export function shouldPreferWeeklyReportBundle(question: string): boolean {
  const n = normalizeForIntentHeuristics(question);

  if (/\b(?:jen|pouze|only)\s+prezent/.test(n)) return false;
  if (/\b(?:jen|pouze|only)\s+(?:pptx|ppt)\b/.test(n)) return false;
  if (/\bzadny\s+(?:csv|excel)|\bbez\s+(?:csv|excel|xlsx|md|markdown|datasetu|dat)\b/.test(n)) return false;

  const hasDeck =
    /prezentac|slidov|pptx|power\s*point|\bslid|\bdeck\b/.test(n);

  const hasBundleCue =
    /report\s+pro\s+veden|manazersk|\bvedeni\b|shrnu|shrnut|\bshrn\b|vysledk|minul[ey]ho\s+tydn|tydenn|\btydn|\bcsv\b|markdown|\bexcel|\bbalicek/.test(
      n
    );

  return hasDeck && hasBundleCue;
}

/** Refine classifier output using deterministic rules (Czech copy, explicit slide counts). */
export function applyPresentationIntentHeuristics(
  classified: ClassifiedAgentIntent,
  question: string
): ClassifiedAgentIntent {
  let intent = classified.intent;
  let slideCount = classified.slideCount;

  if (intent === "presentation" && shouldPreferWeeklyReportBundle(question)) {
    intent = "weekly_report";
  }

  const fromText = inferSlideCountFromUserText(question);
  if (
    (intent === "presentation" || intent === "weekly_report") &&
    fromText !== undefined
  ) {
    slideCount = fromText;
  }

  return { intent, slideCount };
}
