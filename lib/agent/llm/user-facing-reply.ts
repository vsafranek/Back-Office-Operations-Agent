import { z } from "zod";
import type { AgentTraceRecorder } from "@/lib/agent/trace/recorder";
import { generateWithAzureProxy, streamWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
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

/**
 * Z dosud přijatého JSON výstupu modelu vytáhne prefix hodnoty `answer_text` (dekóduje běžné escape sekvence).
 * Pro živý výpis během streamu — klíč musí být uveden jako "answer_text": "
 */
export function extractAnswerTextFromPartialModelJson(buffer: string): string {
  const m = buffer.match(/"answer_text"\s*:\s*"/);
  if (!m || m.index === undefined) return "";
  let i = m.index + m[0].length;
  let out = "";
  while (i < buffer.length) {
    const c = buffer[i]!;
    if (c === "\\") {
      if (i + 1 >= buffer.length) break;
      const n = buffer[i + 1]!;
      if (n === "n") {
        out += "\n";
        i += 2;
        continue;
      }
      if (n === "r") {
        out += "\r";
        i += 2;
        continue;
      }
      if (n === "t") {
        out += "\t";
        i += 2;
        continue;
      }
      if (n === '"' || n === "\\" || n === "/") {
        out += n;
        i += 2;
        continue;
      }
      if (n === "u" && i + 5 < buffer.length) {
        const hex = buffer.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
      }
      out += n;
      i += 2;
      continue;
    }
    if (c === '"') break;
    out += c;
    i += 1;
  }
  return out;
}

function emitAnswerStreamDelta(
  onAnswerDelta: ((chunk: string) => void | Promise<void>) | undefined,
  buffer: string,
  lastEmittedLen: number
): number {
  if (!onAnswerDelta) return lastEmittedLen;
  const extracted = extractAnswerTextFromPartialModelJson(buffer);
  if (extracted.length <= lastEmittedLen) return lastEmittedLen;
  const piece = extracted.slice(lastEmittedLen);
  void Promise.resolve(onAnswerDelta(piece));
  return extracted.length;
}

export async function generateUserFacingReply(params: {
  runId: string;
  userContent: string;
  maxTokens?: number;
  trace?: { recorder: AgentTraceRecorder; parentId: string | null; name?: string };
  onAnswerDelta?: (chunk: string) => void | Promise<void>;
}): Promise<UserFacingReply> {
  const system =
    `${AGENT_SYSTEM_PROMPT}\n\n` +
    "Formuluj odpoved pro uzivatele vyhradne v cestine. Cerpej fakta jen z textu nize (payload); nic si nevymyslej. " +
    "V answer_text muzes pouzit lehoucke formatovani uvnitr retezce: odstavce (dvojity novy radek), **tučný text**, " +
    "odkazy jako [popis](https://...) misto holych URL, pripadne hola https URL se zobrazi jako klikatelny odkaz. " +
    "Vrat POUZE jeden validni JSON objekt (zbytek bez markdownu obalu), klice: " +
    'answer_text (retezec), confidence (0 az 1), next_actions (pole 2–4 kratkych konkretnich navrhu v cestine).';

  const llmName = params.trace?.name ?? "llm.user-facing.reply";
  const run = (user: string, traceSuffix: string) =>
    generateWithAzureProxy({
      runId: params.runId,
      maxTokens: params.maxTokens ?? 900,
      trace: params.trace
        ? {
            recorder: params.trace.recorder,
            parentId: params.trace.parentId,
            name: `${llmName}${traceSuffix}`
          }
        : undefined,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

  const streamFirst = Boolean(params.onAnswerDelta);
  const streamMessages: Parameters<typeof streamWithAzureProxy>[0]["messages"] = [
    { role: "system", content: system },
    { role: "user", content: params.userContent }
  ];

  let llm: Awaited<ReturnType<typeof generateWithAzureProxy>>;
  if (streamFirst) {
    const onTextDelta = (() => {
      let buf = "";
      let lastLen = 0;
      return (chunk: string) => {
        buf += chunk;
        lastLen = emitAnswerStreamDelta(params.onAnswerDelta, buf, lastLen);
      };
    })();
    try {
      llm = await streamWithAzureProxy({
        runId: params.runId,
        maxTokens: params.maxTokens ?? 900,
        trace: params.trace
          ? {
              recorder: params.trace.recorder,
              parentId: params.trace.parentId,
              name: `${llmName}`
            }
          : undefined,
        messages: streamMessages,
        onTextDelta
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.includes("did not include message content") ||
        msg.includes("Streamed completion did not include message content")
      ) {
        llm = await generateWithAzureProxy({
          runId: params.runId,
          maxTokens: params.maxTokens ?? 900,
          trace: params.trace
            ? {
                recorder: params.trace.recorder,
                parentId: params.trace.parentId,
                name: `${llmName}.nonstream-fallback`
              }
            : undefined,
          messages: streamMessages
        });
      } else {
        throw err;
      }
    }
  } else {
    llm = await run(params.userContent, "");
  }

  let parsed = tryParseJsonObject(UserReplySchema, llm.text);
  if (parsed) {
    return {
      answer_text: parsed.answer_text,
      confidence: parsed.confidence ?? 0.72,
      next_actions: parsed.next_actions?.length ? parsed.next_actions : []
    };
  }

  llm = await run(
    `${params.userContent}\n\n---\nPredchozi odpoved modelu nebyla pouzitelnym JSON. Vrat pouze validni JSON podle instrukci. Neopakuj omyl.\nPredchozi:\n${llm.text}`,
    ".retry"
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
    trace: params.trace
      ? {
          recorder: params.trace.recorder,
          parentId: params.trace.parentId,
          name: `${llmName}.final`
        }
      : undefined,
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
