import { z } from "zod";
import { listGmailMessages } from "@/lib/agent/tools/email-tool";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";

const listItemSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  snippet: z.string(),
  from: z.string(),
  subject: z.string(),
  date: z.string(),
  labelIds: z.array(z.string())
});

const inputSchema = z.object({
  userId: z.string().min(1),
  maxResults: z.coerce.number().int().min(1).max(50).optional(),
  /** Gmail search query (stejna syntaxe jako v UI Gmailu). */
  q: z.string().max(500).optional(),
  /** Např. ["INBOX"] — výchozí je INBOX, pokud pole nevyplníš. */
  labelIds: z.array(z.string().min(1)).max(10).optional()
});

const outputSchema = z.object({
  messages: z.array(listItemSchema)
});

const tool: McpTool<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> = {
  contract: {
    role: "tool",
    name: "listGmailMessages",
    description:
      "Přečte seznam zpráv ze schránky Gmail (výchozí INBOX). Volitelně filtruje dotazem `q` (Gmail search). " +
      "Jen čtení + metadata/snippet; pro celé tělo použij getGmailMessage.",
    inputSchema,
    outputSchema,
    auth: "service-role",
    sideEffects: []
  },
  run: async (_ctx: AgentToolContext, input) =>
    listGmailMessages({
      userId: input.userId,
      maxResults: input.maxResults,
      q: input.q,
      labelIds: input.labelIds
    })
};

export const listGmailMessagesTool: McpToolConfigEntry = {
  registryKey: "listGmailMessages",
  tool: tool as McpTool<unknown, unknown>
};
