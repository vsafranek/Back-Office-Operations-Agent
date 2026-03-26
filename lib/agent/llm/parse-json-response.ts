import type { ZodType } from "zod";

export function tryParseJsonObject<T>(schema: ZodType<T>, raw: string): T | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence?.[1] ?? trimmed).trim();
  try {
    return schema.parse(JSON.parse(candidate));
  } catch {
    return null;
  }
}
