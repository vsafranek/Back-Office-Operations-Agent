import { z } from "zod";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/system-prompt";
import { tryParseJsonObject } from "@/lib/agent/llm/parse-json-response";

const UserReplySchema = z.object({
  answer_text: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  next_actions: z.array(z.string()).optional()
});

export type UserFacingReply = {
  answer_text: string;
  confidence: number;
  next_actions: string[];
};

export async function generateUserFacingReply(params: {
  runId: string;
  userContent: string;
  maxTokens?: number;
}): Promise<UserFacingReply> {
  const system =
    `${AGENT_SYSTEM_PROMPT}\n\n` +
    "Formuluj odpoved pro uzivatele vyhradne v cestine. Cerpej fakta jen z textu nize (payload); nic si nevymyslej. " +
    "Vrat POUZE jeden validni JSON objekt (bez markdownu), klice: " +
    'answer_text (retezec), confidence (0 az 1), next_actions (pole 2–4 kratkych konkretnich navrhu v cestine).';

  const run = (user: string) =>
    generateWithAzureProxy({
      runId: params.runId,
      maxTokens: params.maxTokens ?? 900,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

  let llm = await run(params.userContent);
  let parsed = tryParseJsonObject(UserReplySchema, llm.text);
  if (parsed) {
    return {
      answer_text: parsed.answer_text,
      confidence: parsed.confidence ?? 0.72,
      next_actions: parsed.next_actions?.length ? parsed.next_actions : []
    };
  }

  llm = await run(
    `${params.userContent}\n\n---\nPredchozi odpoved modelu nebyla pouzitelnym JSON. Vrat pouze validni JSON podle instrukci. Neopakuj omyl.\nPredchozi:\n${llm.text}`
  );
  parsed = tryParseJsonObject(UserReplySchema, llm.text);
  if (parsed) {
    return {
      answer_text: parsed.answer_text,
      confidence: parsed.confidence ?? 0.72,
      next_actions: parsed.next_actions?.length ? parsed.next_actions : []
    };
  }

  llm = await generateWithAzureProxy({
    runId: params.runId,
    maxTokens: 400,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `${params.userContent}\n\nZkus znovu: pouze JSON.` }
    ]
  });
  parsed = tryParseJsonObject(UserReplySchema, llm.text);
  if (parsed) {
    return {
      answer_text: parsed.answer_text,
      confidence: Math.min(0.65, parsed.confidence ?? 0.55),
      next_actions: parsed.next_actions?.length ? parsed.next_actions : []
    };
  }

  return {
    answer_text:
      "Nepodarilo se spolehlive sestavit strukturovanou odpoved modelu. Zkuste stejny dotaz znovu nebo ho mirne upresnete.",
    confidence: 0.35,
    next_actions: []
  };
}
