import { z } from "zod";
import { load } from "cheerio";

export const FetchWebPageTextInputSchema = z.object({
  url: z.string().url(),
  maxChars: z.coerce.number().int().min(500).max(20000).optional()
});

export const FetchWebPageTextOutputSchema = z.object({
  url: z.string().url(),
  text: z.string().min(1),
  chars: z.number().int().nonnegative()
});

export type FetchWebPageTextInput = z.infer<typeof FetchWebPageTextInputSchema>;
export type FetchWebPageTextOutput = z.infer<typeof FetchWebPageTextOutputSchema>;

export function extractReadableTextFromHtml(html: string, maxChars: number): string {
  const $ = load(html);

  // Remove typical non-content nodes.
  $("script, style, noscript, svg, canvas, iframe, form, nav, header, footer").remove();

  const candidates = ["article", "main", "section", "body"];
  let raw = "";
  for (const sel of candidates) {
    const t = $(sel).first().text();
    if (t && t.trim().length > 200) {
      raw = t;
      break;
    }
  }
  if (!raw) raw = $("body").text();

  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trim()}…`;
}

function normalizeForOutput(url: string): string {
  return url.replace(/^\/+/, "");
}

export async function fetchWebPageText(params: FetchWebPageTextInput): Promise<FetchWebPageTextOutput> {
  const maxChars = Math.min(20000, Math.max(500, params.maxChars ?? 8000));
  const res = await fetch(params.url, {
    headers: { "user-agent": "Mozilla/5.0" }
  });

  if (!res.ok) {
    throw new Error(`FETCH_FAILED: HTTP ${res.status}`);
  }

  const html = await res.text();
  const text = extractReadableTextFromHtml(html, maxChars);
  if (!text) {
    throw new Error("FETCH_FAILED: EMPTY_TEXT");
  }

  const finalUrl = normalizeForOutput(res.url || params.url);
  const output: FetchWebPageTextOutput = { url: finalUrl, text, chars: text.length };
  return output;
}

