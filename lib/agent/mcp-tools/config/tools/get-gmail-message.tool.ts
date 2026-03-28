import { z } from "zod";
import { getGmailMessage } from "@/lib/agent/tools/email-tool";
import type { McpTool } from "@/lib/agent/mcp-tools/types";
import type { AgentToolContext } from "@/lib/agent/types";
import type { McpToolConfigEntry } from "@/lib/agent/mcp-tools/config/types";

const inputSchema = z.object({
  userId: z.string().min(1),
  messageId: z.string().min(2),
  maxBodyChars: z.coerce.number().int().min(500).max(100_000).optional()
});

const outputSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  snippet: z.string(),
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  date: z.string(),
  labelIds: z.array(z.string()),
  bodyText: z.string()
});

const tool: McpTool<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> = {
  contract: {
    role: "tool",
    name: "getGmailMessage",
    description:
      "Načte jednu Gmail zprávu podle ID (z listGmailMessages): hlavičky, snippet a pokud jde, text/plain tělo (zkrácené). " +
      "HTML-only zprávy mohou mít prázdné bodyText.",
    inputSchema,
    outputSchema,
    auth: "service-role",
    sideEffects: []
  },
  run: async (_ctx: AgentToolContext, input) =>
    getGmailMessage({
      userId: input.userId,
      messageId: input.messageId,
      maxBodyChars: input.maxBodyChars
    })
};

export const getGmailMessageTool: McpToolConfigEntry = {
  registryKey: "getGmailMessage",
  tool: tool as McpTool<unknown, unknown>
};
