import { z } from "zod";
import type { AgentTraceRecorder } from "@/lib/agent/trace/recorder";
import { tryParseJsonObject } from "@/lib/agent/llm/parse-json-response";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";

const RecipientCrmHintsSchema = z.object({
  searchTerms: z.array(z.string()).max(10)
});

const RECIPIENT_CRM_HINTS_SYSTEM = `Jsi krok „lookup“ před vyhledáním klientů v CRM (PostgreSQL). Z uživatelské zprávy a kontextu izoluj jen to, co se má použít k nalezení příjemce e-mailu v tabulce klientů.

Do pole searchTerms dávej konkrétní jména, příjmení nebo celé jméno (i ve skloňování, jak je v textu), případně část e-mailu zadanou uživatelem. Můžeš přidat variantu bez diakritiky jen pokud ji text opravdu obsahuje.

Nedávej: obecná slova (email, zpráva, nemovitost, schůzka, minut, termín…), pokud nejsou přímo součástí jména nebo e-mailu. Nedávej dlouhé věty. Pokud z textu neplyne konkrétní osoba ani e-mail k vyhledání, vrať prázdné pole searchTerms.

Výstup je vždy jen jeden JSON objekt bez markdownu: {"searchTerms":["..."]}`;

export type ExtractRecipientCrmSearchTermsParams = {
  text: string;
  runId: string;
  trace?: { recorder: AgentTraceRecorder; parentId: string | null };
};

/**
 * LLM extrakce výrazů pro vyhledávání příjemce v CRM (nahrazuje mechanické stop-slovníky).
 */
export async function extractRecipientCrmSearchTerms(
  params: ExtractRecipientCrmSearchTermsParams
): Promise<{ searchTerms: string[] }> {
  const content = params.text.trim().slice(0, 8000);
  if (!content) return { searchTerms: [] };

  const llm = await generateWithAzureProxy({
    runId: params.runId,
    maxTokens: 220,
    trace: params.trace
      ? {
          recorder: params.trace.recorder,
          parentId: params.trace.parentId,
          name: "llm.calendar-email.recipient-crm-hints"
        }
      : undefined,
    messages: [
      { role: "system", content: RECIPIENT_CRM_HINTS_SYSTEM },
      { role: "user", content: content }
    ]
  });

  const parsed = tryParseJsonObject(RecipientCrmHintsSchema, llm.text);
  if (!parsed) return { searchTerms: [] };

  const searchTerms = parsed.searchTerms
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 10);

  return { searchTerms };
}
