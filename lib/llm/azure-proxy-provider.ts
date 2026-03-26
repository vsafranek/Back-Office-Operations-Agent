import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";

export type AzureProxyMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AzureProxyResponse = {
  text: string;
  model: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function generateWithAzureProxy(params: {
  messages: AzureProxyMessage[];
  runId: string;
  model?: string;
  maxTokens?: number;
}): Promise<AzureProxyResponse> {
  const env = getEnv();
  const model = params.model ?? env.AZURE_PROXY_MODEL_DEFAULT;
  const maxTokens = Math.min(params.maxTokens ?? env.AZURE_PROXY_MAX_TOKENS_PER_REQUEST, env.AZURE_PROXY_MAX_TOKENS_PER_REQUEST);
  const baseUrl = env.AZURE_PROXY_BASE_URL.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/deployments/${env.AZURE_PROXY_DEPLOYMENT_ID}/chat/completions?api-version=${encodeURIComponent(env.AZURE_PROXY_API_VERSION)}`;

  const requestBody = {
    model,
    messages: params.messages,
    temperature: 0.2,
    max_tokens: maxTokens
  };

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.AZURE_PROXY_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": env.AZURE_PROXY_API_KEY
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (!response.ok) {
        if (RETRYABLE_STATUSES.has(response.status) && attempt < 3) {
          await sleep(attempt * 500);
          continue;
        }
        const body = await response.text();
        throw new Error(`Azure proxy call failed (${response.status}): ${body}`);
      }

      const data = (await response.json()) as {
        output_text?: string;
        model?: string;
        choices?: Array<{
          message?: {
            content?: string | Array<{ type?: string; text?: string }>;
          };
        }>;
        usage?: AzureProxyResponse["usage"];
      };

      const choiceContent = data.choices?.[0]?.message?.content;
      const parsedChoiceContent =
        typeof choiceContent === "string"
          ? choiceContent
          : Array.isArray(choiceContent)
            ? choiceContent
                .map((part) => (typeof part?.text === "string" ? part.text : ""))
                .join("\n")
            : "";

      const text = (data.output_text ?? parsedChoiceContent ?? "").trim();
      if (!text) {
        throw new Error("Azure proxy response did not include output_text.");
      }

      logger.info("azure_proxy_success", {
        runId: params.runId,
        model: data.model ?? model,
        usage: data.usage
      });

      clearTimeout(timeout);
      return {
        text,
        model: data.model ?? model,
        usage: data.usage
      };
    } catch (error) {
      clearTimeout(timeout);
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

  throw lastError instanceof Error ? lastError : new Error("Azure proxy generation failed.");
}
