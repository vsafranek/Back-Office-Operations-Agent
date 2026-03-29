import { describe, expect, it } from "vitest";
import {
  parsePresentationSlidesFromLlmJson,
  presentationSlidesToTemplateSpecs,
  buildNativeTypedPptxBuffer,
  deriveHeroTitle,
  ensureOpeningTitleSlide,
  stripLeadingTitleSlides
} from "@/lib/agent/tools/presentation-typed-deck";

describe("presentation typed slides", () => {
  it("parsuje LLM pole podle discriminated union", () => {
    const raw = [
      { type: "title", title: "Týdenní report", subtitle: "Leden" },
      {
        type: "content",
        title: "KPI",
        bullets: ["A", "B", "C", "D"]
      },
      {
        type: "stats",
        title: "Čísla",
        stats: [
          { value: "12", label: "Leadů" },
          { value: "3", label: "Uzavřeno" }
        ]
      }
    ];
    const s = parsePresentationSlidesFromLlmJson(raw, 3);
    expect(s).not.toBeNull();
    expect(s![0]!.type).toBe("title");
    expect(s![1]!.type).toBe("content");
    expect(s![2]!.type).toBe("stats");
  });

  it("flattenuje na šablonové title+bullets", () => {
    const slides = parsePresentationSlidesFromLlmJson(
      [
        { type: "title", title: "Hlavní", subtitle: "Pod" },
        { type: "quote", quote: "Citát", attribution: "Autor" }
      ],
      2
    )!;
    const leg = presentationSlidesToTemplateSpecs(slides);
    expect(leg[0]!.bullets.length).toBeGreaterThanOrEqual(4);
    expect(leg[1]!.title).toBeTruthy();
    expect(leg[1]!.bullets.some((b) => b.includes("Citát"))).toBe(true);
  });

  it("deriveHeroTitle zkrátí dlouhý prompt a respektuje LLM titulek", () => {
    const long =
      "Udělej mi prosím velmi dlouhou a podrobnou prezentaci o všem co souvisí s prodejem nemovitostí v Brně za poslední čtvrtletí včetně všech detailů";
    expect(deriveHeroTitle(long, "KPI Brno Q4")).toBe("KPI Brno Q4");
    expect(deriveHeroTitle(long, undefined)).toBe("Prezentace");
    expect(deriveHeroTitle("  Krátký název  ", undefined)).toBe("Krátký název");
  });

  it("stripLeadingTitleSlides odstraní úvodní title slide", () => {
    const slides = parsePresentationSlidesFromLlmJson(
      [
        { type: "title", title: "Titulek", subtitle: "Pod" },
        { type: "content", title: "A", bullets: ["a", "b", "c"] }
      ],
      2
    )!;
    const stripped = stripLeadingTitleSlides(slides);
    expect(stripped).toHaveLength(1);
    expect(stripped[0]!.type).toBe("content");
  });

  it("ensureOpeningTitleSlide nepřepíše LLM titulek celým deck promptem", () => {
    const deck =
      "Chci PPTX o výkonu obchodníků za poslední měsíc s důrazem na konverze leadů a čas do prvního kontaktu včetně tabulky a grafu";
    const slides = parsePresentationSlidesFromLlmJson(
      [
        { type: "title", title: "Výkon obchodníků", subtitle: "Leden" },
        { type: "content", title: "Metriky", bullets: ["a", "b", "c"] }
      ],
      2
    )!;
    const fixed = ensureOpeningTitleSlide(slides, deck, 2);
    expect(fixed[0]!.type).toBe("title");
    expect((fixed[0] as { title: string }).title).toBe("Výkon obchodníků");
  });

  it("vygeneruje neprázdný pptx z nativního builderu", async () => {
    const slides = parsePresentationSlidesFromLlmJson(
      [
        { type: "title", title: "Test", subtitle: "Vitest" },
        { type: "content", title: "Body", bullets: ["j", "k", "l", "m"] }
      ],
      2
    )!;
    const buf = await buildNativeTypedPptxBuffer("Deck test", slides);
    expect(buf.byteLength).toBeGreaterThan(5_000);
  });
});
