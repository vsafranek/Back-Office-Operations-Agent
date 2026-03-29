import { describe, expect, it } from "vitest";
import { shouldAttemptCompoundQuestionSplit } from "@/lib/agent/llm/compound-question-split";

describe("shouldAttemptCompoundQuestionSplit", () => {
  it("krátká jednoduchá zpráva — nespouštět drahý split", () => {
    expect(shouldAttemptCompoundQuestionSplit("Ahoj")).toBe(false);
  });

  it("dvě otazníky — split", () => {
    expect(shouldAttemptCompoundQuestionSplit("Kdo je v Q1? A jaký máme stav leadů?")).toBe(true);
  });

  it("dlouhá souvislá věta — split (LLM rozhodne o jedné úloze)", () => {
    const q =
      "Prosím o přehled nových klientů za první kvartál, kde zjistíš odkud přišli a přidej srozumitelné vysvětlení trendů bez slidové prezentace. " +
      "Zajímají mě hlavně kanály akvizice a srovnání s předchozím rokem v rámci stejného období, pokud data v CRM dovolí rozumný odhad.";
    expect(shouldAttemptCompoundQuestionSplit(q)).toBe(true);
  });
});
