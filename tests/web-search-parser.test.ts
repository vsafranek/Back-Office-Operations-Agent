import { describe, expect, it } from "vitest";
import { parseDuckDuckGoHtml } from "../lib/agent/tools/web-search-tool";

describe("parseDuckDuckGoHtml", () => {
  it("extracts title/url/snippet from DDG html", () => {
    const html = `
      <div class="result">
        <a class="result__a" href="https://example.com/foo">Example Foo</a>
        <a class="result__snippet">Krátky popis k výsledku.</a>
      </div>
    `;
    const results = parseDuckDuckGoHtml(html);
    expect(results.length).toBe(1);
    expect(results[0]?.title).toBe("Example Foo");
    expect(results[0]?.url).toBe("https://example.com/foo");
    expect(results[0]?.snippet).toContain("Krátky");
  });

  it("deduplicates by url", () => {
    const html = `
      <div>
        <a class="result__a" href="https://example.com/foo">Foo 1</a>
        <a class="result__snippet">S1</a>
      </div>
      <div>
        <a class="result__a" href="https://example.com/foo">Foo 2</a>
        <a class="result__snippet">S2</a>
      </div>
    `;
    const results = parseDuckDuckGoHtml(html);
    expect(results.length).toBe(1);
  });
});

