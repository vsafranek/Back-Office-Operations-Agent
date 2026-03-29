import type { AgentAnswer, AgentToolContext } from "@/lib/agent/types";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";
import { isLikelyCasualOnlyMessage, runCasualChatSubAgent } from "@/lib/agent/subagents/casual-chat-subagent";

export async function runWebSearchSubAgent(params: {
  toolRunner: ToolRunner;
  ctx: AgentToolContext;
  question: string;
}): Promise<AgentAnswer> {
  const query = params.question.trim();
  if (isLikelyCasualOnlyMessage(query)) {
    return runCasualChatSubAgent({ ctx: params.ctx, question: params.question });
  }
  const results = await params.toolRunner.run<
    Array<{ title: string; url: string; snippet?: string }>
  >("webSearch", params.ctx, { query, maxResults: 5 });

  const citations = Array.from(new Set(results.map((r) => r.url).filter(Boolean)));

  const fetchTop = Math.min(3, results.length);
  const fetchedPages = await Promise.all(
    results.slice(0, fetchTop).map(async (r) => {
      try {
        const page = await params.toolRunner.run<{ url: string; text: string; chars: number }>(
          "fetchWebPageText",
          params.ctx,
          { url: r.url, maxChars: 6000 }
        );
        return { ...r, pageText: page.text, fetchedUrl: page.url };
      } catch {
        return { ...r, pageText: undefined as string | undefined, fetchedUrl: undefined as string | undefined };
      }
    })
  );

  const usablePages = fetchedPages.filter((p) => typeof p.pageText === "string" && p.pageText.length > 0);

  const reply = await generateUserFacingReply({
    runId: params.ctx.runId,
    maxTokens: 1200,
    trace: params.ctx.trace
      ? {
          recorder: params.ctx.trace,
          parentId: params.ctx.traceParentId ?? null,
          name: "llm.subagent.web-search.reply"
        }
      : undefined,
    userContent: [
      `Dotaz uzivatele: ${params.question}`,
      "Pouzij VYHRADNE nize uvedene zdroje. Pokud neco nevypliva, rekni ze to z nich nejde spolehlive udelat.",
      "Struktura uvnitr answer_text: kratke shrnuti, odrázky s tvrzenimi, na konci sekce Zdroje s URL z payloadu.",
      "Search vysledky (seed):",
      JSON.stringify(results, null, 2),
      "Excerpty stranek (max ~4500 znaku na URL):",
      JSON.stringify(
        usablePages.map((p) => ({
          url: p.fetchedUrl ?? p.url,
          title: p.title,
          excerpt: (p.pageText ?? "").slice(0, 4500)
        })),
        null,
        2
      ),
      "Nepridavej URL ktere nejsou v datech vyse."
    ].join("\n\n")
  });

  return {
    answer_text: reply.answer_text,
    confidence: reply.confidence,
    sources: citations,
    generated_artifacts: [
      {
        type: "report",
        label: "Web search results (JSON)",
        content: JSON.stringify(results, null, 2)
      },
      {
        type: "report",
        label: "Web fetched pages (excerpt JSON)",
        content: JSON.stringify(
          fetchedPages.map((p) => ({
            url: p.fetchedUrl ?? p.url,
            title: p.title,
            snippet: p.snippet ?? null,
            hasFullText: typeof p.pageText === "string"
          })),
          null,
          2
        )
      }
    ],
    next_actions: reply.next_actions
  };
}
