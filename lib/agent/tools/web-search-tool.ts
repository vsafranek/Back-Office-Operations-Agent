import { z } from "zod";

export const WebSearchResultSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  snippet: z.string().optional()
});

export type WebSearchResult = z.infer<typeof WebSearchResultSchema>;

export const WebSearchInputSchema = z.object({
  query: z.string().min(3),
  maxResults: z.coerce.number().int().min(1).max(10).optional()
});

export const WebSearchOutputSchema = z.array(WebSearchResultSchema);

function normalizeUrl(url: string): string {
  return url.replace(/^\/+/, "");
}

export function parseDuckDuckGoHtml(html: string): WebSearchResult[] {
  // DuckDuckGo HTML: results are typically in <a class="result__a"> with a surrounding result block.
  // This parser is intentionally lightweight and tolerant to HTML structure changes.
  const results: WebSearchResult[] = [];

  const anchorMatches = Array.from(html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi));
  for (const match of anchorMatches) {
    const href = match[1];
    const rawTitle = match[2] ?? "";
    const title = rawTitle
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!href || !title) continue;

    // Try to capture snippet near the link (next few characters)
    const idx = match.index ?? 0;
    const window = html.slice(idx, idx + 800);
    const snippetMatch = window.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i) ?? window.match(/<div[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);
    const rawSnippet = snippetMatch?.[1] ?? "";
    const snippet = rawSnippet ? rawSnippet.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : undefined;

    const url = href.startsWith("http") ? href : `https://duckduckgo.com${normalizeUrl(href)}`;
    try {
      // Minimal URL sanity check; will throw if invalid.
      // eslint-disable-next-line no-new
      new URL(url);
      results.push({ title, url, snippet });
    } catch {
      // ignore invalid URLs
    }
    if (results.length >= 10) break;
  }

  // Deduplicate by URL, keep order.
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

export async function webSearch(params: z.infer<typeof WebSearchInputSchema>): Promise<WebSearchResult[]> {
  const maxResults = Math.min(10, Math.max(1, params.maxResults ?? 5));
  const q = encodeURIComponent(params.query.trim());

  // Server-side HTML scraping (no API keys). Locale tuned to Czech.
  const url = `https://duckduckgo.com/html/?q=${q}&kl=cz-cz&l=cz`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  const html = await res.text();

  const parsed = parseDuckDuckGoHtml(html);
  return parsed.slice(0, maxResults);
}

