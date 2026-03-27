export type AzureProxyMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function summarizeLlmMessages(messages: AzureProxyMessage[]) {
  return messages.map((m) => ({
    role: m.role,
    length: m.content.length,
    preview: m.content.slice(0, 1200)
  }));
}
