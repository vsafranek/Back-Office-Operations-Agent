import { describe, expect, it } from "vitest";
import { extractReadableTextFromHtml } from "../lib/agent/tools/web-fetch-tool";

describe("extractReadableTextFromHtml", () => {
  it("removes scripts/styles and collapses whitespace", () => {
    const html = `
      <html>
        <head>
          <style>.x{color:red}</style>
          <script>console.log('x')</script>
        </head>
        <body>
          <nav>menu</nav>
          <article>
            <h1> Nadpis </h1>
            <p>Prvni text.\n Druhy text.</p>
          </article>
        </body>
      </html>
    `;
    const text = extractReadableTextFromHtml(html, 2000);
    expect(text).toContain("Nadpis");
    expect(text).toContain("Prvni text.");
    expect(text).not.toContain("console.log");
    expect(text).not.toContain("menu");
    // whitespace collapsed
    expect(text).not.toContain("\n");
  });

  it("truncates to maxChars", () => {
    const html = `<article>${"A".repeat(1000)}</article>`;
    const text = extractReadableTextFromHtml(html, 100);
    expect(text.length).toBeLessThanOrEqual(100 + "…".length);
  });
});

