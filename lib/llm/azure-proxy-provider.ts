import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import type { AgentTraceRecorder } from "@/lib/agent/trace/recorder";
import { summarizeLlmMessages, type AzureProxyMessage } from "@/lib/llm/message-types";
import { getEnv, type AppEnv } from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";

export type LlmTraceParams = {
  recorder: AgentTraceRecorder;
  parentId: string | null;
  name: string;
};

export type { AzureProxyMessage };

type AzureProxyResponse = {
  text: string;
  model: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  /** ID řádku agent_trace_events (LLM krok), pokud byl zapnut trace. */
  traceEventId?: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createAzureOpenAIClient(env: AppEnv): OpenAI {
  const baseUrl = env.AZURE_PROXY_BASE_URL.replace(/\/+$/, "");
  return new OpenAI({
    apiKey: env.AZURE_PROXY_API_KEY,
    baseURL: `${baseUrl}/deployments/${env.AZURE_PROXY_DEPLOYMENT_ID}`,
    defaultQuery: { "api-version": env.AZURE_PROXY_API_VERSION },
    defaultHeaders: { "api-key": env.AZURE_PROXY_API_KEY },
    timeout: env.AZURE_PROXY_TIMEOUT_MS,
    maxRetries: 0
  });
}

function extractCompletionText(completion: ChatCompletion): string {
  const choice = completion.choices[0];
  const message = choice?.message;
  const content = message?.content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }
  const refusal = message?.refusal;
  if (typeof refusal === "string" && refusal.trim()) {
    return refusal.trim();
  }
  return "";
}

function mapUsage(completion: ChatCompletion): AzureProxyResponse["usage"] {
  const u = completion.usage;
  if (!u) return undefined;
  return {
    input_tokens: u.prompt_tokens,
    output_tokens: u.completion_tokens,
    total_tokens: u.total_tokens
  };
}

export async function generateWithAzureProxy(params: {
  messages: AzureProxyMessage[];
  runId: string;
  model?: string;
  maxTokens?: number;
  trace?: LlmTraceParams;
}): Promise<AzureProxyResponse> {
  const env = getEnv();
  const model = params.model ?? env.AZURE_PROXY_MODEL_DEFAULT;
  const maxTokens = Math.min(params.maxTokens ?? env.AZURE_PROXY_MAX_TOKENS_PER_REQUEST, env.AZURE_PROXY_MAX_TOKENS_PER_REQUEST);
  const client = createAzureOpenAIClient(env);

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const attemptStarted = Date.now();
      const completion = await client.chat.completions.create({
        model,
        messages: params.messages,
        temperature: 0.2,
        max_tokens: maxTokens
      });

      const text = extractCompletionText(completion);
      if (!text) {
        throw new Error("OpenAI chat completion did not include message content.");
      }

      const usage = mapUsage(completion);

      logger.info("azure_proxy_success", {
        runId: params.runId,
        model: completion.model ?? model,
        usage
      });

      let traceEventId: string | null = null;
      if (params.trace) {
        traceEventId = await params.trace.recorder.record({
          parentId: params.trace.parentId,
          kind: "llm",
          name: params.trace.name,
          input: summarizeLlmMessages(params.messages),
          output: {
            textPreview: text.slice(0, 8000),
            model: completion.model ?? model
          },
          durationMs: Date.now() - attemptStarted,
          meta: { usage }
        });
      }

      return {
        text,
        model: completion.model ?? model,
        usage,
        traceEventId
      };
    } catch (error) {
      lastError = error;
      logger.warn("azure_proxy_retry", {
        runId: params.runId,
        attempt,
        message: error instanceof Error ? error.message : "Unknown error"
      });
      if (attempt < 3) {
        await sleep(attempt * 600);
      }
    }
  }

  if (env.AZURE_PROXY_MODEL_FALLBACK && env.AZURE_PROXY_MODEL_FALLBACK !== model) {
    return generateWithAzureProxy({
      ...params,
      model: env.AZURE_PROXY_MODEL_FALLBACK
    });
  }

  throw lastError instanceof Error ? lastError : new Error("Azure OpenAI generation failed.");
}
